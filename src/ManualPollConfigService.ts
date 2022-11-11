import { IConfigService, ConfigServiceBase } from "./ConfigServiceBase";
import { ManualPollOptions } from "./ConfigCatClientOptions";
import { IConfigFetcher } from "./index";
import { ProjectConfig } from "./ProjectConfig";

export class ManualPollConfigService extends ConfigServiceBase<ManualPollOptions> implements IConfigService {

    constructor(configFetcher: IConfigFetcher, options: ManualPollOptions) {

        super(configFetcher, options);
    }

    async getConfig(): Promise<ProjectConfig | null> {

        this.options.logger.debug("ManualPollService.getConfig() called.");
        return await this.options.cache.get(this.options.getCacheKey());
    }

    async refreshConfigAsync(): Promise<ProjectConfig | null> {
        this.options.logger.debug("ManualPollService.refreshConfigAsync() called.");
        return super.refreshConfigAsync();
    }
}