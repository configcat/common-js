import { ConfigCatClient, IConfigCatClient } from "./ConfigCatClient";
import { AutoPollOptions, ManualPollOptions, LazyLoadOptions, IOptions, OptionsBase } from "./ConfigCatClientOptions";
import { ProjectConfig } from "./ProjectConfig";
import { ConfigCatConsoleLogger } from "./ConfigCatLogger";

const instanceRepository = new Map<string, IConfigCatClient>();

function tryGetClient(apiKey: string): IConfigCatClient | undefined {
    let client = instanceRepository.get(apiKey);
    if (client?.isDisposed()) {
        // If the client is disposed, remove it from the repository and allow new instances from the API key.
        instanceRepository.delete(apiKey);
        return undefined;
    }
    return client;
}

/**
 * Create an instance of ConfigCatClient and setup AutoPoll mode. If a client is already initialized with a given apiKey, it will be returned.
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for autoPoll mode
 */
export function createClientWithAutoPoll(apiKey: string, configCatKernel: IConfigCatKernel, options?: IAutoPollOptions): IConfigCatClient {
    let client = tryGetClient(apiKey);
    if (client) {
        return client;
    }
    client = new ConfigCatClient(new AutoPollOptions(apiKey, options, configCatKernel.cache), configCatKernel);
    instanceRepository.set(apiKey, client);
    return client;
}

/**
 * Create an instance of ConfigCatClient and setup ManualPoll mode. If a client is already initialized with a given apiKey, it will be returned.
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for manualPoll mode
 */
export function createClientWithManualPoll(apiKey: string, configCatKernel: IConfigCatKernel, options?: IManualPollOptions): IConfigCatClient {
    let client = tryGetClient(apiKey);
    if (client) {
        return client;
    }
    client = new ConfigCatClient(new ManualPollOptions(apiKey, options, configCatKernel.cache), configCatKernel);
    instanceRepository.set(apiKey, client);
    return client;
}

/**
 * Create an instance of ConfigCatClient and setup LazyLoad mode. If a client is already initialized with a given apiKey, it will be returned.
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for lazyLoad mode
 */
export function createClientWithLazyLoad(apiKey: string, configCatKernel: IConfigCatKernel, options?: ILazyLoadingOptions): IConfigCatClient {
    let client = tryGetClient(apiKey);
    if (client) {
        return client;
    }
    client = new ConfigCatClient(new LazyLoadOptions(apiKey, options, configCatKernel.cache), configCatKernel);
    instanceRepository.set(apiKey, client);
    return client;
}

/**
 * Create an instance of ConfigCatConsoleLogger
 * @param {LogLevel} logLevel - Specifies message's filtering to output for the CofigCatConsoleLogger.
 */
export function createConsoleLogger(logLevel: LogLevel): IConfigCatLogger {
    return new ConfigCatConsoleLogger(logLevel);
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

export interface IConfigCatLogger {
    debug(message: string): void;

    /**
     * @deprecated Use `debug(message: string)` method instead of this
     */
    log(message: string): void;

    info(message: string): void;

    warn(message: string): void;

    error(message: string): void;
}

export enum LogLevel {
    Debug = 4,
    Info = 3,
    Warn = 2,
    Error = 1,
    Off = -1
}

export interface IConfigCatKernel {
    configFetcher: IConfigFetcher;
    /**
     * Default ICache implementation.
     */
    cache?: ICache;
}

export enum FetchStatus {
    Fetched = 0,
    NotModified = 1,
    Errored = 2,
}

export class FetchResult {
    public status: FetchStatus;
    public responseBody: string;
    public eTag?: string;

    constructor(status: FetchStatus, responseBody: string, eTag?: string) {
        this.status = status;
        this.responseBody = responseBody;
        this.eTag = eTag
    }

    static success(responseBody: string, eTag: string): FetchResult {
        return new FetchResult(FetchStatus.Fetched, responseBody, eTag);
    }

    static notModified(): FetchResult {
        return new FetchResult(FetchStatus.NotModified, "");
    }

    static error() {
        return new FetchResult(FetchStatus.Errored, "");
    }

}

export interface IConfigFetcher {
    fetchLogic(options: OptionsBase, lastEtag: string | null, callback: (result: FetchResult) => void): void;
}

export interface ICache {
    set(key: string, config: ProjectConfig): Promise<void> | void;

    get(key: string): Promise<ProjectConfig | null> | ProjectConfig | null;
}

export { ProjectConfig } from "./ProjectConfig";

export { IConfigCatClient } from "./ConfigCatClient";

export { OptionsBase, DataGovernance } from "./ConfigCatClientOptions";

export { User } from "./RolloutEvaluator";

export { IOverrideDataSource, FlagOverrides } from "./FlagOverrides";
