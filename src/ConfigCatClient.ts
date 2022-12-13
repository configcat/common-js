import { AutoPollConfigService } from "./AutoPollConfigService";
import type { ICache } from "./Cache";
import { AutoPollOptions, ConfigCatClientOptions, LazyLoadOptions, ManualPollOptions, OptionsBase, OptionsForPollingMode, PollingMode } from "./ConfigCatClientOptions";
import { IConfigCatLogger, LoggerWrapper } from "./ConfigCatLogger";
import type { IConfigFetcher } from "./ConfigFetcher";
import { IConfigService, RefreshResult } from "./ConfigServiceBase";
import type { IEventEmitter } from "./EventEmitter";
import { OverrideBehaviour } from "./FlagOverrides";
import type { HookEvents, Hooks, IProvidesHooks } from "./Hooks";
import { LazyLoadConfigService } from "./LazyLoadConfigService";
import { ManualPollConfigService } from "./ManualPollConfigService";
import { ConfigFile, ProjectConfig, RolloutPercentageItem, RolloutRule, Setting } from "./ProjectConfig";
import { checkSettingsAvailable, evaluate, evaluateAll, evaluateAllVariationIds, evaluateVariationId, evaluationDetailsFromDefaultValue, evaluationDetailsFromDefaultVariationId, IEvaluationDetails, IRolloutEvaluator, RolloutEvaluator, User } from "./RolloutEvaluator";
import { errorToString, getSettingsFromConfig, getTimestampAsDate } from "./Utils";

export interface IConfigCatClient extends IProvidesHooks {

    /** Returns the value of a feature flag or setting based on it's key
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getValueAsync() method instead.
     */
    getValue(key: string, defaultValue: any, callback: (value: any) => void, user?: User): void;

    /** Returns the value of a feature flag or setting based on it's key */
    getValueAsync(key: string, defaultValue: any, user?: User): Promise<any>;

    /** Returns the value along with evaluation details of a feature flag or setting based on it's key
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getValueDetailsAsync() method instead.
     */
    getValueDetails(key: string, defaultValue: any, callback: (evaluationDetails: IEvaluationDetails) => void, user?: User): void;

    /** Returns the value along with evaluation details of a feature flag or setting based on it's key */
    getValueDetailsAsync(key: string, defaultValue: any, user?: User): Promise<IEvaluationDetails>;

    /** Downloads the latest feature flag and configuration values
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the forceRefreshAsync() method instead.
     */
    forceRefresh(callback: (result: RefreshResult) => void): void;

    /** Downloads the latest feature flag and configuration values */
    forceRefreshAsync(): Promise<RefreshResult>;

    /** Gets a list of keys for all your feature flags and settings
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getAllKeysAsync() method instead.
     */
    getAllKeys(callback: (value: string[]) => void): void;

    /** Gets a list of keys for all your feature flags and settings */
    getAllKeysAsync(): Promise<string[]>;

    /** Returns the Variation ID (analytics) of a feature flag or setting based on it's key
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getValueDetails() method instead.
     */
    getVariationId(key: string, defaultVariationId: any, callback: (variationId: string) => void, user?: User): void;

    /** Returns the Variation ID (analytics) of a feature flag or setting based on it's key
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getValueDetailsAsync() method instead.
     */
    getVariationIdAsync(key: string, defaultVariationId: any, user?: User): Promise<string>;

    /** Returns the Variation IDs (analytics) of all feature flags or settings
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getAllValueDetails() method instead.
     */
    getAllVariationIds(callback: (variationIds: string[]) => void, user?: User): void;

    /** Returns the Variation IDs (analytics) of all feature flags or settings
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getAllValueDetailsAsync() method instead.
     */
    getAllVariationIdsAsync(user?: User): Promise<string[]>;

    /** Returns the key of a setting and it's value identified by the given Variation ID (analytics)
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getKeyAndValueAsync() method instead.
     */
    getKeyAndValue(variationId: string, callback: (settingkeyAndValue: SettingKeyValue | null) => void): void;

    /** Returns the key of a setting and it's value identified by the given Variation ID (analytics) */
    getKeyAndValueAsync(variationId: string): Promise<SettingKeyValue | null>;

    /** Releases all resources used by IConfigCatClient */
    dispose(): void;

    /** Returns the values of all feature flags or settings
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getAllValuesAsync() method instead.
     */
    getAllValues(callback: (result: SettingKeyValue[]) => void, user?: User): void;

    /** Returns the values of all feature flags or settings */
    getAllValuesAsync(user?: User): Promise<SettingKeyValue[]>;

    /** Returns the values along with evaluation details of all feature flags or settings
     * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please use the getAllValueDetailsAsync() method instead.
     */
    getAllValueDetails(callback: (result: IEvaluationDetails[]) => void, user?: User): void;

    /** Returns the values along with evaluation details of all feature flags or settings */
    getAllValueDetailsAsync(user?: User): Promise<IEvaluationDetails[]>;

    /** Sets the default user for feature flag evaluations. 
     * In case the getValue function isn't called with a UserObject, this default user will be used instead. */
    setDefaultUser(defaultUser: User): void;

    /** Clears the default user. */
    clearDefaultUser(): void;

    /** True when the client is configured not to initiate HTTP requests, otherwise false. */
    get isOffline(): boolean;

    /** Configures the client to allow HTTP requests. */
    setOnline(): void;

    /** Configures the client to not initiate HTTP requests and work only from its cache. */
    setOffline(): void;
}

export interface IConfigCatKernel {
    configFetcher: IConfigFetcher;
    /**
     * Default ICache implementation.
     */
    cache?: ICache;
    sdkType: string;
    sdkVersion: string;
    eventEmitterFactory?: () => IEventEmitter;
}

export class ConfigCatClientCache {
    private instances: Record<string, [WeakRef<ConfigCatClient>, object]> = {};

    public getOrCreate(options: ConfigCatClientOptions, configCatKernel: IConfigCatKernel): [ConfigCatClient, boolean] {
        let instance: ConfigCatClient | undefined;

        const cachedInstance = this.instances[options.apiKey];
        if (cachedInstance) {
            const [weakRef] = cachedInstance;
            instance = weakRef.deref();
            if (instance) {
                return [instance, true];
            }
        }

        const token = {};
        instance = new ConfigCatClient(options, configCatKernel, token);
        this.instances[options.apiKey] = [new WeakRef(instance), token];
        return [instance, false];
    }

    public remove(sdkKey: string, cacheToken: object): boolean {
        const cachedInstance = this.instances[sdkKey];

        if (cachedInstance) {
            const [weakRef, token] = cachedInstance;
            const instanceIsAvailable = !!weakRef.deref();
            if (!instanceIsAvailable || token === cacheToken) {
                delete this.instances[sdkKey];
                return instanceIsAvailable;
            }
        }

        return false;
    }

    public clear(): ConfigCatClient[] {
        const removedInstances: ConfigCatClient[] = [];
        for (let [sdkKey, [weakRef]] of Object.entries(this.instances)) {
            let instance = weakRef.deref();
            if (instance) {
                removedInstances.push(instance);
            }
            delete this.instances[sdkKey];
        }
        return removedInstances;
    }
}

const clientInstanceCache = new ConfigCatClientCache();

type SettingsWithRemoteConfig = [{ [name: string]: Setting } | null, ProjectConfig | null];

export class ConfigCatClient implements IConfigCatClient {
    private configService?: IConfigService;
    private evaluator: IRolloutEvaluator;
    private options: OptionsBase;
    private defaultUser?: User;
    private suppressFinalize: () => void;

    private static get instanceCache() { return clientInstanceCache; };

    public static get<TMode extends PollingMode>(sdkKey: string, pollingMode: TMode, options: OptionsForPollingMode<TMode> | undefined | null, configCatKernel: IConfigCatKernel): IConfigCatClient {
        if (!sdkKey) {
            throw new Error("Invalid 'sdkKey' value");
        }

        const optionsClass =
            pollingMode === PollingMode.AutoPoll ? AutoPollOptions :
            pollingMode === PollingMode.ManualPoll ? ManualPollOptions :
            pollingMode === PollingMode.LazyLoad ? LazyLoadOptions :
            (() => { throw new Error("Invalid 'pollingMode' value"); })();

        const actualOptions = new optionsClass(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.cache, configCatKernel.eventEmitterFactory);

        const [instance, instanceAlreadyCreated] = clientInstanceCache.getOrCreate(actualOptions, configCatKernel);

        if (instanceAlreadyCreated && options) {
            actualOptions.logger.warn(`Client for SDK key '${sdkKey}' is already created and will be reused; configuration action is being ignored.`);
        }

        return instance;
    }

    constructor(
        options: ConfigCatClientOptions,
        configCatKernel: IConfigCatKernel,
        private cacheToken?: object) {

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

        if (options.defaultUser) {
            this.setDefaultUser(options.defaultUser);
        }

        this.evaluator = new RolloutEvaluator(options.logger);

        if (options.flagOverrides?.behaviour != OverrideBehaviour.LocalOnly) {
            const configServiceClass =
                options instanceof AutoPollOptions ? AutoPollConfigService :
                options instanceof ManualPollOptions ? ManualPollConfigService :
                options instanceof LazyLoadOptions ? LazyLoadConfigService :
                (() => { throw new Error("Invalid 'options' value"); })();

            this.configService = new configServiceClass(configCatKernel.configFetcher, options);
        }
        else {
            this.options.hooks.emit("clientReady");
        }

        this.suppressFinalize = registerForFinalization(this, { sdkKey: options.apiKey, cacheToken, configService: this.configService, logger: options.logger });
    }

    private static finalize(data: IFinalizationData) {
        // Safeguard against situations where user forgets to dispose of the client instance.
        
        data.logger?.debug("finalize() called");

        if (data.cacheToken) {
            clientInstanceCache.remove(data.sdkKey, data.cacheToken);
        }

        ConfigCatClient.close(data.configService, data.logger);
    }

    private static close(configService?: IConfigService, logger?: IConfigCatLogger, hooks?: Hooks) {
        logger?.debug("close() called");

        const emitBeforeClientDispose = hooks?.tryDisconnect();
        try {
            emitBeforeClientDispose?.();
        }
        finally {
            configService?.dispose();
        }
    }

    dispose(): void {
        const options = this.options;
        options.logger.debug("dispose() called");

        if (this.cacheToken) {
            clientInstanceCache.remove(options.apiKey, this.cacheToken);
        }

        ConfigCatClient.close(this.configService, options.logger, options.hooks);
        this.suppressFinalize();
    }

    static disposeAll(): void {
        const removedInstances = clientInstanceCache.clear();

        let errors: any[] | undefined;
        for (let instance of removedInstances) {
            try {
                ConfigCatClient.close(instance.configService, instance.options.logger, instance.options.hooks);
                instance.suppressFinalize();
            }
            catch (err) {
                errors ??= [];
                errors.push(err);
            }
        }

        if (errors) {
            throw typeof AggregateError !== "undefined" ? new AggregateError(errors) : errors.pop();
        }
    }
    
    getValue(key: string, defaultValue: any, callback: (value: any) => void, user?: User): void {
        this.options.logger.debug("getValue() called.");
        this.getValueAsync(key, defaultValue, user).then(callback);
    }

    async getValueAsync(key: string, defaultValue: any, user?: User): Promise<any> {
        this.options.logger.debug("getValueAsync() called.");

        let value: any, evaluationDetails: IEvaluationDetails;
        let remoteConfig: ProjectConfig | null = null;
        user ??= this.defaultUser;
        try {
            let settings: { [name: string]: Setting } | null;
            [settings, remoteConfig] = await this.getSettingsAsync();
            evaluationDetails = evaluate(this.evaluator, settings, key, defaultValue, user, remoteConfig, this.options.logger);
            value = evaluationDetails.value;
        }
        catch (err) {
            this.options.logger.error("Error occurred in getValueAsync().", err);
            evaluationDetails = evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorToString(err), err);
            value = defaultValue;
        }

        this.options.hooks.emit("flagEvaluated", evaluationDetails);
        return value;
    }

    getValueDetails(key: string, defaultValue: any, callback: (evaluationDetails: IEvaluationDetails) => void, user?: User): void {
        this.options.logger.debug("getValueDetails() called.");
        this.getValueDetailsAsync(key, defaultValue, user).then(callback);
    }

    async getValueDetailsAsync(key: string, defaultValue: any, user?: User): Promise<IEvaluationDetails> {
        this.options.logger.debug("getValueDetailsAsync() called.");

        let evaluationDetails: IEvaluationDetails;
        let remoteConfig: ProjectConfig | null = null;
        user ??= this.defaultUser;
        try {
            let settings: { [name: string]: Setting } | null;
            [settings, remoteConfig] = await this.getSettingsAsync();
            evaluationDetails = evaluate(this.evaluator, settings, key, defaultValue, user, remoteConfig, this.options.logger);
        }
        catch (err) {
            this.options.logger.error("Error occurred in getValueDetailsAsync().", err);
            evaluationDetails = evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorToString(err), err);
        }

        this.options.hooks.emit("flagEvaluated", evaluationDetails);
        return evaluationDetails;
    }

    forceRefresh(callback: (result: RefreshResult) => void): void {
        this.options.logger.debug("forceRefresh() called.");
        this.forceRefreshAsync().then(callback);
    }

    async forceRefreshAsync(): Promise<RefreshResult> {
        this.options.logger.debug("forceRefreshAsync() called.");

        if (this.configService) {
            try {
                const [result] = await this.configService.refreshConfigAsync();
                return result;
            }
            catch (err) {
                this.options.logger.error("Error occurred in forceRefreshAsync().", err);
                return RefreshResult.failure(errorToString(err), err);
            }
        }
        else {
            return RefreshResult.failure("Client is configured to use the LocalOnly override behavior, which prevents making HTTP requests.");
        }
    }

    getAllKeys(callback: (value: string[]) => void): void {
        this.options.logger.debug("getAllKeys() called.");
        this.getAllKeysAsync().then(callback);
    }

    async getAllKeysAsync(): Promise<string[]> {
        this.options.logger.debug("getAllKeysAsync() called.");

        try {
            const [settings] = await this.getSettingsAsync();
            if (!checkSettingsAvailable(settings, this.options.logger, ", returning empty array")) {
                return [];
            }
            return Object.keys(settings);
        }
        catch (err) {
            this.options.logger.error("Error occurred in getAllKeysAsync().", err);
            return [];
        }
    }

    getVariationId(key: string, defaultVariationId: any, callback: (variationId: string) => void, user?: User): void {
        this.options.logger.debug("getVariationId() called.");
        this.getVariationIdAsync(key, defaultVariationId, user).then(callback);
    }

    async getVariationIdAsync(key: string, defaultVariationId: any, user?: User): Promise<string> {
        this.options.logger.debug("getVariationIdAsync() called.");

        let variationId: any, evaluationDetails: IEvaluationDetails;
        let remoteConfig: ProjectConfig | null = null;
        user ??= this.defaultUser;
        try {
            let settings: { [name: string]: Setting } | null;
            [settings, remoteConfig] = await this.getSettingsAsync();
            evaluationDetails = evaluateVariationId(this.evaluator, settings, key, defaultVariationId, user, remoteConfig, this.options.logger);
            variationId = evaluationDetails.variationId;
        }
        catch (err) {
            this.options.logger.error("Error occurred in getVariationIdAsync().", err);
            evaluationDetails = evaluationDetailsFromDefaultVariationId(key, defaultVariationId, getTimestampAsDate(remoteConfig), user, errorToString(err), err);
            variationId = defaultVariationId;
        }

        this.options.hooks.emit("flagEvaluated", evaluationDetails);
        return variationId;
    }

    getAllVariationIds(callback: (variationIds: string[]) => void, user?: User): void {
        this.options.logger.debug("getAllVariationIds() called.");
        this.getAllVariationIdsAsync(user).then(callback);
    }

    async getAllVariationIdsAsync(user?: User): Promise<string[]> {
        this.options.logger.debug("getAllVariationIdsAsync() called.");

        let result: string[], evaluationDetailsArray: IEvaluationDetails[];
        user ??= this.defaultUser;
        try {
            const [settings, remoteConfig] = await this.getSettingsAsync();
            let errors: any[] | undefined;
            [evaluationDetailsArray, errors] = evaluateAllVariationIds(this.evaluator, settings, user, remoteConfig, this.options.logger);
            if (errors?.length) {
                throw typeof AggregateError !== "undefined" ? new AggregateError(errors) : errors.pop();
            }
            result = evaluationDetailsArray.map(details => details.variationId);
        }
        catch (err) {
            this.options.logger.error("Error occurred in getAllVariationIdsAsync().", err);
            evaluationDetailsArray ??= [];
            result = [];
        }

        for (let evaluationDetail of evaluationDetailsArray) {
            this.options.hooks.emit("flagEvaluated", evaluationDetail);
        }

        return result;
    }

    getKeyAndValue(variationId: string, callback: (settingkeyAndValue: SettingKeyValue | null) => void): void {
        this.options.logger.debug("getKeyAndValue() called.");
        this.getKeyAndValueAsync(variationId).then(callback);
    }

    async getKeyAndValueAsync(variationId: string): Promise<SettingKeyValue | null> {
        this.options.logger.debug("getKeyAndValueAsync() called.");

        try {
            const [settings] = await this.getSettingsAsync();
            if (!checkSettingsAvailable(settings, this.options.logger, ", returning null")) {
                return null;
            }

            for (const [settingKey, setting] of Object.entries(settings)) {
                if (variationId === setting.variationId) {
                    return new SettingKeyValue(settingKey, setting.value);
                }

                const rolloutRules = settings[settingKey].rolloutRules;
                if (rolloutRules && rolloutRules.length > 0) {
                    for (let i = 0; i < rolloutRules.length; i++) {
                        const rolloutRule: RolloutRule = rolloutRules[i];
                        if (variationId === rolloutRule.variationId) {
                            return new SettingKeyValue(settingKey, rolloutRule.value);
                        }
                    }
                }

                const percentageItems = settings[settingKey].rolloutPercentageItems;
                if (percentageItems && percentageItems.length > 0) {
                    for (let i = 0; i < percentageItems.length; i++) {
                        const percentageItem: RolloutPercentageItem = percentageItems[i];
                        if (variationId === percentageItem.variationId) {
                            return new SettingKeyValue(settingKey,  percentageItem.value);
                        }
                    }
                }
            }

            this.options.logger.error("Could not find the setting for the given variation ID: " + variationId);
        }
        catch (err) {
            this.options.logger.error("Error occurred in getKeyAndValueAsync().", err);
        }

        return null;
    }

    getAllValues(callback: (result: SettingKeyValue[]) => void, user?: User): void {
        this.options.logger.debug("getAllValues() called.");
        this.getAllValuesAsync(user).then(callback);
    }

    async getAllValuesAsync(user?: User): Promise<SettingKeyValue[]> {
        this.options.logger.debug("getAllValuesAsync() called.");

        let result: SettingKeyValue[], evaluationDetailsArray: IEvaluationDetails[];
        user ??= this.defaultUser;
        try {
            const [settings, remoteConfig] = await this.getSettingsAsync();
            let errors: any[] | undefined;
            [evaluationDetailsArray, errors] = evaluateAll(this.evaluator, settings, user, remoteConfig, this.options.logger);
            if (errors?.length) {
                throw typeof AggregateError !== "undefined" ? new AggregateError(errors) : errors.pop();
            }
            result = evaluationDetailsArray.map(details => new SettingKeyValue(details.key, details.value));
        }
        catch (err) {
            this.options.logger.error("Error occurred in getAllValuesAsync().", err);
            evaluationDetailsArray ??= [];
            result = [];
        }

        for (let evaluationDetail of evaluationDetailsArray) {
            this.options.hooks.emit("flagEvaluated", evaluationDetail);
        }

        return result;
    }

    getAllValueDetails(callback: (result: IEvaluationDetails[]) => void, user?: User): void {
        this.options.logger.debug("getAllValueDetails() called.");
        this.getAllValueDetailsAsync(user).then(callback);
    }

    async getAllValueDetailsAsync(user?: User): Promise<IEvaluationDetails[]> {
        this.options.logger.debug("getAllValueDetailsAsync() called.");

        let evaluationDetailsArray: IEvaluationDetails[];
        user ??= this.defaultUser;
        try {
            const [settings, remoteConfig] = await this.getSettingsAsync();
            let errors: any[] | undefined;
            [evaluationDetailsArray, errors] = evaluateAll(this.evaluator, settings, user, remoteConfig, this.options.logger);
            if (errors?.length) {
                throw typeof AggregateError !== "undefined" ? new AggregateError(errors) : errors.pop();
            }
        }
        catch (err) {
            this.options.logger.error("Error occurred in getAllValueDetailsAsync().", err);
            evaluationDetailsArray ??= [];
        }

        for (let evaluationDetail of evaluationDetailsArray) {
            this.options.hooks.emit("flagEvaluated", evaluationDetail);
        }

        return evaluationDetailsArray;
    }

    setDefaultUser(defaultUser: User) {
        this.defaultUser = defaultUser;
    }

    clearDefaultUser() {
        this.defaultUser = void 0;
    }

    get isOffline(): boolean {
        return this.configService?.isOffline ?? true;
    }

    setOnline(): void {
        if (this.configService) {
            this.configService.setOnline();
        }
        else {
            this.options.logger.warn("Client is configured to use the LocalOnly override behavior, thus SetOnline() has no effect.");
        }
    }

    setOffline(): void {
        this.configService?.setOffline();
    }

    private async getSettingsAsync(): Promise<SettingsWithRemoteConfig> {
        this.options.logger.debug("getSettingsAsync() called.");

        const getRemoteConfigAsync: () => Promise<SettingsWithRemoteConfig> = async () => {
            const config = await this.configService?.getConfig();
            const json = config?.ConfigJSON;
            const settings = json?.[ConfigFile.FeatureFlags] ? getSettingsFromConfig(json) : null;
            return [settings, config ?? null];
        }

        const flagOverrides = this.options?.flagOverrides;
        if (flagOverrides) {
            let remoteSettings: { [name: string]: Setting } | null;
            let remoteConfig: ProjectConfig | null;
            const localSettings = await flagOverrides.dataSource.getOverrides();
            switch (flagOverrides.behaviour) {
                case OverrideBehaviour.LocalOnly:
                    return [localSettings, null];
                case OverrideBehaviour.LocalOverRemote:
                    [remoteSettings, remoteConfig] = await getRemoteConfigAsync();
                    return [{ ...(remoteSettings ?? {}), ...localSettings }, remoteConfig];
                case OverrideBehaviour.RemoteOverLocal:
                    [remoteSettings, remoteConfig] = await getRemoteConfigAsync();
                    return [{ ...localSettings, ...(remoteSettings ?? {}) }, remoteConfig];
            }
        }

        return await getRemoteConfigAsync();
    }

    /** @inheritdoc */
    addListener: <TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void) => this = this.on;

    /** @inheritdoc */
    on<TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void): this {
        this.options.hooks.on(eventName, listener as (...args: any[]) => void);
        return this;
    }

    /** @inheritdoc */
    once<TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void): this {
        this.options.hooks.once(eventName, listener as (...args: any[]) => void);
        return this;
    }

    /** @inheritdoc */
    removeListener<TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void): this {
        this.options.hooks.removeListener(eventName, listener as (...args: any[]) => void);
        return this;
    }

    /** @inheritdoc */
    off: <TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void) => this = this.removeListener;

    /** @inheritdoc */
    removeAllListeners(eventName?: keyof HookEvents): this {
        this.options.hooks.removeAllListeners(eventName);
        return this;
    }

    /** @inheritdoc */
    listeners(eventName: keyof HookEvents): Function[] {
        return this.options.hooks.listeners(eventName);
    }

    /** @inheritdoc */
    listenerCount(eventName: keyof HookEvents): number {
        return this.options.hooks.listenerCount(eventName);
    }

    /** @inheritdoc */
    eventNames(): Array<keyof HookEvents> {
        return this.options.hooks.eventNames();
    }
}

export class SettingKeyValue {
    constructor(
        public settingKey: string,
        public settingValue: any)
    { }
}

/* GC finalization support */

// Defines the interface of the held value which is passed to ConfigCatClient.finalize by FinalizationRegistry.
// Since a strong reference is stored to the held value (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry),
// objects implementing this interface MUST NOT contain a strong reference (either directly or transitively) to the ConfigCatClient object because
// that would prevent the client object from being GC'd, which would defeat the whole purpose of the finalization logic.
interface IFinalizationData { sdkKey: string; cacheToken?: object; configService?: IConfigService, logger?: LoggerWrapper };

let registerForFinalization = function (client: ConfigCatClient, data: IFinalizationData): () => void {
    // Use FinalizationRegistry (finalization callbacks) if the runtime provides that feature.
    if (typeof FinalizationRegistry !== "undefined") {
        const finalizationRegistry = new FinalizationRegistry<IFinalizationData>(data => ConfigCatClient["finalize"](data));

        registerForFinalization = (client, data) => {
            const unregisterToken = {};
            finalizationRegistry.register(client, data, unregisterToken);
            return () => finalizationRegistry.unregister(unregisterToken);
        };
    }
    // If FinalizationRegistry is unavailable, we can't really track finalization.
    // (Although we could implement something which resembles finalization callbacks using a weak map + a timer,
    // since ConfigCatClientCache also needs to keep (weak) references to the created client instances,
    // this hypothetical approach wouldn't work without a complete WeakRef polyfill,
    // which is kind of impossible (for more details, see Polyfills.ts).
    else {
        registerForFinalization = () => () => { /* Intentional no-op */ };
    }

    return registerForFinalization(client, data);
}
