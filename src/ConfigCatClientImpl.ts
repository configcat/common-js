import { IConfigFetcher, ICache, IConfigCatKernel } from ".";
import { AutoPollOptions, ManualPollOptions, LazyLoadOptions } from "./ConfigCatClientOptions";
import { IConfigService } from "./ProjectConfigService";
import { AutoPollConfigService } from "./AutoPollConfigService";
import { InMemoryCache } from "./Cache";
import { LazyLoadConfigService } from "./LazyLoadConfigService";
import { ManualPollService } from "./ManualPollService";
import { User, IRolloutEvaluator, RolloutEvaluator } from "./RolloutEvaluator";

declare const require: any;

const VERSION: string = require("../package.json").version;
export const CONFIG_CHANGE_EVENT_NAME: string = "changed";

/** Client for ConfigCat platform */
export interface IConfigCatClient {

    /** Return a value of the key (Key for programs) */
    getValue(key: string, defaultValue: any, user: User, callback: (value: any) => void): void;

    /** Refresh the configuration */
    forceRefresh(callback: () => void): void;
}

export class ConfigCatClientImpl implements IConfigCatClient {
    private configService: IConfigService;
    private evaluator: IRolloutEvaluator;

    constructor(
        options: AutoPollOptions | ManualPollOptions | LazyLoadOptions,
        configCatKernel: IConfigCatKernel) {

        this.evaluator = new RolloutEvaluator(options.logger);

        if (options && options instanceof LazyLoadOptions) {                        
            this.configService = new LazyLoadConfigService(configCatKernel.configFetcher, configCatKernel.cache, <LazyLoadOptions>options);
        } else if (options && options instanceof ManualPollOptions) {
            this.configService = new ManualPollService(configCatKernel.configFetcher, configCatKernel.cache, <ManualPollOptions>options);
        } else if (options && options instanceof AutoPollOptions) {
            this.configService = new AutoPollConfigService(configCatKernel.configFetcher, configCatKernel.cache, <AutoPollOptions>options);
        } else {
            throw new Error("Invalid 'options' value");
        }
    }

    getValue(key: string, defaultValue: any, user: User, callback: (value: any) => void): void {

        this.configService.getConfig((value) => {
            var result: any = defaultValue;

            result = this.evaluator.Evaluate(value, key, defaultValue, user);

            callback(result);
        });
    }

    forceRefresh(callback: () => void): void {
        this.configService.refreshConfig(callback);
    }
}