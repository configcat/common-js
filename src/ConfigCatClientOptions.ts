import { ConfigCatConsoleLogger } from "./ConfigCatLogger";
import { IConfigCatLogger, IAutoPollOptions, ILazyLoadingOptions, IManualPollOptions, LogLevel } from "./index";
import COMMON_VERSION from "./Version";


/** Restrict the location of your feature flag and setting data within the ConfigCat CDN. */
export enum DataGovernance {
    /** Your data will be published to all ConfigCat CDN nodes to guarantee lowest response times. */
    Global = 0,
    /** Your data will be published to CDN nodes only in the EU. */
    EuOnly = 1
}

export interface IOptions {
    logger?: IConfigCatLogger;
    requestTimeoutMs?: number;
    baseUrl?: string;
    /** You can set a base_url if you want to use a proxy server between your application and ConfigCat */
    proxy?: string;
    /** Set this parameter to restrict the location of your feature flag and setting data within the ConfigCat CDN.
    Default: Global, This parameter must be in sync with the preferences on:
    https://app.configcat.com/organization/data-governance (Only Organization Admins can set this preference.) */
    dataGovernance?: DataGovernance;
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

    constructor(apiKey: string, clientVersion: string, options: IOptions) {
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

    /** You can subscribe to configuration changes with this callback */
    public configChanged: () => void = () => { };

    constructor(apiKey: string, options: IAutoPollOptions) {

        super(apiKey, "a-" + COMMON_VERSION, options);

        if (options) {

            if (options.pollIntervalSeconds) {
                this.pollIntervalSeconds = options.pollIntervalSeconds;
            }

            if (options.configChanged) {
                this.configChanged = options.configChanged;
            }
        }

        if (!this.pollIntervalSeconds || this.pollIntervalSeconds < 1) {
            throw new Error("Invalid 'pollIntervalSeconds' value");
        }
    }
}

export class ManualPollOptions extends OptionsBase implements IManualPollOptions {
    constructor(apiKey: string, options: IManualPollOptions) {
        super(apiKey, "m-" + COMMON_VERSION, options);
    }
}

export class LazyLoadOptions extends OptionsBase implements ILazyLoadingOptions {

    /** The cache TTL. */
    public cacheTimeToLiveSeconds: number = 60;

    constructor(apiKey: string, options: ILazyLoadingOptions) {

        super(apiKey, "l-" + COMMON_VERSION, options);

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