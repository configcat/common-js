import { ConfigCatConsoleLogger } from "./ConfigCatLogger";
import { IConfigCatLogger, IAutoPollOptions, ILazyLoadingOptions, IManualPollOptions, LogLevel } from "./index";

const VERSION:string = "3.0.1";

export interface IOptions {
    logger?: IConfigCatLogger;
    requestTimeoutMs?: number;
    baseUrl?: string;
    proxy?: string;
}

export abstract class OptionsBase implements IOptions {

    public logger: IConfigCatLogger = new ConfigCatConsoleLogger(LogLevel.Warn);

    public apiKey: string;

    public clientVersion: string;

    public requestTimeoutMs: number = 30000;

    public baseUrl: string = "https://cdn.configcat.com";

    public proxy: string = "";

    constructor(apiKey: string, clientVersion: string, options: IOptions) {
        if (!apiKey) {
            throw new Error("Invalid 'apiKey' value");
        }

        this.apiKey = apiKey;
        this.clientVersion = clientVersion;

        if (options)
        {
            if (options.logger) {
                this.logger = options.logger;
            }

            if (options.requestTimeoutMs ) {
                if (options.requestTimeoutMs < 0) {
                    throw new Error("Invalid 'requestTimeoutMs' value");
                }

                this.requestTimeoutMs = options.requestTimeoutMs;
            }

            if (options.baseUrl) {
                this.baseUrl = options.baseUrl;
            }

            if (options.proxy) {
                this.proxy = options.proxy;
            }
        }
    }

    getUrl(): string {
        return this.baseUrl + "/configuration-files/" + this.apiKey + "/config_v4.json";
    }
}

export class AutoPollOptions extends OptionsBase implements IAutoPollOptions {

    public pollIntervalSeconds: number = 60;

    public configChanged: () => void = () => { };

    constructor(apiKey: string, options: IAutoPollOptions) {

        super(apiKey, "a-" + VERSION, options);

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
        super(apiKey, "m-" + VERSION, options);
    }
}

export class LazyLoadOptions extends OptionsBase implements ILazyLoadingOptions {

    public cacheTimeToLiveSeconds: number = 60;

    constructor(apiKey: string, options: ILazyLoadingOptions) {

        super(apiKey, "l-" + VERSION, options);

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