import { OptionsBase } from "./ConfigCatClientOptions";
import { FetchResult, FetchStatus, IConfigFetcher } from "./ConfigFetcher";
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

    private pendingFetch: Promise<ProjectConfig | null> | null = null;

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
        const newConfig = await this.fetchAsync(latestConfig);

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
        this.options.hooks.emit("configChanged", newConfig);
    }

    private fetchAsync(lastConfig: ProjectConfig | null): Promise<ProjectConfig | null> {
        return this.pendingFetch ??= (async () => {
            try {
                return await this.fetchLogicAsync(lastConfig);
            }
            finally {
                this.pendingFetch = null;
            }
        })();
    }

    private async fetchLogicAsync(lastConfig: ProjectConfig | null): Promise<ProjectConfig | null> {
        const options = this.options;
        options.logger.debug("ConfigServiceBase.fetchLogicAsync() - called.");

        const [result, configJson] = await this.fetchRequestAsync(lastConfig?.HttpETag ?? null);

        switch (result.status) {
            case FetchStatus.Fetched:
                if (!configJson) {
                    options.logger.debug("ConfigServiceBase.fetchLogicAsync(): fetch was successful but response is invalid. Returning null.");
                    return null;
                }

                options.logger.debug("ConfigServiceBase.fetchLogicAsync(): fetch was successful. Returning new config.");
                return new ProjectConfig(new Date().getTime(), configJson, result.eTag);
            case FetchStatus.NotModified:
                if (!lastConfig) {
                    options.logger.debug(`ConfigServiceBase.fetchLogicAsync(): received status '${FetchStatus[result.status]}' when no config was cached locally. Returning null.`);
                    return null;
                }

                options.logger.debug("ConfigServiceBase.fetchLogicAsync(): content was not modified. Returning last config with updated timestamp.");
                return new ProjectConfig(new Date().getTime(), lastConfig.ConfigJSON, lastConfig.HttpETag);
            case FetchStatus.Errored:
                options.logger.debug("ConfigServiceBase.fetchLogicAsync(): fetch was unsuccessful. Returning null.");
                return null;
            default:
                options.logger.error(`ConfigServiceBase.fetchLogicAsync(): invalid fetch status '${FetchStatus[result.status]}'. Returning null.`);
                return null;
        }
    }

    private async fetchRequestAsync(lastETag: string | null, maxRetryCount = 2): Promise<[FetchResult, any?]> {
        const options = this.options;
        options.logger.debug("ConfigServiceBase.fetchRequestAsync() - called.");

        for (let retryNumber = 0; ; retryNumber++) {
            options.logger.debug(`ConfigServiceBase.fetchRequestAsync(): calling fetchLogic()${retryNumber > 0 ? `, retry ${retryNumber}/${maxRetryCount}` : ""}`);
            const result = await new Promise<FetchResult>(resolve => this.configFetcher.fetchLogic(options, lastETag, resolve));

            if (result.status !== FetchStatus.Fetched) {
                return [result];
            }

            if (!result.responseBody) {
                options.logger.debug("ConfigServiceBase.fetchRequestAsync(): no response body.");
                return [result];
            }

            const configJSON = JSON.parse(result.responseBody);

            const preferences = configJSON[ConfigFile.Preferences];
            if (!preferences) {
                options.logger.debug("ConfigServiceBase.fetchRequestAsync(): preferences is empty.");
                return [result, configJSON];
            }

            const baseUrl = preferences[Preferences.BaseUrl];

            // If the base_url is the same as the last called one, just return the response.
            if (!baseUrl || baseUrl == options.baseUrl) {
                options.logger.debug("ConfigServiceBase.fetchRequestAsync(): baseUrl OK.");
                return [result, configJSON];
            }

            const redirect = preferences[Preferences.Redirect];

            // If the base_url is overridden, and the redirect parameter is not 2 (force),
            // the SDK should not redirect the calls and it just have to return the response.
            if (options.baseUrlOverriden && redirect !== 2) {
                options.logger.debug("ConfigServiceBase.fetchRequestAsync(): options.baseUrlOverriden && redirect !== 2.");
                return [result, configJSON];
            }

            options.baseUrl = baseUrl;

            if (redirect === 0) {
                return [result, configJSON];
            }

            if (redirect === 1) {

                options.logger.warn(
                    "Your dataGovernance parameter at ConfigCatClient initialization is not in sync " +
                    "with your preferences on the ConfigCat Dashboard: " +
                    "https://app.configcat.com/organization/data-governance. " +
                    "Only Organization Admins can access this preference.");
            }

            if (retryNumber >= maxRetryCount) {
                options.logger.error("Redirect loop during config.json fetch. Please contact support@configcat.com.");
                return [result, configJSON];
            }
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
