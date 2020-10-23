import { IConfigService, ConfigServiceBase } from "./ConfigServiceBase";
import { ManualPollOptions } from "./ConfigCatClientOptions";
import { IConfigFetcher } from "./index";
import { ProjectConfig } from "./ProjectConfig";

export class ManualPollService extends ConfigServiceBase implements IConfigService {

    public constructor(configFetcher: IConfigFetcher, config: ManualPollOptions) {

        super(configFetcher, config);
    }

    getConfig(): Promise<ProjectConfig> {

        return new Promise(resolve => resolve(this.baseConfig.cache.get(this.baseConfig.getCacheKey())));
    }

    refreshConfigAsync(): Promise<ProjectConfig> {

        let p: ProjectConfig = this.baseConfig.cache.get(this.baseConfig.getCacheKey());
        return this.refreshLogicBaseAsync(p)
    }
}