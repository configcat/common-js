import { assert, expect } from "chai";
import "mocha";
import { ManualPollOptions, AutoPollOptions, LazyLoadOptions } from "../src/ConfigCatClientOptions";
import { ICache, IConfigCatLogger, LogLevel, OptionsBase, ProjectConfig } from "../src";
import { ConfigCatConsoleLogger } from "../src/ConfigCatLogger";
import { InMemoryCache } from "../src/Cache";

describe("Options", () => {

  it("ManualPollOptions initialization With -1 requestTimeoutMs ShouldThrowError", () => {
    expect(() => {
      new ManualPollOptions("APIKEY", "common", "1.0.0", { requestTimeoutMs: -1 }, null);
    }).to.throw("Invalid 'requestTimeoutMs' value");
  });

  it("ManualPollOptions initialization With NULL 'defaultCache' Should init with InMemoryCache", () => {
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", null, null);

    assert.isNotNull(options.cache);
    assert.instanceOf(options.cache, InMemoryCache)
  });

  it("ManualPollOptions initialization With 'apiKey' Should create an instance, defaults OK", () => {
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", null, null);
    assert.isDefined(options);

    assert.equal("APIKEY", options.apiKey);
    assert.equal(30000, options.requestTimeoutMs);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v5.json", options.getUrl());
  });

  it("ManualPollOptions initialization With parameters works", () => {
    let fakeLogger: FakeLogger = new FakeLogger();

    let options: ManualPollOptions = new ManualPollOptions(
      "APIKEY", "common", "1.0.0",
      {
        logger: fakeLogger,
        requestTimeoutMs: 10,
        proxy: "http://fake-proxy.com:8080"
      },
      null);

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal(10, options.requestTimeoutMs);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v5.json", options.getUrl());
    assert.equal("http://fake-proxy.com:8080", options.proxy);
  });

  it("ManualPollOptions initialization With 'baseUrl' Should create an instance with custom baseUrl", () => {

    let options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", { baseUrl: "https://mycdn.example.org" }, null);

    assert.isDefined(options);
    assert.equal("https://mycdn.example.org/configuration-files/APIKEY/config_v5.json", options.getUrl());
    assert.notEqual("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v5.json", options.getUrl());
  });

  it("AutoPollOptions initialization With -1 requestTimeoutMs ShouldThrowError", () => {
    expect(() => {
      let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { requestTimeoutMs: -1 }, null);
    }).to.throw("Invalid 'requestTimeoutMs' value");
  });

  it("AutoPollOptions initialization With 'apiKey' Should create an instance, defaults OK", () => {
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", null, null);
    assert.isDefined(options);
    assert.isTrue(options.logger instanceof ConfigCatConsoleLogger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v5.json", options.getUrl());
    assert.equal(60, options.pollIntervalSeconds);
    assert.equal(30000, options.requestTimeoutMs);
    assert.isDefined(options.cache);
  });

  it("AutoPollOptions initialization With parameters works", () => {
    let fakeLogger: FakeLogger = new FakeLogger();

    let configChanged = function () { };
    let options: AutoPollOptions = new AutoPollOptions(
      "APIKEY", "common", "1.0.0",
      {
        logger: fakeLogger,
        configChanged: configChanged,
        pollIntervalSeconds: 59,
        requestTimeoutMs: 20,
        proxy: "http://fake-proxy.com:8080"
      },
      null);

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v5.json", options.getUrl());
    assert.equal(59, options.pollIntervalSeconds);
    assert.equal(20, options.requestTimeoutMs);
    assert.equal(configChanged, options.configChanged);
    assert.equal("http://fake-proxy.com:8080", options.proxy);
  });

  it("AutoPollOptions initialization With -1 'pollIntervalSeconds' ShouldThrowError", () => {
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: -1 }, null);
    }).to.throw("Invalid 'pollIntervalSeconds' value");
  });

  it("AutoPollOptions initialization With 0 'pollIntervalSeconds' ShouldThrowError", () => {
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: -1 }, null);
    }).to.throw("Invalid 'pollIntervalSeconds' value");
  });

  it("AutoPollOptions initialization With NULL 'defaultCache' Should set to InMemoryCache", () => {

    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", null, null);

    assert.isNotNull(options.cache);
    assert.instanceOf(options.cache, InMemoryCache);
  });

  it("AutoPollOptions initialization With 'baseUrl' Should create an instance with custom baseUrl", () => {

    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { baseUrl: "https://mycdn.example.org" }, null);

    assert.isDefined(options);
    assert.equal("https://mycdn.example.org/configuration-files/APIKEY/config_v5.json", options.getUrl());
    assert.notEqual("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v5.json", options.getUrl());
  });

  it("AutoPollOptions initialization With -1 'maxInitWaitTimeSeconds' ShouldThrowError", () => {
    expect(() => {
      new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: -1 }, null);
    }).to.throw("Invalid 'maxInitWaitTimeSeconds' value");
  });

  it("AutoPollOptions initialization With 0 'maxInitWaitTimeSeconds' Should create an instance with passed value", () => {
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: 0 }, null);

    assert.isDefined(options);
    assert.isNotNull(options);
    assert.equal(options.maxInitWaitTimeSeconds, 0);
  });

  it("AutoPollOptions initialization Without 'maxInitWaitTimeSeconds' Should create an instance with default value(5)", () => {
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);

    assert.isDefined(options);
    assert.isNotNull(options);
    assert.equal(options.maxInitWaitTimeSeconds, 5);
  });

  it("LazyLoadOptions initialization With 'apiKey' Should create an instance, defaults OK", () => {
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", null, null);
    assert.isDefined(options);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v5.json", options.getUrl());
    assert.equal(60, options.cacheTimeToLiveSeconds);
    assert.equal(30000, options.requestTimeoutMs);
  });

  it("LazyLoadOptions initialization With parameters works", () => {
    let fakeLogger: FakeLogger = new FakeLogger();
    let options: LazyLoadOptions = new LazyLoadOptions(
      "APIKEY", "common", "1.0.0",
      {
        logger: fakeLogger,
        cacheTimeToLiveSeconds: 59,
        requestTimeoutMs: 20,
        proxy: "http://fake-proxy.com:8080"
      },
      null);

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v5.json", options.getUrl());
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
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", {}, null);

    assert.isNotNull(options.cache);
    assert.instanceOf(options.cache, InMemoryCache);
  });

  it("LazyLoadOptions initialization With 'baseUrl' Should create an instance with custom baseUrl", () => {

    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", { baseUrl: "https://mycdn.example.org" }, null);

    assert.isDefined(options);
    assert.equal("https://mycdn.example.org/configuration-files/APIKEY/config_v5.json", options.getUrl());
    assert.notEqual("https://cdn-global.configcat.com/configuration-files/APIKEY/config_v5.json", options.getUrl());
  });

  it("Options initialization With 'defaultCache' Should set option cache to passed instance", () => {

    let options: OptionsBase = new FakeOptionsBase("APIKEY", "1.0", {}, new FakeCache());

    assert.instanceOf(options.cache, FakeCache);
    assert.notInstanceOf(options.cache, InMemoryCache);
  });

  it("Options initialization With 'options.cache' Should overwrite defaultCache", () => {

    let options: OptionsBase = new FakeOptionsBase("APIKEY", "1.0", { cache: new FakeCache() }, new InMemoryCache());

    assert.instanceOf(options.cache, FakeCache);
    assert.notInstanceOf(options.cache, InMemoryCache);
  });

  it("Options initialization With NULL 'cache' Should set InMemoryCache", () => {

    let options: OptionsBase = new FakeOptionsBase("APIKEY", "1.0", {}, null);

    assert.isDefined(options.cache);
    assert.instanceOf(options.cache, InMemoryCache);
  });

  it("Options initialization With NULL 'options.cache' Should set InMemoryCache", () => {

    let options: OptionsBase = new FakeOptionsBase("APIKEY", "1.0", { cache: null }, null);

    assert.isDefined(options.cache);
    assert.instanceOf(options.cache, InMemoryCache);
  });


  it("AutoPollOptions initialization - sdkVersion works", () => {
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    assert.equal("common/a-1.0.0", options.clientVersion);
  });

  it("LazyLoadOptions initialization - sdkVersion works", () => {
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", {}, null);
    assert.equal("common/l-1.0.0", options.clientVersion);
  });

  it("ManualPollOptions initialization - sdkVersion works", () => {
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", {}, null);
    assert.equal("common/m-1.0.0", options.clientVersion);
  });
});

class FakeOptionsBase extends OptionsBase { }

class FakeCache implements ICache {
  set(key: string, config: ProjectConfig): void {
    throw new Error("Method not implemented.");
  }
  get(key: string): ProjectConfig {
    throw new Error("Method not implemented.");
  }
}

export class FakeLogger implements IConfigCatLogger {


  // tslint:disable-next-line:no-empty
  debug(message: string): void {
  }
  // tslint:disable-next-line:no-empty
  info(message: string): void {
  }
  // tslint:disable-next-line:no-empty
  warn(message: string): void {
  }
  isLogLevelEnabled(logLevel: LogLevel): boolean {
    return false;
  }
  // tslint:disable-next-line:no-empty
  log(message: string): void {
  }

  // tslint:disable-next-line:no-empty
  error(message: string): void {
  }
}
