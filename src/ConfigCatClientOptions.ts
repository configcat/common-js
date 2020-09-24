import { ConfigCatConsoleLogger } from "./ConfigCatLogger";
import { IConfigCatLogger, IAutoPollOptions, ILazyLoadingOptions, IManualPollOptions, LogLevel } from "./index";
import COMMON_VERSION from "./Version";

export enum DataGovernance {
    Global = 0,
    EuOnly = 1
}

export interface IOptions {
    logger?: IConfigCatLogger;
    requestTimeoutMs?: number;
    baseUrl?: string;
    proxy?: string;
    dataGovernance?: DataGovernance;
}

export abstract class OptionsBase implements IOptions {

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
        return this.baseUrl + "/configuration-files/" + this.apiKey + "/config_v5.json";
    }

    getCacheKey(): string {
        return "config_v5_" + this.apiKey;
    }
}

export class AutoPollOptions extends OptionsBase implements IAutoPollOptions {

    public pollIntervalSeconds: number = 60;

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