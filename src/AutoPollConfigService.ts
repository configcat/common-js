import type { AutoPollOptions } from "./ConfigCatClientOptions";
import type { LoggerWrapper } from "./ConfigCatLogger";
import type { IConfigFetcher } from "./ConfigFetcher";
import type { IConfigService, RefreshResult } from "./ConfigServiceBase";
import { ConfigServiceBase } from "./ConfigServiceBase";
import { ProjectConfig } from "./ProjectConfig";
import { delay } from "./Utils";

export class AutoPollConfigService extends ConfigServiceBase<AutoPollOptions> implements IConfigService {

  private initialized: boolean;
  private readonly initialization: Promise<void>;
  private signalInitialization: () => void = () => { /* Intentional no-op. */ };
  private timerId?: ReturnType<typeof setTimeout>;

  constructor(configFetcher: IConfigFetcher, options: AutoPollOptions) {

    super(configFetcher, options);

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

      this.initialization.then(() => !this.disposed && options.hooks.emit("clientReady"));

      if (options.maxInitWaitTimeSeconds > 0) {
        setTimeout(() => this.signalInitialization(), options.maxInitWaitTimeSeconds * 1000);
      }
    }
    else {
      this.initialized = true;
      this.initialization = Promise.resolve();
      options.hooks.emit("clientReady");
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

  async getConfig(): Promise<ProjectConfig | null> {
    this.options.logger.logDebug("AutoPollConfigService.getConfig() called.");

    function logSuccess(logger: LoggerWrapper) {
      logger.logDebug("AutoPollConfigService.getConfig() - returning value from cache.");
    }

    let cacheConfig: ProjectConfig | null = null;
    if (!this.isOffline && !this.initialized) {
      cacheConfig = await this.options.cache.get(this.options.getCacheKey());
      if (!ProjectConfig.isExpired(cacheConfig, this.options.pollIntervalSeconds * 1000)) {
        logSuccess(this.options.logger);
        return cacheConfig;
      }

      this.options.logger.logDebug("AutoPollConfigService.getConfig() - cache is empty or expired, waiting for initialization.");
      await this.waitForInitializationAsync();
    }

    cacheConfig = await this.options.cache.get(this.options.getCacheKey());
    if (!ProjectConfig.isExpired(cacheConfig, this.options.pollIntervalSeconds * 1000)) {
      logSuccess(this.options.logger);
    }
    else {
      this.options.logger.logDebug("AutoPollConfigService.getConfig() - cache is empty or expired.");
    }

    return cacheConfig;
  }

  refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig | null]> {
    this.options.logger.logDebug("AutoPollConfigService.refreshConfigAsync() called.");
    return super.refreshConfigAsync();
  }

  dispose(): void {
    this.options.logger.logDebug("AutoPollConfigService.dispose() called.");
    super.dispose();
    if (this.timerId) {
      this.stopRefreshWorker();
    }
  }

  protected onConfigUpdated(newConfig: ProjectConfig): void {
    super.onConfigUpdated(newConfig);
    this.signalInitialization();
  }

  protected onConfigChanged(newConfig: ProjectConfig): void {
    super.onConfigChanged(newConfig);
    this.options.configChanged();
  }

  protected setOnlineCore(): void {
    this.startRefreshWorker();
  }

  protected setOfflineCore(): void {
    this.stopRefreshWorker();
  }

  private async startRefreshWorker() {
    this.options.logger.logDebug("AutoPollConfigService.startRefreshWorker() called.");

    const delayMs = this.options.pollIntervalSeconds * 1000;

    const latestConfig = await this.options.cache.get(this.options.getCacheKey());
    if (ProjectConfig.isExpired(latestConfig, this.options.pollIntervalSeconds * 1000)) {
      // Even if the service gets disposed immediately, we allow the first refresh for backward compatibility,
      // i.e. to not break usage patterns like this:
      // ```
      // client.getValue("SOME_KEY", false, value => { /* ... */ }, user);
      // client.dispose();
      // ```
      if (!this.isOfflineExactly) {
        await this.refreshConfigCoreAsync(latestConfig);
      }
    }
    else {
      this.signalInitialization();
    }

    this.options.logger.logDebug("AutoPollConfigService.startRefreshWorker() - calling refreshWorkerLogic()'s setTimeout.");
    this.timerId = setTimeout(d => this.refreshWorkerLogic(d), delayMs, delayMs);
  }

  private stopRefreshWorker() {
    this.options.logger.logDebug("AutoPollConfigService.stopRefreshWorker() - clearing setTimeout.");
    clearTimeout(this.timerId);
  }

  private async refreshWorkerLogic(delayMs: number) {
    if (this.disposed) {
      this.options.logger.logDebug("AutoPollConfigService.refreshWorkerLogic() - called on a disposed client.");
      return;
    }

    this.options.logger.logDebug("AutoPollConfigService.refreshWorkerLogic() - called.");

    if (!this.isOffline) {
      const latestConfig = await this.options.cache.get(this.options.getCacheKey());
      await this.refreshConfigCoreAsync(latestConfig);
    }

    this.options.logger.logDebug("AutoPollConfigService.refreshWorkerLogic() - calling refreshWorkerLogic()'s setTimeout.");
    this.timerId = setTimeout(d => this.refreshWorkerLogic(d), delayMs, delayMs);
  }
}
