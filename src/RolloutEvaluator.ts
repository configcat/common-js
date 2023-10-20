import { connected } from "process";
import type { LoggerWrapper } from "./ConfigCatLogger";
import { sha1, sha256 } from "./Hash";
import type { IPercentageOption, ITargetingRule, PercentageOption, ProjectConfig, Setting, SettingValue, SettingValueContainer, TargetingRule, UserConditionUnion, VariationIdValue } from "./ProjectConfig";
import { UserComparator } from "./ProjectConfig";
import * as semver from "./Semver";
import { errorToString } from "./Utils";

export type SettingTypeOf<T> =
  T extends boolean ? boolean :
  T extends number ? number :
  T extends string ? string :
  T extends null ? boolean | number | string | null :
  T extends undefined ? boolean | number | string | undefined :
  any;

export interface IRolloutEvaluator {
  evaluate(setting: Setting, key: string, defaultValue: SettingValue, user: User | undefined, remoteConfig: ProjectConfig | null): IEvaluateResult;
}

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

/** User Object. Contains user attributes which are used for evaluating targeting rules and percentage options. */
export class User {

  constructor(identifier: string, email?: string, country?: string, custom?: { [key: string]: string }) {
    this.identifier = identifier;
    this.email = email;
    this.country = country;
    this.custom = custom || {};
  }

  /** The unique identifier of the user or session (e.g. email address, primary key, session ID, etc.) */
  identifier: string;

  /** Email address of the user. */
  email?: string;

  /** Country of the user. */
  country?: string;

  /** Custom attributes of the user for advanced targeting rule definitions (e.g. user role, subscription type, etc.) */
  custom?: { [key: string]: string } = {};
}

export class RolloutEvaluator implements IRolloutEvaluator {

  private readonly logger: LoggerWrapper;

  constructor(logger: LoggerWrapper) {

    this.logger = logger;
  }

  evaluate(setting: Setting, key: string, defaultValue: SettingValue, user: User | undefined, remoteConfig: ProjectConfig | null): IEvaluateResult {
    this.logger.debug("RolloutEvaluator.Evaluate() called.");

    // A negative setting type indicates a flag override (see also Setting.fromValue)
    if (setting.type < 0 && !isAllowedValue(setting.value)) {
      throw new TypeError(
        setting.value === null ? "Setting value is null." :
        setting.value === void 0 ? "Setting value is undefined." :
        `Setting value '${setting.value}' is of an unsupported type (${typeof setting.value}).`);
    }

    const eLog: EvaluateLogger = new EvaluateLogger();

    eLog.user = user;
    eLog.keyName = key;
    eLog.returnValue = defaultValue;

    let result: IEvaluateResult | null;

    try {
      if (user) {
        // evaluate comparison-based rules

        result = this.evaluateRules(setting.targetingRules, user, key, setting.configJsonSalt ?? "", eLog);
        if (result !== null) {
          eLog.returnValue = result.value;

          return result;
        }

        // evaluate percentage-based rules

        result = this.evaluatePercentageRules(setting.percentageOptions, key, user);

        if (setting.percentageOptions && setting.percentageOptions.length > 0) {
          eLog.opAppendLine("Evaluating % options => " + (!result ? "user not targeted" : "user targeted"));
        }

        if (result !== null) {
          eLog.returnValue = result.value;

          return result;
        }
      }
      else {
        if ((setting.targetingRules && setting.targetingRules.length > 0)
            || (setting.percentageOptions && setting.percentageOptions.length > 0)) {
          this.logger.targetingIsNotPossible(key);
        }
      }

      // regular evaluate
      result = {
        value: setting.value,
        variationId: setting.variationId
      };
      eLog.returnValue = result.value;

      return result;
    }
    finally {
      this.logger.settingEvaluated(eLog);
    }
  }

  private evaluateRules(rolloutRules: ReadonlyArray<TargetingRule>, user: User, settingKey: string, configJsonSalt: string, eLog: EvaluateLogger): IEvaluateResult | null {

    this.logger.debug("RolloutEvaluator.EvaluateRules() called.");

    if (rolloutRules.length > 0) {

      for (let i = 0; i < rolloutRules.length; i++) {

        const targetingRule = rolloutRules[i];
        const rule = targetingRule.conditions[0] as UserConditionUnion;

        const comparisonAttribute = this.getUserAttribute(user, rule.comparisonAttribute);

        let log: string = "Evaluating rule: '" + comparisonAttribute + "' " + this.ruleToString(rule.comparator) + " '" + rule.comparisonValue + "' => ";

        if (!comparisonAttribute) {
          log += "NO MATCH (Attribute is not defined on the user object)";
          eLog.opAppendLine(log);
          continue;
        }

        const result: IEvaluateResult = {
          value: (targetingRule.then as SettingValueContainer).value,
          variationId: (targetingRule.then as SettingValueContainer).variationId,
          matchedTargetingRule: targetingRule
        };

        switch (rule.comparator) {
          case UserComparator.IsOneOf:

            const cvs = rule.comparisonValue;

            for (let ci = 0; ci < cvs.length; ci++) {

              if (cvs[ci] === comparisonAttribute) {
                log += "MATCH";
                eLog.opAppendLine(log);

                return result;
              }
            }

            log += "no match";

            break;

          case UserComparator.IsNotOneOf:

            if (!rule.comparisonValue.some(e => {
              if (e === comparisonAttribute) {
                return true;
              }

              return false;
            })) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case UserComparator.ContainsAnyOf:

            if (comparisonAttribute.indexOf(rule.comparisonValue[0]) !== -1) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case UserComparator.NotContainsAnyOf:

            if (comparisonAttribute.indexOf(rule.comparisonValue[0]) === -1) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case UserComparator.SemVerIsOneOf:
          case UserComparator.SemVerIsNotOneOf:
          case UserComparator.SemVerLess:
          case UserComparator.SemVerLessOrEquals:
          case UserComparator.SemVerGreater:
          case UserComparator.SemVerGreaterOrEquals:

            if (this.evaluateSemver(comparisonAttribute, rule.comparisonValue, rule.comparator)) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case UserComparator.NumberEquals:
          case UserComparator.NumberNotEquals:
          case UserComparator.NumberLess:
          case UserComparator.NumberLessOrEquals:
          case UserComparator.NumberGreater:
          case UserComparator.NumberGreaterOrEquals:

            if (this.evaluateNumber(comparisonAttribute, rule.comparisonValue, rule.comparator)) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;
          case UserComparator.SensitiveIsOneOf: {
            const values = rule.comparisonValue;
            const hashedComparisonAttribute: string = hashComparisonValue(comparisonAttribute, configJsonSalt, settingKey);

            for (let ci = 0; ci < values.length; ci++) {

              if (values[ci].trim() === hashedComparisonAttribute) {
                log += "MATCH";
                eLog.opAppendLine(log);

                return result;
              }
            }

            log += "no match";

            break;
          }

          case UserComparator.SensitiveIsNotOneOf: {
            const hashedComparisonAttribute: string = hashComparisonValue(comparisonAttribute, configJsonSalt, settingKey);

            if (!rule.comparisonValue.some(e => {
              if (e.trim() === hashedComparisonAttribute) {
                return true;
              }

              return false;
            })) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;
          }

          default:
            break;
        }

        eLog.opAppendLine(log);
      }
    }

    return null;
  }

  private evaluatePercentageRules(rolloutPercentageItems: ReadonlyArray<PercentageOption>, key: string, user: User): IEvaluateResult | null {
    this.logger.debug("RolloutEvaluator.EvaluateVariations() called.");
    if (rolloutPercentageItems && rolloutPercentageItems.length > 0) {

      const hashCandidate: string = key + ((user.identifier === null || user.identifier === void 0) ? "" : user.identifier);
      const hashValue: any = sha1(hashCandidate).substring(0, 7);
      const hashScale: number = parseInt(hashValue, 16) % 100;
      let bucket = 0;

      for (let i = 0; i < rolloutPercentageItems.length; i++) {
        const percentageRule: PercentageOption = rolloutPercentageItems[i];
        bucket += +percentageRule.percentage;

        if (hashScale < bucket) {
          return {
            value: percentageRule.value,
            variationId: percentageRule.variationId,
            matchedPercentageOption: percentageRule
          };
        }
      }
    }

    return null;
  }

  private evaluateNumber(v1: string, n2: number, comparator: UserComparator): boolean {
    this.logger.debug("RolloutEvaluator.EvaluateNumber() called.");

    let n1: number;

    if (v1 && !Number.isNaN(Number.parseFloat(v1.replace(",", ".")))) {
      n1 = Number.parseFloat(v1.replace(",", "."));
    }
    else {
      return false;
    }

    switch (comparator) {
      case UserComparator.NumberEquals:
        return n1 === n2;
      case UserComparator.NumberNotEquals:
        return n1 !== n2;
      case UserComparator.NumberLess:
        return n1 < n2;
      case UserComparator.NumberLessOrEquals:
        return n1 <= n2;
      case UserComparator.NumberGreater:
        return n1 > n2;
      case UserComparator.NumberGreaterOrEquals:
        return n1 >= n2;
      default:
        break;
    }

    return false;
  }

  private evaluateSemver(v1: string, v2: string | ReadonlyArray<string>, comparator: UserComparator): boolean {
    this.logger.debug("RolloutEvaluator.EvaluateSemver() called.");
    if (semver.valid(v1) == null || v2 === void 0) {
      return false;
    }

    switch (comparator) {
      case UserComparator.SemVerIsOneOf:
        const sv = v2 as ReadonlyArray<string>;
        let found = false;
        for (let ci = 0; ci < sv.length; ci++) {

          if (!sv[ci] || sv[ci].trim() === "") {
            continue;
          }

          if (semver.valid(sv[ci].trim()) == null) {
            return false;
          }

          if (!found) {
            found = semver.looseeq(v1, sv[ci].trim());
          }
        }

        return found;

      case UserComparator.SemVerIsNotOneOf:
        return !(v2 as ReadonlyArray<string>).some(e => {

          if (!e || e.trim() === "") {
            return false;
          }

          e = semver.valid(e.trim());

          if (e == null) {
            return false;
          }

          return semver.eq(v1, e);
        });

      case UserComparator.SemVerLess:
        v2 = (v2 as string).trim();
        if (semver.valid(v2) == null) {
          return false;
        }

        return semver.lt(v1, v2);
      case UserComparator.SemVerLessOrEquals:
        v2 = (v2 as string).trim();
        if (semver.valid(v2) == null) {
          return false;
        }

        return semver.lte(v1, v2);
      case UserComparator.SemVerGreater:
        v2 = (v2 as string).trim();
        if (semver.valid(v2) == null) {
          return false;
        }

        return semver.gt(v1, v2);
      case UserComparator.SemVerGreaterOrEquals:
        v2 = (v2 as string).trim();
        if (semver.valid(v2) == null) {
          return false;
        }
        return semver.gte(v1, v2);
      default:
        break;
    }

    return false;
  }

  private getUserAttribute(user: User, attribute: string): string | undefined {
    switch (attribute) {
      case "Identifier":
        return user.identifier;
      case "Email":
        return user.email;
      case "Country":
        return user.country;
      default:
        return (user.custom || {})[attribute];
    }
  }

  private ruleToString(rule: UserComparator): string {
    switch (rule) {
      case UserComparator.IsOneOf:
        return "IS ONE OF";
      case UserComparator.IsNotOneOf:
        return "IS NOT ONE OF";
      case UserComparator.ContainsAnyOf:
        return "CONTAINS";
      case UserComparator.NotContainsAnyOf:
        return "DOES NOT CONTAIN";
      case UserComparator.SemVerIsOneOf:
        return "IS ONE OF (SemVer)";
      case UserComparator.SemVerIsNotOneOf:
        return "IS NOT ONE OF (SemVer)";
      case UserComparator.SemVerLess:
        return "< (SemVer)";
      case UserComparator.SemVerLessOrEquals:
        return "<= (SemVer)";
      case UserComparator.SemVerGreater:
        return "> (SemVer)";
      case UserComparator.SemVerGreaterOrEquals:
        return ">= (SemVer)";
      case UserComparator.NumberEquals:
        return "= (Number)";
      case UserComparator.NumberNotEquals:
        return "!= (Number)";
      case UserComparator.NumberLess:
        return "< (Number)";
      case UserComparator.NumberLessOrEquals:
        return "<= (Number)";
      case UserComparator.NumberGreater:
        return "> (Number)";
      case UserComparator.NumberGreaterOrEquals:
        return ">= (Number)";
      case UserComparator.SensitiveIsOneOf:
        return "IS ONE OF (Sensitive)";
      case UserComparator.SensitiveIsNotOneOf:
        return "IS NOT ONE OF (Sensitive)";
      default:
        return rule + "";
    }
  }
}

export interface IEvaluateResult {
  value: SettingValue;
  variationId?: string;
  matchedTargetingRule?: TargetingRule;
  matchedPercentageOption?: PercentageOption;
}

class EvaluateLogger {
  user!: User | undefined;

  keyName!: string;

  returnValue!: any;

  operations = "";

  opAppendLine(s: string): void {
    this.operations += " " + s + "\n";
  }

  toString(): string {
    return "Evaluate '" + this.keyName + "'"
            + "\n User : " + JSON.stringify(this.user)
            + "\n" + this.operations
            + " Returning value : " + this.returnValue;
  }
}

/* Helper functions */

function evaluationDetailsFromEvaluateResult<T extends SettingValue>(key: string, evaluateResult: IEvaluateResult, fetchTime?: Date, user?: User): IEvaluationDetails<SettingTypeOf<T>> {
  return {
    key,
    value: evaluateResult.value as SettingTypeOf<T>,
    variationId: evaluateResult.variationId,
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

export function evaluate<T extends SettingValue>(evaluator: IRolloutEvaluator, settings: { [name: string]: Setting } | null, key: string, defaultValue: T,
  user: User | undefined, remoteConfig: ProjectConfig | null, logger: LoggerWrapper): IEvaluationDetails<SettingTypeOf<T>> {

  let errorMessage: string;
  if (!settings) {
    errorMessage = logger.configJsonIsNotPresentSingle(key, "defaultValue", defaultValue).toString();
    return evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorMessage);
  }

  const setting = settings[key];
  if (!setting) {
    errorMessage = logger.settingEvaluationFailedDueToMissingKey(key, "defaultValue", defaultValue, keysToString(settings)).toString();
    return evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorMessage);
  }

  const evaluateResult = evaluator.evaluate(setting, key, defaultValue, user, remoteConfig);

  if (defaultValue !== null && defaultValue !== void 0 && typeof defaultValue !== typeof evaluateResult.value) {
    throw new TypeError(`The type of a setting must match the type of the given default value.\nThe setting's type was ${typeof defaultValue}, the given default value's type was ${typeof evaluateResult.value}.\nPlease pass a corresponding default value type.`);
  }

  return evaluationDetailsFromEvaluateResult<T>(key, evaluateResult, getTimestampAsDate(remoteConfig), user);
}

export function evaluateAll(evaluator: IRolloutEvaluator, settings: { [name: string]: Setting } | null,
  user: User | undefined, remoteConfig: ProjectConfig | null, logger: LoggerWrapper, defaultReturnValue: string): [IEvaluationDetails[], any[] | undefined] {

  let errors: any[] | undefined;

  if (!checkSettingsAvailable(settings, logger, defaultReturnValue)) {
    return [[], errors];
  }

  const evaluationDetailsArray: IEvaluationDetails[] = [];

  for (const [key, setting] of Object.entries(settings)) {
    let evaluationDetails: IEvaluationDetails;
    try {
      const evaluateResult = evaluator.evaluate(setting, key, null, user, remoteConfig);
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

export function checkSettingsAvailable(settings: { [name: string]: Setting } | null, logger: LoggerWrapper, defaultReturnValue: string): settings is { [name: string]: Setting } {
  if (!settings) {
    logger.configJsonIsNotPresent(defaultReturnValue);
    return false;
  }

  return true;
}

export function isAllowedValue(value: SettingValue): boolean {
  return value === null
    || value === void 0
    || typeof value === "boolean"
    || typeof value === "number"
    || typeof value === "string";
}

export function getTimestampAsDate(projectConfig: ProjectConfig | null): Date | undefined {
  return projectConfig ? new Date(projectConfig.timestamp) : void 0;
}

function keysToString(settings: { [name: string]: Setting }) {
  return Object.keys(settings).map(key => `'${key}'`).join(", ");
}

function hashComparisonValue(value: string, configJsonSalt: string, contextSalt: string) {
  return sha256(value + configJsonSalt + contextSalt);
}
