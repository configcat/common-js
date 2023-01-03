import { assert, expect } from "chai";
import "mocha";
import { getWeakRefFallback, ObjectEntriesPolyfill, ObjectFromEntriesPolyfill, ObjectValuesPolyfill } from "../src/Polyfills";

describe("Polyfills", () => {
    it("Object.values polyfill should work", () => {
        assert.deepEqual([], ObjectValuesPolyfill<any>("" as any));

        assert.deepEqual([], ObjectValuesPolyfill<any>([]));
        expect(ObjectValuesPolyfill<any>([1, , "b"])).to.have.members([1, "b"]);

        assert.deepEqual([], ObjectValuesPolyfill<any>({}));
        expect(ObjectValuesPolyfill<any>({ "a": 1, 2: "b" })).to.have.members([1, "b"]);
    });

    it("Object.entries polyfill should work", () => {
        assert.deepEqual([], ObjectEntriesPolyfill<any>("" as any));

        assert.deepEqual([], ObjectEntriesPolyfill<any>([]));
        expect(ObjectEntriesPolyfill<any>([1, , "b"])).to.have.deep.members([["0", 1], ["2", "b"]]);

        assert.deepEqual([], ObjectEntriesPolyfill<any>({}));
        expect(ObjectEntriesPolyfill<any>({ "a": 1, 2: "b" })).to.have.deep.members([["a", 1], ["2", "b"]]);
    });

    it("Object.fromEntries polyfill should work", () => {
        assert.deepEqual({}, ObjectFromEntriesPolyfill<any>("" as any));

        assert.deepEqual({}, ObjectFromEntriesPolyfill<any>([]));
        assert.deepEqual({ "a": 1, 2: "b" }, ObjectFromEntriesPolyfill<any>([["a", 1], [2, "b"]]));

        assert.deepEqual({}, ObjectFromEntriesPolyfill<any>((function* () { })()));
        assert.deepEqual({ "a": 1, 2: "b" }, ObjectFromEntriesPolyfill<any>((function* () { yield* [["a", 1], [2, "b"]] })()));

        assert.throws(() => ObjectFromEntriesPolyfill<any>(1 as any));
    });

    it("WeakRef API polyfill should work", () => {
        const weakRefCtor = getWeakRefFallback();

        let obj: {} | null = {};
        const objWeakRef = new weakRefCtor(obj);

        assert.strictEqual(objWeakRef.deref(), obj);
    });
});