import type { LoggerWrapper } from "./ConfigCatLogger";
import type { IPercentageOption, ITargetingRule, ProjectConfig, Setting, SettingValue, VariationIdValue } from "./ProjectConfig";
import { Comparator, RolloutPercentageItem, RolloutRule } from "./ProjectConfig";
import * as semver from "./Semver";
import { sha1 } from "./Sha1";
import { errorToString, getTimestampAsDate } from "./Utils";

export type SettingTypeOf<T> =
  T extends boolean ? boolean :
  T extends number ? number :
  T extends string ? string :
  T extends null ? boolean | number | string | null :
  T extends undefined ? boolean | number | string | undefined :
  any;

export interface IRolloutEvaluator {
  evaluate(setting: Setting, key: string, defaultValue: SettingValue, user: User | undefined, remoteConfig: ProjectConfig | null): IEvaluationDetails;
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

  evaluate(setting: Setting, key: string, defaultValue: SettingValue, user: User | undefined, remoteConfig: ProjectConfig | null): IEvaluationDetails {
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

    let result: IEvaluateResult<object | undefined> | null;

    try {
      if (user) {
        // evaluate comparison-based rules

        result = this.evaluateRules(setting.targetingRules, user, eLog);
        if (result !== null) {
          eLog.returnValue = result.value;

          return evaluationDetailsFromEvaluateResult(key, result, getTimestampAsDate(remoteConfig), user);
        }

        // evaluate percentage-based rules

        result = this.evaluatePercentageRules(setting.percentageOptions, key, user);

        if (setting.percentageOptions && setting.percentageOptions.length > 0) {
          eLog.opAppendLine("Evaluating % options => " + (!result ? "user not targeted" : "user targeted"));
        }

        if (result !== null) {
          eLog.returnValue = result.value;

          return evaluationDetailsFromEvaluateResult(key, result, getTimestampAsDate(remoteConfig), user);
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

      return evaluationDetailsFromEvaluateResult(key, result, getTimestampAsDate(remoteConfig), user);
    }
    finally {
      this.logger.settingEvaluated(eLog);
    }
  }

  private evaluateRules(rolloutRules: ReadonlyArray<RolloutRule>, user: User, eLog: EvaluateLogger): IEvaluateResult<RolloutRule> | null {

    this.logger.debug("RolloutEvaluator.EvaluateRules() called.");

    if (rolloutRules && rolloutRules.length > 0) {

      for (let i = 0; i < rolloutRules.length; i++) {

        const rule: RolloutRule = rolloutRules[i];

        const comparisonAttribute = this.getUserAttribute(user, rule.comparisonAttribute);

        const comparator: number = rule.comparator;

        const comparisonValue: string = rule.comparisonValue;

        let log: string = "Evaluating rule: '" + comparisonAttribute + "' " + this.ruleToString(comparator) + " '" + comparisonValue + "' => ";

        if (!comparisonAttribute) {
          log += "NO MATCH (Attribute is not defined on the user object)";
          eLog.opAppendLine(log);
          continue;
        }

        const result: IEvaluateResult<RolloutRule> = {
          value: rule.value,
          variationId: rule.variationId,
          matchedRule: rule
        };

        switch (comparator) {
          case Comparator.In:

            const cvs: string[] = comparisonValue.split(",");

            for (let ci = 0; ci < cvs.length; ci++) {

              if (cvs[ci].trim() === comparisonAttribute) {
                log += "MATCH";
                eLog.opAppendLine(log);

                return result;
              }
            }

            log += "no match";

            break;

          case Comparator.NotIn:

            if (!comparisonValue.split(",").some(e => {
              if (e.trim() === comparisonAttribute) {
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

          case Comparator.Contains:

            if (comparisonAttribute.indexOf(comparisonValue) !== -1) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case Comparator.NotContains:

            if (comparisonAttribute.indexOf(comparisonValue) === -1) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case Comparator.SemVerIn:
          case Comparator.SemVerNotIn:
          case Comparator.SemVerLessThan:
          case Comparator.SemVerLessThanEqual:
          case Comparator.SemVerGreaterThan:
          case Comparator.SemVerGreaterThanEqual:

            if (this.evaluateSemver(comparisonAttribute, comparisonValue, comparator)) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case Comparator.NumberEqual:
          case Comparator.NumberNotEqual:
          case Comparator.NumberLessThan:
          case Comparator.NumberLessThanEqual:
          case Comparator.NumberGreaterThan:
          case Comparator.NumberGreaterThanEqual:

            if (this.evaluateNumber(comparisonAttribute, comparisonValue, comparator)) {
              log += "MATCH";
              eLog.opAppendLine(log);

              return result;
            }

            log += "no match";

            break;
          case Comparator.SensitiveOneOf: {
            const values: string[] = comparisonValue.split(",");
            const hashedComparisonAttribute: string = sha1(comparisonAttribute);

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

          case Comparator.SensitiveNotOneOf: {
            const hashedComparisonAttribute: string = sha1(comparisonAttribute);

            if (!comparisonValue.split(",").some(e => {
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

  private evaluatePercentageRules(rolloutPercentageItems: ReadonlyArray<RolloutPercentageItem>, key: string, user: User): IEvaluateResult<RolloutPercentageItem> | null {
    this.logger.debug("RolloutEvaluator.EvaluateVariations() called.");
    if (rolloutPercentageItems && rolloutPercentageItems.length > 0) {

      const hashCandidate: string = key + ((user.identifier === null || user.identifier === void 0) ? "" : user.identifier);
      const hashValue: any = sha1(hashCandidate).substring(0, 7);
      const hashScale: number = parseInt(hashValue, 16) % 100;
      let bucket = 0;

      for (let i = 0; i < rolloutPercentageItems.length; i++) {
        const percentageRule: RolloutPercentageItem = rolloutPercentageItems[i];
        bucket += +percentageRule.percentage;

        if (hashScale < bucket) {
          return {
            value: percentageRule.value,
            variationId: percentageRule.variationId,
            matchedRule: percentageRule
          };
        }
      }
    }

    return null;
  }

  private evaluateNumber(v1: string, v2: string, comparator: Comparator): boolean {
    this.logger.debug("RolloutEvaluator.EvaluateNumber() called.");

    let n1: number, n2: number;

    if (v1 && !Number.isNaN(Number.parseFloat(v1.replace(",", ".")))) {
      n1 = Number.parseFloat(v1.replace(",", "."));
    }
    else {
      return false;
    }

    if (v2 && !Number.isNaN(Number.parseFloat(v2.replace(",", ".")))) {
      n2 = Number.parseFloat(v2.replace(",", "."));
    }
    else {
      return false;
    }

    switch (comparator) {
      case Comparator.NumberEqual:
        return n1 === n2;
      case Comparator.NumberNotEqual:
        return n1 !== n2;
      case Comparator.NumberLessThan:
        return n1 < n2;
      case Comparator.NumberLessThanEqual:
        return n1 <= n2;
      case Comparator.NumberGreaterThan:
        return n1 > n2;
      case Comparator.NumberGreaterThanEqual:
        return n1 >= n2;
      default:
        break;
    }

    return false;
  }

  private evaluateSemver(v1: string, v2: string, comparator: Comparator): boolean {
    this.logger.debug("RolloutEvaluator.EvaluateSemver() called.");
    if (semver.valid(v1) == null || v2 === void 0) {
      return false;
    }

    v2 = v2.trim();

    switch (comparator) {
      case Comparator.SemVerIn:
        const sv: string[] = v2.split(",");
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

      case Comparator.SemVerNotIn:
        return !v2.split(",").some(e => {

          if (!e || e.trim() === "") {
            return false;
          }

          e = semver.valid(e.trim());

          if (e == null) {
            return false;
          }

          return semver.eq(v1, e);
        });

      case Comparator.SemVerLessThan:

        if (semver.valid(v2) == null) {
          return false;
        }

        return semver.lt(v1, v2);
      case Comparator.SemVerLessThanEqual:

        if (semver.valid(v2) == null) {
          return false;
        }

        return semver.lte(v1, v2);
      case Comparator.SemVerGreaterThan:

        if (semver.valid(v2) == null) {
          return false;
        }

        return semver.gt(v1, v2);
      case Comparator.SemVerGreaterThanEqual:

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

  private ruleToString(rule: Comparator): string {
    switch (rule) {
      case Comparator.In:
        return "IS ONE OF";
      case Comparator.NotIn:
        return "IS NOT ONE OF";
      case Comparator.Contains:
        return "CONTAINS";
      case Comparator.NotContains:
        return "DOES NOT CONTAIN";
      case Comparator.SemVerIn:
        return "IS ONE OF (SemVer)";
      case Comparator.SemVerNotIn:
        return "IS NOT ONE OF (SemVer)";
      case Comparator.SemVerLessThan:
        return "< (SemVer)";
      case Comparator.SemVerLessThanEqual:
        return "<= (SemVer)";
      case Comparator.SemVerGreaterThan:
        return "> (SemVer)";
      case Comparator.SemVerGreaterThanEqual:
        return ">= (SemVer)";
      case Comparator.NumberEqual:
        return "= (Number)";
      case Comparator.NumberNotEqual:
        return "!= (Number)";
      case Comparator.NumberLessThan:
        return "< (Number)";
      case Comparator.NumberLessThanEqual:
        return "<= (Number)";
      case Comparator.NumberGreaterThan:
        return "> (Number)";
      case Comparator.NumberGreaterThanEqual:
        return ">= (Number)";
      case Comparator.SensitiveOneOf:
        return "IS ONE OF (Sensitive)";
      case Comparator.SensitiveNotOneOf:
        return "IS NOT ONE OF (Sensitive)";
      default:
        return rule + "";
    }
  }
}

interface IEvaluateResult<TRule> {
  value: SettingValue;
  variationId?: string;
  matchedRule?: TRule;
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

function evaluationDetailsFromEvaluateResult(key: string, evaluateResult: IEvaluateResult<object | undefined>, fetchTime?: Date, user?: User): IEvaluationDetails {
  return {
    key,
    value: evaluateResult.value,
    variationId: evaluateResult.variationId,
    fetchTime,
    user,
    isDefaultValue: false,
    matchedEvaluationRule: evaluateResult.matchedRule instanceof RolloutRule ? evaluateResult.matchedRule : void 0,
    matchedEvaluationPercentageRule: evaluateResult.matchedRule instanceof RolloutPercentageItem ? evaluateResult.matchedRule : void 0,
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

  const evaluationDetails = evaluator.evaluate(setting, key, defaultValue, user, remoteConfig);

  if (defaultValue !== null && defaultValue !== void 0 && typeof defaultValue !== typeof evaluationDetails.value) {
    throw new TypeError(`The type of a setting must match the type of the given default value.\nThe setting's type was ${typeof defaultValue}, the given default value's type was ${typeof evaluationDetails.value}.\nPlease pass a corresponding default value type.`);
  }

  return evaluationDetails as IEvaluationDetails<SettingTypeOf<T>>;
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
      evaluationDetails = evaluator.evaluate(setting, key, null, user, remoteConfig);
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

function keysToString(settings: { [name: string]: Setting }) {
  return Object.keys(settings).map(key => `'${key}'`).join(", ");
}
