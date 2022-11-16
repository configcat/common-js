export function setupPolyfills() {
    // Object.fromEntries
    if (typeof Object.fromEntries === "undefined") {
        Object.fromEntries = function (entries: any) {
            if (!entries || !entries[Symbol.iterator]) { throw new Error('Object.fromEntries() requires a single iterable argument'); }
            let obj: any = {};
            for (let [key, value] of entries) {
                obj[key] = value;
            }
            return obj;
        };
    }

    // WeakRef
    if (typeof WeakRef === "undefined") {
        WeakRef = typeof WeakMap !== "undefined"
            // Polyfill WeakRef using WeakMap, which was introduced much earlier
            // (see https://caniuse.com/mdn-javascript_builtins_weakref and https://caniuse.com/mdn-javascript_builtins_weakmap).
            ? getWeakRefPolyfill()
            // If not even WeakMap is available, we can't really do anything else than using strong references.
            : getWeakRefFallback();
    }
}

function getWeakRefPolyfill<T extends object>() {
    const weakMap = new WeakMap<WeakRef<T>, T>();

    const WeakRef = function (this: WeakRef<T>, target: T) {
        weakMap.set(this, target);
    } as Function as WeakRefConstructor;

    WeakRef.prototype.deref = function () {
        return weakMap.get(this);
    };

    return WeakRef;
}

function getWeakRefFallback<T extends object>() {
    type WeakRefImpl = WeakRef<T> & { target: T };

    const WeakRef = function (this: WeakRefImpl, target: T) {
        this.target = target;
    } as Function as WeakRefConstructor & { isFallback: boolean };

    WeakRef.prototype.deref = function (this: WeakRefImpl) {
        return this.target;
    };

    WeakRef.isFallback = true;

    return WeakRef;
}

export const isWeakRefAvailable = () => typeof WeakRef === "function" && !WeakRef.hasOwnProperty("isFallback");
