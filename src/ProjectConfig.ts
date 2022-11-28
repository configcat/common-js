export class ProjectConfig {
    /** Entity identifier */
    HttpETag?: string;
    /** ConfigCat config */
    ConfigJSON: any;
    /** Timestamp of last successful download (regardless of whether the config has changed or not) in milliseconds */
    Timestamp: number;

    /** Returns Timestamp as a JavaScript Date object. */
    getTimestampAsDate(): Date { return new Date(this.Timestamp); }

    constructor(timeStamp: number, jsonConfig: string | object, httpETag?: string) {
        this.Timestamp = timeStamp;
        this.ConfigJSON = typeof jsonConfig === "string" ? JSON.parse(jsonConfig) : jsonConfig;
        this.HttpETag = httpETag;
    }

    /**
     * Determines whether the specified ProjectConfig instances are considered equal.
     */
    public static equals(projectConfig1: ProjectConfig | null, projectConfig2: ProjectConfig | null): boolean {
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

    public static compareEtags(etag1?: string, etag2?: string): boolean {
        return this.ensureStrictEtag(etag1) === this.ensureStrictEtag(etag2);
    }

    private static ensureStrictEtag(etag?: string): string {
        if (!etag) {
            return '';
        }

        if (etag.length > 2 && etag.substr(0,2).toLocaleUpperCase() === "W/") {
            return etag.substring(2);
        }

        return etag;
    }

    public static isExpired(projectConfig: ProjectConfig | null, expirationMs: number): boolean {
        return !projectConfig || projectConfig.Timestamp + expirationMs < new Date().getTime();
    }
}

export class ConfigFile {
    static Preferences: string = "p";

    static FeatureFlags: string = "f";
}

export class Preferences {
    static BaseUrl: string = "u";

    static Redirect: string = "r";
}

export class Setting {
    static Value: string = "v";

    static SettingType: string = "t";

    static RolloutPercentageItems : string = "p";

    static RolloutRules: string = "r";

    static VariationId: string = "i";

    public value: any;
    public rolloutPercentageItems: RolloutPercentageItem[];
    public rolloutRules: RolloutRule[];
    public variationId: string;

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
    static Order: string = "o";

    static ComparisonAttribute: string = "a";

    static Comparator: string = "t";

    static ComparisonValue: string = "c";

    static Value: string = "v";

    static VariationId: string = "i";

    public comparisonAttribute: string;
    public comparator: number;
    public comparisonValue: string;
    public value: any;
    public variationId: string;

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
    static Order: string = "o";

    static Value: string = "v";

    static Percentage: string = "p";

    static VariationId: string = "i";

    public percentage: number;
    public value: any;
    public variationId: string;

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