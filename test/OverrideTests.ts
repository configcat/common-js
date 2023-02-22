import { assert, expect } from "chai";
import "mocha";
import type { IConfigCatClient } from "../src/ConfigCatClient";
import { ConfigCatClient } from "../src/ConfigCatClient";
import { AutoPollOptions, ManualPollOptions } from "../src/ConfigCatClientOptions";
import { MapOverrideDataSource, OverrideBehaviour } from "../src/FlagOverrides";
import type { FakeConfigCatKernel } from "./helpers/fakes";
import { FakeConfigFetcherBase } from "./helpers/fakes";

describe("Local Overrides", () => {
  it("Values from map - LocalOnly", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }"),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("localhost", "common", "1.0.0", {
      flagOverrides: {
        dataSource: new MapOverrideDataSource({
          enabledFeature: true,
          disabledFeature: false,
          intSetting: 5,
          doubleSetting: 3.14,
          stringSetting: "test"
        }),
        behaviour: OverrideBehaviour.LocalOnly
      }
    }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    assert.equal(await client.getValueAsync("enabledFeature", false), true);
    assert.equal(await client.getValueAsync("disabledFeature", true), false);
    assert.equal(await client.getValueAsync("intSetting", 0), 5);
    assert.equal(await client.getValueAsync("doubleSetting", 0), 3.14);
    assert.equal(await client.getValueAsync("stringSetting", ""), "test");
  });

  it("Values from map - LocalOverRemote", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }"),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("localhost", "common", "1.0.0", {
      flagOverrides: {
        dataSource: new MapOverrideDataSource({
          fakeKey: true,
          nonexisting: true
        }),
        behaviour: OverrideBehaviour.LocalOverRemote
      }
    }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    assert.equal(await client.getValueAsync("fakeKey", false), true);
    assert.equal(await client.getValueAsync("nonexisting", false), true);
  });

  it("Values from map - RemoteOverLocal", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }"),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("localhost", "common", "1.0.0", {
      flagOverrides: {
        dataSource: new MapOverrideDataSource({
          fakeKey: true,
          nonexisting: true
        }),
        behaviour: OverrideBehaviour.RemoteOverLocal
      }
    }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    assert.equal(await client.getValueAsync("fakeKey", true), false);
    assert.equal(await client.getValueAsync("nonexisting", false), true);
  });

  it("Values from map - RemoteOverLocal - failing remote", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase(null),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("localhost", "common", "1.0.0", {
      flagOverrides: {
        dataSource: new MapOverrideDataSource({
          fakeKey: true,
          nonexisting: true
        }),
        behaviour: OverrideBehaviour.RemoteOverLocal
      },
      maxInitWaitTimeSeconds: 1
    }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    assert.equal(await client.getValueAsync("fakeKey", false), true);
    assert.equal(await client.getValueAsync("nonexisting", false), true);
  });

  it("Values from map - another map style", async () => {
    const dataSource: { [name: string]: any } = {};
    dataSource["enabled-feature"] = true;
    dataSource["disabled_feature"] = false;
    dataSource["int-setting"] = 5;
    dataSource["double_setting"] = 3.14;
    dataSource["string-setting"] = "test";
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }"),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("localhost", "common", "1.0.0", {
      flagOverrides: {
        dataSource: new MapOverrideDataSource(dataSource),
        behaviour: OverrideBehaviour.RemoteOverLocal
      }
    }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    assert.equal(await client.getValueAsync("enabled-feature", false), true);
    assert.equal(await client.getValueAsync("disabled_feature", true), false);
    assert.equal(await client.getValueAsync("int-setting", 0), 5);
    assert.equal(await client.getValueAsync("double_setting", 0), 3.14);
    assert.equal(await client.getValueAsync("string-setting", ""), "test");
    assert.equal(await client.getValueAsync("fakeKey", true), false);
  });

  it("LocalOnly - forceRefresh() should return failure", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }"),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: ManualPollOptions = new ManualPollOptions("localhost", "common", "1.0.0", {
      flagOverrides: {
        dataSource: new MapOverrideDataSource({
          "fakeKey": true,
          "nonexisting": true,
        }),
        behaviour: OverrideBehaviour.LocalOnly
      }
    }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const refreshResult = await client.forceRefreshAsync();

    assert.isTrue(await client.getValueAsync("fakeKey", false));
    assert.isTrue(await client.getValueAsync("nonexisting", false));

    assert.isFalse(refreshResult.isSuccess);
    expect(refreshResult.errorMessage).to.contain("LocalOnly");
    assert.isUndefined(refreshResult.errorException);
  });
});
