import type { Hooks } from "./Hooks";
import { errorToString } from "./Utils";

export enum LogLevel {
  Debug = 4,
  Info = 3,
  Warn = 2,
  Error = 1,
  Off = -1
}

export interface IConfigCatLogger {
  readonly level?: LogLevel;

  debug(message: string): void;

  /**
   * @deprecated Use `debug(message: string)` method instead of this
   */
  log(message: string): void;

  info(message: string): void;

  warn(message: string): void;

  error(message: string): void;
}

export class LoggerWrapper implements IConfigCatLogger {
  get level(): LogLevel {
    return this.logger.level ?? LogLevel.Warn;
  }

  constructor(
    private readonly logger: IConfigCatLogger,
    private readonly hooks?: Hooks) {
  }

  log(message: string): void {
    this.info(message);
  }

  debug(message: string): void {
    if (this.isLogLevelEnabled(LogLevel.Debug)) {
      this.logger.debug(message);
    }
  }

  info(message: string): void {
    if (this.isLogLevelEnabled(LogLevel.Info)) {
      this.logger.info(message);
    }
  }

  warn(message: string): void {
    if (this.isLogLevelEnabled(LogLevel.Warn)) {
      this.logger.warn(message);
    }
  }

  error(message: string, err?: any): void {
    if (this.isLogLevelEnabled(LogLevel.Error)) {
      const logMessage = err
        ? message + "\n" + errorToString(err, true)
        : message;

      this.logger.error(logMessage);
    }

    this.hooks?.emit("clientError", message, err);
  }

  private isLogLevelEnabled(logLevel: LogLevel): boolean {
    return this.level >= logLevel;
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
    console.info(this.SOURCE + " - DEBUG - " + message);
  }

  /** @inheritdoc */
  info(message: string): void {
    console.info(this.SOURCE + " - INFO - " + message);
  }

  /** @inheritdoc */
  warn(message: string): void {
    console.warn(this.SOURCE + " - WARN - " + message);
  }

  /** @inheritdoc */
  error(message: string): void {
    console.error(this.SOURCE + " - ERROR - " + message);
  }
}
