import { assert, expect } from "chai";
import "mocha";
import { IConfigCatClient } from "../src/ConfigCatClient";
import * as configcatClient from "../src/index";
import { FakeConfigCatKernel, FakeConfigFetcherWithRules } from "./helpers/fakes";

describe("DefaultUser", () => {

  it("Default user set works", async () => {
    const redEyeColorUser = { identifier: "redIdentifier", custom: { "eyeColor": "red" } };
    const blueEyeColorUser = { identifier: "blueIdentifier", custom: { "eyeColor": "blue" } };

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithRules(), sdkType: "common", sdkVersion: "1.0.0" };
    const client: IConfigCatClient = configcatClient.createClientWithAutoPoll("APIKEY", configCatKernel, { logger: configcatClient.createConsoleLogger(configcatClient.LogLevel.Debug) });

    // Without passing the userobject, default values/variationids should be returned
    let value = await client.getValueAsync("debug", "N/A");
    assert.equal(value, "defaultValue");
    let variationId = await client.getVariationIdAsync("debug", "N/A");
    assert.equal(variationId, "defaultVariationId");
    let values = await client.getAllValuesAsync();
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "defaultValue");
    let variationIds = await client.getAllVariationIdsAsync();
    assert.equal(variationIds[0], "defaultVariationId");

    // Passing directly the userobject to the functions, the rollout rules should work (red eyed case)
    value = await client.getValueAsync("debug", "N/A", redEyeColorUser);
    assert.equal(value, "redValue");
    variationId = await client.getVariationIdAsync("debug", "N/A", redEyeColorUser);
    assert.equal(variationId, "redVariationId");
    values = await client.getAllValuesAsync(redEyeColorUser);
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "redValue");
    variationIds = await client.getAllVariationIdsAsync(redEyeColorUser);
    assert.equal(variationIds[0], "redVariationId");

    // Passing directly the userobject to the functions, the rollout rules should work (blue eyed case)
    value = await client.getValueAsync("debug", "N/A", blueEyeColorUser);
    assert.equal(value, "blueValue");
    variationId = await client.getVariationIdAsync("debug", "N/A", blueEyeColorUser);
    assert.equal(variationId, "blueVariationId");
    values = await client.getAllValuesAsync(blueEyeColorUser);
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "blueValue");
    variationIds = await client.getAllVariationIdsAsync(blueEyeColorUser);
    assert.equal(variationIds[0], "blueVariationId");

    // Set the default user
    client.setDefaultUser(blueEyeColorUser);

    // Without user object, should evaluate based on the default user (blue-eyed default)
    value = await client.getValueAsync("debug", "N/A");
    assert.equal(value, "blueValue");
    variationId = await client.getVariationIdAsync("debug", "N/A");
    assert.equal(variationId, "blueVariationId");
    values = await client.getAllValuesAsync();
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "blueValue");
    variationIds = await client.getAllVariationIdsAsync();
    assert.equal(variationIds[0], "blueVariationId");

    // With passing directly the userobject, should evaluate based on the passed in user instead of the default user (red-eyed case)
    value = await client.getValueAsync("debug", "N/A", redEyeColorUser);
    assert.equal(value, "redValue");
    variationId = await client.getVariationIdAsync("debug", "N/A", redEyeColorUser);
    assert.equal(variationId, "redVariationId");
    values = await client.getAllValuesAsync(redEyeColorUser);
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "redValue");
    variationIds = await client.getAllVariationIdsAsync(redEyeColorUser);
    assert.equal(variationIds[0], "redVariationId");

    // After clearing the default user, default values should be returned again
    client.clearDefaultUser();

    value = await client.getValueAsync("debug", "N/A");
    assert.equal(value, "defaultValue");
    variationId = await client.getVariationIdAsync("debug", "N/A");
    assert.equal(variationId, "defaultVariationId");
    values = await client.getAllValuesAsync();
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "defaultValue");
    variationIds = await client.getAllVariationIdsAsync();
    assert.equal(variationIds[0], "defaultVariationId");
  });

  it("Default user set works with options", async () => {
    const redEyeColorUser = { identifier: "redIdentifier", custom: { "eyeColor": "red" } };
    const blueEyeColorUser = { identifier: "blueIdentifier", custom: { "eyeColor": "blue" } };

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithRules(), sdkType: "common", sdkVersion: "1.0.0" };
    const client: IConfigCatClient = configcatClient.createClientWithAutoPoll("APIKEY", configCatKernel, { logger: configcatClient.createConsoleLogger(configcatClient.LogLevel.Debug), defaultUser: redEyeColorUser });

    // Without passing the userobject, default user from the constructor should be returned
    let value = await client.getValueAsync("debug", "N/A", redEyeColorUser);
    assert.equal(value, "redValue");
    let variationId = await client.getVariationIdAsync("debug", "N/A", redEyeColorUser);
    assert.equal(variationId, "redVariationId");
    let values = await client.getAllValuesAsync(redEyeColorUser);
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "redValue");
    let variationIds = await client.getAllVariationIdsAsync(redEyeColorUser);
    assert.equal(variationIds[0], "redVariationId");

    // Passing directly the userobject to the functions, the rollout rules should work (blue eyed case)
    value = await client.getValueAsync("debug", "N/A", blueEyeColorUser);
    assert.equal(value, "blueValue");
    variationId = await client.getVariationIdAsync("debug", "N/A", blueEyeColorUser);
    assert.equal(variationId, "blueVariationId");
    values = await client.getAllValuesAsync(blueEyeColorUser);
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "blueValue");
    variationIds = await client.getAllVariationIdsAsync(blueEyeColorUser);
    assert.equal(variationIds[0], "blueVariationId");

    // Set the default user
    client.setDefaultUser(blueEyeColorUser);

    // Without user object, should evaluate based on the default user (blue-eyed default)
    value = await client.getValueAsync("debug", "N/A");
    assert.equal(value, "blueValue");
    variationId = await client.getVariationIdAsync("debug", "N/A");
    assert.equal(variationId, "blueVariationId");
    values = await client.getAllValuesAsync();
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "blueValue");
    variationIds = await client.getAllVariationIdsAsync();
    assert.equal(variationIds[0], "blueVariationId");

    // With passing directly the userobject, should evaluate based on the passed in user instead of the default user (red-eyed case)
    value = await client.getValueAsync("debug", "N/A", redEyeColorUser);
    assert.equal(value, "redValue");
    variationId = await client.getVariationIdAsync("debug", "N/A", redEyeColorUser);
    assert.equal(variationId, "redVariationId");
    values = await client.getAllValuesAsync(redEyeColorUser);
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "redValue");
    variationIds = await client.getAllVariationIdsAsync(redEyeColorUser);
    assert.equal(variationIds[0], "redVariationId");

    // After clearing the default user, default values should be returned again
    client.clearDefaultUser();

    value = await client.getValueAsync("debug", "N/A");
    assert.equal(value, "defaultValue");
    variationId = await client.getVariationIdAsync("debug", "N/A");
    assert.equal(variationId, "defaultVariationId");
    values = await client.getAllValuesAsync();
    assert.equal(values[0].settingKey, "debug");
    assert.equal(values[0].settingValue, "defaultValue");
    variationIds = await client.getAllVariationIdsAsync();
    assert.equal(variationIds[0], "defaultVariationId");
  });

});

