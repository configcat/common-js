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
    throw new TypeError("Object.fromEntries() requires a single iterable argument");
  }
  return result;
}

export function getWeakRefStub<T extends object>(): WeakRefConstructor {
  type WeakRefImpl = WeakRef<T> & { target: T };

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const WeakRef = function(this: WeakRefImpl, target: T) {
    this.target = target;
  } as Function as WeakRefConstructor & { isFallback: boolean };

  WeakRef.prototype.deref = function(this: WeakRefImpl) {
    return this.target;
  };

  WeakRef.isFallback = true;

  return WeakRef;
}

export const isWeakRefAvailable = (): boolean => typeof WeakRef === "function";
