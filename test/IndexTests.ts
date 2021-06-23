import { assert } from "chai";
import "mocha";
import * as configcatClient from "../src/index";
import { IConfigCatClient } from "../src/ConfigCatClient";
import { FakeConfigFetcher, FakeConfigCatKernel } from "./ConfigCatClientTests";
import { InMemoryCache } from "../src/Cache";

describe("ConfigCatClient index (main)", () => {

    it("createClientWithAutoPoll ShouldCreateInstance", () => {

        let configCatKernel: FakeConfigCatKernel = {configFetcher: new FakeConfigFetcher() };
        var client: IConfigCatClient = configcatClient.createClientWithAutoPoll("SDKKEY", configCatKernel);

        assert.isDefined(client);
    });

    it("createClientWithLazyLoad ShouldCreateInstance", () => {

        let configCatKernel: FakeConfigCatKernel = {configFetcher: new FakeConfigFetcher() };
        var client: IConfigCatClient = configcatClient.createClientWithLazyLoad("SDKKEY", configCatKernel);

        assert.isDefined(client);
    });

    it("createClientWithManualPoll ShouldCreateInstance", () => {

        let configCatKernel: FakeConfigCatKernel = {configFetcher: new FakeConfigFetcher() };
        var client: IConfigCatClient = configcatClient.createClientWithManualPoll("SDKKEY", configCatKernel);

        assert.isDefined(client);
    });
});