import type { SettingValue } from "./ProjectConfig";
import { Setting } from "./ProjectConfig";

/**
 * Specifies the behaviours for flag overrides.
 */
export enum OverrideBehaviour {
  /**
   * When evaluating values, the SDK will not use feature flags and settings from the ConfigCat CDN, but it will use
   * all feature flags and settings that are loaded from local-override sources.
   */
  LocalOnly = 0,
  /**
   * When evaluating values, the SDK will use all feature flags and settings that are downloaded from the ConfigCat CDN,
   * plus all feature flags and settings that are loaded from local-override sources. If a feature flag or a setting is
   * defined both in the fetched and the local-override source then the local-override version will take precedence.
   */
  LocalOverRemote = 1,
  /**
   * When evaluating values, the SDK will use all feature flags and settings that are downloaded from the ConfigCat CDN,
   * plus all feature flags and settings that are loaded from local-override sources. If a feature flag or a setting is
   * defined both in the fetched and the local-override source then the fetched version will take precedence.
   */
  RemoteOverLocal = 2,
}

export interface IOverrideDataSource {
  getOverrides(): Promise<{ [name: string]: Setting }>;

  getOverridesSync(): { [name: string]: Setting };
}

export class MapOverrideDataSource implements IOverrideDataSource {
  private readonly map: { [name: string]: Setting } = {};

  constructor(map: { [name: string]: NonNullable<SettingValue> }) {
    this.map = Object.fromEntries(Object.entries(map).map(([key, value]) => {
      return [key, Setting.fromValue(value)];
    }));
  }

  getOverrides(): Promise<{ [name: string]: Setting }> {
    return Promise.resolve(this.map);
  }

  getOverridesSync(): { [name: string]: Setting } {
    return this.map;
  }
}

export class FlagOverrides {
  constructor(
    public dataSource: IOverrideDataSource,
    public behaviour: OverrideBehaviour) {
  }
}
