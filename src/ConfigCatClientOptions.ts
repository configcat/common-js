import type { IConfigCache, IConfigCatCache } from "./ConfigCatCache";
import { ExternalConfigCache, InMemoryConfigCache } from "./ConfigCatCache";
import type { IConfigCatLogger } from "./ConfigCatLogger";
import { ConfigCatConsoleLogger, LoggerWrapper } from "./ConfigCatLogger";
import { DefaultEventEmitter } from "./DefaultEventEmitter";
import type { IEventEmitter } from "./EventEmitter";
import { NullEventEmitter } from "./EventEmitter";
import type { FlagOverrides } from "./FlagOverrides";
import { sha1 } from "./Hash";
import type { HookEvents, IProvidesHooks, SafeHooksWrapper } from "./Hooks";
import { Hooks } from "./Hooks";
import { getWeakRefStub, isWeakRefAvailable } from "./Polyfills";
import { ProjectConfig } from "./ProjectConfig";
import type { User } from "./User";

/** Specifies the supported polling modes. */
export enum PollingMode {
  /** The ConfigCat SDK downloads the latest config data automatically and stores it in the cache. */
  AutoPoll = 0,
  /** The ConfigCat SDK downloads the latest config data only if it is not present in the cache, or if it is but has expired. */
  LazyLoad = 1,
  /** The ConfigCat SDK will not download the config data automatically. You need to update the cache manually, by calling `forceRefreshAsync()`. */
  ManualPoll = 2
}

/** Controls the location of the config JSON files containing your feature flags and settings within the ConfigCat CDN. */
export enum DataGovernance {
  /** Choose this option if your config JSON files are published to all global CDN nodes. */
  Global = 0,
  /** Choose this option if your config JSON files are published to CDN nodes only in the EU. */
  EuOnly = 1
}

/** Options used to configure the ConfigCat SDK. */
export interface IOptions {
  /**
   * The logger implementation to use for performing logging.
   *
   * If not set, `ConfigCatConsoleLogger` with `LogLevel.Warn` will be used by default.
   * If you want to use custom logging instead, you can provide an implementation of `IConfigCatLogger`.
   */
  logger?: IConfigCatLogger | null;

  /** Timeout (in milliseconds) for underlying HTTP calls. Defaults to 30 seconds. */
  requestTimeoutMs?: number | null;

  /**
   * The base URL of the remote server providing the latest version of the config.
   * Defaults to the URL of the ConfigCat CDN.
   *
   * If you want to use a proxy server between your application and ConfigCat, you need to set this property to the proxy URL.
   */
  baseUrl?: string | null;

  /** Proxy settings (supported only in the Node SDK currently). */
  proxy?: string | null;

  /**
   * Set this property to be in sync with the Data Governance preference on the Dashboard:
   * https://app.configcat.com/organization/data-governance (only Organization Admins have access).
   * Defaults to `DataGovernance.Global`.
   */
  dataGovernance?: DataGovernance | null;

  /**
   * The cache implementation to use for storing and retrieving downloaded config data.
   *
   * If not set, a default implementation will be used (depending on the platform).
   * If you want to use custom caching instead, you can provide an implementation of `IConfigCatCache`.
   */
  cache?: IConfigCatCache | null;

  /** The flag override to use. If not set, no flag override will be used. */
  flagOverrides?: FlagOverrides | null;

  /**
   * The default user, used as fallback when there's no user parameter is passed to the setting evaluation methods like
   * `IConfigCatClient.getValueAsync`, `ConfigCatClient.getValueAsync`, etc.
   */
  defaultUser?: User | null;

  /**
   * Indicates whether the client should be initialized to offline mode or not. Defaults to `false`.
   */
  offline?: boolean | null;

  /** Provides an opportunity to add listeners to client hooks (events) at client initalization time. */
  setupHooks?: (hooks: IProvidesHooks) => void;
}

/** Options used to configure the ConfigCat SDK in the case of Auto Polling mode. */
export interface IAutoPollOptions extends IOptions {
  /**
   * Config refresh interval.
   * Specifies how frequently the internally cached config will be updated by synchronizing with
   * the external cache and/or by fetching the latest version from the ConfigCat CDN.
   *
   * Default value is 60 seconds. Minimum value is 1 second. Maximum value is 2147483 seconds.
   */
  pollIntervalSeconds?: number;

  /**
   * Maximum waiting time before reporting the ready state, i.e. emitting the `clientReady` event.
   *
   * Default value is 5 seconds. Maximum value is 2147483 seconds. Negative values mean infinite waiting.
   */
  maxInitWaitTimeSeconds?: number;
}

/** Options used to configure the ConfigCat SDK in the case of Manual Polling mode. */
export interface IManualPollOptions extends IOptions {
}

/** Options used to configure the ConfigCat SDK in the case of Lazy Loading mode. */
export interface ILazyLoadingOptions extends IOptions {
  /**
   * Cache time to live value.
   * Specifies how long the cached config can be used before updating it again
   * by fetching the latest version from the ConfigCat CDN.
   *
   * Default value is 60 seconds. Minimum value is 1 second. Maximum value is 2147483647 seconds.
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

  private static readonly configFileName = "config_v6.json";

  logger: LoggerWrapper;

  sdkKey: string;

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

  hooks: SafeHooksWrapper;

  constructor(sdkKey: string, clientVersion: string, options?: IOptions | null,
    defaultCacheFactory?: ((options: OptionsBase) => IConfigCache) | null,
    eventEmitterFactory?: (() => IEventEmitter) | null) {

    if (!sdkKey) {
      throw new Error("Invalid 'sdkKey' value");
    }

    this.sdkKey = sdkKey;
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
    const hooks = new Hooks(eventEmitter);
    const hooksWeakRef = new (isWeakRefAvailable() ? WeakRef : getWeakRefStub())(hooks);
    this.hooks = <SafeHooksWrapper & { hooksWeakRef: WeakRef<Hooks> }>{
      hooks, // stored only temporarily, will be deleted by `yieldHooks()`
      hooksWeakRef,
      emit<TEventName extends keyof HookEvents>(eventName: TEventName, ...args: HookEvents[TEventName]): boolean {
        return this.hooksWeakRef.deref()?.emit(eventName, ...args) ?? false;
      }
    };

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

      options.setupHooks?.(hooks);
    }

    this.logger = new LoggerWrapper(logger ?? new ConfigCatConsoleLogger(), this.hooks);

    this.cache = cache
      ? new ExternalConfigCache(cache, this.logger)
      : (defaultCacheFactory ? defaultCacheFactory(this) : new InMemoryConfigCache());
  }

  yieldHooks(): Hooks {
    const hooksWrapper = this.hooks as unknown as { hooks?: Hooks };
    const hooks = hooksWrapper.hooks;
    delete hooksWrapper.hooks;
    return hooks ?? new Hooks(new NullEventEmitter());
  }

  getUrl(): string {
    return this.baseUrl + "/configuration-files/" + this.sdkKey + "/" + OptionsBase.configFileName + "?sdk=" + this.clientVersion;
  }

  getCacheKey(): string {
    return sha1(`${this.sdkKey}_${OptionsBase.configFileName}_${ProjectConfig.serializationFormatVersion}`);
  }
}

export class AutoPollOptions extends OptionsBase {

  pollIntervalSeconds: number = 60;

  maxInitWaitTimeSeconds: number = 5;

  constructor(sdkKey: string, sdkType: string, sdkVersion: string, options?: IAutoPollOptions | null,
    defaultCacheFactory?: ((options: OptionsBase) => IConfigCache) | null,
    eventEmitterFactory?: (() => IEventEmitter) | null) {

    super(sdkKey, sdkType + "/a-" + sdkVersion, options, defaultCacheFactory, eventEmitterFactory);

    if (options) {

      if (options.pollIntervalSeconds != null) {
        this.pollIntervalSeconds = options.pollIntervalSeconds;
      }

      if (options.maxInitWaitTimeSeconds != null) {
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
  constructor(sdkKey: string, sdkType: string, sdkVersion: string, options?: IManualPollOptions | null,
    defaultCacheFactory?: ((options: OptionsBase) => IConfigCache) | null,
    eventEmitterFactory?: (() => IEventEmitter) | null) {

    super(sdkKey, sdkType + "/m-" + sdkVersion, options, defaultCacheFactory, eventEmitterFactory);
  }
}

export class LazyLoadOptions extends OptionsBase {

  cacheTimeToLiveSeconds: number = 60;

  constructor(sdkKey: string, sdkType: string, sdkVersion: string, options?: ILazyLoadingOptions | null,
    defaultCacheFactory?: ((options: OptionsBase) => IConfigCache) | null,
    eventEmitterFactory?: (() => IEventEmitter) | null) {

    super(sdkKey, sdkType + "/l-" + sdkVersion, options, defaultCacheFactory, eventEmitterFactory);

    if (options) {
      if (options.cacheTimeToLiveSeconds != null) {
        this.cacheTimeToLiveSeconds = options.cacheTimeToLiveSeconds;
      }
    }

    if (!(typeof this.cacheTimeToLiveSeconds === "number" && 1 <= this.cacheTimeToLiveSeconds && this.cacheTimeToLiveSeconds <= 2147483647)) {
      throw new Error("Invalid 'cacheTimeToLiveSeconds' value");
    }
  }
}

export type ConfigCatClientOptions = AutoPollOptions | ManualPollOptions | LazyLoadOptions;
