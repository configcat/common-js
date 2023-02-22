import type { ICache } from "./Cache";
import { InMemoryCache } from "./Cache";
import type { IConfigCatLogger } from "./ConfigCatLogger";
import { ConfigCatConsoleLogger, LoggerWrapper } from "./ConfigCatLogger";
import { DefaultEventEmitter } from "./DefaultEventEmitter";
import type { IEventEmitter } from "./EventEmitter";
import type { FlagOverrides } from "./FlagOverrides";
import type { IProvidesHooks } from "./Hooks";
import { Hooks } from "./Hooks";
import type { User } from "./RolloutEvaluator";

export enum PollingMode {
  AutoPoll = 0,
  LazyLoad = 1,
  ManualPoll = 2
}

/** Control the location of the config.json files containing your feature flags and settings within the ConfigCat CDN. */
export enum DataGovernance {
  /** Select this if your feature flags are published to all global CDN nodes. */
  Global = 0,
  /** Select this if your feature flags are published to CDN nodes only in the EU. */
  EuOnly = 1
}

export interface IOptions {
  logger?: IConfigCatLogger | null;
  requestTimeoutMs?: number | null;
  baseUrl?: string | null;
  /** You can set a base_url if you want to use a proxy server between your application and ConfigCat */
  proxy?: string | null;
  /** Default: Global. Set this parameter to be in sync with the Data Governance preference on the Dashboard:
   * https://app.configcat.com/organization/data-governance (Only Organization Admins have access)
   */
  dataGovernance?: DataGovernance | null;
  /**
   * ICache instance for cache the config.
   */
  cache?: ICache | null;
  flagOverrides?: FlagOverrides | null;
  /**
   * The default user, used as fallback when there's no user parameter is passed to the
   * ConfigCatClient.getValue, ConfigCatClient.getValueAsync, getVariationId, getVariationIdAsync, getAllValues, getAllValuesAsync, etc. methods.
   */
  defaultUser?: User | null;
  /**
   * Indicates whether the client should be initialized to offline mode or not. Defaults to false.
   */
  offline?: boolean | null;
  /** Provides an opportunity to add listeners to client hooks (events) at client initalization time. */
  setupHooks?: (hooks: IProvidesHooks) => void;
}

export interface IAutoPollOptions extends IOptions {
  pollIntervalSeconds?: number;

  maxInitWaitTimeSeconds?: number;

  configChanged?: () => void;
}

export interface IManualPollOptions extends IOptions {
}

export interface ILazyLoadingOptions extends IOptions {
  cacheTimeToLiveSeconds?: number;
}

export type OptionsForPollingMode<TMode extends PollingMode> =
  TMode extends PollingMode.AutoPoll ? IAutoPollOptions :
  TMode extends PollingMode.ManualPoll ? IManualPollOptions :
  TMode extends PollingMode.LazyLoad ? ILazyLoadingOptions :
  never;

/* eslint-disable @typescript-eslint/no-inferrable-types */

export abstract class OptionsBase implements IOptions {

  private readonly configFileName = "config_v5";

  logger: LoggerWrapper;

  apiKey: string;

  clientVersion: string;

  requestTimeoutMs: number = 30000;

  baseUrl: string;

  baseUrlOverriden: boolean = false;

  proxy: string = "";

  dataGovernance: DataGovernance;

  cache: ICache;

  flagOverrides?: FlagOverrides;

  defaultUser?: User;

  offline: boolean = false;

  hooks: Hooks;

  constructor(apiKey: string, clientVersion: string, options?: IOptions | null, defaultCache?: ICache | null, eventEmitterFactory?: (() => IEventEmitter) | null) {
    if (!apiKey) {
      throw new Error("Invalid 'apiKey' value");
    }

    if (!defaultCache) {
      defaultCache = new InMemoryCache();
    }

    this.apiKey = apiKey;
    this.clientVersion = clientVersion;
    this.dataGovernance = options?.dataGovernance ?? DataGovernance.Global;
    this.cache = defaultCache;

    switch (this.dataGovernance) {
      case DataGovernance.EuOnly:
        this.baseUrl = "https://cdn-eu.configcat.com";
        break;
      default:
        this.baseUrl = "https://cdn-global.configcat.com";
        break;
    }

    const eventEmitter = eventEmitterFactory?.() ?? new DefaultEventEmitter();
    this.hooks = new Hooks(eventEmitter);

    let logger: IConfigCatLogger | null | undefined;

    if (options) {
      logger = options.logger;

      if (options.requestTimeoutMs) {
        if (options.requestTimeoutMs < 0) {
          throw new Error("Invalid 'requestTimeoutMs' value");
        }

        this.requestTimeoutMs = options.requestTimeoutMs;
      }

      if (options.baseUrl) {
        this.baseUrl = options.baseUrl;
        this.baseUrlOverriden = true;
      }

      if (options.proxy) {
        this.proxy = options.proxy;
      }

      if (options.cache) {
        this.cache = options.cache;
      }

      if (options.flagOverrides) {
        this.flagOverrides = options.flagOverrides;
      }

      if (options.defaultUser) {
        this.defaultUser = options.defaultUser;
      }

      if (options.offline) {
        this.offline = options.offline;
      }

      options.setupHooks?.(this.hooks);
    }

    this.logger = new LoggerWrapper(logger ?? new ConfigCatConsoleLogger(), this.hooks);
  }

  getUrl(): string {
    return this.baseUrl + "/configuration-files/" + this.apiKey + "/" + this.configFileName + ".json" + "?sdk=" + this.clientVersion;
  }

  getCacheKey(): string {
    return "js_" + this.configFileName + "_" + this.apiKey;
  }
}

export class AutoPollOptions extends OptionsBase implements IAutoPollOptions {

  /** The client's poll interval in seconds. Default: 60 seconds. */
  pollIntervalSeconds: number = 60;

  /** You can subscribe to configuration changes with this callback.
   * @deprecated This property is obsolete and will be removed from the public API in a future major version. Please use the 'options.setupHooks = hooks => hooks.on("configChanged", ...)' format instead.
   */
  configChanged: () => void = () => { };

  /** Maximum waiting time between the client initialization and the first config acquisition in seconds. */
  maxInitWaitTimeSeconds: number = 5;

  constructor(apiKey: string, sdkType: string, sdkVersion: string, options?: IAutoPollOptions | null, defaultCache?: ICache | null, eventEmitterFactory?: (() => IEventEmitter) | null) {

    super(apiKey, sdkType + "/a-" + sdkVersion, options, defaultCache, eventEmitterFactory);

    if (options) {

      if (options.pollIntervalSeconds !== void 0 && options.pollIntervalSeconds !== null) {
        this.pollIntervalSeconds = options.pollIntervalSeconds;
      }

      if (options.configChanged) {
        this.configChanged = options.configChanged;
      }

      if (options.maxInitWaitTimeSeconds !== void 0 && options.maxInitWaitTimeSeconds !== null) {
        this.maxInitWaitTimeSeconds = options.maxInitWaitTimeSeconds;
      }
    }

    if (!(this.pollIntervalSeconds >= 1 && (typeof this.pollIntervalSeconds === "number"))) {
      throw new Error("Invalid 'pollIntervalSeconds' value");
    }

    if (!(this.maxInitWaitTimeSeconds >= 0 && (typeof this.maxInitWaitTimeSeconds === "number"))) {
      throw new Error("Invalid 'maxInitWaitTimeSeconds' value");
    }
  }
}

export class ManualPollOptions extends OptionsBase implements IManualPollOptions {
  constructor(apiKey: string, sdkType: string, sdkVersion: string, options?: IManualPollOptions | null, defaultCache?: ICache | null, eventEmitterFactory?: (() => IEventEmitter) | null) {
    super(apiKey, sdkType + "/m-" + sdkVersion, options, defaultCache, eventEmitterFactory);
  }
}

export class LazyLoadOptions extends OptionsBase implements ILazyLoadingOptions {

  /** The cache TTL. */
  cacheTimeToLiveSeconds: number = 60;

  constructor(apiKey: string, sdkType: string, sdkVersion: string, options?: ILazyLoadingOptions | null, defaultCache?: ICache | null, eventEmitterFactory?: (() => IEventEmitter) | null) {

    super(apiKey, sdkType + "/l-" + sdkVersion, options, defaultCache, eventEmitterFactory);

    if (options) {
      if (options.cacheTimeToLiveSeconds) {
        this.cacheTimeToLiveSeconds = options.cacheTimeToLiveSeconds;
      }
    }

    if (!this.cacheTimeToLiveSeconds || this.cacheTimeToLiveSeconds < 1) {
      throw new Error("Invalid 'cacheTimeToLiveSeconds' value. Value must be greater than zero.");
    }
  }
}

export type ConfigCatClientOptions = AutoPollOptions | ManualPollOptions | LazyLoadOptions;
