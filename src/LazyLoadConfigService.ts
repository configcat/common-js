import { IConfigService, ConfigServiceBase} from "./ConfigServiceBase";
import { LazyLoadOptions} from "./ConfigCatClientOptions";
import { IConfigCatLogger, IConfigFetcher } from "./index";
import { ProjectConfig } from "./ProjectConfig";

export class LazyLoadConfigService extends ConfigServiceBase<LazyLoadOptions> implements IConfigService {

    private cacheTimeToLiveSeconds: number;

    constructor(configFetcher: IConfigFetcher, options: LazyLoadOptions) {

        super(configFetcher, options);

        this.cacheTimeToLiveSeconds = options.cacheTimeToLiveSeconds;
    }

    async getConfig(): Promise<ProjectConfig | null> {
        this.options.logger.debug("LazyLoadConfigService.getConfig() called.");

        function logExpired(logger: IConfigCatLogger, appendix: string = "") {
            logger.debug(`LazyLoadConfigService.getConfig(): cache is empty or expired${appendix}.`);
        }

        const config = await this.options.cache.get(this.options.getCacheKey());

        if (ProjectConfig.isExpired(config, this.cacheTimeToLiveSeconds * 1000)) {
            if (!this.isOffline) {
                logExpired(this.options.logger, ", calling refreshConfigCoreAsync()");
                return await this.refreshConfigCoreAsync(config);
            }
            else {
                logExpired(this.options.logger);
                return config;
            }
        }

        this.options.logger.debug("LazyLoadConfigService.getConfig(): cache is valid, returning from cache.");
        return config;
    }

    async refreshConfigAsync(): Promise<ProjectConfig | null> {
        this.options.logger.debug("LazyLoadConfigService.refreshConfigAsync() called.");
        return super.refreshConfigAsync();
    }
}
