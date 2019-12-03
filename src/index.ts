import { ConfigCatClient, IConfigCatClient } from "./ConfigCatClient";
import { AutoPollOptions, ManualPollOptions, LazyLoadOptions, IOptions, OptionsBase } from "./ConfigCatClientOptions";
import { ProjectConfig } from "./ProjectConfig";

/**
 * Create an instance of ConfigCatClient and setup AutoPoll mode
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for autoPoll mode
 */
export function createClientWithAutoPoll(apiKey: string, configCatKernel: IConfigCatKernel, options?: IAutoPollOptions): IConfigCatClient {
    return new ConfigCatClient(new AutoPollOptions(apiKey, options), configCatKernel);
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
        return new ConfigCatClient(new ManualPollOptions(apiKey, options), configCatKernel);
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
        return new ConfigCatClient(new LazyLoadOptions(apiKey, options), configCatKernel);
    }

export interface IAutoPollOptions extends IOptions {
    pollIntervalSeconds?: number;

    configChanged?: () => void;
}

export interface IManualPollOptions extends IOptions {
}

export interface ILazyLoadingOptions extends IOptions {
    cacheTimeToLiveSeconds?: number;
}

export interface IConfigCatLogger {
    log(message: string): void;

    debug(message: string): void;

    info(message: string): void;

    warn(message: string): void;

    error(message: string): void;

    isEnable(logLevel: LogLevel): boolean;
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
    cache: ICache;
}

export interface IConfigFetcher {
    fetchLogic(options: OptionsBase, lastProjectConfig: ProjectConfig, callback: (newProjectConfig: ProjectConfig) => void): void;
}

export interface ICache {
    Set(apiKey: string, config: ProjectConfig): void;

    Get(apiKey: string): ProjectConfig;
}