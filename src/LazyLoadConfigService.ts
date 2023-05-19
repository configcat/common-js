import type { LazyLoadOptions } from "./ConfigCatClientOptions";
import type { LoggerWrapper } from "./ConfigCatLogger";
import type { IConfigFetcher } from "./ConfigFetcher";
import type { IConfigService, RefreshResult } from "./ConfigServiceBase";
import { ConfigServiceBase } from "./ConfigServiceBase";
import { ProjectConfig } from "./ProjectConfig";

export class LazyLoadConfigService extends ConfigServiceBase<LazyLoadOptions> implements IConfigService {

  private readonly cacheTimeToLiveSeconds: number;

  constructor(configFetcher: IConfigFetcher, options: LazyLoadOptions) {

    super(configFetcher, options);

    this.cacheTimeToLiveSeconds = options.cacheTimeToLiveSeconds;

    options.hooks.emit("clientReady");
  }

  async getConfig(): Promise<ProjectConfig> {
    this.options.logger.debug("LazyLoadConfigService.getConfig() called.");

    function logExpired(logger: LoggerWrapper, appendix = "") {
      logger.debug(`LazyLoadConfigService.getConfig(): cache is empty or expired${appendix}.`);
    }

    let cachedConfig = await this.options.cache.get(this.cacheKey);

    if (cachedConfig.isExpired(this.cacheTimeToLiveSeconds * 1000)) {
      if (!this.isOffline) {
        logExpired(this.options.logger, ", calling refreshConfigCoreAsync()");
        [, cachedConfig] = await this.refreshConfigCoreAsync(cachedConfig);
      }
      else {
        logExpired(this.options.logger);
      }
      return cachedConfig;
    }

    this.options.logger.debug("LazyLoadConfigService.getConfig(): cache is valid, returning from cache.");
    return cachedConfig;
  }

  refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig]> {
    this.options.logger.debug("LazyLoadConfigService.refreshConfigAsync() called.");
    return super.refreshConfigAsync();
  }
}
