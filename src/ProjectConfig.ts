export class ProjectConfig {
  static readonly serializationFormatVersion = "v1";

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

    let config: object | undefined;
    let configJson: string | undefined;
    if (slice.length > 0) {
      try {
        config = JSON.parse(slice);
      }
      catch {
        throw new Error("Invalid config JSON content: " + slice);
      }
      configJson = slice;
    }

    return new ProjectConfig(configJson, config, fetchTime, httpETag);
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
