import { AutoPollOptions } from "./ConfigCatClientOptions";
import { IConfigService, ConfigServiceBase } from "./ConfigServiceBase";
import { IConfigFetcher } from "./index";
import { ProjectConfig } from "./ProjectConfig";

export class AutoPollConfigService extends ConfigServiceBase implements IConfigService {

    private maxInitWaitTimeStamp: number;
    private configChanged: () => void;
    private timerId: any;
    private autoPollConfig: AutoPollOptions;
    private disposed = false;

    constructor(configFetcher: IConfigFetcher, autoPollConfig: AutoPollOptions) {

        super(configFetcher, autoPollConfig);

        this.configChanged = autoPollConfig.configChanged;
        this.autoPollConfig = autoPollConfig;
        this.startRefreshWorker(autoPollConfig.pollIntervalSeconds * 1000);
        this.maxInitWaitTimeStamp = new Date().getTime() + (autoPollConfig.maxInitWaitTimeSeconds * 1000);
    }

    async getConfig(): Promise<ProjectConfig | null> {
        this.autoPollConfig.logger.debug("AutoPollConfigService.getConfig() called.");
        var p = await this.tryReadFromCache(0);
        if (!p) {
            this.autoPollConfig.logger.debug("AutoPollConfigService.getConfig() - cache is empty, refreshing the cache.");
            return this.refreshLogic(true);
        } else {
            this.autoPollConfig.logger.debug("AutoPollConfigService.getConfig() - returning value from cache.");
            return new Promise(resolve => resolve(p))
        }
    }

    refreshConfigAsync(): Promise<ProjectConfig | null> {
        this.autoPollConfig.logger.debug("AutoPollConfigService.refreshConfigAsync() called.");
        return this.refreshLogic(true);
    }

    dispose(): void {
        this.autoPollConfig.logger.debug("AutoPollConfigService.dispose() called.");
        this.disposed = true;
        if (this.timerId) {
            this.autoPollConfig.logger.debug("AutoPollConfigService.dispose() - clearing setTimeout.");
            clearTimeout(this.timerId);
        }
    }

    private refreshLogic(forceUpdateCache: boolean): Promise<ProjectConfig | null> {

        this.autoPollConfig.logger.debug("AutoPollConfigService.refreshLogic() - called.");
        return new Promise(async resolve => {

            let cachedConfig = await this.baseConfig.cache.get(this.baseConfig.getCacheKey());

            const newConfig = await this.refreshLogicBaseAsync(cachedConfig, forceUpdateCache)

            let weDontHaveCachedYetButHaveNew = !cachedConfig && newConfig;
            let weHaveBothButTheyDiffers = cachedConfig && newConfig && !ProjectConfig.equals(cachedConfig, newConfig);

            this.autoPollConfig.logger.debug("AutoPollConfigService.refreshLogic() - weDontHaveCachedYetButHaveNew: ." + weDontHaveCachedYetButHaveNew + ". weHaveBothButTheyDiffers: " + weHaveBothButTheyDiffers + ".");
            if (weDontHaveCachedYetButHaveNew || weHaveBothButTheyDiffers) {
                this.configChanged();
            }

            resolve(newConfig)
        });
    }

    private startRefreshWorker(delay: number) {
        this.autoPollConfig.logger.debug("AutoPollConfigService.startRefreshWorker() called.");
        this.refreshLogic(true).then((_) => {
            this.autoPollConfig.logger.debug("AutoPollConfigService.startRefreshWorker() - calling refreshWorkerLogic()'s setTimeout.");
            setTimeout(() => this.refreshWorkerLogic(delay), delay);
        });
    }

    private refreshWorkerLogic(delay: number) {

        if (this.disposed) {
            this.autoPollConfig.logger.debug("AutoPollConfigService.refreshWorkerLogic() - called on a disposed client.");
            return;
        }

        this.autoPollConfig.logger.debug("AutoPollConfigService.refreshWorkerLogic() - called.");
        this.refreshLogic(false).then((_) => {
            this.autoPollConfig.logger.debug("AutoPollConfigService.refreshWorkerLogic() - calling refreshWorkerLogic()'s setTimeout.");
            this.timerId = setTimeout(
                () => {
                    this.refreshWorkerLogic(delay);
                },
                delay);
        });
    }

    private async tryReadFromCache(tries: number): Promise<ProjectConfig | null> {

        this.autoPollConfig.logger.debug("AutoPollConfigService.tryReadFromCache() - called. Tries: " + tries + ".");
        let p = await this.baseConfig.cache.get(this.baseConfig.getCacheKey());

        if (this.maxInitWaitTimeStamp > new Date().getTime()
            && (
                // Wait for maxInitWaitTimeStamp in case the cache is empty
                !p
                // Wait for maxInitWaitTimeStamp in case of an expired cache (if its timestamp is older than the pollIntervalSeconds)
                || p.Timestamp < new Date().getTime() - this.autoPollConfig.pollIntervalSeconds * 1000
            )
        ) {
            if (!p) {
                this.autoPollConfig.logger.debug("AutoPollConfigService.tryReadFromCache() - waiting for maxInitWaitTimeStamp because cache is empty.");
            } else {
                this.autoPollConfig.logger.debug("AutoPollConfigService.tryReadFromCache() - waiting for maxInitWaitTimeStamp because cache is expired.");
            }
            var diff: number = this.maxInitWaitTimeStamp - new Date().getTime();
            var delay = 30 + (tries * tries * 20);

            await this.sleep(Math.min(diff, delay));

            tries++;

            return this.tryReadFromCache(tries);
        }

        this.autoPollConfig.logger.debug("AutoPollConfigService.tryReadFromCache() - returning value from cache.");
        return new Promise(resolve => resolve(p))
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
