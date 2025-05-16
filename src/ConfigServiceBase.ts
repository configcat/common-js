import type { CacheSyncResult } from "./ConfigCatCache";
import { ExternalConfigCache } from "./ConfigCatCache";
import type { OptionsBase } from "./ConfigCatClientOptions";
import type { FetchErrorCauses, IConfigFetcher, IFetchResponse } from "./ConfigFetcher";
import { FetchError, FetchResult, FetchStatus } from "./ConfigFetcher";
import { RedirectMode } from "./ConfigJson";
import { Config, ProjectConfig } from "./ProjectConfig";
import { isPromiseLike } from "./Utils";

/** Contains the result of an `IConfigCatClient.forceRefreshAsync` operation. */
export class RefreshResult {
  constructor(
    /** Error message in case the operation failed, otherwise `null`. */
    public errorMessage: string | null,
    /** The exception object related to the error in case the operation failed (if any). */
    public errorException?: any
  ) {
  }

  /** Indicates whether the operation was successful or not. */
  get isSuccess(): boolean { return this.errorMessage === null; }

  static from(fetchResult: FetchResult): RefreshResult {
    return fetchResult.status !== FetchStatus.Errored
      ? RefreshResult.success()
      : RefreshResult.failure(fetchResult.errorMessage!, fetchResult.errorException);
  }

  /** Creates an instance of the `RefreshResult` class which indicates that the operation was successful. */
  static success(): RefreshResult {
    return new RefreshResult(null);
  }

  /** Creates an instance of the `RefreshResult` class which indicates that the operation failed. */
  static failure(errorMessage: string, errorException?: any): RefreshResult {
    return new RefreshResult(errorMessage, errorException);
  }
}

/** Specifies the possible states of the internal cache. */
export enum ClientCacheState {
  /** No config data is available in the internal cache. */
  NoFlagData,
  /** Only config data provided by local flag override is available in the internal cache. */
  HasLocalOverrideFlagDataOnly,
  /** Only expired config data obtained from the external cache or the ConfigCat CDN is available in the internal cache. */
  HasCachedFlagDataOnly,
  /** Up-to-date config data obtained from the external cache or the ConfigCat CDN is available in the internal cache. */
  HasUpToDateFlagData,
}

export interface IConfigService {
  readonly readyPromise: Promise<ClientCacheState>;

  getConfig(): Promise<ProjectConfig>;

  refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig]>;

  readonly isOffline: boolean;

  setOnline(): void;

  setOffline(): void;

  getCacheState(cachedConfig: ProjectConfig): ClientCacheState;

  dispose(): void;
}

enum ConfigServiceStatus {
  Online,
  Offline,
  Disposed,
}

export abstract class ConfigServiceBase<TOptions extends OptionsBase> {
  private status: ConfigServiceStatus;

  private pendingCacheSyncUp: Promise<ProjectConfig> | null = null;
  private pendingConfigRefresh: Promise<[FetchResult, ProjectConfig]> | null = null;

  protected readonly cacheKey: string;

  abstract readonly readyPromise: Promise<ClientCacheState>;

  constructor(
    protected readonly configFetcher: IConfigFetcher,
    protected readonly options: TOptions) {

    this.cacheKey = options.getCacheKey();

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
    const latestConfig = await this.syncUpWithCache();
    if (!this.isOffline) {
      const [fetchResult, config] = await this.refreshConfigCoreAsync(latestConfig);
      return [RefreshResult.from(fetchResult), config];
    }
    else if (this.options.cache instanceof ExternalConfigCache) {
      return [RefreshResult.success(), latestConfig];
    }
    else {
      const errorMessage = this.options.logger.configServiceCannotInitiateHttpCalls().toString();
      return [RefreshResult.failure(errorMessage), latestConfig];
    }
  }

  protected refreshConfigCoreAsync(latestConfig: ProjectConfig): Promise<[FetchResult, ProjectConfig]> {
    if (this.pendingConfigRefresh) {
      // NOTE: Joiners may obtain more up-to-date config data from the external cache than the `latestConfig`
      // that was used to initiate the fetch operation. However, we ignore this possibility because we consider
      // the fetch operation result a more authentic source of truth. Although this may lead to overwriting
      // the cache with stale data, we expect this to be a temporary effect, which corrects itself eventually.

      return this.pendingConfigRefresh;
    }

    const configRefreshPromise = (async (latestConfig: ProjectConfig): Promise<[FetchResult, ProjectConfig]> => {
      const fetchResult = await this.fetchAsync(latestConfig);

      const shouldUpdateCache =
        fetchResult.status === FetchStatus.Fetched
        || fetchResult.status === FetchStatus.NotModified
        || fetchResult.config.timestamp > latestConfig.timestamp // is not transient error?
          && (!fetchResult.config.isEmpty || this.options.cache.getInMemory().isEmpty);

      if (shouldUpdateCache) {
        // NOTE: `ExternalConfigCache.set` makes sure that the external cache is not overwritten with empty
        // config data under any circumstances.
        await this.options.cache.set(this.cacheKey, fetchResult.config);

        latestConfig = fetchResult.config;
      }

      return [fetchResult, latestConfig];
    })(latestConfig);

    const refreshAndFinish = configRefreshPromise
      .finally(() => this.pendingConfigRefresh = null)
      .then(refreshResult => {
        const [fetchResult] = refreshResult;

        this.onConfigFetched(fetchResult.config);

        if (fetchResult.status === FetchStatus.Fetched) {
          this.onConfigChanged(fetchResult.config);
        }

        return refreshResult;
      });

    this.pendingConfigRefresh = configRefreshPromise;

    return refreshAndFinish;
  }

  protected onConfigFetched(newConfig: ProjectConfig): void { }

  protected onConfigChanged(newConfig: ProjectConfig): void {
    this.options.logger.debug("config changed");
    this.options.hooks.emit("configChanged", newConfig.config ?? new Config({}));
  }

  private async fetchAsync(lastConfig: ProjectConfig): Promise<FetchResult> {
    const options = this.options;
    options.logger.debug("ConfigServiceBase.fetchAsync() - called.");

    let errorMessage: string;
    try {
      const [response, configOrError] = await this.fetchRequestAsync(lastConfig.httpETag ?? null);

      switch (response.statusCode) {
        case 200: // OK
          if (!(configOrError instanceof Config)) {
            errorMessage = options.logger.fetchReceived200WithInvalidBody(configOrError).toString();
            options.logger.debug(`ConfigServiceBase.fetchAsync(): ${response.statusCode} ${response.reasonPhrase} was received but the HTTP response content was invalid. Returning null.`);
            return FetchResult.error(lastConfig, errorMessage, configOrError);
          }

          options.logger.debug("ConfigServiceBase.fetchAsync(): fetch was successful. Returning new config.");
          return FetchResult.success(new ProjectConfig(response.body, configOrError, ProjectConfig.generateTimestamp(), response.eTag));

        case 304: // Not Modified
          if (lastConfig.isEmpty) {
            errorMessage = options.logger.fetchReceived304WhenLocalCacheIsEmpty(response.statusCode, response.reasonPhrase).toString();
            options.logger.debug(`ConfigServiceBase.fetchAsync(): ${response.statusCode} ${response.reasonPhrase} was received when no config is cached locally. Returning null.`);
            return FetchResult.error(lastConfig, errorMessage);
          }

          options.logger.debug("ConfigServiceBase.fetchAsync(): content was not modified. Returning last config with updated timestamp.");
          return FetchResult.notModified(lastConfig.with(ProjectConfig.generateTimestamp()));

        case 403: // Forbidden
        case 404: // Not Found
          errorMessage = options.logger.fetchFailedDueToInvalidSdkKey().toString();
          options.logger.debug("ConfigServiceBase.fetchAsync(): fetch was unsuccessful. Returning last config (if any) with updated timestamp.");
          return FetchResult.error(lastConfig.with(ProjectConfig.generateTimestamp()), errorMessage);

        default:
          errorMessage = options.logger.fetchFailedDueToUnexpectedHttpResponse(response.statusCode, response.reasonPhrase).toString();
          options.logger.debug("ConfigServiceBase.fetchAsync(): fetch was unsuccessful. Returning null.");
          return FetchResult.error(lastConfig, errorMessage);
      }
    }
    catch (err) {
      errorMessage = (err instanceof FetchError && (err as FetchError).cause === "timeout"
        ? options.logger.fetchFailedDueToRequestTimeout((err.args as FetchErrorCauses["timeout"])[0], err)
        : options.logger.fetchFailedDueToUnexpectedError(err)).toString();

      options.logger.debug("ConfigServiceBase.fetchAsync(): fetch was unsuccessful. Returning null.");
      return FetchResult.error(lastConfig, errorMessage, err);
    }
  }

  private async fetchRequestAsync(lastETag: string | null, maxRetryCount = 2): Promise<[IFetchResponse, (Config | any)?]> {
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
        return [response, new Error("No response body.")];
      }

      let config: Config;
      try {
        config = Config.deserialize(response.body);
      }
      catch (err) {
        options.logger.debug("ConfigServiceBase.fetchRequestAsync(): invalid response body.");
        return [response, err];
      }

      const preferences = config.preferences;
      if (!preferences) {
        options.logger.debug("ConfigServiceBase.fetchRequestAsync(): preferences is empty.");
        return [response, config];
      }

      const baseUrl = preferences.baseUrl;

      // If the base_url is the same as the last called one, just return the response.
      if (!baseUrl || baseUrl === options.baseUrl) {
        options.logger.debug("ConfigServiceBase.fetchRequestAsync(): baseUrl OK.");
        return [response, config];
      }

      const redirect = preferences.redirectMode;

      // If the base_url is overridden, and the redirect parameter is not 2 (force),
      // the SDK should not redirect the calls and it just have to return the response.
      if (options.baseUrlOverriden && redirect !== RedirectMode.Force) {
        options.logger.debug("ConfigServiceBase.fetchRequestAsync(): options.baseUrlOverriden && redirect !== 2.");
        return [response, config];
      }

      options.baseUrl = baseUrl;

      if (redirect === RedirectMode.No) {
        return [response, config];
      }

      if (redirect === RedirectMode.Should) {
        options.logger.dataGovernanceIsOutOfSync();
      }

      if (retryNumber >= maxRetryCount) {
        options.logger.fetchFailedDueToRedirectLoop();
        return [response, config];
      }
    }
  }

  protected get isOfflineExactly(): boolean {
    return this.status === ConfigServiceStatus.Offline;
  }

  get isOffline(): boolean {
    return this.status !== ConfigServiceStatus.Online;
  }

  protected goOnline(): void { /* Intentionally empty. */ }

  setOnline(): void {
    if (this.status === ConfigServiceStatus.Offline) {
      this.goOnline();
      this.status = ConfigServiceStatus.Online;
      this.options.logger.configServiceStatusChanged(ConfigServiceStatus[this.status]);
    }
    else if (this.disposed) {
      this.options.logger.configServiceMethodHasNoEffectDueToDisposedClient("setOnline");
    }
  }

  setOffline(): void {
    if (this.status === ConfigServiceStatus.Online) {
      this.status = ConfigServiceStatus.Offline;
      this.options.logger.configServiceStatusChanged(ConfigServiceStatus[this.status]);
    }
    else if (this.disposed) {
      this.options.logger.configServiceMethodHasNoEffectDueToDisposedClient("setOffline");
    }
  }

  abstract getCacheState(cachedConfig: ProjectConfig): ClientCacheState;

  protected syncUpWithCache(): ProjectConfig | Promise<ProjectConfig> {
    if (this.pendingCacheSyncUp) {
      return this.pendingCacheSyncUp;
    }

    const syncResult = this.options.cache.get(this.cacheKey);
    if (!isPromiseLike(syncResult)) {
      return this.onCacheSynced(syncResult);
    }

    const syncUpAndFinish = syncResult
      .finally(() => this.pendingCacheSyncUp = null)
      .then(syncResult => this.onCacheSynced(syncResult));

    this.pendingCacheSyncUp = syncResult
      .then(syncResult => !Array.isArray(syncResult) ? syncResult : syncResult[0]);

    return syncUpAndFinish;
  }

  private onCacheSynced(syncResult: CacheSyncResult): ProjectConfig {
    if (!Array.isArray(syncResult)) {
      return syncResult;
    }

    const [newConfig] = syncResult;
    if (!newConfig.isEmpty) {
      this.onConfigChanged(newConfig);
    }
    return newConfig;
  }

  protected async getReadyPromise<TState>(state: TState, waitForReadyAsync: (state: TState) => Promise<ClientCacheState>): Promise<ClientCacheState> {
    const cacheState = await waitForReadyAsync(state);
    this.options.hooks.emit("clientReady", cacheState);
    return cacheState;
  }
}
