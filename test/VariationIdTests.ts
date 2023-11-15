import { assert } from "chai";
import "mocha";
import { ConfigCatClient, IConfigCatClient } from "../src/ConfigCatClient";
import { AutoPollOptions } from "../src/ConfigCatClientOptions";
import { FakeConfigCatKernel, FakeConfigFetcherWithNullNewConfig, FakeConfigFetcherWithPercentageOptionsWithinTargetingRule, FakeConfigFetcherWithTwoKeysAndRules } from "./helpers/fakes";

describe("ConfigCatClient", () => {
  it("getKeyAndValueAsync() works with default", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const result = await client.getKeyAndValueAsync("abcdefgh");
    assert.equal(result?.settingKey, "debug");
    assert.equal(result?.settingValue, "def");
  });

  it("getKeyAndValueAsync() works with rollout rules", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const result = await client.getKeyAndValueAsync("6ada5ff2");
    assert.equal(result?.settingKey, "debug");
    assert.equal(result?.settingValue, "value");
  });

  it("getKeyAndValueAsync() works with percentage options", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const result = await client.getKeyAndValueAsync("622f5d07");
    assert.equal(result?.settingKey, "debug2");
    assert.equal(result?.settingValue, "value2");
  });

  it("getKeyAndValueAsync() works with percentage options within targeting rule", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherWithPercentageOptionsWithinTargetingRule(),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const result = await client.getKeyAndValueAsync("622f5d07");
    assert.equal(result?.settingKey, "debug");
    assert.equal(result?.settingValue, "value2");
  });

  it("getKeyAndValueAsync() with null config", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherWithNullNewConfig(),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null, maxInitWaitTimeSeconds: 0 }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const result = await client.getKeyAndValueAsync("622f5d07");
    assert.isNull(result);
  });

  it("getKeyAndValueAsync() with non-existing id", async () => {
    const configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    const options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    const client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    const result = await client.getKeyAndValueAsync("non-exisiting");
    assert.isNull(result);
  });
});
