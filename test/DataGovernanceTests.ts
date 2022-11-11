import { assert } from "chai";
import "mocha";
import { OptionsBase, DataGovernance } from "../src/ConfigCatClientOptions";
import { FetchResult, IConfigFetcher, ProjectConfig } from "../src";
import { ConfigServiceBase } from "../src/ConfigServiceBase";

const globalUrl = "https://cdn-global.configcat.com";
const euOnlyUrl = "https://cdn-eu.configcat.com";
const customUrl = "https://cdn-custom.configcat.com";
const forcedUrl = "https://cdn-forced.configcat.com";
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
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(1);
        configService.validateCall(0, globalUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
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
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(1);
        configService.validateCall(0, euOnlyUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
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
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, globalUrl);
        configService.validateCall(1, euOnlyUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
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
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(1);
        configService.validateCall(0, euOnlyUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, euOnlyUrl);
        configService.validateCall(1, euOnlyUrl);
    });

    it("sdk global, custom", async () => {
        // In this case
        // the first invocation should call https://custom.configcat.com
        // and the second should call https://custom.configcat.com
        // without redirects
        let configService = new FakeConfigServiceBase(DataGovernance.Global, customUrl);
        configService.prepareResponse(customUrl, globalUrl, 0, testObject);

        let config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(1);
        configService.validateCall(0, customUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, customUrl);
        configService.validateCall(1, customUrl);
    });

    it("sdk euonly, custom", async () => {
        // In this case
        // the first invocation should call https://custom.configcat.com
        // and the second should call https://custom.configcat.com
        // without redirects
        let configService = new FakeConfigServiceBase(DataGovernance.EuOnly, customUrl);
        configService.prepareResponse(customUrl, globalUrl, 0, testObject);

        let config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(1);
        configService.validateCall(0, customUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, customUrl);
        configService.validateCall(1, customUrl);
    });

    it("sdk global, forced", async () => {
        // In this case
        // the first invocation should call https://cdn-global.configcat.com
        // with an immediate redirect to https://forced.configcat.com
        // and the second should call https://forced.configcat.com
        let configService = new FakeConfigServiceBase(DataGovernance.Global);
        configService.prepareResponse(globalUrl, forcedUrl, 2, null);
        configService.prepareResponse(forcedUrl, forcedUrl, 2, testObject);

        let config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, globalUrl);
        configService.validateCall(1, forcedUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(3);
        configService.validateCall(0, globalUrl);
        configService.validateCall(1, forcedUrl);
        configService.validateCall(2, forcedUrl);
    });

    it("sdk euonly, forced", async () => {
        // In this case
        // the first invocation should call https://cdn-eu.configcat.com
        // with an immediate redirect to https://forced.configcat.com
        // and the second should call https://forced.configcat.com
        let configService = new FakeConfigServiceBase(DataGovernance.EuOnly);
        configService.prepareResponse(euOnlyUrl, forcedUrl, 2, null);
        configService.prepareResponse(forcedUrl, forcedUrl, 2, testObject);

        let config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, euOnlyUrl);
        configService.validateCall(1, forcedUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(3);
        configService.validateCall(0, euOnlyUrl);
        configService.validateCall(1, forcedUrl);
        configService.validateCall(2, forcedUrl);
    });

    it("sdk baseurl, forced", async () => {
        // In this case
        // the first invocation should call https://cdn-custom.configcat.com
        // with an immediate redirect to https://forced.configcat.com
        // and the second should call https://forced.configcat.com
        let configService = new FakeConfigServiceBase(DataGovernance.EuOnly, customUrl);
        configService.prepareResponse(customUrl, forcedUrl, 2, null);
        configService.prepareResponse(forcedUrl, forcedUrl, 2, testObject);

        let config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(2);
        configService.validateCall(0, customUrl);
        configService.validateCall(1, forcedUrl);

        config = await configService.refreshLogicAsync();
        assert.equal(JSON.stringify(config?.ConfigJSON["f"]), JSON.stringify(testObject));
        configService.validateCallCount(3);
        configService.validateCall(0, customUrl);
        configService.validateCall(1, forcedUrl);
        configService.validateCall(2, forcedUrl);
    });

    it("sdk redirect loop", async () => {
        // In this case
        // the first invocation should call https://cdn-global.configcat.com
        // with an immediate redirect to https://cdn-eu.configcat.com
        // with an immediate redirect to https://cdn-global.configcat.com
        // the second invocation should call https://cdn-eu.configcat.com
        // with an immediate redirect to https://cdn-global.configcat.com
        // with an immediate redirect to https://cdn-eu.configcat.com
        let configService = new FakeConfigServiceBase(DataGovernance.Global);
        configService.prepareResponse(globalUrl, euOnlyUrl, 1, null);
        configService.prepareResponse(euOnlyUrl, globalUrl, 1, null);

        let config = await configService.refreshLogicAsync();
        assert.isNull(config?.ConfigJSON["f"]);
        configService.validateCallCount(3);
        configService.validateCall(0, globalUrl);
        configService.validateCall(1, euOnlyUrl);
        configService.validateCall(2, globalUrl);

        config = await configService.refreshLogicAsync();
        assert.isNull(config?.ConfigJSON["f"]);
        configService.validateCallCount(6);
        configService.validateCall(0, globalUrl);
        configService.validateCall(1, euOnlyUrl);
        configService.validateCall(2, globalUrl);

        configService.validateCall(3, euOnlyUrl);
        configService.validateCall(4, globalUrl);
        configService.validateCall(5, euOnlyUrl);
    });
});

export class FakeConfigFetcher implements IConfigFetcher {
    responses: { [url: string]: FetchResult; } = {};
    calls: any[] = [];

    prepareResponse(url: string, fetchResult: FetchResult) {
        this.responses[url] = fetchResult;
    }

    fetchLogic(options: OptionsBase, lastEtag: string | null, callback: (result: FetchResult) => void): void {
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
        super("API_KEY", "TEST", { baseUrl, dataGovernance }, null);
    }
}

export class FakeConfigServiceBase extends ConfigServiceBase<FakeOptions> {
    constructor(dataGovernance?: DataGovernance, baseUrl?: string) {
        super(new FakeConfigFetcher(), new FakeOptions(baseUrl, dataGovernance));
    }

    getConfig(): Promise<ProjectConfig | null> { return Promise.resolve(null); }

    refreshLogicAsync(): Promise<ProjectConfig | null> {
        return this.refreshConfigCoreAsync(null);
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
            FetchResult.success(JSON.stringify(configJson), "etag"));
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
        return baseUrl + "/configuration-files/API_KEY/config_v5.json?sdk=" + this.options.clientVersion;
    }
}