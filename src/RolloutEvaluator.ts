import type { LoggerWrapper } from "./ConfigCatLogger";
import { LogLevel } from "./ConfigCatLogger";
import { PrerequisiteFlagComparator, SegmentComparator, SettingType, UserComparator } from "./ConfigJson";
import { EvaluateLogBuilder, formatSegmentComparator, formatUserCondition, valueToString } from "./EvaluateLogBuilder";
import { sha1, sha256 } from "./Hash";
import type { ConditionUnion, IPercentageOption, ITargetingRule, PercentageOption, PrerequisiteFlagCondition, ProjectConfig, SegmentCondition, Setting, SettingValue, SettingValueContainer, TargetingRule, UserConditionUnion, VariationIdValue } from "./ProjectConfig";
import type { ISemVer } from "./Semver";
import { parse as parseSemVer } from "./Semver";
import type { User, UserAttributeValue, WellKnownUserObjectAttribute } from "./User";
import { getUserAttribute, getUserAttributes } from "./User";
import { errorToString, formatStringList, isArray, isStringArray, parseFloatStrict, utf8Encode } from "./Utils";

export class EvaluateContext {
  private $visitedFlags?: string[];
  get visitedFlags(): string[] { return this.$visitedFlags ??= []; }

  isMissingUserObjectLogged?: boolean;
  isMissingUserObjectAttributeLogged?: boolean;

  logBuilder?: EvaluateLogBuilder; // initialized by RolloutEvaluator.evaluate

  constructor(
    readonly key: string,
    readonly setting: Setting,
    readonly user: User | undefined,
    readonly settings: Readonly<{ [name: string]: Setting }>,
  ) {
  }

  static forPrerequisiteFlag(key: string, setting: Setting, dependentFlagContext: EvaluateContext): EvaluateContext {
    const context = new EvaluateContext(key, setting, dependentFlagContext.user, dependentFlagContext.settings);
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

const targetingRuleIgnoredMessage = "The current targeting rule is ignored and the evaluation continues with the next rule.";

const missingUserObjectError = "cannot evaluate, User Object is missing";
const missingUserAttributeError = (attributeName: string) => `cannot evaluate, the User.${attributeName} attribute is missing`;
const invalidUserAttributeError = (attributeName: string, reason: string) => `cannot evaluate, the User.${attributeName} attribute is invalid (${reason})`;

export class RolloutEvaluator implements IRolloutEvaluator {
  constructor(private readonly logger: LoggerWrapper) {
  }

  evaluate(defaultValue: SettingValue, context: EvaluateContext): IEvaluateResult {
    this.logger.debug("RolloutEvaluator.evaluate() called.");

    let logBuilder = context.logBuilder;

    // Building the evaluation log is expensive, so let's not do it if it wouldn't be logged anyway.
    if (this.logger.isEnabled(LogLevel.Info)) {
      context.logBuilder = logBuilder = new EvaluateLogBuilder(this.logger.eol);

      logBuilder.append(`Evaluating '${context.key}'`);

      if (context.user) {
        logBuilder.append(` for User '${JSON.stringify(getUserAttributes(context.user))}'`);
      }

      logBuilder.increaseIndent();
    }

    let returnValue: SettingValue;
    try {
      let result: IEvaluateResult, isValidReturnValue: boolean;

      if (defaultValue != null) {
        // NOTE: We've already checked earlier in the call chain that the defaultValue is of an allowed type (see also ensureAllowedDefaultValue).

        const settingType = context.setting.type;
        // A negative setting type indicates a setting which comes from a flag override (see also Setting.fromValue).
        if (settingType >= 0 && !isCompatibleValue(defaultValue, settingType)) {
          throw new TypeError(
            "The type of a setting must match the type of the specified default value. "
            + `Setting's type was ${SettingType[settingType]} but the default value's type was ${typeof defaultValue}. `
            + `Please use a default value which corresponds to the setting type ${SettingType[settingType]}. `
            + "Learn more: https://configcat.com/docs/sdk-reference/js/#setting-type-mapping");
        }

        result = this.evaluateSetting(context);
        returnValue = result.selectedValue.value;

        // When a default value other than null or undefined is specified, the return value must have the same type as the default value
        // so that the consistency between TS (compile-time) and JS (run-time) return value types is maintained.
        isValidReturnValue = typeof returnValue === typeof defaultValue;
      }
      else {
        result = this.evaluateSetting(context);
        returnValue = result.selectedValue.value;

        // When the specified default value is null or undefined, the return value can be of whatever allowed type (boolean, string, number).
        isValidReturnValue = isAllowedValue(returnValue);
      }

      if (!isValidReturnValue) {
        handleInvalidReturnValue(returnValue);
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

  private evaluatePercentageOptions(percentageOptions: ReadonlyArray<PercentageOption>, matchedTargetingRule: TargetingRule | undefined, context: EvaluateContext): IEvaluateResult | undefined {
    const logBuilder = context.logBuilder;

    if (!context.user) {
      logBuilder?.newLine("Skipping % options because the User Object is missing.");

      if (!context.isMissingUserObjectLogged) {
        this.logger.userObjectIsMissing(context.key);
        context.isMissingUserObjectLogged = true;
      }

      return;
    }

    let percentageOptionsAttributeName = context.setting.percentageOptionsAttribute;
    let percentageOptionsAttributeValue: UserAttributeValue | null | undefined;

    if (percentageOptionsAttributeName == null) {
      percentageOptionsAttributeName = <WellKnownUserObjectAttribute>"Identifier";
      percentageOptionsAttributeValue = context.user.identifier ?? "";
    }
    else {
      percentageOptionsAttributeValue = getUserAttribute(context.user, percentageOptionsAttributeName);
    }

    if (percentageOptionsAttributeValue == null) {
      logBuilder?.newLine(`Skipping % options because the User.${percentageOptionsAttributeName} attribute is missing.`);

      if (!context.isMissingUserObjectAttributeLogged) {
        this.logger.userObjectAttributeIsMissingPercentage(context.key, percentageOptionsAttributeName);
        context.isMissingUserObjectAttributeLogged = true;
      }

      return;
    }

    logBuilder?.newLine(`Evaluating % options based on the User.${percentageOptionsAttributeName} attribute:`);

    const sha1Hash = sha1(context.key + userAttributeValueToString(percentageOptionsAttributeValue));
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

      return { selectedValue: percentageOption, matchedTargetingRule, matchedPercentageOption: percentageOption };
    }

    throw new Error("Sum of percentage option percentages is less than 100.");
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
          newLineBeforeThen = true;
          break;

        case "SegmentCondition":
          result = this.evaluateSegmentCondition(condition, context);
          newLineBeforeThen = !isEvaluationError(result) || result !== missingUserObjectError || conditions.length > 1;
          break;

        default:
          throw new Error(); // execution should never get here
      }

      const success = result === true;

      if (logBuilder) {
        if (!targetingRule || conditions.length > 1) {
          logBuilder.appendConditionConsequence(success);
        }

        logBuilder.decreaseIndent();
      }

      if (!success) {
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
    const userAttributeValue = getUserAttribute(context.user, userAttributeName);
    if (userAttributeValue == null || userAttributeValue === "") { // besides null and undefined, empty string is considered missing value as well
      this.logger.userObjectAttributeIsMissingCondition(formatUserCondition(condition), context.key, userAttributeName);
      return missingUserAttributeError(userAttributeName);
    }

    let text: string, versionOrError: ISemVer | string, numberOrError: number | string, arrayOrError: ReadonlyArray<string> | string;
    switch (condition.comparator) {
      case UserComparator.TextEquals:
      case UserComparator.TextNotEquals:
        text = getUserAttributeValueAsText(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return this.evaluateTextEquals(text, condition.comparisonValue, condition.comparator === UserComparator.TextNotEquals);

      case UserComparator.SensitiveTextEquals:
      case UserComparator.SensitiveTextNotEquals:
        text = getUserAttributeValueAsText(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return this.evaluateSensitiveTextEquals(text, condition.comparisonValue,
          context.setting.configJsonSalt, contextSalt, condition.comparator === UserComparator.SensitiveTextNotEquals);

      case UserComparator.TextIsOneOf:
      case UserComparator.TextIsNotOneOf:
        text = getUserAttributeValueAsText(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return this.evaluateTextIsOneOf(text, condition.comparisonValue, condition.comparator === UserComparator.TextIsNotOneOf);

      case UserComparator.SensitiveTextIsOneOf:
      case UserComparator.SensitiveTextIsNotOneOf:
        text = getUserAttributeValueAsText(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return this.evaluateSensitiveTextIsOneOf(text, condition.comparisonValue,
          context.setting.configJsonSalt, contextSalt, condition.comparator === UserComparator.SensitiveTextIsNotOneOf);

      case UserComparator.TextStartsWithAnyOf:
      case UserComparator.TextNotStartsWithAnyOf:
        text = getUserAttributeValueAsText(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return this.evaluateTextSliceEqualsAnyOf(text, condition.comparisonValue, true, condition.comparator === UserComparator.TextNotStartsWithAnyOf);

      case UserComparator.SensitiveTextStartsWithAnyOf:
      case UserComparator.SensitiveTextNotStartsWithAnyOf:
        text = getUserAttributeValueAsText(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return this.evaluateSensitiveTextSliceEqualsAnyOf(text, condition.comparisonValue,
          context.setting.configJsonSalt, contextSalt, true, condition.comparator === UserComparator.SensitiveTextNotStartsWithAnyOf);

      case UserComparator.TextEndsWithAnyOf:
      case UserComparator.TextNotEndsWithAnyOf:
        text = getUserAttributeValueAsText(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return this.evaluateTextSliceEqualsAnyOf(text, condition.comparisonValue, false, condition.comparator === UserComparator.TextNotEndsWithAnyOf);

      case UserComparator.SensitiveTextEndsWithAnyOf:
      case UserComparator.SensitiveTextNotEndsWithAnyOf:
        text = getUserAttributeValueAsText(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return this.evaluateSensitiveTextSliceEqualsAnyOf(text, condition.comparisonValue,
          context.setting.configJsonSalt, contextSalt, false, condition.comparator === UserComparator.SensitiveTextNotEndsWithAnyOf);

      case UserComparator.TextContainsAnyOf:
      case UserComparator.TextNotContainsAnyOf:
        text = getUserAttributeValueAsText(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return this.evaluateTextContainsAnyOf(text, condition.comparisonValue, condition.comparator === UserComparator.TextNotContainsAnyOf);

      case UserComparator.SemVerIsOneOf:
      case UserComparator.SemVerIsNotOneOf:
        versionOrError = getUserAttributeValueAsSemVer(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return typeof versionOrError !== "string"
          ? this.evaluateSemVerIsOneOf(versionOrError, condition.comparisonValue, condition.comparator === UserComparator.SemVerIsNotOneOf)
          : versionOrError;

      case UserComparator.SemVerLess:
      case UserComparator.SemVerLessOrEquals:
      case UserComparator.SemVerGreater:
      case UserComparator.SemVerGreaterOrEquals:
        versionOrError = getUserAttributeValueAsSemVer(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return typeof versionOrError !== "string"
          ? this.evaluateSemVerRelation(versionOrError, condition.comparator, condition.comparisonValue)
          : versionOrError;

      case UserComparator.NumberEquals:
      case UserComparator.NumberNotEquals:
      case UserComparator.NumberLess:
      case UserComparator.NumberLessOrEquals:
      case UserComparator.NumberGreater:
      case UserComparator.NumberGreaterOrEquals:
        numberOrError = getUserAttributeValueAsNumber(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return typeof numberOrError !== "string"
          ? this.evaluateNumberRelation(numberOrError, condition.comparator, condition.comparisonValue)
          : numberOrError;

      case UserComparator.DateTimeBefore:
      case UserComparator.DateTimeAfter:
        numberOrError = getUserAttributeValueAsUnixTimeSeconds(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return typeof numberOrError !== "string"
          ? this.evaluateDateTimeRelation(numberOrError, condition.comparisonValue, condition.comparator === UserComparator.DateTimeBefore)
          : numberOrError;

      case UserComparator.ArrayContainsAnyOf:
      case UserComparator.ArrayNotContainsAnyOf:
        arrayOrError = getUserAttributeValueAsStringArray(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return typeof arrayOrError !== "string"
          ? this.evaluateArrayContainsAnyOf(arrayOrError, condition.comparisonValue, condition.comparator === UserComparator.ArrayNotContainsAnyOf)
          : arrayOrError;

      case UserComparator.SensitiveArrayContainsAnyOf:
      case UserComparator.SensitiveArrayNotContainsAnyOf:
        arrayOrError = getUserAttributeValueAsStringArray(userAttributeName, userAttributeValue, condition, context.key, this.logger);
        return typeof arrayOrError !== "string"
          ? this.evaluateSensitiveArrayContainsAnyOf(arrayOrError, condition.comparisonValue,
            context.setting.configJsonSalt, contextSalt, condition.comparator === UserComparator.SensitiveArrayNotContainsAnyOf)
          : arrayOrError;

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

  private evaluateTextIsOneOf(text: string, comparisonValues: ReadonlyArray<string>, negate: boolean): boolean {
    // NOTE: Array.prototype.indexOf uses strict equality.
    const result = comparisonValues.indexOf(text) >= 0;
    return result !== negate;
  }

  private evaluateSensitiveTextIsOneOf(text: string, comparisonValues: ReadonlyArray<string>, configJsonSalt: string, contextSalt: string, negate: boolean): boolean {
    const hash = hashComparisonValue(text, configJsonSalt, contextSalt);
    // NOTE: Array.prototype.indexOf uses strict equality.
    const result = comparisonValues.indexOf(hash) >= 0;
    return result !== negate;
  }

  private evaluateTextSliceEqualsAnyOf(text: string, comparisonValues: ReadonlyArray<string>, startsWith: boolean, negate: boolean): boolean {
    for (let i = 0; i < comparisonValues.length; i++) {
      const item = comparisonValues[i];

      if (text.length < item.length) {
        continue;
      }

      // NOTE: String.prototype.startsWith/endsWith were introduced after ES5. We'd rather work around them instead of polyfilling them.
      const result = (startsWith ? text.lastIndexOf(item, 0) : text.indexOf(item, text.length - item.length)) >= 0;
      if (result) {
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

      const result = hash === item.slice(index + 1);
      if (result) {
        return !negate;
      }
    }

    return negate;
  }

  private evaluateTextContainsAnyOf(text: string, comparisonValues: ReadonlyArray<string>, negate: boolean): boolean {
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
      const result = comparisonValues.indexOf(array[i]) >= 0;
      if (result) {
        return !negate;
      }
    }

    return negate;
  }

  private evaluateSensitiveArrayContainsAnyOf(array: ReadonlyArray<string>, comparisonValues: ReadonlyArray<string>, configJsonSalt: string, contextSalt: string, negate: boolean): boolean {
    for (let i = 0; i < array.length; i++) {
      const hash = hashComparisonValue(array[i], configJsonSalt, contextSalt);
      // NOTE: Array.prototype.indexOf uses strict equality.
      const result = comparisonValues.indexOf(hash) >= 0;
      if (result) {
        return !negate;
      }
    }

    return negate;
  }

  private evaluatePrerequisiteFlagCondition(condition: PrerequisiteFlagCondition, context: EvaluateContext): boolean {
    const logBuilder = context.logBuilder;
    logBuilder?.appendPrerequisiteFlagCondition(condition, context.settings);

    const prerequisiteFlagKey = condition.prerequisiteFlagKey;
    const prerequisiteFlag = context.settings[prerequisiteFlagKey];

    context.visitedFlags.push(context.key);

    if (context.visitedFlags.indexOf(prerequisiteFlagKey) >= 0) {
      context.visitedFlags.push(prerequisiteFlagKey);
      const dependencyCycle = formatStringList(context.visitedFlags, void 0, void 0, " -> ");
      throw new Error(`Circular dependency detected between the following depending flags: ${dependencyCycle}.`);
    }

    const prerequisiteFlagContext = EvaluateContext.forPrerequisiteFlag(prerequisiteFlagKey, prerequisiteFlag, context);

    logBuilder?.newLine("(")
      .increaseIndent()
      .newLine(`Evaluating prerequisite flag '${prerequisiteFlagKey}':`);

    const prerequisiteFlagEvaluateResult = this.evaluateSetting(prerequisiteFlagContext);

    context.visitedFlags.pop();

    const prerequisiteFlagValue = prerequisiteFlagEvaluateResult.selectedValue.value;
    if (typeof prerequisiteFlagValue !== typeof condition.comparisonValue) {
      if (isAllowedValue(prerequisiteFlagValue)) {
        throw new Error(`Type mismatch between comparison value '${condition.comparisonValue}' and prerequisite flag '${prerequisiteFlagKey}'.`);
      }
      else {
        handleInvalidReturnValue(prerequisiteFlagValue);
      }
    }

    let result: boolean;

    switch (condition.comparator) {
      case PrerequisiteFlagComparator.Equals:
        result = prerequisiteFlagValue === condition.comparisonValue;
        break;
      case PrerequisiteFlagComparator.NotEquals:
        result = prerequisiteFlagValue !== condition.comparisonValue;
        break;
      default:
        throw new Error(); // execution should never get here (unless there is an error in the config JSON)
    }

    logBuilder?.newLine(`Prerequisite flag evaluation result: '${valueToString(prerequisiteFlagValue)}'.`)
      .newLine("Condition (")
      .appendPrerequisiteFlagCondition(condition, context.settings)
      .append(") evaluates to ").appendConditionResult(result).append(".")
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
        ? logBuilder.append(" evaluates to ").appendConditionResult(result)
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

function hashComparisonValue(value: string, configJsonSalt: string, contextSalt: string) {
  return hashComparisonValueSlice(utf8Encode(value), configJsonSalt, contextSalt);
}

function hashComparisonValueSlice(sliceUtf8: string, configJsonSalt: string, contextSalt: string) {
  return sha256(sliceUtf8 + utf8Encode(configJsonSalt) + utf8Encode(contextSalt));
}

function userAttributeValueToString(userAttributeValue: UserAttributeValue) {
  return typeof userAttributeValue === "string" ? userAttributeValue :
    userAttributeValue instanceof Date ? (userAttributeValue.getTime() / 1000) + "" :
    isStringArray(userAttributeValue) ? JSON.stringify(userAttributeValue) :
    userAttributeValue + "";
}

function getUserAttributeValueAsText(attributeName: string, attributeValue: UserAttributeValue, condition: UserConditionUnion, key: string, logger: LoggerWrapper): string {
  if (typeof attributeValue === "string") {
    return attributeValue;
  }

  attributeValue = userAttributeValueToString(attributeValue);
  logger.userObjectAttributeIsAutoConverted(formatUserCondition(condition), key, attributeName, attributeValue);
  return attributeValue;
}

function getUserAttributeValueAsSemVer(attributeName: string, attributeValue: UserAttributeValue, condition: UserConditionUnion, key: string, logger: LoggerWrapper): ISemVer | string {
  let version: ISemVer | null;
  if (typeof attributeValue === "string" && (version = parseSemVer(attributeValue.trim()))) {
    return version;
  }
  return handleInvalidUserAttribute(logger, condition, key, attributeName, `'${attributeValue}' is not a valid semantic version`);
}

function getUserAttributeValueAsNumber(attributeName: string, attributeValue: UserAttributeValue, condition: UserConditionUnion, key: string, logger: LoggerWrapper): number | string {
  if (typeof attributeValue === "number") {
    return attributeValue;
  }
  let number: number;
  if (typeof attributeValue === "string"
    && (!isNaN(number = parseFloatStrict(attributeValue.replace(",", "."))) || attributeValue.trim() === "NaN")) {
    return number;
  }
  return handleInvalidUserAttribute(logger, condition, key, attributeName, `'${attributeValue}' is not a valid decimal number`);
}

function getUserAttributeValueAsUnixTimeSeconds(attributeName: string, attributeValue: UserAttributeValue, condition: UserConditionUnion, key: string, logger: LoggerWrapper): number | string {
  if (attributeValue instanceof Date) {
    return attributeValue.getTime() / 1000;
  }
  if (typeof attributeValue === "number") {
    return attributeValue;
  }
  let number: number;
  if (typeof attributeValue === "string"
    && (!isNaN(number = parseFloatStrict(attributeValue.replace(",", "."))) || attributeValue.trim() === "NaN")) {
    return number;
  }
  return handleInvalidUserAttribute(logger, condition, key, attributeName, `'${attributeValue}' is not a valid Unix timestamp (number of seconds elapsed since Unix epoch)`);
}

function getUserAttributeValueAsStringArray(attributeName: string, attributeValue: UserAttributeValue, condition: UserConditionUnion, key: string, logger: LoggerWrapper): ReadonlyArray<string> | string {
  let stringArray = attributeValue;
  if (typeof stringArray === "string") {
    try { stringArray = JSON.parse(stringArray); }
    catch (err) { /* intentional no-op */ }
  }
  if (isStringArray(stringArray)) {
    return stringArray;
  }
  return handleInvalidUserAttribute(logger, condition, key, attributeName, `'${attributeValue}' is not a valid string array`);
}

function handleInvalidUserAttribute(logger: LoggerWrapper, condition: UserConditionUnion, key: string, attributeName: string, reason: string) {
  logger.userObjectAttributeIsInvalid(formatUserCondition(condition), key, reason, attributeName);
  return invalidUserAttributeError(attributeName, reason);
}

/* Evaluation details */

export type SettingTypeOf<T> =
  T extends boolean ? boolean :
  T extends number ? number :
  T extends string ? string :
  T extends null ? boolean | number | string | null :
  T extends undefined ? boolean | number | string | undefined :
  any;

/** The evaluated value and additional information about the evaluation of a feature flag or setting. */
export interface IEvaluationDetails<TValue extends SettingValue = SettingValue> {
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

  /** The targeting rule (if any) that matched during the evaluation and was used to return the evaluated value. */
  matchedTargetingRule?: ITargetingRule;

  /** The percentage option (if any) that was used to select the evaluated value. */
  matchedPercentageOption?: IPercentageOption;
}

/* Helper functions */

function evaluationDetailsFromEvaluateResult<T extends SettingValue>(key: string, evaluateResult: IEvaluateResult, fetchTime?: Date, user?: User): IEvaluationDetails<SettingTypeOf<T>> {
  return {
    key,
    value: evaluateResult.selectedValue.value as SettingTypeOf<T>,
    variationId: evaluateResult.selectedValue.variationId,
    fetchTime,
    user,
    isDefaultValue: false,
    matchedTargetingRule: evaluateResult.matchedTargetingRule,
    matchedPercentageOption: evaluateResult.matchedPercentageOption,
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

export function handleInvalidReturnValue(value: unknown): never {
  throw new TypeError(
    value === null ? "Setting value is null." :
    value === void 0 ? "Setting value is undefined." :
    `Setting value '${value}' is of an unsupported type (${typeof value}).`);
}

export function getTimestampAsDate(projectConfig: ProjectConfig | null): Date | undefined {
  return projectConfig ? new Date(projectConfig.timestamp) : void 0;
}
