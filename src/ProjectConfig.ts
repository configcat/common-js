import type * as ConfigJson from "./ConfigJson";
import type { PrerequisiteFlagComparator, RedirectMode, SegmentComparator, SettingType, UserComparator } from "./ConfigJson";
import type { WellKnownUserObjectAttribute } from "./User";

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
      config = Config.deserialize(slice);
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
  static deserialize(configJson: string): Config {
    const configJsonParsed = JSON.parse(configJson);
    if (typeof configJsonParsed !== "object" || !configJsonParsed) {
      throw new Error("Invalid config JSON content:" + configJson);
    }
    return new Config(configJsonParsed);
  }

  readonly preferences: Preferences | undefined;
  readonly segments: ReadonlyArray<Segment>;
  readonly settings: Readonly<{ [key: string]: SettingUnion }>;

  constructor(json: Partial<ConfigJson.Config>) {
    this.preferences = json.p != null ? new Preferences(json.p) : void 0;
    this.segments = json.s?.map(item => new Segment(item)) ?? [];
    this.settings = json.f != null
      ? Object.fromEntries(Object.entries(json.f).map(([key, value]) => [key, new Setting(value, this) as SettingUnion]))
      : {};
  }

  get salt(): string | undefined { return this.preferences?.salt; }
}

export class Preferences {
  readonly baseUrl: string | undefined;
  readonly redirectMode: RedirectMode | undefined;
  readonly salt: string | undefined;

  constructor(json: ConfigJson.Preferences) {
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

  constructor(json: ConfigJson.Segment) {
    this.name = json.n;
    this.conditions = json.r?.map(item => new UserCondition(item) as UserConditionUnion) ?? [];
  }
}

export type SettingTypeMap = {
  [SettingType.Boolean]: boolean;
  [SettingType.String]: string;
  [SettingType.Int]: number;
  [SettingType.Double]: number;
};

export type SettingValue = SettingTypeMap[SettingType] | null | undefined;

export type VariationIdValue = string | null | undefined;

/** A model object which contains a setting value along with related data. */
export interface ISettingValueContainer<TSetting extends SettingType = SettingType> {
  /** Setting value. */
  readonly value: SettingTypeMap[TSetting];
  /** Variation ID. */
  readonly variationId?: NonNullable<VariationIdValue>;
}

export class SettingValueContainer<TSetting extends SettingType = SettingType> implements ISettingValueContainer<TSetting> {
  readonly value: SettingTypeMap[TSetting]; // can also store an unsupported value of any type for internal use, however such values should never be exposed to the user!
  readonly variationId?: NonNullable<VariationIdValue>;

  constructor(json: ConfigJson.ServedValue, hasUnwrappedValue = false) {
    this.value = (!hasUnwrappedValue ? unwrapSettingValue(json.v) : json.v) as SettingTypeMap[TSetting];
    this.variationId = json.i;
  }
}

// NOTE: The TS compiler can't do type narrowing on constrained generic type parameters (see https://stackoverflow.com/a/68898908/8656352).
// So, to make type narrowing work, we derive a discriminated union type containing all the possible substitutions of the type parameter
// (see also https://github.com/Microsoft/TypeScript/issues/27272#issuecomment-423630799).
export type ISettingUnion = { [K in SettingType]: ISetting<K> }[SettingType];

/** Feature flag or setting. */
export interface ISetting<TSetting extends SettingType = SettingType> extends ISettingValueContainer<TSetting> {
  /** Setting type. */
  readonly type: TSetting;
  /** The User Object attribute which serves as the basis of percentage options evaluation. */
  readonly percentageOptionsAttribute: string;
  /** The array of targeting rules (where there is a logical OR relation between the items). */
  readonly targetingRules: ReadonlyArray<ITargetingRule<TSetting>>;
  /** The array of percentage options. */
  readonly percentageOptions: ReadonlyArray<IPercentageOption<TSetting>>;
}

export type SettingUnion = { [K in SettingType]: Setting<K> }[SettingType];

export class Setting<TSetting extends SettingType = SettingType> extends SettingValueContainer<TSetting> implements ISetting<TSetting> {
  readonly type: TSetting;
  readonly percentageOptionsAttribute: string;
  readonly targetingRules: ReadonlyArray<TargetingRule<TSetting>>;
  readonly percentageOptions: ReadonlyArray<PercentageOption<TSetting>>;
  readonly configJsonSalt: string;

  constructor(json: ConfigJson.Setting<TSetting>, config?: Config) {
    super(json, json.t < 0);
    this.type = json.t;
    const identifierAttribute: WellKnownUserObjectAttribute = "Identifier";
    this.percentageOptionsAttribute = json.a ?? identifierAttribute;
    this.targetingRules = json.r?.map(item => new TargetingRule<TSetting>(item, config!)) ?? [];
    this.percentageOptions = json.p?.map(item => new PercentageOption<TSetting>(item)) ?? [];
    this.configJsonSalt = config?.salt ?? "";
  }

  static fromValue(value: NonNullable<SettingValue>): Setting {
    return new Setting({
      t: -1, // this is not a defined SettingType value, we only use it internally (will never expose it to the consumer)
      v: value,
    } as unknown as ConfigJson.Setting);
  }
}

/** Describes a targeting rule. */
export interface ITargetingRule<TSetting extends SettingType = SettingType> {
  /** The array of conditions that are combined with the AND logical operator. (The IF part of the targeting rule.) */
  readonly conditions: ReadonlyArray<IConditionUnion>;
  /** The simple value or the array of percentage options associated with the targeting rule. (The THEN part of the targeting rule.) */
  readonly then: ISettingValueContainer<TSetting> | ReadonlyArray<IPercentageOption<TSetting>>;
}

export class TargetingRule<TSetting extends SettingType = SettingType> implements ITargetingRule<TSetting> {
  readonly conditions: ReadonlyArray<ConditionUnion>;
  readonly then: SettingValueContainer<TSetting> | ReadonlyArray<PercentageOption<TSetting>>;

  constructor(json: ConfigJson.TargetingRule<TSetting>, config: Config) {
    this.conditions = json.c?.map(item =>
      item.u != null ? new UserCondition(item.u) as UserConditionUnion :
      item.p != null ? new PrerequisiteFlagCondition(item.p) :
      item.s != null ? new SegmentCondition(item.s, config) :
      void 0 as unknown as ConditionUnion) ?? [];
    this.then = json.p != null
      ? json.p.map(item => new PercentageOption<TSetting>(item))
      : new SettingValueContainer<TSetting>(json.s);
  }
}

/** Represents a percentage option. */
export interface IPercentageOption<TSetting extends SettingType = SettingType> extends ISettingValueContainer<TSetting> {
  /** A number between 0 and 100 that represents a randomly allocated fraction of the users. */
  readonly percentage: number;
}

export class PercentageOption<TSetting extends SettingType = SettingType> extends SettingValueContainer<TSetting> implements IPercentageOption<TSetting> {
  readonly percentage: number;

  constructor(json: ConfigJson.PercentageOption<TSetting>) {
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
export interface ICondition<TCondition extends keyof ConditionTypeMap = keyof ConditionTypeMap> {
  /** The type of the condition. */
  readonly type: TCondition;
}

export type ConditionUnion = UserConditionUnion | PrerequisiteFlagCondition | SegmentCondition;

export type UserConditionComparisonValueTypeMap = {
  [UserComparator.TextIsOneOf]: Readonly<string[]>;
  [UserComparator.TextIsNotOneOf]: Readonly<string[]>;
  [UserComparator.TextContainsAnyOf]: Readonly<string[]>;
  [UserComparator.TextNotContainsAnyOf]: Readonly<string[]>;
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
  [UserComparator.SensitiveTextIsOneOf]: Readonly<string[]>;
  [UserComparator.SensitiveTextIsNotOneOf]: Readonly<string[]>;
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

  constructor(json: ConfigJson.UserCondition<TComparator>) {
    this.comparisonAttribute = json.a;
    this.comparator = json.c;
    this.comparisonValue = (json.s ?? json.d ?? json.l) as UserConditionComparisonValueTypeMap[TComparator];
  }
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

  constructor(json: ConfigJson.PrerequisiteFlagCondition) {
    this.prerequisiteFlagKey = json.f;
    this.comparator = json.c;
    this.comparisonValue = unwrapSettingValue(json.v);
  }
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

  constructor(json: ConfigJson.SegmentCondition, config: Config) {
    this.segment = config.segments[json.s];
    this.comparator = json.c;
  }
}

function unwrapSettingValue(json: ConfigJson.SettingValue): NonNullable<SettingValue> {
  return (json.b ?? json.s ?? json.i ?? json.d)!;
}
