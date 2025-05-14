import { assert } from "chai";
import "mocha";
import { EqualMatchingInjectorConfig, It, Mock, RejectedPromiseFactory, ResolvedPromiseFactory, Times } from "moq.ts";
import { MimicsRejectedAsyncPresetFactory, MimicsResolvedAsyncPresetFactory, Presets, ReturnsAsyncPresetFactory, RootMockProvider, ThrowsAsyncPresetFactory } from "moq.ts/internal";
import { AutoPollConfigService, POLL_EXPIRATION_TOLERANCE_MS } from "../src/AutoPollConfigService";
import { IConfigCache, InMemoryConfigCache } from "../src/ConfigCatCache";
import { AutoPollOptions, LazyLoadOptions, ManualPollOptions, OptionsBase } from "../src/ConfigCatClientOptions";
import { FetchResult, IConfigFetcher, IFetchResponse } from "../src/ConfigFetcher";
import { LazyLoadConfigService } from "../src/LazyLoadConfigService";
import { ManualPollConfigService } from "../src/ManualPollConfigService";
import { Config, ProjectConfig } from "../src/ProjectConfig";
import { delay } from "../src/Utils";
import { FakeCache } from "./helpers/fakes";

describe("ConfigServiceBaseTests", () => {

  const asyncInjectorServiceConfig = {
    injectorConfig: new EqualMatchingInjectorConfig([], [
      {
        provide: ReturnsAsyncPresetFactory,
        useClass: MimicsResolvedAsyncPresetFactory,
        deps: [RootMockProvider, Presets, ResolvedPromiseFactory]
      },
      {
        provide: ThrowsAsyncPresetFactory,
        useClass: MimicsRejectedAsyncPresetFactory,
        deps: [RootMockProvider, Presets, RejectedPromiseFactory]
      },
    ])
  };

  it("AutoPollConfigService - backgroundworker only - config doesn't exist in the cache - invokes 'cache.set' operation 3 times", async () => {

    // Arrange

    const fr: FetchResult = createFetchResult();
    const pc: ProjectConfig = createConfigFromFetchResult(fr);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson });

    let callNo = 1;

    const cacheMock = new Mock<IConfigCache>()
      .setup(m => m.get(It.IsAny<string>()))
      .callback(() => { return callNo++ === 1 ? ProjectConfig.empty : pc; })
      .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
      .returns();

    const pollIntervalSeconds = 1;

    // Act

    const service: AutoPollConfigService = new AutoPollConfigService(
      fetcherMock.object(),
      new AutoPollOptions(
        "APIKEY", "common", "1.0.0",
        { pollIntervalSeconds },
        () => cacheMock.object()));

    await delay(2.5 * pollIntervalSeconds * 1000);

    // Assert

    cacheMock.verify(v => v.set(It.IsAny<string>(), It.Is<ProjectConfig>(c => c.httpETag === fr.config.httpETag && c.configJson === pc.configJson)), Times.Exactly(3));
    fetcherMock.verify(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.AtLeast(3));

    service.dispose();
  });

  it("AutoPollConfigService - with forceRefresh - invokes 'cache.set' operation two times", async () => {

    // Arrange

    const fr: FetchResult = createFetchResult();
    const pc: ProjectConfig = createConfigFromFetchResult(fr);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson });

    let callNo = 1;

    const cacheMock = new Mock<IConfigCache>()
      .setup(m => m.get(It.IsAny<string>()))
      .callback((_) => { return callNo++ === 1 ? ProjectConfig.empty : pc; })
      .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
      .returns();

    const pollIntervalSeconds = 1;

    // Act

    const service: AutoPollConfigService = new AutoPollConfigService(
      fetcherMock.object(),
      new AutoPollOptions(
        "APIKEY", "common", "1.0.0",
        { pollIntervalSeconds },
        () => cacheMock.object()));

    await delay(0.5 * pollIntervalSeconds * 1000);

    await service.refreshConfigAsync();

    // Assert

    cacheMock.verify(v => v.set(It.IsAny<string>(), It.Is<ProjectConfig>(c => c.httpETag === fr.config.httpETag && c.configJson === pc.configJson)), Times.Exactly(2));

    service.dispose();
  });

  it("AutoPollConfigService - ProjectConfig is cached and fetch returns same value at first then errors - should invoke the 'cache.set' operation only once (at first)", async () => {

    // Arrange

    const pc: ProjectConfig = createProjectConfig();
    const fr: FetchResult = createFetchResult();
    let currentResp: IFetchResponse = { statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson };

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .callback(() => {
        const result = Promise.resolve(currentResp);
        currentResp = { statusCode: 500, reasonPhrase: "Internal Server Error" };
        return result;
      });

    const cacheMock = new Mock<IConfigCache>()
      .setup(m => m.get(It.IsAny<string>()))
      .returns(pc)
      .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
      .returns();

    const pollIntervalSeconds = 1;

    // Act

    const service: AutoPollConfigService = new AutoPollConfigService(
      fetcherMock.object(),
      new AutoPollOptions(
        "APIKEY", "common", "1.0.0",
        { pollIntervalSeconds },
        () => cacheMock.object()));

    await delay(2.5 * pollIntervalSeconds * 1000);

    // Assert

    cacheMock.verify(v => v.set(
      It.IsAny<string>(),
      It.Is<ProjectConfig>(c => c.httpETag === fr.config.httpETag && c.configJson === pc.configJson)),
    Times.Once());

    service.dispose();
  });

  it("AutoPollConfigService - Cached config is the same as ProjectConfig but older than the polling time - Should wait until the cache is updated with the new etag", async () => {

    // Arrange

    const frNew: FetchResult = createFetchResult("newEtag");
    const frOld: FetchResult = createFetchResult("oldEtag");

    const pollInterval = 10;

    const projectConfigNew: ProjectConfig = createConfigFromFetchResult(frNew);

    const time: number = ProjectConfig.generateTimestamp();
    const projectConfigOld: ProjectConfig = createConfigFromFetchResult(frOld).with(time - (1.5 * pollInterval * 1000) + 0.5 * POLL_EXPIRATION_TOLERANCE_MS);

    const cache = new InMemoryConfigCache();

    const options: AutoPollOptions = new AutoPollOptions(
      "APIKEY", "common", "1.0.0",
      {
        pollIntervalSeconds: pollInterval,
        maxInitWaitTimeSeconds: 100
      },
      () => cache);

    await cache.set(options.getCacheKey(), projectConfigOld);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .callback(() => new Promise(resolve =>
        setTimeout(() => resolve({ statusCode: 200, reasonPhrase: "OK", eTag: frNew.config.httpETag, body: frNew.config.configJson }), 100)));

    // Act

    const service: AutoPollConfigService = new AutoPollConfigService(
      fetcherMock.object(),
      options);

    const actualProjectConfig: ProjectConfig | null = await service.getConfig();

    // Assert

    assert.isDefined(actualProjectConfig?.httpETag);
    assert.isDefined(actualProjectConfig?.configJson);
    assert.equal(actualProjectConfig?.httpETag, projectConfigNew.httpETag);
    assert.equal(actualProjectConfig?.configJson, projectConfigNew?.configJson);

    service.dispose();
  });

  it("AutoPollConfigService - Cached config is the same as ProjectConfig but older than the polling time - Should return cached item", async () => {

    // Arrange

    const frNew: FetchResult = createFetchResult("newEtag");
    const frOld: FetchResult = createFetchResult("oldEtag");

    const pollInterval = 10;

    const time: number = ProjectConfig.generateTimestamp();
    const projectConfigOld = createConfigFromFetchResult(frOld).with(time - (pollInterval * 1000) + 0.5 * POLL_EXPIRATION_TOLERANCE_MS);

    const cache = new InMemoryConfigCache();

    const options: AutoPollOptions = new AutoPollOptions(
      "APIKEY", "common", "1.0.0",
      {
        pollIntervalSeconds: pollInterval,
        maxInitWaitTimeSeconds: 100
      },
      () => cache);

    await cache.set(options.getCacheKey(), projectConfigOld);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .callback(() => new Promise(resolve =>
        setTimeout(() => resolve({ statusCode: 200, reasonPhrase: "OK", eTag: frNew.config.httpETag, body: frNew.config.configJson }), 100)));

    // Act

    const service: AutoPollConfigService = new AutoPollConfigService(
      fetcherMock.object(),
      options);

    const actualProjectConfig: ProjectConfig | null = await service.getConfig();

    // Assert

    assert.isDefined(actualProjectConfig?.httpETag);
    assert.isDefined(actualProjectConfig?.configJson);
    assert.equal(actualProjectConfig?.httpETag, projectConfigOld.httpETag);
    assert.equal(actualProjectConfig?.configJson, projectConfigOld?.configJson);
    assert.equal(actualProjectConfig?.timestamp, projectConfigOld.timestamp);

    service.dispose();
  });

  it("AutoPollConfigService - ProjectConfigs are same but cache stores older config than poll interval and fetch operation is longer than maxInitWaitTimeSeconds - Should return cached item", async () => {

    // Arrange

    const pollIntervalSeconds = 10;

    const fr: FetchResult = createFetchResult();

    const projectConfigOld: ProjectConfig = createConfigFromFetchResult(fr);

    const cache = new InMemoryConfigCache();

    const options: AutoPollOptions = new AutoPollOptions(
      "APIKEY", "common", "1.0.0",
      {
        pollIntervalSeconds: pollIntervalSeconds,
        maxInitWaitTimeSeconds: 1
      },
      () => cache);

    await cache.set(options.getCacheKey(), projectConfigOld);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>()))
      .callback(() => new Promise(resolve =>
        setTimeout(() => resolve({ statusCode: 500, reasonPhrase: "Internal Server Error" }), 2000)));

    // Act

    const service: AutoPollConfigService = new AutoPollConfigService(
      fetcherMock.object(),
      options);

    const actualProjectConfig: ProjectConfig | null = await service.getConfig();

    // Assert

    assert.isDefined(actualProjectConfig?.httpETag);
    assert.isDefined(actualProjectConfig?.configJson);
    assert.equal(actualProjectConfig?.httpETag, projectConfigOld.httpETag);
    assert.equal(actualProjectConfig?.configJson, projectConfigOld?.configJson);

    service.dispose();
  });

  it("LazyLoadConfigService - ProjectConfig is different in the cache - should fetch a new config and put into cache", async () => {

    // Arrange

    const cacheTimeToLiveSeconds = 10;
    const oldConfig: ProjectConfig = createProjectConfig("oldConfig").with(ProjectConfig.generateTimestamp() - (cacheTimeToLiveSeconds * 1000) - 1000);

    const fr: FetchResult = createFetchResult("newConfig");

    const newConfig: ProjectConfig = createConfigFromFetchResult(fr);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson });

    const cacheMock = new Mock<IConfigCache>()
      .setup(m => m.get(It.IsAny<string>()))
      .returns(oldConfig)
      .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
      .returns();

    const service: LazyLoadConfigService = new LazyLoadConfigService(
      fetcherMock.object(),
      new LazyLoadOptions(
        "APIKEY", "common", "1.0.0",
        { cacheTimeToLiveSeconds: cacheTimeToLiveSeconds },
        () => cacheMock.object()));

    // Act

    const actualConfig = await service.getConfig();

    // Assert

    assert.equal(actualConfig.httpETag, newConfig.httpETag);
    assert.equal(actualConfig.configJson, newConfig.configJson);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), "oldConfig"), Times.Once());
    cacheMock.verify(v => v.set(It.IsAny<string>(), It.Is<ProjectConfig>(c => c.httpETag === fr.config.httpETag && c.configJson === newConfig.configJson)), Times.Once());
  });

  it("LazyLoadConfigService - ProjectConfig is cached - should not invoke fetch", async () => {

    // Arrange

    const config: ProjectConfig = createProjectConfig().with(ProjectConfig.generateTimestamp());

    const fetcherMock = new Mock<IConfigFetcher>();

    const cacheMock = new Mock<IConfigCache>()
      .setup(m => m.get(It.IsAny<string>()))
      .returns(config);

    const service: LazyLoadConfigService = new LazyLoadConfigService(
      fetcherMock.object(),
      new LazyLoadOptions(
        "APIKEY", "common", "1.0.0",
        {},
        () => cacheMock.object()));

    // Act

    const actualConfig = await service.getConfig();

    // Assert

    assert.equal(actualConfig.httpETag, config.httpETag);
    assert.equal(actualConfig.configJson, config.configJson);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Never());
  });

  it("LazyLoadConfigService - refreshConfigAsync - should invoke fetch and cache.set operation", async () => {

    // Arrange

    const config: ProjectConfig = createProjectConfig().with(ProjectConfig.generateTimestamp() - 1000);

    const fr: FetchResult = createFetchResult();

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson });

    const cacheMock = new Mock<IConfigCache>()
      .setup(m => m.get(It.IsAny<string>()))
      .returns(config)
      .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
      .returns();

    const service: LazyLoadConfigService = new LazyLoadConfigService(
      fetcherMock.object(),
      new LazyLoadOptions(
        "APIKEY", "common", "1.0.0",
        {},
        () => cacheMock.object()));

    // Act

    const [, actualConfig] = await service.refreshConfigAsync();

    // Assert

    assert.equal(actualConfig.httpETag, config.httpETag);
    assert.equal(actualConfig.configJson, config.configJson);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Once());
    cacheMock.verify(v => v.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()), Times.Once());
  });

  it("LazyLoadConfigService - refreshConfigAsync - should invoke fetch and cache.set operation - async cache supported", async () => {

    // Arrange

    const config: ProjectConfig = createProjectConfig().with(ProjectConfig.generateTimestamp() - 1000);

    const fr: FetchResult = createFetchResult();

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson });

    const cacheMock = new Mock<IConfigCache>(asyncInjectorServiceConfig)
      .setup(m => m.get(It.IsAny<string>()))
      .returns(Promise.resolve(config))
      .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
      .returns(Promise.resolve());

    const service: LazyLoadConfigService = new LazyLoadConfigService(
      fetcherMock.object(),
      new LazyLoadOptions(
        "APIKEY", "common", "1.0.0",
        {},
        () => cacheMock.object()));

    // Act

    const [, actualConfig] = await service.refreshConfigAsync();

    // Assert

    assert.equal(actualConfig.httpETag, config.httpETag);
    assert.equal(actualConfig.configJson, config.configJson);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Once());
    cacheMock.verify(v => v.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()), Times.Once());
  });

  it("AutoPollConfigService - getConfig() should return cached config when cached config is not expired", async () => {
    // Arrange

    const pollIntervalSeconds = 2;

    const fr: FetchResult = createFetchResult();

    let cachedPc: ProjectConfig = createConfigFromFetchResult(fr);
    cachedPc = cachedPc.with(cachedPc.timestamp - pollIntervalSeconds * 1000 + 1.5 * POLL_EXPIRATION_TOLERANCE_MS);

    const cache = new FakeCache();
    cache.set("", cachedPc);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson });

    const options = new AutoPollOptions(
      "APIKEY", "common", "1.0.0",
      {
        pollIntervalSeconds,
        maxInitWaitTimeSeconds: 500
      },
      () => cache);

    // Act

    const service = new AutoPollConfigService(fetcherMock.object(), options);

    // Give a bit of time to the polling loop to do the first iteration.
    await delay(pollIntervalSeconds / 4 * 1000);

    const actualPc = await service.getConfig();

    // Assert

    assert.strictEqual(cachedPc, actualPc);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Never());
  });

  it("AutoPollConfigService - getConfig() should wait for fetch when cached config is expired", async () => {
    // Arrange

    const pollIntervalSeconds = 2;

    const fr: FetchResult = createFetchResult();

    let cachedPc: ProjectConfig = createConfigFromFetchResult(fr);
    cachedPc = cachedPc.with(cachedPc.timestamp - pollIntervalSeconds * 1000 + 0.5 * POLL_EXPIRATION_TOLERANCE_MS);

    const cache = new FakeCache();
    cache.set("", cachedPc);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson });

    const options = new AutoPollOptions(
      "APIKEY", "common", "1.0.0",
      {
        pollIntervalSeconds,
        maxInitWaitTimeSeconds: 1000
      },
      () => cache);

    // Act

    const service = new AutoPollConfigService(fetcherMock.object(), options);

    // Give a bit of time to the polling loop to do the first iteration.
    await delay(pollIntervalSeconds / 4 * 1000);

    const actualPc = await service.getConfig();

    // Assert

    assert.notStrictEqual(cachedPc, actualPc);
    assert.equal(fr.config.httpETag, actualPc.httpETag);
    assert.equal(fr.config.configJson, actualPc.configJson);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Once());
  });

  it("LazyLoadConfigService - getConfig() should return cached config when cached config is not expired", async () => {
    // Arrange

    const cacheTimeToLiveSeconds = 5;

    const fr: FetchResult = createFetchResult();

    let cachedPc: ProjectConfig = createConfigFromFetchResult(fr);
    cachedPc = cachedPc.with(cachedPc.timestamp - 0.5 * cacheTimeToLiveSeconds * 1000);

    const cache = new FakeCache();
    cache.set("", cachedPc);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson });

    const options = new LazyLoadOptions(
      "APIKEY", "common", "1.0.0",
      {
        cacheTimeToLiveSeconds
      },
      () => cache);

    // Act

    const service = new LazyLoadConfigService(fetcherMock.object(), options);

    const actualPc = await service.getConfig();

    // Assert

    assert.strictEqual(cachedPc, actualPc);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Never());
  });

  it("LazyLoadConfigService - getConfig() should fetch when cached config is expired", async () => {
    // Arrange

    const cacheTimeToLiveSeconds = 5;

    const fr: FetchResult = createFetchResult();

    let cachedPc: ProjectConfig = createConfigFromFetchResult(fr);
    cachedPc = cachedPc.with(cachedPc.timestamp - 1.5 * cacheTimeToLiveSeconds * 1000);

    const cache = new FakeCache();
    cache.set("", cachedPc);

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .callback(async () => {
        await delay(500);
        return { statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson };
      });

    const options = new LazyLoadOptions(
      "APIKEY", "common", "1.0.0",
      {
        cacheTimeToLiveSeconds
      },
      () => cache);

    // Act

    const service = new LazyLoadConfigService(fetcherMock.object(), options);

    const actualPc = await service.getConfig();

    // Assert

    assert.notStrictEqual(cachedPc, actualPc);
    assert.equal(fr.config.httpETag, actualPc.httpETag);
    assert.equal(fr.config.configJson, actualPc.configJson);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Once());
  });

  it("fetchAsync() should not initiate a request when there is a pending one", async () => {
    // Arrange

    const fr: FetchResult = createFetchResult();
    const pc: ProjectConfig = createConfigFromFetchResult(fr);

    const cache = new FakeCache();

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .callback(async () => {
        await delay(100);
        return { statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson };
      });

    const options = new ManualPollOptions(
      "APIKEY", "common", "1.0.0",
      {
      },
      () => cache);

    const service = new ManualPollConfigService(fetcherMock.object(), options);

    // Act

    const [[, config1], [, config2]] = await Promise.all([service.refreshConfigAsync(), service.refreshConfigAsync()]);

    // Assert

    assert.strictEqual(config1, config2);
    assert.equal(pc.httpETag, config1.httpETag);
    assert.equal(pc.configJson, config1.configJson);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Once());
  });

  it("fetchAsync() should initiate a request when there is not a pending one", async () => {
    // Arrange

    const fr: FetchResult = createFetchResult();
    const pc: ProjectConfig = createConfigFromFetchResult(fr);

    const cache = new FakeCache();

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .callback(async () => {
        await delay(100);
        return { statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson };
      });

    const options = new ManualPollOptions(
      "APIKEY", "common", "1.0.0",
      {
      },
      () => cache);

    const service = new ManualPollConfigService(fetcherMock.object(), options);

    // Act

    const [, config1] = await service.refreshConfigAsync();
    const [, config2] = await service.refreshConfigAsync();

    // Assert

    assert.notStrictEqual(config1, config2);
    assert.equal(pc.httpETag, config1.httpETag);
    assert.equal(pc.configJson, config1.configJson);
    assert.equal(pc.httpETag, config2.httpETag);
    assert.equal(pc.configJson, config2.configJson);

    fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Exactly(2));
  });

  it("refreshConfigAsync() should return null config when cache is empty and fetch fails.", async () => {

    // Arrange

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 502, reasonPhrase: "Bad Gateway" });

    const cache = new InMemoryConfigCache();

    const options = new ManualPollOptions(
      "APIKEY", "common", "1.0.0",
      {},
      () => cache);

    const service = new ManualPollConfigService(fetcherMock.object(), options);

    // Act

    const [, projectConfig] = await service.refreshConfigAsync();

    // Assert

    assert.isTrue(projectConfig.isEmpty);
    assert.isTrue((cache.get(options.getCacheKey())).isEmpty);
  });

  it("refreshConfigAsync() should return latest config when cache is empty and fetch fails.", async () => {

    // Arrange

    const cachedPc: ProjectConfig = createConfigFromFetchResult(createFetchResult());

    const fetcherMock = new Mock<IConfigFetcher>()
      .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
      .returnsAsync({ statusCode: 502, reasonPhrase: "Bad Gateway" });

    const cache = new InMemoryConfigCache();

    const options = new ManualPollOptions(
      "APIKEY", "common", "1.0.0",
      {},
      () => cache);

    cache.set(options.getCacheKey(), cachedPc);

    const service = new ManualPollConfigService(fetcherMock.object(), options);

    // Act

    const [, projectConfig] = await service.refreshConfigAsync();

    // Assert

    assert.strictEqual(projectConfig, cachedPc);
    assert.strictEqual(cache.get(options.getCacheKey()), cachedPc);
  });
});

function createProjectConfig(eTag = "etag"): ProjectConfig {
  const configJson = "{\"f\": { \"debug\": { \"v\": { \"b\": true }, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }";
  return new ProjectConfig(
    configJson,
    Config.deserialize(configJson),
    1,
    eTag);
}

function createFetchResult(eTag = "etag"): FetchResult {
  return FetchResult.success(createProjectConfig(eTag));
}

function createConfigFromFetchResult(result: FetchResult): ProjectConfig {
  return result.config.with(ProjectConfig.generateTimestamp());
}
