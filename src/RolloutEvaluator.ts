import { LoggerWrapper } from "./ConfigCatLogger";
import { ProjectConfig, RolloutPercentageItem, RolloutRule, Setting } from "./ProjectConfig";
import * as semver from "./Semver";
import { sha1 } from "./Sha1";
import { errorToString, getTimestampAsDate, isUndefined } from "./Utils";

export type SettingValue = boolean | number | string | null | undefined;

export type SettingTypeOf<T> =
  T extends boolean ? boolean :
  T extends number ? number :
  T extends string ? string :
  T extends null ? boolean | number | string | null :
  T extends undefined ? boolean | number | string | undefined :
  any;

export type VariationIdValue = string | null | undefined;

export type VariationIdTypeOf<T> =
  T extends string ? string :
  T extends null ? string | null :
  T extends undefined ? string | undefined :
  any;

export interface IRolloutEvaluator {
  Evaluate(setting: Setting, key: string, defaultValue: SettingValue, user: User | undefined, remoteConfig: ProjectConfig | null, defaultVariationId?: VariationIdValue): IEvaluationDetails;
}

export interface IEvaluationDetails<TValue = SettingValue> {
  /** Key of the feature or setting flag. */
  key: string;

  /** Evaluated value of the feature or setting flag. */
  value: TValue;

  /** Variation ID of the feature or setting flag (if available). */
  variationId?: VariationIdValue;

  /** Time of last successful download of config.json (if there has been a successful download already). */
  fetchTime?: Date;

  /** The User object used for the evaluation (if available). */
  user?: User

  /** Indicates whether the default value passed to IConfigCatClient.getValue or IConfigCatClient.getValueAsync is used as the result of the evaluation. */
  isDefaultValue: boolean;

  /** Error message in case evaluation failed. */
  errorMessage?: string;

  /** The exception object related to the error in case evaluation failed (if any). */
  errorException?: any

  /** The comparison-based targeting rule which was used to select the evaluated value (if any). */
  matchedEvaluationRule?: RolloutRule;

  /** The percentage-based targeting rule which was used to select the evaluated value (if any). */
  matchedEvaluationPercentageRule?: RolloutPercentageItem;
}

/** Object for variation evaluation */
export class User {

  constructor(identifier: string, email?: string, country?: string, custom?: { [key: string]: string }) {
    this.identifier = identifier;
    this.email = email;
    this.country = country;
    this.custom = custom || {};
  }

  /** Unique identifier for the User or Session. e.g. Email address, Primary key, Session Id */
  identifier: string;

  /** Optional parameter for easier targeting rule definitions */
  email?: string;

  /** Optional parameter for easier targeting rule definitions */
  country?: string;

  /** Optional dictionary for custom attributes of the User for advanced targeting rule definitions. e.g. User role, Subscription type */
  custom?: { [key: string]: string } = {};
}

export class RolloutEvaluator implements IRolloutEvaluator {

  private logger: LoggerWrapper;

  constructor(logger: LoggerWrapper) {

    this.logger = logger;
  }

  Evaluate(setting: Setting, key: string, defaultValue: SettingValue, user: User | undefined, remoteConfig: ProjectConfig | null): IEvaluationDetails {
    this.logger.debug("RolloutEvaluator.Evaluate() called.");

    const eLog: EvaluateLogger = new EvaluateLogger();

    eLog.User = user;
    eLog.KeyName = key;
    eLog.ReturnValue = defaultValue;

    let result: IEvaluateResult<object | undefined> | null;

    try {
      if (user) {
        // evaluate comparison-based rules

        result = this.EvaluateRules(setting.rolloutRules, user, eLog);
        if (result !== null) {
          eLog.ReturnValue = result.value;

          return evaluationDetailsFromEvaluateResult(key, result, getTimestampAsDate(remoteConfig), user);
        }

        // evaluate percentage-based rules

        result = this.EvaluatePercentageRules(setting.rolloutPercentageItems, key, user);

        if (setting.rolloutPercentageItems && setting.rolloutPercentageItems.length > 0) {
          eLog.OpAppendLine("Evaluating % options => " + (!result ? "user not targeted" : "user targeted"));
        }

        if (result !== null) {
          eLog.ReturnValue = result.value;

          return evaluationDetailsFromEvaluateResult(key, result, getTimestampAsDate(remoteConfig), user);
        }
      }
      else {
        if ((setting.rolloutRules && setting.rolloutRules.length > 0) ||
                    (setting.rolloutPercentageItems && setting.rolloutPercentageItems.length > 0)) {
          let s: string = "Evaluating getValue('" + key + "'). ";
          s += "UserObject missing! You should pass a UserObject to getValue(), in order to make targeting work properly. ";
          s += "Read more: https://configcat.com/docs/advanced/user-object";

          this.logger.warn(s);
        }
      }

      // regular evaluate
      result = {
        value: setting.value,
        variationId: setting.variationId
      };
      eLog.ReturnValue = result.value;

      return evaluationDetailsFromEvaluateResult(key, result, getTimestampAsDate(remoteConfig), user);
    }
    finally {
      this.logger.info(eLog.GetLog());
    }
  }

  private EvaluateRules(rolloutRules: RolloutRule[], user: User, eLog: EvaluateLogger): IEvaluateResult<RolloutRule> | null {

    this.logger.debug("RolloutEvaluator.EvaluateRules() called.");

    if (rolloutRules && rolloutRules.length > 0) {

      for (let i = 0; i < rolloutRules.length; i++) {

        const rule: RolloutRule = rolloutRules[i];

        const comparisonAttribute = this.GetUserAttribute(user, rule.comparisonAttribute);

        const comparator: number = rule.comparator;

        const comparisonValue: string = rule.comparisonValue;

        let log: string = "Evaluating rule: '" + comparisonAttribute + "' " + this.RuleToString(comparator) + " '" + comparisonValue + "' => ";

        if (!comparisonAttribute) {
          log += "NO MATCH (Attribute is not defined on the user object)";
          eLog.OpAppendLine(log);
          continue;
        }

        const result: IEvaluateResult<RolloutRule> = {
          value: rule.value,
          variationId: rule.variationId,
          matchedRule: rule
        };

        switch (comparator) {
          case 0: // is one of

            const cvs: string[] = comparisonValue.split(",");

            for (let ci = 0; ci < cvs.length; ci++) {

              if (cvs[ci].trim() === comparisonAttribute) {
                log += "MATCH";
                eLog.OpAppendLine(log);

                return result;
              }
            }

            log += "no match";

            break;

          case 1: // is not one of

            if (!comparisonValue.split(",").some(e => {
              if (e.trim() === comparisonAttribute) {
                return true;
              }

              return false;
            })) {
              log += "MATCH";
              eLog.OpAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case 2: // contains

            if (comparisonAttribute.indexOf(comparisonValue) !== -1) {
              log += "MATCH";
              eLog.OpAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case 3: // not contains

            if (comparisonAttribute.indexOf(comparisonValue) === -1) {
              log += "MATCH";
              eLog.OpAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 9:

            if (this.EvaluateSemver(comparisonAttribute, comparisonValue, comparator)) {
              log += "MATCH";
              eLog.OpAppendLine(log);

              return result;
            }

            log += "no match";

            break;

          case 10:
          case 11:
          case 12:
          case 13:
          case 14:
          case 15:

            if (this.EvaluateNumber(comparisonAttribute, comparisonValue, comparator)) {
              log += "MATCH";
              eLog.OpAppendLine(log);

              return result;
            }

            log += "no match";

            break;
          case 16: // is one of (sensitive)
            const values: string[] = comparisonValue.split(",");

            for (let ci = 0; ci < values.length; ci++) {

              if (values[ci].trim() === sha1(comparisonAttribute)) {
                log += "MATCH";
                eLog.OpAppendLine(log);

                return result;
              }
            }

            log += "no match";

            break;

          case 17: // is not one of (sensitive)
            if (!comparisonValue.split(",").some(e => {
              if (e.trim() === sha1(comparisonAttribute)) {
                return true;
              }

              return false;
            })) {
              log += "MATCH";
              eLog.OpAppendLine(log);

              return result;
            }

            log += "no match";

            break;
          default:
            break;
        }

        eLog.OpAppendLine(log);
      }
    }

    return null;
  }

  private EvaluatePercentageRules(rolloutPercentageItems: RolloutPercentageItem[], key: string, user: User): IEvaluateResult<RolloutPercentageItem> | null {
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

  private EvaluateNumber(v1: string, v2: string, comparator: number): boolean {
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
      case 10:
        return n1 === n2;
      case 11:
        return n1 !== n2;
      case 12:
        return n1 < n2;
      case 13:
        return n1 <= n2;
      case 14:
        return n1 > n2;
      case 15:
        return n1 >= n2;
      default:
        break;
    }

    return false;
  }

  private EvaluateSemver(v1: string, v2: string, comparator: number): boolean {
    this.logger.debug("RolloutEvaluator.EvaluateSemver() called.");
    if (semver.valid(v1) == null || isUndefined(v2)) {
      return false;
    }

    v2 = v2.trim();

    switch (comparator) {
      case 4:
        // in
        const sv: string[] = v2.split(",");
        let found = false;
        for (let ci = 0; ci < sv.length; ci++) {

          if (!sv[ci] || isUndefined(sv[ci]) || sv[ci].trim() === "") {
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

      case 5:
        // not in
        return !v2.split(",").some(e => {

          if (!e || isUndefined(e) || e.trim() === "") {
            return false;
          }

          e = semver.valid(e.trim());

          if (e == null) {
            return false;
          }

          return semver.eq(v1, e);
        });

      case 6:

        if (semver.valid(v2) == null) {
          return false;
        }

        return semver.lt(v1, v2);
      case 7:

        if (semver.valid(v2) == null) {
          return false;
        }

        return semver.lte(v1, v2);
      case 8:

        if (semver.valid(v2) == null) {
          return false;
        }

        return semver.gt(v1, v2);
      case 9:

        if (semver.valid(v2) == null) {
          return false;
        }
        return semver.gte(v1, v2);
      default:
        break;
    }

    return false;
  }

  private GetUserAttribute(user: User, attribute: string): string | undefined {
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

  private RuleToString(rule: number): string {
    switch (rule) {
      case 0:
        return "IS ONE OF";
      case 1:
        return "IS NOT ONE OF";
      case 2:
        return "CONTAINS";
      case 3:
        return "DOES NOT CONTAIN";
      case 4:
        return "IS ONE OF (SemVer)";
      case 5:
        return "IS NOT ONE OF (SemVer)";
      case 6:
        return "< (SemVer)";
      case 7:
        return "<= (SemVer)";
      case 8:
        return "> (SemVer)";
      case 9:
        return ">= (SemVer)";
      case 10:
        return "= (Number)";
      case 11:
        return "!= (Number)";
      case 12:
        return "< (Number)";
      case 13:
        return "<= (Number)";
      case 14:
        return "> (Number)";
      case 15:
        return ">= (Number)";
      case 16:
        return "IS ONE OF (Sensitive)";
      case 17:
        return "IS NOT ONE OF (Sensitive)";
      default:
        return <string><any>rule;
    }
  }
}

interface IEvaluateResult<TRule> {
  value: SettingValue;
  variationId: string;
  matchedRule?: TRule;
}

class EvaluateLogger {
  User!: User | undefined;

  KeyName!: string;

  ReturnValue!: any;

  Operations = "";

  OpAppendLine(s: string): void {
    this.Operations += " " + s + "\n";
  }

  GetLog(): string {
    return "Evaluate '" + this.KeyName + "'"
            + "\n User : " + JSON.stringify(this.User)
            + "\n" + this.Operations
            + " Returning value : " + this.ReturnValue;
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

export function evaluationDetailsFromDefaultVariationId(key: string, defaultVariationId: VariationIdValue, fetchTime?: Date, user?: User, errorMessage?: string, errorException?: any): IEvaluationDetails {
  return {
    key,
    value: null,
    variationId: defaultVariationId,
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
    errorMessage = `config.json is not present. Returning default value: '${defaultValue}'.`;
    logger.error(errorMessage);
    return evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorMessage);
  }

  const setting = settings[key];
  if (!setting) {
    errorMessage = `Evaluating '${key}' failed (key was not found in config.json). Returning default value: '${defaultValue}'. These are the available keys: ${keysToString(settings)}.`;
    logger.error(errorMessage);
    return evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorMessage);
  }

  ensureAllowedDefaultValue(defaultValue);

  const evaluationDetails = evaluator.Evaluate(setting, key, defaultValue, user, remoteConfig);

  if (defaultValue !== null && defaultValue !== void 0 && typeof defaultValue !== typeof evaluationDetails.value) {
    throw new Error(`The type of a setting must match the type of the given default value.\nThe setting's type was ${typeof defaultValue}, the given default value's type was ${typeof evaluationDetails.value}.\nPlease pass a corresponding default value type.`);
  }

  return evaluationDetails as IEvaluationDetails<SettingTypeOf<T>>;
}

export function evaluateVariationId(evaluator: IRolloutEvaluator, settings: { [name: string]: Setting } | null, key: string, defaultVariationId: VariationIdValue,
  user: User | undefined, remoteConfig: ProjectConfig | null, logger: LoggerWrapper): IEvaluationDetails {

  let errorMessage: string;
  if (!settings) {
    errorMessage = `config.json is not present. Returning default variationId: '${defaultVariationId}'.`;
    logger.error(errorMessage);
    return evaluationDetailsFromDefaultVariationId(key, defaultVariationId, getTimestampAsDate(remoteConfig), user, errorMessage);
  }

  const setting = settings[key];
  if (!setting) {
    errorMessage = `Evaluating '${key}' failed (key was not found in config.json). Returning default variationId: '${defaultVariationId}'. These are the available keys: ${keysToString(settings)}.`;
    logger.error(errorMessage);
    return evaluationDetailsFromDefaultVariationId(key, defaultVariationId, getTimestampAsDate(remoteConfig), user, errorMessage);
  }

  return evaluator.Evaluate(setting, key, null, user, remoteConfig, defaultVariationId);
}

function evaluateAllCore(evaluator: IRolloutEvaluator, settings: { [name: string]: Setting } | null,
  user: User | undefined, remoteConfig: ProjectConfig | null, logger: LoggerWrapper,
  getDetailsForError: (key: string, fetchTime: Date | undefined, user: User | undefined, err: any) => IEvaluationDetails): [IEvaluationDetails[], any[] | undefined] {

  let errors: any[] | undefined;

  if (!checkSettingsAvailable(settings, logger, ", returning empty array")) {
    return [[], errors];
  }

  const evaluationDetailsArray: IEvaluationDetails[] = [];

  let index = 0;
  for (const [key, setting] of Object.entries(settings)) {
    let evaluationDetails: IEvaluationDetails;
    try {
      evaluationDetails = evaluator.Evaluate(setting, key, null, user, remoteConfig);
    }
    catch (err) {
      errors ??= [];
      errors.push(err);
      evaluationDetails = getDetailsForError(key, getTimestampAsDate(remoteConfig), user, err);
    }

    evaluationDetailsArray[index++] = evaluationDetails;
  }

  return [evaluationDetailsArray, errors];
}

export function evaluateAll(evaluator: IRolloutEvaluator, settings: { [name: string]: Setting } | null,
  user: User | undefined, remoteConfig: ProjectConfig | null, logger: LoggerWrapper): [IEvaluationDetails[], any[] | undefined] {

  return evaluateAllCore(evaluator, settings, user, remoteConfig, logger,
    (key, fetchTime, user, err) => evaluationDetailsFromDefaultValue(key, null, fetchTime, user, errorToString(err), err));
}

export function evaluateAllVariationIds(evaluator: IRolloutEvaluator, settings: { [name: string]: Setting } | null,
  user: User | undefined, remoteConfig: ProjectConfig | null, logger: LoggerWrapper): [IEvaluationDetails[], any[] | undefined] {

  return evaluateAllCore(evaluator, settings, user, remoteConfig, logger,
    (key, fetchTime, user, err) => evaluationDetailsFromDefaultVariationId(key, null, fetchTime, user, errorToString(err), err));
}

export function checkSettingsAvailable(settings: { [name: string]: Setting } | null, logger: LoggerWrapper, appendix = ""): settings is { [name: string]: Setting } {
  if (!settings) {
    logger.error(`config.json is not present${appendix}`);
    return false;
  }

  return true;
}

export function ensureAllowedDefaultValue(value: SettingValue): void {
  if (value === null || value === void 0) {
    return;
  }

  const type = typeof value;
  if (type === "boolean" || type === "number" || type === "string") {
    return;
  }

  throw new Error("The default value must be boolean, number, string, null or undefined.");
}

function keysToString(settings: { [name: string]: Setting }) {
  return Object.keys(settings).join();
}
