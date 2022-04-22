import { assert } from "chai";
import "mocha";
import * as configcatClient from "../src/index";
import { IConfigCatClient } from "../src/ConfigCatClient";
import { FakeConfigFetcher, FakeConfigCatKernel } from "./ConfigCatClientTests";

describe("ConfigCatClient index (main)", () => {

    it("createClientWithAutoPoll ShouldCreateOnlyOneInstance", async () => {

        const configFetcher1 = new FakeConfigFetcher();
        var client1: IConfigCatClient = configcatClient.createClientWithAutoPoll("AUTOPOLL_SINGLETON_SDKYKEY_1", {configFetcher: configFetcher1 });
        const configFetcher2 = new FakeConfigFetcher();
        var client2: IConfigCatClient = configcatClient.createClientWithAutoPoll("AUTOPOLL_SINGLETON_SDKYKEY_1", {configFetcher: configFetcher2 });
        const configFetcher3 = new FakeConfigFetcher();
        var client3: IConfigCatClient = configcatClient.createClientWithAutoPoll("AUTOPOLL_SINGLETON_SDKYKEY_2", {configFetcher: configFetcher3 });

        await client1.forceRefreshAsync();
        await client2.forceRefreshAsync();
        await client3.forceRefreshAsync();

        assert.isAtLeast(configFetcher1.calledTimes, 1, 'configFetcher1 calledTimes should be at least 1');
        assert.equal(configFetcher2.calledTimes, 0, 'configFetcher2 calledTimes should be 0');
        assert.isAtLeast(configFetcher3.calledTimes, 1, 'configFetcher3 calledTimes should be at least 1');
    });

    it("createClientWithManualPoll ShouldCreateOnlyOneInstance", async () => {

        const configFetcher1 = new FakeConfigFetcher();
        var client1: IConfigCatClient = configcatClient.createClientWithManualPoll("MANULPOLL_SINGLETON_SDKYKEY_1", {configFetcher: configFetcher1 });
        const configFetcher2 = new FakeConfigFetcher();
        var client2: IConfigCatClient = configcatClient.createClientWithManualPoll("MANULPOLL_SINGLETON_SDKYKEY_1", {configFetcher: configFetcher2 });
        const configFetcher3 = new FakeConfigFetcher();
        var client3: IConfigCatClient = configcatClient.createClientWithManualPoll("MANULPOLL_SINGLETON_SDKYKEY_2", {configFetcher: configFetcher3 });

        await client1.forceRefreshAsync();
        await client2.forceRefreshAsync();
        await client3.forceRefreshAsync();

        assert.isAtLeast(configFetcher1.calledTimes, 1, 'configFetcher1 calledTimes should be at least 1');
        assert.equal(configFetcher2.calledTimes, 0, 'configFetcher2 calledTimes should be 0');
        assert.isAtLeast(configFetcher3.calledTimes, 1, 'configFetcher3 calledTimes should be at least 1');
    });

    it("createClientWithLazyLoad ShouldCreateOnlyOneInstance", async () => {

        const configFetcher1 = new FakeConfigFetcher();
        var client1: IConfigCatClient = configcatClient.createClientWithLazyLoad("LAZYLOAD_SINGLETON_SDKYKEY_1", {configFetcher: configFetcher1 });
        const configFetcher2 = new FakeConfigFetcher();
        var client2: IConfigCatClient = configcatClient.createClientWithLazyLoad("LAZYLOAD_SINGLETON_SDKYKEY_1", {configFetcher: configFetcher2 });
        const configFetcher3 = new FakeConfigFetcher();
        var client3: IConfigCatClient = configcatClient.createClientWithLazyLoad("LAZYLOAD_SINGLETON_SDKYKEY_2", {configFetcher: configFetcher3 });

        await client1.forceRefreshAsync();
        await client2.forceRefreshAsync();
        await client3.forceRefreshAsync();

        assert.isAtLeast(configFetcher1.calledTimes, 1, 'configFetcher1 calledTimes should be at least 1');
        assert.equal(configFetcher2.calledTimes, 0, 'configFetcher2 calledTimes should be 0');
        assert.isAtLeast(configFetcher3.calledTimes, 1, 'configFetcher3 calledTimes should be at least 1');
    });
});