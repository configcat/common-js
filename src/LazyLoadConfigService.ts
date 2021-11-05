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

        let p = await this.baseConfig.cache.get(this.baseConfig.getCacheKey());

        if (p && p.Timestamp + (this.cacheTimeToLiveSeconds * 1000) > new Date().getTime()) {
            return p;
        } else {
            return this.refreshLogicBaseAsync(p);
        }
    }

    async refreshConfigAsync(): Promise<ProjectConfig | null> {

        let p = await this.baseConfig.cache.get(this.baseConfig.getCacheKey());
        return this.refreshLogicBaseAsync(p)
    }
}
