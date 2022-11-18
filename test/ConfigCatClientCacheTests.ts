import "mocha";
import { assert } from "chai";
import { ConfigCatClient } from "../src/ConfigCatClient";
import { ConfigCatClientCache } from "../src/ConfigCatClientCache";
import { AutoPollOptions, ManualPollOptions } from "../src/ConfigCatClientOptions";
import { FakeConfigCatKernel, FakeConfigFetcher } from "./ConfigCatClientTests";
import { isWeakRefAvailable, setupPolyfills } from "../src/Polyfills";
import { allowEventLoop } from "./helpers/utils";
import "./helpers/ConfigCatClientCacheExtensions";

describe("ConfigCatClientCache", () => {
  it("getOrCreate() should return shared instance when cached instance is alive", (done) => {
    // Arrange

    const sdkKey = "123";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options = new ManualPollOptions(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, {});

    const cache = new ConfigCatClientCache();

    // Act

    const [client1, instanceAlreadyCreated1] = cache.getOrCreate(options, configCatKernel);
    const [client2, instanceAlreadyCreated2] = cache.getOrCreate(options, configCatKernel);

    // Assert

    assert.strictEqual(1, cache.getAliveCount());
    assert.strictEqual(1, cache.getSize());
    const cachedInstance = cache["instances"][sdkKey][0].deref();

    assert.instanceOf(client1, ConfigCatClient);
    assert.isFalse(instanceAlreadyCreated1);
    assert.strictEqual(cachedInstance, client1);

    assert.instanceOf(client2, ConfigCatClient);
    assert.isTrue(instanceAlreadyCreated2);
    assert.strictEqual(cachedInstance, client2);

    done();
  });

  it("getOrCreate() should return new instance after cached instance is collected", async function () {
    // Arrange

    setupPolyfills();
    if (!isWeakRefAvailable() || typeof gc === "undefined") {
      this.skip();
    }

    const sdkKey = "123";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options = new AutoPollOptions(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, {});

    const cache = new ConfigCatClientCache();

    // Act

    const [client1, instanceAlreadyCreated1] = getOrCreateClientWeakRef(cache, options, configCatKernel);

    // We need to allow the event loop to run so the runtime can detect there's no more strong references to client1.
    await allowEventLoop();
    gc();

    const [client2, instanceAlreadyCreated2] = cache.getOrCreate(options, configCatKernel);

    // Assert

    assert.strictEqual(1, cache.getAliveCount());
    assert.strictEqual(1, cache.getSize());
    const cachedInstance = cache["instances"][sdkKey][0].deref();

    assert.isUndefined(client1.deref());
    assert.isFalse(instanceAlreadyCreated1);

    assert.instanceOf(client2, ConfigCatClient);
    assert.isFalse(instanceAlreadyCreated2);
    assert.strictEqual(cachedInstance, client2);
  });

  it("remove() should remove cache entry when cached instance is alive and tokens match", (done) => {
    // Arrange

    const sdkKey = "123";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options = new ManualPollOptions(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, {});

    const cache = new ConfigCatClientCache();

    const [client1, instanceAlreadyCreated1] = cache.getOrCreate(options, configCatKernel);

    // Act

    var success = cache.remove(sdkKey, client1["cacheToken"]!);

    // Assert

    assert.isTrue(success);
    assert.strictEqual(0, cache.getAliveCount());
    assert.strictEqual(0, cache.getSize());

    assert.instanceOf(client1, ConfigCatClient);
    assert.isFalse(instanceAlreadyCreated1);

    done();
  });

  it("remove() should not remove cache entry when cached instance is alive and tokens mismatch", (done) => {
    // Arrange

    const sdkKey = "123";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options = new ManualPollOptions(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, {});

    const cache = new ConfigCatClientCache();

    const [client1, instanceAlreadyCreated1] = cache.getOrCreate(options, configCatKernel);
    cache.remove(sdkKey, client1["cacheToken"]!);

    const [client2, instanceAlreadyCreated2] = cache.getOrCreate(options, configCatKernel);

    // Act

    var success = cache.remove(sdkKey, client1["cacheToken"]!);

    // Assert

    assert.isFalse(success);
    assert.strictEqual(1, cache.getAliveCount());
    assert.strictEqual(1, cache.getSize());
    const cachedInstance = cache["instances"][sdkKey][0].deref();

    assert.instanceOf(client1, ConfigCatClient);
    assert.isFalse(instanceAlreadyCreated1);
    assert.notStrictEqual(cachedInstance, client1);

    assert.instanceOf(client2, ConfigCatClient);
    assert.isFalse(instanceAlreadyCreated2);
    assert.strictEqual(cachedInstance, client2);

    done();
  });

  it("remove() should remove cache entry when cached instance is collected", async function () {
    // Arrange

    setupPolyfills();
    if (!isWeakRefAvailable() || typeof gc === "undefined") {
      this.skip();
    }

    const sdkKey = "123";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options = new ManualPollOptions(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, {});

    const cache = new ConfigCatClientCache();

    const [client1, instanceAlreadyCreated1] = getOrCreateClientWeakRef(cache, options, configCatKernel);

    // We need to allow the event loop to run so the runtime can detect there's no more strong references to client1.
    await allowEventLoop();
    gc();

    // Act

    var success = cache.remove(sdkKey, {});

    // Assert

    assert.isFalse(success);
    assert.strictEqual(0, cache.getAliveCount());
    assert.strictEqual(0, cache.getSize());

    assert.isUndefined(client1.deref());
    assert.isFalse(instanceAlreadyCreated1);
  });

  it("remove() should not remove cache entry when SDK Key is not present", (done) => {
    // Arrange

    const sdkKey = "123";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options = new ManualPollOptions(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, {});

    const cache = new ConfigCatClientCache();

    const [client1, instanceAlreadyCreated1] = cache.getOrCreate(options, configCatKernel);

    // Act

    var success = cache.remove("321", {});

    // Assert

    assert.isFalse(success);
    assert.strictEqual(1, cache.getAliveCount());
    assert.strictEqual(1, cache.getSize());
    const cachedInstance = cache["instances"][sdkKey][0].deref();

    assert.instanceOf(client1, ConfigCatClient);
    assert.isFalse(instanceAlreadyCreated1);
    assert.strictEqual(cachedInstance, client1);

    done();
  });

  it("clear() should remove all cached instances", async function () {
    // Arrange

    setupPolyfills();
    if (!isWeakRefAvailable() || typeof gc === "undefined") {
      this.skip();
    }

    const sdkKey1 = "123";
    const sdkKey2 = "456";

    const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcher(), sdkType: "common", sdkVersion: "1.0.0" };
    const options1 = new ManualPollOptions(sdkKey1, configCatKernel.sdkType, configCatKernel.sdkVersion, {});
    const options2 = new ManualPollOptions(sdkKey2, configCatKernel.sdkType, configCatKernel.sdkVersion, {});

    const cache = new ConfigCatClientCache();

    const [client1, instanceAlreadyCreated1] = cache.getOrCreate(options1, configCatKernel);
    const [client2, instanceAlreadyCreated2, cacheCountBefore] = getOrCreateClientWeakRef(cache, options2, configCatKernel);

    // We need to allow the event loop to run so the runtime can detect there's no more strong references to client1.
    await allowEventLoop();
    gc();

    // Act

    const removedInstances = cache.clear();

    // Assert

    assert.strictEqual(2, cacheCountBefore);
    assert.strictEqual(0, cache.getAliveCount());
    assert.strictEqual(0, cache.getSize());

    assert.instanceOf(client1, ConfigCatClient);
    assert.isFalse(instanceAlreadyCreated1);

    assert.isUndefined(client2.deref());
    assert.isFalse(instanceAlreadyCreated2);

    assert.sameDeepMembers([client1], removedInstances);
  });

});

function getOrCreateClientWeakRef(cache: ConfigCatClientCache, options: any, configCatKernel: any): [WeakRef<ConfigCatClient>, boolean, number] {
  const [client, instanceAlreadyCreated] = cache.getOrCreate(options, configCatKernel);
  return [new WeakRef(client), instanceAlreadyCreated, cache.getAliveCount()];
}
