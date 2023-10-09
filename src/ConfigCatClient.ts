import { AutoPollConfigService } from "./AutoPollConfigService";
import type { IConfigCache } from "./ConfigCatCache";
import type { ConfigCatClientOptions, OptionsBase, OptionsForPollingMode } from "./ConfigCatClientOptions";
import { AutoPollOptions, LazyLoadOptions, ManualPollOptions, PollingMode } from "./ConfigCatClientOptions";
import type { LoggerWrapper } from "./ConfigCatLogger";
import type { IConfigFetcher } from "./ConfigFetcher";
import type { IConfigService } from "./ConfigServiceBase";
import { ClientCacheState, RefreshResult } from "./ConfigServiceBase";
import type { IEventEmitter } from "./EventEmitter";
import { OverrideBehaviour } from "./FlagOverrides";
import type { HookEvents, Hooks, IProvidesHooks } from "./Hooks";
import { LazyLoadConfigService } from "./LazyLoadConfigService";
import { ManualPollConfigService } from "./ManualPollConfigService";
import { getWeakRefStub, isWeakRefAvailable } from "./Polyfills";
import type { IConfig, ProjectConfig, RolloutPercentageItem, RolloutRule, Setting, SettingValue } from "./ProjectConfig";
import type { IEvaluationDetails, IRolloutEvaluator, SettingTypeOf, User } from "./RolloutEvaluator";
import { RolloutEvaluator, checkSettingsAvailable, evaluate, evaluateAll, evaluationDetailsFromDefaultValue, getTimestampAsDate, isAllowedValue } from "./RolloutEvaluator";
import { errorToString } from "./Utils";

/** ConfigCat SDK client. */
export interface IConfigCatClient extends IProvidesHooks {

  /**
   * Returns the value of a feature flag or setting identified by `key`.
   * @remarks
   * It is important to provide an argument for the `defaultValue` parameter that matches the type of the feature flag or setting you are evaluating.
   * Please refer to {@link https://configcat.com/docs/sdk-reference/js/#setting-type-mapping | this table} for the corresponding types.
   * @param key Key of the feature flag or setting.
   * @param defaultValue In case of failure, this value will be returned. Only the following types are allowed: `string`, `boolean`, `number`, `null` and `undefined`.
   * @param user The User Object to use for evaluating targeting rules and percentage options.
   * @returns A promise that fulfills with the value of the feature flag or setting.
   * @throws {Error} `key` is empty.
   * @throws {TypeError} `defaultValue` is not of an allowed type.
   */
  getValueAsync<T extends SettingValue>(key: string, defaultValue: T, user?: User): Promise<SettingTypeOf<T>>;

  /**
   * Returns the value along with evaluation details of a feature flag or setting identified by `key`.
   * @remarks
   * It is important to provide an argument for the `defaultValue` parameter that matches the type of the feature flag or setting you are evaluating.
   * Please refer to {@link https://configcat.com/docs/sdk-reference/js/#setting-type-mapping | this table} for the corresponding types.
   * @param key Key of the feature flag or setting.
   * @param defaultValue In case of failure, this value will be returned. Only the following types are allowed: `string`, `boolean`, `number`, `null` and `undefined`.
   * @param user The User Object to use for evaluating targeting rules and percentage options.
   * @returns A promise that fulfills with the value along with the details of evaluation of the feature flag or setting.
   * @throws {Error} `key` is empty.
   * @throws {TypeError} `defaultValue` is not of an allowed type.
   */
  getValueDetailsAsync<T extends SettingValue>(key: string, defaultValue: T, user?: User): Promise<IEvaluationDetails<SettingTypeOf<T>>>;

  /**
   * Returns all setting keys.
   * @returns A promise that fulfills with the array of keys.
   */
  getAllKeysAsync(): Promise<string[]>;

  /**
   * Returns the keys and values of all feature flags and settings.
   * @param user The User Object to use for evaluating targeting rules and percentage options.
   * @returns A promise that fulfills with the array of key-value pairs.
   */
  getAllValuesAsync(user?: User): Promise<SettingKeyValue[]>;

  /**
   * Returns the values along with evaluation details of all feature flags and settings.
   * @param user The User Object to use for evaluating targeting rules and percentage options.
   * @returns A promise that fulfills with the array of values along with evaluation details.
   */
  getAllValueDetailsAsync(user?: User): Promise<IEvaluationDetails[]>;

  /** Returns the key of a setting and it's value identified by the given Variation ID (analytics) */

  /**
   * Returns the key of a setting and its value identified by the specified `variationId`.
   * @param variationId Variation ID (analytics).
   * @returns A promise that fulfills with the key-value pair.
   */
  getKeyAndValueAsync(variationId: string): Promise<SettingKeyValue | null>;

  /**
   * Refreshes the locally cached config by fetching the latest version from the remote server.
   * @returns A promise that fulfills with the refresh result.
   */
  forceRefreshAsync(): Promise<RefreshResult>;

  /**
   * Waits for the client initialization.
   * @returns A promise that fulfills with the client's initialization state.
   */
  waitForReady(): Promise<ClientCacheState>;

  /**
   * Captures the current state of the client.
   * The resulting snapshot can be used to synchronously evaluate feature flags and settings based on the captured state.
   */
  snapshot(): IConfigCatClientSnapshot;

  /**
   * Sets the default user.
   * @param defaultUser The default User Object to use for evaluating targeting rules and percentage options.
   */
  setDefaultUser(defaultUser: User): void;

  /**
   * Clears the default user.
   */
  clearDefaultUser(): void;

  /**
   * Returns `true` when the client is configured not to initiate HTTP requests, otherwise `false`.
   */
  readonly isOffline: boolean;

  /**
   * Configures the client to allow HTTP requests.
   */
  setOnline(): void;

  /**
   * Configures the client to not initiate HTTP requests and work using the locally cached config only.
   */
  setOffline(): void;

  /**
   * Releases all resources used by the client.
   */
  dispose(): void;
}

/** Represents the state of `IConfigCatClient` captured at a specific point in time. */
export interface IConfigCatClientSnapshot {
  readonly cacheState: ClientCacheState;

  /** The latest config which has been fetched from the remote server. */
  readonly fetchedConfig: IConfig | null;

  /**
   * Returns the available setting keys.
   * (In case the client is configured to use flag override, this will also include the keys provided by the flag override).
   */
  getAllKeys(): ReadonlyArray<string>;

  /**
   * Returns the value of a feature flag or setting identified by `key` synchronously, based on the snapshot.
   * @remarks
   * It is important to provide an argument for the `defaultValue` parameter that matches the type of the feature flag or setting you are evaluating.
   * Please refer to {@link https://configcat.com/docs/sdk-reference/js/#setting-type-mapping | this table} for the corresponding types.
   * @param key Key of the feature flag or setting.
   * @param defaultValue In case of failure, this value will be returned. Only the following types are allowed: `string`, `boolean`, `number`, `null` and `undefined`.
   * @param user The User Object to use for evaluating targeting rules and percentage options.
   * @returns The cached value of the feature flag or setting.
   * @throws {Error} `key` is empty.
   * @throws {TypeError} `defaultValue` is not of an allowed type.
   */
  getValue<T extends SettingValue>(key: string, defaultValue: T, user?: User): SettingTypeOf<T>;

  /**
 * Returns the value along with evaluation details of a feature flag or setting identified by `key` synchronously, based on the snapshot.
 * @remarks
 * It is important to provide an argument for the `defaultValue` parameter that matches the type of the feature flag or setting you are evaluating.
 * Please refer to {@link https://configcat.com/docs/sdk-reference/js/#setting-type-mapping | this table} for the corresponding types.
 * @param key Key of the feature flag or setting.
 * @param defaultValue In case of failure, this value will be returned. Only the following types are allowed: `string`, `boolean`, `number`, `null` and `undefined`.
 * @param user The User Object to use for evaluating targeting rules and percentage options.
 * @returns The cached value along with the details of evaluation of the feature flag or setting.
 * @throws {Error} `key` is empty.
 * @throws {TypeError} `defaultValue` is not of an allowed type.
 */
  getValueDetails<T extends SettingValue>(key: string, defaultValue: T, user?: User): IEvaluationDetails<SettingTypeOf<T>>;
}

export interface IConfigCatKernel {
  configFetcher: IConfigFetcher;
  sdkType: string;
  sdkVersion: string;
  defaultCacheFactory?: (options: OptionsBase) => IConfigCache;
  eventEmitterFactory?: () => IEventEmitter;
}

export class ConfigCatClientCache {
  private readonly instances: Record<string, [WeakRef<ConfigCatClient>, object]> = {};

  getOrCreate(options: ConfigCatClientOptions, configCatKernel: IConfigCatKernel): [ConfigCatClient, boolean] {
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
    const weakRefCtor = isWeakRefAvailable() ? WeakRef : getWeakRefStub();
    this.instances[options.apiKey] = [new weakRefCtor(instance), token];
    return [instance, false];
  }

  remove(sdkKey: string, cacheToken: object): boolean {
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

  clear(): ConfigCatClient[] {
    const removedInstances: ConfigCatClient[] = [];
    for (const [sdkKey, [weakRef]] of Object.entries(this.instances)) {
      const instance = weakRef.deref();
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
  protected configService?: IConfigService;
  protected evaluator: IRolloutEvaluator;
  private readonly options: OptionsBase;
  private defaultUser?: User;
  private readonly suppressFinalize: () => void;

  private static get instanceCache() { return clientInstanceCache; }

  static get<TMode extends PollingMode>(sdkKey: string, pollingMode: TMode, options: OptionsForPollingMode<TMode> | undefined | null, configCatKernel: IConfigCatKernel): IConfigCatClient {
    if (!sdkKey) {
      throw new Error("Invalid 'sdkKey' value");
    }

    const optionsClass =
      pollingMode === PollingMode.AutoPoll ? AutoPollOptions :
      pollingMode === PollingMode.ManualPoll ? ManualPollOptions :
      pollingMode === PollingMode.LazyLoad ? LazyLoadOptions :
      (() => { throw new Error("Invalid 'pollingMode' value"); })();

    const actualOptions = new optionsClass(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.defaultCacheFactory, configCatKernel.eventEmitterFactory);

    const [instance, instanceAlreadyCreated] = clientInstanceCache.getOrCreate(actualOptions, configCatKernel);

    if (instanceAlreadyCreated && options) {
      actualOptions.logger.clientIsAlreadyCreated(sdkKey);
    }

    return instance;
  }

  constructor(
    options: ConfigCatClientOptions,
    configCatKernel: IConfigCatKernel,
    private readonly cacheToken?: object) {

    if (!options) {
      throw new Error("Invalid 'options' value");
    }

    this.options = options;

    this.options.logger.debug("Initializing ConfigCatClient. Options: " + JSON.stringify(this.options));

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

    if (options.flagOverrides?.behaviour !== OverrideBehaviour.LocalOnly) {
      this.configService =
        options instanceof AutoPollOptions ? new AutoPollConfigService(configCatKernel.configFetcher, options) :
        options instanceof ManualPollOptions ? new ManualPollConfigService(configCatKernel.configFetcher, options) :
        options instanceof LazyLoadOptions ? new LazyLoadConfigService(configCatKernel.configFetcher, options) :
        (() => { throw new Error("Invalid 'options' value"); })();
    }
    else {
      this.options.hooks.emit("clientReady", ClientCacheState.HasLocalOverrideFlagDataOnly);
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

  private static close(configService?: IConfigService, logger?: LoggerWrapper, hooks?: Hooks) {
    logger?.debug("close() called");

    hooks?.tryDisconnect();
    configService?.dispose();
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
    for (const instance of removedInstances) {
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

  async getValueAsync<T extends SettingValue>(key: string, defaultValue: T, user?: User): Promise<SettingTypeOf<T>> {
    this.options.logger.debug("getValueAsync() called.");

    validateKey(key);
    ensureAllowedDefaultValue(defaultValue);

    let value: SettingTypeOf<T>, evaluationDetails: IEvaluationDetails<SettingTypeOf<T>>;
    let remoteConfig: ProjectConfig | null = null;
    user ??= this.defaultUser;
    try {
      let settings: { [name: string]: Setting } | null;
      [settings, remoteConfig] = await this.getSettingsAsync();
      evaluationDetails = evaluate(this.evaluator, settings, key, defaultValue, user, remoteConfig, this.options.logger);
      value = evaluationDetails.value;
    }
    catch (err) {
      this.options.logger.settingEvaluationErrorSingle("getValueAsync", key, "defaultValue", defaultValue, err);
      evaluationDetails = evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorToString(err), err);
      value = defaultValue as SettingTypeOf<T>;
    }

    this.options.hooks.emit("flagEvaluated", evaluationDetails);
    return value;
  }

  async getValueDetailsAsync<T extends SettingValue>(key: string, defaultValue: T, user?: User): Promise<IEvaluationDetails<SettingTypeOf<T>>> {
    this.options.logger.debug("getValueDetailsAsync() called.");

    validateKey(key);
    ensureAllowedDefaultValue(defaultValue);

    let evaluationDetails: IEvaluationDetails<SettingTypeOf<T>>;
    let remoteConfig: ProjectConfig | null = null;
    user ??= this.defaultUser;
    try {
      let settings: { [name: string]: Setting } | null;
      [settings, remoteConfig] = await this.getSettingsAsync();
      evaluationDetails = evaluate(this.evaluator, settings, key, defaultValue, user, remoteConfig, this.options.logger);
    }
    catch (err) {
      this.options.logger.settingEvaluationErrorSingle("getValueDetailsAsync", key, "defaultValue", defaultValue, err);
      evaluationDetails = evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(remoteConfig), user, errorToString(err), err);
    }

    this.options.hooks.emit("flagEvaluated", evaluationDetails);
    return evaluationDetails;
  }

  async getAllKeysAsync(): Promise<string[]> {
    this.options.logger.debug("getAllKeysAsync() called.");

    const defaultReturnValue = "empty array";
    try {
      const [settings] = await this.getSettingsAsync();
      if (!checkSettingsAvailable(settings, this.options.logger, defaultReturnValue)) {
        return [];
      }
      return Object.keys(settings);
    }
    catch (err) {
      this.options.logger.settingEvaluationError("getAllKeysAsync", defaultReturnValue, err);
      return [];
    }
  }

  async getAllValuesAsync(user?: User): Promise<SettingKeyValue[]> {
    this.options.logger.debug("getAllValuesAsync() called.");

    const defaultReturnValue = "empty array";
    let result: SettingKeyValue[], evaluationDetailsArray: IEvaluationDetails[], evaluationErrors: any[] | undefined;
    user ??= this.defaultUser;
    try {
      const [settings, remoteConfig] = await this.getSettingsAsync();
      [evaluationDetailsArray, evaluationErrors] = evaluateAll(this.evaluator, settings, user, remoteConfig, this.options.logger, defaultReturnValue);
      result = evaluationDetailsArray.map(details => new SettingKeyValue(details.key, details.value));
    }
    catch (err) {
      this.options.logger.settingEvaluationError("getAllValuesAsync", defaultReturnValue, err);
      return [];
    }

    if (evaluationErrors?.length) {
      this.options.logger.settingEvaluationError("getAllValuesAsync", "evaluation result",
        typeof AggregateError !== "undefined" ? new AggregateError(evaluationErrors) : evaluationErrors.pop());
    }

    for (const evaluationDetail of evaluationDetailsArray) {
      this.options.hooks.emit("flagEvaluated", evaluationDetail);
    }

    return result;
  }

  async getAllValueDetailsAsync(user?: User): Promise<IEvaluationDetails[]> {
    this.options.logger.debug("getAllValueDetailsAsync() called.");

    const defaultReturnValue = "empty array";
    let evaluationDetailsArray: IEvaluationDetails[], evaluationErrors: any[] | undefined;
    user ??= this.defaultUser;
    try {
      const [settings, remoteConfig] = await this.getSettingsAsync();
      [evaluationDetailsArray, evaluationErrors] = evaluateAll(this.evaluator, settings, user, remoteConfig, this.options.logger, defaultReturnValue);
    }
    catch (err) {
      this.options.logger.settingEvaluationError("getAllValueDetailsAsync", defaultReturnValue, err);
      return [];
    }

    if (evaluationErrors?.length) {
      this.options.logger.settingEvaluationError("getAllValueDetailsAsync", "evaluation result",
        typeof AggregateError !== "undefined" ? new AggregateError(evaluationErrors) : evaluationErrors.pop());
    }

    for (const evaluationDetail of evaluationDetailsArray) {
      this.options.hooks.emit("flagEvaluated", evaluationDetail);
    }

    return evaluationDetailsArray;
  }

  async getKeyAndValueAsync(variationId: string): Promise<SettingKeyValue | null> {
    this.options.logger.debug("getKeyAndValueAsync() called.");

    const defaultReturnValue = "null";
    try {
      const [settings] = await this.getSettingsAsync();
      if (!checkSettingsAvailable(settings, this.options.logger, defaultReturnValue)) {
        return null;
      }

      for (const [settingKey, setting] of Object.entries(settings)) {
        if (variationId === setting.variationId) {
          return new SettingKeyValue(settingKey, setting.value);
        }

        const rolloutRules = settings[settingKey].targetingRules;
        if (rolloutRules && rolloutRules.length > 0) {
          for (let i = 0; i < rolloutRules.length; i++) {
            const rolloutRule: RolloutRule = rolloutRules[i];
            if (variationId === rolloutRule.variationId) {
              return new SettingKeyValue(settingKey, rolloutRule.value);
            }
          }
        }

        const percentageItems = settings[settingKey].percentageOptions;
        if (percentageItems && percentageItems.length > 0) {
          for (let i = 0; i < percentageItems.length; i++) {
            const percentageItem: RolloutPercentageItem = percentageItems[i];
            if (variationId === percentageItem.variationId) {
              return new SettingKeyValue(settingKey, percentageItem.value);
            }
          }
        }
      }

      this.options.logger.settingForVariationIdIsNotPresent(variationId);
    }
    catch (err) {
      this.options.logger.settingEvaluationError("getKeyAndValueAsync", defaultReturnValue, err);
    }

    return null;
  }

  async forceRefreshAsync(): Promise<RefreshResult> {
    this.options.logger.debug("forceRefreshAsync() called.");

    if (this.configService) {
      try {
        const [result] = await this.configService.refreshConfigAsync();
        return result;
      }
      catch (err) {
        this.options.logger.forceRefreshError("forceRefreshAsync", err);
        return RefreshResult.failure(errorToString(err), err);
      }
    }
    else {
      return RefreshResult.failure("Client is configured to use the LocalOnly override behavior, which prevents making HTTP requests.");
    }
  }

  setDefaultUser(defaultUser: User): void {
    this.defaultUser = defaultUser;
  }

  clearDefaultUser(): void {
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
      this.options.logger.configServiceMethodHasNoEffectDueToOverrideBehavior(OverrideBehaviour[OverrideBehaviour.LocalOnly], "setOnline");
    }
  }

  setOffline(): void {
    this.configService?.setOffline();
  }

  waitForReady(): Promise<ClientCacheState> {
    return this.options.readyPromise;
  }

  snapshot(): IConfigCatClientSnapshot {
    const getRemoteConfig: () => SettingsWithRemoteConfig = () => {
      const config = this.options.cache.getInMemory();
      const settings = !config.isEmpty ? config.config!.settings : null;
      return [settings, config];
    };

    let remoteSettings: { [name: string]: Setting } | null;
    let remoteConfig: ProjectConfig | null;
    const flagOverrides = this.options?.flagOverrides;
    if (flagOverrides) {
      const localSettings = flagOverrides.dataSource.getOverridesSync();
      switch (flagOverrides.behaviour) {
        case OverrideBehaviour.LocalOnly:
          return new Snapshot(localSettings, null, this);
        case OverrideBehaviour.LocalOverRemote:
          [remoteSettings, remoteConfig] = getRemoteConfig();
          return new Snapshot({ ...(remoteSettings ?? {}), ...localSettings }, remoteConfig, this);
        case OverrideBehaviour.RemoteOverLocal:
          [remoteSettings, remoteConfig] = getRemoteConfig();
          return new Snapshot({ ...localSettings, ...(remoteSettings ?? {}) }, remoteConfig, this);
      }
    }

    [remoteSettings, remoteConfig] = getRemoteConfig();
    return new Snapshot(remoteSettings, remoteConfig, this);
  }

  private async getSettingsAsync(): Promise<SettingsWithRemoteConfig> {
    this.options.logger.debug("getSettingsAsync() called.");

    const getRemoteConfigAsync: () => Promise<SettingsWithRemoteConfig> = async () => {
      const config = await this.configService!.getConfig();
      const settings = !config.isEmpty ? config.config!.settings : null;
      return [settings, config];
    };

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

class Snapshot implements IConfigCatClientSnapshot {
  private readonly defaultUser: User | undefined;
  private readonly evaluator: IRolloutEvaluator;
  private readonly options: ConfigCatClientOptions;

  constructor(
    private readonly mergedSettings: { [name: string]: Setting } | null,
    private readonly remoteConfig: ProjectConfig | null,
    client: ConfigCatClient) {

    this.defaultUser = client["defaultUser"];
    this.evaluator = client["evaluator"];
    this.options = client["options"];
    this.cacheState = remoteConfig
      ? client["configService"]!.getCacheState(remoteConfig)
      : ClientCacheState.HasLocalOverrideFlagDataOnly;
  }

  readonly cacheState: ClientCacheState;

  get fetchedConfig() {
    const config = this.remoteConfig;
    return config && !config.isEmpty ? config.config! : null;
  }

  getAllKeys() { return this.mergedSettings ? Object.keys(this.mergedSettings) : []; }

  getValue<T extends SettingValue>(key: string, defaultValue: T, user?: User): SettingTypeOf<T> {
    this.options.logger.debug("Snapshot.getValue() called.");

    validateKey(key);
    ensureAllowedDefaultValue(defaultValue);

    let value: SettingTypeOf<T>, evaluationDetails: IEvaluationDetails<SettingTypeOf<T>>;
    user ??= this.defaultUser;
    try {
      evaluationDetails = evaluate(this.evaluator, this.mergedSettings, key, defaultValue, user, this.remoteConfig, this.options.logger);
      value = evaluationDetails.value;
    }
    catch (err) {
      this.options.logger.settingEvaluationErrorSingle("Snapshot.getValue", key, "defaultValue", defaultValue, err);
      evaluationDetails = evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(this.remoteConfig), user, errorToString(err), err);
      value = defaultValue as SettingTypeOf<T>;
    }

    this.options.hooks.emit("flagEvaluated", evaluationDetails);
    return value;
  }

  getValueDetails<T extends SettingValue>(key: string, defaultValue: T, user?: User): IEvaluationDetails<SettingTypeOf<T>> {
    this.options.logger.debug("Snapshot.getValueDetails() called.");

    validateKey(key);
    ensureAllowedDefaultValue(defaultValue);

    let evaluationDetails: IEvaluationDetails<SettingTypeOf<T>>;
    user ??= this.defaultUser;
    try {
      evaluationDetails = evaluate(this.evaluator, this.mergedSettings, key, defaultValue, user, this.remoteConfig, this.options.logger);
    }
    catch (err) {
      this.options.logger.settingEvaluationErrorSingle("Snapshot.getValueDetails", key, "defaultValue", defaultValue, err);
      evaluationDetails = evaluationDetailsFromDefaultValue(key, defaultValue, getTimestampAsDate(this.remoteConfig), user, errorToString(err), err);
    }

    this.options.hooks.emit("flagEvaluated", evaluationDetails);
    return evaluationDetails;
  }
}

/** Setting key-value pair. */
export class SettingKeyValue<TValue = SettingValue> {
  constructor(
    public settingKey: string,
    public settingValue: TValue) { }
}

function validateKey(key: string): void {
  if (!key) {
    throw new Error("Invalid 'key' value");
  }
}

function ensureAllowedDefaultValue(value: SettingValue): void {
  if (!isAllowedValue(value)) {
    throw new TypeError("The default value must be boolean, number, string, null or undefined.");
  }
}

/* GC finalization support */

// Defines the interface of the held value which is passed to ConfigCatClient.finalize by FinalizationRegistry.
// Since a strong reference is stored to the held value (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry),
// objects implementing this interface MUST NOT contain a strong reference (either directly or transitively) to the ConfigCatClient object because
// that would prevent the client object from being GC'd, which would defeat the whole purpose of the finalization logic.
interface IFinalizationData { sdkKey: string; cacheToken?: object; configService?: IConfigService; logger?: LoggerWrapper }

let registerForFinalization = function(client: ConfigCatClient, data: IFinalizationData): () => void {
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
};
