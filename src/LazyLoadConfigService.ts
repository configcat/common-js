import { IConfigService, ConfigServiceBase} from "./ConfigServiceBase";
import { LazyLoadOptions} from "./ConfigCatClientOptions";
import { IConfigFetcher } from "./index";
import { ProjectConfig } from "./ProjectConfig";

export class LazyLoadConfigService extends ConfigServiceBase implements IConfigService {

    private cacheTimeToLiveSeconds: number;

    constructor(configFetcher: IConfigFetcher, config: LazyLoadOptions) {

        super(configFetcher, config);

        this.cacheTimeToLiveSeconds = config.cacheTimeToLiveSeconds;
    }

    async getConfig(): Promise<ProjectConfig | null> {
        this.baseConfig.logger.debug("LazyLoadConfigService.getConfig() called.");
        let p = await this.baseConfig.cache.get(this.baseConfig.getCacheKey());

        if (p && p.Timestamp + (this.cacheTimeToLiveSeconds * 1000) > new Date().getTime()) {
            this.baseConfig.logger.debug("LazyLoadConfigService.getConfig(): cache is valid, returning from cache.");
            return p;
        } else {
            this.baseConfig.logger.debug("LazyLoadConfigService.getConfig(): cache is empty or expired, calling refreshLogicBaseAsync().");
            return this.refreshLogicBaseAsync(p);
        }
    }

    async refreshConfigAsync(): Promise<ProjectConfig | null> {
        this.baseConfig.logger.debug("LazyLoadConfigService.refreshConfigAsync() called.");
        let p = await this.baseConfig.cache.get(this.baseConfig.getCacheKey());
        return this.refreshLogicBaseAsync(p)
    }
}
