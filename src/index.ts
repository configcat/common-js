import { ConfigCatClientImpl, IConfigCatClient } from "./ConfigCatClientImpl";
import { AutoPollConfiguration, ManualPollConfiguration, LazyLoadConfiguration, IOptions } from "./ConfigCatClientOptions";
import { ProjectConfig } from "./ProjectConfigService";

/**
 * Create an instance of ConfigCatClient and setup AutoPoll mode
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for autoPoll mode
 */
export function createClientWithAutoPoll(apiKey: string, configCatKernel: IConfigCatKernel, options?: IAutoPollOptions): IConfigCatClient {

    let c: AutoPollConfiguration = new AutoPollConfiguration();

    

    var result: ConfigCatClientImpl = new ConfigCatClientImpl(apiKey, configCatKernel.configFetcher, c, configCatKernel.cache);

    return result;
}

/**
 * Create an instance of ConfigCatClient and setup ManualPoll mode
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for manualPoll mode
 */
export function createClientWithManualPoll(apiKey: string, configCatKernel: IConfigCatKernel, options?: IManualPollOptions): IConfigCatClient {

    let c: ManualPollConfiguration = new ManualPollConfiguration();

    if (config && config.logger) {
        c.logger = config.logger;
    }

    var result: ConfigCatClientImpl = new ConfigCatClientImpl(apiKey, configCatKernel.configFetcher, c, configCatKernel.cache);

    return result;
}

/**
 * Create an instance of ConfigCatClient and setup LazyLoad mode
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for lazyLoad mode
 */
export function createClientWithLazyLoad(apiKey: string, configCatKernel: IConfigCatKernel, options?: ILazyLoadingOptions): IConfigCatClient {

    let c: LazyLoadConfiguration = new LazyLoadConfiguration();

    if (config && config.logger) {
        c.logger = config.logger;
    }

    if (config && config.cacheTimeToLiveSeconds) {
        c.cacheTimeToLiveSeconds = config.cacheTimeToLiveSeconds;
    }

    var result: ConfigCatClientImpl = new ConfigCatClientImpl(apiKey, configCatKernel.configFetcher, c, configCatKernel.cache);

    return result;
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

    error(message: string): void;
}

export interface IConfigCatKernel{
    configFetcher: IConfigFetcher;
    cache: ICache;
}

export interface IConfigFetcher {
    fetchLogic(lastProjectConfig: ProjectConfig, callback: (newProjectConfig: ProjectConfig) => void): void;
}

export interface ICache {
    Set(config: ProjectConfig): void;

    Get(): ProjectConfig;
}