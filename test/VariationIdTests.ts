import { assert } from "chai";
import "mocha";
import { ConfigCatClient, IConfigCatClient } from "../src/ConfigCatClient";
import { AutoPollOptions } from "../src/ConfigCatClientOptions";
import { IEvaluationDetails } from "../src/RolloutEvaluator";
import { FakeConfigCatKernel, FakeConfigFetcherWithNullNewConfig, FakeConfigFetcherWithTwoKeys, FakeConfigFetcherWithTwoKeysAndRules } from "./helpers/fakes";

describe("ConfigCatClient", () => {
    it("getVariationId() works", (done) => {

        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeys(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
        assert.isDefined(client);

        client.getVariationId('debug', 'N/A', (variationId) => {
            assert.equal(variationId, 'abcdefgh');

            client.getVariationId('debug2', 'N/A', (variationId) => {
                assert.equal(variationId, '12345678');

                client.getVariationId('notexists', 'N/A', (variationId) => {
                    assert.equal(variationId, 'N/A');

                    client.getVariationId('notexists2', 'N/A', (variationId) => {
                        assert.equal(variationId, 'N/A');

                        done();
                    });
                });
            });
        });
    });

    it("getVariationIdAsync() works", async () => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeys(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
        assert.isDefined(client);

        const flagEvaluatedEvents: IEvaluationDetails[] = [];
        client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

        assert.equal(await client.getVariationIdAsync('debug', 'N/A'), 'abcdefgh');
        assert.equal(await client.getVariationIdAsync('debug2', 'N/A'), '12345678');
        assert.equal(await client.getVariationIdAsync('notexists', 'N/A'), 'N/A');
        assert.equal(await client.getVariationIdAsync('notexists2', 'N/A'), 'N/A');

        assert.equal(4, flagEvaluatedEvents.length);
        assert.strictEqual('abcdefgh', flagEvaluatedEvents[0].variationId);
        assert.strictEqual('12345678', flagEvaluatedEvents[1].variationId);
        assert.strictEqual('N/A', flagEvaluatedEvents[2].variationId);
        assert.strictEqual('N/A', flagEvaluatedEvents[3].variationId);
    });

    it("getAllVariationIds() works", (done) => {

        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeys(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
        assert.isDefined(client);

        client.getAllVariationIds((variationIds) => {
            assert.equal(variationIds.length, 2);
            assert.equal(variationIds[0], 'abcdefgh');
            assert.equal(variationIds[1], '12345678');
            done();
        });
    });

    it("getAllVariationIdsAsync() works", async () => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeys(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
        assert.isDefined(client);

        const flagEvaluatedEvents: IEvaluationDetails[] = [];
        client.on("flagEvaluated", ed => flagEvaluatedEvents.push(ed));

        const variationIds = await client.getAllVariationIdsAsync();
        assert.equal(variationIds.length, 2);
        assert.equal(variationIds[0], 'abcdefgh');
        assert.equal(variationIds[1], '12345678');

        assert.deepEqual(flagEvaluatedEvents.map(evt => evt.variationId), variationIds);
    });

    it("getKeyAndValue() works with default", (done) => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        client.getKeyAndValue("abcdefgh", (result) => {
            assert.equal(result?.settingKey, "debug");
            assert.equal(result?.settingValue, "def");
            done();
        });
    });

    it("getKeyAndValueAsync() works with default", async () => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        let result = await client.getKeyAndValueAsync("abcdefgh");
        assert.equal(result?.settingKey, "debug");
        assert.equal(result?.settingValue, "def");
    });

    it("getKeyAndValue() works with rollout rules", (done) => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        client.getKeyAndValue("6ada5ff2", (result) => {
            assert.equal(result?.settingKey, "debug");
            assert.equal(result?.settingValue, "value");
            done();
        });
    });

    it("getKeyAndValueAsync() works with rollout rules", async () => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        let result = await client.getKeyAndValueAsync("6ada5ff2");
        assert.equal(result?.settingKey, "debug");
        assert.equal(result?.settingValue, "value");
    });

    it("getKeyAndValue() works with percentage rules", (done) => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        client.getKeyAndValue("622f5d07", (result) => {
            assert.equal(result?.settingKey, "debug2");
            assert.equal(result?.settingValue, "value2");
            done();
        });
    });

    it("getKeyAndValueAsync() works with percentage rules", async () => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        let result = await client.getKeyAndValueAsync("622f5d07");
        assert.equal(result?.settingKey, "debug2");
        assert.equal(result?.settingValue, "value2");
    });

    it("getKeyAndValueAsync() with null config", async () => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithNullNewConfig(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null, maxInitWaitTimeSeconds: 0 }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        let result = await client.getKeyAndValueAsync("622f5d07");
        assert.isNull(result);
    });

    it("getKeyAndValueAsync() with non-existing id", async () => {
        let configCatKernel: FakeConfigCatKernel = {
            configFetcher: new FakeConfigFetcherWithTwoKeysAndRules(),
            sdkType: "common",
            sdkVersion: "1.0.0"
        };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        let result = await client.getKeyAndValueAsync("non-exisiting");
        assert.isNull(result);
    });
});