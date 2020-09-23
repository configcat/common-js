import { ProjectConfig } from "./ProjectConfig";
import { ICache } from "./index";

export class InMemoryCache implements ICache {
    cache:  { [apiKey: string] : ProjectConfig; } = {};

    set(key: string, config: ProjectConfig): void {
        this.cache[key] = config;
    }

    get(key: string): ProjectConfig {
        return this.cache[key];
    }
}