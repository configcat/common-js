import { IConfigCatKernel } from "./index";
import { ConfigCatClientOptions } from "./ConfigCatClientOptions";
import { ConfigCatClient } from "./ConfigCatClient";

export class ConfigCatClientCache {
    private instances: Record<string, [WeakRef<ConfigCatClient>, object]> = {};

    // For testing purposes only
    public get count() {
        return Object.values(this.instances).filter(([weakRef]) => weakRef.deref() !== void 0).length;
    }

    public getOrCreate(options: ConfigCatClientOptions, configCatKernel: IConfigCatKernel): [ConfigCatClient, boolean] {
        let instance: ConfigCatClient | undefined;

        let cachedInstance = this.instances[options.apiKey];
        if (cachedInstance !== void 0) {
            const [weakRef] = cachedInstance;
            instance = weakRef.deref();
            if (instance !== void 0) {
                return [instance, true];
            }
        }

        const token = {};
        instance = new ConfigCatClient(options, configCatKernel, token);
        this.instances[options.apiKey] = cachedInstance = [new WeakRef(instance), token];
        return [instance, false];
    }

    public remove(sdkKey: string, cacheToken: object) {
        const cachedInstance = this.instances[sdkKey];

        if (cachedInstance !== void 0) {
            const [weakRef, token] = cachedInstance;
            const instanceIsAvailable = weakRef.deref() !== void 0;
            if (!instanceIsAvailable || token === cacheToken) {
                delete this.instances[sdkKey];
                return instanceIsAvailable;
            }
        }

        return false;
    }

    public clear() {
        const removedInstances: ConfigCatClient[] = [];
        for (let [sdkKey, [weakRef]] of Object.entries(this.instances)) {
            let instance = weakRef.deref();
            if (instance !== void 0) {
                removedInstances.push(instance);
            }
            delete this.instances[sdkKey];
        }
        return removedInstances;
    }
}
