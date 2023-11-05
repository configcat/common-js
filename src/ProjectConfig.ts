export class ProjectConfig {
  static readonly serializationFormatVersion = "v2";

  static readonly empty = new ProjectConfig(void 0, void 0, 0, void 0);

  static equals(projectConfig1: ProjectConfig, projectConfig2: ProjectConfig): boolean {
    // When both ETags are available, we don't need to check the JSON content.
    return projectConfig1.httpETag && projectConfig2.httpETag
      ? projectConfig1.httpETag === projectConfig2.httpETag
      : projectConfig1.configJson === projectConfig2.configJson;
  }

  constructor(
    readonly configJson: string | undefined,
    readonly config: Config | undefined,
    readonly timestamp: number,
    readonly httpETag: string | undefined) {
  }

  with(timestamp: number): ProjectConfig { return new ProjectConfig(this.configJson, this.config, timestamp, this.httpETag); }

  get isEmpty(): boolean { return !this.config; }

  isExpired(expirationMs: number): boolean {
    return this === ProjectConfig.empty || this.timestamp + expirationMs < ProjectConfig.generateTimestamp();
  }

  static generateTimestamp(): number {
    return new Date().getTime();
  }

  static serialize(config: ProjectConfig): string {
    return config.timestamp + "\n"
      + (config.httpETag ?? "") + "\n"
      + (config.configJson ?? "");
  }

  static deserialize(value: string): ProjectConfig {
    const separatorIndices = Array<number>(2);
    let index = 0;
    for (let i = 0; i < separatorIndices.length; i++) {
      index = value.indexOf("\n", index);
      if (index < 0) {
        throw new Error("Number of values is fewer than expected.");
      }

      separatorIndices[i] = index++;
    }

    let endIndex = separatorIndices[0];
    let slice = value.substring(0, endIndex);

    const fetchTime = parseInt(slice);
    if (isNaN(fetchTime)) {
      throw new Error("Invalid fetch time: " + slice);
    }

    index = endIndex + 1;
    endIndex = separatorIndices[1];
    slice = value.substring(index, endIndex);

    const httpETag = slice.length > 0 ? slice : void 0;

    index = endIndex + 1;
    slice = value.substring(index);

    let config: Config | undefined;
    let configJson: string | undefined;
    if (slice.length > 0) {
      try {
        config = new Config(JSON.parse(slice));
      }
      catch {
        throw new Error("Invalid config JSON content: " + slice);
      }
      configJson = slice;
    }

    return new ProjectConfig(configJson, config, fetchTime, httpETag);
  }
}

/** Details of a ConfigCat config. */
export interface IConfig {
  /** The salt that was used to hash sensitive comparison values. */
  readonly salt: string | undefined;
  /** The array of segments. */
  readonly segments: ReadonlyArray<ISegment>;
  /** The key-value map of settings. */
  readonly settings: Readonly<{ [key: string]: ISettingUnion }>;
}

export class Config implements IConfig {
  readonly preferences: Preferences | undefined;
  readonly segments: ReadonlyArray<Segment>;
  readonly settings: Readonly<{ [key: string]: SettingUnion }>;

  constructor(json: any) {
    this.preferences = json.p != null ? new Preferences(json.p) : void 0;
    this.segments = json.s?.map((item: any) => new Segment(item)) ?? [];
    this.settings = json.f != null
      ? Object.fromEntries(Object.entries(json.f).map(([key, value]) => [key, new Setting(value, this) as SettingUnion]))
      : {};
  }

  get salt(): string | undefined { return this.preferences?.salt; }
}

export enum RedirectMode {
  No = 0,
  Should = 1,
  Force = 2,
}

export class Preferences {
  readonly baseUrl: string | undefined;
  readonly redirectMode: RedirectMode | undefined;
  readonly salt: string | undefined;

  constructor(json: any) {
    this.baseUrl = json.u;
    this.redirectMode = json.r;
    this.salt = json.s;
  }
}

/** Describes a segment. */
export interface ISegment {
  /** The name of the segment. */
  readonly name: string;
  /** The array of segment rule conditions (where there is a logical AND relation between the items). */
  readonly conditions: ReadonlyArray<IUserConditionUnion>;
}

export class Segment implements ISegment {
  readonly name: string;
  readonly conditions: ReadonlyArray<UserConditionUnion>;

  constructor(json: any) {
    this.name = json.n;
    this.conditions = json.r?.map((item: any) => new UserCondition(item)) ?? [];
  }
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

export type SettingTypeMap = {
  [SettingType.Boolean]: boolean;
  [SettingType.String]: string;
  [SettingType.Int]: number;
  [SettingType.Double]: number;
};

export type SettingValue = SettingTypeMap[SettingType] | null | undefined;

export type VariationIdValue = string | null | undefined;

export type WellKnownUserObjectAttribute = "Identifier" | "Email" | "Country";

/** A model object which contains a setting value along with related data. */
export interface ISettingValueContainer<TValue extends NonNullable<SettingValue> = NonNullable<SettingValue>> {
  /** Setting value. */
  readonly value: TValue;
  /** Variation ID. */
  readonly variationId?: NonNullable<VariationIdValue>;
}

export class SettingValueContainer<TValue extends NonNullable<SettingValue> = NonNullable<SettingValue>> implements ISettingValueContainer<TValue> {
  readonly value: TValue;
  readonly variationId?: NonNullable<VariationIdValue>;

  constructor(json: any, hasUnwrappedValue = false) {
    this.value = !hasUnwrappedValue ? unwrapSettingValue(json.v) : json.v;
    this.variationId = json.i;
  }
}

// NOTE: The TS compiler can't do type narrowing on constrained generic type parameters (see https://stackoverflow.com/a/68898908/8656352).
// So, to make type narrowing work, we derive a discriminated union type containing all the possible substitutions of the type parameter
// (see also https://github.com/Microsoft/TypeScript/issues/27272#issuecomment-423630799).
export type ISettingUnion = { [K in SettingType]: ISetting<K> }[SettingType];

/** Feature flag or setting. */
export interface ISetting<T extends SettingType = SettingType> extends ISettingValueContainer<SettingTypeMap[T]> {
  /** Setting type. */
  readonly type: T;
  /** The User Object attribute which serves as the basis of percentage options evaluation. */
  readonly percentageOptionsAttribute: string;
  /** The array of targeting rules (where there is a logical OR relation between the items). */
  readonly targetingRules: ReadonlyArray<ITargetingRule>;
  /** The array of percentage options. */
  readonly percentageOptions: ReadonlyArray<IPercentageOption>;
}

export type SettingUnion = { [K in SettingType]: Setting<K> }[SettingType];

export class Setting<T extends SettingType = SettingType> extends SettingValueContainer<SettingTypeMap[T]> implements ISetting {
  readonly type: T;
  readonly percentageOptionsAttribute: string;
  readonly targetingRules: ReadonlyArray<TargetingRule<SettingTypeMap[T]>>;
  readonly percentageOptions: ReadonlyArray<PercentageOption<SettingTypeMap[T]>>;
  readonly configJsonSalt: string;

  constructor(json: any, config?: Config) {
    super(json, json.t < 0);
    this.type = json.t;
    const identifierAttribute: WellKnownUserObjectAttribute = "Identifier";
    this.percentageOptionsAttribute = json.a ?? identifierAttribute;
    this.targetingRules = json.r?.map((item: any) => new TargetingRule(item, config!)) ?? [];
    this.percentageOptions = json.p?.map((item: any) => new PercentageOption(item)) ?? [];
    this.configJsonSalt = config?.salt ?? "";
  }

  static fromValue(value: NonNullable<SettingValue>): Setting {
    return new Setting({
      t: -1, // this is not a defined SettingType value, we only use it internally (will never expose it to the consumer)
      v: value,
    });
  }
}

/** Describes a targeting rule. */
export interface ITargetingRule<TValue extends NonNullable<SettingValue> = NonNullable<SettingValue>> {
  /** The array of conditions that are combined with the AND logical operator. (The IF part of the targeting rule.) */
  readonly conditions: ReadonlyArray<IConditionUnion>;
  /** The simple value or the array of percentage options associated with the targeting rule. (The THEN part of the targeting rule.) */
  readonly then: ISettingValueContainer<TValue> | ReadonlyArray<IPercentageOption<TValue>>;
}

export class TargetingRule<TValue extends NonNullable<SettingValue> = NonNullable<SettingValue>> implements ITargetingRule {
  readonly conditions: ReadonlyArray<ConditionUnion>;
  readonly then: SettingValueContainer<TValue> | ReadonlyArray<PercentageOption<TValue>>;

  constructor(json: any, config: Config) {
    this.conditions = json.c?.map((item: any) =>
      item.u != null ? new UserCondition(item.u) :
      item.p != null ? new PrerequisiteFlagCondition(item.p) :
      item.s != null ? new SegmentCondition(item.s, config) :
      void 0) ?? [];
    this.then = json.p != null
      ? json.p.map((item: any) => new PercentageOption(item))
      : new SettingValueContainer(json.s);
  }
}

/** Represents a percentage option. */
export interface IPercentageOption<TValue extends NonNullable<SettingValue> = NonNullable<SettingValue>> extends ISettingValueContainer<TValue> {
  /** A number between 0 and 100 that represents a randomly allocated fraction of the users. */
  readonly percentage: number;
}

export class PercentageOption<TValue extends NonNullable<SettingValue> = NonNullable<SettingValue>> extends SettingValueContainer<TValue> implements IPercentageOption {
  readonly percentage: number;

  constructor(json: any) {
    super(json);
    this.percentage = json.p;
  }
}

export type ConditionTypeMap = {
  ["UserCondition"]: IUserConditionUnion;
  ["PrerequisiteFlagCondition"]: IPrerequisiteFlagCondition;
  ["SegmentCondition"]: ISegmentCondition;
}

export type IConditionUnion = ConditionTypeMap[keyof ConditionTypeMap];

/** Represents a condition. */
export interface ICondition<T extends keyof ConditionTypeMap = keyof ConditionTypeMap> {
  /** The type of the condition. */
  readonly type: T;
}

export type ConditionUnion = UserConditionUnion | PrerequisiteFlagCondition | SegmentCondition;

/** User Object attribute comparison operator used during the evaluation process. */
export enum UserComparator {
  /** IS ONE OF (cleartext) - It matches when the comparison attribute is equal to any of the comparison values. */
  IsOneOf = 0,
  /** IS NOT ONE OF (cleartext) - It matches when the comparison attribute is not equal to any of the comparison values. */
  IsNotOneOf = 1,
  /** CONTAINS ANY OF (cleartext) - It matches when the comparison attribute contains any comparison values as a substring. */
  ContainsAnyOf = 2,
  /** NOT CONTAINS ANY OF (cleartext) - It matches when the comparison attribute does not contain any comparison values as a substring. */
  NotContainsAnyOf = 3,
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
  SensitiveIsOneOf = 16,
  /** IS NOT ONE OF (hashed) - It matches when the comparison attribute is not equal to any of the comparison values (where the comparison is performed using the salted SHA256 hashes of the values). */
  SensitiveIsNotOneOf = 17,
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

export type UserConditionComparisonValueTypeMap = {
  [UserComparator.IsOneOf]: Readonly<string[]>;
  [UserComparator.IsNotOneOf]: Readonly<string[]>;
  [UserComparator.ContainsAnyOf]: Readonly<string[]>;
  [UserComparator.NotContainsAnyOf]: Readonly<string[]>;
  [UserComparator.SemVerIsOneOf]: Readonly<string[]>;
  [UserComparator.SemVerIsNotOneOf]: Readonly<string[]>;
  [UserComparator.SemVerLess]: string;
  [UserComparator.SemVerLessOrEquals]: string;
  [UserComparator.SemVerGreater]: string;
  [UserComparator.SemVerGreaterOrEquals]: string;
  [UserComparator.NumberEquals]: number;
  [UserComparator.NumberNotEquals]: number;
  [UserComparator.NumberLess]: number;
  [UserComparator.NumberLessOrEquals]: number;
  [UserComparator.NumberGreater]: number;
  [UserComparator.NumberGreaterOrEquals]: number;
  [UserComparator.SensitiveIsOneOf]: Readonly<string[]>;
  [UserComparator.SensitiveIsNotOneOf]: Readonly<string[]>;
  [UserComparator.DateTimeBefore]: number;
  [UserComparator.DateTimeAfter]: number;
  [UserComparator.SensitiveTextEquals]: string;
  [UserComparator.SensitiveTextNotEquals]: string;
  [UserComparator.SensitiveTextStartsWithAnyOf]: Readonly<string[]>;
  [UserComparator.SensitiveTextNotStartsWithAnyOf]: Readonly<string[]>;
  [UserComparator.SensitiveTextEndsWithAnyOf]: Readonly<string[]>;
  [UserComparator.SensitiveTextNotEndsWithAnyOf]: Readonly<string[]>;
  [UserComparator.SensitiveArrayContainsAnyOf]: Readonly<string[]>;
  [UserComparator.SensitiveArrayNotContainsAnyOf]: Readonly<string[]>;
  [UserComparator.TextEquals]: string;
  [UserComparator.TextNotEquals]: string;
  [UserComparator.TextStartsWithAnyOf]: Readonly<string[]>;
  [UserComparator.TextNotStartsWithAnyOf]: Readonly<string[]>;
  [UserComparator.TextEndsWithAnyOf]: Readonly<string[]>;
  [UserComparator.TextNotEndsWithAnyOf]: Readonly<string[]>;
  [UserComparator.ArrayContainsAnyOf]: Readonly<string[]>;
  [UserComparator.ArrayNotContainsAnyOf]: Readonly<string[]>;
}

export type IUserConditionUnion = { [K in UserComparator]: IUserCondition<K> }[UserComparator];

/** Describes a condition that is based on a User Object attribute. */
export interface IUserCondition<TComparator extends UserComparator = UserComparator> extends ICondition<"UserCondition"> {
  /** The User Object attribute that the condition is based on. Can be "Identifier", "Email", "Country" or any custom attribute. */
  readonly comparisonAttribute: string;
  /** The operator which defines the relation between the comparison attribute and the comparison value. */
  readonly comparator: TComparator;
  /** The value that the User Object attribute is compared to. */
  readonly comparisonValue: UserConditionComparisonValueTypeMap[TComparator];
}

export type UserConditionUnion = { [K in UserComparator]: UserCondition<K> }[UserComparator];

export class UserCondition<TComparator extends UserComparator = UserComparator> implements IUserCondition<TComparator> {
  readonly type = "UserCondition";
  readonly comparisonAttribute: string;
  readonly comparator: TComparator;
  readonly comparisonValue: UserConditionComparisonValueTypeMap[TComparator];

  constructor(json: any) {
    this.comparisonAttribute = json.a;
    this.comparator = json.c;
    this.comparisonValue = json.s ?? json.d ?? json.l;
  }
}

/** Prerequisite flag comparison operator used during the evaluation process. */
export enum PrerequisiteFlagComparator {
  /** EQUALS - It matches when the evaluated value of the specified prerequisite flag is equal to the comparison value. */
  Equals = 0,
  /** NOT EQUALS - It matches when the evaluated value of the specified prerequisite flag is not equal to the comparison value. */
  NotEquals = 1
}

/** Describes a condition that is based on a prerequisite flag. */
export interface IPrerequisiteFlagCondition extends ICondition<"PrerequisiteFlagCondition"> {
  /** The key of the prerequisite flag that the condition is based on. */
  readonly prerequisiteFlagKey: string;
  /** The operator which defines the relation between the evaluated value of the prerequisite flag and the comparison value. */
  readonly comparator: PrerequisiteFlagComparator;
  /** The value that the evaluated value of the prerequisite flag is compared to. */
  readonly comparisonValue: NonNullable<SettingValue>;
}

export class PrerequisiteFlagCondition implements IPrerequisiteFlagCondition {
  readonly type = "PrerequisiteFlagCondition";
  readonly prerequisiteFlagKey: string;
  readonly comparator: PrerequisiteFlagComparator;
  readonly comparisonValue: NonNullable<SettingValue>;

  constructor(json: any) {
    this.prerequisiteFlagKey = json.f;
    this.comparator = json.c;
    this.comparisonValue = unwrapSettingValue(json.v);
  }
}

/** Segment comparison operator used during the evaluation process. */
export enum SegmentComparator {
  /** IS IN SEGMENT - It matches when the conditions of the specified segment are evaluated to true. */
  IsIn,
  /** IS NOT IN SEGMENT - It matches when the conditions of the specified segment are evaluated to false. */
  IsNotIn,
}

/** Describes a condition that is based on a segment. */
export interface ISegmentCondition extends ICondition<"SegmentCondition"> {
  /** The segment that the condition is based on. */
  readonly segment: ISegment;
  /** The operator which defines the expected result of the evaluation of the segment. */
  readonly comparator: SegmentComparator;
}

export class SegmentCondition implements ISegmentCondition {
  readonly type = "SegmentCondition";
  readonly segment: Segment;
  readonly comparator: SegmentComparator;

  constructor(json: any, config: Config) {
    this.segment = config.segments[json.s];
    this.comparator = json.c;
  }
}

function unwrapSettingValue(json: any): NonNullable<SettingValue> {
  return json.b ?? json.s ?? json.i ?? json.d;
}
