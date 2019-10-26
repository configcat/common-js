import { IConfigCatKernel } from ".";
import { AutoPollOptions, ManualPollOptions, LazyLoadOptions, OptionsBase } from "./ConfigCatClientOptions";
import { IConfigService } from "./ConfigServiceBase";
import { AutoPollConfigService } from "./AutoPollConfigService";
import { LazyLoadConfigService } from "./LazyLoadConfigService";
import { ManualPollService } from "./ManualPollService";
import { User, IRolloutEvaluator, RolloutEvaluator } from "./RolloutEvaluator";

export const CONFIG_CHANGE_EVENT_NAME: string = "changed";

/** Client for ConfigCat platform */
export interface IConfigCatClient {

    /** Return a value of the key (Key for programs) */
    getValue(key: string, defaultValue: any, callback: (value: any) => void, user?: User): void;

    getValueAsync(key: string, defaultValue: any, user?: User): Promise<any>;

    /** Refresh the configuration */
    forceRefresh(callback: () => void): void;

    getAllKeys(callback: (value: string[]) => void);
}

export class ConfigCatClient implements IConfigCatClient {
    private configService: IConfigService;
    private evaluator: IRolloutEvaluator;
    private options: OptionsBase;

    constructor(
        options: AutoPollOptions | ManualPollOptions | LazyLoadOptions,
        configCatKernel: IConfigCatKernel) {

        if (!options) {
            throw new Error("Invalid 'options' value");
        }

        this.options = options;

        if (!configCatKernel) {
            throw new Error("Invalid 'configCatKernel' value");
        }

        if (!configCatKernel.cache) {
            throw new Error("Invalid 'configCatKernel.cache' value");
        }

        if (!configCatKernel.configFetcher) {
            throw new Error("Invalid 'configCatKernel.configFetcher' value");
        }

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

    getValue(key: string, defaultValue: any, callback: (value: any) => void, user?: User): void {

        this.configService.getConfig((value) => {
            var result: any = defaultValue;

            result = this.evaluator.Evaluate(value, key, defaultValue, user);

            callback(result);
        });
    }

    getValueAsync(key: string, defaultValue: any, user?: User): Promise<any> {
        return new Promise((resolve, reject) => {
            if (key == undefined) reject(new Error('No key was passed in.'))
            if (defaultValue == undefined) reject(new Error('No default value was passed in.'))
            this.configService.getConfig((value) => {
                var result: any = defaultValue;
    
                result = this.evaluator.Evaluate(value, key, defaultValue, user);
    
                resolve(result);
            });
        });
    }

    forceRefresh(callback: () => void): void {
        this.configService.refreshConfig(callback);
    }

    forceRefreshAsync(): Promise<any> {
        return new Promise((resolve) => {
            this.configService.refreshConfig(resolve);
        });
    }

    getAllKeys(callback: (value: string[]) => void) {
        this.configService.getConfig((value) => {
            if (!value || !value.ConfigJSON) {
                this.options.logger.error("JSONConfig is not present, returning empty array");
                callback([]);
            }

            callback(Object.keys(value.ConfigJSON));
        });
    }
}