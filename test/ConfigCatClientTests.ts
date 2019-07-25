import { ConfigCatClient, IConfigCatClient } from "../src/ConfigCatClient";
import { assert, expect } from "chai";
import "mocha";
import { IConfigFetcher, IConfigCatKernel, ICache } from "../src/.";
import { ProjectConfig } from "../src/ConfigServiceBase";
import { ManualPollOptions, AutoPollOptions, LazyLoadOptions, OptionsBase } from "../src/ConfigCatClientOptions";
import { InMemoryCache } from "../src/Cache";
import { User } from "../src/RolloutEvaluator";
import { doesNotReject } from "assert";

describe("ConfigCatClient", () => {
  it("Initialization With NULL 'apiKey' ShouldThrowError", () => {

    expect(() => {
      let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache() };
      let options: ManualPollOptions = new ManualPollOptions(null, null)
      let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    }).to.throw("Invalid 'apiKey' value");
  });

  it("Initialization With NULL 'configuration' ShouldThrowError", () => {

    expect(() => {
      let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache() };
      let client: IConfigCatClient = new ConfigCatClient(null, configCatKernel);
    }).to.throw("Invalid 'options' value");
  });

  it("Initialization With NULL 'configCatKernel' ShouldThrowError", () => {

    expect(() => {
      let options: ManualPollOptions = new ManualPollOptions("APIKEY", { logger: null })
      let client: IConfigCatClient = new ConfigCatClient(options, null);
    }).to.throw("Invalid 'configCatKernel' value");
  });

  it("Initialization With NULL 'configCatKernel' ShouldThrowError", () => {

    expect(() => {
      let options: ManualPollOptions = new ManualPollOptions("APIKEY", { logger: null })
      let client: IConfigCatClient = new ConfigCatClient(options, { configFetcher: null, cache: new InMemoryCache() });
    }).to.throw("Invalid 'configCatKernel.configFetcher' value");
  });

  it("Initialization With NULL 'configCatKernel' ShouldThrowError", () => {

    expect(() => {
      let options: ManualPollOptions = new ManualPollOptions("APIKEY", { logger: null })
      let client: IConfigCatClient = new ConfigCatClient(options, { configFetcher: new FakeConfigFetcher(), cache: null });
    }).to.throw("Invalid 'configCatKernel.cache' value");
  });

  it("Initialization With AutoPollOptions should create an instance, GetValue works", (done) => {
    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache() };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
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

  it("Initialization With LazyLoadOptions should create an instance", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache() };
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", { logger: null })
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

  it("Initialization With ManualPollOptions should create an instance", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), cache: new InMemoryCache() };
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", { logger: null })
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

  it("Initialization With ManualPollOptions should create an instance", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), cache: new InMemoryCache() };
    let options: ManualPollOptions = new ManualPollOptions("APIKEY", { logger: null })
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(false, value);
      done();
    });
  });

  it("Initialization With AutoPollOptions should create an instance", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), cache: new InMemoryCache() };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(false, value);
      done();
    });
  });

  it("Initialization With LazyLoadOptions should create an instance", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), cache: new InMemoryCache() };
    let options: LazyLoadOptions = new LazyLoadOptions("APIKEY", { logger: null })
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(false, value);
      done();
    });
  });

  it("ConfigCatClient.getValue works without optional user info", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), cache: new InMemoryCache() };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    let myUser = { identifier: "IDENTIFIER" };
    assert.isDefined(client);

    client.getValue("debug", false, function (value) {
      assert.equal(false, value);
      done();
    },
      myUser);
  });


  it("Get all keys works", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), cache: new InMemoryCache() };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    client.getAllKeys(function (keys) {
      assert.equal(keys.length, 2);
      assert.equal(keys[0], 'debug');
      assert.equal(keys[1], 'debug2');
      done();
    });
  });

  it("Get all keys works - without config", (done) => {

    let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithNullNewConfig(), cache: new InMemoryCache() };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
    assert.isDefined(client);
    client.getAllKeys(function (keys) {
      assert.equal(keys.length, 0);
      done();
    });
  });

});

export class FakeConfigFetcher implements IConfigFetcher {
  fetchLogic(options: OptionsBase, lastProjectConfig: ProjectConfig, callback: (newProjectConfig: ProjectConfig) => void): void {
    if (callback) {
      callback(new ProjectConfig(0, "{ \"debug\": { \"Value\": true, \"SettingType\": 0, \"RolloutPercentageItems\": [], \"RolloutRules\": [] } }", ""));
    }
  }
}


export class FakeConfigFetcherWithTwoKeys implements IConfigFetcher {
  fetchLogic(options: OptionsBase, lastProjectConfig: ProjectConfig, callback: (newProjectConfig: ProjectConfig) => void): void {
    if (callback) {
      callback(new ProjectConfig(0, "{ \"debug\": { \"Value\": true, \"SettingType\": 0, \"RolloutPercentageItems\": [], \"RolloutRules\": [] }, \"debug2\": { \"Value\": true, \"SettingType\": 0, \"RolloutPercentageItems\": [], \"RolloutRules\": [] } }", ""));
    }
  }
}

export class FakeConfigFetcherWithNullNewConfig implements IConfigFetcher {
  fetchLogic(options: OptionsBase, lastProjectConfig: ProjectConfig, callback: (newProjectConfig: ProjectConfig) => void): void {
    if (callback) {
      callback(null);
    }
  }
}

export class FakeConfigCatKernel implements IConfigCatKernel {
  configFetcher: IConfigFetcher;
  cache: ICache;
}