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

  it("ManualPollOptions initialization With 'apiKey' Should create an instance, defaults OK", () => {
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", null);
    assert.isDefined(options);

    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v2.json", options.getUrl());
    assert.equal("m", options.clientVersion[0]);
  });

  it("ManualPollOptions initialization With parameters works", () => {
    let fakeLogger = new FakeLogger();
    let configChanged = function(){ };
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", {logger: fakeLogger});

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v2.json", options.getUrl());
    assert.equal("m", options.clientVersion[0]);
  });

  it("AutoPollOptions initialization With NULL 'apiKey' ShouldThrowError", () => {
    expect(() => {
      let options: AutoPollOptions = new AutoPollOptions(null, null);
    }).to.throw("Invalid 'apiKey' value");
  });

  it("AutoPollOptions initialization With 'apiKey' Should create an instance, defaults OK", () => {
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", null);
    assert.isDefined(options);
    assert.isTrue(options.logger instanceof ConfigCatConsoleLogger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v2.json", options.getUrl());
    assert.equal(60, options.pollIntervalSeconds);
    assert.equal(5, options.maxInitWaitTimeSeconds);
    assert.equal("a", options.clientVersion[0]);
  });

  it("AutoPollOptions initialization With parameters works", () => {
    let fakeLogger = new FakeLogger();
    let configChanged = function(){ };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", {logger: fakeLogger, configChanged: configChanged, maxInitWaitTimeSeconds: 4, pollIntervalSeconds: 59});

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v2.json", options.getUrl());
    assert.equal(59, options.pollIntervalSeconds);
    assert.equal(4, options.maxInitWaitTimeSeconds);
    assert.equal(configChanged, options.configChanged);
    assert.equal("a", options.clientVersion[0]);
  });

  it("AutoPollOptions initialization With -1 'maxInitWaitTimeSeconds' ShouldThrowError", () => {
    expect(() => {
      let options: AutoPollOptions = new AutoPollOptions("APIKEY", {maxInitWaitTimeSeconds: -1});
    }).to.throw("Invalid 'maxInitWaitTimeSeconds' value");
  });

  it("AutoPollOptions initialization With -1 'pollIntervalSeconds' ShouldThrowError", () => {
    expect(() => {
      let options: AutoPollOptions = new AutoPollOptions("APIKEY", {pollIntervalSeconds: -1});
    }).to.throw("Invalid 'pollIntervalSeconds' value");
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
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v2.json", options.getUrl());
    assert.equal(60, options.cacheTimeToLiveSeconds);
    assert.equal("l", options.clientVersion[0]);
  });

  it("LazyLoadOptions initialization With parameters works", () => {
    let fakeLogger = new FakeLogger();
    let configChanged = function(){ };
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", {logger: fakeLogger, cacheTimeToLiveSeconds:59});

    assert.isDefined(options);
    assert.equal(fakeLogger, options.logger);
    assert.equal("APIKEY", options.apiKey);
    assert.equal("https://cdn.configcat.com/configuration-files/APIKEY/config_v2.json", options.getUrl());
    assert.equal(59, options.cacheTimeToLiveSeconds);
    assert.equal("l", options.clientVersion[0]);
  });

  it("LazyLoadOptions initialization With -1 'cacheTimeToLiveSeconds' ShouldThrowError", () => {
    expect(() => {
      let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", {cacheTimeToLiveSeconds: -1});
    }).to.throw("Invalid 'cacheTimeToLiveSeconds' value");
  });
});

export class FakeLogger implements IConfigCatLogger {
  log(message: string): void {
  }
  
  error(message: string): void {
  }
}