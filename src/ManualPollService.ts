import { IConfigService, ProjectConfig, ConfigServiceBase } from "./ProjectConfigService";
import { ManualPollOptions } from "./ConfigCatClientOptions";
import { IConfigFetcher, ICache } from ".";

export class ManualPollService extends ConfigServiceBase implements IConfigService {

    public constructor(configFetcher: IConfigFetcher, cache: ICache, config: ManualPollOptions) {

        super(configFetcher, cache, config);
    }

    getConfig(callback: (value: ProjectConfig) => void): void {

        callback(this.cache.Get());
    }
    refreshConfig(callback?: (value: ProjectConfig) => void): void {

        this.refreshLogicBase(this.cache.Get(), (newConfig) => {
            if (callback) {
                callback(newConfig);
            }
        });
    }
}