import "mocha";
import { OptionsBase, AutoPollOptions, LazyLoadOptions } from "../src/ConfigCatClientOptions";
import { ICache, IConfigFetcher, ProjectConfig } from "../src";
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

        const pc: ProjectConfig = CreateProjectConfig();

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(pc));

        let callNo: number = 1;

        const cacheMock = new Mock<ICache>()
        .setup(m => m.get(It.IsAny<string>()))
        .callback(() => {return callNo++ === 1 ? null : pc})
        .setup(m => m.set(It.IsAny<string>(), pc))
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

        cacheMock.verify(v => v.set(It.IsAny<string>(), pc), Times.Once());
        fetcherMock.verify(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()), Times.AtLeast(3));
    });

    it("AutoPollConfigService - with forceRefresh - invokes 'cache.set' operation two times", async () => {

        // Arrange

        const pc: ProjectConfig = CreateProjectConfig();

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(pc));

        let callNo: number = 1;

        const cacheMock = new Mock<ICache>()
        .setup(m => m.get(It.IsAny<string>()))
        .callback((_) => {return callNo++ === 1 ? null : pc})
        .setup(m => m.set(It.IsAny<string>(), pc))
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

        cacheMock.verify(v => v.set(It.IsAny<string>(), pc), Times.Exactly(2));        
    });

    it("AutoPollConfigService - ProjectConfig is cached and fetch returns same value - should never invokes 'cache.set' operation", async () => {

        // Arrange

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(CreateProjectConfig()));

        const cacheMock = new Mock<ICache>()
        .setup(m => m.get(It.IsAny<string>()))
        .returns(CreateProjectConfig())
        .setup(m => m.set(It.IsAny<string>(), CreateProjectConfig()))
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

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(CreateProjectConfig()));

        const cacheMock = new Mock<ICache>(asyncInjectorServiceConfig)
        .setup(async m => m.get(It.IsAny<string>()))
        .returnsAsync(CreateProjectConfig())
        .setup(async m => m.set(It.IsAny<string>(), CreateProjectConfig()))
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
        const oldConfig: ProjectConfig = CreateProjectConfig();
        oldConfig.Timestamp = new Date().getTime() - (cacheTimeToLiveSeconds * 1000);
        oldConfig.HttpETag = "oldConfig";        

        const newConfig: ProjectConfig = CreateProjectConfig();
        newConfig.Timestamp = new Date().getTime();
        newConfig.HttpETag = "newConfig";

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(newConfig));

        const cacheMock = new Mock<ICache>()
        .setup(m => m.get(It.IsAny<string>()))
        .returns(oldConfig)
        .setup(m => m.set(It.IsAny<string>(), newConfig))
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
        
        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), oldConfig, It.IsAny<any>()), Times.Once());
        cacheMock.verify(v => v.set(It.IsAny<string>(), newConfig), Times.Once());        
    });

    it("LazyLoadConfigService - ProjectConfig is cached - should not invoke fetch", async () => {

        // Arrange

        const config: ProjectConfig = CreateProjectConfig();
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
        
        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()), Times.Never());             
    });

    it("LazyLoadConfigService - refreshConfigAsync - should invoke fetch and cache.set operation", async () => {

        // Arrange

        const config: ProjectConfig = CreateProjectConfig();
        config.Timestamp = new Date().getTime();
         
        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(config));

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
        
        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()), Times.Once());             
        cacheMock.verify(v => v.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()), Times.Once());
    });

    it("LazyLoadConfigService - refreshConfigAsync - should invoke fetch and cache.set operation - async cache supported", async () => {

        // Arrange

        const config: ProjectConfig = CreateProjectConfig();
        config.Timestamp = new Date().getTime();

        const fetcherMock = new Mock<IConfigFetcher>()
        .setup(m => m.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()))
        .callback(({args: [a1, a2, cb]}) => cb(config));

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

        fetcherMock.verify(v => v.fetchLogic(It.IsAny<OptionsBase>(), It.IsAny<ProjectConfig>(), It.IsAny<any>()), Times.Once());
        cacheMock.verify(v => v.set(It.IsAny<string>(), It.IsAny<ProjectConfig>()), Times.Once());
    });
});

function CreateProjectConfig(): ProjectConfig {
    return new ProjectConfig(
        1,
        "{\"f\": { \"debug\": { \"v\": true, \"i\": \"abcdefgh\", \"t\": 0, \"p\": [], \"r\": [] } } }",
        "etag");
}
