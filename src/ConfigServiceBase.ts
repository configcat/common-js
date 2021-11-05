import { IConfigFetcher } from "./index";
import { OptionsBase } from "./ConfigCatClientOptions";
import { ConfigFile, Preferences, ProjectConfig } from "./ProjectConfig";

export interface IConfigService {
    getConfig(): Promise<ProjectConfig | null>;

    refreshConfigAsync(): Promise<ProjectConfig | null>;
}

export abstract class ConfigServiceBase {
    protected configFetcher: IConfigFetcher;    
    protected baseConfig: OptionsBase;

    constructor(configFetcher: IConfigFetcher, baseConfig: OptionsBase) {

        this.configFetcher = configFetcher;        
        this.baseConfig = baseConfig;
    }

    protected refreshLogicBaseAsync(lastProjectConfig: ProjectConfig | null, forceUpdateCache: boolean = true): Promise<ProjectConfig | null> {

        return new Promise(resolve => {

            this.fetchLogic(this.baseConfig, lastProjectConfig, 0, async (newConfig) => {

                if (newConfig && newConfig.ConfigJSON) {
                    
                    if (forceUpdateCache || !ProjectConfig.equals(newConfig, lastProjectConfig)) {
                        await this.baseConfig.cache.set(this.baseConfig.getCacheKey(), newConfig);
                    }
                    
                    resolve(newConfig);
                }
                else {
                    resolve(lastProjectConfig);
                }
            });
        });
    }

    private fetchLogic(options: OptionsBase, lastProjectConfig: ProjectConfig | null, retries: number, callback: (newProjectConfig: ProjectConfig | null) => void): void {
        const calledBaseUrl = this.baseConfig.baseUrl;
        this.configFetcher.fetchLogic(this.baseConfig, lastProjectConfig, (newConfig) => {

            if (!newConfig || !newConfig.ConfigJSON) {
                callback(null);
                return;
            }

            const preferences = newConfig.ConfigJSON[ConfigFile.Preferences];
            if (!preferences) {

                callback(newConfig);
                return;
            }

            const baseUrl = preferences[Preferences.BaseUrl];

            // If the base_url is the same as the last called one, just return the response.
            if (!baseUrl || baseUrl == calledBaseUrl) {

                callback(newConfig);
                return;
            }

            const redirect = preferences[Preferences.Redirect];

            // If the base_url is overridden, and the redirect parameter is not 2 (force),
            // the SDK should not redirect the calls and it just have to return the response.
            if (options.baseUrlOverriden && redirect !== 2) {
                callback(newConfig);
                return;
            }

            options.baseUrl = baseUrl;

            if (redirect === 0) {

                callback(newConfig);
                return;
            }

            if (redirect === 1) {

                options.logger.warn("Your dataGovernance parameter at ConfigCatClient initialization is not in sync " +
                    "with your preferences on the ConfigCat Dashboard: " +
                    "https://app.configcat.com/organization/data-governance. " +
                    "Only Organization Admins can access this preference.");
            }

            if (retries >= 2) {
                options.logger.error("Redirect loop during config.json fetch. Please contact support@configcat.com.");
                callback(newConfig);
                return;
            }

            this.fetchLogic(options, lastProjectConfig, ++retries, callback);
            return;
        }
        );
    }
}