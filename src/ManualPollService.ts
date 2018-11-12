import { IConfigService, ProjectConfig, ConfigServiceBase } from "./ConfigServiceBase";
import { ManualPollOptions } from "./ConfigCatClientOptions";
import { IConfigFetcher, ICache } from ".";

export class ManualPollService extends ConfigServiceBase implements IConfigService {

    public constructor(configFetcher: IConfigFetcher, cache: ICache, config: ManualPollOptions) {

        super(configFetcher, cache, config);
    }

    getConfig(callback: (value: ProjectConfig) => void): void {

        callback(this.cache.Get(this.baseConfig.apiKey));
    }
    
    refreshConfig(callback?: (value: ProjectConfig) => void): void {

        this.refreshLogicBase(this.cache.Get(this.baseConfig.apiKey), (newConfig) => {
            if (callback) {
                callback(newConfig);
            }
        });
    }
}