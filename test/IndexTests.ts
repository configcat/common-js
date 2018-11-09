import { assert } from "chai";
import "mocha";
import * as configcatClient from "../src/index";
import { IConfigCatClient } from "../src/ConfigCatClient";
import { FakeConfigFetcher, FakeConfigCatKernel } from "./ConfigCatClientTests";
import { InMemoryCache } from "../src/Cache";

describe("ConfigCatClient index (main)", () => {

    it("createClientWithAutoPoll ShouldCreateInstance", () => {

        var client: IConfigCatClient = configcatClient.createClientWithAutoPoll("APIKEY", new FakeConfigCatKernel() );

        assert.isDefined(client);
    });

    it("createClientWithLazyLoad ShouldCreateInstance", () => {

        var client: IConfigCatClient = configcatClient.createClientWithLazyLoad("APIKEY", new FakeConfigCatKernel() );

        assert.isDefined(client);
    });

    it("createClientWithManualPoll ShouldCreateInstance", () => {

        var client: IConfigCatClient = configcatClient.createClientWithManualPoll("APIKEY", new FakeConfigCatKernel() );

        assert.isDefined(client);
    });
});