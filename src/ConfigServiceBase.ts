import type { OptionsBase } from "./ConfigCatClientOptions";
import type { FetchErrorCauses, IConfigFetcher, IFetchResponse } from "./ConfigFetcher";
import { FetchError, FetchResult, FetchStatus } from "./ConfigFetcher";
import { ConfigFile, Preferences, ProjectConfig } from "./ProjectConfig";

export class RefreshResult {
  constructor(
    public errorMessage: string | null,
    public errorException?: any
  ) {
  }

  get isSuccess(): boolean { return this.errorMessage === null; }

  static from(fetchResult: FetchResult): RefreshResult {
    return fetchResult.status !== FetchStatus.Errored
      ? RefreshResult.success()
      : RefreshResult.failure(fetchResult.errorMessage!, fetchResult.errorException);
  }

  static success(): RefreshResult {
    return new RefreshResult(null);
  }

  static failure(errorMessage: string, errorException?: any): RefreshResult {
    return new RefreshResult(errorMessage, errorException);
  }
}

export interface IConfigService {
  getConfig(): Promise<ProjectConfig>;

  refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig]>;

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
  private status: ConfigServiceStatus;

  private pendingFetch: Promise<FetchResult> | null = null;

  constructor(
    protected readonly configFetcher: IConfigFetcher,
    protected readonly options: TOptions) {

    this.configFetcher = configFetcher;
    this.options = options;
    this.status = options.offline ? ConfigServiceStatus.Offline : ConfigServiceStatus.Online;
  }

  dispose(): void {
    this.status = ConfigServiceStatus.Disposed;
  }

  protected get disposed(): boolean {
    return this.status === ConfigServiceStatus.Disposed;
  }

  abstract getConfig(): Promise<ProjectConfig>;

  async refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig]> {
    const latestConfig = await this.options.cache.get(this.options.getCacheKey());
    if (!this.isOffline) {
      const [fetchResult, config] = await this.refreshConfigCoreAsync(latestConfig);
      return [RefreshResult.from(fetchResult), config];
    }
    else {
      const errorMessage = this.options.logger.configServiceCannotInitiateHttpCalls().toString();
      return [RefreshResult.failure(errorMessage), latestConfig];
    }
  }

  protected async refreshConfigCoreAsync(latestConfig: ProjectConfig): Promise<[FetchResult, ProjectConfig]> {
    const fetchResult = await this.fetchAsync(latestConfig);

    const success = fetchResult.status === FetchStatus.Fetched;
    if (success
        || fetchResult.config.timestamp > latestConfig.timestamp && (!fetchResult.config.isEmpty || latestConfig.isEmpty)) {

      latestConfig = fetchResult.config;

      await this.options.cache.set(this.options.getCacheKey(), latestConfig);

      this.onConfigUpdated(latestConfig);

      if (success) {
        this.onConfigChanged(latestConfig);
      }
    }

    return [fetchResult, latestConfig];
  }

  protected onConfigUpdated(newConfig: ProjectConfig): void { }

  protected onConfigChanged(newConfig: ProjectConfig): void {
    this.options.logger.debug("config changed");
    this.options.hooks.emit("configChanged", newConfig);
  }

  private fetchAsync(lastConfig: ProjectConfig): Promise<FetchResult> {
    return this.pendingFetch ??= (async () => {
      try {
        return await this.fetchLogicAsync(lastConfig);
      }
      finally {
        this.pendingFetch = null;
      }
    })();
  }

  private async fetchLogicAsync(lastConfig: ProjectConfig): Promise<FetchResult> {
    const options = this.options;
    options.logger.debug("ConfigServiceBase.fetchLogicAsync() - called.");

    let errorMessage: string;
    try {
      const [response, configJson] = await this.fetchRequestAsync(lastConfig.httpETag ?? null);

      switch (response.statusCode) {
        case 200: // OK
          if (!configJson) {
            errorMessage = options.logger.fetchReceived200WithInvalidBody().toString();
            options.logger.debug(`ConfigServiceBase.fetchLogicAsync(): ${response.statusCode} ${response.reasonPhrase} was received but the HTTP response content was invalid. Returning null.`);
            return FetchResult.error(lastConfig, errorMessage);
          }

          options.logger.debug("ConfigServiceBase.fetchLogicAsync(): fetch was successful. Returning new config.");
          return FetchResult.success(new ProjectConfig(response.body, configJson, ProjectConfig.generateTimestamp(), response.eTag));

        case 304: // Not Modified
          if (!lastConfig) {
            errorMessage = options.logger.fetchReceived304WhenLocalCacheIsEmpty(response.statusCode, response.reasonPhrase).toString();
            options.logger.debug(`ConfigServiceBase.fetchLogicAsync(): ${response.statusCode} ${response.reasonPhrase} was received when no config is cached locally. Returning null.`);
            return FetchResult.error(lastConfig, errorMessage);
          }

          options.logger.debug("ConfigServiceBase.fetchLogicAsync(): content was not modified. Returning last config with updated timestamp.");
          return FetchResult.notModified(lastConfig.with(ProjectConfig.generateTimestamp()));

        case 403: // Forbidden
        case 404: // Not Found
          errorMessage = options.logger.fetchFailedDueToInvalidSdkKey().toString();
          options.logger.debug("ConfigServiceBase.fetchLogicAsync(): fetch was unsuccessful. Returning last config (if any) with updated timestamp.");
          return FetchResult.error(lastConfig.with(ProjectConfig.generateTimestamp()), errorMessage);

        default:
          errorMessage = options.logger.fetchFailedDueToUnexpectedHttpResponse(response.statusCode, response.reasonPhrase).toString();
          options.logger.debug("ConfigServiceBase.fetchLogicAsync(): fetch was unsuccessful. Returning null.");
          return FetchResult.error(lastConfig, errorMessage);
      }
    }
    catch (err) {
      errorMessage = (err instanceof FetchError && (err as FetchError).cause === "timeout"
        ? options.logger.fetchFailedDueToRequestTimeout((err.args as FetchErrorCauses["timeout"])[0], err)
        : options.logger.fetchFailedDueToUnexpectedError(err)).toString();

      options.logger.debug("ConfigServiceBase.fetchLogicAsync(): fetch was unsuccessful. Returning null.");
      return FetchResult.error(lastConfig, errorMessage, err);
    }
  }

  private async fetchRequestAsync(lastETag: string | null, maxRetryCount = 2): Promise<[IFetchResponse, any?]> {
    const options = this.options;
    options.logger.debug("ConfigServiceBase.fetchRequestAsync() - called.");

    for (let retryNumber = 0; ; retryNumber++) {
      options.logger.debug(`ConfigServiceBase.fetchRequestAsync(): calling fetchLogic()${retryNumber > 0 ? `, retry ${retryNumber}/${maxRetryCount}` : ""}`);
      const response = await this.configFetcher.fetchLogic(options, lastETag);

      if (response.statusCode !== 200) {
        return [response];
      }

      if (!response.body) {
        options.logger.debug("ConfigServiceBase.fetchRequestAsync(): no response body.");
        return [response];
      }

      let configJSON: any;
      try {
        configJSON = JSON.parse(response.body);
      }
      catch {
        options.logger.debug("ConfigServiceBase.fetchRequestAsync(): invalid response body.");
        return [response];
      }

      const preferences = configJSON[ConfigFile.Preferences];
      if (!preferences) {
        options.logger.debug("ConfigServiceBase.fetchRequestAsync(): preferences is empty.");
        return [response, configJSON];
      }

      const baseUrl = preferences[Preferences.BaseUrl];

      // If the base_url is the same as the last called one, just return the response.
      if (!baseUrl || baseUrl === options.baseUrl) {
        options.logger.debug("ConfigServiceBase.fetchRequestAsync(): baseUrl OK.");
        return [response, configJSON];
      }

      const redirect = preferences[Preferences.Redirect];

      // If the base_url is overridden, and the redirect parameter is not 2 (force),
      // the SDK should not redirect the calls and it just have to return the response.
      if (options.baseUrlOverriden && redirect !== 2) {
        options.logger.debug("ConfigServiceBase.fetchRequestAsync(): options.baseUrlOverriden && redirect !== 2.");
        return [response, configJSON];
      }

      options.baseUrl = baseUrl;

      if (redirect === 0) {
        return [response, configJSON];
      }

      if (redirect === 1) {
        options.logger.dataGovernanceIsOutOfSync();
      }

      if (retryNumber >= maxRetryCount) {
        options.logger.fetchFailedDueToRedirectLoop();
        return [response, configJSON];
      }
    }
  }

  protected get isOfflineExactly(): boolean {
    return this.status === ConfigServiceStatus.Offline;
  }

  get isOffline(): boolean {
    return this.status !== ConfigServiceStatus.Online;
  }

  protected setOnlineCore(): void { /* Intentionally empty. */ }

  setOnline(): void {
    if (this.status === ConfigServiceStatus.Offline) {
      this.setOnlineCore();
      this.status = ConfigServiceStatus.Online;
      this.options.logger.configServiceStatusChanged(ConfigServiceStatus[this.status]);
    }
    else if (this.disposed) {
      this.options.logger.configServiceMethodHasNoEffectDueToDisposedClient("setOnline");
    }
  }

  protected setOfflineCore(): void { /* Intentionally empty. */ }

  setOffline(): void {
    if (this.status === ConfigServiceStatus.Online) {
      this.setOfflineCore();
      this.status = ConfigServiceStatus.Offline;
      this.options.logger.configServiceStatusChanged(ConfigServiceStatus[this.status]);
    }
    else if (this.disposed) {
      this.options.logger.configServiceMethodHasNoEffectDueToDisposedClient("setOffline");
    }
  }
}
