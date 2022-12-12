import { assert } from "chai";
import "mocha";
import { EqualMatchingInjectorConfig, It, Mock, RejectedPromiseFactory, ResolvedPromiseFactory, Times } from 'moq.ts';
import { MimicsRejectedAsyncPresetFactory, MimicsResolvedAsyncPresetFactory, Presets, ReturnsAsyncPresetFactory, RootMockProvider, ThrowsAsyncPresetFactory } from "moq.ts/internal";
import { AutoPollConfigService } from "../src/AutoPollConfigService";
import { ICache, InMemoryCache } from "../src/Cache";
import { AutoPollOptions, LazyLoadOptions, ManualPollOptions, OptionsBase } from "../src/ConfigCatClientOptions";
import { FetchResult, IConfigFetcher } from "../src/ConfigFetcher";
import { LazyLoadConfigService } from "../src/LazyLoadConfigService";
import { ProjectConfig } from "../src/ProjectConfig";
import { delay } from "../src/Utils";
import { FakeCache } from "./helpers/fakes";
import { ManualPollConfigService } from "../src/ManualPollConfigService";

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
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [a1, a2, cb] }) => cb(fr));

        let callNo: number = 1;

        const cacheMock = new Mock<ICache>()
            .setup(m => m.get(It.IsAny<string>()))
            .callback(() => { return callNo++ === 1 ? null : pc })
            .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
            .returns();

        const pollIntervalSeconds = 1;

        // Act

        const service: AutoPollConfigService = new AutoPollConfigService(
            fetcherMock.object(),
            new AutoPollOptions(
                "APIKEY", "common", "1.0.0",
                { pollIntervalSeconds },
                cacheMock.object()));

        await delay(2.5 * pollIntervalSeconds * 1000);

        // Assert

        cacheMock.verify(v => v.set(It.IsAny<string>(), It.Is<ProjectConfig>(c => c.HttpETag == fr.eTag && JSON.stringify(c.ConfigJSON) == JSON.stringify(pc.ConfigJSON))), Times.Exactly(3));
        fetcherMock.verify(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.AtLeast(3));
        
        service.dispose();
    });

    it("AutoPollConfigService - with forceRefresh - invokes 'cache.set' operation two times", async () => {

        // Arrange

        const fr: FetchResult = createFetchResult();
        const pc: ProjectConfig = createConfigFromFetchResult(fr);

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [a1, a2, cb] }) => cb(fr));

        let callNo: number = 1;

        const cacheMock = new Mock<ICache>()
            .setup(m => m.get(It.IsAny<string>()))
            .callback((_) => { return callNo++ === 1 ? null : pc })
            .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
            .returns();

        const pollIntervalSeconds = 1;

        // Act

        const service: AutoPollConfigService = new AutoPollConfigService(
            fetcherMock.object(),
            new AutoPollOptions(
                "APIKEY", "common", "1.0.0",
                { pollIntervalSeconds },
                cacheMock.object()));

        await delay(0.5 * pollIntervalSeconds * 1000);

        await service.refreshConfigAsync();

        // Assert

        cacheMock.verify(v => v.set(It.IsAny<string>(), It.Is<ProjectConfig>(c => c.HttpETag == fr.eTag && JSON.stringify(c.ConfigJSON) == JSON.stringify(pc.ConfigJSON))), Times.Exactly(2));
        
        service.dispose();
    });

    it("AutoPollConfigService - ProjectConfig is cached and fetch returns same value at first then errors - should invoke the 'cache.set' operation only once (at first)", async () => {

        // Arrange

        const pc: ProjectConfig = createProjectConfig();
        const fr: FetchResult = createFetchResult();
        let currentFr: FetchResult = fr;

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [a1, a2, cb] }) => (cb(currentFr), currentFr = FetchResult.error()));

        const cacheMock = new Mock<ICache>()
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
                cacheMock.object()));

        await delay(2.5 * pollIntervalSeconds * 1000);

        // Assert

        cacheMock.verify(v => v.set(
            It.IsAny<string>(),
            It.Is<ProjectConfig>(c => c.HttpETag == fr.eTag && JSON.stringify(c.ConfigJSON) == JSON.stringify(pc.ConfigJSON))),
            Times.Once());

            
        service.dispose();
    });

    it("AutoPollConfigService - Cached config is the same as ProjectConfig but older than the polling time - Should wait until the cache is updated with the new etag", async () => {

        // Arrange

        const frNew: FetchResult = createFetchResult();
        frNew.eTag = "newEtag";
        const frOld: FetchResult = createFetchResult();
        frOld.eTag = "oldEtag";

        const pollInterval: number = 10;

        const projectConfigNew: ProjectConfig = createConfigFromFetchResult(frNew);
        const projectConfigOld: ProjectConfig = createConfigFromFetchResult(frOld);

        const time: number = new Date().getTime();
        projectConfigOld.Timestamp = time - (1.5 * pollInterval * 1000);

        const cache: ICache = new InMemoryCache();

        const options: AutoPollOptions = new AutoPollOptions(
            "APIKEY", "common", "1.0.0",
            {
                pollIntervalSeconds: pollInterval,
                maxInitWaitTimeSeconds: 100
            },
            cache);

        await cache.set(options.getCacheKey(), projectConfigOld);

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [_, __, cb] }) => {
                setTimeout(() => cb(frNew), 100);
            });

        // Act

        const service: AutoPollConfigService = new AutoPollConfigService(
            fetcherMock.object(),
            options);

        const actualProjectConfig: ProjectConfig | null = await service.getConfig();

        // Assert

        assert.isNotNull(actualProjectConfig?.HttpETag);
        assert.isNotNull(actualProjectConfig?.ConfigJSON);
        assert.equal(actualProjectConfig?.HttpETag, projectConfigNew.HttpETag);
        assert.equal(JSON.stringify(actualProjectConfig?.ConfigJSON), JSON.stringify(projectConfigNew?.ConfigJSON));
        
        service.dispose();
    });

    it("AutoPollConfigService - Cached config is the same as ProjectConfig but older than the polling time - Should return cached item", async () => {

        // Arrange

        const frNew: FetchResult = createFetchResult();
        frNew.eTag = "newEtag";
        const frOld: FetchResult = createFetchResult();
        frOld.eTag = "oldEtag";

        const pollInterval: number = 10;

        const projectConfigNew: ProjectConfig = createConfigFromFetchResult(frNew);
        const projectConfigOld: ProjectConfig = createConfigFromFetchResult(frOld);

        const time: number = new Date().getTime();
        projectConfigOld.Timestamp = time - (pollInterval * 999);

        const cache: ICache = new InMemoryCache();

        const options: AutoPollOptions = new AutoPollOptions(
            "APIKEY", "common", "1.0.0",
            {
                pollIntervalSeconds: pollInterval,
                maxInitWaitTimeSeconds: 100
            },
            cache);

        await cache.set(options.getCacheKey(), projectConfigOld);

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [_, __, cb] }) => {
                setTimeout(() => cb(projectConfigNew), 100);
            });

        // Act

        const service: AutoPollConfigService = new AutoPollConfigService(
            fetcherMock.object(),
            options);

        const actualProjectConfig: ProjectConfig | null = await service.getConfig();

        // Assert

        assert.isNotNull(actualProjectConfig?.HttpETag);
        assert.isNotNull(actualProjectConfig?.ConfigJSON);
        assert.equal(actualProjectConfig?.HttpETag, projectConfigOld.HttpETag);
        assert.equal(JSON.stringify(actualProjectConfig?.ConfigJSON), JSON.stringify(projectConfigOld?.ConfigJSON));
        assert.equal(actualProjectConfig?.Timestamp, projectConfigOld.Timestamp);

        service.dispose();
    });

    it("AutoPollConfigService - ProjectConfigs are same but cache stores older config than poll interval and fetch operation is longer than maxInitWaitTimeSeconds - Should return cached item", async () => {

        // Arrange

        const pollIntervalSeconds: number = 10;

        const fr: FetchResult = createFetchResult();

        const projectConfigOld: ProjectConfig = createConfigFromFetchResult(fr);

        const cache: ICache = new InMemoryCache();

        const options: AutoPollOptions = new AutoPollOptions(
            "APIKEY", "common", "1.0.0",
            {
                pollIntervalSeconds: pollIntervalSeconds,
                maxInitWaitTimeSeconds: 1
            },
            cache);

        await cache.set(options.getCacheKey(), projectConfigOld);

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()))
            .callback(({ args: [_, __, cb] }) => {
                setTimeout(() => cb(FetchResult.error()), 2000)
            });

        // Act

        const service: AutoPollConfigService = new AutoPollConfigService(
            fetcherMock.object(),
            options);

        const actualProjectConfig: ProjectConfig | null = await service.getConfig();

        // Assert

        assert.isNotNull(actualProjectConfig?.HttpETag);
        assert.isNotNull(actualProjectConfig?.ConfigJSON);
        assert.equal(actualProjectConfig?.HttpETag, projectConfigOld.HttpETag);
        assert.equal(JSON.stringify(actualProjectConfig?.ConfigJSON), JSON.stringify(projectConfigOld?.ConfigJSON));

        service.dispose();
    });

    it("LazyLoadConfigService - ProjectConfig is different in the cache - should fetch a new config and put into cache", async () => {

        // Arrange

        const cacheTimeToLiveSeconds: number = 10;
        const oldConfig: ProjectConfig = createProjectConfig();
        oldConfig.Timestamp = new Date().getTime() - (cacheTimeToLiveSeconds * 1000) - 1000;
        oldConfig.HttpETag = "oldConfig";

        const fr: FetchResult = createFetchResult();
        fr.eTag = "newConfig";

        const newConfig: ProjectConfig = createConfigFromFetchResult(fr);

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [a1, a2, cb] }) => cb(fr));

        const cacheMock = new Mock<ICache>()
            .setup(m => m.get(It.IsAny<string>()))
            .returns(oldConfig)
            .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
            .returns();

        const service: LazyLoadConfigService = new LazyLoadConfigService(
            fetcherMock.object(),
            new LazyLoadOptions(
                "APIKEY", "common", "1.0.0",
                { cacheTimeToLiveSeconds: cacheTimeToLiveSeconds },
                cacheMock.object()));

        // Act

        const actualConfig = await service.getConfig();

        // Assert

        assert.isTrue(ProjectConfig.equals(actualConfig, newConfig));

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), "oldConfig", It.IsAny<any>()), Times.Once());
        cacheMock.verify(v => v.set(It.IsAny<string>(), It.Is<ProjectConfig>(c => c.HttpETag == fr.eTag && JSON.stringify(c.ConfigJSON) == JSON.stringify(newConfig.ConfigJSON))), Times.Once());
    });

    it("LazyLoadConfigService - ProjectConfig is cached - should not invoke fetch", async () => {

        // Arrange

        const config: ProjectConfig = createProjectConfig();
        config.Timestamp = new Date().getTime();

        const fetcherMock = new Mock<IConfigFetcher>();

        const cacheMock = new Mock<ICache>()
            .setup(m => m.get(It.IsAny<string>()))
            .returns(config);

        const service: LazyLoadConfigService = new LazyLoadConfigService(
            fetcherMock.object(),
            new LazyLoadOptions(
                "APIKEY", "common", "1.0.0",
                {},
                cacheMock.object()));

        // Act

        const actualConfig = await service.getConfig();

        // Assert

        assert.isTrue(ProjectConfig.equals(actualConfig, config));

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.Never());
    });

    it("LazyLoadConfigService - refreshConfigAsync - should invoke fetch and cache.set operation", async () => {

        // Arrange

        const config: ProjectConfig = createProjectConfig();
        config.Timestamp = new Date().getTime() - 1000;

        const fr: FetchResult = createFetchResult();

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [a1, a2, cb] }) => cb(fr));

        const cacheMock = new Mock<ICache>()
            .setup(m => m.get(It.IsAny<string>()))
            .returns(config)
            .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
            .returns();

        const service: LazyLoadConfigService = new LazyLoadConfigService(
            fetcherMock.object(),
            new LazyLoadOptions(
                "APIKEY", "common", "1.0.0",
                {},
                cacheMock.object()));

        // Act

        const actualConfig = await service.refreshConfigAsync()

        // Assert

        assert.isTrue(ProjectConfig.equals(actualConfig, config));

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.Once());
        cacheMock.verify(v => v.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()), Times.Once());
    });

    it("LazyLoadConfigService - refreshConfigAsync - should invoke fetch and cache.set operation - async cache supported", async () => {

        // Arrange

        const config: ProjectConfig = createProjectConfig();
        config.Timestamp = new Date().getTime() - 1000;

        const fr: FetchResult = createFetchResult();

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [a1, a2, cb] }) => cb(fr));

        const cacheMock = new Mock<ICache>(asyncInjectorServiceConfig)
            .setup(async m => m.get(It.IsAny<string>()))
            .returnsAsync(config)
            .setup(async m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
            .returnsAsync();

        const service: LazyLoadConfigService = new LazyLoadConfigService(
            fetcherMock.object(),
            new LazyLoadOptions(
                "APIKEY", "common", "1.0.0",
                {},
                cacheMock.object()));

        // Act

        const actualConfig = await service.refreshConfigAsync()

        // Assert

        assert.isTrue(ProjectConfig.equals(actualConfig, config));

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.Once());
        cacheMock.verify(v => v.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()), Times.Once());
    });

    it("AutoPollConfigService - getConfig() should return cached config when cached config is not expired", async () => {
        // Arrange 

        const pollIntervalSeconds = 2;

        const fr: FetchResult = createFetchResult();

        const cachedPc: ProjectConfig = createConfigFromFetchResult(fr);
        cachedPc.Timestamp -= 0.5 * pollIntervalSeconds * 1000;

        const cache = new FakeCache();
        cache.set("", cachedPc);

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [, , cb] }) => cb(fr));

        const options = new AutoPollOptions(
            "APIKEY", "common", "1.0.0",
            {
                pollIntervalSeconds,
                maxInitWaitTimeSeconds: 500
            },
            cache);

        // Act

        const service = new AutoPollConfigService(fetcherMock.object(), options);

        const actualPc = await service.getConfig();

        // Assert

        assert.strictEqual(cachedPc, actualPc);

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.Never());
    });

    it("AutoPollConfigService - getConfig() should wait for fetch when cached config is expired", async () => {
        // Arrange 

        const pollIntervalSeconds = 2;

        const fr: FetchResult = createFetchResult();

        const cachedPc: ProjectConfig = createConfigFromFetchResult(fr);
        cachedPc.Timestamp -= 1.5 * pollIntervalSeconds * 1000;

        const cache = new FakeCache();
        cache.set("", cachedPc);

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [, , cb] }) => { (async () => (await delay(500), cb(fr)))(); });

        const options = new AutoPollOptions(
            "APIKEY", "common", "1.0.0",
            {
                pollIntervalSeconds,
                maxInitWaitTimeSeconds: 1000
            },
            cache);

        // Act

        const service = new AutoPollConfigService(fetcherMock.object(), options);

        const actualPc = await service.getConfig();

        // Assert

        assert.notStrictEqual(cachedPc, actualPc);
        assert.isTrue(ProjectConfig.equals(new ProjectConfig(0, fr.responseBody, fr.eTag), actualPc));

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.Once());
    });

    it("LazyLoadConfigService - getConfig() should return cached config when cached config is not expired", async () => {
        // Arrange 

        const cacheTimeToLiveSeconds = 5;

        const fr: FetchResult = createFetchResult();

        const cachedPc: ProjectConfig = createConfigFromFetchResult(fr);
        cachedPc.Timestamp -= 0.5 * cacheTimeToLiveSeconds * 1000;

        const cache = new FakeCache();
        cache.set("", cachedPc);

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [, , cb] }) => cb(fr));

        const options = new LazyLoadOptions(
            "APIKEY", "common", "1.0.0",
            {
                cacheTimeToLiveSeconds
            },
            cache);

        // Act

        const service = new LazyLoadConfigService(fetcherMock.object(), options);

        const actualPc = await service.getConfig();

        // Assert

        assert.strictEqual(cachedPc, actualPc);

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.Never());
    });

    it("LazyLoadConfigService - getConfig() should fetch when cached config is expired", async () => {
        // Arrange 

        const cacheTimeToLiveSeconds = 5;

        const fr: FetchResult = createFetchResult();

        const cachedPc: ProjectConfig = createConfigFromFetchResult(fr);
        cachedPc.Timestamp -= 1.5 * cacheTimeToLiveSeconds * 1000;

        const cache = new FakeCache();
        cache.set("", cachedPc);

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [, , cb] }) => { (async () => (await delay(500), cb(fr)))(); });

        const options = new LazyLoadOptions(
            "APIKEY", "common", "1.0.0",
            {
                cacheTimeToLiveSeconds
            },
            cache);

        // Act

        const service = new LazyLoadConfigService(fetcherMock.object(), options);

        const actualPc = await service.getConfig();

        // Assert

        assert.notStrictEqual(cachedPc, actualPc);
        assert.isTrue(ProjectConfig.equals(new ProjectConfig(0, fr.responseBody, fr.eTag), actualPc));

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.Once());
    });

    it("refreshConfigAsync() should return null config when cache is empty and fetch fails.", async () => {

        // Arrange

        const fr: FetchResult = FetchResult.error();

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [a1, a2, cb] }) => cb(fr));


        const cache = new InMemoryCache();

        const options = new ManualPollOptions(
            "APIKEY", "common", "1.0.0",
            {},
            cache);

        const service = new ManualPollConfigService(fetcherMock.object(), options);

        // Act

        const projectConfig =  await service.refreshConfigAsync();

        // Assert

        assert.isNull(projectConfig);
        assert.isNull(cache.get(options.getCacheKey()));
    });

    it("refreshConfigAsync() should return latest config when cache is empty and fetch fails.", async () => {

        // Arrange

        const cachedPc: ProjectConfig = createConfigFromFetchResult(createFetchResult());
        const fr: FetchResult = FetchResult.error();

        const fetcherMock = new Mock<IConfigFetcher>()
            .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
            .callback(({ args: [a1, a2, cb] }) => cb(fr));

        const cache = new InMemoryCache();

        const options = new ManualPollOptions(
            "APIKEY", "common", "1.0.0",
            {},
            cache);

        cache.set(options.getCacheKey(), cachedPc);

        const service = new ManualPollConfigService(fetcherMock.object(), options);

        // Act

        const projectConfig =  await service.refreshConfigAsync();

        // Assert

        assert.strictEqual(projectConfig, cachedPc);
        assert.strictEqual(cache.get(options.getCacheKey()), cachedPc);
    });
});

function createProjectConfig(): ProjectConfig {
    return new ProjectConfig(
        1,
        "{\"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }",
        "etag");
}

function createFetchResult(): FetchResult {
    return FetchResult.success("{\"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }",
        "etag");
}

function createConfigFromFetchResult(result: FetchResult): ProjectConfig {
    return new ProjectConfig(new Date().getTime(), result.responseBody, result.eTag);
}
