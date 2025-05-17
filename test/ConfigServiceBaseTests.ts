import { assert } from "chai";
import "mocha";
import { EqualMatchingInjectorConfig, It, Mock, RejectedPromiseFactory, ResolvedPromiseFactory, Times } from "moq.ts";
import { MimicsRejectedAsyncPresetFactory, MimicsResolvedAsyncPresetFactory, Presets, ReturnsAsyncPresetFactory, RootMockProvider, ThrowsAsyncPresetFactory } from "moq.ts/internal";
import { AutoPollConfigService, POLL_EXPIRATION_TOLERANCE_MS } from "../src/AutoPollConfigService";
import { ExternalConfigCache, IConfigCache, InMemoryConfigCache } from "../src/ConfigCatCache";
import { AutoPollOptions, LazyLoadOptions, ManualPollOptions, OptionsBase } from "../src/ConfigCatClientOptions";
import { LoggerWrapper } from "../src/ConfigCatLogger";
import { FetchResult, IConfigFetcher, IFetchResponse } from "../src/ConfigFetcher";
import { ClientCacheState } from "../src/ConfigServiceBase";
import { LazyLoadConfigService } from "../src/LazyLoadConfigService";
import { ManualPollConfigService } from "../src/ManualPollConfigService";
import { Config, IConfig, ProjectConfig } from "../src/ProjectConfig";
import { AbortToken, delay, throwError } from "../src/Utils";
import { FakeCache, FakeConfigFetcherBase, FakeExternalAsyncCache, FakeExternalCache, FakeLogger } from "./helpers/fakes";

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

  for (const expectedCacheState of [ClientCacheState.NoFlagData, ClientCacheState.HasCachedFlagDataOnly, ClientCacheState.HasUpToDateFlagData]) {
    it(`AutoPollConfigService - Should emit clientReady in offline mode when sync with external cache is completed - expectedCacheState: ${expectedCacheState}`, async () => {

      // Arrange

      const pollIntervalSeconds = 1;

      let projectConfig: ProjectConfig | undefined;
      if (expectedCacheState !== ClientCacheState.NoFlagData) {
        const fr: FetchResult = createFetchResult("oldEtag");
        projectConfig = createConfigFromFetchResult(fr);

        if (expectedCacheState === ClientCacheState.HasCachedFlagDataOnly) {
          projectConfig = projectConfig
            .with(ProjectConfig.generateTimestamp() - (1.5 * pollIntervalSeconds * 1000) + 0.5 * POLL_EXPIRATION_TOLERANCE_MS);
        }
      }

      const logger = new LoggerWrapper(new FakeLogger());
      const cache = new ExternalConfigCache(new FakeExternalCache(), logger);

      const options = new AutoPollOptions(
        "APIKEY", "common", "1.0.0",
        {
          pollIntervalSeconds,
          offline: true,
        },
        () => cache
      );

      if (projectConfig) {
        cache.set(options.getCacheKey(), projectConfig);
      }

      const fetcherMock = new Mock<IConfigFetcher>();

      // Act

      const service: AutoPollConfigService = new AutoPollConfigService(
        fetcherMock.object(),
        options);

      const { readyPromise } = service;
      const delayAbortToken = new AbortToken();
      const delayPromise = delay(pollIntervalSeconds * 1000 - 250, delayAbortToken);
      const raceResult = await Promise.race([readyPromise, delayPromise]);

      // Assert

      assert.strictEqual(raceResult, expectedCacheState);

      // Cleanup

      service.dispose();
    });
  }

  for (const useSyncCache of [false, true]) {
    it(`AutoPollConfigService - Should refresh local cache in offline mode and report configChanged when new config is synced from external cache - useSyncCache: ${useSyncCache}`, async () => {

      // Arrange

      const pollIntervalSeconds = 1;

      const logger = new LoggerWrapper(new FakeLogger());
      const fakeExternalCache = useSyncCache ? new FakeExternalCache() : new FakeExternalAsyncCache(50);
      const cache = new ExternalConfigCache(fakeExternalCache, logger);

      const clientReadyEvents: ClientCacheState[] = [];
      const configChangedEvents: IConfig[] = [];

      const options = new AutoPollOptions(
        "APIKEY", "common", "1.0.0",
        {
          pollIntervalSeconds,
          setupHooks: hooks => {
            hooks.on("clientReady", cacheState => clientReadyEvents.push(cacheState));
            hooks.on("configChanged", config => configChangedEvents.push(config));
          },
        },
        () => cache
      );

      const fr: FetchResult = createFetchResult();
      const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()))
        .returnsAsync({ statusCode: 200, reasonPhrase: "OK", eTag: fr.config.httpETag, body: fr.config.configJson });

      // Act

      const service: AutoPollConfigService = new AutoPollConfigService(
        fetcherMock.object(),
        options);

      assert.isUndefined(fakeExternalCache.cachedValue);

      assert.isEmpty(clientReadyEvents);
      assert.isEmpty(configChangedEvents);

      await service.readyPromise;

      const getConfigPromise = service.getConfig();
      await service.getConfig(); // simulate concurrent cache sync up
      await getConfigPromise;

      await delay(100); // allow a little time for the client to raise ConfigChanged

      assert.isDefined(fakeExternalCache.cachedValue);

      assert.strictEqual(1, clientReadyEvents.length);
      assert.strictEqual(ClientCacheState.HasUpToDateFlagData, clientReadyEvents[0]);
      assert.strictEqual(1, configChangedEvents.length);
      assert.strictEqual(JSON.stringify(fr.config.config), JSON.stringify(configChangedEvents[0]));

      fetcherMock.verify(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>()), Times.Once());

      service.setOffline(); // no HTTP fetching from this point on

      await delay(pollIntervalSeconds * 1000 + 50);

      assert.strictEqual(1, clientReadyEvents.length);
      assert.strictEqual(1, configChangedEvents.length);

      const fr2: FetchResult = createFetchResult("etag2", "{}");
      const projectConfig2 = createConfigFromFetchResult(fr2);
      fakeExternalCache.cachedValue = ProjectConfig.serialize(projectConfig2);

      const [refreshResult, projectConfigFromRefresh] = await service.refreshConfigAsync();

      // Assert

      assert.isTrue(refreshResult.isSuccess);

      assert.strictEqual(1, clientReadyEvents.length);
      assert.strictEqual(2, configChangedEvents.length);
      assert.strictEqual(JSON.stringify(fr2.config.config), JSON.stringify(configChangedEvents[1]));
      assert.strictEqual(configChangedEvents[1], projectConfigFromRefresh.config);

      // Cleanup

      service.dispose();
    });
  }

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

  it("refreshConfigAsync() - only one config refresh should be in progress at a time - success", async () => {

    // Arrange

    const fakeFetcher = new FakeConfigFetcherBase(null, 1000,
      () => ({ statusCode: 200, reasonPhrase: "OK", eTag: '"ETAG2"', body: '{ "p": { "s": "0" } }' }));

    const lastConfig = createProjectConfig('"ETAG"', "{}");

    const cacheMock = new Mock<IConfigCache>()
      .setup(m => m.get(It.IsAny<string>()))
      .returns(lastConfig)
      .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
      .returns();

    const configChangedEvents: IConfig[] = [];

    const service = new ManualPollConfigService(
      fakeFetcher,
      new ManualPollOptions(
        "APIKEY", "common", "1.0.0",
        {
          setupHooks: hooks => {
            hooks.on("configChanged", config => configChangedEvents.push(config));
          },
        },
        () => cacheMock.object()
      ));

    // Act

    const promise1 = (async () => { await delay(0); return await service.refreshConfigAsync(); })();
    const promise2 = service.refreshConfigAsync();

    const [[refreshResult1, config1], [refreshResult2, config2]] = await Promise.all([promise1, promise2]);

    // Assert

    assert.strictEqual(fakeFetcher.calledTimes, 1);
    assert.isTrue(refreshResult1.isSuccess);
    assert.isTrue(refreshResult2.isSuccess);
    assert.strictEqual(config1, config2);

    assert.strictEqual(configChangedEvents.length, 1);
    const [configChangedEvent] = configChangedEvents;
    assert.strictEqual(configChangedEvent.salt, "0");

    service.dispose();
  });

  it("refreshConfigAsync() - only one config refresh should be in progress at a time - failure", async () => {

    // Arrange

    const fetchError = Error("Something went wrong.");

    const fakeFetcher = new FakeConfigFetcherBase(null, 1000,
      () => throwError(fetchError));

    const lastConfig = createProjectConfig('"ETAG"', "{}");

    const cacheMock = new Mock<IConfigCache>()
      .setup(m => m.get(It.IsAny<string>()))
      .returns(lastConfig)
      .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
      .returns();

    const configChangedEvents: IConfig[] = [];

    const service = new ManualPollConfigService(
      fakeFetcher,
      new ManualPollOptions(
        "APIKEY", "common", "1.0.0",
        {
          setupHooks: hooks => {
            hooks.on("configChanged", config => configChangedEvents.push(config));
          },
        },
        () => cacheMock.object()
      ));

    // Act

    const promise1 = (async () => { await delay(0); return await service.refreshConfigAsync(); })();
    const promise2 = service.refreshConfigAsync();

    const [[refreshResult1, config1], [refreshResult2, config2]] = await Promise.all([promise1, promise2]);

    // Assert

    assert.strictEqual(fakeFetcher.calledTimes, 1);
    assert.isFalse(refreshResult1.isSuccess);
    assert.strictEqual(refreshResult1.errorException, fetchError);
    assert.isFalse(refreshResult2.isSuccess);
    assert.strictEqual(refreshResult2.errorException, fetchError);
    assert.strictEqual(config1, config2);

    assert.strictEqual(configChangedEvents.length, 0);

    service.dispose();
  });

});

const DEFAULT_ETAG = "etag";
const DEFAULT_CONFIG_JSON = '{"f": { "debug": { "v": { "b": true }, "i": "abcdefgh", "t": 0, "p": [], "r": [] } } }';

function createProjectConfig(eTag = DEFAULT_ETAG, configJson = DEFAULT_CONFIG_JSON): ProjectConfig {
  return new ProjectConfig(
    configJson,
    Config.deserialize(configJson),
    1,
    eTag);
}

function createFetchResult(eTag = DEFAULT_ETAG, configJson = DEFAULT_CONFIG_JSON): FetchResult {
  return FetchResult.success(createProjectConfig(eTag, configJson));
}

function createConfigFromFetchResult(result: FetchResult): ProjectConfig {
  return result.config.with(ProjectConfig.generateTimestamp());
}
