import { ConfigCatConsoleLogger } from "./ConfigCatLogger";
import { IConfigCatLogger, IAutoPollOptions, ILazyLoadingOptions, IManualPollOptions, LogLevel, ICache, User } from "./index";
import { InMemoryCache } from "./Cache";
import { FlagOverrides } from "./FlagOverrides";


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
     * https://app.configcat.com/organization/data-governance (Only Organization Admins have access) */
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
}

export abstract class OptionsBase implements IOptions {

    private configFileName = "config_v5";

    public logger: IConfigCatLogger = new ConfigCatConsoleLogger(LogLevel.Warn);

    public apiKey: string;

    public clientVersion: string;

    public requestTimeoutMs: number = 30000;

    public baseUrl: string;

    public baseUrlOverriden: boolean = false;

    public proxy: string = "";

    public dataGovernance: DataGovernance;

    public cache: ICache;

    public flagOverrides?: FlagOverrides;

    public defaultUser?: User | null;

    constructor(apiKey: string, clientVersion: string, options?: IOptions | null, defaultCache?: ICache | null) {
        if (!apiKey) {
            throw new Error("Invalid 'apiKey' value");
        }

        if (!defaultCache){
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

        if (options) {
            if (options.logger) {
                this.logger = options.logger;
            }

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
        }
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
    public pollIntervalSeconds: number = 60;

    /** You can subscribe to configuration changes with this callback. */
    public configChanged: () => void = () => { };

    /** Maximum waiting time between the client initialization and the first config acquisition in seconds. */
    public maxInitWaitTimeSeconds: number = 5;

    constructor(apiKey: string, sdkType: string, sdkVersion: string, options?: IAutoPollOptions | null, defaultCache?: ICache | null) {

        super(apiKey, sdkType + "/a-" + sdkVersion, options, defaultCache);

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

        if (!(this.pollIntervalSeconds >= 1 && (typeof this.pollIntervalSeconds === 'number'))) {
            throw new Error("Invalid 'pollIntervalSeconds' value");
        }

        if (!(this.maxInitWaitTimeSeconds >= 0 && (typeof this.maxInitWaitTimeSeconds === 'number'))) {
            throw new Error("Invalid 'maxInitWaitTimeSeconds' value");
        }
    }
}

export class ManualPollOptions extends OptionsBase implements IManualPollOptions {
    constructor(apiKey: string, sdkType: string, sdkVersion: string, options?: IManualPollOptions | null, defaultCache?: ICache | null) {
        super(apiKey, sdkType + "/m-" + sdkVersion, options, defaultCache);
    }
}

export class LazyLoadOptions extends OptionsBase implements ILazyLoadingOptions {

    /** The cache TTL. */
    public cacheTimeToLiveSeconds: number = 60;

    constructor(apiKey: string, sdkType: string, sdkVersion: string, options?: ILazyLoadingOptions | null, defaultCache?: ICache | null) {

        super(apiKey, sdkType + "/l-" + sdkVersion, options, defaultCache);

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
