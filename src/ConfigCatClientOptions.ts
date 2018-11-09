import { ConfigCatConsoleLogger } from "./ConfigCatLogger";
import { IConfigCatLogger, IAutoPollOptions, ILazyLoadingOptions, IManualPollOptions } from ".";

const VERSION: string = require("../package.json").version;

export interface IOptions {
    logger?: IConfigCatLogger;
}

export abstract class OptionsBase implements IOptions {

    public logger: IConfigCatLogger = new ConfigCatConsoleLogger();

    public apiKey: string;

    constructor(apiKey: string, clientVersion: string, options: IOptions) {
        if (!apiKey) {
            throw new Error("Invalid 'apiKey' value");
        }

        this.apiKey = apiKey;
        if (options && options.logger)
        {
            this.logger = options.logger;
        }
    }

    getUrl(): string {
        if (this.apiKey) {
            return "https://cdn.configcat.com/configuration-files/" + this.apiKey + "/config_v2.json";
        }

        throw new Error("Invalid 'apiKey'");
    }
}

export class AutoPollOptions extends OptionsBase implements IAutoPollOptions {

    public pollIntervalSeconds: number = 5;

    public maxInitWaitTimeSeconds: number = 60;

    public configChanged: () => void = () => { };

    constructor(apiKey: string, options: IAutoPollOptions) {

        super(apiKey, "a-" + VERSION, options);

        if (options) {
            if (options.maxInitWaitTimeSeconds) {
                this.maxInitWaitTimeSeconds = options.maxInitWaitTimeSeconds;
            }

            if (options.pollIntervalSeconds) {
                this.pollIntervalSeconds = options.pollIntervalSeconds;
            }

            if (options.configChanged) {
                this.configChanged = options.configChanged;
            }
        }

        if (!this.maxInitWaitTimeSeconds || this.maxInitWaitTimeSeconds < 1) {
            throw new Error("Invalid 'maxInitWaitTimeSeconds' value");
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
