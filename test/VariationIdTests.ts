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
            assert.equal(variationId, 'debug-true');

            client.getVariationId('debug2', 'N/A', (variationId) => {
                assert.equal(variationId, 'debug2-true');

                client.getVariationId('notexists', 'N/A', (variationId) => {
                    assert.equal(variationId, 'notexists-08d2e98e6754af941484848930ccbaddfefe13d6');

                    client.getVariationId('notexists2', 'N/A', (variationId) => {
                        assert.equal(variationId, 'notexists2-08d2e98e6754af941484848930ccbaddfefe13d6');

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

        assert.equal(await client.getVariationIdAsync('debug', 'N/A'), 'debug-true');
        assert.equal(await client.getVariationIdAsync('debug2', 'N/A'), 'debug2-true');
        assert.equal(await client.getVariationIdAsync('notexists', 'N/A'), 'notexists-08d2e98e6754af941484848930ccbaddfefe13d6');
        assert.equal(await client.getVariationIdAsync('notexists2', 'N/A'), 'notexists2-08d2e98e6754af941484848930ccbaddfefe13d6');
    });

    it("getAllVariationIds() works", (done) => {

        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), cache: new InMemoryCache() };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
        assert.isDefined(client);

        client.getAllVariationIds((variationIds) => {
            assert.equal(variationIds, 'debug-true,debug2-true');
            done();
        });
    });

    it("getAllVariationIdsAsync() works", async () => {
        let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherWithTwoKeys(), cache: new InMemoryCache() };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", { logger: null })
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);
        assert.isDefined(client);

        assert.equal(await client.getAllVariationIdsAsync(), 'debug-true,debug2-true');
    });
});