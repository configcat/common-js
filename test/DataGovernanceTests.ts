import { assert, expect } from "chai";
import "mocha";
import { ManualPollOptions, AutoPollOptions, LazyLoadOptions, OptionsBase, DataGovernance } from "../src/ConfigCatClientOptions";
import { IConfigCatLogger, IConfigFetcher, ProjectConfig } from "../src";
import { ConfigCatConsoleLogger } from "../src/ConfigCatLogger";
import { AutoPollConfigService } from "../src/AutoPollConfigService";
import { ConfigServiceBase } from "../src/ConfigServiceBase";
import { InMemoryCache } from "../src/Cache";


const globalUrl = "https://cdn-global.configcat.com";
const euOnlyUrl = "https://cdn-eu.configcat.com";
const customUrl = "https://cdn-custom.configcat.com";
const testObject = { test: "test" };

describe("DataGovernance", () => {

    it("sdk global, organization global", async () => {
        // In this case
        // the first invocation should call https://cdn-global.configcat.com
        // and the second should call https://cdn-global.configcat.com
        // without force redirects
        let configService = new FakeConfigServiceBase();
        configService.prepareResponse(globalUrl, globalUrl, 0, testObject);

        let config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(1);
        configService.validateCall(0, globalUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, globalUrl);
        configService.validateCall(1, globalUrl);
    });

    it("sdk euonly, organization global", async () => {
        // In this case
        // the first invocation should call https://cdn-eu.configcat.com
        // and the second should call https://cdn-global.configcat.com
        // without force redirects
        let configService = new FakeConfigServiceBase(DataGovernance.EuOnly);
        configService.prepareResponse(euOnlyUrl, globalUrl, 0, testObject);
        configService.prepareResponse(globalUrl, globalUrl, 0, testObject);

        let config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(1);
        configService.validateCall(0, euOnlyUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, euOnlyUrl);
        configService.validateCall(1, globalUrl);
    });


    it("sdk global, organization euonly", async () => {
        // In this case
        // the first invocation should call https://cdn-global.configcat.com
        // with an immediate redirect to https://cdn-eu.configcat.com
        // and the second should call https://cdn-eu.configcat.com

        let configService = new FakeConfigServiceBase(DataGovernance.Global);
        configService.prepareResponse(euOnlyUrl, euOnlyUrl, 0, testObject);
        configService.prepareResponse(globalUrl, euOnlyUrl, 1, null);

        let config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, globalUrl);
        configService.validateCall(1, euOnlyUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(3);
        configService.validateCall(0, globalUrl);
        configService.validateCall(1, euOnlyUrl);
        configService.validateCall(2, euOnlyUrl);
    });

    it("sdk euonly, organization euonly", async () => {
        // In this case
        // the first invocation should call https://cdn-eu.configcat.com
        // and the second should call https://cdn-eu.configcat.com
        // without redirects
        let configService = new FakeConfigServiceBase(DataGovernance.EuOnly);
        configService.prepareResponse(euOnlyUrl, euOnlyUrl, 0, testObject);

        let config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(1);
        configService.validateCall(0, euOnlyUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, euOnlyUrl);
        configService.validateCall(1, euOnlyUrl);
    });
});

export class FakeConfigFetcher implements IConfigFetcher {
    responses: { [url: string]: ProjectConfig; } = {};
    calls = [];

    prepareResponse(url: string, projectConfig: ProjectConfig) {
        this.responses[url] = projectConfig;
    }

    fetchLogic(options: OptionsBase, lastProjectConfig: ProjectConfig, callback: (newProjectConfig: ProjectConfig) => void): void {
        const projectConfig = this.responses[options.getUrl()];
        if (!projectConfig) {
            assert.fail("ConfigFetcher not prepared for " + options.baseUrl);
        }
        this.calls.push(options.getUrl());
        callback(projectConfig);
    }
}

export class FakeOptions extends OptionsBase {
    constructor(baseUrl?: string, dataGovernance?: DataGovernance) {
        super("API_KEY", "TEST", { baseUrl, dataGovernance });
    }
}

export class FakeConfigServiceBase extends ConfigServiceBase {
    constructor(dataGovernance?: DataGovernance, baseUrl?: string) {
        super(new FakeConfigFetcher(), new InMemoryCache(), new FakeOptions(baseUrl, dataGovernance));
    }

    refreshLogicAsync(): Promise<ProjectConfig> {
        return this.refreshLogicBaseAsync(null);
    }

    prepareResponse(baseUrl: string, jsonBaseUrl: string, jsonRedirect: number, jsonFeatureFlags: any) {
        const configFetcher = this.configFetcher as FakeConfigFetcher;

        const configJson = {
            p: {
                u: jsonBaseUrl,
                r: jsonRedirect
            },
            f: jsonFeatureFlags
        }

        configFetcher.prepareResponse(this.getUrl(baseUrl),
            new ProjectConfig(0, JSON.stringify(configJson), ""));
    }

    validateCallCount(callCount: number) {
        const configFetcher = this.configFetcher as FakeConfigFetcher;
        assert.equal(configFetcher.calls.length, callCount);
    }

    validateCall(index: number, baseUrl: string) {
        const configFetcher = this.configFetcher as FakeConfigFetcher;
        assert.equal(this.getUrl(baseUrl), configFetcher.calls[index]);
    }

    private getUrl(baseUrl: string) {
        return baseUrl + "/configuration-files/API_KEY/config_v5.json";
    }
}