export class ProjectConfig {
  static readonly empty = new ProjectConfig(void 0, void 0, 0, void 0);

  constructor(
    readonly configJson: string | undefined,
    readonly config: object | undefined,
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
    // TODO: use standardized format
    return JSON.stringify(config);
  }

  static deserialize(value: string): ProjectConfig {
    // TODO: use standardized format
    const config = JSON.parse(value);
    (Object.setPrototypeOf || ((o, proto) => o["__proto__"] = proto))(config, ProjectConfig.prototype);
    return config;
  }
}

export class ConfigFile {
  /* eslint-disable @typescript-eslint/naming-convention */
  static Preferences = "p";

  static FeatureFlags = "f";
  /* eslint-enable @typescript-eslint/naming-convention */
}

export class Preferences {
  /* eslint-disable @typescript-eslint/naming-convention */
  static BaseUrl = "u";

  static Redirect = "r";
  /* eslint-enable @typescript-eslint/naming-convention */
}

export class Setting {
  /* eslint-disable @typescript-eslint/naming-convention */
  static Value = "v";

  static SettingType = "t";

  static RolloutPercentageItems = "p";

  static RolloutRules = "r";

  static VariationId = "i";
  /* eslint-enable @typescript-eslint/naming-convention */

  value: any;
  rolloutPercentageItems: RolloutPercentageItem[];
  rolloutRules: RolloutRule[];
  variationId: string;

  constructor(value: any, rolloutPercentageItems: RolloutPercentageItem[], rolloutRules: RolloutRule[], variationId: string) {
    this.value = value;
    this.rolloutPercentageItems = rolloutPercentageItems;
    this.rolloutRules = rolloutRules;
    this.variationId = variationId;
  }

  static fromJson(json: any): Setting {
    return new Setting(
      json[this.Value],
      json[this.RolloutPercentageItems]?.map((item: any) => RolloutPercentageItem.fromJson(item)) ?? [],
      json[this.RolloutRules]?.map((item: any) => RolloutRule.fromJson(item)) ?? [],
      json[this.VariationId]);
  }
}

export class RolloutRule {
  /* eslint-disable @typescript-eslint/naming-convention */
  static Order = "o";

  static ComparisonAttribute = "a";

  static Comparator = "t";

  static ComparisonValue = "c";

  static Value = "v";

  static VariationId = "i";
  /* eslint-enable @typescript-eslint/naming-convention */

  comparisonAttribute: string;
  comparator: number;
  comparisonValue: string;
  value: any;
  variationId: string;

  constructor(comparisonAttribute: string, comparator: number, comparisonValue: string, value: any, variationId: string) {
    this.comparisonAttribute = comparisonAttribute;
    this.comparator = comparator;
    this.comparisonValue = comparisonValue;
    this.value = value;
    this.variationId = variationId;
  }

  static fromJson(json: any): RolloutRule {
    return new RolloutRule(
      json[this.ComparisonAttribute],
      json[this.Comparator],
      json[this.ComparisonValue],
      json[this.Value],
      json[this.VariationId]);
  }
}

export class RolloutPercentageItem {
  /* eslint-disable @typescript-eslint/naming-convention */
  static Order = "o";

  static Value = "v";

  static Percentage = "p";

  static VariationId = "i";
  /* eslint-enable @typescript-eslint/naming-convention */

  percentage: number;
  value: any;
  variationId: string;

  constructor(percentage: number, value: any, variationId: string) {
    this.percentage = percentage;
    this.value = value;
    this.variationId = variationId;
  }

  static fromJson(json: any): RolloutPercentageItem {
    return new RolloutPercentageItem(json[this.Percentage],
      json[this.Value],
      json[this.VariationId]);
  }
}
