import { ConfigCatConsoleLogger } from "./ConfigCatLogger";
import { IConfigCatLogger, IAutoPollOptions, ILazyLoadingOptions, IManualPollOptions, LogLevel, ICache } from "./index";
import { InMemoryCache } from "./Cache";
import COMMON_VERSION from "./Version";


/** Control the location of the config.json files containing your feature flags and settings within the ConfigCat CDN. */
export enum DataGovernance {
    /** Select this if your feature flags are published to all global CDN nodes. */
    Global = 0,
    /** Select this if your feature flags are published to CDN nodes only in the EU. */
    EuOnly = 1
}

export interface IOptions {
    logger?: IConfigCatLogger;
    requestTimeoutMs?: number;
    baseUrl?: string;
    /** You can set a base_url if you want to use a proxy server between your application and ConfigCat */
    proxy?: string;
    /** Default: Global. Set this parameter to be in sync with the Data Governance preference on the Dashboard: 
     * https://app.configcat.com/organization/data-governance (Only Organization Admins have access) */
    dataGovernance?: DataGovernance;
    /**
     * ICache instance for cache the config.
     */
    cache?: ICache;
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

    constructor(apiKey: string, clientVersion: string, options: IOptions, defaultCache: ICache) {
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
        }
    }

    getUrl(): string {
        return this.baseUrl + "/configuration-files/" + this.apiKey + "/" + this.configFileName + ".json";
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

    /** Maximum waiting time between the client initialization and the first config acquisition in secconds. */
    public maxInitWaitTimeSeconds: number = 5;

    constructor(apiKey: string, options: IAutoPollOptions, defaultCache: ICache) {

        super(apiKey, "a-" + COMMON_VERSION, options, defaultCache);

        if (options) {

            if (options.pollIntervalSeconds !== undefined && options.pollIntervalSeconds !== null) {
                this.pollIntervalSeconds = options.pollIntervalSeconds;
            }

            if (options.configChanged) {
                this.configChanged = options.configChanged;
            }

            if (options.maxInitWaitTimeSeconds !== undefined && options.maxInitWaitTimeSeconds !== null) {
                this.maxInitWaitTimeSeconds = options.maxInitWaitTimeSeconds;
            }
        }

        if (this.pollIntervalSeconds < 1) {
            throw new Error("Invalid 'pollIntervalSeconds' value");
        }

        if (this.maxInitWaitTimeSeconds < 0) {
            throw new Error("Invalid 'maxInitWaitTimeSeconds' value");
        }
    }
}

export class ManualPollOptions extends OptionsBase implements IManualPollOptions {
    constructor(apiKey: string, options: IManualPollOptions, defaultCache: ICache) {
        super(apiKey, "m-" + COMMON_VERSION, options, defaultCache);
    }
}

export class LazyLoadOptions extends OptionsBase implements ILazyLoadingOptions {

    /** The cache TTL. */
    public cacheTimeToLiveSeconds: number = 60;

    constructor(apiKey: string, options: ILazyLoadingOptions, defaultCache: ICache) {

        super(apiKey, "l-" + COMMON_VERSION, options, defaultCache);

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