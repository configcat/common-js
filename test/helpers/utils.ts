import { IAutoPollOptions, IConfigCatKernel, ILazyLoadingOptions, IManualPollOptions } from "../../src";
import { ConfigCatClient, IConfigCatClient } from "../../src/ConfigCatClient";
import { AutoPollOptions, LazyLoadOptions, ManualPollOptions } from "../../src/ConfigCatClientOptions";

export const sdkType = "ConfigCat-JS-Common", sdkVersion = "0.0.0-test";

export function createClientWithAutoPoll(sdkKey: string, configCatKernel: IConfigCatKernel, options?: IAutoPollOptions): IConfigCatClient {
  return new ConfigCatClient(new AutoPollOptions(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.defaultCacheFactory, configCatKernel.eventEmitterFactory), configCatKernel);
}

export function createClientWithManualPoll(sdkKey: string, configCatKernel: IConfigCatKernel, options?: IManualPollOptions): IConfigCatClient {
  return new ConfigCatClient(new ManualPollOptions(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.defaultCacheFactory, configCatKernel.eventEmitterFactory), configCatKernel);
}

export function createClientWithLazyLoad(sdkKey: string, configCatKernel: IConfigCatKernel, options?: ILazyLoadingOptions): IConfigCatClient {
  return new ConfigCatClient(new LazyLoadOptions(sdkKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.defaultCacheFactory, configCatKernel.eventEmitterFactory), configCatKernel);
}

// See https://stackoverflow.com/a/72237137/8656352
export function allowEventLoop(waitMs = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, waitMs));
}

export function normalizeLineEndings(text: string, eol = "\n"): string {
  return text.replace(/\r\n?|\n/g, eol);
}

export function escapeRegExp(text: string): string {
  // See also: https://tc39.es/ecma262/#prod-SyntaxCharacter
  return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
