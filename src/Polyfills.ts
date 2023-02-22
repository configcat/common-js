const getGlobalObject = (() => {
  let value: typeof globalThis | undefined;

  return () => {
    if (!value) {
      value =
        typeof globalThis === "object" && globalThis ? globalThis :
        typeof self === "object" && self ? self :
        typeof window === "object" && window ? window :
        typeof global === "object" && global ? global :
        typeof Function === "function" ? (Function("return this")()) :
        null;

      if (!value) {
        throw new Error("Global object could not be determined.");
      }
    }
    return value;
  };
})();

export function setupPolyfills(): void {
  // Object.values
  if (typeof Object.values === "undefined") {
    Object.values = ObjectValuesPolyfill;
  }

  // Object.entries
  if (typeof Object.entries === "undefined") {
    Object.entries = ObjectEntriesPolyfill;
  }

  // Object.fromEntries
  if (typeof Object.fromEntries === "undefined") {
    Object.fromEntries = ObjectFromEntriesPolyfill;
  }

  // WeakRef
  if (typeof WeakRef === "undefined") {
    // There's no way to correctly polyfill WeakRef (https://stackoverflow.com/a/69971312/8656352),
    // so we just polyfill its API (which means falling back on strong references in this case).
    getGlobalObject().WeakRef = getWeakRefStub();
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ObjectValuesPolyfill<T>(o: { [s: string]: T } | ArrayLike<T>): T[] {
  const result: T[] = [];
  for (const key of Object.keys(o)) {
    result.push((o as any)[key]);
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ObjectEntriesPolyfill<T>(o: { [s: string]: T } | ArrayLike<T>): [string, T][] {
  const result: [string, T][] = [];
  for (const key of Object.keys(o)) {
    result.push([key, (o as any)[key]]);
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ObjectFromEntriesPolyfill<T>(entries: Iterable<readonly [PropertyKey, T]>): { [k: PropertyKey]: T } {
  const result: { [k: PropertyKey]: T } = {};
  if (Array.isArray(entries)) {
    for (const [key, value] of entries) {
      result[key] = value;
    }
  }
  else if (typeof Symbol !== "undefined" && entries?.[Symbol.iterator]) {
    const iterator = entries[Symbol.iterator]();
    let element: readonly [PropertyKey, T], done: boolean | undefined;
    while (({ value: element, done } = iterator.next(), !done)) {
      const [key, value] = element;
      result[key] = value;
    }
  }
  else {
    throw new Error("Object.fromEntries() requires a single iterable argument");
  }
  return result;
}

export function getWeakRefStub<T extends object>(): WeakRefConstructor {
  type WeakRefImpl = WeakRef<T> & { target: T };

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const WeakRef = function (this: WeakRefImpl, target: T) {
    this.target = target;
  } as Function as WeakRefConstructor & { isFallback: boolean };

  WeakRef.prototype.deref = function (this: WeakRefImpl) {
    return this.target;
  };

  WeakRef.isFallback = true;

  return WeakRef;
}

export const isWeakRefAvailable = (): boolean => typeof WeakRef === "function" && !Object.prototype.hasOwnProperty.call(WeakRef, "isFallback");
