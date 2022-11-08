import { IConfigCatKernel } from "./index";
import { ConfigCatClientOptions } from "./ConfigCatClientOptions";
import { ConfigCatClient } from "./ConfigCatClient";

export class ConfigCatClientCache {
    private instances: Record<string, WeakRef<ConfigCatClient>> = {};

    // For testing purposes only
    public get count() {
        return Object.values(this.instances).filter(weakRef => weakRef.deref() !== void 0).length;
    }

    public getOrCreate(options: ConfigCatClientOptions, configCatKernel: IConfigCatKernel): [ConfigCatClient, boolean] {
        let instance: ConfigCatClient | undefined;

        let weakRef = this.instances[options.apiKey];
        let instanceAlreadyCreated = weakRef !== void 0;
        if (!instanceAlreadyCreated) {
            instance = new ConfigCatClient(options, configCatKernel);
            this.instances[options.apiKey] = new WeakRef(instance);
        }
        else if ((instance = weakRef.deref()) === void 0) {
            instanceAlreadyCreated = false;
            instance = new ConfigCatClient(options, configCatKernel);
            this.instances[options.apiKey] = new WeakRef(instance);
        }

        return [instance, instanceAlreadyCreated];
    }

    public remove(sdkKey: string, instanceToRemove: ConfigCatClient) {
        let weakRef = this.instances[sdkKey];

        if (weakRef !== void 0) {
            let instance = weakRef.deref();
            const instanceIsAvailable = instance !== void 0;
            if (!instanceIsAvailable || instance === instanceToRemove) {
                delete this.instances[sdkKey];
                return instanceIsAvailable;
            }
        }

        return false;
    }

    public clear() {
        const removedInstances: ConfigCatClient[] = [];
        for (let [sdkKey, weakRef] of Object.entries(this.instances)) {
            let instance = weakRef.deref();
            if (instance !== void 0) {
                removedInstances.push(instance);
            }
            delete this.instances[sdkKey];
        }
        return removedInstances;
    }
}
