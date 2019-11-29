import { IConfigService, ConfigServiceBase, ProjectConfig } from "./ConfigServiceBase";
import { LazyLoadOptions } from "./ConfigCatClientOptions";
import { IConfigFetcher, ICache } from ".";

export class LazyLoadConfigService extends ConfigServiceBase implements IConfigService {

    private cacheTimeToLiveSeconds: number;

    constructor(configFetcher: IConfigFetcher, cache: ICache, config: LazyLoadOptions) {

        super(configFetcher, cache, config);

        this.cacheTimeToLiveSeconds = config.cacheTimeToLiveSeconds;
    }

    getConfig(): Promise<ProjectConfig> {

        let p: ProjectConfig = this.cache.Get(this.baseConfig.apiKey);

        if (p && p.Timestamp + (this.cacheTimeToLiveSeconds * 1000) > new Date().getTime()) {
            return new Promise(resolve => resolve(p));
        } else {
            return this.refreshLogicBaseAsync(p);
        }
    }

    refreshConfigAsync(): Promise<ProjectConfig> {

        let p: ProjectConfig = this.cache.Get(this.baseConfig.apiKey);
        return this.refreshLogicBaseAsync(p)
    }
}
