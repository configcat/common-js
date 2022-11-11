import { FetchResult, ICache, IConfigCatKernel, IConfigCatLogger, IConfigFetcher, LogLevel, OptionsBase, ProjectConfig } from "../../src";

export class FakeLogger implements IConfigCatLogger {
    public messages: [LogLevel, string][] = [];

    constructor(public level = LogLevel.Info) { }

    reset() { this.messages.splice(0); }

    isLogLevelEnabled(logLevel: LogLevel): boolean {
        return this.level >= logLevel;
    }

    log(message: string): void {
        this.info(message);
    }

    debug(message: string): void {
        if (this.isLogLevelEnabled(LogLevel.Debug)) {
            this.messages.push([LogLevel.Debug, message]);
        }
    }

    info(message: string): void {
        if (this.isLogLevelEnabled(LogLevel.Info)) {
            this.messages.push([LogLevel.Info, message]);
        }
    }

    warn(message: string): void {
        if (this.isLogLevelEnabled(LogLevel.Warn)) {
            this.messages.push([LogLevel.Warn, message]);
        }
    }

    error(message: string): void {
        if (this.isLogLevelEnabled(LogLevel.Error)) {
            this.messages.push([LogLevel.Error, message]);
        }
    }
}

export class FakeConfigCatKernel implements IConfigCatKernel {
    cache?: ICache;
    configFetcher!: IConfigFetcher;
    sdkType = "common";
    sdkVersion = "1.0.0";
}

export class FakeCache implements ICache {
    cached: ProjectConfig | null;
    constructor(cached: ProjectConfig | null = null) {
        this.cached = cached;
    }
    set(key: string, config: ProjectConfig): Promise<void> | void {
        this.cached = config;
    }
    get(key: string): Promise<ProjectConfig | null> | ProjectConfig | null {
        return this.cached;
    }
}

export class FakeConfigFetcherBase implements IConfigFetcher {
    calledTimes = 0;

    constructor(private config: string | null, private callbackDelay: number = 0) {
    }

    fetchLogic(options: OptionsBase, lastEtag: string, callback: (result: FetchResult) => void): void {
        if (callback) {
            setTimeout(() => {
                this.calledTimes++;
                callback(this.config === null ? FetchResult.error() : FetchResult.success(this.config, this.getEtag()));
            }, this.callbackDelay);
        }
    }

    protected getEtag(): string {
        return "etag";
    }
}


export class FakeConfigFetcher extends FakeConfigFetcherBase {
    constructor(private callbackDelayInMilliseconds: number = 0) {
        super("{\"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }", callbackDelayInMilliseconds);
    }
}

export class FakeConfigFetcherWithTwoKeys extends FakeConfigFetcherBase {
    constructor() {
        super("{\"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] }, \"debug2\": { \"v\": true, \"i\": \"12345678\", \"t\": 0, \"p\": [], \"r\": [] } } }");
    }
}

export class FakeConfigFetcherWithTwoCaseSensitiveKeys extends FakeConfigFetcherBase {
    constructor() {
        super("{\"f\": { \"debug\": { \"v\": \"debug\", \"i\": \"abcdefgh\", \"t\": 1, \"p\": [], \"r\": [{ \"o\":0, \"a\":\"CUSTOM\", \"t\":0, \"c\":\"c\", \"v\":\"UPPER-VALUE\", \"i\":\"6ada5ff2\"}, { \"o\":1, \"a\":\"custom\", \"t\":0, \"c\":\"c\", \"v\":\"lower-value\", \"i\":\"6ada5ff2\"}] }, \"DEBUG\": { \"v\": \"DEBUG\", \"i\": \"12345678\", \"t\": 1, \"p\": [], \"r\": [] } } }");
    }
}

export class FakeConfigFetcherWithTwoKeysAndRules extends FakeConfigFetcherBase {
    constructor() {
        super("{\"f\": { \"debug\": { \"v\": \"def\", \"i\": \"abcdefgh\", \"t\": 1, \"p\": [], \"r\": [{ \"o\":0, \"a\":\"a\", \"t\":1, \"c\":\"abcd\", \"v\":\"value\", \"i\":\"6ada5ff2\"}] }, \"debug2\": { \"v\": \"def\", \"i\": \"12345678\", \"t\": 1, \"p\": [{\"o\":0, \"v\":\"value1\", \"p\":50, \"i\":\"d227b334\" }, { \"o\":1, \"v\":\"value2\", \"p\":50, \"i\":\"622f5d07\" }], \"r\": [] } } }");
    }
}

export class FakeConfigFetcherWithRules extends FakeConfigFetcherBase {
    constructor() {
        super("{\"f\": { \"debug\": { \"v\": \"defaultValue\", \"i\": \"defaultVariationId\", \"t\": 0, \"p\": [], \"r\": [{ \"o\":0, \"a\":\"eyeColor\", \"t\":0, \"c\":\"red\", \"v\":\"redValue\", \"i\":\"redVariationId\"}, { \"o\":1, \"a\":\"eyeColor\", \"t\":0, \"c\":\"blue\", \"v\":\"blueValue\", \"i\":\"blueVariationId\"}] } } }");
    }
}
export class FakeConfigFetcherWithNullNewConfig extends FakeConfigFetcherBase {
    constructor() {
        super(null);
    }
}

export class FakeConfigFetcherWithAlwaysVariableEtag extends FakeConfigFetcherBase {
    constructor() {
        super("{ \"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } }}");
    }

    getEtag(): string {
        return Math.random().toString();
    }
}

export class FakeConfigFetcherWithPercantageRules extends FakeConfigFetcherBase {
    constructor() {
        super("{\"f\":{\"string25Cat25Dog25Falcon25Horse\":{\"v\":\"Chicken\",\"t\":1,\"p\":[{\"o\":0,\"v\":\"Cat\",\"p\":25},{\"o\":1,\"v\":\"Dog\",\"p\":25},{\"o\":2,\"v\":\"Falcon\",\"p\":25},{\"o\":3,\"v\":\"Horse\",\"p\":25}],\"r\":[]}}}");
    }
}
