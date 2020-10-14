export class ProjectConfig {
    /** Entity identifier */
    HttpETag: string;
    /** ConfigCat config */
    ConfigJSON: any;
    /** Timestamp in milliseconds */
    Timestamp: number;

    constructor(timeStamp: number, jsonConfig: string, httpETag: string) {
        this.Timestamp = timeStamp;
        this.ConfigJSON = JSON.parse(jsonConfig);
        this.HttpETag = httpETag;
    }

    public Equals(projectConfig: ProjectConfig): boolean {
        if (!projectConfig) return false;

        return (this.EnsureStrictEtag(projectConfig.HttpETag) === this.EnsureStrictEtag(this.HttpETag));
    }

    private EnsureStrictEtag(etag: string): string {
        if (etag.length > 2 && etag.substr(0,2).toLocaleUpperCase() === "W/"){
            return etag.substring(2);
        }

        return etag;
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

export class Setting{
    static Value: string = "v";

    static SettingType: string = "t";

    static RolloutPercentageItems : string = "p";

    static RolloutRules: string = "r";

    static VariationId: string = "i";
}

export class RolloutRules{
    static Order: string = "o";

    static ComparisonAttribute: string = "a";

    static Comparator: string = "t";

    static ComparisonValue: string = "c";

    static Value: string = "v";

    static VariationId: string = "i";
}

export class RolloutPercentageItems{
    static Order: string = "o";

    static Value: string = "v";

    static Percentage: string = "p";

    static VariationId: string = "i";
}