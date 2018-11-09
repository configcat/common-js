import { assert, expect } from "chai";
import "mocha";
import { ManualPollOptions, AutoPollOptions, LazyLoadOptions } from "../src/ConfigCatClientOptions";

describe("Options", () => {

  it("ManualPollOptions initialization With NULL 'apiKey' ShouldThrowError", () => {
    expect(() => {
      let options: ManualPollOptions = new ManualPollOptions(null, null);
    }).to.throw("Invalid 'apiKey' value");
  });

  it("ManualPollOptions initialization With 'apiKey' Should create an instance", () => {
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", null);
    assert.isDefined(options);
  });

  it("AutoPollOptions initialization With NULL 'apiKey' ShouldThrowError", () => {
    expect(() => {
      let options: AutoPollOptions = new AutoPollOptions(null, null);
    }).to.throw("Invalid 'apiKey' value");
  });

  it("AutoPollOptions initialization With 'apiKey' Should create an instance", () => {
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", null);
    assert.isDefined(options);
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

  it("LazyLoadOptions initialization With 'apiKey' Should create an instance", () => {
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", null);
    assert.isDefined(options);
  });

  it("LazyLoadOptions initialization With -1 'cacheTimeToLiveSeconds' ShouldThrowError", () => {
    expect(() => {
      let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", {cacheTimeToLiveSeconds: -1});
    }).to.throw("Invalid 'cacheTimeToLiveSeconds' value");
  });
});