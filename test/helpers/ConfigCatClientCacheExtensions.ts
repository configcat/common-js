import { ConfigCatClientCache } from "../../src/ConfigCatClientCache";

declare module "../../src/ConfigCatClientCache" {
    interface ConfigCatClientCache {
        getSize(): number;
        getAliveCount(): number;
    }
}

ConfigCatClientCache.prototype.getSize = function(this: ConfigCatClientCache) {
    return Object.keys(this['instances']).length;
}

ConfigCatClientCache.prototype.getAliveCount = function(this: ConfigCatClientCache) {
    return Object.values(this['instances']).filter(([weakRef]) => !!weakRef.deref()).length;
}
