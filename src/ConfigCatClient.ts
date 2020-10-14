import { IConfigCatKernel } from "./index";
import { AutoPollOptions, ManualPollOptions, LazyLoadOptions, OptionsBase } from "./ConfigCatClientOptions";
import { IConfigService } from "./ConfigServiceBase";
import { AutoPollConfigService } from "./AutoPollConfigService";
import { LazyLoadConfigService } from "./LazyLoadConfigService";
import { ManualPollService } from "./ManualPollService";
import { User, IRolloutEvaluator, RolloutEvaluator } from "./RolloutEvaluator";
import { Setting, RolloutRules, RolloutPercentageItems, ConfigFile } from "./ProjectConfig";

export interface IConfigCatClient {

    /** Returns the value of a feature flag or setting based on it's key */
    getValue(key: string, defaultValue: any, callback: (value: any) => void, user?: User): void;

    /** Returns the value of a feature flag or setting based on it's key */
    getValueAsync(key: string, defaultValue: any, user?: User): Promise<any>;

    /** Downloads the latest feature flag and configuration values */
    forceRefresh(callback: () => void): void;

    /** Downloads the latest feature flag and configuration values */
    forceRefreshAsync(): Promise<any>;

    /** Gets a list of keys for all your feature flags and settings */
    getAllKeys(callback: (value: string[]) => void);

    /** Gets a list of keys for all your feature flags and settings */
    getAllKeysAsync(): Promise<string[]>;

    /** Returns the Variation ID (analytics) of a feature flag or setting based on it's key */
    getVariationId(key: string, defaultVariationId: any, callback: (variationId: string) => void, user?: User): void;

    /** Returns the Variation ID (analytics) of a feature flag or setting based on it's key */
    getVariationIdAsync(key: string, defaultVariationId: any, user?: User): Promise<string>;

    /** Returns the Variation IDs (analytics) of all feature flags or settings */
    getAllVariationIds(callback: (variationIds: string[]) => void, user?: User): void;

    /** Returns the Variation IDs (analytics) of all feature flags or settings */
    getAllVariationIdsAsync(user?: User): Promise<string[]>;

    /** Returns the key of a setting and it's value identified by the given Variation ID (analytics) */
    getKeyAndValue(variationId: string, callback: (settingkeyAndValue: SettingKeyValue) => void): void;

    /** Returns the key of a setting and it's value identified by the given Variation ID (analytics) */
    getKeyAndValueAsync(variationId: string): Promise<SettingKeyValue>;

    /** Releases all resources used by IConfigCatClient */
    dispose(): void;
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

    dispose(): void {
        if (this.configService instanceof AutoPollConfigService){
            this.configService.dispose();
        }
    }

    getValue(key: string, defaultValue: any, callback: (value: any) => void, user?: User): void {
        this.getValueAsync(key, defaultValue, user).then(value => {
            callback(value);
        });
    }

    getValueAsync(key: string, defaultValue: any, user?: User): Promise<any> {
        return new Promise(async (resolve) => {            
            const config = await this.configService.getConfig();            
            var result: any = defaultValue;
            result = this.evaluator.Evaluate(config, key, defaultValue, user).Value;
            resolve(result);
        });
    }

    forceRefresh(callback: () => void): void {
        this.forceRefreshAsync().then(() => {
            callback();
        });
    }

    forceRefreshAsync(): Promise<any> {
        return new Promise(async (resolve) => {
            await this.configService.refreshConfigAsync();
            resolve();
        });
    }

    getAllKeys(callback: (value: string[]) => void) {
        this.getAllKeysAsync().then(value => {
            callback(value);
        })
    }

    getAllKeysAsync(): Promise<string[]> {
        return new Promise(async (resolve) => {
            const config = await this.configService.getConfig();
            if (!config || !config.ConfigJSON || !config.ConfigJSON[ConfigFile.FeatureFlags]) {
                this.options.logger.error("JSONConfig is not present, returning empty array");
                resolve([]);
                return;
            }

            resolve(Object.keys(config.ConfigJSON[ConfigFile.FeatureFlags]));
        });
    }

    getVariationId(key: string, defaultVariationId: any, callback: (variationId: string) => void, user?: User): void {
        this.getVariationIdAsync(key, defaultVariationId, user).then(variationId => {
            callback(variationId);
        });
    }

    getVariationIdAsync(key: string, defaultVariationId: any, user?: User): Promise<string> {
        return new Promise(async (resolve) => {
            const config = await this.configService.getConfig();
            var result: any = defaultVariationId;
            result = this.evaluator.Evaluate(config, key, null, user, defaultVariationId).VariationId;
            resolve(result);
        });
    }

    getAllVariationIds(callback: (variationIds: string[]) => void, user?: User): void {
        this.getAllVariationIdsAsync(user).then(variationIds => {
            callback(variationIds);
        });
    }

    getAllVariationIdsAsync(user?: User): Promise<string[]> {
        return new Promise(async (resolve) => {
            const keys = await this.getAllKeysAsync();

            if (keys.length === 0) {
                resolve([]);
                return;
            }

            const promises = keys.map(key => this.getVariationIdAsync(key, null, user));
            const variationIds = await Promise.all(promises);
            resolve(variationIds);
        });
    }

    getKeyAndValue(variationId: string, callback: (settingkeyAndValue: SettingKeyValue) => void): void {
        this.getKeyAndValueAsync(variationId).then(settingKeyAndValue => {
            callback(settingKeyAndValue); 
        })
    }

    getKeyAndValueAsync(variationId: string): Promise<SettingKeyValue> {
        return new Promise(async (resolve) => {
            const config = await this.configService.getConfig();
            if (!config || !config.ConfigJSON || !config.ConfigJSON[ConfigFile.FeatureFlags]) {
                this.options.logger.error("JSONConfig is not present, returning null");
                resolve(null);
                return;
            }

            const featureFlags = config.ConfigJSON[ConfigFile.FeatureFlags];
            for (let settingKey in featureFlags) {
                if (variationId === featureFlags[settingKey][Setting.VariationId]) {
                    resolve({ settingKey: settingKey, settingValue: featureFlags[settingKey][Setting.Value] });
                    return;
                }

                const rolloutRules = featureFlags[settingKey][Setting.RolloutRules];
                if (rolloutRules && rolloutRules.length > 0) {
                    for (let i: number = 0; i < rolloutRules.length; i++) {
                        const rolloutRule: any = rolloutRules[i];
                        if (variationId === rolloutRule[RolloutRules.VariationId]) {
                            resolve({ settingKey: settingKey, settingValue: rolloutRule[RolloutRules.Value] });
                            return;
                        }
                    }
                }

                const percentageItems = featureFlags[settingKey][Setting.RolloutPercentageItems];
                if (percentageItems && percentageItems.length > 0) {
                    for (let i: number = 0; i < percentageItems.length; i++) {
                        const percentageItem: any = percentageItems[i];
                        if (variationId === percentageItem[RolloutPercentageItems.VariationId]) {
                            resolve({ settingKey: settingKey, settingValue: percentageItem[RolloutPercentageItems.Value] });
                            return;
                        }
                    }
                }
            }

            this.options.logger.error("Could not find the setting for the given variation ID: " + variationId);
            resolve(null);
        });
    }
}

export class SettingKeyValue {
    settingKey: string;
    settingValue: any;
}