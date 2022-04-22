import { FetchResult, FetchStatus, IConfigFetcher } from "./index";
import { OptionsBase } from "./ConfigCatClientOptions";
import { ConfigFile, Preferences, ProjectConfig } from "./ProjectConfig";

export interface IConfigService {
    getConfig(): Promise<ProjectConfig | null>;

    refreshConfigAsync(): Promise<ProjectConfig | null>;
}

export abstract class ConfigServiceBase {
    protected configFetcher: IConfigFetcher;
    protected baseConfig: OptionsBase;

    private fetchLogicCallbacks: ((result: FetchResult) => void)[] = [];

    constructor(configFetcher: IConfigFetcher, baseConfig: OptionsBase) {

        this.configFetcher = configFetcher;
        this.baseConfig = baseConfig;
    }

    protected refreshLogicBaseAsync(lastProjectConfig: ProjectConfig | null, forceUpdateCache: boolean = true): Promise<ProjectConfig | null> {
        return new Promise(resolve => {
            this.fetchLogic(this.baseConfig, lastProjectConfig?.HttpETag ?? null, 0, async (newConfig) => {
                if (newConfig && newConfig.ConfigJSON) {
                    await this.baseConfig.cache.set(this.baseConfig.getCacheKey(), newConfig);
                    resolve(newConfig);
                }
                else if (forceUpdateCache && lastProjectConfig && lastProjectConfig.ConfigJSON) {
                    await this.baseConfig.cache.set(this.baseConfig.getCacheKey(), lastProjectConfig);
                    resolve(lastProjectConfig);
                }
                else {
                    resolve(lastProjectConfig);
                }
            });
        });
    }

    private fetchLogic(options: OptionsBase, lastEtag: string | null, retries: number, callback: (newProjectConfig: ProjectConfig | null) => void): void {
        const calledBaseUrl = this.baseConfig.baseUrl;
        this.fetchLogicInternal(this.baseConfig, lastEtag, retries, (result) => {
            if (result.status != FetchStatus.Fetched || ProjectConfig.compareEtags(lastEtag ?? '', result.eTag)) {
                callback(null);
                return;
            }

            const newConfig = new ProjectConfig(new Date().getTime(), result.responseBody, result.eTag);
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

            this.fetchLogic(options, lastEtag, ++retries, callback);
            return;
        });
    }

    private fetchLogicInternal(options: OptionsBase, lastEtag: string | null, retries: number, callback: (result: FetchResult) => void): void {
        if (retries === 0) { // Only lock on the top-level calls, not on the recursive calls (config.json redirections).
            this.fetchLogicCallbacks.push(callback);
            if (this.fetchLogicCallbacks.length > 1) {
                // The first fetchLogic call is already in progress.
                return;
            }
            this.configFetcher.fetchLogic(options, lastEtag, newProjectConfig => {
                while (this.fetchLogicCallbacks.length) {
                    const thisCallback = this.fetchLogicCallbacks.pop();
                    if (thisCallback) {
                        thisCallback(newProjectConfig);
                    }
                }
            });
        } else {
            // Recursive calls should call the fetchLogic as is.
            this.configFetcher.fetchLogic(options, lastEtag, callback);
        }
    }
}