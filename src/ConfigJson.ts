/**
 * The ConfigCat config_v6.json schema that is used by the ConfigCat SDKs, described using TypeScript types.
 */

export type Config = {
  /**
   * Preferences of the config.json, mostly for controlling the redirection behaviour of the SDK.
   */
  p: Preferences;
  /**
   * Segment definitions for re-using segment rules in targeting rules.
   */
  s?: Segment[];
  /**
   * Setting definitions.
   */
  f?: { [key: string]: SettingUnion };
}

export type Preferences = {
  /**
   * The redirect mode that should be used in case the data governance mode is wrongly configured.
   */
  r: RedirectMode;
  /**
   * The base url from where the config.json is intended to be downloaded.
   */
  u: string;
  /**
   * The salt that, combined with the feature flag key or segment name, is used to hash values for sensitive text comparisons.
   */
  s: string;
}

export type Segment = {
  n: string;
  r: [UserConditionUnion, ...UserConditionUnion[]];
}

export type SettingUnion = { [K in SettingType]: Setting<K> }[SettingType];

export type Setting<TSetting extends SettingType = SettingType> = {
  t: TSetting;
  /**
   * The percentage rule evaluation will hash this attribute of the User object to calculate the buckets.
   */
  a?: string;
  r?: TargetingRule<TSetting>[];
  p?: PercentageOption<TSetting>[];
} & ServedValue<TSetting>;

export type TargetingRule<TSetting extends SettingType = SettingType> = {
  c: [ConditionUnion, ...ConditionUnion[]];
} & (
    { s: ServedValue<TSetting>; p?: never }
    | { p: PercentageOption<TSetting>[]; s?: never }
)

export type ConditionUnion =
  { u: UserConditionUnion; p?: never; s?: never }
  | { p: PrerequisiteFlagCondition; u?: never; s?: never }
  | { s: SegmentCondition; u?: never; p?: never }

export type PercentageOption<TSetting extends SettingType = SettingType> = {
  p: number;
} & ServedValue<TSetting>;

export type SettingValue<TSetting extends SettingType = SettingType> = {
  [SettingType.Boolean]: { b: boolean; s?: never; i?: never; d?: never };
  [SettingType.String]: { s: string; b?: never; i?: never; d?: never };
  [SettingType.Int]: { i: number; b?: never; s?: never; d?: never };
  [SettingType.Double]: { d: number; b?: never; s?: never; i?: never };
}[TSetting];

export type UserConditionUnion = { [K in UserComparator]: UserCondition<K> }[UserComparator];

export type UserCondition<TComparator extends UserComparator = UserComparator> = {
  /**
   * The attribute of the user object that should be used to evalaute this rule.
   */
  a: string;
  c: TComparator;
} & UserConditionComparisonValue<TComparator>

export type UserConditionComparisonValue<TComparator extends UserComparator = UserComparator> = {
  [UserComparator.TextIsOneOf]: UserConditionStringListComparisonValue;
  [UserComparator.TextIsNotOneOf]: UserConditionStringListComparisonValue;
  [UserComparator.TextContainsAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.TextNotContainsAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.SemVerIsOneOf]: UserConditionStringListComparisonValue;
  [UserComparator.SemVerIsNotOneOf]: UserConditionStringListComparisonValue;
  [UserComparator.SemVerLess]: UserConditionStringComparisonValue;
  [UserComparator.SemVerLessOrEquals]: UserConditionStringComparisonValue;
  [UserComparator.SemVerGreater]: UserConditionStringComparisonValue;
  [UserComparator.SemVerGreaterOrEquals]: UserConditionStringComparisonValue;
  [UserComparator.NumberEquals]: UserConditionNumberComparisonValue;
  [UserComparator.NumberNotEquals]: UserConditionNumberComparisonValue;
  [UserComparator.NumberLess]: UserConditionNumberComparisonValue;
  [UserComparator.NumberLessOrEquals]: UserConditionNumberComparisonValue;
  [UserComparator.NumberGreater]: UserConditionNumberComparisonValue;
  [UserComparator.NumberGreaterOrEquals]: UserConditionNumberComparisonValue;
  [UserComparator.SensitiveTextIsOneOf]: UserConditionStringListComparisonValue;
  [UserComparator.SensitiveTextIsNotOneOf]: UserConditionStringListComparisonValue;
  [UserComparator.DateTimeBefore]: UserConditionNumberComparisonValue;
  [UserComparator.DateTimeAfter]: UserConditionNumberComparisonValue;
  [UserComparator.SensitiveTextEquals]: UserConditionStringComparisonValue;
  [UserComparator.SensitiveTextNotEquals]: UserConditionStringComparisonValue;
  [UserComparator.SensitiveTextStartsWithAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.SensitiveTextNotStartsWithAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.SensitiveTextEndsWithAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.SensitiveTextNotEndsWithAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.SensitiveArrayContainsAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.SensitiveArrayNotContainsAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.TextEquals]: UserConditionStringComparisonValue;
  [UserComparator.TextNotEquals]: UserConditionStringComparisonValue;
  [UserComparator.TextStartsWithAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.TextNotStartsWithAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.TextEndsWithAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.TextNotEndsWithAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.ArrayContainsAnyOf]: UserConditionStringListComparisonValue;
  [UserComparator.ArrayNotContainsAnyOf]: UserConditionStringListComparisonValue;
}[TComparator];

export type UserConditionStringComparisonValue = { s: string; d?: never; l?: never };
export type UserConditionNumberComparisonValue = { d: number; s?: never; l?: never };
export type UserConditionStringListComparisonValue = { l: string[]; s?: never; d?: never };

export type PrerequisiteFlagCondition = {
  /**
   * The key of the prerequisite flag.
   */
  f: string;
  c: PrerequisiteFlagComparator;
  v: SettingValue;
}

export type SegmentCondition = {
  /**
   * The zero-based index of the segment.
   */
  s: number;
  c: SegmentComparator;
}

export type ServedValue<TSetting extends SettingType = SettingType> = {
  v: SettingValue<TSetting>;
  i: string;
}

export enum RedirectMode {
  No = 0,
  Should = 1,
  Force = 2,
}

/** Setting type. */
export enum SettingType {
  /** On/off type (feature flag). */
  Boolean = 0,
  /** Text type. */
  String = 1,
  /** Whole number type. */
  Int = 2,
  /** Decimal number type. */
  Double = 3,
}

/** User Object attribute comparison operator used during the evaluation process. */
export enum UserComparator {
  /** IS ONE OF (cleartext) - It matches when the comparison attribute is equal to any of the comparison values. */
  TextIsOneOf = 0,
  /** IS NOT ONE OF (cleartext) - It matches when the comparison attribute is not equal to any of the comparison values. */
  TextIsNotOneOf = 1,
  /** CONTAINS ANY OF (cleartext) - It matches when the comparison attribute contains any comparison values as a substring. */
  TextContainsAnyOf = 2,
  /** NOT CONTAINS ANY OF (cleartext) - It matches when the comparison attribute does not contain any comparison values as a substring. */
  TextNotContainsAnyOf = 3,
  /** IS ONE OF (semver) - It matches when the comparison attribute interpreted as a semantic version is equal to any of the comparison values. */
  SemVerIsOneOf = 4,
  /** IS NOT ONE OF (semver) - It matches when the comparison attribute interpreted as a semantic version is not equal to any of the comparison values. */
  SemVerIsNotOneOf = 5,
  /** &lt; (semver) - It matches when the comparison attribute interpreted as a semantic version is less than the comparison value. */
  SemVerLess = 6,
  /** &lt;= (semver) - It matches when the comparison attribute interpreted as a semantic version is less than or equal to the comparison value. */
  SemVerLessOrEquals = 7,
  /** &gt; (semver) - It matches when the comparison attribute interpreted as a semantic version is greater than the comparison value. */
  SemVerGreater = 8,
  /** &gt;= (semver) - It matches when the comparison attribute interpreted as a semantic version is greater than or equal to the comparison value. */
  SemVerGreaterOrEquals = 9,
  /** = (number) - It matches when the comparison attribute interpreted as a decimal number is equal to the comparison value. */
  NumberEquals = 10,
  /** != (number) - It matches when the comparison attribute interpreted as a decimal number is not equal to the comparison value. */
  NumberNotEquals = 11,
  /** &lt; (number) - It matches when the comparison attribute interpreted as a decimal number is less than the comparison value. */
  NumberLess = 12,
  /** &lt;= (number) - It matches when the comparison attribute interpreted as a decimal number is less than or equal to the comparison value. */
  NumberLessOrEquals = 13,
  /** &gt; (number) - It matches when the comparison attribute interpreted as a decimal number is greater than the comparison value. */
  NumberGreater = 14,
  /** &gt;= (number) - It matches when the comparison attribute interpreted as a decimal number is greater than or equal to the comparison value. */
  NumberGreaterOrEquals = 15,
  /** IS ONE OF (hashed) - It matches when the comparison attribute is equal to any of the comparison values (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveTextIsOneOf = 16,
  /** IS NOT ONE OF (hashed) - It matches when the comparison attribute is not equal to any of the comparison values (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveTextIsNotOneOf = 17,
  /** BEFORE (UTC datetime) - It matches when the comparison attribute interpreted as the seconds elapsed since <see href="https://en.wikipedia.org/wiki/Unix_time">Unix Epoch</see> is less than the comparison value. */
  DateTimeBefore = 18,
  /** AFTER (UTC datetime) - It matches when the comparison attribute interpreted as the seconds elapsed since <see href="https://en.wikipedia.org/wiki/Unix_time">Unix Epoch</see> is greater than the comparison value. */
  DateTimeAfter = 19,
  /** EQUALS (hashed) - It matches when the comparison attribute is equal to the comparison value (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveTextEquals = 20,
  /** NOT EQUALS (hashed) - It matches when the comparison attribute is not equal to the comparison value (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveTextNotEquals = 21,
  /** STARTS WITH ANY OF (hashed) - It matches when the comparison attribute starts with any of the comparison values (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveTextStartsWithAnyOf = 22,
  /** NOT STARTS WITH ANY OF (hashed) - It matches when the comparison attribute does not start with any of the comparison values (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveTextNotStartsWithAnyOf = 23,
  /** ENDS WITH ANY OF (hashed) - It matches when the comparison attribute ends with any of the comparison values (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveTextEndsWithAnyOf = 24,
  /** NOT ENDS WITH ANY OF (hashed) - It matches when the comparison attribute does not end with any of the comparison values (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveTextNotEndsWithAnyOf = 25,
  /** ARRAY CONTAINS ANY OF (hashed) - It matches when the comparison attribute interpreted as a comma-separated list contains any of the comparison values (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveArrayContainsAnyOf = 26,
  /** ARRAY NOT CONTAINS ANY OF (hashed) - It matches when the comparison attribute interpreted as a comma-separated list does not contain any of the comparison values (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveArrayNotContainsAnyOf = 27,
  /** EQUALS (cleartext) - It matches when the comparison attribute is equal to the comparison value. */
  TextEquals = 28,
  /** NOT EQUALS (cleartext) - It matches when the comparison attribute is not equal to the comparison value. */
  TextNotEquals = 29,
  /** STARTS WITH ANY OF (cleartext) - It matches when the comparison attribute starts with any of the comparison values. */
  TextStartsWithAnyOf = 30,
  /** NOT STARTS WITH ANY OF (cleartext) - It matches when the comparison attribute does not start with any of the comparison values. */
  TextNotStartsWithAnyOf = 31,
  /** ENDS WITH ANY OF (cleartext) - It matches when the comparison attribute ends with any of the comparison values. */
  TextEndsWithAnyOf = 32,
  /** NOT ENDS WITH ANY OF (cleartext) - It matches when the comparison attribute does not end with any of the comparison values. */
  TextNotEndsWithAnyOf = 33,
  /** ARRAY CONTAINS ANY OF (cleartext) - It matches when the comparison attribute interpreted as a comma-separated list contains any of the comparison values. */
  ArrayContainsAnyOf = 34,
  /** ARRAY NOT CONTAINS ANY OF (cleartext) - It matches when the comparison attribute interpreted as a comma-separated list does not contain any of the comparison values. */
  ArrayNotContainsAnyOf = 35,
}

/** Prerequisite flag comparison operator used during the evaluation process. */
export enum PrerequisiteFlagComparator {
  /** EQUALS - It matches when the evaluated value of the specified prerequisite flag is equal to the comparison value. */
  Equals = 0,
  /** NOT EQUALS - It matches when the evaluated value of the specified prerequisite flag is not equal to the comparison value. */
  NotEquals = 1
}

/** Segment comparison operator used during the evaluation process. */
export enum SegmentComparator {
  /** IS IN SEGMENT - It matches when the conditions of the specified segment are evaluated to true. */
  IsIn = 0,
  /** IS NOT IN SEGMENT - It matches when the conditions of the specified segment are evaluated to false. */
  IsNotIn = 1,
}
