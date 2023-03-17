import { assert, expect } from "chai";
import "mocha";
import { AutoPollConfigService } from "../src/AutoPollConfigService";
import { ICache } from "../src/Cache";
import { ConfigCatClient, IConfigCatClient, IConfigCatKernel } from "../src/ConfigCatClient";
import { AutoPollOptions, IAutoPollOptions, IManualPollOptions, LazyLoadOptions, ManualPollOptions, OptionsBase, PollingMode } from "../src/ConfigCatClientOptions";
import { LogLevel } from "../src/ConfigCatLogger";
import { IFetchResponse } from "../src/ConfigFetcher";
import { ConfigServiceBase, IConfigService, RefreshResult } from "../src/ConfigServiceBase";
import { IProvidesHooks } from "../src/Hooks";
import { LazyLoadConfigService } from "../src/LazyLoadConfigService";
import { isWeakRefAvailable, setupPolyfills } from "../src/Polyfills";
import { ProjectConfig, Setting } from "../src/ProjectConfig";
import { IEvaluationDetails, IRolloutEvaluator, User } from "../src/RolloutEvaluator";
import { delay } from "../src/Utils";
import "./helpers/ConfigCatClientCacheExtensions";
import { FakeCache, FakeConfigCatKernel, FakeConfigFetcher, FakeConfigFetcherBase, FakeConfigFetcherWithAlwaysVariableEtag, FakeConfigFetcherWithNullNewConfig, FakeConfigFetcherWithPercantageRules, FakeConfigFetcherWithRules, FakeConfigFetcherWithTwoCaseSensitiveKeys, FakeConfigFetcherWithTwoKeys, FakeConfigFetcherWithTwoKeysAndRules, FakeLogger } from "./helpers/fakes";
import { allowEventLoop } from "./helpers/utils";

describe("ConfigCatClient", () => {
  it("Initialization With AutoPollOptions should create an instance, getValue works", (done) => {
    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function(value) {
      assert.equal(true, value);

      client.getValue("debug", false, function(value) {
        assert.equal(true, value);

        client.forceRefresh(function() {
          client.getValue("debug", false, function(value) {
            assert.equal(true, value);

            client.getValue("debug", false, function(value) {
              assert.equal(true, value);

              client.getValue("NOT_EXISTS", false, function(value) {
                assert.equal(false, value);

                done();
              }, new User("identifier"));

            }, new User("identifier"));
          });
        });
      }, new User("identifier"));
    });
  });

  it("Initialization With AutoPollOptions should create an instance, getValueAsync works", async () => {
    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    await client.forceRefreshAsync();
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(false, await client.getValueAsync("NOT_EXISTS", false, new User("identifier")));
  });

  it("Initialization With LazyLoadOptions should create an instance, getValue works", (done) => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function(value) {
      assert.equal(true, value);

      client.getValue("debug", false, function(value) {
        assert.equal(true, value);

        client.getValue("NOT_EXISTS", false, function(value) {
          assert.equal(false, value);

          client.forceRefresh(function() {
            client.getValue("debug", false, function(value) {
              assert.equal(true, value);
              done();
            }, new User("identifier"));
          });
        }, new User("identifier"));
      }, new User("identifier"));
    }, new User("identifier"));
  });

  it("Initialization With LazyLoadOptions should create an instance, getValueAsync works", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(false, await client.getValueAsync("NOT_EXISTS", false, new User("identifier")));
    await client.forceRefreshAsync();
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
  });

  it("Initialization With ManualPollOptions should create an instance, getValue works", (done) => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function(value) {
      assert.equal(false, value);

      client.getValue("debug", false, function(value) {
        assert.equal(false, value);

        client.forceRefresh(function() {
          client.getValue("debug", false, function(value) {
            assert.equal(true, value);

            client.getValue("debug", false, function(value) {
              assert.equal(true, value);

              client.getValue("NOT_EXISTS", false, function(value) {
                assert.equal(false, value);

                done();
              }, new User("identifier"));
            }, new User("identifier"));
          });
        });

      }, new User("identifier"));
    });
  });

  it("Initialization With ManualPollOptions should create an instance, getValueAsync works", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    assert.equal(false, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(false, await client.getValueAsync("debug", false, new User("identifier")));
    await client.forceRefreshAsync();
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(false, await client.getValueAsync("NOT_EXISTS", false, new User("identifier")));
  });

  it("Initialization With ManualPollOptions should create an instance", (done) => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    client.forceRefresh(() => {
      client.getValue("debug", false, function(value) {
        assert.equal(true, value);
        done();
      });
    });
  });

  it("Initialization With AutoPollOptions should create an instance", (done) => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function(value) {
      assert.equal(true, value);
      done();
    });
  });

  it("Initialization With LazyLoadOptions should create an instance", (done) => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function(value) {
      assert.equal(false, value);
      done();
    });
  });

  it("getValue() works without userObject", (done) => {
    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    assert.isDefined(client);

    client.getValue("debug", false, function(value) {
      assert.equal(value, true);
      done();
    });
  });

  it("getValueAsync() works without userObject", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    const flagEvaluatedEvents: IEvaluationDetails[] = [];
    client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

    const value = await client.getValueAsync("debug", true);
    assert.equal(true, value);

    assert.equal(1, flagEvaluatedEvents.length);
    assert.strictEqual(value, flagEvaluatedEvents[0].value);
  });

  it("getAllKeys() works", (done) => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    client.getAllKeys(function(keys) {
      assert.equal(keys.length, 2);
      assert.equal(keys[0], "debug");
      assert.equal(keys[1], "debug2");
      done();
    });
  });

  it("getAllKeysAsync() works", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    const keys = await client.getAllKeysAsync();
    assert.equal(keys.length, 2);
    assert.equal(keys[0], "debug");
    assert.equal(keys[1], "debug2");
  });

  it("getAllKeys() works - without config", (done) => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null, maxInitWaitTimeSeconds: 0 }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    client.getAllKeys(function(keys) {
      assert.equal(keys.length, 0);
      done();
    });
  });

  it("getAllKeysAsync() works - without config", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null, maxInitWaitTimeSeconds: 0 }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    const keys = await client.getAllKeysAsync();
    assert.equal(keys.length, 0);
  });

  for (const isAsync of [false, true]) {
    it(`getValueDetails${isAsync ? "Async" : ""}() should return correct result when setting is not available`, async () => {

      // Arrange

      const key = "notexists";
      const defaultValue = false;
      const timestamp = new Date().getTime();

      const configFetcherClass = FakeConfigFetcherWithTwoKeys;
      const cachedPc = new ProjectConfig(timestamp, configFetcherClass.configJson, "etag");
      const configCache = new FakeCache(cachedPc);
      const configCatKernel: FakeConfigCatKernel = { configFetcher: new configFetcherClass(), sdkType: "common", sdkVersion: "1.0.0" };
      const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, {}, configCache);
      const client = new ConfigCatClient(options, configCatKernel);

      const user = new User("a@configcat.com");

      const flagEvaluatedEvents: IEvaluationDetails[] = [];
      client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

      // Act

      const actual = await (isAsync
        ? client.getValueDetailsAsync(key, defaultValue, user)
        : new Promise<IEvaluationDetails>(resolve => client.getValueDetails(key, defaultValue, resolve, user))
      );

      // Assert

      assert.strictEqual(key, actual.key);
      assert.strictEqual(defaultValue, actual.value);
      assert.isTrue(actual.isDefaultValue);
      assert.isUndefined(actual.variationId);
      assert.strictEqual(cachedPc.Timestamp, actual.fetchTime?.getTime());
      assert.strictEqual(user, actual.user);
      assert.isDefined(actual.errorMessage);
      assert.isUndefined(actual.errorException);
      assert.isUndefined(actual.matchedEvaluationRule);
      assert.isUndefined(actual.matchedEvaluationPercentageRule);

      assert.equal(1, flagEvaluatedEvents.length);
      assert.strictEqual(actual, flagEvaluatedEvents[0]);
    });

    it(`getValueDetails${isAsync ? "Async" : ""}() should return correct result when setting is available but no rule applies`, async () => {

      // Arrange

      const key = "debug";
      const defaultValue = false;
      const timestamp = new Date().getTime();

      const configFetcherClass = FakeConfigFetcherWithTwoKeys;
      const cachedPc = new ProjectConfig(timestamp, configFetcherClass.configJson, "etag");
      const configCache = new FakeCache(cachedPc);
      const configCatKernel: FakeConfigCatKernel = { configFetcher: new configFetcherClass(), sdkType: "common", sdkVersion: "1.0.0" };
      const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, {}, configCache);
      const client = new ConfigCatClient(options, configCatKernel);

      const user = new User("a@configcat.com");

      const flagEvaluatedEvents: IEvaluationDetails[] = [];
      client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

      // Act

      const actual = await (isAsync
        ? client.getValueDetailsAsync(key, defaultValue, user)
        : new Promise<IEvaluationDetails>(resolve => client.getValueDetails(key, defaultValue, resolve, user))
      );

      // Assert

      assert.strictEqual(key, actual.key);
      assert.strictEqual(true, actual.value);
      assert.isFalse(actual.isDefaultValue);
      assert.strictEqual("abcdefgh", actual.variationId);
      assert.strictEqual(cachedPc.Timestamp, actual.fetchTime?.getTime());
      assert.strictEqual(user, actual.user);
      assert.isUndefined(actual.errorMessage);
      assert.isUndefined(actual.errorException);
      assert.isUndefined(actual.matchedEvaluationRule);
      assert.isUndefined(actual.matchedEvaluationPercentageRule);

      assert.equal(1, flagEvaluatedEvents.length);
      assert.strictEqual(actual, flagEvaluatedEvents[0]);
    });

    it(`getValueDetails${isAsync ? "Async" : ""}() should return correct result when setting is available and a comparison-based rule applies`, async () => {

      // Arrange

      const key = "debug";
      const defaultValue = "N/A";
      const timestamp = new Date().getTime();

      const configFetcherClass = FakeConfigFetcherWithRules;
      const cachedPc = new ProjectConfig(timestamp, configFetcherClass.configJson, "etag");
      const configCache = new FakeCache(cachedPc);
      const configCatKernel: FakeConfigCatKernel = { configFetcher: new configFetcherClass(), sdkType: "common", sdkVersion: "1.0.0" };
      const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, {}, configCache);
      const client = new ConfigCatClient(options, configCatKernel);

      const user = new User("a@configcat.com");
      user.custom = { eyeColor: "red" };

      const flagEvaluatedEvents: IEvaluationDetails[] = [];
      client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

      // Act

      const actual = await (isAsync
        ? client.getValueDetailsAsync(key, defaultValue, user)
        : new Promise<IEvaluationDetails>(resolve => client.getValueDetails(key, defaultValue, resolve, user))
      );

      // Assert

      assert.strictEqual(key, actual.key);
      assert.strictEqual("redValue", actual.value);
      assert.isFalse(actual.isDefaultValue);
      assert.strictEqual("redVariationId", actual.variationId);
      assert.strictEqual(cachedPc.Timestamp, actual.fetchTime?.getTime());
      assert.strictEqual(user, actual.user);
      assert.isUndefined(actual.errorMessage);
      assert.isUndefined(actual.errorException);
      assert.isDefined(actual.matchedEvaluationRule);
      assert.strictEqual(actual.value, actual.matchedEvaluationRule?.value);
      assert.strictEqual(actual.variationId, actual.matchedEvaluationRule?.variationId);
      assert.isUndefined(actual.matchedEvaluationPercentageRule);

      assert.equal(1, flagEvaluatedEvents.length);
      assert.strictEqual(actual, flagEvaluatedEvents[0]);
    });

    it(`getValueDetails${isAsync ? "Async" : ""}() should return correct result when setting is available and a percentage-based rule applies`, async () => {

      // Arrange

      const key = "string25Cat25Dog25Falcon25Horse";
      const defaultValue = "N/A";
      const timestamp = new Date().getTime();

      const configFetcherClass = FakeConfigFetcherWithPercantageRules;
      const cachedPc = new ProjectConfig(timestamp, configFetcherClass.configJson, "etag");
      const configCache = new FakeCache(cachedPc);
      const configCatKernel: FakeConfigCatKernel = { configFetcher: new configFetcherClass(), sdkType: "common", sdkVersion: "1.0.0" };
      const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, {}, configCache);
      const client = new ConfigCatClient(options, configCatKernel);

      const user = new User("a@configcat.com");

      const flagEvaluatedEvents: IEvaluationDetails[] = [];
      client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

      // Act

      const actual = await (isAsync
        ? client.getValueDetailsAsync(key, defaultValue, user)
        : new Promise<IEvaluationDetails>(resolve => client.getValueDetails(key, defaultValue, resolve, user))
      );

      // Assert

      assert.strictEqual(key, actual.key);
      assert.strictEqual("Cat", actual.value);
      assert.isFalse(actual.isDefaultValue);
      assert.strictEqual("CatVariationId", actual.variationId);
      assert.strictEqual(cachedPc.Timestamp, actual.fetchTime?.getTime());
      assert.strictEqual(user, actual.user);
      assert.isUndefined(actual.errorMessage);
      assert.isUndefined(actual.errorException);
      assert.isUndefined(actual.matchedEvaluationRule);
      assert.isDefined(actual.matchedEvaluationPercentageRule);
      assert.strictEqual(actual.value, actual.matchedEvaluationPercentageRule?.value);
      assert.strictEqual(actual.variationId, actual.matchedEvaluationPercentageRule?.variationId);

      assert.equal(1, flagEvaluatedEvents.length);
      assert.strictEqual(actual, flagEvaluatedEvents[0]);
    });

    it(`getValueDetails${isAsync ? "Async" : ""}() should return default value when exception thrown`, async () => {

      // Arrange

      const key = "debug";
      const defaultValue = false;
      const timestamp = new Date().getTime();

      const configFetcherClass = FakeConfigFetcherWithTwoKeys;
      const cachedPc = new ProjectConfig(timestamp, configFetcherClass.configJson, "etag");
      const configCache = new FakeCache(cachedPc);
      const configCatKernel: FakeConfigCatKernel = { configFetcher: new configFetcherClass(), sdkType: "common", sdkVersion: "1.0.0" };
      const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, {}, configCache);
      const client = new ConfigCatClient(options, configCatKernel);

      const err = new Error("Something went wrong.");
      client["evaluator"] = new class implements IRolloutEvaluator {
        evaluate(setting: Setting, key: string, defaultValue: any, user: User | undefined, remoteConfig: ProjectConfig | null, defaultVariationId?: any): IEvaluationDetails {
          throw err;
        }
      };

      const user = new User("a@configcat.com");

      const flagEvaluatedEvents: IEvaluationDetails[] = [];
      const errorEvents: [string, any][] = [];
      client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));
      client.on("clientError", (msg: string, err: any) => errorEvents.push([msg, err]));

      // Act

      const actual = await (isAsync
        ? client.getValueDetailsAsync(key, defaultValue, user)
        : new Promise<IEvaluationDetails>(resolve => client.getValueDetails(key, defaultValue, resolve, user))
      );

      // Assert

      assert.strictEqual(key, actual.key);
      assert.strictEqual(defaultValue, actual.value);
      assert.isTrue(actual.isDefaultValue);
      assert.isUndefined(actual.variationId);
      assert.strictEqual(cachedPc.Timestamp, actual.fetchTime?.getTime());
      assert.strictEqual(user, actual.user);
      assert.isDefined(actual.errorMessage);
      assert.strictEqual(err, actual.errorException);
      assert.isUndefined(actual.matchedEvaluationRule);
      assert.isUndefined(actual.matchedEvaluationPercentageRule);

      assert.equal(1, flagEvaluatedEvents.length);
      assert.strictEqual(actual, flagEvaluatedEvents[0]);

      assert.equal(1, errorEvents.length);
      const [actualErrorMessage, actualErrorException] = errorEvents[0];
      expect(actualErrorMessage).to.include("Error occurred in the `getValueDetailsAsync` method");
      assert.strictEqual(err, actualErrorException);
    });
  }

  for (const isAsync of [false, true]) {
    it(`getAllValueDetails${isAsync ? "Async" : ""}() should return correct result`, async () => {

      // Arrange

      const timestamp = new Date().getTime();

      const configFetcherClass = FakeConfigFetcherWithTwoKeys;
      const cachedPc = new ProjectConfig(timestamp, configFetcherClass.configJson, "etag");
      const configCache = new FakeCache(cachedPc);
      const configCatKernel: FakeConfigCatKernel = { configFetcher: new configFetcherClass(), sdkType: "common", sdkVersion: "1.0.0" };
      const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, {}, configCache);
      const client = new ConfigCatClient(options, configCatKernel);

      const user = new User("a@configcat.com");

      const flagEvaluatedEvents: IEvaluationDetails[] = [];
      client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

      // Act

      const actual = await (isAsync
        ? client.getAllValueDetailsAsync(user)
        : new Promise<IEvaluationDetails[]>(resolve => client.getAllValueDetails(resolve, user))
      );

      // Assert

      const expected = [
        { key: "debug", value: true, variationId: "abcdefgh" },
        { key: "debug2", value: true, variationId: "12345678" },
      ];

      for (const { key, value, variationId } of expected) {
        const actualDetails = actual.find(details => details.key === key)!;

        assert.isDefined(actualDetails);
        assert.strictEqual(value, actualDetails.value);
        assert.isFalse(actualDetails.isDefaultValue);
        assert.strictEqual(variationId, actualDetails.variationId);
        assert.strictEqual(cachedPc.Timestamp, actualDetails.fetchTime?.getTime());
        assert.strictEqual(user, actualDetails.user);
        assert.isUndefined(actualDetails.errorMessage);
        assert.isUndefined(actualDetails.errorException);
        assert.isUndefined(actualDetails.matchedEvaluationRule);
        assert.isUndefined(actualDetails.matchedEvaluationPercentageRule);

        const flagEvaluatedDetails = flagEvaluatedEvents.find(details => details.key === key)!;

        assert.isDefined(flagEvaluatedDetails);
        assert.strictEqual(actualDetails, flagEvaluatedDetails);
      }
    });

    it(`getAllValueDetails${isAsync ? "Async" : ""}() should return default value when exception thrown`, async () => {

      // Arrange

      const timestamp = new Date().getTime();

      const configFetcherClass = FakeConfigFetcherWithTwoKeys;
      const cachedPc = new ProjectConfig(timestamp, configFetcherClass.configJson, "etag");
      const configCache = new FakeCache(cachedPc);
      const configCatKernel: FakeConfigCatKernel = { configFetcher: new configFetcherClass(), sdkType: "common", sdkVersion: "1.0.0" };
      const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, {}, configCache);
      const client = new ConfigCatClient(options, configCatKernel);

      const err = new Error("Something went wrong.");
      client["evaluator"] = new class implements IRolloutEvaluator {
        evaluate(setting: Setting, key: string, defaultValue: any, user: User | undefined, remoteConfig: ProjectConfig | null, defaultVariationId?: any): IEvaluationDetails {
          throw err;
        }
      };

      const user = new User("a@configcat.com");

      const flagEvaluatedEvents: IEvaluationDetails[] = [];
      const errorEvents: [string, any][] = [];
      client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));
      client.on("clientError", (msg: string, err: any) => errorEvents.push([msg, err]));

      // Act

      const actual = await (isAsync
        ? client.getAllValueDetailsAsync(user)
        : new Promise<IEvaluationDetails[]>(resolve => client.getAllValueDetails(resolve, user))
      );

      // Assert

      for (const key of ["debug", "debug2"]) {
        const actualDetails = actual.find(details => details.key === key)!;

        assert.isNull(actualDetails.value);
        assert.isTrue(actualDetails.isDefaultValue);
        assert.isUndefined(actualDetails.variationId);
        assert.strictEqual(cachedPc.Timestamp, actualDetails.fetchTime?.getTime());
        assert.strictEqual(user, actualDetails.user);
        assert.isDefined(actualDetails.errorMessage);
        assert.strictEqual(err, actualDetails.errorException);
        assert.isUndefined(actualDetails.matchedEvaluationRule);
        assert.isUndefined(actualDetails.matchedEvaluationPercentageRule);

        const flagEvaluatedDetails = flagEvaluatedEvents.find(details => details.key === key)!;

        assert.isDefined(flagEvaluatedDetails);
        assert.strictEqual(actualDetails, flagEvaluatedDetails);
      }

      assert.equal(1, errorEvents.length);
      const [actualErrorMessage, actualErrorException] = errorEvents[0];
      expect(actualErrorMessage).to.include("Error occurred in the `getAllValueDetailsAsync` method.");
      if (typeof AggregateError !== "undefined") {
        assert.instanceOf(actualErrorException, AggregateError);
        assert.deepEqual(Array(actual.length).fill(err), (actualErrorException as AggregateError).errors);
      }
      else {
        assert.strictEqual(err, actualErrorException);
      }
    });
  }

  it("Initialization With AutoPollOptions - config changed in every fetch - should fire configChanged every polling iteration", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithAlwaysVariableEtag(), sdkType: "common", sdkVersion: "1.0.0" };
    let counter = 0;
    let configChangedEventCount = 0;
    const pollIntervalSeconds = 1;
    const userOptions: IAutoPollOptions = {
      logger: null,
      pollIntervalSeconds,
      configChanged: () => { counter++; },
      setupHooks: hooks => hooks.on("configChanged", () => configChangedEventCount++)
    };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", userOptions, null);
    new ConfigCatClient(options, configCatKernel);

    await delay(2.5 * pollIntervalSeconds * 1000);

    assert.equal(counter, 3);
    assert.equal(configChangedEventCount, 3);
  });

  it("Initialization With AutoPollOptions - with maxInitWaitTimeSeconds - getValueAsync should wait", async () => {

    const maxInitWaitTimeSeconds = 2;

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(500), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: maxInitWaitTimeSeconds }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const startDate: number = new Date().getTime();
    const actualValue = await client.getValueAsync("debug", false);
    const ellapsedMilliseconds: number = new Date().getTime() - startDate;

    assert.isAtLeast(ellapsedMilliseconds, 500);
    assert.isAtMost(ellapsedMilliseconds, maxInitWaitTimeSeconds * 1000);
    assert.equal(actualValue, true);
  });

  it("Initialization With AutoPollOptions - with maxInitWaitTimeSeconds - getValueAsync should wait for maxInitWaitTimeSeconds only and return default value", async () => {

    const maxInitWaitTimeSeconds = 1;

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: maxInitWaitTimeSeconds }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const startDate: number = new Date().getTime();
    const actualValue = await client.getValueAsync("debug", false);
    const ellapsedMilliseconds: number = new Date().getTime() - startDate;

    assert.isAtLeast(ellapsedMilliseconds, maxInitWaitTimeSeconds);
    assert.isAtMost(ellapsedMilliseconds, (maxInitWaitTimeSeconds * 1000) + 50); // 50 ms for tolerance
    assert.equal(actualValue, false);
  });

  it("getValueAsync - User.Identifier is an empty string - should return evaluated value", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const user: User = new User("");

    const actual = await client.getValueAsync("debug2", "N/A", user);

    assert.equal(actual, "value2");
  });

  it("getValueAsync - User.Identifier can be non empty string - should return evaluated value", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const user: User = new User("userId");

    const actual = await client.getValueAsync("debug2", "N/A", user);

    assert.equal(actual, "value1");
  });

  it("getValueAsync - case sensitive key tests", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoCaseSensitiveKeys(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    let actual = await client.getValueAsync("debug", "N/A");

    assert.equal(actual, "debug");
    assert.notEqual(actual, "DEBUG");

    actual = await client.getValueAsync("DEBUG", "N/A");

    assert.notEqual(actual, "debug");
    assert.equal(actual, "DEBUG");
  });

  it("getValueAsync - case sensitive attribute tests", async () => {
    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoCaseSensitiveKeys(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    let user: User = new User("", void 0, void 0, { "CUSTOM": "c" });
    let actual = await client.getValueAsync("debug", "N/A", user);

    assert.equal(actual, "UPPER-VALUE");

    user = new User("", void 0, void 0, { "custom": "c" });
    actual = await client.getValueAsync("debug", "N/A", user);

    assert.equal(actual, "lower-value");

    user = new User("", void 0, void 0, { "custom": "c", "CUSTOM": "c" });
    actual = await client.getValueAsync("debug", "N/A", user);

    assert.equal(actual, "UPPER-VALUE");
  });

  it("getAllValuesAsync - works", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const flagEvaluatedEvents: IEvaluationDetails[] = [];
    client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

    const actual = await client.getAllValuesAsync();

    assert.equal(actual.length, 2);

    assert.deepEqual(flagEvaluatedEvents.map(evt => [evt.key, evt.value]), actual.map(kv => [kv.settingKey, kv.settingValue]));
  });

  it("getAllValues - works", (done) => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    client.getAllValues(actual => {
      assert.equal(actual.length, 2);
      done();
    });
  });

  it("getAllValuesAsync - without config - return empty array", async () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null, maxInitWaitTimeSeconds: 0 }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const flagEvaluatedEvents: IEvaluationDetails[] = [];
    client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

    const actual = await client.getAllValuesAsync();

    assert.isDefined(actual);
    assert.equal(actual.length, 0);

    assert.equal(flagEvaluatedEvents.length, 0);
  });

  it("Initialization With LazyLoadOptions - multiple getValueAsync should not cause multiple config fetches", async () => {

    const configFetcher = new FakeConfigFetcher(500);
    const configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: "common", sdkVersion: "1.0.0" };
    const options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0");
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    await Promise.all([client.getValueAsync("debug", false), client.getValueAsync("debug", false)]);
    assert.equal(1, configFetcher.calledTimes);
  });

  it("Initialization With LazyLoadOptions - multiple getValue calls should not cause multiple config fetches", done => {

    const configFetcher = new FakeConfigFetcher(500);
    const configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: "common", sdkVersion: "1.0.0" };
    const options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0");
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    let callbackCount = 0;

    const callback = (value: any) => {
      {
        callbackCount++;
        if (callbackCount > 1) {
          assert.equal(1, configFetcher.calledTimes);
          done();
        }
      }
    };

    client.getValue("debug", false, callback);
    client.getValue("debug", false, callback);
  });

  it("Initialization With AutoPollOptions with expired cache - getValue should take care of maxInitWaitTimeSeconds", done => {

    const configFetcher = new FakeConfigFetcher(500);
    const configCache = new FakeCache(new ProjectConfig(new Date().getTime() - 10000000, "{\"f\": { \"debug\": { \"v\": false, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }", "etag2"));
    const configCatKernel: FakeConfigCatKernel = { configFetcher, cache: configCache, sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { cache: configCache, maxInitWaitTimeSeconds: 10 });
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    client.getValue("debug", false, value => {
      done(value === true ? null : new Error("Wrong value."));
    });
  });

  it("Initialization With AutoPollOptions with expired cache - getValueAsync should take care of maxInitWaitTimeSeconds", async () => {

    const configFetcher = new FakeConfigFetcher(500);
    const configCache = new FakeCache(new ProjectConfig(new Date().getTime() - 10000000, "{\"f\": { \"debug\": { \"v\": false, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }", "etag2"));
    const configCatKernel: FakeConfigCatKernel = { configFetcher, cache: configCache, sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { cache: configCache, maxInitWaitTimeSeconds: 10 });
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const value = await client.getValueAsync("debug", false);
    assert.isTrue(value);
  });

  it("Dispose should stop the client in every scenario", done => {

    const configFetcher = new FakeConfigFetcher(500);
    const configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: "common", sdkVersion: "1.0.0" };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: 2 });
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    client.dispose();
    assert.equal(configFetcher.calledTimes, 0);
    setTimeout(() => {
      assert.equal(configFetcher.calledTimes, 1);
      done();
    }, 4000);
  });

  for (const passOptionsToSecondGet of [false, true]) {
    it(`get() should return cached instance ${passOptionsToSecondGet ? "with" : "without"} warning`, done => {
      // Arrange

      const sdkKey = "test";

      const logger = new FakeLogger(LogLevel.Debug);

      const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
      const options: IManualPollOptions = { logger };

      // Act

      const client1 = ConfigCatClient.get(sdkKey, PollingMode.ManualPoll, options, configCatKernel);
      const messages1 = [...logger.messages];

      logger.reset();
      const client2 = ConfigCatClient.get(sdkKey, PollingMode.ManualPoll, passOptionsToSecondGet ? options : null, configCatKernel);
      const messages2 = [...logger.messages];

      const instanceCount = ConfigCatClient["instanceCache"].getAliveCount();

      client2.dispose();
      client1.dispose();

      // Assert

      assert.equal(1, instanceCount);
      assert.strictEqual(client1, client2);
      assert.isEmpty(messages1.filter(([, msg]) => msg.indexOf("the specified options are ignored") >= 0));

      if (passOptionsToSecondGet) {
        assert.isNotEmpty(messages2.filter(([, msg]) => msg.indexOf("the specified options are ignored") >= 0));
      }
      else {
        assert.isEmpty(messages2.filter(([, msg]) => msg.indexOf("the specified options are ignored") >= 0));
      }

      done();
    });
  }

  it("dispose() should remove cached instance", done => {
    // Arrange

    const sdkKey = "test";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };

    const client1 = ConfigCatClient.get(sdkKey, PollingMode.ManualPoll, null, configCatKernel);

    // Act

    const instanceCount1 = ConfigCatClient["instanceCache"].getAliveCount();

    client1.dispose();

    const instanceCount2 = ConfigCatClient["instanceCache"].getAliveCount();

    // Assert

    assert.equal(1, instanceCount1);
    assert.equal(0, instanceCount2);

    done();
  });

  it("dispose() should remove current cached instance only", done => {
    // Arrange

    const sdkKey = "test";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };

    const client1 = ConfigCatClient.get(sdkKey, PollingMode.ManualPoll, null, configCatKernel);

    // Act

    const instanceCount1 = ConfigCatClient["instanceCache"].getAliveCount();

    client1.dispose();

    const instanceCount2 = ConfigCatClient["instanceCache"].getAliveCount();

    const client2 = ConfigCatClient.get(sdkKey, PollingMode.ManualPoll, null, configCatKernel);

    const instanceCount3 = ConfigCatClient["instanceCache"].getAliveCount();

    client1.dispose();

    const instanceCount4 = ConfigCatClient["instanceCache"].getAliveCount();

    client2.dispose();

    const instanceCount5 = ConfigCatClient["instanceCache"].getAliveCount();

    // Assert

    assert.equal(1, instanceCount1);
    assert.equal(0, instanceCount2);
    assert.equal(1, instanceCount3);
    assert.equal(1, instanceCount4);
    assert.equal(0, instanceCount5);

    done();
  });

  it("disposeAll() should remove all cached instances", done => {
    // Arrange

    const sdkKey1 = "test1", sdkKey2 = "test2";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };

    const client1 = ConfigCatClient.get(sdkKey1, PollingMode.AutoPoll, null, configCatKernel);
    const client2 = ConfigCatClient.get(sdkKey2, PollingMode.ManualPoll, null, configCatKernel);

    // Act

    const instanceCount1 = ConfigCatClient["instanceCache"].getAliveCount();

    ConfigCatClient.disposeAll();

    const instanceCount2 = ConfigCatClient["instanceCache"].getAliveCount();

    // Assert

    assert.equal(2, instanceCount1);
    assert.equal(0, instanceCount2);
    assert.isObject(client1);
    assert.isObject(client2);

    done();
  });

  it("GC should be able to collect cached instances when no strong references are left", async function() {
    // Arrange

    setupPolyfills();
    if (!isWeakRefAvailable() || typeof gc === "undefined") {
      this.skip();
    }
    const isFinalizationRegistryAvailable = typeof FinalizationRegistry !== "undefined";

    const sdkKey1 = "test1", sdkKey2 = "test2";

    const logger = new FakeLogger(LogLevel.Debug);
    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };

    function createClients() {
      ConfigCatClient.get(sdkKey1, PollingMode.AutoPoll, { logger, maxInitWaitTimeSeconds: 0 }, configCatKernel);
      ConfigCatClient.get(sdkKey2, PollingMode.ManualPoll, { logger }, configCatKernel);

      return ConfigCatClient["instanceCache"].getAliveCount();
    }

    // Act

    const instanceCount1 = createClients();

    // We need to allow the event loop to run so the runtime can detect there's no more strong references to the created clients.
    await allowEventLoop();
    gc();

    if (isFinalizationRegistryAvailable) {
      // We need to allow the finalizer callbacks to execute.
      await allowEventLoop(10);
    }

    const instanceCount2 = ConfigCatClient["instanceCache"].getAliveCount();

    // Assert

    assert.equal(2, instanceCount1);
    assert.equal(0, instanceCount2);

    if (isFinalizationRegistryAvailable) {
      assert.equal(2, logger.messages.filter(([, msg]) => msg.indexOf("finalize() called") >= 0).length);
    }
  });

  // For these tests we need to choose a ridiculously large poll interval/ cache TTL to make sure that config is fetched only once.
  const optionsFactoriesForOfflineModeTests: [PollingMode, (sdkKey: string, kernel: IConfigCatKernel, cache: ICache, offline: boolean) => OptionsBase][] = [
    [PollingMode.AutoPoll, (sdkKey, kernel, cache, offline) => new AutoPollOptions(sdkKey, kernel.sdkType, kernel.sdkType, { offline, pollIntervalSeconds: 100_000, maxInitWaitTimeSeconds: 1 }, cache)],
    [PollingMode.LazyLoad, (sdkKey, kernel, cache, offline) => new LazyLoadOptions(sdkKey, kernel.sdkType, kernel.sdkType, { offline, cacheTimeToLiveSeconds: 100_000 }, cache)],
    [PollingMode.ManualPoll, (sdkKey, kernel, cache, offline) => new ManualPollOptions(sdkKey, kernel.sdkType, kernel.sdkType, { offline }, cache)],
  ];

  for (const [pollingMode, optionsFactory] of optionsFactoriesForOfflineModeTests) {
    it(`setOnline() should make a(n) ${PollingMode[pollingMode]} client created in offline mode transition to online mode.`, async () => {

      const configFetcher = new FakeConfigFetcherBase("{}", 100, (lastConfig, lastETag) => ({
        statusCode: 200,
        reasonPhrase: "OK",
        eTag: (lastETag as any | 0) + 1 + "",
        body: lastConfig
      } as IFetchResponse));
      const configCache = new FakeCache();
      const configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: "common", sdkVersion: "1.0.0" };
      const options = optionsFactory("APIKEY", configCatKernel, configCache, true);
      const client = new ConfigCatClient(options, configCatKernel);
      const configService = client["configService"] as ConfigServiceBase<OptionsBase>;

      let expectedFetchTimes = 0;

      // 1. Checks that client is initialized to offline mode
      assert.isTrue(client.isOffline);
      assert.isNull(await configService.getConfig());

      // 2. Checks that repeated calls to setOffline() have no effect
      client.setOffline();

      assert.isTrue(client.isOffline);
      assert.equal(expectedFetchTimes, configFetcher.calledTimes);

      // 3. Checks that setOnline() does enable HTTP calls
      client.setOnline();

      if (configService instanceof AutoPollConfigService) {
        assert.isTrue(await configService["waitForInitializationAsync"]());
        expectedFetchTimes++;
      }

      assert.isFalse(client.isOffline);
      assert.equal(expectedFetchTimes, configFetcher.calledTimes);

      const etag1 = ((await configService.getConfig())?.HttpETag ?? "0") as any | 0;
      if (configService instanceof LazyLoadConfigService) {
        expectedFetchTimes++;
      }

      (expectedFetchTimes > 0 ? assert.notEqual : assert.equal)(0, etag1);

      // 4. Checks that forceRefreshAsync() initiates a HTTP call in online mode
      const refreshResult = await client.forceRefreshAsync();
      expectedFetchTimes++;

      assert.isFalse(client.isOffline);
      assert.equal(expectedFetchTimes, configFetcher.calledTimes);

      const etag2 = ((await configService.getConfig())?.HttpETag ?? "0") as any | 0;
      assert.isTrue(etag2 > etag1);

      assert.isTrue(refreshResult.isSuccess);
      assert.isNull(refreshResult.errorMessage);
      assert.isUndefined(refreshResult.errorException);

      // 5. Checks that setOnline() has no effect after client gets disposed
      client.dispose();

      client.setOnline();
      assert.isTrue(client.isOffline);
    });
  }

  for (const [pollingMode, optionsFactory] of optionsFactoriesForOfflineModeTests) {
    it(`setOffline() should make a(n) ${PollingMode[pollingMode]} client created in online mode transition to offline mode.`, async () => {

      const configFetcher = new FakeConfigFetcherBase("{}", 100, (lastConfig, lastETag) => ({
        statusCode: 200,
        reasonPhrase: "OK",
        eTag: (lastETag as any | 0) + 1 + "",
        body: lastConfig
      } as IFetchResponse));

      const configCache = new FakeCache();
      const configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: "common", sdkVersion: "1.0.0" };
      const options = optionsFactory("APIKEY", configCatKernel, configCache, false);
      const client = new ConfigCatClient(options, configCatKernel);
      const configService = client["configService"] as ConfigServiceBase<OptionsBase>;

      let expectedFetchTimes = 0;

      // 1. Checks that client is initialized to online mode
      assert.isFalse(client.isOffline);

      if (configService instanceof AutoPollConfigService) {
        assert.isTrue(await configService["waitForInitializationAsync"]());
        expectedFetchTimes++;
      }

      assert.equal(expectedFetchTimes, configFetcher.calledTimes);

      const etag1 = ((await configService.getConfig())?.HttpETag ?? "0") as any | 0;
      if (configService instanceof LazyLoadConfigService) {
        expectedFetchTimes++;
      }

      (expectedFetchTimes > 0 ? assert.notEqual : assert.equal)(0, etag1);

      // 2. Checks that repeated calls to setOnline() have no effect
      client.setOnline();

      assert.isFalse(client.isOffline);
      assert.equal(expectedFetchTimes, configFetcher.calledTimes);

      // 3. Checks that setOffline() does disable HTTP calls
      client.setOffline();

      assert.isTrue(client.isOffline);
      assert.equal(expectedFetchTimes, configFetcher.calledTimes);

      assert.equal(etag1, ((await configService.getConfig())?.HttpETag ?? "0") as any | 0);

      // 4. Checks that forceRefreshAsync() does not initiate a HTTP call in offline mode
      const refreshResult = await client.forceRefreshAsync();

      assert.isTrue(client.isOffline);
      assert.equal(expectedFetchTimes, configFetcher.calledTimes);

      assert.equal(etag1, ((await configService.getConfig())?.HttpETag ?? "0") as any | 0);

      assert.isFalse(refreshResult.isSuccess);
      expect(refreshResult.errorMessage).to.contain("offline mode");
      assert.isUndefined(refreshResult.errorException);

      // 5. Checks that setOnline() has no effect after client gets disposed
      client.dispose();

      client.setOnline();
      assert.isTrue(client.isOffline);
    });
  }

  for (const addListenersViaOptions of [false, true]) {
    it(`ConfigCatClient should emit events, which listeners added ${addListenersViaOptions ? "via options" : "directly on the client"} should get notified of.`, async () => {
      let clientReadyEventCount = 0;
      const configChangedEvents: ProjectConfig[] = [];
      const flagEvaluatedEvents: IEvaluationDetails[] = [];
      const errorEvents: [string, any][] = [];

      const handleClientReady = () => clientReadyEventCount++;
      const handleConfigChanged = (pc: ProjectConfig) => configChangedEvents.push(pc);
      const handleFlagEvaluated = (ed: IEvaluationDetails) => flagEvaluatedEvents.push(ed);
      const handleClientError = (msg: string, err: any) => errorEvents.push([msg, err]);

      function setupHooks(hooks: IProvidesHooks) {
        hooks.on("clientReady", handleClientReady);
        hooks.on("configChanged", handleConfigChanged);
        hooks.on("flagEvaluated", handleFlagEvaluated);
        hooks.on("clientError", handleClientError);
      }

      const configFetcher = new FakeConfigFetcherWithTwoKeys();
      const configCache = new FakeCache();
      const configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: "common", sdkVersion: "1.0.0" };
      const userOptions: IManualPollOptions = addListenersViaOptions ? { setupHooks } : {};
      const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, userOptions, configCache);

      const expectedErrorMessage = "Error occurred in the `forceRefreshAsync` method.";
      const expectedErrorException = new Error("Something went wrong.");

      // 1. Client gets created
      const client = new ConfigCatClient(options, configCatKernel);

      if (!addListenersViaOptions) {
        setupHooks(client);
      }

      const expectedClientReadyEventCount = addListenersViaOptions ? 1 : 0;
      assert.equal(expectedClientReadyEventCount, clientReadyEventCount);
      assert.equal(0, configChangedEvents.length);
      assert.equal(0, flagEvaluatedEvents.length);
      assert.equal(0, errorEvents.length);

      // 2. Fetch fails
      const originalConfigService = client["configService"] as ConfigServiceBase<OptionsBase>;
      client["configService"] = new class implements IConfigService {
        getConfig(): Promise<ProjectConfig | null> { return Promise.resolve(null); }
        refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig | null]> { return Promise.reject(expectedErrorException); }
        get isOffline(): boolean { return false; }
        setOnline(): void { }
        setOffline(): void { }
        dispose(): void { }
      };

      await client.forceRefreshAsync();

      assert.equal(0, configChangedEvents.length);
      assert.equal(1, errorEvents.length);
      const [actualErrorMessage, actualErrorException] = errorEvents[0];
      expect(actualErrorMessage).to.includes(expectedErrorMessage);
      assert.strictEqual(expectedErrorException, actualErrorException);

      // 3. Fetch succeeds
      client["configService"] = originalConfigService;

      await client.forceRefreshAsync();
      const cachedPc = configCache.get("");

      assert.equal(1, configChangedEvents.length);
      assert.strictEqual(cachedPc, configChangedEvents[0]);

      // 4. All flags are evaluated
      const keys = await client.getAllKeysAsync();
      const evaluationDetails: IEvaluationDetails[] = [];
      for (const key of keys) {
        evaluationDetails.push(await client.getValueDetailsAsync(key, false));
      }

      assert.equal(evaluationDetails.length, flagEvaluatedEvents.length);
      assert.deepEqual(evaluationDetails, flagEvaluatedEvents);

      // 5. Client gets disposed
      client.dispose();

      assert.equal(expectedClientReadyEventCount, clientReadyEventCount);
      assert.equal(1, configChangedEvents.length);
      assert.equal(evaluationDetails.length, flagEvaluatedEvents.length);
      assert.equal(1, errorEvents.length);
    });
  }

  it("forceRefresh() should return failure including error in case of failed fetch", async () => {
    const errorMessage = "Something went wrong";
    const errorException = new Error(errorMessage);

    const configFetcher = new FakeConfigFetcherBase(null, 100, (lastConfig, lastETag) => { throw errorException; });
    const configCache = new FakeCache();
    const configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: "common", sdkVersion: "1.0.0" };
    const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, {}, configCache);

    const client = new ConfigCatClient(options, configCatKernel);

    const refreshResult = await client.forceRefreshAsync();

    assert.isFalse(refreshResult.isSuccess);
    assert.isString(refreshResult.errorMessage);
    assert.strictEqual(refreshResult.errorException, errorException);
  });

  it("forceRefresh() should return failure including error in case of unexpected exception", async () => {
    const errorMessage = "Something went wrong";
    const errorException = new Error(errorMessage);

    const configFetcher = new FakeConfigFetcherBase(null, 100, (lastConfig, lastETag) => { throw errorException; });
    const configCache = new FakeCache();
    const configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: "common", sdkVersion: "1.0.0" };
    const options = new ManualPollOptions("APIKEY", configCatKernel.sdkType, configCatKernel.sdkType, {}, configCache);

    const client = new ConfigCatClient(options, configCatKernel);

    client["configService"] = new class implements IConfigService {
      getConfig(): Promise<ProjectConfig | null> { return Promise.resolve(null); }
      refreshConfigAsync(): Promise<[RefreshResult, ProjectConfig | null]> { throw errorException; }
      get isOffline(): boolean { return false; }
      setOnline(): void { }
      setOffline(): void { }
      dispose(): void { }
    };

    const refreshResult = await client.forceRefreshAsync();

    assert.isFalse(refreshResult.isSuccess);
    expect(refreshResult.errorMessage).to.include(errorMessage);
    assert.strictEqual(refreshResult.errorException, errorException);
  });
});
