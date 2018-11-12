import { IConfigService, ConfigServiceBase, ProjectConfig } from "./ConfigServiceBase";
import { LazyLoadOptions} from "./ConfigCatClientOptions";
import { IConfigFetcher, ICache } from ".";

export class LazyLoadConfigService extends ConfigServiceBase implements IConfigService {

    private cacheTimeToLiveSeconds: number;

    constructor(configFetcher: IConfigFetcher, cache: ICache, config: LazyLoadOptions) {

        super(configFetcher, cache, config);

        this.cacheTimeToLiveSeconds = config.cacheTimeToLiveSeconds;
    }

    getConfig(callback: (value: ProjectConfig) => void): void {

        let p: ProjectConfig = this.cache.Get(this.baseConfig.apiKey);

        if (p && p.Timestamp < new Date().getTime() + (this.cacheTimeToLiveSeconds * 1000)) {
            callback(p);
        } else {
            this.refreshLogicBase(p, (newConfig) => {
                callback(newConfig);
            });
        }
    }

    refreshConfig(callback?: (value: ProjectConfig) => void): void {
        let p: ProjectConfig = this.cache.Get(this.baseConfig.apiKey);

        this.refreshLogicBase(p, (newConfig) => {
            callback(newConfig);
        });
    }
}