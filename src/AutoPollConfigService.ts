import type { AutoPollOptions } from "./ConfigCatClientOptions";
import type { LoggerWrapper } from "./ConfigCatLogger";
import type { IConfigFetcher } from "./ConfigFetcher";
import type { IConfigService, RefreshResult } from "./ConfigServiceBase";
import { ClientCacheState, ConfigServiceBase } from "./ConfigServiceBase";
import type { ProjectConfig } from "./ProjectConfig";
import { AbortToken, delay } from "./Utils";

export const POLL_EXPIRATION_TOLERANCE_MS = 500;

export class AutoPollConfigService extends ConfigServiceBase<AutoPollOptions> implements IConfigService {

  private initialized: boolean;
  private readonly initializationPromise: Promise<boolean>;
  private signalInitialization: () => void = () => { /* Intentional no-op. */ };
  private stopToken = new AbortToken();
  private readonly pollIntervalMs: number;
  private readonly pollExpirationMs: number;
  readonly readyPromise: Promise<ClientCacheState>;

  constructor(configFetcher: IConfigFetcher, options: AutoPollOptions) {

    super(configFetcher, options);

    this.pollIntervalMs = options.pollIntervalSeconds * 1000;
    // Due to the inaccuracy of the timer, some tolerance should be allowed when checking for
    // cache expiration in the polling loop, otherwise some fetch operations may be missed.
    this.pollExpirationMs = this.pollIntervalMs - POLL_EXPIRATION_TOLERANCE_MS;

    const initialCacheSyncUp = this.syncUpWithCache();

    if (options.maxInitWaitTimeSeconds !== 0) {
      this.initialized = false;

      // This promise will be resolved when
      // 1. the cache contains a valid config at startup (see startRefreshWorker) or
      // 2. config json is fetched the first time, regardless of success or failure (see onConfigUpdated).
      const initSignalPromise = new Promise<void>(resolve => this.signalInitialization = resolve);

      // This promise will be resolved when either initialization ready is signalled by signalInitialization() or maxInitWaitTimeSeconds pass.
      this.initializationPromise = this.waitForInitializationAsync(initSignalPromise).then(success => {
        this.initialized = true;
        return success;
      });
    }
    else {
      this.initialized = true;
      this.initializationPromise = Promise.resolve(false);
    }

    this.readyPromise = this.getReadyPromise(this.initializationPromise, async initializationPromise => {
      await initializationPromise;
      return this.getCacheState(this.options.cache.getInMemory());
    });

    if (!options.offline) {
      this.startRefreshWorker(initialCacheSyncUp, this.stopToken);
    }
  }

  private async waitForInitializationAsync(initSignalPromise: Promise<void>): Promise<boolean> {
    if (this.options.maxInitWaitTimeSeconds < 0) {
      await initSignalPromise;
      return true;
    }

    const abortToken = new AbortToken();
    const success = await Promise.race([
      initSignalPromise.then(() => true),
      delay(this.options.maxInitWaitTimeSeconds * 1000, abortToken).then(() => false)
    ]);
    abortToken.abort();
    return success;
  }

  async getConfig(): Promise<ProjectConfig> {
    this.options.logger.debug("AutoPollConfigService.getConfig() called.");

    function logSuccess(logger: LoggerWrapper) {
      logger.debug("AutoPollConfigService.getConfig() - returning value from cache.");
    }

    let cachedConfig: ProjectConfig;
    if (!this.isOffline && !this.initialized) {
      cachedConfig = await this.options.cache.get(this.cacheKey);
      if (!cachedConfig.isExpired(this.pollIntervalMs)) {
        logSuccess(this.options.logger);
        return cachedConfig;
      }

      this.options.logger.debug("AutoPollConfigService.getConfig() - cache is empty or expired, waiting for initialization.");
      await this.initializationPromise;
    }

    cachedConfig = await this.options.cache.get(this.cacheKey);
    if (!cachedConfig.isExpired(this.pollIntervalMs)) {
      logSuccess(this.options.logger);
    }
    else {
      this.options.logger.debug("AutoPollConfigService.getConfig() - cache is empty or expired.");
    }

    return cachedConfig;
  }

  refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig]> {
    this.options.logger.debug("AutoPollConfigService.refreshConfigAsync() called.");
    return super.refreshConfigAsync();
  }

  dispose(): void {
    this.options.logger.debug("AutoPollConfigService.dispose() called.");
    super.dispose();
    if (!this.stopToken.aborted) {
      this.stopRefreshWorker();
    }
  }

  protected onConfigFetched(newConfig: ProjectConfig): void {
    super.onConfigFetched(newConfig);
    this.signalInitialization();
  }

  protected setOnlineCore(): void {
    this.startRefreshWorker(null, this.stopToken);
  }

  protected setOfflineCore(): void {
    this.stopRefreshWorker();
    this.stopToken = new AbortToken();
  }

  private async startRefreshWorker(initialCacheSyncUp: ProjectConfig | Promise<ProjectConfig> | null, stopToken: AbortToken) {
    this.options.logger.debug("AutoPollConfigService.startRefreshWorker() called.");

    let isFirstIteration = true;
    while (!stopToken.aborted) {
      try {
        const scheduledNextTimeMs = new Date().getTime() + this.pollIntervalMs;
        try {
          await this.refreshWorkerLogic(isFirstIteration, initialCacheSyncUp);
        }
        catch (err) {
          this.options.logger.autoPollConfigServiceErrorDuringPolling(err);
        }

        const realNextTimeMs = scheduledNextTimeMs - new Date().getTime();
        if (realNextTimeMs > 0) {
          await delay(realNextTimeMs, stopToken);
        }
      }
      catch (err) {
        this.options.logger.autoPollConfigServiceErrorDuringPolling(err);
      }

      isFirstIteration = false;
      initialCacheSyncUp = null; // allow GC to collect the Promise and its result
    }
  }

  private stopRefreshWorker() {
    this.options.logger.debug("AutoPollConfigService.stopRefreshWorker() called.");
    this.stopToken.abort();
  }

  private async refreshWorkerLogic(isFirstIteration: boolean, initialCacheSyncUp: ProjectConfig | Promise<ProjectConfig> | null) {
    this.options.logger.debug("AutoPollConfigService.refreshWorkerLogic() - called.");

    const latestConfig = await (initialCacheSyncUp ?? this.options.cache.get(this.cacheKey));
    if (latestConfig.isExpired(this.pollExpirationMs)) {
      // Even if the service gets disposed immediately, we allow the first refresh for backward compatibility,
      // i.e. to not break usage patterns like this:
      // ```
      // client.getValueAsync("SOME_KEY", false).then(value => { /* ... */ }, user);
      // client.dispose();
      // ```
      if (isFirstIteration ? !this.isOfflineExactly : !this.isOffline) {
        await this.refreshConfigCoreAsync(latestConfig);
      }
    }
    else if (isFirstIteration) {
      this.signalInitialization();
    }
  }

  getCacheState(cachedConfig: ProjectConfig): ClientCacheState {
    if (cachedConfig.isEmpty) {
      return ClientCacheState.NoFlagData;
    }

    if (cachedConfig.isExpired(this.pollIntervalMs)) {
      return ClientCacheState.HasCachedFlagDataOnly;
    }

    return ClientCacheState.HasUpToDateFlagData;
  }
}
