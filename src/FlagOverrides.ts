import { Setting } from "./ProjectConfig";

/**
 * Describes how the overrides should behave.
 */
export enum OverrideBehaviour {
    /**
     * When evaluating values, the SDK will not use feature flags and settings from the ConfigCat CDN, but it will use
     * all feature flags and settings that are loaded from local-override sources.
     */
    LocalOnly = 0,
    /**
     * When evaluating values, the SDK will use all feature flags and settings that are downloaded from the ConfigCat CDN,
     * plus all feature flags and settings that are loaded from local-override sources. If a feature flag or a setting is
     * defined both in the fetched and the local-override source then the local-override version will take precedence.
     */
    LocalOverRemote = 1,
    /**
     * When evaluating values, the SDK will use all feature flags and settings that are downloaded from the ConfigCat CDN,
     * plus all feature flags and settings that are loaded from local-override sources. If a feature flag or a setting is
     * defined both in the fetched and the local-override source then the fetched version will take precedence.
     */
    RemoteOverLocal = 2,
}

/**
 * Describes feature flag and setting override data source.
 */
export interface IOverrideDataSource {
    getOverrides(): Promise<{ [name: string]: Setting }>;
}

export class MapOverrideDataSource implements IOverrideDataSource {
    private map: { [name: string]: Setting } = {};

    constructor(map: { [name: string]: any }) {
        this.map = Object.fromEntries(Object.entries(map).map(([key, value]) => { 
            return [key, { 
                value: value,
                variationId: "",
                rolloutRules: [],
                rolloutPercentageItems: []
             }];
          }));
    }

    getOverrides(): Promise<{ [name: string]: Setting }> {
        return Promise.resolve(this.map);
    }    
}

/**
 * Describes feature flag and setting overrides.
 */
export class FlagOverrides {
    public behaviour: OverrideBehaviour;
    public dataSource: IOverrideDataSource;

    constructor(dataSource: IOverrideDataSource, behaviour: OverrideBehaviour) {
        this.dataSource = dataSource;
        this.behaviour = behaviour;
    }
}