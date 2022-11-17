import { ConfigCatClient, IConfigCatClient, IConfigCatKernel } from "./ConfigCatClient";
import { AutoPollOptions, IAutoPollOptions, ILazyLoadingOptions, IManualPollOptions, LazyLoadOptions, ManualPollOptions, OptionsForPollingMode, PollingMode } from "./ConfigCatClientOptions";
import { ConfigCatConsoleLogger, IConfigCatLogger, LogLevel } from "./ConfigCatLogger";
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
 * @deprecated This function is obsolete and will be removed from the public API in a future major version. To obtain a ConfigCatClient instance with auto polling for a specific SDK Key, please use the 'getClient(sdkKey, PollingMode.AutoPoll, options, ...)' format.
 */
export function createClientWithAutoPoll(apiKey: string, configCatKernel: IConfigCatKernel, options?: IAutoPollOptions): IConfigCatClient {
    return new ConfigCatClient(new AutoPollOptions(apiKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.cache), configCatKernel);
}

/**
 * Create an instance of ConfigCatClient and setup ManualPoll mode
 * @param {string} apiKey - ApiKey to access your configuration.
 * @param config - Configuration for manualPoll mode
 * @deprecated This function is obsolete and will be removed from the public API in a future major version. To obtain a ConfigCatClient instance with manual polling for a specific SDK Key, please use the 'getClient(sdkKey, PollingMode.ManualPoll, options, ...)' format.
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
 * @deprecated This function is obsolete and will be removed from the public API in a future major version. To obtain a ConfigCatClient instance with lazy loading for a specific SDK Key, please use the 'getClient(sdkKey, PollingMode.LazyLoad, options, ...)' format.
 */
export function createClientWithLazyLoad(
    apiKey: string,
    configCatKernel: IConfigCatKernel,
    options?: ILazyLoadingOptions): IConfigCatClient {
    return new ConfigCatClient(new LazyLoadOptions(apiKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.cache), configCatKernel);
}

/**
 * Create an instance of ConfigCatConsoleLogger
 * @param {LogLevel} logLevel - Specifies message's filtering to output for the ConfigCatConsoleLogger.
 */
export function createConsoleLogger(logLevel: LogLevel): IConfigCatLogger {
    return new ConfigCatConsoleLogger(logLevel);
}

export { PollingMode }

export type { IAutoPollOptions, IManualPollOptions, ILazyLoadingOptions, OptionsForPollingMode }

export type { IConfigCatLogger }

export { LogLevel }

export type { IConfigCatKernel }

export { FetchStatus, FetchResult } from './ConfigFetcher';

export type { IConfigFetcher } from './ConfigFetcher';

export type { ICache } from './Cache';

export { ProjectConfig } from "./ProjectConfig";

export type { IConfigCatClient } from "./ConfigCatClient";

export { OptionsBase, DataGovernance } from "./ConfigCatClientOptions";

export { User } from "./RolloutEvaluator";

export type { IOverrideDataSource } from "./FlagOverrides";

export { FlagOverrides, MapOverrideDataSource, OverrideBehaviour } from "./FlagOverrides";
