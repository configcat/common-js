import { ManualPollOptions } from "./ConfigCatClientOptions";
import type { IConfigFetcher } from "./ConfigFetcher";
import { ConfigServiceBase, IConfigService, RefreshResult } from "./ConfigServiceBase";
import { ProjectConfig } from "./ProjectConfig";

export class ManualPollConfigService extends ConfigServiceBase<ManualPollOptions> implements IConfigService {

  constructor(configFetcher: IConfigFetcher, options: ManualPollOptions) {

    super(configFetcher, options);

    options.hooks.emit("clientReady");
  }

  async getConfig(): Promise<ProjectConfig | null> {

    this.options.logger.debug("ManualPollService.getConfig() called.");
    return await this.options.cache.get(this.options.getCacheKey());
  }

  async refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig | null]> {
    this.options.logger.debug("ManualPollService.refreshConfigAsync() called.");
    return super.refreshConfigAsync();
  }
}
