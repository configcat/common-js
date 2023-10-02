import type { LazyLoadOptions } from "./ConfigCatClientOptions";
import type { LoggerWrapper } from "./ConfigCatLogger";
import type { IConfigFetcher } from "./ConfigFetcher";
import type { IConfigService, RefreshResult } from "./ConfigServiceBase";
import { ConfigServiceBase } from "./ConfigServiceBase";
import { ClientReadyState } from "./Hooks";
import type { ProjectConfig } from "./ProjectConfig";

export class LazyLoadConfigService extends ConfigServiceBase<LazyLoadOptions> implements IConfigService {

  private readonly cacheTimeToLiveMs: number;

  constructor(configFetcher: IConfigFetcher, options: LazyLoadOptions) {

    super(configFetcher, options);

    this.cacheTimeToLiveMs = options.cacheTimeToLiveSeconds * 1000;
    super.syncUpWithCache();
  }

  async getConfig(): Promise<ProjectConfig> {
    this.options.logger.debug("LazyLoadConfigService.getConfig() called.");

    function logExpired(logger: LoggerWrapper, appendix = "") {
      logger.debug(`LazyLoadConfigService.getConfig(): cache is empty or expired${appendix}.`);
    }

    let cachedConfig = await this.options.cache.get(this.cacheKey);

    if (cachedConfig.isExpired(this.cacheTimeToLiveMs)) {
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

  getCacheState(cachedConfig: ProjectConfig): ClientReadyState {
    if (cachedConfig.isEmpty) {
      return ClientReadyState.NoFlagData;
    }

    if (cachedConfig.isExpired(this.cacheTimeToLiveMs)) {
      return ClientReadyState.HasCachedFlagDataOnly;
    }

    return ClientReadyState.HasUpToDateFlagData;
  }
}
