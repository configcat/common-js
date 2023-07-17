import type { AutoPollOptions } from "./ConfigCatClientOptions";
import type { LoggerWrapper } from "./ConfigCatLogger";
import type { IConfigFetcher } from "./ConfigFetcher";
import type { IConfigService, RefreshResult } from "./ConfigServiceBase";
import { ConfigServiceBase } from "./ConfigServiceBase";
import { ClientReadyState } from "./Hooks";
import { ProjectConfig } from "./ProjectConfig";
import { delay } from "./Utils";

export class AutoPollConfigService extends ConfigServiceBase<AutoPollOptions> implements IConfigService {

  private initialized: boolean;
  private readonly initialization: Promise<void>;
  private signalInitialization: () => void = () => { /* Intentional no-op. */ };
  private timerId?: ReturnType<typeof setTimeout>;
  private readonly pollIntervalMs: number;

  constructor(configFetcher: IConfigFetcher, options: AutoPollOptions) {

    super(configFetcher, options);

    this.pollIntervalMs = options.pollIntervalSeconds * 1000;

    if (options.maxInitWaitTimeSeconds !== 0) {
      this.initialized = false;

      // This promise will be resolved when
      // 1. the cache contains a valid config at startup (see startRefreshWorker) or
      // 2. config.json is downloaded the first time (see onConfigUpdated) or
      // 3. maxInitWaitTimeSeconds > 0 and maxInitWaitTimeSeconds has passed (see the setTimeout call below).
      this.initialization = new Promise(resolve => this.signalInitialization = () => {
        this.initialized = true;
        resolve();
      });

      this.initialization.then(() => {
        if (!this.disposed) {
          options.signalReadyState(this.getReadyState(options.cache.getInMemory()));
        }
      });

      if (options.maxInitWaitTimeSeconds > 0) {
        setTimeout(() => this.signalInitialization(), options.maxInitWaitTimeSeconds * 1000);
      }
    }
    else {
      this.initialized = true;
      this.initialization = Promise.resolve();
      options.signalReadyState(this.getReadyState(options.cache.getInMemory()));
    }

    if (!options.offline) {
      this.startRefreshWorker();
    }
  }

  private async waitForInitializationAsync(): Promise<boolean> {
    if (this.options.maxInitWaitTimeSeconds < 0) {
      await this.initialization;
      return true;
    }

    let cancelDelay: () => void;
    // Simply awaiting the initialization promise would also work but we limit waiting to maxInitWaitTimeSeconds for maximum safety.
    const result = await Promise.race([
      (async () => { await this.initialization; return true; })(),
      delay(this.options.maxInitWaitTimeSeconds * 1000, cancel => cancelDelay = cancel)
    ]);
    cancelDelay!();
    return !!result;
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
    if (this.timerId) {
      this.stopRefreshWorker();
    }
  }

  protected onConfigUpdated(newConfig: ProjectConfig): void {
    super.onConfigUpdated(newConfig);
    this.signalInitialization();
  }

  protected setOnlineCore(): void {
    this.startRefreshWorker();
  }

  protected setOfflineCore(): void {
    this.stopRefreshWorker();
  }

  private async startRefreshWorker() {
    this.options.logger.debug("AutoPollConfigService.startRefreshWorker() called.");

    const delayMs = this.pollIntervalMs;

    const latestConfig = await this.options.cache.get(this.cacheKey);
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
    this.timerId = setTimeout(d => this.refreshWorkerLogic(d), delayMs, delayMs);
  }

  private stopRefreshWorker() {
    this.options.logger.debug("AutoPollConfigService.stopRefreshWorker() - clearing setTimeout.");
    clearTimeout(this.timerId);
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
    this.timerId = setTimeout(d => this.refreshWorkerLogic(d), delayMs, delayMs);
  }

  protected getReadyState(flagData: ProjectConfig): ClientReadyState {
    if (flagData.isEmpty) {
      return ClientReadyState.NoFlagData;
    }
    
    if (flagData.isExpired(this.pollIntervalMs)) {
      return ClientReadyState.HasCachedFlagDataOnly;
    }

    return ClientReadyState.HasUpToDateFlagData;
  }
}
