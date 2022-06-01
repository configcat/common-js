export function setupPolyfills() {
    if (!(Object as any).fromEntries) {
        (Object as any).fromEntries = function (entries: any) {
            if (!entries || !entries[Symbol.iterator]) { throw new Error('Object.fromEntries() requires a single iterable argument'); }
            let obj: any = {};
            for (let [key, value] of entries) {
                obj[key] = value;
            }
            return obj;
        };
    }
}
