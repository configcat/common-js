import { assert } from "chai";
import { IConfigCatClient } from "../src";
import { AutoPollOptions } from "../src/ConfigCatClientOptions";
import { FakeConfigCatKernel, FakeConfigFetcherBase } from "./ConfigCatClientTests";
import { ConfigCatClient } from "../src/ConfigCatClient";
import "mocha";
import { MapOverrideDataSource, OverrideBehaviour } from "../src/FlagOverrides";

describe("Local Overrides", () => {
    it("Values from map - LocalOnly", async () => {
        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }") };
        let options: AutoPollOptions = new AutoPollOptions("localhost", {
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
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        assert.equal(await client.getValueAsync("enabledFeature", false), true);
        assert.equal(await client.getValueAsync("disabledFeature", true), false);
        assert.equal(await client.getValueAsync("intSetting", 0), 5);
        assert.equal(await client.getValueAsync("doubleSetting", 0), 3.14);
        assert.equal(await client.getValueAsync("stringSetting", ""), "test");
    });

    it("Values from map - LocalOverRemote", async () => {
        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }") };
        let options: AutoPollOptions = new AutoPollOptions("localhost", {
            flagOverrides: { 
                dataSource: new MapOverrideDataSource({
                    fakeKey: true,
                    nonexisting: true
                }), 
                behaviour: OverrideBehaviour.LocalOverRemote
            }
        }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        assert.equal(await client.getValueAsync("fakeKey", false), true);
        assert.equal(await client.getValueAsync("nonexisting", false), true);
    });

    it("Values from map - RemoteOverLocal", async () => {
        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }") };
        let options: AutoPollOptions = new AutoPollOptions("localhost", {
            flagOverrides: { 
                dataSource: new MapOverrideDataSource({
                    fakeKey: true,
                    nonexisting: true
                }), 
                behaviour: OverrideBehaviour.RemoteOverLocal
            }
        }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        assert.equal(await client.getValueAsync("fakeKey", false), false);
        assert.equal(await client.getValueAsync("nonexisting", false), true);
    });

    it("Values from map - another map style", async () => {
        let dataSource: { [name: string]: any } = {}
        dataSource["enabled-feature"] = true;
        dataSource["disabled_feature"] = false;
        dataSource["int-setting"] = 5;
        dataSource["double_setting"] = 3.14;
        dataSource["string-setting"] = "test";
        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }") };
        let options: AutoPollOptions = new AutoPollOptions("localhost", {
            flagOverrides: { 
                dataSource: new MapOverrideDataSource(dataSource),
                behaviour: OverrideBehaviour.RemoteOverLocal
            }
        }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        assert.equal(await client.getValueAsync("enabled-feature", false), true);
        assert.equal(await client.getValueAsync("disabled_feature", true), false);
        assert.equal(await client.getValueAsync("int-setting", 0), 5);
        assert.equal(await client.getValueAsync("double_setting", 0), 3.14);
        assert.equal(await client.getValueAsync("string-setting", ""), "test");
    });
  });