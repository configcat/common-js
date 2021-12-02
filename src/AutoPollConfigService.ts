import { AutoPollOptions } from "./ConfigCatClientOptions";
import { IConfigService, ConfigServiceBase } from "./ConfigServiceBase";
import { IConfigFetcher } from "./index";
import { ProjectConfig } from "./ProjectConfig";

export class AutoPollConfigService extends ConfigServiceBase implements IConfigService {

    private maxInitWaitTimeStamp: number;
    private configChanged: () => void;
    private timerId: any;
    private autoPollConfig: AutoPollOptions;

    constructor(configFetcher: IConfigFetcher, autoPollConfig: AutoPollOptions) {

        super(configFetcher, autoPollConfig);

        this.configChanged = autoPollConfig.configChanged;
        this.autoPollConfig = autoPollConfig;
        this.startRefreshWorker(autoPollConfig.pollIntervalSeconds * 1000);
        this.maxInitWaitTimeStamp = new Date().getTime() + (autoPollConfig.maxInitWaitTimeSeconds * 1000);
    }

    async getConfig(): Promise<ProjectConfig | null> {
        var p = await this.tryReadFromCache(0);
        if (!p) {
            return this.refreshLogic(true);
        } else {
            return new Promise(resolve => resolve(p))
        }
    }

    refreshConfigAsync(): Promise<ProjectConfig | null> {
        return this.refreshLogic(true);
    }

    dispose(): void {
        clearTimeout(this.timerId);
    }

    private refreshLogic(forceUpdateCache: boolean): Promise<ProjectConfig | null> {

        return new Promise(async resolve => {

            let cachedConfig = await this.baseConfig.cache.get(this.baseConfig.getCacheKey());

            const newConfig = await this.refreshLogicBaseAsync(cachedConfig, forceUpdateCache)

            let weDontHaveCachedYetButHaveNew = !cachedConfig && newConfig;
            let weHaveBothButTheyDiffers = cachedConfig && newConfig && !ProjectConfig.equals(cachedConfig, newConfig);

            if (weDontHaveCachedYetButHaveNew || weHaveBothButTheyDiffers) {
                this.configChanged();
            }

            resolve(newConfig)
        });
    }

    private startRefreshWorker(delay: number) {
        this.refreshLogic(false).then((_) => {
            this.timerId = setTimeout(
                () => {
                    this.startRefreshWorker(delay);
                },
                delay);
        });
    }

    private async tryReadFromCache(tries: number): Promise<ProjectConfig | null> {

        let p = await this.baseConfig.cache.get(this.baseConfig.getCacheKey());

        if (this.maxInitWaitTimeStamp > new Date().getTime()
            && (
                // Wait for maxInitWaitTimeStamp in case the cache is empty
                !p
                // Wait for maxInitWaitTimeStamp in case of an expired cache (if its timestamp is older than the pollIntervalSeconds)
                || p.Timestamp < new Date().getTime() - this.autoPollConfig.pollIntervalSeconds * 1000
            )
        ) {

            var diff: number = this.maxInitWaitTimeStamp - new Date().getTime();
            var delay = 30 + (tries * tries * 20);

            await this.sleep(Math.min(diff, delay));

            tries++;

            return this.tryReadFromCache(tries);
        }

        return new Promise(resolve => resolve(p))
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
