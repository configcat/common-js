import type { IConfigCatClient, IConfigCatKernel } from "./ConfigCatClient";
import { ConfigCatClient } from "./ConfigCatClient";
import type { IAutoPollOptions, ILazyLoadingOptions, IManualPollOptions, OptionsForPollingMode } from "./ConfigCatClientOptions";
import { PollingMode } from "./ConfigCatClientOptions";
import type { IConfigCatLogger } from "./ConfigCatLogger";
import { ConfigCatConsoleLogger, LogLevel } from "./ConfigCatLogger";
import { setupPolyfills } from "./Polyfills";

setupPolyfills();

/**
 * Returns an instance of `ConfigCatClient` for the specified SDK Key.
 * @remarks This method returns a single, shared instance per each distinct SDK Key.
 * That is, a new client object is created only when there is none available for the specified SDK Key.
 * Otherwise, the already created instance is returned (in which case the `pollingMode`, `options` and `configCatKernel` arguments are ignored).
 * So, please keep in mind that when you make multiple calls to this method using the same SDK Key, you may end up with multiple references to the same client object.
 * @param sdkKey SDK Key to access the ConfigCat config.
 * @param pollingMode The polling mode to use.
 * @param options Options for the specified polling mode.
 */
export function getClient<TMode extends PollingMode>(sdkKey: string, pollingMode: TMode, options: OptionsForPollingMode<TMode> | undefined | null, configCatKernel: IConfigCatKernel): IConfigCatClient {
  return ConfigCatClient.get(sdkKey, pollingMode, options, configCatKernel);
}

/**
 * Disposes all existing `ConfigCatClient` instances.
 */
export function disposeAllClients(): void {
  ConfigCatClient.disposeAll();
}

/**
 * Creates an instance of `ConfigCatConsoleLogger`.
 * @param logLevel Log level (the minimum level to use for filtering log events).
 */
export function createConsoleLogger(logLevel: LogLevel): IConfigCatLogger {
  return new ConfigCatConsoleLogger(logLevel);
}

/* Public types for platform-specific SDKs */

// List types here which are required to implement the platform-specific SDKs but shouldn't be exposed to end users.

export type { IConfigCatKernel };

export type { IConfigFetcher, IFetchResponse, FetchErrorCauses } from "./ConfigFetcher";

export { FetchStatus, FetchResult, FetchError } from "./ConfigFetcher";

export type { OptionsBase } from "./ConfigCatClientOptions";

export type { IConfigCache } from "./ConfigCatCache";

export { ExternalConfigCache } from "./ConfigCatCache";

export type { IEventProvider, IEventEmitter } from "./EventEmitter";

export type { IOverrideDataSource } from "./FlagOverrides";

export { FlagOverrides, MapOverrideDataSource } from "./FlagOverrides";

/* Public types for end users */

// List types here which are part of the public API of platform-specific SDKs, thus, should be exposed to end users.
// These exports should be re-exported in the entry module of each platform-specific SDK!

export { PollingMode };

export type { IOptions } from "./ConfigCatClientOptions";

export type { IAutoPollOptions, IManualPollOptions, ILazyLoadingOptions };

export { DataGovernance } from "./ConfigCatClientOptions";

export type { IConfigCatLogger };

export type { LogEventId, LogMessage } from "./ConfigCatLogger";

export { LogLevel };

export { FormattableLogMessage } from "./ConfigCatLogger";

export type { IConfigCatCache } from "./ConfigCatCache";

export type {
  IConfig, ISegment, SettingTypeMap, SettingValue, VariationIdValue, ISettingValueContainer, ISettingUnion, ISetting, ITargetingRule, IPercentageOption,
  ConditionTypeMap, IConditionUnion, ICondition, UserConditionComparisonValueTypeMap, IUserConditionUnion, IUserCondition, IPrerequisiteFlagCondition, ISegmentCondition
} from "./ProjectConfig";

export { SettingType, UserComparator, PrerequisiteFlagComparator, SegmentComparator } from "./ProjectConfig";

export type { IConfigCatClient };

export type { IConfigCatClientSnapshot } from "./ConfigCatClient";

export { SettingKeyValue } from "./ConfigCatClient";

export type { IEvaluationDetails, SettingTypeOf } from "./RolloutEvaluator";

export { User } from "./User";

export { OverrideBehaviour } from "./FlagOverrides";

export { ClientCacheState, RefreshResult } from "./ConfigServiceBase";

export type { IProvidesHooks, HookEvents } from "./Hooks";

export { ClientReadyState } from "./Hooks";
