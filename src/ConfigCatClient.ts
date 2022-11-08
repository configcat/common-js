import { IConfigCatKernel, OptionsForPollingMode, PollingMode } from "./index";
import { AutoPollOptions, ManualPollOptions, LazyLoadOptions, OptionsBase, ConfigCatClientOptions } from "./ConfigCatClientOptions";
import { IConfigService } from "./ConfigServiceBase";
import { AutoPollConfigService } from "./AutoPollConfigService";
import { LazyLoadConfigService } from "./LazyLoadConfigService";
import { ManualPollService } from "./ManualPollService";
import { User, IRolloutEvaluator, RolloutEvaluator } from "./RolloutEvaluator";
import { Setting, RolloutRule, RolloutPercentageItem, ConfigFile } from "./ProjectConfig";
import { OverrideBehaviour } from "./FlagOverrides";
import { getSettingsFromConfig } from "./Utils";
import { ConfigCatClientCache } from "./ConfigCatClientCache";

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
    getAllKeys(callback: (value: string[]) => void): void;

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
    getKeyAndValue(variationId: string, callback: (settingkeyAndValue: SettingKeyValue | null) => void): void;

    /** Returns the key of a setting and it's value identified by the given Variation ID (analytics) */
    getKeyAndValueAsync(variationId: string): Promise<SettingKeyValue | null>;

    /** Releases all resources used by IConfigCatClient */
    dispose(): void;

    /** Returns the values of all feature flags or settings */
    getAllValues(callback: (result: SettingKeyValue[]) => void, user?: User): void;

    /** Returns the values of all feature flags or settings */
    getAllValuesAsync(user?: User): Promise<SettingKeyValue[]>;

    /** Sets the default user for feature flag evaluations. 
     * In case the getValue function isn't called with a UserObject, this default user will be used instead. */
    setDefaultUser(defaultUser: User): void;

    /** Clears the default user. */
    clearDefaultUser(): void;
}

const clientInstanceCache = new ConfigCatClientCache();

export class ConfigCatClient implements IConfigCatClient {
    private configService?: IConfigService;
    private evaluator: IRolloutEvaluator;
    private options: OptionsBase;
    private defaultUser?: User;

    public static get<TMode extends PollingMode>(sdkKey: string, pollingMode: TMode, options: OptionsForPollingMode<TMode> | undefined | null, configCatKernel: IConfigCatKernel) {
        if (!sdkKey) {
            throw new Error("Invalid 'sdkKey' value");
        }

        const optionsClass =
            pollingMode === PollingMode.AutoPoll ? AutoPollOptions :
            pollingMode === PollingMode.ManualPoll ? ManualPollOptions :
            pollingMode === PollingMode.LazyLoad ? LazyLoadOptions :
            (() => { throw new Error("Invalid 'pollingMode' value"); })();

        const actualOptions = new optionsClass(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.cache);

        const [instance, instanceAlreadyCreated] = clientInstanceCache.getOrCreate(actualOptions, configCatKernel);

        if (instanceAlreadyCreated && options) {
            actualOptions.logger.warn(`Client for SDK key '${sdkKey}' is already created and will be reused; configuration action is being ignored.`);
        }

        return instance;
    }

    constructor(
        options: ConfigCatClientOptions,
        configCatKernel: IConfigCatKernel) {

        if (!options) {
            throw new Error("Invalid 'options' value");
        }

        this.options = options;

        this.options.logger.debug('Initializing ConfigCatClient. Options: ' + JSON.stringify(this.options));

        if (!configCatKernel) {
            throw new Error("Invalid 'configCatKernel' value");
        }

        if (!configCatKernel.configFetcher) {
            throw new Error("Invalid 'configCatKernel.configFetcher' value");
        }

        if (options?.defaultUser) {
            this.setDefaultUser(options.defaultUser);
        }

        this.evaluator = new RolloutEvaluator(options.logger);

        if (options.flagOverrides?.behaviour != OverrideBehaviour.LocalOnly) {
            const configServiceClass =
                options instanceof AutoPollOptions ? AutoPollConfigService :
                options instanceof ManualPollOptions ? ManualPollService :
                options instanceof LazyLoadOptions ? LazyLoadConfigService :
                (() => { throw new Error("Invalid 'options' value"); })();

            this.configService = new configServiceClass(configCatKernel.configFetcher, options);
        }
    }

    dispose(): void {
        this.options.logger.debug("dispose() called");
        if (this.configService instanceof AutoPollConfigService) {
            this.options.logger.debug("Disposing AutoPollConfigService");
            this.configService.dispose();
        }
    }

    getValue(key: string, defaultValue: any, callback: (value: any) => void, user?: User): void {
        this.options.logger.debug("getValue() called.");
        this.getValueAsync(key, defaultValue, user).then(value => {
            callback(value);
        });
    }

    getValueAsync(key: string, defaultValue: any, user?: User): Promise<any> {
        this.options.logger.debug("getValueAsync() called.");
        return new Promise(async (resolve) => {
            const settings = await this.getSettingsAsync();
            if (!settings) {
                this.options.logger.error("config.json is not present. Returning default value: '" + defaultValue + "'.");
                resolve(defaultValue);
                return;
            }

            var result: any = this.evaluator.Evaluate(settings, key, defaultValue, user ?? this.defaultUser).Value;
            resolve(result);
        });
    }

    forceRefresh(callback: () => void): void {
        this.options.logger.debug("forceRefresh() called.");
        this.forceRefreshAsync().then(() => {
            callback();
        });
    }

    forceRefreshAsync(): Promise<void> {
        this.options.logger.debug("forceRefreshAsync() called.");
        return new Promise(async (resolve) => {
            await this.configService?.refreshConfigAsync();
            resolve();
        });
    }

    getAllKeys(callback: (value: string[]) => void): void {
        this.options.logger.debug("getAllKeys() called.");
        this.getAllKeysAsync().then(value => {
            callback(value);
        })
    }

    getAllKeysAsync(): Promise<string[]> {
        this.options.logger.debug("getAllKeysAsync() called.");
        return new Promise(async (resolve) => {
            const settings = await this.getSettingsAsync();
            if (!settings) {
                this.options.logger.error("config.json is not present, returning empty array");
                resolve([]);
                return;
            }

            resolve(Object.keys(settings));
        });
    }

    getVariationId(key: string, defaultVariationId: any, callback: (variationId: string) => void, user?: User): void {
        this.options.logger.debug("getVariationId() called.");
        this.getVariationIdAsync(key, defaultVariationId, user).then(variationId => {
            callback(variationId);
        });
    }

    getVariationIdAsync(key: string, defaultVariationId: any, user?: User): Promise<string> {
        this.options.logger.debug("getVariationIdAsync() called.");
        return new Promise(async (resolve) => {
            const settings = await this.getSettingsAsync();
            if (!settings) {
                this.options.logger.error("config.json is not present. Returning default variationId: '" + defaultVariationId + "'.");
                resolve(defaultVariationId);
                return;
            }

            var result: string = this.evaluator.Evaluate(settings, key, null, user ?? this.defaultUser, defaultVariationId).VariationId;
            resolve(result);
        });
    }

    getAllVariationIds(callback: (variationIds: string[]) => void, user?: User): void {
        this.options.logger.debug("getAllVariationIds() called.");
        this.getAllVariationIdsAsync(user).then(variationIds => {
            callback(variationIds);
        });
    }

    getAllVariationIdsAsync(user?: User): Promise<string[]> {
        this.options.logger.debug("getAllVariationIdsAsync() called.");
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

    getKeyAndValue(variationId: string, callback: (settingkeyAndValue: SettingKeyValue | null) => void): void {
        this.options.logger.debug("getKeyAndValue() called.");
        this.getKeyAndValueAsync(variationId).then(settingKeyAndValue => {
            callback(settingKeyAndValue);
        })
    }

    getKeyAndValueAsync(variationId: string): Promise<SettingKeyValue | null> {
        this.options.logger.debug("getKeyAndValueAsync() called.");
        return new Promise(async (resolve) => {
            const settings = await this.getSettingsAsync();
            if (!settings) {
                this.options.logger.error("config.json is not present, returning empty array");
                resolve(null);
                return;
            }

            for (let settingKey in settings) {
                if (variationId === settings[settingKey].variationId) {
                    resolve({ settingKey: settingKey, settingValue: settings[settingKey].value });
                    return;
                }

                const rolloutRules = settings[settingKey].rolloutRules;
                if (rolloutRules && rolloutRules.length > 0) {
                    for (let i: number = 0; i < rolloutRules.length; i++) {
                        const rolloutRule: RolloutRule = rolloutRules[i];
                        if (variationId === rolloutRule.variationId) {
                            resolve({ settingKey: settingKey, settingValue: rolloutRule.value });
                            return;
                        }
                    }
                }

                const percentageItems = settings[settingKey].rolloutPercentageItems;
                if (percentageItems && percentageItems.length > 0) {
                    for (let i: number = 0; i < percentageItems.length; i++) {
                        const percentageItem: RolloutPercentageItem = percentageItems[i];
                        if (variationId === percentageItem.variationId) {
                            resolve({ settingKey: settingKey, settingValue: percentageItem.value });
                            return;
                        }
                    }
                }
            }

            this.options.logger.error("Could not find the setting for the given variation ID: " + variationId);
            resolve(null);
        });
    }

    getAllValues(callback: (result: SettingKeyValue[]) => void, user?: User): void {
        this.options.logger.debug("getAllValues() called.");
        this.getAllValuesAsync(user).then(value => {
            callback(value);
        });
    }

    getAllValuesAsync(user?: User): Promise<SettingKeyValue[]> {
        this.options.logger.debug("getAllValuesAsync() called.");
        return new Promise(async (resolve) => {
            const settings = await this.getSettingsAsync();
            if (!settings) {
                this.options.logger.error("config.json is not present, returning empty array");
                resolve([]);
                return;
            }

            const keys: string[] = Object.keys(settings);

            let result: SettingKeyValue[] = [];

            keys.forEach(key => {
                result.push({
                    settingKey: key,
                    settingValue: this.evaluator.Evaluate(settings, key, undefined, user ?? this.defaultUser).Value
                });
            });

            resolve(result);
        });
    }

    setDefaultUser(defaultUser: User) {
        this.defaultUser = defaultUser;
    }

    clearDefaultUser() {
        this.defaultUser = undefined;
    }

    private getSettingsAsync(): Promise<{ [name: string]: Setting } | null> {
        this.options.logger.debug("getSettingsAsync() called.");
        return new Promise(async (resolve) => {
            if (this.options?.flagOverrides) {
                const localSettings = await this.options.flagOverrides.dataSource.getOverrides();
                if (this.options.flagOverrides.behaviour == OverrideBehaviour.LocalOnly) {
                    resolve(localSettings);
                    return;
                }
                const remoteConfig = await this.configService?.getConfig();
                const remoteSettings = getSettingsFromConfig(remoteConfig?.ConfigJSON);

                if (this.options.flagOverrides.behaviour == OverrideBehaviour.LocalOverRemote) {
                    resolve({ ...remoteSettings, ...localSettings });
                    return;
                } else if (this.options.flagOverrides.behaviour == OverrideBehaviour.RemoteOverLocal) {
                    resolve({ ...localSettings, ...remoteSettings });
                    return;
                }
            }

            const config = await this.configService?.getConfig();
            if (!config || !config.ConfigJSON || !config.ConfigJSON[ConfigFile.FeatureFlags]) {
                resolve(null);
                return;
            }

            resolve(getSettingsFromConfig(config.ConfigJSON));
        });
    }
}

export class SettingKeyValue {
    settingKey!: string;
    settingValue!: any;
}
