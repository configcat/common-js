import { AutoPollOptions } from "./ConfigCatClientOptions";
import { IConfigService, ConfigServiceBase } from "./ConfigServiceBase";
import { IConfigCatLogger, IConfigFetcher } from "./index";
import { ProjectConfig } from "./ProjectConfig";
import { delay } from "./Utils";

export class AutoPollConfigService extends ConfigServiceBase<AutoPollOptions> implements IConfigService {

    private initialized: boolean;
    private initialization: Promise<void>;
    private signalInitialization: () => void = undefined!; // the initial value is for keeping the TS compiler happy
    private timerId?: ReturnType<typeof setTimeout>;
    private disposed = false;

    constructor(configFetcher: IConfigFetcher, options: AutoPollOptions) {

        super(configFetcher, options);

        if (options.maxInitWaitTimeSeconds > 0) {
            this.initialized = false;

            // This promise will be resolved when
            // 1. the cache contains a valid config at startup (see startRefreshWorker) or
            // 2. config.json is downloaded the first time (see onConfigUpdated) or
            // 3. maxInitWaitTimeSeconds has passed (see the setTimeout call below).
            this.initialization = new Promise(resolve => this.signalInitialization = () => {
                this.initialized = true;
                resolve();
            });

            setTimeout(() => this.signalInitialization(), options.maxInitWaitTimeSeconds * 1000);
        }
        else {
            this.initialized = true;
            this.initialization = Promise.resolve();
        }

        this.startRefreshWorker(options.pollIntervalSeconds * 1000);
    }

    private async waitForInitializationAsync(): Promise<boolean> {
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
        this.options.logger.debug("AutoPollConfigService.getConfig() called.");

        function logSuccess(logger: IConfigCatLogger) {
            logger.debug("AutoPollConfigService.getConfig() - returning value from cache.");
        }

        let cacheConfig: ProjectConfig | null = null;
        if (!this.initialized) {
            cacheConfig = await this.options.cache.get(this.options.getCacheKey());
            if (!ProjectConfig.isExpired(cacheConfig, this.options.pollIntervalSeconds * 1000)) {
                logSuccess(this.options.logger);
                return cacheConfig;
            }

            this.options.logger.debug("AutoPollConfigService.getConfig() - cache is empty or expired, waiting for initialization.");
            await this.waitForInitializationAsync();
        }

        cacheConfig = await this.options.cache.get(this.options.getCacheKey());
        if (!ProjectConfig.isExpired(cacheConfig, this.options.pollIntervalSeconds * 1000)) {
            logSuccess(this.options.logger);
        }
        else {
            this.options.logger.debug("AutoPollConfigService.getConfig() - cache is empty or expired.");
        }
      
        return cacheConfig;
    }

    refreshConfigAsync(): Promise<ProjectConfig | null> {
        this.options.logger.debug("AutoPollConfigService.refreshConfigAsync() called.");
        return super.refreshConfigAsync();
    }

    dispose(): void {
        this.options.logger.debug("AutoPollConfigService.dispose() called.");
        this.disposed = true;
        if (this.timerId) {
            this.options.logger.debug("AutoPollConfigService.dispose() - clearing setTimeout.");
            clearTimeout(this.timerId);
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

    private async startRefreshWorker(delayMs: number) {
        this.options.logger.debug("AutoPollConfigService.startRefreshWorker() called.");

        const latestConfig = await this.options.cache.get(this.options.getCacheKey());
        if (ProjectConfig.isExpired(latestConfig, this.options.pollIntervalSeconds * 1000)) {
            await this.refreshConfigCoreAsync(latestConfig);
        }
        else {
            this.signalInitialization();
        }

        this.options.logger.debug("AutoPollConfigService.startRefreshWorker() - calling refreshWorkerLogic()'s setTimeout.");
        this.timerId = setTimeout(d => this.refreshWorkerLogic(d), delayMs, delayMs);
    }

    private async refreshWorkerLogic(delayMs: number) {
        if (this.disposed) {
            this.options.logger.debug("AutoPollConfigService.refreshWorkerLogic() - called on a disposed client.");
            return;
        }

        this.options.logger.debug("AutoPollConfigService.refreshWorkerLogic() - called.");

        const latestConfig = await this.options.cache.get(this.options.getCacheKey());
        await this.refreshConfigCoreAsync(latestConfig);

        this.options.logger.debug("AutoPollConfigService.refreshWorkerLogic() - calling refreshWorkerLogic()'s setTimeout.");
        this.timerId = setTimeout(d => this.refreshWorkerLogic(d), delayMs, delayMs);
    }
}
