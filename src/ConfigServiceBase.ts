import { IConfigFetcher, ICache} from "./index";
import { OptionsBase } from "./ConfigCatClientOptions";
import { ProjectConfig } from "./ProjectConfig";

export interface IConfigService {
    getConfig() : Promise<ProjectConfig>;

    refreshConfigAsync(): Promise<ProjectConfig>;
}

export abstract class ConfigServiceBase {
    protected configFetcher: IConfigFetcher;
    protected cache: ICache;
    protected baseConfig: OptionsBase;

    constructor(configFetcher: IConfigFetcher, cache: ICache, baseConfig: OptionsBase) {

        this.configFetcher = configFetcher;
        this.cache = cache;
        this.baseConfig = baseConfig;
    }

    protected refreshLogicBaseAsync(lastProjectConfig: ProjectConfig): Promise<ProjectConfig> {

        return new Promise(resolve => {

            this.configFetcher.fetchLogic(this.baseConfig, lastProjectConfig, (newConfig) => {

                if (newConfig) {

                    this.cache.Set(this.baseConfig.apiKey, newConfig);

                    resolve(newConfig);
                }
                else {

                    resolve(lastProjectConfig);
                }
            });
        });
    }
}