import { ConfigCatClient, IConfigCatClient } from "../src/ConfigCatClient";
import { assert, expect } from "chai";
import "mocha";
import { ManualPollOptions, AutoPollOptions, LazyLoadOptions, OptionsBase } from "../src/ConfigCatClientOptions";
import { InMemoryCache } from "../src/Cache";
import { FakeConfigCatKernel, FakeConfigFetcherWithTwoKeys } from "./ConfigCatClientTests";

describe("ConfigCatClient", () => {
    it("getVariationId() works", (done) => {

        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), cache: new InMemoryCache() };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
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
        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), cache: new InMemoryCache() };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
        assert.isDefined(client);

        assert.equal(await client.getVariationIdAsync('debug', 'N/A'), 'abcdefgh');
        assert.equal(await client.getVariationIdAsync('debug2', 'N/A'), '12345678');
        assert.equal(await client.getVariationIdAsync('notexists', 'N/A'), 'N/A');
        assert.equal(await client.getVariationIdAsync('notexists2', 'N/A'), 'N/A');
    });

    it("getAllVariationIds() works", (done) => {

        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), cache: new InMemoryCache() };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
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
        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), cache: new InMemoryCache() };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
        assert.isDefined(client);

        const variationIds = await client.getAllVariationIdsAsync();
        assert.equal(variationIds.length, 2);
        assert.equal(variationIds[0], 'abcdefgh');
        assert.equal(variationIds[1], '12345678');
    });
});