import type { ManualPollOptions } from "./ConfigCatClientOptions";
import type { IConfigFetcher } from "./ConfigFetcher";
import type { IConfigService, RefreshResult } from "./ConfigServiceBase";
import { ConfigServiceBase } from "./ConfigServiceBase";
import type { ProjectConfig } from "./ProjectConfig";

export class ManualPollConfigService extends ConfigServiceBase<ManualPollOptions> implements IConfigService {

  constructor(configFetcher: IConfigFetcher, options: ManualPollOptions) {

    super(configFetcher, options);

    options.hooks.emit("clientReady");
  }

  async getConfig(): Promise<ProjectConfig> {

    this.options.logger.debug("ManualPollService.getConfig() called.");
    return await this.options.cache.get(this.options.getCacheKey());
  }

  refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig]> {
    this.options.logger.debug("ManualPollService.refreshConfigAsync() called.");
    return super.refreshConfigAsync();
  }
}
