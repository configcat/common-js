import { ConfigFile, Setting } from "./ProjectConfig";

export const isUndefined = (comp: any) => comp === void 0;

export function delay(delayMs: number, obtainCancel?: (cancel: () => void) => void): Promise<void> {
    let timerId: ReturnType<typeof setTimeout>;
    const promise = new Promise<void>(resolve => timerId = setTimeout(resolve, delayMs));
    obtainCancel?.(() => clearTimeout(timerId));
    return promise;
};

export function getSettingsFromConfig(json: any): { [name: string]: Setting } {
    return Object.fromEntries(Object.entries(json[ConfigFile.FeatureFlags]).map(([key, value]) => {
        return [key, Setting.fromJson(value)];
    }));
}

export function errorToString(err: any, includeStackTrace = false): string {
    return err instanceof Error 
        ? includeStackTrace && err.stack ? err.stack : err.toString()
        : err + "";
}