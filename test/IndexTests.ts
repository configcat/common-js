import { assert } from "chai";
import "mocha";
import { PollingMode } from "../lib";
import { IConfigCatClient } from "../src/ConfigCatClient";
import * as configcatClient from "../src/index";
import { FakeConfigCatKernel, FakeConfigFetcher } from "./helpers/fakes";

describe("ConfigCatClient index (main)", () => {

  it("getClient ShouldCreateInstance - AutoPoll", () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const client: IConfigCatClient = configcatClient.getClient("APIKEY", PollingMode.AutoPoll, void 0, configCatKernel);

    try {
      assert.isDefined(client);
    }
    finally {
      client.dispose();
    }
  });

  it("getClient ShouldCreateInstance - LazyLoad", () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const client: IConfigCatClient = configcatClient.getClient("APIKEY", PollingMode.LazyLoad, void 0, configCatKernel);

    try {
      assert.isDefined(client);
    }
    finally {
      client.dispose();
    }
  });

  it("getClient ShouldCreateInstance - ManualPoll", () => {

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const client: IConfigCatClient = configcatClient.getClient("APIKEY", PollingMode.ManualPoll, void 0, configCatKernel);

    try {
      assert.isDefined(client);
    }
    finally {
      client.dispose();
    }
  });
});
