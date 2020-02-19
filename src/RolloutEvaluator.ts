import * as sha1 from "js-sha1";
import { IConfigCatLogger } from ".";
import { ProjectConfig, Setting, RolloutRules, RolloutPercentageItems } from "./ProjectConfig";
import * as semver from "semver/preload";
import { isUndefined } from "util";

export interface IRolloutEvaluator {
    Evaluate(config: ProjectConfig, key: string, defaultValue: any, user?: User): any;
}

/** Object for variation evaluation */
export class User {

    constructor(identifier: string, email: string = null, country: string = null, custom = {}) {
        this.identifier = identifier;
        this.email = email;
        this.country = country;
        this.custom = custom;
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

    private logger: IConfigCatLogger;

    constructor(logger: IConfigCatLogger) {

        this.logger = logger;
    }

    Evaluate(config: ProjectConfig, key: string, defaultValue: any, user?: User): any {

        if (!config || !config.ConfigJSON) {

            this.logger.error("JSONConfig is not present. Returning default value: '" + defaultValue + "'.");

            return defaultValue;
        }

        if (!config.ConfigJSON[key]) {

            let s: string = "Evaluating getValue('" + key + "') failed. Returning default value: '" + defaultValue + "'.";
            s += " Here are the available keys: {" + Object.keys(config.ConfigJSON).join() + "}.";

            this.logger.error(s);

            return defaultValue;
        }

        let eLog: EvaluateLogger = new EvaluateLogger();

        eLog.User = user;
        eLog.KeyName = key;
        eLog.ReturnValue = defaultValue;

        let result: EvaluateResult = new EvaluateResult();
        result.EvaluateLog = eLog;

        if (user) {

            result = this.EvaluateRules(config.ConfigJSON[key][Setting.RolloutRules], user, eLog);

            if (result.Value == null) {

                result.Value = result.EvaluateLog.ReturnValue = this.EvaluateVariations(config.ConfigJSON[key][Setting.RolloutPercentageItems], key, user);

                if (config.ConfigJSON[key][Setting.RolloutPercentageItems].length > 0) {
                    result.EvaluateLog.OpAppendLine("Evaluating % options => " + (result.Value == null ? "user not targeted" : "user targeted"));
                }

            }
        }
        else {

            if ((config.ConfigJSON[key][Setting.RolloutRules] && config.ConfigJSON[key][Setting.RolloutRules].length > 0) ||
                (config.ConfigJSON[key][Setting.RolloutPercentageItems] && config.ConfigJSON[key][Setting.RolloutPercentageItems].length > 0)) {
                let s: string = "Evaluating getValue('" + key + "'). "
                s += "UserObject missing! You should pass a UserObject to getValue(), in order to make targeting work properly. ";
                s += "Read more: https://configcat.com/docs/advanced/user-object";

                this.logger.warn(s);
            }
        }

        if (result.Value == null) {
            result.EvaluateLog.ReturnValue = config.ConfigJSON[key][Setting.Value];
        }

        this.logger.info(result.EvaluateLog.GetLog());

        return result.Value == null ? config.ConfigJSON[key][Setting.Value] : result.Value;
    }

    private EvaluateRules(rolloutRules: any, user: User, eLog: EvaluateLogger): EvaluateResult {

        let result: EvaluateResult = new EvaluateResult();
        result.Value = null;

        if (rolloutRules && rolloutRules.length > 0) {

            for (let i: number = 0; i < rolloutRules.length; i++) {

                let rule: any = rolloutRules[i];

                let comparisonAttribute: string = this.GetUserAttribute(user, rule[RolloutRules.ComparisonAttribute]);

                if (!comparisonAttribute) {
                    continue;
                }

                let comparator: number = rule[RolloutRules.Comparator];

                let comparisonValue: string = rule[RolloutRules.ComparisonValue];

                let log: string = "Evaluating rule: '" + comparisonAttribute + "' " + this.RuleToString(comparator) + " '" + comparisonValue + "' => ";

                switch (comparator) {
                    case 0: // is one of

                        let cvs: string[] = comparisonValue.split(",");

                        for (let ci: number = 0; ci < cvs.length; ci++) {

                            if (cvs[ci].trim() === comparisonAttribute) {
                                log += "MATCH";

                                eLog.OpAppendLine(log);

                                result.Value = eLog.ReturnValue = rule[RolloutRules.Value];
                                result.EvaluateLog = eLog;

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

                            result.Value = eLog.ReturnValue = rule[RolloutRules.Value];
                            result.EvaluateLog = eLog;

                            return result;
                        }

                        log += "no match";

                        break;

                    case 2: // contains

                        if (comparisonAttribute.search(comparisonValue) !== -1) {
                            log += "MATCH";

                            eLog.OpAppendLine(log);

                            result.Value = eLog.ReturnValue = rule[RolloutRules.Value];
                            result.EvaluateLog = eLog;

                            return result;
                        }

                        log += "no match";

                        break;

                    case 3: // not contains

                        if (comparisonAttribute.search(comparisonValue) === -1) {
                            log += "MATCH";

                            eLog.OpAppendLine(log);

                            result.Value = eLog.ReturnValue = rule[RolloutRules.Value];
                            result.EvaluateLog = eLog;

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

                            result.Value = eLog.ReturnValue = rule[RolloutRules.Value];
                            result.EvaluateLog = eLog;

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

                            result.Value = eLog.ReturnValue = rule[RolloutRules.Value];
                            result.EvaluateLog = eLog;

                            return result;
                        }

                        log += "no match";

                        break;
                    case 16: // is one of (sensitive)
                        let values: string[] = comparisonValue.split(",");

                        for (let ci: number = 0; ci < values.length; ci++) {

                            if (values[ci].trim() === sha1(comparisonAttribute)) {
                                log += "MATCH";

                                eLog.OpAppendLine(log);

                                result.Value = eLog.ReturnValue = rule[RolloutRules.Value];
                                result.EvaluateLog = eLog;

                                return result;
                            }
                        }

                        log += "no match";

                        break;

                    case 17: // is not one of (sensitive)
                        if (!comparisonValue.split(",").some(e => {
                            console.log(e);
                            
                            console.log(sha1(e.trim()));
                            
                            if (e.trim() === sha1(comparisonAttribute)) {
                                return true;
                            }

                            return false;
                        })) {
                            log += "MATCH";

                            eLog.OpAppendLine(log);

                            result.Value = eLog.ReturnValue = rule[RolloutRules.Value];
                            result.EvaluateLog = eLog;

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
        result.EvaluateLog = eLog;

        return result;
    }

    private EvaluateVariations(rolloutPercentageItems: any, key: string, User: User): any {

        if (rolloutPercentageItems && rolloutPercentageItems.length > 0) {

            let hashCandidate: string = key + User.identifier;
            let hashValue: any = sha1(hashCandidate).substring(0, 7);
            let hashScale: number = parseInt(hashValue, 16) % 100;
            let bucket: number = 0;

            for (let i: number = 0; i < rolloutPercentageItems.length; i++) {
                const variation: any = rolloutPercentageItems[i];
                bucket += +variation[RolloutPercentageItems.Percentage];

                if (hashScale < bucket) {
                    return variation[RolloutPercentageItems.Value];
                }
            }
        }

        return null;
    }

    private EvaluateNumber(v1: string, v2: string, comparator: number): boolean {

        let n1: number, n2: number;

        if (v1 && !Number.isNaN(Number.parseFloat(v1.replace(',', '.')))) {
            n1 = Number.parseFloat(v1.replace(',', '.'));
        }
        else {
            return false;
        }

        if (v2 && !Number.isNaN(Number.parseFloat(v2.replace(',', '.')))) {
            n2 = Number.parseFloat(v2.replace(',', '.'));
        }
        else {
            return false;
        }

        switch (comparator) {
            case 10:
                return n1 == n2;
            case 11:
                return n1 != n2;
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

        if (semver.valid(v1) == null || isUndefined(v2)) {
            return false;
        }

        v2 = v2.trim();

        switch (comparator) {
            case 4:
                // in
                let sv: string[] = v2.split(",");
                let found: boolean = false;
                for (let ci: number = 0; ci < sv.length; ci++) {

                    if (!sv[ci] || isUndefined(sv[ci]) || sv[ci].trim() === "") {
                        continue;
                    }

                    if (semver.valid(sv[ci].trim()) == null) {
                        return false;
                    }

                    if (!found) {
                        found = semver.eq(v1, sv[ci].trim(), true);
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
                })

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

    private GetUserAttribute(User: User, attribute: string): string {
        switch (attribute) {
            case "Identifier":
                return User.identifier;
            case "Email":
                return User.email;
            case "Country":
                return User.country;
            default:
                return (User.custom || {})[attribute];
        }
    }

    private RuleToString(rule: number): string {
        switch (rule) {
            case 0:
                return "IS ONE OF"
            case 1:
                return "IS NOT ONE OF";
            case 2:
                return "CONTAINS";
            case 3:
                return "DOES NOT CONTAIN"
            case 4:
                return "IS ONE OF (SemVer)";
            case 5:
                return "IS NOT ONE OF (SemVer)";
            case 6:
                return "< (SemVer)"
            case 7:
                return "<= (SemVer)"
            case 8:
                return "> (SemVer)"
            case 9:
                return ">= (SemVer)"
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

class EvaluateResult {
    public Value: any;

    public EvaluateLog: EvaluateLogger;
}

class EvaluateLogger {
    public User: User;

    public KeyName: string;

    public ReturnValue: any;

    public Operations: string = "";

    public OpAppendLine(s: string): void {
        this.Operations += " " + s + "\n";
    }

    public GetLog(): string {
        return "Evaluate '" + this.KeyName + "'"
            + "\n User : " + JSON.stringify(this.User)
            + "\n" + this.Operations
            + " Returning value : " + this.ReturnValue;
    }
}