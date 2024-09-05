import { IConfigCatCache, LogEventId } from "../../src";
import { IConfigCache } from "../../src/ConfigCatCache";
import { IConfigCatKernel } from "../../src/ConfigCatClient";
import { OptionsBase } from "../../src/ConfigCatClientOptions";
import { IConfigCatLogger, LogLevel, LogMessage } from "../../src/ConfigCatLogger";
import { IConfigFetcher, IFetchResponse } from "../../src/ConfigFetcher";
import { ProjectConfig } from "../../src/ProjectConfig";
import { delay } from "../../src/Utils";

export class FakeLogger implements IConfigCatLogger {
  events: [LogLevel, LogEventId, LogMessage, any?][] = [];

  constructor(public level = LogLevel.Info) { }

  reset(): void { this.events.splice(0); }

  log(level: LogLevel, eventId: number, message: LogMessage, exception?: any): void {
    this.events.push([level, eventId, message, exception]);
  }
}

export class FakeConfigCatKernel implements IConfigCatKernel {
  configFetcher!: IConfigFetcher;
  sdkType = "common";
  sdkVersion = "1.0.0";
  defaultCacheFactory?: (options: OptionsBase) => IConfigCache;
}

export class FakeCache implements IConfigCache {
  cached: ProjectConfig;

  constructor(cached: ProjectConfig | null = null) {
    this.cached = cached ?? ProjectConfig.empty;
  }

  get localCachedConfig(): ProjectConfig { return this.cached; }

  set(_key: string, config: ProjectConfig): Promise<void> | void {
    this.cached = config;
  }

  get(_key: string): Promise<ProjectConfig> | ProjectConfig {
    return this.cached;
  }

  getInMemory(): ProjectConfig {
    return this.cached;
  }
}

export class FakeExternalCache implements IConfigCatCache {
  private cachedValue: string | undefined;

  set(key: string, value: string): void {
    this.cachedValue = value;
  }

  get(key: string): string | undefined {
    return this.cachedValue;
  }
}

export class FakeExternalAsyncCache implements IConfigCatCache {
  private cachedValue: string | undefined;

  constructor(private readonly delayMs = 0) {
  }

  async set(key: string, value: string): Promise<void> {
    await delay(this.delayMs);
    this.cachedValue = value;
  }

  async get(key: string): Promise<string | undefined> {
    await delay(this.delayMs);
    return this.cachedValue;
  }
}

export class FakeExternalCacheWithInitialData implements IConfigCatCache {
  expirationDelta: number;

  constructor(expirationDelta = 0) {
    this.expirationDelta = expirationDelta;
  }

  set(key: string, value: string): void | Promise<void> {
    throw new Error("Method not implemented.");
  }
  get(key: string): string | Promise<string | null | undefined> | null | undefined {
    const cachedJson = '{"f":{"debug":{"t":0,"v":{"b":true},"i":"abcdefgh"}}}';
    const config = new ProjectConfig(cachedJson, JSON.parse(cachedJson), (new Date().getTime()) - this.expirationDelta, "\"ETAG\"");
    return ProjectConfig.serialize(config);
  }

}

export class FakeConfigFetcherBase implements IConfigFetcher {
  calledTimes = 0;

  constructor(
    private config: string | null,
    private readonly callbackDelay: number = 0,
    private readonly getFetchResponse?: (lastConfig: string | null, lastEtag: string | null) => IFetchResponse) {

    this.config ??= this.defaultConfigJson;
  }

  protected get defaultConfigJson(): string | null { return null; }

  async fetchLogic(options: OptionsBase, lastEtag: string | null): Promise<IFetchResponse> {
    const nextFetchResponse = this.getFetchResponse
      ? (lastConfig: string | null, lastEtag: string | null) => {
        const fr = this.getFetchResponse!(lastConfig, lastEtag);
        this.config = fr.body ?? null;
        return fr;
      }
      : () => this.config !== null
        ? { statusCode: 200, reasonPhrase: "OK", eTag: this.getEtag(), body: this.config } as IFetchResponse
        : { statusCode: 404, reasonPhrase: "Not Found" } as IFetchResponse;

    await delay(this.callbackDelay);

    this.calledTimes++;
    return nextFetchResponse(this.config, lastEtag);
  }

  protected getEtag(): string {
    return "etag";
  }
}

export class FakeConfigFetcher extends FakeConfigFetcherBase {
  static get configJson(): string {
    return '{"f":{"debug":{"t":0,"v":{"b":true},"i":"abcdefgh"}}}';
  }

  ["constructor"]!: typeof FakeConfigFetcher;

  protected get defaultConfigJson(): string | null { return this.constructor.configJson; }

  constructor(callbackDelayInMilliseconds = 0) {
    super(null, callbackDelayInMilliseconds);
  }
}

export class FakeConfigFetcherWithTwoKeys extends FakeConfigFetcher {
  static get configJson(): string {
    return '{"f":{"debug":{"t":0,"v":{"b":true},"i":"abcdefgh"},"debug2":{"t":0,"v":{"b":true},"i":"12345678"}}}';
  }
}

export class FakeConfigFetcherWithTwoCaseSensitiveKeys extends FakeConfigFetcher {
  static get configJson(): string {
    return '{"f":{"DEBUG":{"t":1,"v":{"s":"DEBUG"},"i":"12345678"},"debug":{"t":1,"r":[{"c":[{"u":{"a":"CUSTOM","c":0,"l":["c"]}}],"s":{"v":{"s":"UPPER-VALUE"},"i":"6ada5ff2"}},{"c":[{"u":{"a":"custom","c":0,"l":["c"]}}],"s":{"v":{"s":"lower-value"},"i":"6ada5ff2"}}],"v":{"s":"debug"},"i":"abcdefgh"}}}';
  }
}

export class FakeConfigFetcherWithTwoKeysAndRules extends FakeConfigFetcher {
  static get configJson(): string {
    return '{"f":{"debug":{"t":1,"r":[{"c":[{"u":{"a":"a","c":1,"l":["abcd"]}}],"s":{"v":{"s":"value"},"i":"6ada5ff2"}}],"v":{"s":"def"},"i":"abcdefgh"},"debug2":{"t":1,"p":[{"p":50,"v":{"s":"value1"},"i":"d227b334"},{"p":50,"v":{"s":"value2"},"i":"622f5d07"}],"v":{"s":"def"},"i":"12345678"}}}';
  }
}

export class FakeConfigFetcherWithPercentageOptionsWithinTargetingRule extends FakeConfigFetcher {
  static get configJson(): string {
    return '{"f":{"debug":{"t":1,"r":[{"c":[{"u":{"a":"a","c":1,"l":["abcd"]}}],"s":{"v":{"s":"value"},"i":"6ada5ff2"}},{"c":[{"u":{"a":"a","c":0,"l":["abcd"]}}],"p":[{"p":50,"v":{"s":"value1"},"i":"d227b334"},{"p":50,"v":{"s":"value2"},"i":"622f5d07"}]}],"v":{"s":"def"},"i":"abcdefgh"}}}';
  }
}

export class FakeConfigFetcherWithRules extends FakeConfigFetcher {
  static get configJson(): string {
    return '{"f":{"debug":{"t":1,"r":[{"c":[{"u":{"a":"eyeColor","c":0,"l":["red"]}}],"s":{"v":{"s":"redValue"},"i":"redVariationId"}},{"c":[{"u":{"a":"eyeColor","c":0,"l":["blue"]}}],"s":{"v":{"s":"blueValue"},"i":"blueVariationId"}}],"v":{"s":"defaultValue"},"i":"defaultVariationId"}}}';
  }
}

export class FakeConfigFetcherWithNullNewConfig extends FakeConfigFetcherBase {
  constructor(callbackDelayInMilliseconds = 0) {
    super(null, callbackDelayInMilliseconds);
  }
}

export class FakeConfigFetcherWithAlwaysVariableEtag extends FakeConfigFetcher {
  static get configJson(): string {
    return '{"f":{"debug":{"t":0,"v":{"b":true},"i":"abcdefgh"}}}';
  }

  private eTag = 0;

  getEtag(): string {
    return `"${(this.eTag++).toString(16).padStart(8, "0")}"`;
  }
}

export class FakeConfigFetcherWithPercentageOptions extends FakeConfigFetcher {
  static get configJson(): string {
    return '{"f":{"string25Cat25Dog25Falcon25Horse":{"t":1,"p":[{"p":25,"v":{"s":"Cat"},"i":"CatVariationId"},{"p":25,"v":{"s":"Dog"},"i":"DogVariationId"},{"p":25,"v":{"s":"Falcon"},"i":"FalconVariationId"},{"p":25,"v":{"s":"Horse"},"i":"HorseVariationId"}],"v":{"s":"Chicken"},"i":"ChickenVariationId"}}}';
  }
}
