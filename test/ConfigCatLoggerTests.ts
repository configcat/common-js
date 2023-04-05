import { assert } from "chai";
import "mocha";
import { IConfigCatLogger, LogEventId, LogLevel, LogMessage, LoggerWrapper } from "../src/ConfigCatLogger";

describe("ConfigCatLogger", () => {
  for (const level of Object.values(LogLevel).filter(key => typeof key === "number") as LogLevel[]) {
    it(`Logging works with level ${LogLevel[level]}`, () => {
      const messages: [LogLevel, LogEventId, LogMessage, any][] = [];

      const loggerImpl = new class implements IConfigCatLogger {
        level = level;
        log(level: LogLevel, eventId: LogEventId, message: LogMessage, exception?: any) {
          messages.push([level, eventId, message, exception]);
        }
      };

      const logger = new LoggerWrapper(loggerImpl);
      const err = new Error();

      logger.log(LogLevel.Debug, 0, `${LogLevel[LogLevel.Debug]} message`);
      logger.log(LogLevel.Info, 1, `${LogLevel[LogLevel.Info]} message`);
      logger.log(LogLevel.Warn, 2, `${LogLevel[LogLevel.Warn]} message`);
      logger.log(LogLevel.Error, 3, `${LogLevel[LogLevel.Error]} message`, err);

      let expectedCount = 0;
      if (level >= LogLevel.Debug) {
        assert.equal(messages.filter(([level, eventId, msg, ex]) => level === LogLevel.Debug && eventId === 0 && msg === `${LogLevel[level]} message` && ex === void 0).length, 1);
        expectedCount++;
      }

      if (level >= LogLevel.Info) {
        assert.equal(messages.filter(([level, eventId, msg, ex]) => level === LogLevel.Info && eventId === 1 && msg === `${LogLevel[level]} message` && ex === void 0).length, 1);
        expectedCount++;
      }

      if (level >= LogLevel.Warn) {
        assert.equal(messages.filter(([level, eventId, msg, ex]) => level === LogLevel.Warn && eventId === 2 && msg === `${LogLevel[level]} message` && ex === void 0).length, 1);
        expectedCount++;
      }

      if (level >= LogLevel.Error) {
        assert.equal(messages.filter(([level, eventId, msg, ex]) => level === LogLevel.Error && eventId === 3 && msg === `${LogLevel[level]} message` && ex === err).length, 1);
        expectedCount++;
      }

      assert.equal(messages.length, expectedCount);
    });
  }
});
