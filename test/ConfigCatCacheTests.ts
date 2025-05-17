import { assert } from "chai";
import "mocha";
import { ExternalConfigCache, IConfigCache, InMemoryConfigCache, } from "../src/ConfigCatCache";
import { ManualPollOptions } from "../src/ConfigCatClientOptions";
import { LogLevel, LoggerWrapper } from "../src/ConfigCatLogger";
import { Config, ProjectConfig } from "../src/ProjectConfig";
import { FakeExternalCache, FakeLogger, FaultyFakeExternalCache } from "./helpers/fakes";

describe("ConfigCatCache", () => {
  for (const isExternal of [false, true]) {
    it(`${isExternal ? ExternalConfigCache.prototype.constructor.name : InMemoryConfigCache.prototype.constructor.name} works`, async () => {
      const cacheKey = "";

      let externalCache: FakeExternalCache | undefined;
      const [configCache, getLocalCachedConfig] = isExternal
        ? [
          new ExternalConfigCache(externalCache = new FakeExternalCache(), new LoggerWrapper(new FakeLogger())),
          (cache: IConfigCache) => (cache as ExternalConfigCache)["cachedConfig"]
        ]
        : [
          new InMemoryConfigCache(),
          (cache: IConfigCache) => (cache as InMemoryConfigCache)["cachedConfig"]
        ];

      // 1. Cache should return the empty config initially
      let cachedConfig = await configCache.get(cacheKey);
      assert.equal(ProjectConfig.empty, cachedConfig);

      // 2. When cache is empty, setting an empty config with newer timestamp should overwrite the cache (but only locally!)
      const config2 = ProjectConfig.empty.with(ProjectConfig.generateTimestamp());
      await configCache.set(cacheKey, config2);
      cachedConfig = await configCache.get(cacheKey);

      assert.equal(config2, cachedConfig);
      assert.equal(config2, getLocalCachedConfig(configCache));
      if (externalCache) {
        assert.isUndefined(externalCache.cachedValue);
      }

      // 3. When cache is empty, setting a non-empty config with any (even older) timestamp should overwrite the cache.
      const configJson = "{\"p\": {\"u\": \"http://example.com\", \"r\": 0}}";
      const config3 = new ProjectConfig(configJson, Config.deserialize(configJson), config2.timestamp - 1000, "\"ETAG\"");
      await configCache.set(cacheKey, config3);
      cachedConfig = await configCache.get(cacheKey);

      assert.equal(config3, cachedConfig);
      assert.equal(config3, getLocalCachedConfig(configCache));
      if (externalCache) {
        assert.isDefined(externalCache.cachedValue);
      }
    });
  }

  it(`${ExternalConfigCache.prototype.constructor.name} should handle when external cache fails`, async () => {
    const cacheKey = "";

    const logger = new FakeLogger(LogLevel.Warn);

    const externalCache = new FaultyFakeExternalCache();
    const configCache = new ExternalConfigCache(externalCache, new LoggerWrapper(logger));

    // 1. Initial read should return the empty config.
    let cachedConfig = await configCache.get(cacheKey);

    assert.equal(ProjectConfig.empty, cachedConfig);

    assert.equal(1, logger.events.filter(([level, eventId, _, err]) =>
      level === LogLevel.Error && eventId === 2200 && (err as Error).message === "Operation failed :(").length);

    // 2. Set should overwrite the local cache and log the error.

    logger.events.length = 0;

    const configJson = "{\"p\": {\"u\": \"http://example.com\", \"r\": 0}}";
    const config = new ProjectConfig(configJson, Config.deserialize(configJson), ProjectConfig.generateTimestamp(), "\"ETAG\"");

    await configCache.set(cacheKey, config);

    assert.equal(config, configCache["cachedConfig"]);

    assert.equal(1, logger.events.filter(([level, eventId, _, err]) =>
      level === LogLevel.Error && eventId === 2201 && (err as Error).message === "Operation failed :(").length);

    // 3. Get should log the error and return the local cache which was set previously.

    logger.events.length = 0;

    cachedConfig = await configCache.get(cacheKey);

    assert.equal(config, cachedConfig);

    assert.equal(1, logger.events.filter(([level, eventId, _, err]) =>
      level === LogLevel.Error && eventId === 2200 && (err as Error).message === "Operation failed :(").length);
  });

  for (const [sdkKey, expectedCacheKey] of [
    ["configcat-sdk-1/TEST_KEY-0123456789012/1234567890123456789012", "f83ba5d45bceb4bb704410f51b704fb6dfa19942"],
    ["configcat-sdk-1/TEST_KEY2-123456789012/1234567890123456789012", "da7bfd8662209c8ed3f9db96daed4f8d91ba5876"],
  ]) {
    it(`Cache key generation should be platform independent - ${sdkKey}`, () => {
      const options = new ManualPollOptions(sdkKey, "common", "1.0.0");
      assert.strictEqual(options.getCacheKey(), expectedCacheKey);
    });
  }

  const payloadTestConfigJson = "{\"p\":{\"u\":\"https://cdn-global.configcat.com\",\"r\":0},\"f\":{\"testKey\":{\"v\":\"testValue\",\"t\":1,\"p\":[],\"r\":[]}}}";
  for (const [configJson, timestamp, httpETag, expectedPayload] of [
    [payloadTestConfigJson, "2023-06-14T15:27:15.8440000Z", "test-etag", "1686756435844\ntest-etag\n" + payloadTestConfigJson],
  ]) {
    it(`Cache payload serialization should be platform independent - ${httpETag}`, () => {
      const pc = new ProjectConfig(configJson, JSON.parse(configJson), Date.parse(timestamp), httpETag);
      assert.strictEqual(ProjectConfig.serialize(pc), expectedPayload);
    });
  }
});
