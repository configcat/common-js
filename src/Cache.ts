import { ProjectConfig } from "./ProjectConfig";

export interface ICache {
  set(key: string, config: ProjectConfig): Promise<void> | void;

  get(key: string): Promise<ProjectConfig | null> | ProjectConfig | null;
}

export class InMemoryCache implements ICache {
  cache:  { [apiKey: string] : ProjectConfig; } = {};

  set(key: string, config: ProjectConfig): void {
    this.cache[key] = config;
  }

  get(key: string): ProjectConfig | null {
    return this.cache[key] ?? null;
  }
}
