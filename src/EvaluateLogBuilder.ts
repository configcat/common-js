import type { PrerequisiteFlagCondition, SegmentCondition, SettingValue, TargetingRule, UserCondition, UserConditionUnion } from "./ProjectConfig";
import { PrerequisiteFlagComparator, SegmentComparator, UserComparator } from "./ProjectConfig";
import { isAllowedValue } from "./RolloutEvaluator";
import { formatStringList, isArray } from "./Utils";

const invalidValuePlaceholder = "<invalid value>";
const invalidNamePlaceholder = "<invalid name>";
const invalidOperatorPlaceholder = "<invalid operator>";
const invalidReferencePlaceholder = "<invalid reference>";

const stringListMaxLength = 10;

export class EvaluateLogBuilder {
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
      const comparisonValueFormatted = formatStringList(comparisonValue, stringListMaxLength, count => `, ... <${count} more ${count === 1 ? valueText : valuesText}>`);

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

  appendTargetingRuleThenPart(targetingRule: TargetingRule, newLine: boolean): this {
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

export function formatUserComparator(comparator: UserComparator): string {
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

export function formatUserCondition(condition: UserConditionUnion): string {
  return new EvaluateLogBuilder().appendUserCondition(condition).toString();
}

export function formatPrerequisiteFlagComparator(comparator: PrerequisiteFlagComparator): string {
  switch (comparator) {
    case PrerequisiteFlagComparator.Equals: return "EQUALS";
    case PrerequisiteFlagComparator.NotEquals: return "NOT EQUALS";
    default: return invalidOperatorPlaceholder;
  }
}

export function formatSegmentComparator(comparator: SegmentComparator): string {
  switch (comparator) {
    case SegmentComparator.IsIn: return "IS IN SEGMENT";
    case SegmentComparator.IsNotIn: return "IS NOT IN SEGMENT";
    default: return invalidOperatorPlaceholder;
  }
}

export function valueToString(value: NonNullable<SettingValue>): string {
  return isAllowedValue(value) ? value.toString() : invalidValuePlaceholder;
}