import { ConfigCatClient, IConfigCatClient } from "../src/ConfigCatClient";
import { assert, expect } from "chai";
import "mocha";
import { IConfigFetcher, IConfigCatKernel, ICache } from "../src/.";
import { ProjectConfig } from "../src/ProjectConfigService";
import { ManualPollOptions } from "../src/ConfigCatClientOptions";

describe("Options", () => {

  it("Initialization With NULL 'logger' ShouldThrowError", () => {

    expect(() => {
      let options: ManualPollOptions = new ManualPollOptions("APIKEY", {logger: null});
      let client: IConfigCatClient = new ConfigCatClient(options, new FakeConfigCatKernel());
    }).to.throw("Invalid 'logger' instance");
  });

  it("Initialization With NULL 'apiKey' ShouldThrowError", () => {

    expect(() => {
      let options: ManualPollOptions = new ManualPollOptions(null, null)
      let client: IConfigCatClient = new ConfigCatClient(options, new FakeConfigCatKernel());
    }).to.throw("Invalid 'apiKey' value");
  });

  it("Initialization With NULL 'configuration' Should crea(e an ins,ance", () => {

    let client: IConfigCatClient = new ConfigCatClient(null, new FakeConfigCatKernel());

    assert.isDefined(client);
  });

  it("Initialization With 'LazyLoadConfiguration' Should create an instance", () => {

    let client: IConfigCatClient = new ConfigCatClient("APIKEY", new FakeConfigFetcher(), new LazyLoadOptions());

    assert.isDefined(client);
  });

  it("Initialization With 'ManualPollConfiguration' Should create an instance", () => {

    let client: IConfigCatClient = new ConfigCatClient(, new FakeConfigCatKernel());

    assert.isDefined(client);
  });

  it("Initialization With 'LazyLoadConfiguration' Should create an instance", () => {

    let client: IConfigCatClient = new ConfigCatClient("APIKEY", new FakeConfigFetcher(), new LazyLoadConfiguration());

    assert.isDefined(client);
  });

  it("Initialization With 'AutoPollConfiguration' Should create an instance", () => {

    let client: IConfigCatClient = new ConfigCatClient("APIKEY", new FakeConfigFetcher(), new AutoPollConfiguration());

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
