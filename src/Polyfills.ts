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

    function WeakRef(this: WeakRef<T>, target: T) {
        weakMap.set(this, target);
    }

    (WeakRef.prototype as WeakRef<T>).deref = function () {
        return weakMap.get(this);
    };

    return WeakRef as Function as WeakRefConstructor;
}

function getWeakRefFallback<T extends object>() {
    type WeakRefImpl = WeakRef<T> & { target: T };

    function WeakRef(this: WeakRefImpl, target: T) {
        this.target = target;
    };

    (WeakRef.prototype as WeakRef<T>).deref = function (this: WeakRefImpl) {
        return this.target;
    };

    WeakRef.isFallback = true;

    return WeakRef as Function as WeakRefConstructor;
}
