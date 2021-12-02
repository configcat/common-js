import { ConfigCatClient, IConfigCatClient } from "../src/ConfigCatClient";
import { assert, expect } from "chai";
import "mocha";
import { IConfigFetcher, IConfigCatKernel, ICache } from "../src/.";
import { ProjectConfig } from "../src/ProjectConfig";
import { ManualPollOptions, AutoPollOptions, LazyLoadOptions, OptionsBase } from "../src/ConfigCatClientOptions";
import { User } from "../src/RolloutEvaluator";


const trueConfig = "{\"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }";
const falseConfig = "{\"f\": { \"debug\": { \"v\": false, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }";

describe("AutoPollInitialization", () => {

    it("Initialization With AutoPollOptions with expired cache should take care of maxInitWaitTimeSeconds", done => {

        let configFetcher = new FakeConfigFetcher(trueConfig, 500);
        let configCache = new FakeCache(new ProjectConfig(new Date().getTime() - 100000, falseConfig, "etag"))
        let configCatKernel: FakeConfigCatKernel = { configFetcher };
        let options: AutoPollOptions = new AutoPollOptions("APIKEY", {cache: configCache});
        let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

        client.getValue("debug", false, value => {
            done(value == true ? null : new Error("Wrong value."));
        });
    });
});

export class FakeConfigFetcher implements IConfigFetcher {
    calledTimes = 0;

    constructor(private config: string | null, private callbackDelay: number = 0) {
    }

    fetchLogic(options: OptionsBase, lastProjectConfig: ProjectConfig, callback: (newProjectConfig: ProjectConfig | null) => void): void {
        if (callback) {
            setTimeout(() => {
                this.calledTimes++;
                callback(this.config === null ? null : new ProjectConfig(0, this.config, this.getEtag()));
            }, this.callbackDelay);
        }
    }

    protected getEtag(): string {
        return "etag";
    }
}

export class FakeCache implements ICache {
    cached: ProjectConfig;
    constructor(cached: ProjectConfig) {
        this.cached = cached;
    }
    set(key: string, config: ProjectConfig): void | Promise<void> {
        this.cached = config;
    }
    get(key: string): ProjectConfig | Promise<ProjectConfig> {
        return this.cached;
    }
}

export class FakeConfigCatKernel implements IConfigCatKernel {
    cache?: ICache;
    configFetcher!: IConfigFetcher;
}
