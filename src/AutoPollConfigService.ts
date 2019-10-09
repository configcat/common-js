import { AutoPollOptions } from "./ConfigCatClientOptions";
import { IConfigService, ProjectConfig, ConfigServiceBase } from "./ConfigServiceBase";
import { IConfigFetcher, ICache } from ".";

export class AutoPollConfigService extends ConfigServiceBase implements IConfigService {

    private timer;
    private maxInitWaitExpire: Date;
    private configChanged: () => void;

    constructor(configFetcher: IConfigFetcher, cache: ICache, autoPollConfig: AutoPollOptions) {

        super(configFetcher, cache, autoPollConfig);
        
        this.configChanged = autoPollConfig.configChanged;
        this.refreshConfig();
        this.timer = setInterval(() => this.refreshConfig(), autoPollConfig.pollIntervalSeconds * 1000);
    }

    getConfig(callback: (value: ProjectConfig) => void): void {

        var p: ProjectConfig = this.cache.Get(this.baseConfig.apiKey);

        if (!p) {
            this.refreshLogic(callback);
        } else {
            callback(p);
        }
    }

    refreshConfig(callback?: (value: ProjectConfig) => void): void {
        this.refreshLogic(callback);
    }

    private refreshLogic(callback?: (value: ProjectConfig) => void): void {
        let p: ProjectConfig = this.cache.Get(this.baseConfig.apiKey);

        this.refreshLogicBase(p, (newConfig) => {

            if (callback) {
                callback(newConfig);
            }

            if (!p || p.HttpETag !== newConfig.HttpETag) {
                this.configChanged();
            }
        });
    }
}
