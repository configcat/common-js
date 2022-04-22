import { assert } from "chai";
import "mocha";
import * as configcatClient from "../src/index";
import { IConfigCatClient } from "../src/ConfigCatClient";
import { FakeConfigFetcher, FakeConfigCatKernel } from "./ConfigCatClientTests";

describe("ConfigCatClient index (main)", () => {

    it("createClientWithAutoPoll ShouldCreateOnlyOneInstance", async (resolve) => {

        const configFetcher1 = new FakeConfigFetcher();
        var client1: IConfigCatClient = configcatClient.createClientWithAutoPoll("AUTOPOLL_SINGLETON_SDKYKEY_1", {configFetcher: configFetcher1 });
        const configFetcher2 = new FakeConfigFetcher();
        var client2: IConfigCatClient = configcatClient.createClientWithAutoPoll("AUTOPOLL_SINGLETON_SDKYKEY_1", {configFetcher: configFetcher1 });
        const configFetcher3 = new FakeConfigFetcher();
        var client3: IConfigCatClient = configcatClient.createClientWithAutoPoll("AUTOPOLL_SINGLETON_SDKYKEY_2", {configFetcher: configFetcher1 });
        
        await client1.forceRefreshAsync();
        await client2.forceRefreshAsync();
        await client3.forceRefreshAsync();

        assert.isAtLeast(configFetcher1.calledTimes, 1);
        assert.equal(configFetcher2.calledTimes, 0);
        assert.isAtLeast(configFetcher3.calledTimes, 1);
        resolve();
    });
});