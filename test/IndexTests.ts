import { assert } from "chai";
import "mocha";
import type { IConfigCatClient } from "../src/ConfigCatClient";
import * as configcatClient from "../src/index";
import type { FakeConfigCatKernel } from "./helpers/fakes";
import { FakeConfigFetcher } from "./helpers/fakes";

describe("ConfigCatClient index (main)", () => {

  it("createClientWithAutoPoll ShouldCreateInstance", () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const client: IConfigCatClient = configcatClient.createClientWithAutoPoll("APIKEY", configCatKernel);

    assert.isDefined(client);
  });

  it("createClientWithLazyLoad ShouldCreateInstance", () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const client: IConfigCatClient = configcatClient.createClientWithLazyLoad("APIKEY", configCatKernel);

    assert.isDefined(client);
  });

  it("createClientWithManualPoll ShouldCreateInstance", () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const client: IConfigCatClient = configcatClient.createClientWithManualPoll("APIKEY", configCatKernel);

    assert.isDefined(client);
  });
});
