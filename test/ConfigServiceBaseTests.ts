import "mocha";
import { OptionsBase, AutoPollOptions, LazyLoadOptions } from "../src/ConfigCatClientOptions";
import { FetchResult, ICache, IConfigFetcher, ProjectConfig } from "../src";
import { ConfigServiceBase } from "../src/ConfigServiceBase";
import { AutoPollConfigService } from "../src/AutoPollConfigService";
import { Mock, It, Times, EqualMatchingInjectorConfig, ResolvedPromiseFactory, RejectedPromiseFactory } from 'moq.ts';
import { ReturnsAsyncPresetFactory, ThrowsAsyncPresetFactory, MimicsResolvedAsyncPresetFactory, MimicsRejectedAsyncPresetFactory, RootMockProvider, Presets } from "moq.ts/internal";
import { LazyLoadConfigService } from "../src/LazyLoadConfigService";
import { assert } from "chai";

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

    it("AutoPollConfigService - backgroundworker only - config doesn't exits in the cache - invokes 'cache.set' operation only once", async () => {

        // Arrange

        const fr: FetchResult = createFetchResult();
        const pc: ProjectConfig = createConfigFromFetchResult(fr);

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(fr));

        let callNo: number = 1;

        const cacheMock = new Mock<ICache>()
        .setup(m => m.get(It.IsAny<string>()))
        .callback(() => {return callNo++ === 1 ? null : pc})
        .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
        .returns();

        // Act

        const _: ConfigServiceBase = new AutoPollConfigService(
            fetcherMock.object(),
            new AutoPollOptions(
                "APIKEY",
                { pollIntervalSeconds: 1 },
                cacheMock.object()));
        
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Assert

        cacheMock.verify(v => v.set(It.IsAny<string>(), It.Is<ProjectConfig>(c => c.HttpETag == fr.eTag && JSON.stringify(c.ConfigJSON) == JSON.stringify(pc.ConfigJSON))), Times.Once());
        fetcherMock.verify(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.AtLeast(3));
    });

    it("AutoPollConfigService - with forceRefresh - invokes 'cache.set' operation two times", async () => {

        // Arrange

        const fr: FetchResult = createFetchResult();
        const pc: ProjectConfig = createConfigFromFetchResult(fr);

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(fr));

        let callNo: number = 1;

        const cacheMock = new Mock<ICache>()
        .setup(m => m.get(It.IsAny<string>()))
        .callback((_) => {return callNo++ === 1 ? null : pc})
        .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
        .returns();

        // Act

        const service : AutoPollConfigService = new AutoPollConfigService(
            fetcherMock.object(),
            new AutoPollOptions(
                "APIKEY",
                { pollIntervalSeconds: 1 },
                cacheMock.object()));
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        await service.refreshConfigAsync();

        // Assert

        cacheMock.verify(v => v.set(It.IsAny<string>(), It.Is<ProjectConfig>(c => c.HttpETag == fr.eTag && JSON.stringify(c.ConfigJSON) == JSON.stringify(pc.ConfigJSON))), Times.Exactly(2));        
    });

    it("AutoPollConfigService - ProjectConfig is cached and fetch returns same value - should never invokes 'cache.set' operation", async () => {

        // Arrange

        const pc: ProjectConfig = createProjectConfig();
        const fr: FetchResult = createFetchResult();

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(fr));

        const cacheMock = new Mock<ICache>()
        .setup(m => m.get(It.IsAny<string>()))
        .returns(pc)
        .setup(m => m.set(It.IsAny<string>(), pc))
        .returns();

        // Act

        const service : AutoPollConfigService = new AutoPollConfigService(
            fetcherMock.object(),
            new AutoPollOptions(
                "APIKEY",
                { pollIntervalSeconds: 1 },
                cacheMock.object()));
        
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Assert

        cacheMock.verify(v => v.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()), Times.Never());        
    });

    it("AutoPollConfigService - Async cache is supported", async () => {
        // Arrange
        const pc: ProjectConfig = createProjectConfig();
        const fr: FetchResult = createFetchResult();

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(fr));

        const cacheMock = new Mock<ICache>(asyncInjectorServiceConfig)
        .setup(async m => m.get(It.IsAny<string>()))
        .returnsAsync(pc)
        .setup(async m => m.set(It.IsAny<string>(), pc))
        .returnsAsync();

        // Act

        const service : AutoPollConfigService = new AutoPollConfigService(
            fetcherMock.object(),
            new AutoPollOptions(
                "APIKEY",
                { pollIntervalSeconds: 1 },
                cacheMock.object()));

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Assert

        cacheMock.verify(v => v.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()), Times.Never());
    });

    it("LazyLoadConfigService - ProjectConfig is older in the cache - should fetch a new config and put into cache", async () => {

        // Arrange

        const cacheTimeToLiveSeconds: number = 10;
        const oldConfig: ProjectConfig = createProjectConfig();
        oldConfig.Timestamp = new Date().getTime() - (cacheTimeToLiveSeconds * 1000);
        oldConfig.HttpETag = "oldConfig";        

        const fr: FetchResult = createFetchResult();
        fr.eTag = "newConfig";

        const newConfig: ProjectConfig = createConfigFromFetchResult(fr);

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(fr));

        const cacheMock = new Mock<ICache>()
        .setup(m => m.get(It.IsAny<string>()))
        .returns(oldConfig)
        .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
        .returns();

        const service : LazyLoadConfigService = new LazyLoadConfigService(
            fetcherMock.object(),
            new LazyLoadOptions(
                "APIKEY",
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
       
        const service : LazyLoadConfigService = new LazyLoadConfigService(
            fetcherMock.object(),
            new LazyLoadOptions(
                "APIKEY",
                { },
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
        config.Timestamp = new Date().getTime();

        const fr: FetchResult = createFetchResult();
         
        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(fr));

        const cacheMock = new Mock<ICache>()
        .setup(m => m.get(It.IsAny<string>()))
        .returns(config)
        .setup(m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
        .returns();

        const service : LazyLoadConfigService = new LazyLoadConfigService(
            fetcherMock.object(),
            new LazyLoadOptions(
                "APIKEY",
                { },
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
        config.Timestamp = new Date().getTime();

        const fr: FetchResult = createFetchResult();

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(fr));

        const cacheMock = new Mock<ICache>(asyncInjectorServiceConfig)
        .setup(async m => m.get(It.IsAny<string>()))
        .returnsAsync(config)
        .setup(async m => m.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()))
        .returnsAsync();

        const service : LazyLoadConfigService = new LazyLoadConfigService(
            fetcherMock.object(),
            new LazyLoadOptions(
                "APIKEY",
                { },
                cacheMock.object()));

        // Act

        const actualConfig = await service.refreshConfigAsync()

        // Assert

        assert.isTrue(ProjectConfig.equals(actualConfig, config));

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<string>(), It.IsAny<any>()), Times.Once());
        cacheMock.verify(v => v.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()), Times.Once());
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
