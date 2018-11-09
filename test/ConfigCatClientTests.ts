import { ConfigCatClient, IConfigCatClient } from "../src/ConfigCatClient";
import { assert, expect } from "chai";
import "mocha";
import { IConfigFetcher, IConfigCatKernel, ICache } from "../src/.";
import { ProjectConfig } from "../src/ProjectConfigService";
import { ManualPollOptions, AutoPollOptions, LazyLoadOptions } from "../src/ConfigCatClientOptions";
import { InMemoryCache } from "../src/Cache";

describe("ConfigCatClient", () => {
  it("Initialization With NULL 'apiKey' ShouldThrowError", () => {

    expect(() => {
      let configCatKernel: FakeConfigCatKernel = {configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache()};
      let options: ManualPollOptions = new ManualPollOptions(null, null)
      let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    }).to.throw("Invalid 'apiKey' value");
  });

  it("Initialization With NULL 'configuration' ShouldThrowError", () => {

    expect(() => {
      let configCatKernel: FakeConfigCatKernel = {configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache()};
      let client: IConfigCatClient = new ConfigCatClient(null, configCatKernel);
    }).to.throw("Invalid 'options' value");
  });

  it("Initialization With NULL 'configCatKernel' ShouldThrowError", () => {

    expect(() => {
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", {logger: null})
    let client: IConfigCatClient = new ConfigCatClient(options, null);
    }).to.throw("Invalid 'configCatKernel' value");
  }); 
  
  it("Initialization With AutoPollOptions should create an istance", () => {
    let configCatKernel: FakeConfigCatKernel = {configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache()};
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", {logger: null})
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
  });

  it("Initialization With LazyLoadOptions should create an istance", () => {

    let configCatKernel: FakeConfigCatKernel = {configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache()};
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", {logger: null})
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
  });

  it("Initialization With ManualPollOptions should create an istance", () => {

    let configCatKernel: FakeConfigCatKernel = {configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache()};
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", {logger: null})
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
  });

});

export class FakeConfigFetcher implements IConfigFetcher {
  fetchLogic(lastProjectConfig: ProjectConfig, callback: (newProjectConfig: ProjectConfig) => void): void {
    if (callback) {
      callback(new ProjectConfig(0, "", ""));
    }
  }
}

export class FakeConfigCatKernel implements IConfigCatKernel {
  configFetcher: IConfigFetcher;
  cache: ICache;
}