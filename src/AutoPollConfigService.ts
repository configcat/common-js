import { AutoPollOptions } from "./ConfigCatClientOptions";
import { IConfigService, ConfigServiceBase } from "./ConfigServiceBase";
import { IConfigFetcher } from "./index";
import { ProjectConfig } from "./ProjectConfig";

export class AutoPollConfigService extends ConfigServiceBase implements IConfigService {

    private maxInitWaitTimeStamp: number;
    private configChanged: () => void;
    private timerId: any;

    constructor(configFetcher: IConfigFetcher, autoPollConfig: AutoPollOptions) {

        super(configFetcher, autoPollConfig);

        this.configChanged = autoPollConfig.configChanged;        
        this.startRefreshWorker(autoPollConfig.pollIntervalSeconds * 1000); 
        this.maxInitWaitTimeStamp = new Date().getTime() + (autoPollConfig.maxInitWaitTimeSeconds * 1000);
    }

    async getConfig(): Promise<ProjectConfig> {        
        var p: ProjectConfig = await this.tryReadFromCache(0);        
        if (!p) {
            return this.refreshLogic();
        } else {
            return new Promise(resolve => resolve(p))
        }
    }

    refreshConfigAsync(): Promise<ProjectConfig> {
        return this.refreshLogic();
    }

    dispose(): void {
        clearTimeout(this.timerId);
    }

    private refreshLogic(): Promise<ProjectConfig> {
        
        return new Promise(async resolve => {

            let cachedConfig: ProjectConfig = this.baseConfig.cache.get(this.baseConfig.getCacheKey());
            
            const newConfig = await this.refreshLogicBaseAsync(cachedConfig)
            
            if (!cachedConfig || !ProjectConfig.equals(cachedConfig, newConfig)) {
                
                this.configChanged();
            }

            resolve(newConfig)
        });
    }

    private startRefreshWorker(delay: number){
        this.refreshLogic().then((_) =>{
            this.timerId = setTimeout(
                () => {
                    this.startRefreshWorker(delay);
                },
                delay);
        });
    }

    private async tryReadFromCache(tries: number): Promise<ProjectConfig> {
        
        var p: ProjectConfig = this.baseConfig.cache.get(this.baseConfig.getCacheKey());

        if (this.maxInitWaitTimeStamp > new Date().getTime() && !p) {
            
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
