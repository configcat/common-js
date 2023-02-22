// NOTE: No instance methods should be added to this class!
// Flawed ICache implementations may erase the prototype information (when serialization is involved),
// which would lead to "... is not a function" errors in the case of instance methods.
// (As a matter of fact, this type should have been defined as an interface to prevent such complications but
// we can't really change this any more because this would be a too dangerous breaking change at this point.)
export class ProjectConfig {
  /* eslint-disable @typescript-eslint/naming-convention */

  /** Entity identifier */
  HttpETag?: string;
  /** ConfigCat config */
  ConfigJSON: any;
  /** Timestamp of last successful download (regardless of whether the config has changed or not) in milliseconds */
  Timestamp: number;

  /* eslint-enable @typescript-eslint/naming-convention */

  constructor(timeStamp: number, jsonConfig: string | object, httpETag?: string) {
    this.Timestamp = timeStamp;
    this.ConfigJSON = typeof jsonConfig === "string" ? JSON.parse(jsonConfig) : jsonConfig;
    this.HttpETag = httpETag;
  }

  /**
   * Determines whether the specified ProjectConfig instances are considered equal.
   */
  static equals(projectConfig1: ProjectConfig | null, projectConfig2: ProjectConfig | null): boolean {
    if (!projectConfig1) {
      // If both configs are null, we consider them equal.
      return !projectConfig2;
    }

    if (!projectConfig2) {
      return false;
    }

    // When both ETags are available, we don't need to check the JSON content
    // (because of how HTTP ETags work - see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag).
    return !!projectConfig1.HttpETag && !!projectConfig2.HttpETag
      ? this.compareEtags(projectConfig1.HttpETag, projectConfig2.HttpETag)
      : JSON.stringify(projectConfig1.ConfigJSON) === JSON.stringify(projectConfig2.ConfigJSON);
  }

  static compareEtags(etag1?: string, etag2?: string): boolean {
    return this.ensureStrictEtag(etag1) === this.ensureStrictEtag(etag2);
  }

  private static ensureStrictEtag(etag?: string): string {
    if (!etag) {
      return "";
    }

    if (etag.length > 2 && etag.substr(0, 2).toLocaleUpperCase() === "W/") {
      return etag.substring(2);
    }

    return etag;
  }

  static isExpired(projectConfig: ProjectConfig | null, expirationMs: number): boolean {
    return !projectConfig || projectConfig.Timestamp + expirationMs < new Date().getTime();
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
