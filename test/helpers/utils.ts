import { IAutoPollOptions, IConfigCatKernel, ILazyLoadingOptions, IManualPollOptions } from "../../src";
import { ConfigCatClient, IConfigCatClient } from "../../src/ConfigCatClient";
import { AutoPollOptions, LazyLoadOptions, ManualPollOptions } from "../../src/ConfigCatClientOptions";

// See https://stackoverflow.com/a/72237137/8656352
export function allowEventLoop(waitMs = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, waitMs));
}

export function createClientWithAutoPoll(apiKey: string, configCatKernel: IConfigCatKernel, options?: IAutoPollOptions): IConfigCatClient {
  return new ConfigCatClient(new AutoPollOptions(apiKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.defaultCacheFactory, configCatKernel.eventEmitterFactory), configCatKernel);
}

export function createClientWithManualPoll(apiKey: string, configCatKernel: IConfigCatKernel, options?: IManualPollOptions): IConfigCatClient {
  return new ConfigCatClient(new ManualPollOptions(apiKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.defaultCacheFactory, configCatKernel.eventEmitterFactory), configCatKernel);
}

export function createClientWithLazyLoad(apiKey: string, configCatKernel: IConfigCatKernel, options?: ILazyLoadingOptions): IConfigCatClient {
  return new ConfigCatClient(new LazyLoadOptions(apiKey, configCatKernel.sdkType, configCatKernel.sdkVersion, options, configCatKernel.defaultCacheFactory, configCatKernel.eventEmitterFactory), configCatKernel);
}

export function normalizeLineEndings(text: string, eol = "\n"): string {
  return text.replace(/\r\n?|\n/g, eol);
}
