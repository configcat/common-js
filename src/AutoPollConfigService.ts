import type { AutoPollOptions } from "./ConfigCatClientOptions";
import type { LoggerWrapper } from "./ConfigCatLogger";
import type { IConfigFetcher } from "./ConfigFetcher";
import type { IConfigService, RefreshResult } from "./ConfigServiceBase";
import { ClientCacheState, ConfigServiceBase } from "./ConfigServiceBase";
import type { ProjectConfig } from "./ProjectConfig";
import { delay } from "./Utils";

export class AutoPollConfigService extends ConfigServiceBase<AutoPollOptions> implements IConfigService {

  private initialized: boolean;
  private readonly initialization: Promise<void>;
  private signalInitialization: () => void = () => { /* Intentional no-op. */ };
  private workerTimerId?: ReturnType<typeof setTimeout>;
  private readonly initTimerId?: ReturnType<typeof setTimeout>;
  private readonly pollIntervalMs: number;
  readonly readyPromise: Promise<ClientCacheState>;

  constructor(configFetcher: IConfigFetcher, options: AutoPollOptions) {

    super(configFetcher, options);

    this.pollIntervalMs = options.pollIntervalSeconds * 1000;

    if (options.maxInitWaitTimeSeconds !== 0) {
      this.initialized = false;

      // This promise will be resolved when
      // 1. the cache contains a valid config at startup (see startRefreshWorker) or
      // 2. config json is fetched the first time, regardless of success or failure (see onConfigUpdated) or
      // 3. maxInitWaitTimeSeconds > 0 and maxInitWaitTimeSeconds has passed (see the setTimeout call below).
      this.initialization = new Promise(resolve => this.signalInitialization = () => {
        this.initialized = true;
        clearTimeout(this.initTimerId);
        resolve();
      });

      if (options.maxInitWaitTimeSeconds > 0) {
        this.initTimerId = setTimeout(() => this.signalInitialization(), options.maxInitWaitTimeSeconds * 1000);
      }
    }
    else {
      this.initialized = true;
      this.initialization = Promise.resolve();
    }

    let initialCacheSyncUp: ProjectConfig | Promise<ProjectConfig>;
    [this.readyPromise, initialCacheSyncUp] = this.setupClientReady();

    if (!options.offline) {
      this.startRefreshWorker(initialCacheSyncUp);
    }
  }

  private async waitForInitializationAsync(): Promise<boolean> {
    if (this.options.maxInitWaitTimeSeconds < 0) {
      await this.initialization;
      return true;
    }

    const delayCleanup: { clearTimer?: () => void } = {};
    // Simply awaiting the initialization promise would also work but we limit waiting to maxInitWaitTimeSeconds for maximum safety.
    const success = await Promise.race([
      this.initialization.then(() => true),
      delay(this.options.maxInitWaitTimeSeconds * 1000, delayCleanup).then(() => false)
    ]);
    delayCleanup.clearTimer!();
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
      await this.waitForInitializationAsync();
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
    if (this.workerTimerId) {
      this.stopRefreshWorker();
    }
  }

  protected onConfigFetched(newConfig: ProjectConfig): void {
    super.onConfigFetched(newConfig);
    this.signalInitialization();
  }

  protected setOnlineCore(): void {
    this.startRefreshWorker();
  }

  protected setOfflineCore(): void {
    this.stopRefreshWorker();
  }

  private async startRefreshWorker(initialCacheSyncUp?: ProjectConfig | Promise<ProjectConfig>) {
    this.options.logger.debug("AutoPollConfigService.startRefreshWorker() called.");

    const delayMs = this.pollIntervalMs;

    const latestConfig = await (initialCacheSyncUp ?? this.options.cache.get(this.cacheKey));
    if (latestConfig.isExpired(this.pollIntervalMs)) {
      // Even if the service gets disposed immediately, we allow the first refresh for backward compatibility,
      // i.e. to not break usage patterns like this:
      // ```
      // client.getValueAsync("SOME_KEY", false).then(value => { /* ... */ }, user);
      // client.dispose();
      // ```
      if (!this.isOfflineExactly) {
        await this.refreshConfigCoreAsync(latestConfig);
      }
    }
    else {
      this.signalInitialization();
    }

    this.options.logger.debug("AutoPollConfigService.startRefreshWorker() - calling refreshWorkerLogic()'s setTimeout.");
    this.workerTimerId = setTimeout(d => this.refreshWorkerLogic(d), delayMs, delayMs);
  }

  private stopRefreshWorker() {
    this.options.logger.debug("AutoPollConfigService.stopRefreshWorker() - clearing setTimeout.");
    clearTimeout(this.workerTimerId);
  }

  private async refreshWorkerLogic(delayMs: number) {
    if (this.disposed) {
      this.options.logger.debug("AutoPollConfigService.refreshWorkerLogic() - called on a disposed client.");
      return;
    }

    this.options.logger.debug("AutoPollConfigService.refreshWorkerLogic() - called.");

    if (!this.isOffline) {
      const latestConfig = await this.options.cache.get(this.cacheKey);
      await this.refreshConfigCoreAsync(latestConfig);
    }

    this.options.logger.debug("AutoPollConfigService.refreshWorkerLogic() - calling refreshWorkerLogic()'s setTimeout.");
    this.workerTimerId = setTimeout(d => this.refreshWorkerLogic(d), delayMs, delayMs);
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

  protected async waitForReadyAsync(): Promise<ClientCacheState> {
    // NOTE: In Auto Polling mode, maxInitWaitTime takes precedence over waiting for initial cache sync-up, that is,
    // ClientReady is always raised after maxInitWaitTime has passed, regardless of whether initial cache sync-up has finished or not.

    await this.waitForInitializationAsync();
    return this.getCacheState(this.options.cache.getInMemory());
  }
}
