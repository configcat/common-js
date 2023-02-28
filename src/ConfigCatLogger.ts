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
  debug(message: string): void;

  /**
   * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please implement the logEvent() method instead.
   */
  log?(message: string): void;

  /**
   * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please implement the logEvent() method instead.
   */
  info(message: string): void;

  /**
   * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please implement the logEvent() method instead.
   */
  warn(message: string): void;

  /**
   * @deprecated This method is obsolete and will be removed from the public API in a future major version. Please implement the logEvent() method instead.
   */
  error(message: string): void;

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

  debug(message: string): void {
    this.logEvent(LogLevel.Debug, 0, message);
  }

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
  logEvent(level: LogLevel, eventId: LogEventId, message: LogMessage, exception?: any): void {
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
  }
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
