export class ProjectConfig {
  static readonly serializationFormatVersion = "v1";

  static readonly empty = new ProjectConfig(void 0, void 0, 0, void 0);

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
    const time = new Date().getTime();
    // Remove the sub-second part as we need second precision only.
    return Math.floor(time / 1000) * 1000;
  }

  static serialize(config: ProjectConfig): string {
    return Math.floor(config.timestamp / 1000) + "\n"
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

    const fetchTime = parseInt(slice) * 1000;
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

/** ConfigCat config. */
export interface IConfig {
  /** Settings by key. */
  readonly settings: Readonly<{ [key: string]: ISetting }>;
}

export class Config implements IConfig {
  readonly settings: Readonly<{ [key: string]: Setting }>;
  readonly preferences?: Preferences;

  constructor(json: any) {
    this.settings = json.f
      ? Object.fromEntries(Object.entries(json.f).map(([key, value]) => { return [key, new Setting(value)]; }))
      : {};

    this.preferences = json.p ? new Preferences(json.p) : void 0;
  }
}

export enum RedirectMode {
  No = 0,
  Should = 1,
  Force = 2,
}

export class Preferences {
  readonly baseUrl?: string;
  readonly redirectMode?: RedirectMode;

  constructor(json: any) {
    this.baseUrl = json.u;
    this.redirectMode = json.r;
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

export type SettingValue = boolean | number | string | null | undefined;

export type VariationIdValue = string | null | undefined;

/** Feature flag or setting. */
export interface ISetting {
  /** The (fallback) value of the setting. */
  readonly value: NonNullable<SettingValue>;
  /** Setting type. */
  readonly type: SettingType;
  /** Array of percentage options. */
  readonly percentageOptions: ReadonlyArray<IPercentageOption>;
  /** Array of targeting rules. */
  readonly targetingRules: ReadonlyArray<ITargetingRule>;
  /** Variation ID. */
  readonly variationId?: NonNullable<VariationIdValue>;
}

export class Setting implements ISetting {
  readonly value: NonNullable<SettingValue>;
  readonly type: SettingType;
  readonly percentageOptions: ReadonlyArray<RolloutPercentageItem>;
  readonly targetingRules: ReadonlyArray<RolloutRule>;
  readonly variationId?: NonNullable<VariationIdValue>;

  constructor(json: any) {
    this.value = json.v;
    this.type = json.t;
    this.percentageOptions = json.p?.map((item: any) => new RolloutPercentageItem(item)) ?? [];
    this.targetingRules = json.r?.map((item: any) => new RolloutRule(item)) ?? [];
    this.variationId = json.i;
  }

  static fromValue(value: NonNullable<SettingValue>): Setting {
    return new Setting({
      t: -1, // this value is not used by the library currently and this object won't be exposed to the consumer either
      v: value,
    });
  }
}

/** Targeting rule comparison operator. */
export enum Comparator {
  /** Does the comparison value interpreted as a comma-separated list of strings contain the comparison attribute? */
  In = 0,
  /** Does the comparison value interpreted as a comma-separated list of strings not contain the comparison attribute? */
  NotIn = 1,
  /** Does the comparison value contain the comparison attribute as a substring? */
  Contains = 2,
  /** Does the comparison value not contain the comparison attribute as a substring? */
  NotContains = 3,
  /** Does the comparison value interpreted as a comma-separated list of semantic versions contain the comparison attribute? */
  SemVerIn = 4,
  /** Does the comparison value interpreted as a comma-separated list of semantic versions not contain the comparison attribute? */
  SemVerNotIn = 5,
  /** Is the comparison value interpreted as a semantic version less than the comparison attribute? */
  SemVerLessThan = 6,
  /** Is the comparison value interpreted as a semantic version less than or equal to the comparison attribute? */
  SemVerLessThanEqual = 7,
  /** Is the comparison value interpreted as a semantic version greater than the comparison attribute? */
  SemVerGreaterThan = 8,
  /** Is the comparison value interpreted as a semantic version greater than or equal to the comparison attribute? */
  SemVerGreaterThanEqual = 9,
  /** Is the comparison value interpreted as a number equal to the comparison attribute? */
  NumberEqual = 10,
  /** Is the comparison value interpreted as a number not equal to the comparison attribute? */
  NumberNotEqual = 11,
  /** Is the comparison value interpreted as a number less than the comparison attribute? */
  NumberLessThan = 12,
  /** Is the comparison value interpreted as a number less than or equal to the comparison attribute? */
  NumberLessThanEqual = 13,
  /** Is the comparison value interpreted as a number greater than the comparison attribute? */
  NumberGreaterThan = 14,
  /** Is the comparison value interpreted as a number greater than or equal to the comparison attribute? */
  NumberGreaterThanEqual = 15,
  /** Does the comparison value interpreted as a comma-separated list of hashes of strings contain the hash of the comparison attribute? */
  SensitiveOneOf = 16,
  /** Does the comparison value interpreted as a comma-separated list of hashes of strings not contain the hash of the comparison attribute? */
  SensitiveNotOneOf = 17
}

/** Targeting rule. */
export interface ITargetingRule {
  /** A numeric value which determines the order of evaluation. */
  readonly order: number;
  /** The attribute that the targeting rule is based on. Can be "User ID", "Email", "Country" or any custom attribute. */
  readonly comparisonAttribute: string;
  /** The comparison operator. Defines the connection between the attribute and the value. */
  readonly comparator: Comparator;
  /** The value that the attribute is compared to. Can be a string, a number, a semantic version or a comma-separated list, depending on the comparator. */
  readonly comparisonValue: string;
  /** The value associated with the targeting rule. */
  readonly value: NonNullable<SettingValue>;
  /** Variation ID. */
  readonly variationId?: NonNullable<VariationIdValue>;
}

export class RolloutRule implements ITargetingRule {
  readonly order: number;
  readonly comparisonAttribute: string;
  readonly comparator: Comparator;
  readonly comparisonValue: string;
  readonly value: NonNullable<SettingValue>;
  readonly variationId?: NonNullable<VariationIdValue>;

  constructor(json: any) {
    this.order = json.o;
    this.comparisonAttribute = json.a;
    this.comparator = json.t;
    this.comparisonValue = json.c;
    this.value = json.v;
    this.variationId = json.i;
  }
}

/** Percentage option. */
export interface IPercentageOption {
  /** A numeric value which determines the order of evaluation. */
  readonly order: number;
  /** A number between 0 and 100 that represents a randomly allocated fraction of the users. */
  readonly percentage: number;
  /** The value associated with the percentage option. */
  readonly value: NonNullable<SettingValue>;
  /** Variation ID. */
  readonly variationId?: NonNullable<VariationIdValue>;
}

export class RolloutPercentageItem implements IPercentageOption {
  readonly order: number;
  readonly percentage: number;
  readonly value: NonNullable<SettingValue>;
  readonly variationId?: NonNullable<VariationIdValue>;

  constructor(json: any) {
    this.order = json.o;
    this.percentage = json.p;
    this.value = json.v;
    this.variationId = json.i;
  }
}
