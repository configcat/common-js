import { FetchResult, FetchStatus, IConfigFetcher } from "./index";
import { OptionsBase } from "./ConfigCatClientOptions";
import { ConfigFile, Preferences, ProjectConfig } from "./ProjectConfig";

export interface IConfigService {
    getConfig(): Promise<ProjectConfig | null>;

    refreshConfigAsync(): Promise<ProjectConfig | null>;

    get isOffline(): boolean;

    setOnline(): void;

    setOffline(): void;

    dispose(): void;
}

enum ConfigServiceStatus {
    Online,
    Offline,
    Disposed,
}

export abstract class ConfigServiceBase<TOptions extends OptionsBase> {
    protected configFetcher: IConfigFetcher;
    protected options: TOptions;
    private status: ConfigServiceStatus;

    private fetchLogicCallbacks: ((result: FetchResult) => void)[] = [];

    constructor(configFetcher: IConfigFetcher, options: TOptions) {

        this.configFetcher = configFetcher;
        this.options = options;
        this.status = options.offline ? ConfigServiceStatus.Offline : ConfigServiceStatus.Online;
    }

    dispose(): void {
        this.status = ConfigServiceStatus.Disposed;
    }

    protected get disposed() { return this.status === ConfigServiceStatus.Disposed; }

    abstract getConfig(): Promise<ProjectConfig | null>;

    async refreshConfigAsync(): Promise<ProjectConfig | null> {
        const latestConfig = await this.options.cache.get(this.options.getCacheKey());
        if (!this.isOffline) {
            return await this.refreshConfigCoreAsync(latestConfig);
        }
        else {
            this.logOfflineModeWarning();
            return latestConfig;
        }
    }

    protected async refreshConfigCoreAsync(latestConfig: ProjectConfig | null): Promise<ProjectConfig | null> {
        const newConfig = await new Promise<ProjectConfig | null>(resolve => this.fetchLogic(latestConfig, 0, resolve));

        const configContentHasChanged = !ProjectConfig.equals(latestConfig, newConfig);
        // NOTE: Reason why the usage of the non-null assertion operator (!) below is safe:
        // when newConfig isn't null and the latest and new configs equal (i.e. configContentHasChanged === false),
        // then lastProjectConfig must necessarily be a *non-null* config with the same ETag (see ProjectConfig.equals).
        if (newConfig && (configContentHasChanged || newConfig.Timestamp > latestConfig!.Timestamp)) {
            await this.options.cache.set(this.options.getCacheKey(), newConfig);

            this.onConfigUpdated(newConfig);

            if (configContentHasChanged) {
                this.onConfigChanged(newConfig);
            }

            return newConfig;
        }

        return latestConfig;
    }

    protected onConfigUpdated(newConfig: ProjectConfig): void { }

    protected onConfigChanged(newConfig: ProjectConfig): void {
        this.options.logger.debug("config changed");
    }

    private fetchLogic(lastProjectConfig: ProjectConfig | null, retries: number, callback: (newProjectConfig: ProjectConfig | null) => void): void {
        this.options.logger.debug("ConfigServiceBase.fetchLogic() - called.");
        const calledBaseUrl = this.options.baseUrl;
        this.fetchLogicInternal(lastProjectConfig?.HttpETag ?? null, retries, (result) => {
            this.options.logger.debug("ConfigServiceBase.fetchLogic(): result.status: " + result.status);

            let newConfig: ProjectConfig;
            switch (result.status) {
                case FetchStatus.Fetched:
                    newConfig = new ProjectConfig(new Date().getTime(), result.responseBody, result.eTag);
                    break;
                case FetchStatus.NotModified:
                    if (!lastProjectConfig) {
                        this.options.logger.debug(`ConfigServiceBase.fetchLogic(): received status '${FetchStatus[result.status]}' when no config was cached locally. Returning null.`);
                        callback(null);
                        return;
                    }

                    this.options.logger.debug("ConfigServiceBase.fetchLogic(): content was not modified. Returning lastProjectConfig with updated timestamp.");
                    newConfig = new ProjectConfig(new Date().getTime(), lastProjectConfig.ConfigJSON, lastProjectConfig.HttpETag);
                    callback(newConfig);
                    return;
                case FetchStatus.Errored:
                    this.options.logger.debug("ConfigServiceBase.fetchLogic(): fetch was unsuccessful. Returning null.");
                    callback(null);
                    return;
                default:
                    this.options.logger.error(`ConfigServiceBase.fetchLogic(): invalid fetch status '${FetchStatus[result.status]}'. Returning null.`);
                    callback(null);
                    return;
            }

            if (!result.responseBody) {
                this.options.logger.debug("ConfigServiceBase.fetchLogic(): no response body. Returning null.");
                callback(null);
                return;
            }

            const preferences = newConfig.ConfigJSON[ConfigFile.Preferences];
            if (!preferences) {
                this.options.logger.debug("ConfigServiceBase.fetchLogic(): preferences is empty. Returning newConfig.");
                callback(newConfig);
                return;
            }

            const baseUrl = preferences[Preferences.BaseUrl];

            // If the base_url is the same as the last called one, just return the response.
            if (!baseUrl || baseUrl == calledBaseUrl) {
                this.options.logger.debug("ConfigServiceBase.fetchLogic(): baseUrl OK. Returning newConfig.");
                callback(newConfig);
                return;
            }

            const redirect = preferences[Preferences.Redirect];

            // If the base_url is overridden, and the redirect parameter is not 2 (force),
            // the SDK should not redirect the calls and it just have to return the response.
            if (this.options.baseUrlOverriden && redirect !== 2) {
                this.options.logger.debug("ConfigServiceBase.fetchLogic(): options.baseUrlOverriden && redirect !== 2.");
                callback(newConfig);
                return;
            }

            this.options.baseUrl = baseUrl;

            if (redirect === 0) {
                callback(newConfig);
                return;
            }

            if (redirect === 1) {

                this.options.logger.warn("Your dataGovernance parameter at ConfigCatClient initialization is not in sync " +
                    "with your preferences on the ConfigCat Dashboard: " +
                    "https://app.configcat.com/organization/data-governance. " +
                    "Only Organization Admins can access this preference.");
            }

            if (retries >= 2) {
                this.options.logger.error("Redirect loop during config.json fetch. Please contact support@configcat.com.");
                callback(newConfig);
                return;
            }

            this.fetchLogic(lastProjectConfig, ++retries, callback);
            return;
        });
    }

    private fetchLogicInternal(lastEtag: string | null, retries: number, callback: (result: FetchResult) => void): void {
        this.options.logger.debug("ConfigServiceBase.fetchLogicInternal(): called.");
        if (retries === 0) { // Only lock on the top-level calls, not on the recursive calls (config.json redirections).
            this.fetchLogicCallbacks.push(callback);
            if (this.fetchLogicCallbacks.length > 1) {
                // The first fetchLogic call is already in progress.
                this.options.logger.debug("ConfigServiceBase.fetchLogicInternal(): The first fetchLogic call is already in progress. this.fetchLogicCallbacks.length = " + this.fetchLogicCallbacks.length);
                return;
            }
            this.options.logger.debug("ConfigServiceBase.fetchLogicInternal(): Calling fetchLogic");
            this.configFetcher.fetchLogic(this.options, lastEtag, newProjectConfig => {
                this.options.logger.debug("ConfigServiceBase.fetchLogicInternal(): fetchLogic() success, calling callbacks. this.fetchLogicCallbacks.length = " + this.fetchLogicCallbacks.length);
                while (this.fetchLogicCallbacks.length) {
                    const thisCallback = this.fetchLogicCallbacks.pop();
                    if (thisCallback) {
                        this.options.logger.debug("ConfigServiceBase.fetchLogicInternal(): fetchLogic() success, calling callback.");
                        thisCallback(newProjectConfig);
                    }
                }
            });
        } else {
            // Recursive calls should call the fetchLogic as is.
            this.options.logger.debug("ConfigServiceBase.fetchLogicInternal(): calling fetchLogic(), recursive call. retries = " + retries);
            this.configFetcher.fetchLogic(this.options, lastEtag, callback);
        }
    }

    protected get isOfflineExactly(): boolean {
        return this.status === ConfigServiceStatus.Offline;
    }

    get isOffline(): boolean {
        return this.status !== ConfigServiceStatus.Online;
    }

    protected setOnlineCore() { }

    setOnline(): void {
        if (this.status === ConfigServiceStatus.Offline) {
            this.setOnlineCore();
            this.status = ConfigServiceStatus.Online;
            this.logStatusChange(this.status);
        }
        else if (this.disposed) {
            this.logDisposedWarning("setOnline")
        }
    }

    protected setOfflineCore() { }

    setOffline(): void {
        if (this.status == ConfigServiceStatus.Online) {
            this.setOfflineCore();
            this.status = ConfigServiceStatus.Offline;
            this.logStatusChange(this.status);
        }
        else if (this.disposed) {
            this.logDisposedWarning("setOnline")
        }
    }

    logStatusChange(status: ConfigServiceStatus)
    {
        this.options.logger.debug(`Switched to ${ConfigServiceStatus[status]?.toUpperCase()} mode.`);
    }

    logOfflineModeWarning()
    {
        this.options.logger.warn("Client is in offline mode, it can't initiate HTTP calls.");
    }

    logDisposedWarning(methodName: string)
    {
        this.options.logger.warn(`Client has already been disposed, thus ${methodName}() has no effect.`);
    }
}
