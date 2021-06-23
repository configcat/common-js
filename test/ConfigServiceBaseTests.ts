import "mocha";
import { OptionsBase, AutoPollOptions, LazyLoadOptions } from "../src/ConfigCatClientOptions";
import { ICache, IConfigFetcher, ProjectConfig } from "../src";
import { ConfigServiceBase } from "../src/ConfigServiceBase";
import { AutoPollConfigService } from "../src/AutoPollConfigService";
import { Mock, It, Times } from 'moq.ts';
import { LazyLoadConfigService } from "../src/LazyLoadConfigService";
import { assert } from "chai";

describe("ConfigServiceBaseTests", () => {

    it("AutoPollConfigService - backgroundworker only - config doesn't exits in the cache - invokes 'cache.set' operation only once", async () => {

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

        const _: ConfigServiceBase = new AutoPollConfigService(
            fetcherMock.object(),
            new AutoPollOptions(
                "SDKKEY",
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
                "SDKKEY",
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
                "SDKKEY",
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
                "SDKKEY",
                { cacheTimeToLiveSeconds: cacheTimeToLiveSeconds },
                cacheMock.object()));

        // Act

        const actualConfig:ProjectConfig = await service.getConfig();

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
                "SDKKEY",
                { },
                cacheMock.object()));

        // Act

        const actualConfig:ProjectConfig = await service.getConfig();

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
                "SDKKEY",
                { },
                cacheMock.object()));

        // Act

        const actualConfig:ProjectConfig = await service.refreshConfigAsync()

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
