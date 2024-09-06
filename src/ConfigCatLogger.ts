import type { SafeHooksWrapper } from "./Hooks";
import { errorToString } from "./Utils";

/**
 * Specifies event severity levels for the `IConfigCatLogger` interface.
 * The levels are interpreted as minimum levels in the case of event filtering.
*/
export enum LogLevel {
  /** All events are logged. */
  Debug = 4,
  /** Info, Warn and Error are logged. Debug events are discarded. */
  Info = 3,
  /** Warn and Error events are logged. Info and Debug events are discarded. */
  Warn = 2,
  /** Error events are logged. All other events are discarded. */
  Error = 1,
  /** No events are logged. */
  Off = -1
}

export type LogEventId = number;

/** Represents a log message format with named arguments. */
export class FormattableLogMessage {
  static from(...argNames: string[]): (strings: TemplateStringsArray, ...argValues: unknown[]) => FormattableLogMessage {
    return (strings: TemplateStringsArray, ...argValues: unknown[]) =>
      new FormattableLogMessage(strings, argNames, argValues);
  }

  private cachedDefaultFormattedMessage?: string;

  constructor(
    readonly strings: ReadonlyArray<string>,
    readonly argNames: ReadonlyArray<string>,
    readonly argValues: ReadonlyArray<unknown>) {
  }

  get defaultFormattedMessage(): string {
    let cachedMessage = this.cachedDefaultFormattedMessage;

    if (cachedMessage === void 0) {
      // This logic should give exactly the same result as string interpolation.
      cachedMessage = "";
      const { strings, argValues } = this;
      let i = 0;
      for (; i < strings.length - 1; i++) {
        cachedMessage += strings[i];
        cachedMessage += argValues[i];
      }
      cachedMessage += strings[i];
      this.cachedDefaultFormattedMessage = cachedMessage;
    }

    return cachedMessage;
  }

  toString(): string { return this.defaultFormattedMessage; }
}

export type LogMessage = string | FormattableLogMessage;

/** Defines the interface used by the ConfigCat SDK to perform logging. */
export interface IConfigCatLogger {
  /** Gets the log level (the minimum level to use for filtering log events). */
  readonly level?: LogLevel;

  /** Gets the character sequence to use for line breaks in log messages. Defaults to "\n". */
  readonly eol?: string;

  /**
   * Writes an event into the log.
   * @param level Event severity level.
   * @param eventId Event identifier.
   * @param message Message.
   * @param exception The exception object related to the message (if any).
   */
  log(level: LogLevel, eventId: LogEventId, message: LogMessage, exception?: any): void;
}

export class LoggerWrapper implements IConfigCatLogger {
  get level(): LogLevel {
    return this.logger.level ?? LogLevel.Warn;
  }

  get eol(): string {
    return this.logger.eol ?? "\n";
  }

  constructor(
    private readonly logger: IConfigCatLogger,
    private readonly hooks?: SafeHooksWrapper) {
  }

  isEnabled(logLevel: LogLevel): boolean {
    return this.level >= logLevel;
  }

  /** @inheritdoc */
  log(level: LogLevel, eventId: LogEventId, message: LogMessage, exception?: any): LogMessage {
    if (this.isEnabled(level)) {
      this.logger.log(level, eventId, message, exception);
    }

    if (level === LogLevel.Error) {
      this.hooks?.emit("clientError", message.toString(), exception);
    }

    return message;
  }

  /**
   * Shorthand method for `logger.logEvent(LogLevel.Debug, 0, message);`
   */
  debug(message: string): void {
    this.log(LogLevel.Debug, 0, message);
  }

  /* Common error messages (1000-1999) */

  configJsonIsNotPresent(defaultReturnValue: string): LogMessage {
    return this.log(
      LogLevel.Error, 1000,
      FormattableLogMessage.from(
        "DEFAULT_RETURN_VALUE"
      )`Config JSON is not present. Returning ${defaultReturnValue}.`
    );
  }

  configJsonIsNotPresentSingle(key: string, defaultParamName: string, defaultParamValue: unknown): LogMessage {
    return this.log(
      LogLevel.Error, 1000,
      FormattableLogMessage.from(
        "KEY", "DEFAULT_PARAM_NAME", "DEFAULT_PARAM_VALUE"
      )`Config JSON is not present when evaluating setting '${key}'. Returning the \`${defaultParamName}\` parameter that you specified in your application: '${defaultParamValue}'.`
    );
  }

  settingEvaluationFailedDueToMissingKey(key: string, defaultParamName: string, defaultParamValue: unknown, availableKeys: string): LogMessage {
    return this.log(
      LogLevel.Error, 1001,
      FormattableLogMessage.from(
        "KEY", "DEFAULT_PARAM_NAME", "DEFAULT_PARAM_VALUE", "AVAILABLE_KEYS"
      )`Failed to evaluate setting '${key}' (the key was not found in config JSON). Returning the \`${defaultParamName}\` parameter that you specified in your application: '${defaultParamValue}'. Available keys: [${availableKeys}].`
    );
  }

  settingEvaluationError(methodName: string, defaultReturnValue: string, ex: any): LogMessage {
    return this.log(
      LogLevel.Error, 1002,
      FormattableLogMessage.from(
        "METHOD_NAME", "DEFAULT_RETURN_VALUE",
      )`Error occurred in the \`${methodName}\` method. Returning ${defaultReturnValue}.`,
      ex
    );
  }

  settingEvaluationErrorSingle(methodName: string, key: string, defaultParamName: string, defaultParamValue: unknown, ex: any): LogMessage {
    return this.log(
      LogLevel.Error, 1002,
      FormattableLogMessage.from(
        "METHOD_NAME", "KEY", "DEFAULT_PARAM_NAME", "DEFAULT_PARAM_VALUE",
      )`Error occurred in the \`${methodName}\` method while evaluating setting '${key}'. Returning the \`${defaultParamName}\` parameter that you specified in your application: '${defaultParamValue}'.`,
      ex
    );
  }

  forceRefreshError(methodName: string, ex: any): LogMessage {
    return this.log(
      LogLevel.Error, 1003,
      FormattableLogMessage.from(
        "METHOD_NAME"
      )`Error occurred in the \`${methodName}\` method.`,
      ex
    );
  }

  fetchFailedDueToInvalidSdkKey(): LogMessage {
    return this.log(
      LogLevel.Error, 1100,
      "Your SDK Key seems to be wrong. You can find the valid SDK Key at https://app.configcat.com/sdkkey"
    );
  }

  fetchFailedDueToUnexpectedHttpResponse(statusCode: number, reasonPhrase: string): LogMessage {
    return this.log(
      LogLevel.Error, 1101,
      FormattableLogMessage.from(
        "STATUS_CODE", "REASON_PHRASE"
      )`Unexpected HTTP response was received while trying to fetch config JSON: ${statusCode} ${reasonPhrase}`
    );
  }

  fetchFailedDueToRequestTimeout(timeoutMs: number, ex: any): LogMessage {
    return this.log(
      LogLevel.Error, 1102,
      FormattableLogMessage.from(
        "TIMEOUT"
      )`Request timed out while trying to fetch config JSON. Timeout value: ${timeoutMs}ms`,
      ex);
  }

  fetchFailedDueToUnexpectedError(ex: any): LogMessage {
    return this.log(
      LogLevel.Error, 1103,
      "Unexpected error occurred while trying to fetch config JSON. It is most likely due to a local network issue. Please make sure your application can reach the ConfigCat CDN servers (or your proxy server) over HTTP.",
      ex
    );
  }

  fetchFailedDueToRedirectLoop(): LogMessage {
    return this.log(
      LogLevel.Error, 1104,
      "Redirection loop encountered while trying to fetch config JSON. Please contact us at https://configcat.com/support/"
    );
  }

  fetchReceived200WithInvalidBody(ex: any): LogMessage {
    return this.log(
      LogLevel.Error, 1105,
      "Fetching config JSON was successful but the HTTP response content was invalid.",
      ex
    );
  }

  fetchReceived304WhenLocalCacheIsEmpty(statusCode: number, reasonPhrase: string): LogMessage {
    return this.log(
      LogLevel.Error, 1106,
      FormattableLogMessage.from(
        "STATUS_CODE", "REASON_PHRASE"
      )`Unexpected HTTP response was received when no config JSON is cached locally: ${statusCode} ${reasonPhrase}`
    );
  }

  autoPollConfigServiceErrorDuringPolling(ex: any): LogMessage {
    return this.log(
      LogLevel.Error, 1200,
      "Error occurred during auto polling.",
      ex
    );
  }

  /* SDK-specific error messages (2000-2999) */

  settingForVariationIdIsNotPresent(variationId: string): LogMessage {
    return this.log(
      LogLevel.Error, 2011,
      FormattableLogMessage.from(
        "VARIATION_ID"
      )`Could not find the setting for the specified variation ID: '${variationId}'.`
    );
  }

  configServiceCacheReadError(ex: any): LogMessage {
    return this.log(
      LogLevel.Error, 2200,
      "Error occurred while reading the cache.",
      ex);
  }

  configServiceCacheWriteError(ex: any): LogMessage {
    return this.log(
      LogLevel.Error, 2201,
      "Error occurred while writing the cache.",
      ex);
  }

  /* Common warning messages (3000-3999) */

  clientIsAlreadyCreated(sdkKey: string): LogMessage {
    return this.log(
      LogLevel.Warn, 3000,
      FormattableLogMessage.from(
        "SDK_KEY"
      )`There is an existing client instance for the specified SDK Key. No new client instance will be created and the specified options are ignored. Returning the existing client instance. SDK Key: '${sdkKey}'.`
    );
  }

  userObjectIsMissing(key: string): LogMessage {
    return this.log(
      LogLevel.Warn, 3001,
      FormattableLogMessage.from(
        "KEY"
      )`Cannot evaluate targeting rules and % options for setting '${key}' (User Object is missing). You should pass a User Object to the evaluation methods like \`getValueAsync()\` in order to make targeting work properly. Read more: https://configcat.com/docs/advanced/user-object/`
    );
  }

  dataGovernanceIsOutOfSync(): LogMessage {
    return this.log(
      LogLevel.Warn, 3002,
      "The `dataGovernance` parameter specified at the client initialization is not in sync with the preferences on the ConfigCat Dashboard. Read more: https://configcat.com/docs/advanced/data-governance/"
    );
  }

  userObjectAttributeIsMissingPercentage(key: string, attributeName: string): LogMessage {
    return this.log(
      LogLevel.Warn, 3003,
      FormattableLogMessage.from(
        "KEY", "ATTRIBUTE_NAME", "ATTRIBUTE_NAME"
      )`Cannot evaluate % options for setting '${key}' (the User.${attributeName} attribute is missing). You should set the User.${attributeName} attribute in order to make targeting work properly. Read more: https://configcat.com/docs/advanced/user-object/`
    );
  }

  userObjectAttributeIsMissingCondition(condition: string, key: string, attributeName: string): LogMessage {
    return this.log(
      LogLevel.Warn, 3003,
      FormattableLogMessage.from(
        "CONDITION", "KEY", "ATTRIBUTE_NAME", "ATTRIBUTE_NAME"
      )`Cannot evaluate condition (${condition}) for setting '${key}' (the User.${attributeName} attribute is missing). You should set the User.${attributeName} attribute in order to make targeting work properly. Read more: https://configcat.com/docs/advanced/user-object/`
    );
  }

  userObjectAttributeIsInvalid(condition: string, key: string, reason: string, attributeName: string): LogMessage {
    return this.log(
      LogLevel.Warn, 3004,
      FormattableLogMessage.from(
        "CONDITION", "KEY", "REASON", "ATTRIBUTE_NAME"
      )`Cannot evaluate condition (${condition}) for setting '${key}' (${reason}). Please check the User.${attributeName} attribute and make sure that its value corresponds to the comparison operator.`
    );
  }

  userObjectAttributeIsAutoConverted(condition: string, key: string, attributeName: string, attributeValue: string): LogMessage {
    return this.log(
      LogLevel.Warn,
      3005,
      FormattableLogMessage.from(
        "CONDITION", "KEY", "ATTRIBUTE_NAME", "ATTRIBUTE_VALUE"
      )`Evaluation of condition (${condition}) for setting '${key}' may not produce the expected result (the User.${attributeName} attribute is not a string value, thus it was automatically converted to the string value '${attributeValue}'). Please make sure that using a non-string value was intended.`
    );
  }

  configServiceCannotInitiateHttpCalls(): LogMessage {
    return this.log(
      LogLevel.Warn, 3200,
      "Client is in offline mode, it cannot initiate HTTP calls."
    );
  }

  configServiceMethodHasNoEffectDueToDisposedClient(methodName: string): LogMessage {
    return this.log(
      LogLevel.Warn, 3201,
      FormattableLogMessage.from(
        "METHOD_NAME"
      )`The client object is already disposed, thus \`${methodName}()\` has no effect.`
    );
  }

  configServiceMethodHasNoEffectDueToOverrideBehavior(overrideBehavior: string, methodName: string): LogMessage {
    return this.log(
      LogLevel.Warn, 3202,
      FormattableLogMessage.from(
        "OVERRIDE_BEHAVIOR", "METHOD_NAME"
      )`Client is configured to use the \`${overrideBehavior}\` override behavior, thus \`${methodName}()\` has no effect.`
    );
  }

  /* SDK-specific warning messages (4000-4999) */

  /* Common info messages (5000-5999) */

  settingEvaluated(evaluateLog: string): LogMessage {
    return this.log(
      LogLevel.Info, 5000,
      FormattableLogMessage.from(
        "EVALUATE_LOG"
      )`${evaluateLog}`);
  }

  configServiceStatusChanged(status: string): LogMessage {
    return this.log(
      LogLevel.Info, 5200,
      FormattableLogMessage.from(
        "MODE"
      )`Switched to ${status.toUpperCase()} mode.`);
  }

  /* SDK-specific info messages (6000-6999) */

}

export class ConfigCatConsoleLogger implements IConfigCatLogger {

  SOURCE = "ConfigCat";

  /**
   * Create an instance of ConfigCatConsoleLogger
   */
  constructor(public level = LogLevel.Warn, readonly eol = "\n") {
  }

  /** @inheritdoc */
  log(level: LogLevel, eventId: LogEventId, message: LogMessage, exception?: any): void {
    const [logMethod, levelString] =
      level === LogLevel.Debug ? [console.info, "DEBUG"] :
      level === LogLevel.Info ? [console.info, "INFO"] :
      level === LogLevel.Warn ? [console.warn, "WARN"] :
      level === LogLevel.Error ? [console.error, "ERROR"] :
      [console.log, LogLevel[level].toUpperCase()];

    const exceptionString = exception !== void 0 ? this.eol + errorToString(exception, true) : "";

    logMethod(`${this.SOURCE} - ${levelString} - [${eventId}] ${message}${exceptionString}`);
  }
}
