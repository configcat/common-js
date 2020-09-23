import { IConfigService, ConfigServiceBase } from "./ConfigServiceBase";
import { ManualPollOptions } from "./ConfigCatClientOptions";
import { IConfigFetcher, ICache } from "./index";
import { ProjectConfig } from "./ProjectConfig";

export class ManualPollService extends ConfigServiceBase implements IConfigService {

    public constructor(configFetcher: IConfigFetcher, cache: ICache, config: ManualPollOptions) {

        super(configFetcher, cache, config);
    }

    getConfig(): Promise<ProjectConfig> {

        return new Promise(resolve => resolve(this.cache.get(this.baseConfig.getCacheKey())));
    }

    refreshConfigAsync(): Promise<ProjectConfig> {

        let p: ProjectConfig = this.cache.get(this.baseConfig.getCacheKey());
        return this.refreshLogicBaseAsync(p)
    }
}