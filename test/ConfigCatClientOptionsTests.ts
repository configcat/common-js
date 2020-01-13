import { assert, expect } from "chai";
import "mocha";
import { ManualPollOptions, AutoPollOptions, LazyLoadOptions } from "../src/ConfigCatClientOptions";
import { IConfigCatLogger } from "../src";
import { ConfigCatConsoleLogger } from "../src/ConfigCatLogger";

describe("Options", () => {

  it("ManualPollOptions initialization With NULL 'apiKey' ShouldThrowError", () => {
    expect(() => {
      let options: ManualPollOptions = new ManualPollOptions(null, null);
    }).to.throw("Invalid 'apiKey' value");
  });

  it("ManualPollOptions initialization With -1 requestTimeoutMs ShouldThrowError", () => {
    expect(() => {
      let options: ManualPollOptions = new ManualPollOptions("APIKEY", {requestTimeoutMs: -1});
    }).to.throw("Invalid 'requestTimeoutMs' value");
  });

  it("ManualPollOptions initialization With 'apiKey' Should create an instance, defaults OK", () => {
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", null);
    assert.isDefined(options);

    assert.equal("APIKEY", options.apiKey);
    assert.equal(30000, options.requestTimeoutMs);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v3.json", options.getUrl());
    assert.equal("m", options.clientVersion[0]);
  });

  it("ManualPollOptions initialization With parameters works", () => {
    let fakeLogger: FakeLogger = new FakeLogger();

    let options: ManualPollOptions = new ManualPollOptions(
      "APIKEY",
      {
        logger: fakeLogger,
        requestTimeoutMs: 10,
        proxy: "http://fake-proxy.com:8080"
      });

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal(10, options.requestTimeoutMs);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v3.json", options.getUrl());
    assert.equal("m", options.clientVersion[0]);
    assert.equal("http://fake-proxy.com:8080", options.proxy);
  });

  it("ManualPollOptions initialization With 'baseUrl' Should create an instance with custom baseUrl", () => {

    let options: ManualPollOptions = new ManualPollOptions("APIKEY", { baseUrl: "https://mycdn.example.org"});

    assert.isDefined(options);
    assert.equal("https://mycdn.example.org/configuration-files/APIKEY/config_v3.json", options.getUrl());
    assert.notEqual("https://cdn.configcat.com/configuration-files/APIKEY/config_v3.json", options.getUrl());
  });

  it("AutoPollOptions initialization With NULL 'apiKey' ShouldThrowError", () => {
    expect(() => {
      let options: AutoPollOptions = new AutoPollOptions(null, null);
    }).to.throw("Invalid 'apiKey' value");
  });

  it("AutoPollOptions initialization With -1 requestTimeoutMs ShouldThrowError", () => {
    expect(() => {
      let options: AutoPollOptions = new AutoPollOptions("APIKEY", {requestTimeoutMs: -1});
    }).to.throw("Invalid 'requestTimeoutMs' value");
  });

  it("AutoPollOptions initialization With 'apiKey' Should create an instance, defaults OK", () => {
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", null);
    assert.isDefined(options);
    assert.isTrue(options.logger instanceof ConfigCatConsoleLogger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v3.json", options.getUrl());
    assert.equal(60, options.pollIntervalSeconds);
    assert.equal("a", options.clientVersion[0]);
    assert.equal(30000, options.requestTimeoutMs);
  });

  it("AutoPollOptions initialization With parameters works", () => {
    let fakeLogger: FakeLogger = new FakeLogger();

    let configChanged = function() { };
    let options: AutoPollOptions = new AutoPollOptions(
      "APIKEY",
            {logger: fakeLogger,
            configChanged: configChanged,
            pollIntervalSeconds: 59,
            requestTimeoutMs: 20,
            proxy: "http://fake-proxy.com:8080"});

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v3.json", options.getUrl());
    assert.equal(59, options.pollIntervalSeconds);
    assert.equal(20, options.requestTimeoutMs);
    assert.equal(configChanged, options.configChanged);
    assert.equal("a", options.clientVersion[0]);
    assert.equal("http://fake-proxy.com:8080", options.proxy);
  });

  it("AutoPollOptions initialization With -1 'pollIntervalSeconds' ShouldThrowError", () => {
    expect(() => {
      let options: AutoPollOptions = new AutoPollOptions("APIKEY", {pollIntervalSeconds: -1});
    }).to.throw("Invalid 'pollIntervalSeconds' value");
  });

  it("AutoPollOptions initialization With 'baseUrl' Should create an instance with custom baseUrl", () => {

    let options: AutoPollOptions = new AutoPollOptions("APIKEY", { baseUrl: "https://mycdn.example.org"});

    assert.isDefined(options);
    assert.equal("https://mycdn.example.org/configuration-files/APIKEY/config_v3.json", options.getUrl());
    assert.notEqual("https://cdn.configcat.com/configuration-files/APIKEY/config_v3.json", options.getUrl());
  });

  it("LazyLoadOptions initialization With NULL 'apiKey' ShouldThrowError", () => {
    expect(() => {
      let options: LazyLoadOptions = new LazyLoadOptions(null, null);
    }).to.throw("Invalid 'apiKey' value");
  });

  it("LazyLoadOptions initialization With 'apiKey' Should create an instance, defaults OK", () => {
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", null);
    assert.isDefined(options);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v3.json", options.getUrl());
    assert.equal(60, options.cacheTimeToLiveSeconds);
    assert.equal("l", options.clientVersion[0]);
    assert.equal(30000, options.requestTimeoutMs);
  });

  it("LazyLoadOptions initialization With parameters works", () => {
    let fakeLogger: FakeLogger = new FakeLogger();
    let options: LazyLoadOptions = new LazyLoadOptions(
      "APIKEY",
      {
        logger: fakeLogger,
        cacheTimeToLiveSeconds:59,
        requestTimeoutMs: 20,
        proxy: "http://fake-proxy.com:8080"
      });

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v3.json", options.getUrl());
    assert.equal(59, options.cacheTimeToLiveSeconds);
    assert.equal("l", options.clientVersion[0]);
    assert.equal(20, options.requestTimeoutMs);
    assert.equal("http://fake-proxy.com:8080", options.proxy);
  });

  it("LazyLoadOptions initialization With -1 'cacheTimeToLiveSeconds' ShouldThrowError", () => {
    expect(() => {
      let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", {cacheTimeToLiveSeconds: -1});
    }).to.throw("Invalid 'cacheTimeToLiveSeconds' value");
  });

  it("LazyLoadOptions initialization With -1 requestTimeoutMs ShouldThrowError", () => {
    expect(() => {
      let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", {requestTimeoutMs: -1});
    }).to.throw("Invalid 'requestTimeoutMs' value");
  });

  it("LazyLoadOptions initialization With 'baseUrl' Should create an instance with custom baseUrl", () => {

    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", { baseUrl: "https://mycdn.example.org"});

    assert.isDefined(options);
    assert.equal("https://mycdn.example.org/configuration-files/APIKEY/config_v3.json", options.getUrl());
    assert.notEqual("https://cdn.configcat.com/configuration-files/APIKEY/config_v3.json", options.getUrl());
  });
});

export class FakeLogger implements IConfigCatLogger {

  // tslint:disable-next-line:no-empty
  info(message: string): void {    
  }
  // tslint:disable-next-line:no-empty
  warn(message: string): void {    
  }
  isLogLevelEnabled(logLevel: import("../src").LogLevel): boolean {
    return false;
  }
  // tslint:disable-next-line:no-empty
  log(message: string): void {
  }

  // tslint:disable-next-line:no-empty
  error(message: string): void {
  }
}
