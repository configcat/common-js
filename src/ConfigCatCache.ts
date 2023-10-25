import type { LoggerWrapper } from "./ConfigCatLogger";
import { ProjectConfig } from "./ProjectConfig";
import { isPromiseLike } from "./Utils";

/** Defines the interface used by the ConfigCat SDK to store and retrieve downloaded config data. */
export interface IConfigCatCache {
  /**
   * Stores a data item into the cache.
   * @param key A string identifying the data item.
   * @param value The data item to cache.
   */
  set(key: string, value: string): Promise<void> | void;

  /**
   * Retrieves a data item from the cache.
   * @param key A string identifying the value.
   * @returns The cached data item or `null` or `undefined` if there is none.
   */
  get(key: string): Promise<string | null | undefined> | string | null | undefined;
}

export interface IConfigCache {
  set(key: string, config: ProjectConfig): Promise<void> | void;

  get(key: string): Promise<ProjectConfig> | ProjectConfig;

  getInMemory(): ProjectConfig;
}

export class InMemoryConfigCache implements IConfigCache {
  private cachedConfig: ProjectConfig = ProjectConfig.empty;

  set(_key: string, config: ProjectConfig): void {
    this.cachedConfig = config;
  }

  get(_key: string): ProjectConfig {
    return this.cachedConfig;
  }

  getInMemory(): ProjectConfig {
    return this.cachedConfig;
  }
}

export class ExternalConfigCache implements IConfigCache {
  private cachedConfig: ProjectConfig = ProjectConfig.empty;
  private cachedSerializedConfig: string | undefined;

  constructor(
    private readonly cache: IConfigCatCache,
    private readonly logger: LoggerWrapper) {
  }

  async set(key: string, config: ProjectConfig): Promise<void> {
    try {
      if (!config.isEmpty) {
        this.cachedSerializedConfig = ProjectConfig.serialize(config);
        this.cachedConfig = config;
      }
      else {
        // We may have empty entries with timestamp > 0 (see the flooding prevention logic in ConfigServiceBase.fetchLogicAsync).
        // In such cases we want to preserve the timestamp locally but don't want to store those entries into the external cache.
        this.cachedSerializedConfig = void 0;
        this.cachedConfig = config;
        return;
      }

      await this.cache.set(key, this.cachedSerializedConfig);
    }
    catch (err) {
      this.logger.configServiceCacheWriteError(err);
    }
  }

  private updateCachedConfig(externalSerializedConfig: string | null | undefined): void {
    if (externalSerializedConfig == null || externalSerializedConfig === this.cachedSerializedConfig) {
      return;
    }

    this.cachedConfig = ProjectConfig.deserialize(externalSerializedConfig);
    this.cachedSerializedConfig = externalSerializedConfig;
  }

  get(key: string): Promise<ProjectConfig> {
    try {
      const cacheGetResult = this.cache.get(key);

      // Take the async path only when the IConfigCatCache.get operation is asynchronous.
      if (isPromiseLike(cacheGetResult)) {
        return (async (cacheGetPromise) => {
          try {
            this.updateCachedConfig(await cacheGetPromise);
          }
          catch (err) {
            this.logger.configServiceCacheReadError(err);
          }
          return this.cachedConfig;
        })(cacheGetResult);
      }

      // Otherwise, keep the code flow synchronous so the config services can sync up
      // with the cache in their ctors synchronously (see ConfigServiceBase.syncUpWithCache).
      this.updateCachedConfig(cacheGetResult);
    }
    catch (err) {
      this.logger.configServiceCacheReadError(err);
    }

    return Promise.resolve(this.cachedConfig);
  }

  getInMemory(): ProjectConfig {
    return this.cachedConfig;
  }
}
