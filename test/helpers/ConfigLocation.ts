import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { ManualPollOptions } from "../../src/ConfigCatClientOptions";
import { ManualPollConfigService } from "../../src/ManualPollConfigService";
import { Config } from "../../src/ProjectConfig";
import { HttpConfigFetcher } from "./HttpConfigFetcher";

const configCache: { [location: string]: Promise<Config> } = {};

export abstract class ConfigLocation {
  abstract getRealLocation(): string;

  abstract fetchConfigAsync(): Promise<Config>;

  fetchConfigCachedAsync(): Promise<Config> {
    const location = this.getRealLocation();
    let configPromise = configCache[location];
    if (!configPromise) {
      configCache[location] = configPromise = this.fetchConfigAsync();
    }
    return configPromise;
  }
}

export class CdnConfigLocation extends ConfigLocation {
  private $options?: ManualPollOptions;
  get options(): ManualPollOptions {
    return this.$options ??= new ManualPollOptions(this.sdkKey, "ConfigCat-JS-Common", "0.0.0-test", {
      baseUrl: this.baseUrl ?? "https://cdn-eu.configcat.com"
    });
  }

  constructor(
    readonly sdkKey: string,
    readonly baseUrl?: string,
  ) {
    super();
  }

  getRealLocation(): string {
    const url = this.options.getUrl();
    const index = url.lastIndexOf("?");
    return index >= 0 ? url.slice(0, index) : url;
  }

  async fetchConfigAsync(): Promise<Config> {
    const configFetcher = new HttpConfigFetcher();
    const configService = new ManualPollConfigService(configFetcher, this.options);

    const [fetchResult, projectConfig] = await configService.refreshConfigAsync();
    if (!fetchResult.isSuccess) {
      throw new Error("Could not fetch config from CDN: " + fetchResult.errorMessage);
    }
    return projectConfig.config!;
  }

  toString(): string {
    return this.sdkKey + (this.baseUrl ? ` (${this.baseUrl})` : "");
  }
}

export class LocalFileConfigLocation extends ConfigLocation {
  filePath: string;

  constructor(...paths: ReadonlyArray<string>) {
    super();
    this.filePath = path.join(...paths);
  }

  getRealLocation(): string { return this.filePath; }

  async fetchConfigAsync(): Promise<Config> {
    const configJson = await util.promisify(fs.readFile)(this.filePath, "utf8");
    const parsedObject = JSON.parse(configJson);
    return new Config(parsedObject);
  }

  toString(): string {
    return this.getRealLocation();
  }
}
