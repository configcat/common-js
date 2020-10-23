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

    getConfig(): Promise<ProjectConfig> {

        let p: ProjectConfig = this.baseConfig.cache.get(this.baseConfig.getCacheKey());

        if (p && p.Timestamp + (this.cacheTimeToLiveSeconds * 1000) > new Date().getTime()) {
            return new Promise(resolve => resolve(p));
        } else {
            return this.refreshLogicBaseAsync(p);
        }
    }

    refreshConfigAsync(): Promise<ProjectConfig> {

        let p: ProjectConfig = this.baseConfig.cache.get(this.baseConfig.getCacheKey());
        return this.refreshLogicBaseAsync(p)
    }
}
