import { ConfigCatClient, IConfigCatClient } from "./ConfigCatClient";
import { AutoPollOptions, ManualPollOptions, LazyLoadOptions, IOptions, OptionsBase } from "./ConfigCatClientOptions";
import { ProjectConfig } from "./ProjectConfig";
import { ConfigCatConsoleLogger } from "./ConfigCatLogger";
import { setupPolyfills } from "./Polyfills";

setupPolyfills();

/**
 * Returns an instance of ConfigCatClient for the specified SDK Key.
 * @remarks This method returns a single, shared instance per each distinct SDK Key.
 * That is, a new client object is created only when there is none available for the specified SDK Key.
 * Otherwise, the already created instance is returned (in which case the 'pollingMode', 'options' and 'configCatKernel' arguments are ignored).
 * So, please keep in mind that when you make multiple calls to this method using the same SDK Key, you may end up with multiple references to the same client object.
 * @param sdkKey SDK Key (a.k.a ApiKey) to access configuration
 * @param pollingMode The polling mode to use
 * @param options Options for the specified polling mode
 */
export function getClient<TMode extends PollingMode>(sdkKey: string, pollingMode: TMode, options: OptionsForPollingMode<TMode> | undefined | null, configCatKernel: IConfigCatKernel): IConfigCatClient {
    return ConfigCatClient.get(sdkKey, pollingMode, options, configCatKernel);
}

/**
 * Create an instance of ConfigCatClient and setup AutoPoll mode
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for autoPoll mode
 */
export function createClientWithAutoPoll(apiKey: string, configCatKernel: IConfigCatKernel, options?: IAutoPollOptions): IConfigCatClient {
    return new ConfigCatClient(new AutoPollOptions(apiKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.cache), configCatKernel);
}

/**
 * Create an instance of ConfigCatClient and setup ManualPoll mode
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for manualPoll mode
 */
export function createClientWithManualPoll(
    apiKey: string,
    configCatKernel: IConfigCatKernel,
    options?: IManualPollOptions): IConfigCatClient {
    return new ConfigCatClient(new ManualPollOptions(apiKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.cache), configCatKernel);
}

/**
 * Create an instance of ConfigCatClient and setup LazyLoad mode
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for lazyLoad mode
 */
export function createClientWithLazyLoad(
    apiKey: string,
    configCatKernel: IConfigCatKernel,
    options?: ILazyLoadingOptions): IConfigCatClient {
    return new ConfigCatClient(new LazyLoadOptions(apiKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.cache), configCatKernel);
}

/**
 * Create an instance of ConfigCatConsoleLogger
 * @param {LogLevel} logLevel - Specifies message's filtering to output for the CofigCatConsoleLogger.
 */
export function createConsoleLogger(logLevel: LogLevel): IConfigCatLogger {
    return new ConfigCatConsoleLogger(logLevel);
}

export enum PollingMode {
    AutoPoll,
    ManualPoll,
    LazyLoad,
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
    sdkType: string;
    sdkVersion: string;
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

export type { IConfigCatClient } from "./ConfigCatClient";

export { OptionsBase, DataGovernance } from "./ConfigCatClientOptions";

export { User } from "./RolloutEvaluator";

export type { IOverrideDataSource } from "./FlagOverrides";

export { FlagOverrides, MapOverrideDataSource, OverrideBehaviour } from "./FlagOverrides";
