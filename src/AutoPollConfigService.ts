import { AutoPollOptions } from "./ConfigCatClientOptions";
import { IConfigService, ProjectConfig, ConfigServiceBase } from "./ConfigServiceBase";
import { IConfigFetcher, ICache } from ".";

export class AutoPollConfigService extends ConfigServiceBase implements IConfigService {

    private maxInitWaitExpire: Date;
    private configChanged: () => void;

    constructor(configFetcher: IConfigFetcher, cache: ICache, autoPollConfig: AutoPollOptions) {

        super(configFetcher, cache, autoPollConfig);

        this.configChanged = autoPollConfig.configChanged;
        this.setIntervalAsync(() => this.refreshConfigAsync(), autoPollConfig.pollIntervalSeconds * 1000);
    }

    getConfig(): Promise<ProjectConfig> {

        var p: ProjectConfig = this.cache.Get(this.baseConfig.apiKey);

        if (!p) {
            return this.refreshLogic();
        } else {
            return new Promise(resolve => resolve(p))
        }
    }

    refreshConfigAsync(): Promise<ProjectConfig> {
        return this.refreshLogic();
    }

    private refreshLogic(): Promise<ProjectConfig> {
        return new Promise(async resolve => {

            let p: ProjectConfig = this.cache.Get(this.baseConfig.apiKey);
            const newConfig = await this.refreshLogicBaseAsync(p)

            if (!p || p.HttpETag !== newConfig.HttpETag) {
                this.configChanged();
            }

            resolve(newConfig)
        });
    }

    private setIntervalAsync = (fn, ms) => {
        fn().then(() => {
            setTimeout(() => this.setIntervalAsync(fn, ms), ms);
        });
    };
}
