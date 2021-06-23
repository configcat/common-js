import { ConfigCatClient, IConfigCatClient } from "./ConfigCatClient";
import { AutoPollOptions, ManualPollOptions, LazyLoadOptions, IOptions, OptionsBase } from "./ConfigCatClientOptions";
import { ProjectConfig } from "./ProjectConfig";
import { ConfigCatConsoleLogger } from "./ConfigCatLogger";

/**
 * Create an instance of ConfigCatClient and setup AutoPoll mode
 * @param {string} sdkKey - SdkKey to access your configuration.
 * @param config - Configuration for autoPoll mode
 */
export function createClientWithAutoPoll(sdkKey: string, configCatKernel: IConfigCatKernel, options?: IAutoPollOptions): IConfigCatClient {
    return new ConfigCatClient(new AutoPollOptions(sdkKey, options, configCatKernel.cache), configCatKernel);
}

/**
 * Create an instance of ConfigCatClient and setup ManualPoll mode
 * @param {string} sdkKey - SdkKey to access your configuration.
 * @param config - Configuration for manualPoll mode
 */
export function createClientWithManualPoll(
    sdkKey: string,
    configCatKernel: IConfigCatKernel,
    options?: IManualPollOptions): IConfigCatClient {
        return new ConfigCatClient(new ManualPollOptions(sdkKey, options, configCatKernel.cache), configCatKernel);
    }

/**
 * Create an instance of ConfigCatClient and setup LazyLoad mode
 * @param {string} sdkKey - SdkKey to access your configuration.
 * @param config - Configuration for lazyLoad mode
 */
export function createClientWithLazyLoad(
    sdkKey: string,
    configCatKernel: IConfigCatKernel,
    options?: ILazyLoadingOptions): IConfigCatClient {
        return new ConfigCatClient(new LazyLoadOptions(sdkKey, options, configCatKernel.cache), configCatKernel);
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
    log(message: string): void;

    info(message: string): void;

    warn(message: string): void;

    error(message: string): void;
}

export enum LogLevel {    
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

export interface IConfigFetcher {
    fetchLogic(options: OptionsBase, lastProjectConfig: ProjectConfig, callback: (newProjectConfig: ProjectConfig) => void): void;
}

export interface ICache {
    set(key: string, config: ProjectConfig): void;

    get(key: string): ProjectConfig;
}

export { ProjectConfig } from "./ProjectConfig";

export { IConfigCatClient } from "./ConfigCatClient";

export { OptionsBase, DataGovernance } from "./ConfigCatClientOptions";

export { User } from "./RolloutEvaluator";
