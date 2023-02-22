import type { ProjectConfig } from "./ProjectConfig";
import { ConfigFile, Setting } from "./ProjectConfig";

export function delay(delayMs: number, obtainCancel?: (cancel: () => void) => void): Promise<void> {
  let timerId: ReturnType<typeof setTimeout>;
  const promise = new Promise<void>(resolve => timerId = setTimeout(resolve, delayMs));
  obtainCancel?.(() => clearTimeout(timerId));
  return promise;
}

export function getSettingsFromConfig(json: any): { [name: string]: Setting } {
  return Object.fromEntries(Object.entries(json[ConfigFile.FeatureFlags]).map(([key, value]) => {
    return [key, Setting.fromJson(value)];
  }));
}

export function getTimestampAsDate(projectConfig: ProjectConfig | null): Date | undefined {
  return projectConfig ? new Date(projectConfig.Timestamp) : void 0;
}

export function errorToString(err: any, includeStackTrace = false): string {
  return err instanceof Error
    ? includeStackTrace && err.stack ? err.stack : err.toString()
    : err + "";
}
