import type { IConfigCache, IConfigCatCache } from "./ConfigCatCache";
import { ExternalConfigCache, InMemoryConfigCache } from "./ConfigCatCache";
import type { IConfigCatLogger } from "./ConfigCatLogger";
import { ConfigCatConsoleLogger, LoggerWrapper } from "./ConfigCatLogger";
import { DefaultEventEmitter } from "./DefaultEventEmitter";
import type { IEventEmitter } from "./EventEmitter";
import type { FlagOverrides } from "./FlagOverrides";
import type { IProvidesHooks } from "./Hooks";
import { Hooks } from "./Hooks";
import { ProjectConfig } from "./ProjectConfig";
import type { User } from "./RolloutEvaluator";
import { sha1 } from "./Sha1";

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
   * The cache implementation to use for storing and retrieving downloaded config data.
   * If not set, a default implementation will be used (depending on the platform).
   * If you want to use custom caching instead, you can provide an implementation of `IConfigCatCache`.
   */
  cache?: IConfigCatCache | null;
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
  /**
   * Configuration refresh period.
   * (Default value is 60 seconds. Minimum value is 1 second. Maximum value is 2147483 seconds.)
   */
  pollIntervalSeconds?: number;

  /**
    * Maximum waiting time between initialization and the first config acquisition.
    * (Default value is 5 seconds. Maximum value is 2147483 seconds. Negative values mean infinite waiting.)
   */
  maxInitWaitTimeSeconds?: number;
}

export interface IManualPollOptions extends IOptions {
}

export interface ILazyLoadingOptions extends IOptions {
  /**
    * Cache time to live value.
    * (Default value is 60 seconds. Minimum value is 1 second. Maximum value is 2147483647 seconds.)
   */
  cacheTimeToLiveSeconds?: number;
}

export type OptionsForPollingMode<TMode extends PollingMode> =
  TMode extends PollingMode.AutoPoll ? IAutoPollOptions :
  TMode extends PollingMode.ManualPoll ? IManualPollOptions :
  TMode extends PollingMode.LazyLoad ? ILazyLoadingOptions :
  never;

/* eslint-disable @typescript-eslint/no-inferrable-types */

export abstract class OptionsBase {

  private static readonly configFileName = "config_v5.json";

  logger: LoggerWrapper;

  apiKey: string;

  clientVersion: string;

  requestTimeoutMs: number = 30000;

  baseUrl: string;

  baseUrlOverriden: boolean = false;

  proxy: string = "";

  dataGovernance: DataGovernance;

  cache: IConfigCache;

  flagOverrides?: FlagOverrides;

  defaultUser?: User;

  offline: boolean = false;

  hooks: Hooks;

  constructor(apiKey: string, clientVersion: string, options?: IOptions | null,
    defaultCacheFactory?: ((options: OptionsBase) => IConfigCache) | null,
    eventEmitterFactory?: (() => IEventEmitter) | null) {

    if (!apiKey) {
      throw new Error("Invalid 'apiKey' value");
    }

    this.apiKey = apiKey;
    this.clientVersion = clientVersion;
    this.dataGovernance = options?.dataGovernance ?? DataGovernance.Global;

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
    let cache: IConfigCatCache | null | undefined;

    if (options) {
      logger = options.logger;
      cache = options.cache;

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

    this.cache = cache
      ? new ExternalConfigCache(cache, this.logger)
      : (defaultCacheFactory ? defaultCacheFactory(this) : new InMemoryConfigCache());
  }

  getUrl(): string {
    return this.baseUrl + "/configuration-files/" + this.apiKey + "/" + OptionsBase.configFileName + "?sdk=" + this.clientVersion;
  }

  getCacheKey(): string {
    return sha1(`${this.apiKey}_${OptionsBase.configFileName}_${ProjectConfig.serializationFormatVersion}`);
  }
}

export class AutoPollOptions extends OptionsBase {

  pollIntervalSeconds: number = 60;

  maxInitWaitTimeSeconds: number = 5;

  constructor(apiKey: string, sdkType: string, sdkVersion: string, options?: IAutoPollOptions | null,
    defaultCacheFactory?: ((options: OptionsBase) => IConfigCache) | null,
    eventEmitterFactory?: (() => IEventEmitter) | null) {

    super(apiKey, sdkType + "/a-" + sdkVersion, options, defaultCacheFactory, eventEmitterFactory);

    if (options) {

      if (options.pollIntervalSeconds !== void 0 && options.pollIntervalSeconds !== null) {
        this.pollIntervalSeconds = options.pollIntervalSeconds;
      }

      if (options.maxInitWaitTimeSeconds !== void 0 && options.maxInitWaitTimeSeconds !== null) {
        this.maxInitWaitTimeSeconds = options.maxInitWaitTimeSeconds;
      }
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#maximum_delay_value
    // https://stackoverflow.com/a/3468650/8656352
    const maxSetTimeoutIntervalSecs = 2147483;

    if (!(typeof this.pollIntervalSeconds === "number" && 1 <= this.pollIntervalSeconds && this.pollIntervalSeconds <= maxSetTimeoutIntervalSecs)) {
      throw new Error("Invalid 'pollIntervalSeconds' value");
    }

    if (!(typeof this.maxInitWaitTimeSeconds === "number" && this.maxInitWaitTimeSeconds <= maxSetTimeoutIntervalSecs)) {
      throw new Error("Invalid 'maxInitWaitTimeSeconds' value");
    }
  }
}

export class ManualPollOptions extends OptionsBase {
  constructor(apiKey: string, sdkType: string, sdkVersion: string, options?: IManualPollOptions | null,
    defaultCacheFactory?: ((options: OptionsBase) => IConfigCache) | null,
    eventEmitterFactory?: (() => IEventEmitter) | null) {

    super(apiKey, sdkType + "/m-" + sdkVersion, options, defaultCacheFactory, eventEmitterFactory);
  }
}

export class LazyLoadOptions extends OptionsBase {

  cacheTimeToLiveSeconds: number = 60;

  constructor(apiKey: string, sdkType: string, sdkVersion: string, options?: ILazyLoadingOptions | null,
    defaultCacheFactory?: ((options: OptionsBase) => IConfigCache) | null,
    eventEmitterFactory?: (() => IEventEmitter) | null) {

    super(apiKey, sdkType + "/l-" + sdkVersion, options, defaultCacheFactory, eventEmitterFactory);

    if (options) {
      if (options.cacheTimeToLiveSeconds !== void 0 && options.cacheTimeToLiveSeconds !== null) {
        this.cacheTimeToLiveSeconds = options.cacheTimeToLiveSeconds;
      }
    }

    if (!(typeof this.cacheTimeToLiveSeconds === "number" && 1 <= this.cacheTimeToLiveSeconds && this.cacheTimeToLiveSeconds <= 2147483647)) {
      throw new Error("Invalid 'cacheTimeToLiveSeconds' value");
    }
  }
}

export type ConfigCatClientOptions = AutoPollOptions | ManualPollOptions | LazyLoadOptions;
