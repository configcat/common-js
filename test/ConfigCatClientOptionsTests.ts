import { assert, expect } from "chai";
import "mocha";
import { OverrideBehaviour, User, createFlagOverridesFromMap } from "../src";
import { ExternalConfigCache, IConfigCache, InMemoryConfigCache } from "../src/ConfigCatCache";
import { getSerializableOptions } from "../src/ConfigCatClient";
import { AutoPollOptions, LazyLoadOptions, ManualPollOptions, OptionsBase } from "../src/ConfigCatClientOptions";
import { ConfigCatConsoleLogger, IConfigCatLogger, LogEventId, LogLevel, LogMessage, LoggerWrapper } from "../src/ConfigCatLogger";
import { ProjectConfig } from "../src/ProjectConfig";
import { FakeExternalCache } from "./helpers/fakes";

describe("Options", () => {

  it("ManualPollOptions initialization With -1 requestTimeoutMs ShouldThrowError", () => {
    expect(() => {
      new ManualPollOptions("APIKEY", "common", "1.0.0", { requestTimeoutMs: -1 }, null);
    }).to.throw("Invalid 'requestTimeoutMs' value");
  });

  it("ManualPollOptions initialization With NULL 'defaultCache' Should init with InMemoryCache", () => {
    const options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", null, null);

    assert.isNotNull(options.cache);
    assert.instanceOf(options.cache, InMemoryConfigCache);
  });

  it("ManualPollOptions initialization With 'sdkKey' Should create an instance, defaults OK", () => {
    const options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", null, null);
    assert.isDefined(options);

    assert.equal("APIKEY", options.sdkKey);
    assert.equal(30000, options.requestTimeoutMs);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v6.json?sdk=common/m-1.0.0", options.getUrl());
  });

  it("ManualPollOptions initialization With parameters works", () => {
    const fakeLogger: FakeLogger = new FakeLogger();

    const options: ManualPollOptions = new ManualPollOptions(
      "APIKEY", "common", "1.0.0",
      {
        logger: fakeLogger,
        requestTimeoutMs: 10,
        proxy: "http://fake-proxy.com:8080"
      },
      null);

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger["logger"]);
    assert.equal("APIKEY", options.sdkKey);
    assert.equal(10, options.requestTimeoutMs);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v6.json?sdk=common/m-1.0.0", options.getUrl());
    assert.equal("http://fake-proxy.com:8080", options.proxy);
  });

  it("ManualPollOptions initialization With 'baseUrl' Should create an instance with custom baseUrl", () => {

    const options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", { baseUrl: "https://mycdn.example.org" }, null);

    assert.isDefined(options);
    assert.equal("https://mycdn.example.org/configuration-files/APIKEY/config_v6.json?sdk=common/m-1.0.0", options.getUrl());
    assert.notEqual("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v6.json?sdk=common/m-1.0.0", options.getUrl());
  });

  it("AutoPollOptions initialization With -1 requestTimeoutMs ShouldThrowError", () => {
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { requestTimeoutMs: -1 }, null);
    }).to.throw("Invalid 'requestTimeoutMs' value");
  });

  it("AutoPollOptions initialization With 'sdkKey' Should create an instance, defaults OK", () => {
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", null, null);
    assert.isDefined(options);
    assert.isTrue(options.logger instanceof LoggerWrapper);
    assert.isTrue(options.logger["logger"] instanceof ConfigCatConsoleLogger);
    assert.equal("APIKEY", options.sdkKey);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v6.json?sdk=common/a-1.0.0", options.getUrl());
    assert.equal(60, options.pollIntervalSeconds);
    assert.equal(30000, options.requestTimeoutMs);
    assert.isDefined(options.cache);
  });

  it("AutoPollOptions initialization With parameters works", () => {
    const fakeLogger: FakeLogger = new FakeLogger();

    const options: AutoPollOptions = new AutoPollOptions(
      "APIKEY", "common", "1.0.0",
      {
        logger: fakeLogger,
        pollIntervalSeconds: 59,
        requestTimeoutMs: 20,
        proxy: "http://fake-proxy.com:8080"
      },
      null);

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger["logger"]);
    assert.equal("APIKEY", options.sdkKey);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v6.json?sdk=common/a-1.0.0", options.getUrl());
    assert.equal(59, options.pollIntervalSeconds);
    assert.equal(20, options.requestTimeoutMs);
    assert.equal("http://fake-proxy.com:8080", options.proxy);
  });

  it("AutoPollOptions initialization With -1 'pollIntervalSeconds' ShouldThrowError", () => {
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: -1 }, null);
    }).to.throw("Invalid 'pollIntervalSeconds' value");
  });

  it("AutoPollOptions initialization With NaN 'pollIntervalSeconds' ShouldThrowError", () => {
    const myConfig = new Map();
    myConfig.set("pollIntervalSeconds", NaN);
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: myConfig.get("pollIntervalSeconds") }, null);
    }).to.throw("Invalid 'pollIntervalSeconds' value");
  });

  it("AutoPollOptions initialization With boolean value 'pollIntervalSeconds' ShouldThrowError", () => {
    const myConfig = new Map();
    myConfig.set("pollIntervalSeconds", true);
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: myConfig.get("pollIntervalSeconds") }, null);
    }).to.throw("Invalid 'pollIntervalSeconds' value");
  });

  it("AutoPollOptions initialization With whitespaces value 'pollIntervalSeconds' ShouldThrowError", () => {
    const myConfig = new Map();
    myConfig.set("pollIntervalSeconds", " ");
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: myConfig.get("pollIntervalSeconds") }, null);
    }).to.throw("Invalid 'pollIntervalSeconds' value");
  });

  it("AutoPollOptions initialization With new line value 'pollIntervalSeconds' ShouldThrowError", () => {
    const myConfig = new Map();
    myConfig.set("pollIntervalSeconds", "\n");
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: myConfig.get("pollIntervalSeconds") }, null);
    }).to.throw("Invalid 'pollIntervalSeconds' value");
  });

  it("AutoPollOptions initialization With 0 'pollIntervalSeconds' ShouldThrowError", () => {
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: -1 }, null);
    }).to.throw("Invalid 'pollIntervalSeconds' value");
  });

  it("AutoPollOptions initialization With NULL 'defaultCache' Should set to InMemoryCache", () => {

    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", null, null);

    assert.isNotNull(options.cache);
    assert.instanceOf(options.cache, InMemoryConfigCache);
  });

  it("AutoPollOptions initialization With 'baseUrl' Should create an instance with custom baseUrl", () => {

    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { baseUrl: "https://mycdn.example.org" }, null);

    assert.isDefined(options);
    assert.equal("https://mycdn.example.org/configuration-files/APIKEY/config_v6.json?sdk=common/a-1.0.0", options.getUrl());
    assert.notEqual("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v6.json?sdk=common/a-1.0.0", options.getUrl());
  });

  it("AutoPollOptions initialization With NaN 'maxInitWaitTimeSeconds' ShouldThrowError", () => {
    const myConfig = new Map();
    myConfig.set("maxInitWaitTimeSeconds", NaN);
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: myConfig.get("maxInitWaitTimeSeconds") }, null);
    }).to.throw("Invalid 'maxInitWaitTimeSeconds' value");
  });

  it("AutoPollOptions initialization With boolean value 'maxInitWaitTimeSeconds' ShouldThrowError", () => {
    const myConfig = new Map();
    myConfig.set("maxInitWaitTimeSeconds", true);
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: myConfig.get("maxInitWaitTimeSeconds") }, null);
    }).to.throw("Invalid 'maxInitWaitTimeSeconds' value");
  });

  it("AutoPollOptions initialization With whitespaces value 'maxInitWaitTimeSeconds' ShouldThrowError", () => {
    const myConfig = new Map();
    myConfig.set("maxInitWaitTimeSeconds", " ");
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: myConfig.get("maxInitWaitTimeSeconds") }, null);
    }).to.throw("Invalid 'maxInitWaitTimeSeconds' value");
  });

  it("AutoPollOptions initialization With new line value 'maxInitWaitTimeSeconds' ShouldThrowError", () => {
    const myConfig = new Map();
    myConfig.set("maxInitWaitTimeSeconds", "\n");
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: myConfig.get("maxInitWaitTimeSeconds") }, null);
    }).to.throw("Invalid 'maxInitWaitTimeSeconds' value");
  });

  it("AutoPollOptions initialization With 0 'maxInitWaitTimeSeconds' Should create an instance with passed value", () => {
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: 0 }, null);

    assert.isDefined(options);
    assert.isNotNull(options);
    assert.equal(options.maxInitWaitTimeSeconds, 0);
  });

  it("AutoPollOptions initialization Without 'maxInitWaitTimeSeconds' Should create an instance with default value(5)", () => {
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);

    assert.isDefined(options);
    assert.isNotNull(options);
    assert.equal(options.maxInitWaitTimeSeconds, 5);
  });

  it("LazyLoadOptions initialization With 'sdkKey' Should create an instance, defaults OK", () => {
    const options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", null, null);
    assert.isDefined(options);
    assert.equal("APIKEY", options.sdkKey);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v6.json?sdk=common/l-1.0.0", options.getUrl());
    assert.equal(60, options.cacheTimeToLiveSeconds);
    assert.equal(30000, options.requestTimeoutMs);
  });

  it("LazyLoadOptions initialization With parameters works", () => {
    const fakeLogger: FakeLogger = new FakeLogger();
    const options: LazyLoadOptions = new LazyLoadOptions(
      "APIKEY", "common", "1.0.0",
      {
        logger: fakeLogger,
        cacheTimeToLiveSeconds: 59,
        requestTimeoutMs: 20,
        proxy: "http://fake-proxy.com:8080"
      },
      null);

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger["logger"]);
    assert.equal("APIKEY", options.sdkKey);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v6.json?sdk=common/l-1.0.0", options.getUrl());
    assert.equal(59, options.cacheTimeToLiveSeconds);
    assert.equal(20, options.requestTimeoutMs);
    assert.equal("http://fake-proxy.com:8080", options.proxy);
  });

  it("LazyLoadOptions initialization With -1 'cacheTimeToLiveSeconds' ShouldThrowError", () => {
    expect(() => {
      new LazyLoadOptions("APIKEY", "common", "1.0.0", { cacheTimeToLiveSeconds: -1 }, null);
    }).to.throw("Invalid 'cacheTimeToLiveSeconds' value");
  });

  it("LazyLoadOptions initialization With -1 requestTimeoutMs ShouldThrowError", () => {
    expect(() => {
      new LazyLoadOptions("APIKEY", "common", "1.0.0", { requestTimeoutMs: -1 }, null);
    }).to.throw("Invalid 'requestTimeoutMs' value");
  });

  it("LazyLoadOptions initialization With NULL 'defaultCache' Should set to InMemoryCache", () => {
    const options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", {}, null);

    assert.isNotNull(options.cache);
    assert.instanceOf(options.cache, InMemoryConfigCache);
  });

  it("LazyLoadOptions initialization With 'baseUrl' Should create an instance with custom baseUrl", () => {

    const options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", { baseUrl: "https://mycdn.example.org" }, null);

    assert.isDefined(options);
    assert.equal("https://mycdn.example.org/configuration-files/APIKEY/config_v6.json?sdk=common/l-1.0.0", options.getUrl());
    assert.notEqual("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v6.json?sdk=common/l-1.0.0", options.getUrl());
  });

  it("Options initialization With 'defaultCache' Should set option cache to passed instance", () => {

    const options: OptionsBase = new FakeOptionsBase("APIKEY", "1.0", {}, () => new FakeCache());

    assert.instanceOf(options.cache, FakeCache);
    assert.notInstanceOf(options.cache, InMemoryConfigCache);
  });

  it("Options initialization With 'options.cache' Should overwrite defaultCache", () => {

    const options: OptionsBase = new FakeOptionsBase("APIKEY", "1.0", { cache: new FakeExternalCache() }, () => new InMemoryConfigCache());

    assert.instanceOf(options.cache, ExternalConfigCache);
    assert.notInstanceOf(options.cache, InMemoryConfigCache);
  });

  it("Options initialization With NULL 'cache' Should set InMemoryCache", () => {

    const options: OptionsBase = new FakeOptionsBase("APIKEY", "1.0", {}, null);

    assert.isDefined(options.cache);
    assert.instanceOf(options.cache, InMemoryConfigCache);
  });

  it("Options initialization With NULL 'options.cache' Should set InMemoryCache", () => {

    const options: OptionsBase = new FakeOptionsBase("APIKEY", "1.0", { cache: null }, null);

    assert.isDefined(options.cache);
    assert.instanceOf(options.cache, InMemoryConfigCache);
  });

  it("AutoPollOptions initialization - sdkVersion works", () => {
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    assert.equal("common/a-1.0.0", options.clientVersion);
  });

  it("LazyLoadOptions initialization - sdkVersion works", () => {
    const options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", {}, null);
    assert.equal("common/l-1.0.0", options.clientVersion);
  });

  it("ManualPollOptions initialization - sdkVersion works", () => {
    const options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", {}, null);
    assert.equal("common/m-1.0.0", options.clientVersion);
  });

  for (const [pollIntervalSecs, isValid] of [
    [-Infinity, false],
    [-1, false],
    [0, false],
    [0.999, false],
    [1, true],
    [2 ** 31 / 1000 - 1, true],
    [2 ** 31 / 1000, false],
    [Infinity, false],
    [NaN, false],
    ["1", false],
  ]) {
    it(`AutoPollOptions initialization - pollIntervalSeconds range validation works - ${pollIntervalSecs} (${typeof pollIntervalSecs})`, () => {
      const action = () => new AutoPollOptions("SDKKEY", "SDKTYPE", "SDKVERSION", {
        pollIntervalSeconds: pollIntervalSecs as unknown as number
      });

      if (isValid) {
        action();
      }
      else {
        let ex: any;
        try { action(); }
        catch (err) { ex = err; }
        assert.instanceOf(ex, Error);
      }
    });
  }

  for (const [maxInitWaitTimeSecs, isValid] of [
    [-Infinity, true],
    [-1, true],
    [2 ** 31 / 1000 - 1, true],
    [2 ** 31 / 1000, false],
    [Infinity, false],
    [NaN, false],
    ["1", false],
  ]) {
    it(`AutoPollOptions initialization - maxInitWaitTimeSeconds range validation works - ${maxInitWaitTimeSecs} (${typeof maxInitWaitTimeSecs})`, () => {
      const action = () => new AutoPollOptions("SDKKEY", "SDKTYPE", "SDKVERSION", {
        maxInitWaitTimeSeconds: maxInitWaitTimeSecs as unknown as number
      });

      if (isValid) {
        action();
      }
      else {
        let ex: any;
        try { action(); }
        catch (err) { ex = err; }
        assert.instanceOf(ex, Error);
      }
    });
  }

  for (const [cacheTimeToLiveSecs, isValid] of [
    [-Infinity, false],
    [-1, false],
    [0, false],
    [0.999, false],
    [1, true],
    [2 ** 31 - 1, true],
    [2 ** 31, false],
    [Infinity, false],
    [NaN, false],
    ["1", false],
  ]) {
    it(`LazyLoadOptions initialization - cacheTimeToLiveSeconds range validation works - ${cacheTimeToLiveSecs} (${typeof cacheTimeToLiveSecs})`, () => {
      const action = () => new LazyLoadOptions("SDKKEY", "SDKTYPE", "SDKVERSION", {
        cacheTimeToLiveSeconds: cacheTimeToLiveSecs as unknown as number
      });

      if (isValid) {
        action();
      }
      else {
        let ex: any;
        try { action(); }
        catch (err) { ex = err; }
        assert.instanceOf(ex, Error);
      }
    });
  }

  it("Dumping options should not leak internals or fail because of circular references", () => {
    const logger = new class implements IConfigCatLogger {
      circularRef?: IConfigCatLogger;
      log() { }
    }();
    logger.circularRef = logger;

    const defaultUser = new User("12345", "bob@example.com", void 0, {
      ["RegisteredAt"]: new Date("2025-01-01T00:00:00.000Z"),
      nicknames: ["Bobby", "Robbie"],
    });

    const options = new AutoPollOptions("APIKEY", "common", "1.0.0", {
      logger,
      pollIntervalSeconds: 5,
      requestTimeoutMs: 20,
      flagOverrides: createFlagOverridesFromMap({}, OverrideBehaviour.RemoteOverLocal),
      defaultUser
    }, null);

    const actualDumpedOptions = JSON.stringify(getSerializableOptions(options));
    const expectedDumpedOptions = '{"requestTimeoutMs":20,"baseUrlOverriden":false,"proxy":"","offline":false,"sdkKey":"APIKEY","clientVersion":"common/a-1.0.0","dataGovernance":0,"baseUrl":"https://cdn-global.configcat.com","hooks":"[object Object]","flagOverrides":{"dataSource":"[object Object]","behaviour":2},"defaultUser":{"Identifier":"12345","Email":"bob@example.com","RegisteredAt":"2025-01-01T00:00:00.000Z","nicknames":["Bobby","Robbie"]},"logger":"[object Object]","cache":"[object Object]","pollIntervalSeconds":5,"maxInitWaitTimeSeconds":5}';

    assert.deepEqual(JSON.parse(actualDumpedOptions), JSON.parse(expectedDumpedOptions));
  });
});

class FakeOptionsBase extends OptionsBase { }

class FakeCache implements IConfigCache {
  get localCachedConfig(): ProjectConfig { throw new Error("Property not implemented."); }

  set(key: string, config: ProjectConfig): void {
    throw new Error("Method not implemented.");
  }
  get(key: string): ProjectConfig {
    throw new Error("Method not implemented.");
  }
  getInMemory(): ProjectConfig {
    throw new Error("Method not implemented.");
  }
}

class FakeLogger implements IConfigCatLogger {
  level?: LogLevel | undefined;

  log(level: LogLevel, eventId: LogEventId, message: LogMessage, exception?: any): void {
    /* Intentionally empty. */
  }
}
