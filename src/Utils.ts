import { ConfigFile, Setting } from "./ProjectConfig";

export const isUndefined = (comp: any) => comp === undefined;

export function getSettingsFromConfig(json: any): { [name: string]: Setting } {
    return Object.fromEntries(Object.entries(json[ConfigFile.FeatureFlags]).map(([key, value]) => {
        return [key, Setting.fromJson(value)];
    }));
}