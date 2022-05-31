import { ConfigCatClient, IConfigCatClient } from "../src/ConfigCatClient";
import { assert } from "chai";
import "mocha";
import { IConfigFetcher, IConfigCatKernel, ICache, FetchResult } from "../src/.";
import { ProjectConfig } from "../src/ProjectConfig";
import { ManualPollOptions, AutoPollOptions, LazyLoadOptions, OptionsBase } from "../src/ConfigCatClientOptions";
import { User } from "../src/RolloutEvaluator";

describe("ConfigCatClient", () => {
  it("Initialization With AutoPollOptions should create an instance, getValue works", (done) => {
    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(true, value);

      client.getValue("debug", false, function (value) {
        assert.equal(true, value);

        client.forceRefresh(function () {
          client.getValue("debug", false, function (value) {
            assert.equal(true, value);

            client.getValue("debug", false, function (value) {
              assert.equal(true, value);

              client.getValue("NOT_EXISTS", false, function (value) {
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
    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    await client.forceRefreshAsync();
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(false, await client.getValueAsync("NOT_EXISTS", false, new User("identifier")));
  });

  it("Initialization With LazyLoadOptions should create an instance, getValue works", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(true, value);

      client.getValue("debug", false, function (value) {
        assert.equal(true, value);

        client.getValue("NOT_EXISTS", false, function (value) {
          assert.equal(false, value);

          client.forceRefresh(function () {
            client.getValue("debug", false, function (value) {
              assert.equal(true, value);
              done();
            }, new User("identifier"));
          });
        }, new User("identifier"));
      }, new User("identifier"));
    }, new User("identifier"));
  });

  it("Initialization With LazyLoadOptions should create an instance, getValueAsync works", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(false, await client.getValueAsync("NOT_EXISTS", false, new User("identifier")));
    await client.forceRefreshAsync();
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
  });

  it("Initialization With ManualPollOptions should create an instance, getValue works", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(false, value);

      client.getValue("debug", false, function (value) {
        assert.equal(false, value);

        client.forceRefresh(function () {
          client.getValue("debug", false, function (value) {
            assert.equal(true, value);

            client.getValue("debug", false, function (value) {
              assert.equal(true, value);

              client.getValue("NOT_EXISTS", false, function (value) {
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

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    assert.equal(false, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(false, await client.getValueAsync("debug", false, new User("identifier")));
    await client.forceRefreshAsync();
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(true, await client.getValueAsync("debug", false, new User("identifier")));
    assert.equal(false, await client.getValueAsync("NOT_EXISTS", false, new User("identifier")));
  });

  it("Initialization With ManualPollOptions should create an instance", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    client.forceRefresh(() => {
      client.getValue("debug", false, function (value) {
        assert.equal(true, value);
        done();
      });
    })
  });

  it("Initialization With AutoPollOptions should create an instance", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(true, value);
      done();
    });
  });

  it("Initialization With LazyLoadOptions should create an instance", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(false, value);
      done();
    });
  });

  it("getValue() works without userObject", (done) => {
    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(value, true);
      done();
    });
  });

  it("getValueAsync() works without userObject", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    const value = await client.getValueAsync("debug", true);
    assert.equal(true, value);
  });

  it("getAllKeys() works", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    client.getAllKeys(function (keys) {
      assert.equal(keys.length, 2);
      assert.equal(keys[0], 'debug');
      assert.equal(keys[1], 'debug2');
      done();
    });
  });

  it("getAllKeysAsync() works", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    const keys = await client.getAllKeysAsync();
    assert.equal(keys.length, 2);
    assert.equal(keys[0], 'debug');
    assert.equal(keys[1], 'debug2');
  });

  it("getAllKeys() works - without config", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null, maxInitWaitTimeSeconds: 0 }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    client.getAllKeys(function (keys) {
      assert.equal(keys.length, 0);
      done();
    });
  });

  it("getAllKeysAsync() works - without config", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null, maxInitWaitTimeSeconds: 0 }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    const keys = await client.getAllKeysAsync();
    assert.equal(keys.length, 0);
  });

  it("Initialization With AutoPollOptions - config changed in every fetch - should fire configChanged every polling iteration", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithAlwaysVariableEtag(), sdkType: 'common', sdkVersion: '1.0.0' };
    let counter: number = 0;
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null, pollIntervalSeconds: 1, configChanged: () => { counter++; } }, null);
    new ConfigCatClient(options, configCatKernel);

    function act(): Promise<boolean> {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(true);
        }, 3000);
      });
    }

    await act();

    assert.equal(counter, 3);
  });

  it("Initialization With AutoPollOptions - with maxInitWaitTimeSeconds - getValueAsync should wait", async () => {

    const maxInitWaitTimeSeconds: number = 2;

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(500), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: maxInitWaitTimeSeconds }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    var startDate: number = new Date().getTime();
    var actualValue = await client.getValueAsync("debug", false);
    var ellapsedMilliseconds: number = new Date().getTime() - startDate;

    assert.isAtLeast(ellapsedMilliseconds, 500);
    assert.isAtMost(ellapsedMilliseconds, maxInitWaitTimeSeconds * 1000);
    assert.equal(actualValue, true);
  });

  it("Initialization With AutoPollOptions - with maxInitWaitTimeSeconds - getValueAsync should wait for maxInitWaitTimeSeconds only and return default value", async () => {

    const maxInitWaitTimeSeconds: number = 1;

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { maxInitWaitTimeSeconds: maxInitWaitTimeSeconds }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    var startDate: number = new Date().getTime();
    var actualValue = await client.getValueAsync("debug", false);
    var ellapsedMilliseconds: number = new Date().getTime() - startDate;

    assert.isAtLeast(ellapsedMilliseconds, maxInitWaitTimeSeconds);
    assert.isAtMost(ellapsedMilliseconds, (maxInitWaitTimeSeconds * 1000) + 50); // 50 ms for tolerance
    assert.equal(actualValue, false);
  });

  it("getValueAsync - User.Identifier is an empty string - should return evaluated value", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const user: User = new User('');

    var actual = await client.getValueAsync("debug2", "N/A", user);

    assert.equal(actual, "value2");
  });

  it("getValueAsync - User.Identifier can be non empty string - should return evaluated value", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const user: User = new User('userId');

    var actual = await client.getValueAsync("debug2", "N/A", user);

    assert.equal(actual, "value1");
  });

  it("getValueAsync - case sensitive key tests", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoCaseSensitiveKeys(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    var actual = await client.getValueAsync("debug", "N/A");

    assert.equal(actual, "debug");
    assert.notEqual(actual, "DEBUG");

    actual = await client.getValueAsync("DEBUG", "N/A");

    assert.notEqual(actual, "debug");
    assert.equal(actual, "DEBUG");
  });

  it("getValueAsync - case sensitive attribute tests", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoCaseSensitiveKeys(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    let user: User = new User('', undefined, undefined, { "CUSTOM": "c" })
    let actual = await client.getValueAsync("debug", "N/A", user);

    assert.equal(actual, "UPPER-VALUE");

    user = new User('', undefined, undefined, { "custom": "c" })
    actual = await client.getValueAsync("debug", "N/A", user);

    assert.equal(actual, "lower-value");

    user = new User('', undefined, undefined, { "custom": "c", "CUSTOM": "c" })
    actual = await client.getValueAsync("debug", "N/A", user);

    assert.equal(actual, "UPPER-VALUE");
  });

  it("getAllValuesAsync - works", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    let actual = await client.getAllValuesAsync();

    assert.equal(actual.length, 2);
  });

  it("getAllValues - works", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", {}, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    client.getAllValues(actual => {
      assert.equal(actual.length, 2);
      done();
    });
  });

  it("getAllValuesAsync - without config - return empty array", async () => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null, maxInitWaitTimeSeconds: 0 }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    let actual = await client.getAllValuesAsync();

    assert.isDefined(actual);
    assert.equal(actual.length, 0);
  });


  it("Initialization With LazyLoadOptions - multiple getValueAsync should not cause multiple config fetches", async () => {

    let configFetcher = new FakeConfigFetcher(500);
    let configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: 'common', sdkVersion: '1.0.0' };
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0");
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    await Promise.all([client.getValueAsync("debug", false), client.getValueAsync("debug", false)]);
    assert.equal(1, configFetcher.calledTimes);
  });

  it("Initialization With LazyLoadOptions - multiple getValue calls should not cause multiple config fetches", done => {

    let configFetcher = new FakeConfigFetcher(500);
    let configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: 'common', sdkVersion: '1.0.0' };
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", "common", "1.0.0");
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

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

    let configFetcher = new FakeConfigFetcher(500);
    let configCache = new FakeCache(new ProjectConfig(new Date().getTime() - 10000000, "{\"f\": { \"debug\": { \"v\": false, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }", "etag2"))
    let configCatKernel: FakeConfigCatKernel = { configFetcher, cache: configCache, sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { cache: configCache, maxInitWaitTimeSeconds: 10 });
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    client.getValue("debug", false, value => {
      done(value == true ? null : new Error("Wrong value."));
    });
  });

  it("Initialization With AutoPollOptions with expired cache - getValueAsync should take care of maxInitWaitTimeSeconds", async () => {

    let configFetcher = new FakeConfigFetcher(500);
    let configCache = new FakeCache(new ProjectConfig(new Date().getTime() - 10000000, "{\"f\": { \"debug\": { \"v\": false, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }", "etag2"))
    let configCatKernel: FakeConfigCatKernel = { configFetcher, cache: configCache, sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { cache: configCache, maxInitWaitTimeSeconds: 10 });
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const value = await client.getValueAsync("debug", false);
    assert.isTrue(value);
  });

  it("Dispose should stop the client in every scenario", done => {

    let configFetcher = new FakeConfigFetcher(500);
    let configCatKernel: FakeConfigCatKernel = { configFetcher, sdkType: 'common', sdkVersion: '1.0.0' };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { pollIntervalSeconds: 2 });
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    client.dispose();
    assert.equal(configFetcher.calledTimes, 0);
    setTimeout(() => {
      assert.equal(configFetcher.calledTimes, 1);
      done();
    }, 4000);
  });
});

export class FakeConfigFetcherBase implements IConfigFetcher {
  calledTimes = 0;

  constructor(private config: string | null, private callbackDelay: number = 0) {
  }

  fetchLogic(options: OptionsBase, lastEtag: string, callback: (result: FetchResult) => void): void {
    if (callback) {
      setTimeout(() => {
        this.calledTimes++;
        callback(this.config === null ? FetchResult.error() : FetchResult.success(this.config, this.getEtag()));
      }, this.callbackDelay);
    }
  }

  protected getEtag(): string {
    return "etag";
  }
}

export class FakeConfigFetcher extends FakeConfigFetcherBase {
  constructor(private callbackDelayInMilliseconds: number = 0) {
    super("{\"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }", callbackDelayInMilliseconds);
  }
}

export class FakeConfigFetcherWithTwoKeys extends FakeConfigFetcherBase {
  constructor() {
    super("{\"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] }, \"debug2\": { \"v\": true, \"i\": \"12345678\", \"t\": 0, \"p\": [], \"r\": [] } } }");
  }
}

export class FakeConfigFetcherWithTwoCaseSensitiveKeys extends FakeConfigFetcherBase {
  constructor() {
    super("{\"f\": { \"debug\": { \"v\": \"debug\", \"i\": \"abcdefgh\", \"t\": 1, \"p\": [], \"r\": [{ \"o\":0, \"a\":\"CUSTOM\", \"t\":0, \"c\":\"c\", \"v\":\"UPPER-VALUE\", \"i\":\"6ada5ff2\"}, { \"o\":1, \"a\":\"custom\", \"t\":0, \"c\":\"c\", \"v\":\"lower-value\", \"i\":\"6ada5ff2\"}] }, \"DEBUG\": { \"v\": \"DEBUG\", \"i\": \"12345678\", \"t\": 1, \"p\": [], \"r\": [] } } }");
  }
}

export class FakeConfigFetcherWithTwoKeysAndRules extends FakeConfigFetcherBase {
  constructor() {
    super("{\"f\": { \"debug\": { \"v\": \"def\", \"i\": \"abcdefgh\", \"t\": 1, \"p\": [], \"r\": [{ \"o\":0, \"a\":\"a\", \"t\":1, \"c\":\"abcd\", \"v\":\"value\", \"i\":\"6ada5ff2\"}] }, \"debug2\": { \"v\": \"def\", \"i\": \"12345678\", \"t\": 1, \"p\": [{\"o\":0, \"v\":\"value1\", \"p\":50, \"i\":\"d227b334\" }, { \"o\":1, \"v\":\"value2\", \"p\":50, \"i\":\"622f5d07\" }], \"r\": [] } } }");
  }
}

export class FakeConfigFetcherWithNullNewConfig extends FakeConfigFetcherBase {
  constructor() {
    super(null);
  }
}

export class FakeConfigFetcherWithAlwaysVariableEtag extends FakeConfigFetcherBase {
  constructor() {
    super("{ \"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } }}");
  }

  getEtag(): string {
    return Math.random().toString();
  }
}

export class FakeConfigFetcherWithPercantageRules extends FakeConfigFetcherBase {
  constructor() {
    super("{\"f\":{\"string25Cat25Dog25Falcon25Horse\":{\"v\":\"Chicken\",\"t\":1,\"p\":[{\"o\":0,\"v\":\"Cat\",\"p\":25},{\"o\":1,\"v\":\"Dog\",\"p\":25},{\"o\":2,\"v\":\"Falcon\",\"p\":25},{\"o\":3,\"v\":\"Horse\",\"p\":25}],\"r\":[]}}}");
  }
}

export class FakeConfigCatKernel implements IConfigCatKernel {
  cache?: ICache;
  configFetcher!: IConfigFetcher;
  sdkType = "common";
  sdkVersion = "1.0.0";
}

export class FakeCache implements ICache {
  cached: ProjectConfig;
  constructor(cached: ProjectConfig) {
    this.cached = cached;
  }
  set(key: string, config: ProjectConfig): void | Promise<void> {
    this.cached = config;
  }
  get(key: string): ProjectConfig | Promise<ProjectConfig> {
    return this.cached;
  }
}
