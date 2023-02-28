import type { Hooks } from "./Hooks";
import { errorToString } from "./Utils";

export enum LogLevel {
  Debug = 4,
  Info = 3,
  Warn = 2,
  Error = 1,
  Off = -1
}

export type LogEventId = number;

/** Represents a log message with names arguments. */
export class FormattableLogMessage {
  static from(...argNames: string[]): (strings: TemplateStringsArray, ...argValues: unknown[]) => FormattableLogMessage {
    return (strings: TemplateStringsArray, ...argValues: unknown[]) =>
      new FormattableLogMessage(strings, argNames, argValues);
  }

  private cachedDefaultFormattedMessage?: string;

  constructor(
    readonly strings: TemplateStringsArray,
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

/** Defines the interface for the ConfigCat SDK to perform logging. */
export interface IConfigCatLogger {
  readonly level?: LogLevel;

  /**
   * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please implement the logEvent() method instead.
   */
  debug?(message: string): void;

  /**
   * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please implement the logEvent() method instead.
   */
  log?(message: string): void;

  /**
   * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please implement the logEvent() method instead.
   */
  info?(message: string): void;

  /**
   * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please implement the logEvent() method instead.
   */
  warn?(message: string): void;

  /**
   * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please implement the logEvent() method instead.
   */
  error?(message: string): void;

  /**
   * Writes a message into the log.
   * @param level Level (event severity).
   * @param eventId Event identifier.
   * @param message Message.
   * @param exception The exception object related to the message (if any).
   * @remarks Later, when the deprecated methods are removed, this method will be changed to required and will be renamed to 'log'.
   */
  logEvent?(level: LogLevel, eventId: LogEventId, message: LogMessage, exception?: any): void;
}

export class LoggerWrapper implements IConfigCatLogger {
  get level(): LogLevel {
    return this.logger.level ?? LogLevel.Warn;
  }

  constructor(
    private readonly logger: IConfigCatLogger,
    private readonly hooks?: Hooks) {
  }

  debug: (message: string) => void = this.logDebug;

  info(message: string): void {
    this.logEvent(LogLevel.Info, 0, message);
  }

  warn(message: string): void {
    this.logEvent(LogLevel.Warn, 0, message);
  }

  error(message: string, err?: any): void {
    this.logEvent(LogLevel.Error, 0, message, err);
  }

  private isLogLevelEnabled(logLevel: LogLevel): boolean {
    return this.level >= logLevel;
  }

  /** @inheritdoc */
  logEvent(level: LogLevel, eventId: LogEventId, message: LogMessage, exception?: any): LogMessage {
    if (this.isLogLevelEnabled(level)) {
      if (this.logger.logEvent) {
        this.logger.logEvent(level, eventId, message, exception);
      }
      else {
        switch (level) {
          case LogLevel.Error:
            this.logger.error?.(message.toString());
            break;
          case LogLevel.Warn:
            this.logger.warn?.(message.toString());
            break;
          case LogLevel.Info:
            this.logger.info?.(message.toString());
            break;
          case LogLevel.Debug:
            this.logger.debug?.(message.toString());
            break;
          default:
            break;
        }
      }
    }

    if (level === LogLevel.Error) {
      this.hooks?.emit("clientError", message.toString(), exception);
    }

    return message;
  }

  /**
   * Shorthand method for `logger.logEvent(LogLevel.Debug, 0, message);`
   * */
  logDebug(message: string): void {
    this.logEvent(LogLevel.Debug, 0, message);
  }

  /* Common error messages (1000-1999) */

  configJsonIsNotPresentNoParam(appendix = ""): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1000,
      `Config JSON is not present${appendix.length > 0 ? appendix : ""}.`
    );
  }

  configJsonIsNotPresent(defaultParamName?: string, defaultParamValue?: unknown): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1000,
      FormattableLogMessage.from(
        "DEFAULT_PARAM_NAME", "DEFAULT_PARAM_VALUE"
      )`Config JSON is not present. Returning the \`${defaultParamName}\` parameter that you specified in your application: '${defaultParamValue}'.`
    );
  }

  settingEvaluationFailedDueToMissingKey(key: string, defaultParamName: string, defaultParamValue: unknown, availableKeys: string): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1001,
      FormattableLogMessage.from(
        "KEY", "DEFAULT_PARAM_NAME", "DEFAULT_PARAM_VALUE", "AVAILABLE_KEYS"
      )`Failed to evaluate setting '${key}' (the key was not found in config JSON). Returning the \`${defaultParamName}\` parameter that you specified in your application: '${defaultParamValue}'. Available keys: ${availableKeys}.`
    );
  }

  settingEvaluationError(methodName: string, ex: any): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1002,
      FormattableLogMessage.from(
        "METHOD_NAME"
      )`Error occurred in the \`${methodName}\` method.`,
      ex
    );
  }

  forceRefreshError(methodName: string, ex: any): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1003,
      FormattableLogMessage.from(
        "METHOD_NAME"
      )`Error occurred in the \`${methodName}\` method.`,
      ex
    );
  }

  fetchFailedDueToInvalidSdkKey(): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1100,
      "Your SDK Key seems to be wrong. You can find the valid SDK Key at https://app.configcat.com/sdkkey"
    );
  }

  fetchFailedDueToUnexpectedHttpResponse(statusCode: number, reasonPhrase: string): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1101,
      FormattableLogMessage.from(
        "STATUS_CODE", "REASON_PHRASE"
      )`Unexpected HTTP response was received while trying to fetch config JSON: ${statusCode} ${reasonPhrase}`
    );
  }

  fetchFailedDueToRequestTimeout(timeoutMs: number, ex: any): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1102,
      FormattableLogMessage.from(
        "TIMEOUT"
      )`Request timed out while trying to fetch config JSON. Timeout value: ${timeoutMs}ms`,
      ex);
  }

  fetchFailedDueToUnexpectedError(ex: any): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1103,
      "Unexpected error occurred while trying to fetch config JSON.",
      ex
    );
  }

  fetchFailedDueToRedirectLoop(): LogMessage {
    return this.logEvent(
      LogLevel.Error, 1104,
      "Redirection loop encountered while trying to fetch config JSON. Please contact us at https://configcat.com/support/"
    );
  }

  /* SDK-specific error messages (2000-2999) */

  settingForVariationIdIsNotPresent(variationId: string): LogMessage {
    return this.logEvent(
      LogLevel.Error, 2011,
      FormattableLogMessage.from(
        "VARIATION_ID"
      )`Could not find the setting for the specified variation ID: '${variationId}'.`
    );
  }

  /* Common warning messages (3000-3999) */

  clientIsAlreadyCreated(sdkKey: string): LogMessage {
    return this.logEvent(
      LogLevel.Warn, 3000,
      FormattableLogMessage.from(
        "SDK_KEY"
      )`There is an existing client instance for the specified SDK Key. No new client instance will be created and the specified options are ignored. Returning the existing client instance. SDK Key: '${sdkKey}'.`
    );
  }

  targetingIsNotPossible(key: string): LogMessage {
    return this.logEvent(
      LogLevel.Warn, 3001,
      FormattableLogMessage.from(
        "KEY"
      )`Cannot evaluate targeting rules and % options for setting '${key}' (User Object is missing). You should pass a User Object to the evaluation methods like \`getValueAsync()\` in order to make targeting work properly. Read more: https://configcat.com/docs/advanced/user-object/`
    );
  }

  dataGovernanceIsOutOfSync(): LogMessage {
    return this.logEvent(
      LogLevel.Warn, 3002,
      "The `dataGovernance` parameter specified at the client initialization is not in sync with the preferences on the ConfigCat Dashboard. Read more: https://configcat.com/docs/advanced/data-governance/"
    );
  }

  fetchReceived200WithInvalidBody(): LogMessage {
    return this.logEvent(
      LogLevel.Warn, 3100,
      "Fetching config JSON was successful but the HTTP response content was invalid."
    );
  }

  fetchReceived304WhenLocalCacheIsEmpty(statusCode: number, reasonPhrase: string): LogMessage {
    return this.logEvent(
      LogLevel.Warn, 3101,
      FormattableLogMessage.from(
        "STATUS_CODE", "REASON_PHRASE"
      )`Unexpected HTTP response was received when no config JSON is cached locally: ${statusCode} ${reasonPhrase}`
    );
  }

  configServiceCannotInitiateHttpCalls(): LogMessage {
    return this.logEvent(
      LogLevel.Warn, 3200,
      "Client is in offline mode, it cannot initiate HTTP calls."
    );
  }

  configServiceMethodHasNoEffectDueToDisposedClient(methodName: string): LogMessage {
    return this.logEvent(
      LogLevel.Warn, 3201,
      FormattableLogMessage.from(
        "METHOD_NAME"
      )`The client object is already disposed, thus \`${methodName}()\` has no effect.`
    );
  }

  configServiceMethodHasNoEffectDueToOverrideBehavior(overrideBehavior: string, methodName: string): LogMessage {
    return this.logEvent(
      LogLevel.Warn, 3202,
      FormattableLogMessage.from(
        "OVERRIDE_BEHAVIOR", "METHOD_NAME"
      )`Client is configured to use the \`${overrideBehavior}\` override behavior, thus \`${methodName}()\` has no effect.`
    );
  }

  /* SDK-specific warning messages (4000-4999) */

  /* Common info messages (5000-5999) */

  settingEvaluated(evaluateLog: object): LogMessage {
    return this.logEvent(
      LogLevel.Info, 5000,
      FormattableLogMessage.from(
        "EVALUATE_LOG"
      )`${evaluateLog}`);
  }

  configServiceStatusChanged(status: string): LogMessage {
    return this.logEvent(
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
  constructor(public level = LogLevel.Warn) {
  }

  /** @inheritdoc */
  log(message: string): void {
    this.info(message);
  }

  /** @inheritdoc */
  debug(message: string): void {
    this.logEvent(LogLevel.Debug, 0, message);
  }

  /** @inheritdoc */
  info(message: string): void {
    this.logEvent(LogLevel.Info, 0, message);
  }

  /** @inheritdoc */
  warn(message: string): void {
    this.logEvent(LogLevel.Warn, 0, message);
  }

  /** @inheritdoc */
  error(message: string): void {
    this.logEvent(LogLevel.Error, 0, message);
  }

  /** @inheritdoc */
  logEvent(level: LogLevel, eventId: LogEventId, message: LogMessage, exception?: any): void {
    const [logMethod, levelString] =
      level === LogLevel.Debug ? [console.info, "DEBUG"] :
      level === LogLevel.Info ? [console.info, "INFO"] :
      level === LogLevel.Warn ? [console.warn, "WARN"] :
      level === LogLevel.Error ? [console.error, "ERROR"] :
      [console.log, LogLevel[level].toUpperCase()];

    const exceptionString = exception !== void 0 ? "\n" + errorToString(exception, true) : "";

    logMethod(`${this.SOURCE} - ${levelString} - [${eventId}] ${message}${exceptionString}`);
  }
}
