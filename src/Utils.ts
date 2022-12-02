import { ConfigFile, Setting } from "./ProjectConfig";

export const isUndefined = (comp: any) => comp === void 0;

export function getSettingsFromConfig(json: any): { [name: string]: Setting } {
    if (!json) {
        return {};
    }

    return Object.fromEntries(Object.entries(json[ConfigFile.FeatureFlags]).map(([key, value]) => {
        return [key, Setting.fromJson(value)];
    }));
}