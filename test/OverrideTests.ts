import { assert, expect } from "chai";
import "mocha";
import { SettingKeyValue } from "../src";
import { ConfigCatClient, IConfigCatClient, IConfigCatKernel } from "../src/ConfigCatClient";
import { AutoPollOptions, ManualPollOptions } from "../src/ConfigCatClientOptions";
import { MapOverrideDataSource, OverrideBehaviour } from "../src/FlagOverrides";
import { SettingValue } from "../src/ProjectConfig";
import { isAllowedValue } from "../src/RolloutEvaluator";
import { FakeConfigCatKernel, FakeConfigFetcherBase, FakeConfigFetcherWithNullNewConfig } from "./helpers/fakes";

describe("Local Overrides", () => {
  it("Values from map - LocalOnly", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }"),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };

    const overrideMap = {
      enabledFeature: true,
      disabledFeature: false,
      intSetting: 5,
      doubleSetting: 3.14,
      stringSetting: "test"
    };

    const options: AutoPollOptions = new AutoPollOptions("localhost", "common", "1.0.0", {
      flagOverrides: {
        dataSource: new MapOverrideDataSource(overrideMap),
        behaviour: OverrideBehaviour.LocalOnly
      }
    }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    assert.equal(await client.getValueAsync("enabledFeature", null), true);
    assert.equal(await client.getValueAsync("disabledFeature", null), false);
    assert.equal(await client.getValueAsync("intSetting", null), 5);
    assert.equal(await client.getValueAsync("doubleSetting", null), 3.14);
    assert.equal(await client.getValueAsync("stringSetting", null), "test");

    overrideMap.disabledFeature = true;
    overrideMap.intSetting = -5;

    assert.equal(await client.getValueAsync("enabledFeature", null), true);
    assert.equal(await client.getValueAsync("disabledFeature", null), false);
    assert.equal(await client.getValueAsync("intSetting", null), 5);
    assert.equal(await client.getValueAsync("doubleSetting", null), 3.14);
    assert.equal(await client.getValueAsync("stringSetting", null), "test");
  });

  it("Values from map - LocalOnly - watch changes - async", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }"),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };

    const overrideMap = {
      enabledFeature: true,
      disabledFeature: false,
      intSetting: 5,
      doubleSetting: 3.14,
      stringSetting: "test"
    };

    const options: AutoPollOptions = new AutoPollOptions("localhost", "common", "1.0.0", {
      flagOverrides: {
        dataSource: new MapOverrideDataSource(overrideMap, true),
        behaviour: OverrideBehaviour.LocalOnly
      }
    }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    assert.equal(await client.getValueAsync("enabledFeature", null), true);
    assert.equal(await client.getValueAsync("disabledFeature", null), false);
    assert.equal(await client.getValueAsync("intSetting", null), 5);
    assert.equal(await client.getValueAsync("doubleSetting", null), 3.14);
    assert.equal(await client.getValueAsync("stringSetting", null), "test");

    overrideMap.disabledFeature = true;
    overrideMap.intSetting = -5;

    assert.equal(await client.getValueAsync("enabledFeature", null), true);
    assert.equal(await client.getValueAsync("disabledFeature", null), true);
    assert.equal(await client.getValueAsync("intSetting", null), -5);
    assert.equal(await client.getValueAsync("doubleSetting", null), 3.14);
    assert.equal(await client.getValueAsync("stringSetting", null), "test");
  });

  it("Values from map - LocalOnly - watch changes - sync", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase("{\"f\": { \"fakeKey\": { \"v\": false, \"p\": [], \"r\": [] } } }"),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };

    const overrideMap = {
      enabledFeature: true,
      disabledFeature: false,
      intSetting: 5,
      doubleSetting: 3.14,
      stringSetting: "test"
    };

    const options: AutoPollOptions = new AutoPollOptions("localhost", "common", "1.0.0", {
      flagOverrides: {
        dataSource: new MapOverrideDataSource(overrideMap, true),
        behaviour: OverrideBehaviour.LocalOnly
      }
    }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    let snapshot = client.snapshot();
    assert.equal(await snapshot.getValue("enabledFeature", null), true);
    assert.equal(await snapshot.getValue("disabledFeature", null), false);
    assert.equal(await snapshot.getValue("intSetting", null), 5);
    assert.equal(await snapshot.getValue("doubleSetting", null), 3.14);
    assert.equal(await snapshot.getValue("stringSetting", null), "test");

    overrideMap.disabledFeature = true;
    overrideMap.intSetting = -5;

    snapshot = client.snapshot();
    assert.equal(await snapshot.getValue("enabledFeature", null), true);
    assert.equal(await snapshot.getValue("disabledFeature", null), true);
    assert.equal(await snapshot.getValue("intSetting", null), -5);
    assert.equal(await snapshot.getValue("doubleSetting", null), 3.14);
    assert.equal(await snapshot.getValue("stringSetting", null), "test");
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
      configFetcher: new FakeConfigFetcherBase('{"f":{"fakeKey":{"t":0,"v":{"b":false}}}}'),
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
      configFetcher: new FakeConfigFetcherBase('{"f":{"fakeKey":{"t":0,"v":{"b":false}}}}'),
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

  for (const [overrideValue, defaultValue, expectedEvaluatedValue] of [
    [true, false, true],
    [true, "", ""],
    [true, 0, 0],
    ["text", false, false],
    ["text", "", "text"],
    ["text", 0, 0],
    [42, false, false],
    [42, "", ""],
    [42, 0, 42],
    [3.14, false, false],
    [3.14, "", ""],
    [3.14, 0, 3.14],
    [null, false, false],
    [void 0, false, false],
    [{}, false, false],
    [[], false, false],
    [function() { }, false, false],
  ]) {
    it(`Override value type mismatch should be handled correctly (${overrideValue}, ${defaultValue})`, async () => {
      const key = "flag";

      const map = { [key]: overrideValue as NonNullable<SettingValue> };

      const configCatKernel: IConfigCatKernel = {
        configFetcher: new FakeConfigFetcherWithNullNewConfig(),
        sdkType: "common",
        sdkVersion: "1.0.0"
      };

      const options: ManualPollOptions = new ManualPollOptions("localhost", configCatKernel.sdkType, configCatKernel.sdkVersion, {
        flagOverrides: {
          dataSource: new MapOverrideDataSource(map),
          behaviour: OverrideBehaviour.LocalOnly
        }
      }, null);

      const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

      const actualEvaluatedValue = await client.getValueAsync(key, defaultValue as SettingValue);
      const actualEvaluatedValues = await client.getAllValuesAsync();

      assert.strictEqual(expectedEvaluatedValue, actualEvaluatedValue);

      const expectedEvaluatedValues: SettingKeyValue[] = [{
        settingKey: key,
        settingValue: isAllowedValue(overrideValue) ? overrideValue : null
      }];
      assert.deepEqual(expectedEvaluatedValues, actualEvaluatedValues);
    });
  }
});
