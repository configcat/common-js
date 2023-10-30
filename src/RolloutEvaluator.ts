import type { LoggerWrapper } from "./ConfigCatLogger";
import { LogLevel } from "./ConfigCatLogger";
import { sha1, sha256 } from "./Hash";
import type { ConditionUnion, IPercentageOption, ITargetingRule, PercentageOption, PrerequisiteFlagCondition, ProjectConfig, SegmentCondition, Setting, SettingValue, SettingValueContainer, TargetingRule, UserCondition, UserConditionUnion, VariationIdValue, WellKnownUserObjectAttribute } from "./ProjectConfig";
import { PrerequisiteFlagComparator, SegmentComparator, SettingType, UserComparator } from "./ProjectConfig";
import type { ISemVer } from "./Semver";
import { parse as parseSemVer } from "./Semver";
import { errorToString, formatStringList, isArray, utf8Encode } from "./Utils";

/** User Object. Contains user attributes which are used for evaluating targeting rules and percentage options. */
export class User {
  /**
   * Converts the specified `Date` value to the format expected by datetime comparison operators (BEFORE/AFTER).
   * @param date The `Date` value to convert.
   * @returns The User Object attribute value in the expected format.
  */
  static attributeValueFromDate(date: Date): string {
    if (!(date instanceof Date)) {
      throw new Error("Invalid 'date' value");
    }

    const unixTimeSeconds = date.getTime() / 1000;
    return unixTimeSeconds + "";
  }

  /**
   * Converts the specified `number` value to the format expected by number comparison operators.
   * @param number The `number` value to convert.
   * @returns The User Object attribute value in the expected format.
  */
  static attributeValueFromNumber(number: number): string {
    if (typeof number !== "number" || !isFinite(number)) {
      throw new Error("Invalid 'date' value");
    }

    return number + "";
  }

  /**
   * Converts the specified `string` items to the format expected by array comparison operators (ARRAY CONTAINS ANY OF/ARRAY NOT CONTAINS ANY OF).
   * @param items The `string` items to convert.
   * @returns The User Object attribute value in the expected format.
  */
  static attributeValueFromStringArray(...items: ReadonlyArray<string>): string {
    if (!isStringArray(items)) {
      throw new Error("Invalid 'items' value");
    }

    return JSON.stringify(items);
  }

  constructor(
    /** The unique identifier of the user or session (e.g. email address, primary key, session ID, etc.) */
    public identifier: string,
    /** Email address of the user. */
    public email?: string,
    /** Country of the user. */
    public country?: string,
    /** Custom attributes of the user for advanced targeting rule definitions (e.g. user role, subscription type, etc.) */
    public custom: { [key: string]: string } = {}
  ) {
  }
}

// NOTE: This could be an instance method of the User class, however formerly we suggested `const user = { ... }`-style initialization in the SDK docs,
// which would lead to "...is not a function" errors if we called functions on instances created that way as those don't have the correct prototype.
function getUserAttributes(user: User): { [key: string]: string } {
  // TODO: https://trello.com/c/A3DDpqYU
  const result: { [key: string]: string } = {};

  const identifierAttribute: WellKnownUserObjectAttribute = "Identifier";
  const emailAttribute: WellKnownUserObjectAttribute = "Email";
  const countryAttribute: WellKnownUserObjectAttribute = "Country";

  result[identifierAttribute] = user.identifier ?? "";

  if (user.email != null) {
    result[emailAttribute] = user.email;
  }

  if (user.country != null) {
    result[countryAttribute] = user.country;
  }

  if (user.custom != null) {
    const wellKnownAttributes: string[] = [identifierAttribute, emailAttribute, countryAttribute];
    for (const attributeName of Object.keys(user.custom)) {
      if (wellKnownAttributes.indexOf(attributeName) < 0) {
        result[attributeName] = user.custom[attributeName];
      }
    }
  }

  return result;
}

export class EvaluateContext {
  private $userAttributes?: { [key: string]: string } | null;
  get userAttributes(): { [key: string]: string } | null {
    const attributes = this.$userAttributes;
    return attributes !== void 0 ? attributes : (this.$userAttributes = this.user ? getUserAttributes(this.user) : null);
  }

  private $visitedFlags?: string[];
  get visitedFlags(): string[] { return this.$visitedFlags ??= []; }

  isMissingUserObjectLogged?: boolean;
  isMissingUserObjectAttributeLogged?: boolean;

  logBuilder?: EvaluateLogBuilder; // initialized by RolloutEvaluator.evaluate

  constructor(
    readonly key: string,
    readonly setting: Setting,
    readonly user: User | undefined,
    readonly settings: Readonly<{ [name: string]: Setting }>
  ) {
  }

  static forPrerequisiteFlag(key: string, setting: Setting, dependentFlagContext: EvaluateContext): EvaluateContext {
    const context = new EvaluateContext(key, setting, dependentFlagContext.user, dependentFlagContext.settings);
    context.$userAttributes = dependentFlagContext.$userAttributes;
    context.$visitedFlags = dependentFlagContext.visitedFlags; // crucial to use the computed property here to make sure the list is created!
    context.logBuilder = dependentFlagContext.logBuilder;
    return context;
  }
}

export interface IEvaluateResult {
  selectedValue: SettingValueContainer;
  matchedTargetingRule?: TargetingRule;
  matchedPercentageOption?: PercentageOption;
}

export interface IRolloutEvaluator {
  evaluate(defaultValue: SettingValue, context: EvaluateContext): IEvaluateResult;
}

export class RolloutEvaluator implements IRolloutEvaluator {
  constructor(private readonly logger: LoggerWrapper) {
  }

  evaluate(defaultValue: SettingValue, context: EvaluateContext): IEvaluateResult {
    this.logger.debug("RolloutEvaluator.evaluate() called.");

    let logBuilder = context.logBuilder;

    // Building the evaluation log is expensive, so let's not do it if it wouldn't be logged anyway.
    if (this.logger.isEnabled(LogLevel.Info)) {
      context.logBuilder = logBuilder = new EvaluateLogBuilder();

      logBuilder.append(`Evaluating '${context.key}'`);

      if (context.user) {
        logBuilder.append(` for User '${JSON.stringify(context.userAttributes)}'`);
      }

      logBuilder.increaseIndent();
    }

    let returnValue: SettingValue;
    try {
      const result = this.evaluateSetting(context);
      returnValue = result.selectedValue.value;
      let isAllowedReturnValue: boolean;

      if (defaultValue != null) {
        // NOTE: We've already checked earlier in the call chain that the defaultValue is of an allowed type (see also ensureAllowedDefaultValue).

        const settingType = context.setting.type;
        // A negative setting type indicates a setting which comes from a flag override (see also Setting.fromValue).
        if (settingType >= 0 && !isCompatibleValue(defaultValue, settingType)) {
          throw new TypeError(
            "The type of a setting must match the type of the specified default value. "
            + `Setting's type was ${SettingType[settingType]} but the default value's type was ${typeof defaultValue}. `
            + `Please use a default value which corresponds to the setting type ${SettingType[settingType]}.`);
        }

        // When a default value other than null or undefined is specified, the return value must have the same type as the default value
        // so that the consistency between TS (compile-time) and JS (run-time) return value types is maintained.
        isAllowedReturnValue = typeof returnValue === typeof defaultValue;
      }
      else {
        // When the specified default value is null or undefined, the return value can be of whatever allowed type (boolean, string, number).
        isAllowedReturnValue = isAllowedValue(returnValue);
      }

      if (!isAllowedReturnValue) {
        throw new TypeError(
          returnValue === null ? "Setting value is null." :
          returnValue === void 0 ? "Setting value is undefined." :
          `Setting value '${returnValue}' is of an unsupported type (${typeof returnValue}).`);
      }

      return result;
    }
    catch (err) {
      logBuilder?.resetIndent().increaseIndent();

      returnValue = defaultValue;
      throw err;
    }
    finally {
      if (logBuilder) {
        logBuilder.newLine(`Returning '${returnValue}'.`)
          .decreaseIndent();
        this.logger.settingEvaluated(logBuilder.toString());
      }
    }
  }

  private evaluateSetting(context: EvaluateContext): IEvaluateResult {
    let evaluateResult: IEvaluateResult | undefined;

    const targetingRules = context.setting.targetingRules;
    if (targetingRules.length > 0 && (evaluateResult = this.evaluateTargetingRules(targetingRules, context))) {
      return evaluateResult;
    }

    const percentageOptions = context.setting.percentageOptions;
    if (percentageOptions.length > 0 && (evaluateResult = this.evaluatePercentageOptions(percentageOptions, void 0, context))) {
      return evaluateResult;
    }

    return { selectedValue: context.setting };
  }

  private evaluateTargetingRules(targetingRules: ReadonlyArray<TargetingRule>, context: EvaluateContext): IEvaluateResult | undefined {
    const logBuilder = context.logBuilder;

    logBuilder?.newLine("Evaluating targeting rules and applying the first match if any:");

    for (let i = 0; i < targetingRules.length; i++) {
      const targetingRule = targetingRules[i];
      const conditions = targetingRule.conditions;

      const isMatchOrError = this.evaluateConditions(conditions, targetingRule, context.key, context);

      if (isMatchOrError !== true) {
        if (isEvaluationError(isMatchOrError)) {
          logBuilder?.increaseIndent()
            .newLine(targetingRuleIgnoredMessage)
            .decreaseIndent();
        }
        continue;
      }

      if (!isArray(targetingRule.then)) {
        return { selectedValue: targetingRule.then, matchedTargetingRule: targetingRule };
      }

      const percentageOptions = targetingRule.then;

      logBuilder?.increaseIndent();

      const evaluateResult = this.evaluatePercentageOptions(percentageOptions, targetingRule, context);
      if (evaluateResult) {
        logBuilder?.decreaseIndent();
        return evaluateResult;
      }

      logBuilder?.newLine(targetingRuleIgnoredMessage)
        .decreaseIndent();
    }
  }

  private evaluatePercentageOptions(percentageOptions: ReadonlyArray<PercentageOption>, targetingRule: TargetingRule | undefined, context: EvaluateContext): IEvaluateResult | undefined {
    const logBuilder = context.logBuilder;

    if (!context.user) {
      logBuilder?.newLine("Skipping % options because the User Object is missing.");

      if (!context.isMissingUserObjectLogged) {
        this.logger.userObjectIsMissing(context.key);
        context.isMissingUserObjectLogged = true;
      }

      return;
    }

    const percentageOptionsAttributeName = context.setting.percentageOptionsAttribute;
    const percentageOptionsAttributeValue = context.userAttributes![percentageOptionsAttributeName];
    if (percentageOptionsAttributeValue == null) {
      logBuilder?.newLine(`Skipping % options because the User.${percentageOptionsAttributeName} attribute is missing.`);

      if (!context.isMissingUserObjectAttributeLogged) {
        this.logger.userObjectAttributeIsMissingPercentage(context.key, percentageOptionsAttributeName);
        context.isMissingUserObjectAttributeLogged = true;
      }

      return;
    }

    logBuilder?.newLine(`Evaluating % options based on the User.${percentageOptionsAttributeName} attribute:`);

    const sha1Hash = sha1(context.key + percentageOptionsAttributeValue);
    const hashValue = parseInt(sha1Hash.substring(0, 7), 16) % 100;

    logBuilder?.newLine(`- Computing hash in the [0..99] range from User.${percentageOptionsAttributeName} => ${hashValue} (this value is sticky and consistent across all SDKs)`);

    let bucket = 0;
    for (let i = 0; i < percentageOptions.length; i++) {
      const percentageOption = percentageOptions[i];

      bucket += percentageOption.percentage;

      if (hashValue >= bucket) {
        continue;
      }

      logBuilder?.newLine(`- Hash value ${hashValue} selects % option ${i + 1} (${percentageOption.percentage}%), '${valueToString(percentageOption.value)}'.`);

      return { selectedValue: percentageOption, matchedTargetingRule: targetingRule, matchedPercentageOption: percentageOption };
    }

    throw new Error("Sum of percentage option percentages are less than 100.");
  }

  private evaluateConditions(conditions: ReadonlyArray<ConditionUnion>, targetingRule: TargetingRule | undefined, contextSalt: string, context: EvaluateContext): boolean | string {
    // The result of a condition evaluation is either match (true) / no match (false) or an error (string).
    let result: boolean | string = true;

    const logBuilder = context.logBuilder;
    let newLineBeforeThen = false;

    logBuilder?.newLine("- ");

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];

      if (logBuilder) {
        if (!i) {
          logBuilder.append("IF ")
            .increaseIndent();
        }
        else {
          logBuilder.increaseIndent()
            .newLine("AND ");
        }
      }

      switch (condition.type) {
        case "UserCondition":
          result = this.evaluateUserCondition(condition, contextSalt, context);
          newLineBeforeThen = conditions.length > 1;
          break;

        case "PrerequisiteFlagCondition":
          result = this.evaluatePrerequisiteFlagCondition(condition, context);
          newLineBeforeThen = !isEvaluationError(result) || result !== circularDependencyError || conditions.length > 1;
          break;

        case "SegmentCondition":
          result = this.evaluateSegmentCondition(condition, context);
          newLineBeforeThen = !isEvaluationError(result) || result !== missingUserObjectError || conditions.length > 1;
          break;

        default:
          throw new Error(); // execution should never get here
      }

      const isMatch = result === true;

      if (logBuilder) {
        if (!targetingRule || conditions.length > 1) {
          logBuilder.appendConditionConsequence(isMatch);
        }

        logBuilder.decreaseIndent();
      }

      if (!isMatch) {
        break;
      }
    }

    if (targetingRule) {
      logBuilder?.appendTargetingRuleConsequence(targetingRule, result, newLineBeforeThen);
    }

    return result;
  }

  private evaluateUserCondition(condition: UserConditionUnion, contextSalt: string, context: EvaluateContext): boolean | string {
    const logBuilder = context.logBuilder;
    logBuilder?.appendUserCondition(condition);

    if (!context.user) {
      if (!context.isMissingUserObjectLogged) {
        this.logger.userObjectIsMissing(context.key);
        context.isMissingUserObjectLogged = true;
      }

      return missingUserObjectError;
    }

    const userAttributeName = condition.comparisonAttribute;
    const userAttributeValue = context.userAttributes![userAttributeName];
    if (!userAttributeValue) { // besides null and undefined, empty string is considered missing value as well
      this.logger.userObjectAttributeIsMissingCondition(formatUserCondition(condition), context.key, userAttributeName);
      return missingUserAttributeError(userAttributeName);
    }

    let version: ISemVer | null, number: number, array: ReadonlyArray<string> | null;
    switch (condition.comparator) {
      case UserComparator.TextEquals:
      case UserComparator.TextNotEquals:
        return this.evaluateTextEquals(userAttributeValue, condition.comparisonValue, condition.comparator === UserComparator.TextNotEquals);

      case UserComparator.SensitiveTextEquals:
      case UserComparator.SensitiveTextNotEquals:
        return this.evaluateSensitiveTextEquals(userAttributeValue, condition.comparisonValue,
          context.setting.configJsonSalt, contextSalt, condition.comparator === UserComparator.SensitiveTextNotEquals);

      case UserComparator.IsOneOf:
      case UserComparator.IsNotOneOf:
        return this.evaluateIsOneOf(userAttributeValue, condition.comparisonValue, condition.comparator === UserComparator.IsNotOneOf);

      case UserComparator.SensitiveIsOneOf:
      case UserComparator.SensitiveIsNotOneOf:
        return this.evaluateSensitiveIsOneOf(userAttributeValue, condition.comparisonValue,
          context.setting.configJsonSalt, contextSalt, condition.comparator === UserComparator.SensitiveIsNotOneOf);

      case UserComparator.TextStartsWithAnyOf:
      case UserComparator.TextNotStartsWithAnyOf:
        return this.evaluateTextSliceEqualsAnyOf(userAttributeValue, condition.comparisonValue, true, condition.comparator === UserComparator.TextNotStartsWithAnyOf);

      case UserComparator.SensitiveTextStartsWithAnyOf:
      case UserComparator.SensitiveTextNotStartsWithAnyOf:
        return this.evaluateSensitiveTextSliceEqualsAnyOf(userAttributeValue, condition.comparisonValue,
          context.setting.configJsonSalt, contextSalt, true, condition.comparator === UserComparator.SensitiveTextNotStartsWithAnyOf);

      case UserComparator.TextEndsWithAnyOf:
      case UserComparator.TextNotEndsWithAnyOf:
        return this.evaluateTextSliceEqualsAnyOf(userAttributeValue, condition.comparisonValue, false, condition.comparator === UserComparator.TextNotEndsWithAnyOf);

      case UserComparator.SensitiveTextEndsWithAnyOf:
      case UserComparator.SensitiveTextNotEndsWithAnyOf:
        return this.evaluateSensitiveTextSliceEqualsAnyOf(userAttributeValue, condition.comparisonValue,
          context.setting.configJsonSalt, contextSalt, false, condition.comparator === UserComparator.SensitiveTextNotEndsWithAnyOf);

      case UserComparator.ContainsAnyOf:
      case UserComparator.NotContainsAnyOf:
        return this.evaluateContainsAnyOf(userAttributeValue, condition.comparisonValue, condition.comparator === UserComparator.NotContainsAnyOf);

      case UserComparator.SemVerIsOneOf:
      case UserComparator.SemVerIsNotOneOf:
        version = parseSemVer(userAttributeValue.trim());
        if (!version) {
          return handleInvalidUserAttribute(this.logger, condition, context.key, userAttributeName, `'${userAttributeValue}' is not a valid semantic version`);
        }
        return this.evaluateSemVerIsOneOf(version, condition.comparisonValue, condition.comparator === UserComparator.SemVerIsNotOneOf);

      case UserComparator.SemVerLess:
      case UserComparator.SemVerLessOrEquals:
      case UserComparator.SemVerGreater:
      case UserComparator.SemVerGreaterOrEquals:
        version = parseSemVer(userAttributeValue.trim());
        if (!version) {
          return handleInvalidUserAttribute(this.logger, condition, context.key, userAttributeName, `'${userAttributeValue}' is not a valid semantic version`);
        }
        return this.evaluateSemVerRelation(version, condition.comparator, condition.comparisonValue);

      case UserComparator.NumberEquals:
      case UserComparator.NumberNotEquals:
      case UserComparator.NumberLess:
      case UserComparator.NumberLessOrEquals:
      case UserComparator.NumberGreater:
      case UserComparator.NumberGreaterOrEquals:
        number = parseFloat(userAttributeValue.replace(",", "."));
        if (!isFinite(number)) {
          return handleInvalidUserAttribute(this.logger, condition, context.key, userAttributeName, `'${userAttributeValue}' is not a valid decimal number`);
        }
        return this.evaluateNumberRelation(number, condition.comparator, condition.comparisonValue);

      case UserComparator.DateTimeBefore:
      case UserComparator.DateTimeAfter:
        number = parseFloat(userAttributeValue.replace(",", "."));
        if (!isFinite(number)) {
          return handleInvalidUserAttribute(this.logger, condition, context.key, userAttributeName, `'${userAttributeValue}' is not a valid Unix timestamp (number of seconds elapsed since Unix epoch)`);
        }
        return this.evaluateDateTimeRelation(number, condition.comparisonValue, condition.comparator === UserComparator.DateTimeBefore);

      case UserComparator.ArrayContainsAnyOf:
      case UserComparator.ArrayNotContainsAnyOf:
        array = parseArrayComparisonValue(userAttributeValue);
        if (!array) {
          return handleInvalidUserAttribute(this.logger, condition, context.key, userAttributeName, `'${userAttributeValue}' is not a valid JSON string array`);
        }
        return this.evaluateArrayContainsAnyOf(array, condition.comparisonValue, condition.comparator === UserComparator.ArrayNotContainsAnyOf);

      case UserComparator.SensitiveArrayContainsAnyOf:
      case UserComparator.SensitiveArrayNotContainsAnyOf:
        array = parseArrayComparisonValue(userAttributeValue);
        if (!array) {
          return handleInvalidUserAttribute(this.logger, condition, context.key, userAttributeName, `'${userAttributeValue}' is not a valid JSON string array`);
        }
        return this.evaluateSensitiveArrayContainsAnyOf(array, condition.comparisonValue,
          context.setting.configJsonSalt, contextSalt, condition.comparator === UserComparator.SensitiveArrayNotContainsAnyOf);

      default:
        throw new Error(); // execution should never get here (unless there is an error in the config JSON)
    }
  }

  private evaluateTextEquals(text: string, comparisonValue: string, negate: boolean): boolean {
    return (text === comparisonValue) !== negate;
  }

  private evaluateSensitiveTextEquals(text: string, comparisonValue: string, configJsonSalt: string, contextSalt: string, negate: boolean): boolean {
    const hash = hashComparisonValue(text, configJsonSalt, contextSalt);
    return (hash === comparisonValue) !== negate;
  }

  private evaluateIsOneOf(text: string, comparisonValues: ReadonlyArray<string>, negate: boolean): boolean {
    // NOTE: Array.prototype.indexOf uses strict equality.
    const isMatch = comparisonValues.indexOf(text) >= 0;
    return isMatch !== negate;
  }

  private evaluateSensitiveIsOneOf(text: string, comparisonValues: ReadonlyArray<string>, configJsonSalt: string, contextSalt: string, negate: boolean): boolean {
    const hash = hashComparisonValue(text, configJsonSalt, contextSalt);
    // NOTE: Array.prototype.indexOf uses strict equality.
    const isMatch = comparisonValues.indexOf(hash) >= 0;
    return isMatch !== negate;
  }

  private evaluateTextSliceEqualsAnyOf(text: string, comparisonValues: ReadonlyArray<string>, startsWith: boolean, negate: boolean): boolean {
    for (let i = 0; i < comparisonValues.length; i++) {
      const item = comparisonValues[i];

      if (text.length < item.length) {
        continue;
      }

      // NOTE: String.prototype.startsWith/endsWith were introduced after ES5. We'd rather work around them instead of polyfilling them.
      const isMatch = (startsWith ? text.lastIndexOf(item, 0) : text.indexOf(item, text.length - item.length)) >= 0;
      if (isMatch) {
        return !negate;
      }
    }

    return negate;
  }

  private evaluateSensitiveTextSliceEqualsAnyOf(text: string, comparisonValues: ReadonlyArray<string>, configJsonSalt: string, contextSalt: string, startsWith: boolean, negate: boolean): boolean {
    const textUtf8 = utf8Encode(text);

    for (let i = 0; i < comparisonValues.length; i++) {
      const item = comparisonValues[i];

      const index = item.indexOf("_");
      const sliceLength = parseInt(item.slice(0, index));

      if (textUtf8.length < sliceLength) {
        continue;
      }

      const sliceUtf8 = startsWith ? textUtf8.slice(0, sliceLength) : textUtf8.slice(textUtf8.length - sliceLength);
      const hash = hashComparisonValueSlice(sliceUtf8, configJsonSalt, contextSalt);

      const isMatch = hash === item.slice(index + 1);
      if (isMatch) {
        return !negate;
      }
    }

    return negate;
  }

  private evaluateContainsAnyOf(text: string, comparisonValues: ReadonlyArray<string>, negate: boolean): boolean {
    for (let i = 0; i < comparisonValues.length; i++) {
      if (text.indexOf(comparisonValues[i]) >= 0) {
        return !negate;
      }
    }

    return negate;
  }

  private evaluateSemVerIsOneOf(version: ISemVer, comparisonValues: ReadonlyArray<string>, negate: boolean): boolean {
    let result = false;

    for (let i = 0; i < comparisonValues.length; i++) {
      const item = comparisonValues[i];

      // NOTE: Previous versions of the evaluation algorithm ignore empty comparison values.
      // We keep this behavior for backward compatibility.
      if (!item.length) {
        continue;
      }

      const version2 = parseSemVer(item.trim());
      if (!version2) {
        // NOTE: Previous versions of the evaluation algorithm ignored invalid comparison values.
        // We keep this behavior for backward compatibility.
        return false;
      }

      if (!result && version.compare(version2) === 0) {
        // NOTE: Previous versions of the evaluation algorithm require that
        // none of the comparison values are empty or invalid, that is, we can't stop when finding a match.
        // We keep this behavior for backward compatibility.
        result = true;
      }
    }

    return result !== negate;
  }

  private evaluateSemVerRelation(version: ISemVer,
    comparator: UserComparator.SemVerLess | UserComparator.SemVerLessOrEquals | UserComparator.SemVerGreater | UserComparator.SemVerGreaterOrEquals,
    comparisonValue: string): boolean {

    const version2 = parseSemVer(comparisonValue.trim());
    if (!version2) {
      return false;
    }

    const comparisonResult = version.compare(version2);
    switch (comparator) {
      case UserComparator.SemVerLess: return comparisonResult < 0;
      case UserComparator.SemVerLessOrEquals: return comparisonResult <= 0;
      case UserComparator.SemVerGreater: return comparisonResult > 0;
      case UserComparator.SemVerGreaterOrEquals: return comparisonResult >= 0;
    }
  }

  private evaluateNumberRelation(number: number,
    comparator: UserComparator.NumberEquals | UserComparator.NumberNotEquals | UserComparator.NumberLess | UserComparator.NumberLessOrEquals | UserComparator.NumberGreater | UserComparator.NumberGreaterOrEquals,
    comparisonValue: number): boolean {
    switch (comparator) {
      case UserComparator.NumberEquals: return number === comparisonValue;
      case UserComparator.NumberNotEquals: return number !== comparisonValue;
      case UserComparator.NumberLess: return number < comparisonValue;
      case UserComparator.NumberLessOrEquals: return number <= comparisonValue;
      case UserComparator.NumberGreater: return number > comparisonValue;
      case UserComparator.NumberGreaterOrEquals: return number >= comparisonValue;
    }
  }

  private evaluateDateTimeRelation(number: number, comparisonValue: number, before: boolean): boolean {
    return before ? number < comparisonValue : number > comparisonValue;
  }

  private evaluateArrayContainsAnyOf(array: ReadonlyArray<string>, comparisonValues: ReadonlyArray<string>, negate: boolean): boolean {
    for (let i = 0; i < array.length; i++) {
      // NOTE: Array.prototype.indexOf uses strict equality.
      const isMatch = comparisonValues.indexOf(array[i]) >= 0;
      if (isMatch) {
        return !negate;
      }
    }

    return negate;
  }

  private evaluateSensitiveArrayContainsAnyOf(array: ReadonlyArray<string>, comparisonValues: ReadonlyArray<string>, configJsonSalt: string, contextSalt: string, negate: boolean): boolean {
    for (let i = 0; i < array.length; i++) {
      const hash = hashComparisonValue(array[i], configJsonSalt, contextSalt);
      // NOTE: Array.prototype.indexOf uses strict equality.
      const isMatch = comparisonValues.indexOf(hash) >= 0;
      if (isMatch) {
        return !negate;
      }
    }

    return negate;
  }

  private evaluatePrerequisiteFlagCondition(condition: PrerequisiteFlagCondition, context: EvaluateContext): boolean | string {
    const logBuilder = context.logBuilder;
    logBuilder?.appendPrerequisiteFlagCondition(condition);

    const prerequisiteFlagKey = condition.prerequisiteFlagKey;
    const prerequisiteFlag = context.settings[prerequisiteFlagKey];

    context.visitedFlags.push(context.key);

    if (context.visitedFlags.indexOf(prerequisiteFlagKey) >= 0) {
      context.visitedFlags.push(prerequisiteFlagKey);
      const dependencyCycle = formatStringList(context.visitedFlags, void 0, void 0, " -> ");
      this.logger.circularDependencyDetected(formatPrerequisiteFlagCondition(condition), context.key, dependencyCycle);

      context.visitedFlags.splice(-2);
      return circularDependencyError;
    }

    const prerequisiteFlagContext = EvaluateContext.forPrerequisiteFlag(prerequisiteFlagKey, prerequisiteFlag, context);

    logBuilder?.newLine("(")
      .increaseIndent()
      .newLine(`Evaluating prerequisite flag '${prerequisiteFlagKey}':`);

    const prerequisiteFlagEvaluateResult = this.evaluateSetting(prerequisiteFlagContext);

    context.visitedFlags.pop();

    const prerequisiteFlagValue = prerequisiteFlagEvaluateResult.selectedValue.value;
    let result = isAllowedValue(prerequisiteFlagValue);

    switch (condition.comparator) {
      case PrerequisiteFlagComparator.Equals:
        result &&= prerequisiteFlagValue === condition.comparisonValue;
        break;
      case PrerequisiteFlagComparator.NotEquals:
        result &&= prerequisiteFlagValue !== condition.comparisonValue;
        break;
      default:
        throw new Error(); // execution should never get here (unless there is an error in the config JSON)
    }

    logBuilder?.newLine(`Prerequisite flag evaluation result: '${valueToString(prerequisiteFlagValue)}'.`)
      .newLine("Condition (")
      .appendPrerequisiteFlagCondition(condition)
      .append(") evaluates to ").appendEvaluationResult(result).append(".")
      .decreaseIndent()
      .newLine(")");

    return result;
  }

  private evaluateSegmentCondition(condition: SegmentCondition, context: EvaluateContext): boolean | string {
    const logBuilder = context.logBuilder;
    logBuilder?.appendSegmentCondition(condition);

    if (!context.user) {
      if (!context.isMissingUserObjectLogged) {
        this.logger.userObjectIsMissing(context.key);
        context.isMissingUserObjectLogged = true;
      }

      return missingUserObjectError;
    }

    const segment = condition.segment;

    logBuilder?.newLine("(")
      .increaseIndent()
      .newLine(`Evaluating segment '${segment.name}':`);

    const segmentResult = this.evaluateConditions(segment.conditions, void 0, segment.name, context);
    let result = segmentResult;

    if (!isEvaluationError(result)) {
      switch (condition.comparator) {
        case SegmentComparator.IsIn:
          break;
        case SegmentComparator.IsNotIn:
          result = !result;
          break;
        default:
          throw new Error(); // execution should never get here (unless there is an error in the config JSON)
      }
    }

    if (logBuilder) {
      logBuilder.newLine("Segment evaluation result: ");
      (!isEvaluationError(result)
        ? logBuilder.append(`User ${formatSegmentComparator(segmentResult ? SegmentComparator.IsIn : SegmentComparator.IsNotIn)}`)
        : logBuilder.append(result))
        .append(".");

      logBuilder.newLine("Condition (").appendSegmentCondition(condition).append(")");
      (!isEvaluationError(result)
        ? logBuilder.append(" evaluates to ").appendEvaluationResult(result)
        : logBuilder.append(" failed to evaluate"))
        .append(".");

      logBuilder
        .decreaseIndent()
        .newLine(")");
    }

    return result;
  }
}

function isEvaluationError(isMatchOrError: boolean | string): isMatchOrError is string {
  return typeof isMatchOrError === "string";
}

function isStringArray(value: unknown): value is string[] {
  return isArray(value) && !value.some(item => typeof item !== "string");
}

function parseArrayComparisonValue(value: string): ReadonlyArray<string> | null {
  let parsedObject: unknown;
  try { parsedObject = JSON.parse(value); }
  catch { return null; }

  return isStringArray(parsedObject) ? parsedObject : null;
}

function hashComparisonValue(value: string, configJsonSalt: string, contextSalt: string) {
  return hashComparisonValueSlice(utf8Encode(value), configJsonSalt, contextSalt);
}

function hashComparisonValueSlice(sliceUtf8: string, configJsonSalt: string, contextSalt: string) {
  return sha256(sliceUtf8 + utf8Encode(configJsonSalt) + utf8Encode(contextSalt));
}

function handleInvalidUserAttribute(logger: LoggerWrapper, condition: UserConditionUnion, key: string, userAttributeName: string, reason: string) {
  logger.userObjectAttributeIsInvalid(formatUserCondition(condition), key, reason, userAttributeName);
  return invalidUserAttributeError(userAttributeName, reason);
}

/* Evaluation log */

const missingUserObjectError = "cannot evaluate, User Object is missing";
const missingUserAttributeError = (attributeName: string) => `cannot evaluate, the User.${attributeName} attribute is missing`;
const invalidUserAttributeError = (attributeName: string, reason: string) => `cannot evaluate, the User.${attributeName} attribute is invalid (${reason})`;
const circularDependencyError = "cannot evaluate, circular dependency detected";

const targetingRuleIgnoredMessage = "The current targeting rule is ignored and the evaluation continues with the next rule.";

const invalidValuePlaceholder = "<invalid value>";
const invalidNamePlaceholder = "<invalid name>";
const invalidOperatorPlaceholder = "<invalid operator>";
const invalidReferencePlaceholder = "<invalid reference>";

const stringListMaxLength = 10;

class EvaluateLogBuilder {
  private log = "";
  private indent = "";

  resetIndent(): this {
    this.indent = "";
    return this;
  }

  increaseIndent(): this {
    this.indent += "  ";
    return this;
  }

  decreaseIndent(): this {
    this.indent = this.indent.slice(0, -2);
    return this;
  }

  newLine(text?: string): this {
    this.log += "\n" + this.indent + (text ?? "");
    return this;
  }

  append(text: string): this {
    this.log += text;
    return this;
  }

  toString(): string {
    return this.log;
  }

  appendEvaluationResult(isMatch: boolean): this {
    return this.append(`${isMatch}`);
  }

  private appendUserConditionCore(comparisonAttribute: string, comparator: UserComparator, comparisonValue?: unknown) {
    return this.append(`User.${comparisonAttribute} ${formatUserComparator(comparator)} '${comparisonValue ?? invalidValuePlaceholder}'`);
  }

  private appendUserConditionString(comparisonAttribute: string, comparator: UserComparator, comparisonValue: string, isSensitive: boolean) {
    return this.appendUserConditionCore(comparisonAttribute, comparator, !isSensitive ? comparisonValue : "<hashed value>");
  }

  private appendUserConditionStringList(comparisonAttribute: string, comparator: UserComparator, comparisonValue: ReadonlyArray<string>, isSensitive: boolean): this {
    if (comparisonValue == null) {
      return this.appendUserConditionCore(comparisonAttribute, comparator);
    }

    const valueText = "value", valuesText = "values";

    const comparatorFormatted = formatUserComparator(comparator);
    if (isSensitive) {
      return this.append(`User.${comparisonAttribute} ${comparatorFormatted} [<${comparisonValue.length} hashed ${comparisonValue.length === 1 ? valueText : valuesText}>]`);
    }
    else {
      const comparisonValueFormatted = formatStringList(comparisonValue, stringListMaxLength, count =>
        `, ... <${count} more ${count === 1 ? valueText : valuesText}>`);

      return this.append(`User.${comparisonAttribute} ${comparatorFormatted} [${comparisonValueFormatted}]`);
    }
  }

  private appendUserConditionNumber(comparisonAttribute: string, comparator: UserComparator, comparisonValue: number, isDateTime?: boolean) {
    if (comparisonValue == null) {
      return this.appendUserConditionCore(comparisonAttribute, comparator);
    }

    const comparatorFormatted = formatUserComparator(comparator);
    let date: Date;
    return isDateTime && !isNaN((date = new Date(comparisonValue * 1000)) as unknown as number) // see https://stackoverflow.com/a/1353711/8656352
      ? this.append(`User.${comparisonAttribute} ${comparatorFormatted} '${comparisonValue}' (${date.toISOString()} UTC)`)
      : this.append(`User.${comparisonAttribute} ${comparatorFormatted} '${comparisonValue}'`);
  }

  appendUserCondition(condition: UserConditionUnion): this {
    const { comparisonAttribute, comparator } = condition;
    switch (condition.comparator) {
      case UserComparator.IsOneOf:
      case UserComparator.IsNotOneOf:
      case UserComparator.ContainsAnyOf:
      case UserComparator.NotContainsAnyOf:
      case UserComparator.SemVerIsOneOf:
      case UserComparator.SemVerIsNotOneOf:
      case UserComparator.TextStartsWithAnyOf:
      case UserComparator.TextNotStartsWithAnyOf:
      case UserComparator.TextEndsWithAnyOf:
      case UserComparator.TextNotEndsWithAnyOf:
      case UserComparator.ArrayContainsAnyOf:
      case UserComparator.ArrayNotContainsAnyOf:
        return this.appendUserConditionStringList(comparisonAttribute, comparator, condition.comparisonValue, false);

      case UserComparator.SemVerLess:
      case UserComparator.SemVerLessOrEquals:
      case UserComparator.SemVerGreater:
      case UserComparator.SemVerGreaterOrEquals:
      case UserComparator.TextEquals:
      case UserComparator.TextNotEquals:
        return this.appendUserConditionString(comparisonAttribute, comparator, condition.comparisonValue, false);

      case UserComparator.NumberEquals:
      case UserComparator.NumberNotEquals:
      case UserComparator.NumberLess:
      case UserComparator.NumberLessOrEquals:
      case UserComparator.NumberGreater:
      case UserComparator.NumberGreaterOrEquals:
        return this.appendUserConditionNumber(comparisonAttribute, comparator, condition.comparisonValue);

      case UserComparator.SensitiveIsOneOf:
      case UserComparator.SensitiveIsNotOneOf:
      case UserComparator.SensitiveTextStartsWithAnyOf:
      case UserComparator.SensitiveTextNotStartsWithAnyOf:
      case UserComparator.SensitiveTextEndsWithAnyOf:
      case UserComparator.SensitiveTextNotEndsWithAnyOf:
      case UserComparator.SensitiveArrayContainsAnyOf:
      case UserComparator.SensitiveArrayNotContainsAnyOf:
        return this.appendUserConditionStringList(comparisonAttribute, comparator, condition.comparisonValue, true);

      case UserComparator.DateTimeBefore:
      case UserComparator.DateTimeAfter:
        return this.appendUserConditionNumber(comparisonAttribute, comparator, condition.comparisonValue, true);

      case UserComparator.SensitiveTextEquals:
      case UserComparator.SensitiveTextNotEquals:
        return this.appendUserConditionString(comparisonAttribute, comparator, condition.comparisonValue, true);

      default:
        return this.appendUserConditionCore(comparisonAttribute, comparator, (condition as UserCondition).comparisonValue);
    }
  }

  appendPrerequisiteFlagCondition(condition: PrerequisiteFlagCondition): this {
    const prerequisiteFlagKey = condition.prerequisiteFlagKey;
    const comparator = condition.comparator;
    const comparisonValue = condition.comparisonValue;

    return this.append(`Flag '${prerequisiteFlagKey}' ${formatPrerequisiteFlagComparator(comparator)} '${valueToString(comparisonValue)}'`);
  }

  appendSegmentCondition(condition: SegmentCondition): this {
    const segment = condition.segment;
    const comparator = condition.comparator;

    const segmentName = segment?.name ??
      (segment == null ? invalidReferencePlaceholder : invalidNamePlaceholder);

    return this.append(`User ${formatSegmentComparator(comparator)} '${segmentName}'`);
  }

  appendConditionConsequence(isMatch: boolean): this {
    this.append(" => ").appendEvaluationResult(isMatch);
    return isMatch ? this : this.append(", skipping the remaining AND conditions");
  }

  appendTargetingRuleThenPart(targetingRule: TargetingRule, newLine: boolean) {
    (newLine ? this.newLine() : this.append(" "))
      .append("THEN");

    const then = targetingRule.then;
    return this.append(!isArray(then) ? ` '${valueToString(then.value)}'` : " % options");
  }

  appendTargetingRuleConsequence(targetingRule: TargetingRule, isMatchOrError: boolean | string, newLine: boolean): this {
    this.increaseIndent();

    this.appendTargetingRuleThenPart(targetingRule, newLine)
      .append(" => ").append(isMatchOrError === true ? "MATCH, applying rule" : isMatchOrError === false ? "no match" : isMatchOrError);

    return this.decreaseIndent();
  }
}

function formatUserComparator(comparator: UserComparator) {
  switch (comparator) {
    case UserComparator.IsOneOf:
    case UserComparator.SensitiveIsOneOf:
    case UserComparator.SemVerIsOneOf: return "IS ONE OF";
    case UserComparator.IsNotOneOf:
    case UserComparator.SensitiveIsNotOneOf:
    case UserComparator.SemVerIsNotOneOf: return "IS NOT ONE OF";
    case UserComparator.ContainsAnyOf: return "CONTAINS ANY OF";
    case UserComparator.NotContainsAnyOf: return "NOT CONTAINS ANY OF";
    case UserComparator.SemVerLess:
    case UserComparator.NumberLess: return "<";
    case UserComparator.SemVerLessOrEquals:
    case UserComparator.NumberLessOrEquals: return "<=";
    case UserComparator.SemVerGreater:
    case UserComparator.NumberGreater: return ">";
    case UserComparator.SemVerGreaterOrEquals:
    case UserComparator.NumberGreaterOrEquals: return ">=";
    case UserComparator.NumberEquals: return "=";
    case UserComparator.NumberNotEquals: return "!=";
    case UserComparator.DateTimeBefore: return "BEFORE";
    case UserComparator.DateTimeAfter: return "AFTER";
    case UserComparator.TextEquals:
    case UserComparator.SensitiveTextEquals: return "EQUALS";
    case UserComparator.TextNotEquals:
    case UserComparator.SensitiveTextNotEquals: return "NOT EQUALS";
    case UserComparator.TextStartsWithAnyOf:
    case UserComparator.SensitiveTextStartsWithAnyOf: return "STARTS WITH ANY OF";
    case UserComparator.TextNotStartsWithAnyOf:
    case UserComparator.SensitiveTextNotStartsWithAnyOf: return "NOT STARTS WITH ANY OF";
    case UserComparator.TextEndsWithAnyOf:
    case UserComparator.SensitiveTextEndsWithAnyOf: return "ENDS WITH ANY OF";
    case UserComparator.TextNotEndsWithAnyOf:
    case UserComparator.SensitiveTextNotEndsWithAnyOf: return "NOT ENDS WITH ANY OF";
    case UserComparator.ArrayContainsAnyOf:
    case UserComparator.SensitiveArrayContainsAnyOf: return "ARRAY CONTAINS ANY OF";
    case UserComparator.ArrayNotContainsAnyOf:
    case UserComparator.SensitiveArrayNotContainsAnyOf: return "ARRAY NOT CONTAINS ANY OF";
    default: return invalidOperatorPlaceholder;
  }
}

function formatUserCondition(condition: UserConditionUnion) {
  return new EvaluateLogBuilder().appendUserCondition(condition).toString();
}

function formatPrerequisiteFlagComparator(comparator: PrerequisiteFlagComparator) {
  switch (comparator) {
    case PrerequisiteFlagComparator.Equals: return "EQUALS";
    case PrerequisiteFlagComparator.NotEquals: return "NOT EQUALS";
    default: return invalidOperatorPlaceholder;
  }
}

function formatPrerequisiteFlagCondition(condition: PrerequisiteFlagCondition) {
  return new EvaluateLogBuilder().appendPrerequisiteFlagCondition(condition).toString();
}

function formatSegmentComparator(comparator: SegmentComparator) {
  switch (comparator) {
    case SegmentComparator.IsIn: return "IS IN SEGMENT";
    case SegmentComparator.IsNotIn: return "IS NOT IN SEGMENT";
    default: return invalidOperatorPlaceholder;
  }
}

/* Helper functions */

export type SettingTypeOf<T> =
  T extends boolean ? boolean :
  T extends number ? number :
  T extends string ? string :
  T extends null ? boolean | number | string | null :
  T extends undefined ? boolean | number | string | undefined :
  any;

/** The evaluated value and additional information about the evaluation of a feature flag or setting. */
export interface IEvaluationDetails<TValue = SettingValue> {
  /** Key of the feature flag or setting. */
  key: string;

  /** Evaluated value of the feature or setting flag. */
  value: TValue;

  /** Variation ID of the feature or setting flag (if available). */
  variationId?: VariationIdValue;

  /** Time of last successful config download (if there has been a successful download already). */
  fetchTime?: Date;

  /** The User object used for the evaluation (if available). */
  user?: User;

  /**
   * Indicates whether the default value passed to the setting evaluation methods like `IConfigCatClient.getValueAsync`, `IConfigCatClient.getValueDetailsAsync`, etc.
   * is used as the result of the evaluation.
   */
  isDefaultValue: boolean;

  /** Error message in case evaluation failed. */
  errorMessage?: string;

  /** The exception object related to the error in case evaluation failed (if any). */
  errorException?: any;

  /** The targeting rule which was used to select the evaluated value (if any). */
  matchedEvaluationRule?: ITargetingRule;

  /** The percentage option which was used to select the evaluated value (if any). */
  matchedEvaluationPercentageRule?: IPercentageOption;
}

function evaluationDetailsFromEvaluateResult<T extends SettingValue>(key: string, evaluateResult: IEvaluateResult, fetchTime?: Date, user?: User): IEvaluationDetails<SettingTypeOf<T>> {
  return {
    key,
    value: evaluateResult.selectedValue.value as SettingTypeOf<T>,
    variationId: evaluateResult.selectedValue.variationId,
    fetchTime,
    user,
    isDefaultValue: false,
    matchedEvaluationRule: evaluateResult.matchedTargetingRule,
    matchedEvaluationPercentageRule: evaluateResult.matchedPercentageOption,
  };
}

export function evaluationDetailsFromDefaultValue<T extends SettingValue>(key: string, defaultValue: T, fetchTime?: Date, user?: User, errorMessage?: string, errorException?: any): IEvaluationDetails<SettingTypeOf<T>> {
  return {
    key,
    value: defaultValue as SettingTypeOf<T>,
    fetchTime,
    user,
    isDefaultValue: true,
    errorMessage,
    errorException
  };
}

export function evaluate<T extends SettingValue>(evaluator: IRolloutEvaluator, settings: Readonly<{ [name: string]: Setting }> | null, key: string, defaultValue: T,
  user: User | undefined, remoteConfig: ProjectConfig | null, logger: LoggerWrapper): IEvaluationDetails<SettingTypeOf<T>> {

  let errorMessage: string;
  if (!settings) {
    errorMessage = logger.configJsonIsNotPresentSingle(key, "defaultValue", defaultValue).toString();
    return evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorMessage);
  }

  const setting = settings[key];
  if (!setting) {
    errorMessage = logger.settingEvaluationFailedDueToMissingKey(key, "defaultValue", defaultValue, formatStringList(Object.keys(settings))).toString();
    return evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorMessage);
  }

  const evaluateResult = evaluator.evaluate(defaultValue, new EvaluateContext(key, setting, user, settings));

  return evaluationDetailsFromEvaluateResult<T>(key, evaluateResult, getTimestampAsDate(remoteConfig), user);
}

export function evaluateAll(evaluator: IRolloutEvaluator, settings: Readonly<{ [name: string]: Setting }> | null,
  user: User | undefined, remoteConfig: ProjectConfig | null, logger: LoggerWrapper, defaultReturnValue: string): [IEvaluationDetails[], any[] | undefined] {

  let errors: any[] | undefined;

  if (!checkSettingsAvailable(settings, logger, defaultReturnValue)) {
    return [[], errors];
  }

  const evaluationDetailsArray: IEvaluationDetails[] = [];

  for (const [key, setting] of Object.entries(settings)) {
    let evaluationDetails: IEvaluationDetails;
    try {
      const evaluateResult = evaluator.evaluate(null, new EvaluateContext(key, setting, user, settings));
      evaluationDetails = evaluationDetailsFromEvaluateResult(key, evaluateResult, getTimestampAsDate(remoteConfig), user);
    }
    catch (err) {
      errors ??= [];
      errors.push(err);
      evaluationDetails = evaluationDetailsFromDefaultValue(key, null, getTimestampAsDate(remoteConfig), user, errorToString(err), err);
    }

    evaluationDetailsArray.push(evaluationDetails);
  }

  return [evaluationDetailsArray, errors];
}

export function checkSettingsAvailable(settings: Readonly<{ [name: string]: Setting }> | null, logger: LoggerWrapper, defaultReturnValue: string): settings is Readonly<{ [name: string]: Setting }> {
  if (!settings) {
    logger.configJsonIsNotPresent(defaultReturnValue);
    return false;
  }

  return true;
}

export function isAllowedValue(value: unknown): value is NonNullable<SettingValue> {
  return typeof value === "boolean" || typeof value === "string" || typeof value === "number";
}

function isCompatibleValue(value: SettingValue, settingType: SettingType): boolean {
  switch (settingType) {
    case SettingType.Boolean: return typeof value === "boolean";
    case SettingType.String: return typeof value === "string";
    case SettingType.Int:
    case SettingType.Double: return typeof value === "number";
    default: return false;
  }
}

function valueToString(value: NonNullable<SettingValue>): string {
  return isAllowedValue(value) ? value.toString() : invalidValuePlaceholder;
}

export function getTimestampAsDate(projectConfig: ProjectConfig | null): Date | undefined {
  return projectConfig ? new Date(projectConfig.timestamp) : void 0;
}
