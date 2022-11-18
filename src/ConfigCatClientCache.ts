import { IConfigCatKernel } from "./index";
import { ConfigCatClientOptions } from "./ConfigCatClientOptions";
import { ConfigCatClient } from "./ConfigCatClient";

export class ConfigCatClientCache {
    private instances: Record<string, [WeakRef<ConfigCatClient>, object]> = {};

    public getOrCreate(options: ConfigCatClientOptions, configCatKernel: IConfigCatKernel): [ConfigCatClient, boolean] {
        let instance: ConfigCatClient | undefined;

        let cachedInstance = this.instances[options.apiKey];
        if (cachedInstance) {
            const [weakRef] = cachedInstance;
            instance = weakRef.deref();
            if (instance) {
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

        if (cachedInstance) {
            const [weakRef, token] = cachedInstance;
            const instanceIsAvailable = !!weakRef.deref();
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
            if (instance) {
                removedInstances.push(instance);
            }
            delete this.instances[sdkKey];
        }
        return removedInstances;
    }
}
