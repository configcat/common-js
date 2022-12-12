import { assert } from "chai";
import "mocha";
import { DefaultEventEmitter } from "../src/DefaultEventEmitter";

function createHandler(eventName: string, capturedArgs: any[][]) {
  return (...args: any[]) => capturedArgs.push([eventName, args]);
}

describe("DefaultEventEmitter", () => {
  for (let subscriberMethod of ["on", "addListener"] as ("on" | "addListener")[]) {
    it(`emit() should call single listener added by ${subscriberMethod}()`, (done) => {
      // Arrange

      const ee = new DefaultEventEmitter();
      const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

      const
        capturedArgs1: any[][] = [], handler1 = createHandler("evt1", capturedArgs1),
        capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

      ee[subscriberMethod]("evt1", handler1);
      ee[subscriberMethod]("evt2", handler2);

      // Act

      for (const [, args] of emittedArgs)
        ee.emit("evt1", ...args);

      // Assert

      assert.deepEqual(capturedArgs1, emittedArgs);
      assert.deepEqual(capturedArgs2, []);

      assert.strictEqual(1, ee.listenerCount("evt1"));
      assert.deepEqual([handler1], ee.listeners("evt1"));

      assert.strictEqual(1, ee.listenerCount("evt2"));
      assert.deepEqual([handler2], ee.listeners("evt2"));

      assert.deepEqual(ee.eventNames(), ["evt1", "evt2"])

      done();
    });

    it(`emit() should call multiple listeners added by ${subscriberMethod}() when a listener is added multiple times`, (done) => {
      // Arrange

      const ee = new DefaultEventEmitter();
      const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

      const
        capturedArgs1: any[][] = [], handler1 = createHandler("evt1", capturedArgs1),
        capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

      ee[subscriberMethod]("evt1", handler1);
      ee[subscriberMethod]("evt1", handler1);
      ee[subscriberMethod]("evt2", handler2);

      // Act

      for (const [, args] of emittedArgs)
        ee.emit("evt1", ...args);

      // Assert

      assert.deepEqual(capturedArgs1, emittedArgs.map(item => [item, item]).flat());
      assert.deepEqual(capturedArgs2, []);

      assert.strictEqual(2, ee.listenerCount("evt1"));
      assert.deepEqual([handler1, handler1], ee.listeners("evt1"));

      assert.strictEqual(1, ee.listenerCount("evt2"));
      assert.deepEqual([handler2], ee.listeners("evt2"));

      assert.deepEqual(ee.eventNames(), ["evt1", "evt2"])

      done();
    });

    it(`emit() should call multiple listeners added by ${subscriberMethod}() when no listeners are added multiple times`, (done) => {
      // Arrange

      const ee = new DefaultEventEmitter();
      const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

      const
        capturedArgs1a: any[][] = [], handler1a = createHandler("evt1", capturedArgs1a),
        capturedArgs1b: any[][] = [], handler1b = createHandler("evt1", capturedArgs1b),
        capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

      ee[subscriberMethod]("evt1", handler1a);
      ee[subscriberMethod]("evt1", handler1b);
      ee[subscriberMethod]("evt2", handler2);

      // Act

      for (const [, args] of emittedArgs)
        ee.emit("evt1", ...args);

      // Assert

      assert.deepEqual(capturedArgs1a, emittedArgs);
      assert.deepEqual(capturedArgs1b, emittedArgs);
      assert.deepEqual(capturedArgs2, []);

      assert.strictEqual(2, ee.listenerCount("evt1"));
      assert.deepEqual([handler1a, handler1b], ee.listeners("evt1"));

      assert.strictEqual(1, ee.listenerCount("evt2"));
      assert.deepEqual([handler2], ee.listeners("evt2"));

      assert.deepEqual(ee.eventNames(), ["evt1", "evt2"])

      done();
    });
  }

  it(`emit() should call listener added by once() only a single time`, (done) => {
    // Arrange

    const ee = new DefaultEventEmitter();
    const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

    const
      capturedArgs1: any[][] = [], handler1 = createHandler("evt1", capturedArgs1),
      capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

    ee.once("evt1", handler1);
    ee.once("evt2", handler2);

    // Act

    for (const [, args] of emittedArgs)
      ee.emit("evt1", ...args);

    // Assert

    assert.deepEqual(capturedArgs1, emittedArgs.slice(0, 1));
    assert.deepEqual(capturedArgs2, []);

    assert.strictEqual(0, ee.listenerCount("evt1"));
    assert.deepEqual([], ee.listeners("evt1"));

    assert.strictEqual(1, ee.listenerCount("evt2"));
    assert.deepEqual([handler2], ee.listeners("evt2"));

    assert.deepEqual(ee.eventNames(), ["evt2"])

    done();
  });

  for (let unsubscriberMethod of ["off", "removeListener"] as ("off" | "removeListener")[]) {
    it(`emit() should not call listener removed by ${unsubscriberMethod}() when multiple listeners are left and a listener is added multiple times`, (done) => {
      // Arrange

      const ee = new DefaultEventEmitter();
      const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

      const
        capturedArgs1a: any[][] = [], handler1a = createHandler("evt1", capturedArgs1a),
        capturedArgs1b: any[][] = [], handler1b = createHandler("evt1", capturedArgs1b),
        capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

      ee
        .on("evt1", handler1a)
        .on("evt1", handler1b)
        .on("evt1", handler1a)
        .on("evt2", handler2);

      ee[unsubscriberMethod]("evt1", handler1a);

      // Act

      for (const [, args] of emittedArgs)
        ee.emit("evt1", ...args);

      // Assert

      assert.deepEqual(capturedArgs1a, emittedArgs);
      assert.deepEqual(capturedArgs1b, emittedArgs);
      assert.deepEqual(capturedArgs2, []);

      assert.strictEqual(2, ee.listenerCount("evt1"));
      assert.deepEqual([handler1a, handler1b], ee.listeners("evt1"));

      assert.strictEqual(1, ee.listenerCount("evt2"));
      assert.deepEqual([handler2], ee.listeners("evt2"));

      assert.deepEqual(ee.eventNames(), ["evt1", "evt2"])

      done();
    });

    it(`emit() should not call listener removed by ${unsubscriberMethod}() when multiple listeners are left and no listeners are added multiple times`, (done) => {
      // Arrange

      const ee = new DefaultEventEmitter();
      const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

      const
        capturedArgs1a: any[][] = [], handler1a = createHandler("evt1", capturedArgs1a),
        capturedArgs1b: any[][] = [], handler1b = createHandler("evt1", capturedArgs1b),
        capturedArgs1c: any[][] = [], handler1c = createHandler("evt1", capturedArgs1c),
        capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

      ee
        .on("evt1", handler1a)
        .on("evt1", handler1b)
        .on("evt1", handler1c)
        .on("evt2", handler2);

      ee[unsubscriberMethod]("evt1", handler1a);

      // Act

      for (const [, args] of emittedArgs)
        ee.emit("evt1", ...args);

      // Assert

      assert.deepEqual(capturedArgs1a, []);
      assert.deepEqual(capturedArgs1b, emittedArgs);
      assert.deepEqual(capturedArgs1c, emittedArgs);
      assert.deepEqual(capturedArgs2, []);

      assert.strictEqual(2, ee.listenerCount("evt1"));
      assert.deepEqual([handler1b, handler1c], ee.listeners("evt1"));

      assert.strictEqual(1, ee.listenerCount("evt2"));
      assert.deepEqual([handler2], ee.listeners("evt2"));

      assert.deepEqual(ee.eventNames(), ["evt1", "evt2"])

      done();
    });

    it(`emit() should not call listener removed by ${unsubscriberMethod}() when a single listener is left`, (done) => {
      // Arrange

      const ee = new DefaultEventEmitter();
      const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

      const
        capturedArgs1a: any[][] = [], handler1a = createHandler("evt1", capturedArgs1a),
        capturedArgs1b: any[][] = [], handler1b = createHandler("evt1", capturedArgs1b),
        capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

      ee
        .on("evt1", handler1a)
        .on("evt1", handler1b)
        .on("evt2", handler2);

      ee[unsubscriberMethod]("evt1", handler1a);

      // Act

      for (const [, args] of emittedArgs)
        ee.emit("evt1", ...args);

      // Assert

      assert.deepEqual(capturedArgs1a, []);
      assert.deepEqual(capturedArgs1b, emittedArgs);
      assert.deepEqual(capturedArgs2, []);

      assert.strictEqual(1, ee.listenerCount("evt1"));
      assert.deepEqual([handler1b], ee.listeners("evt1"));

      assert.strictEqual(1, ee.listenerCount("evt2"));
      assert.deepEqual([handler2], ee.listeners("evt2"));

      assert.deepEqual(ee.eventNames(), ["evt1", "evt2"])

      done();
    });

    it(`emit() should not call listeners removed by ${unsubscriberMethod}() when no listeners are left`, (done) => {
      // Arrange

      const ee = new DefaultEventEmitter();
      const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

      const
        capturedArgs1a: any[][] = [], handler1a = createHandler("evt1", capturedArgs1a),
        capturedArgs1b: any[][] = [], handler1b = createHandler("evt1", capturedArgs1b),
        capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

      ee
        .on("evt1", handler1a)
        .on("evt1", handler1b)
        .on("evt2", handler2);

      ee[unsubscriberMethod]("evt1", handler1a);
      ee[unsubscriberMethod]("evt1", handler1b);

      // Act

      for (const [, args] of emittedArgs)
        ee.emit("evt1", ...args);

      // Assert

      assert.deepEqual(capturedArgs1a, []);
      assert.deepEqual(capturedArgs1b, []);
      assert.deepEqual(capturedArgs2, []);

      assert.strictEqual(0, ee.listenerCount("evt1"));
      assert.deepEqual([], ee.listeners("evt1"));

      assert.strictEqual(1, ee.listenerCount("evt2"));
      assert.deepEqual([handler2], ee.listeners("evt2"));

      assert.deepEqual(ee.eventNames(), ["evt2"])

      done();
    });

    it(`${unsubscriberMethod}() should not remove listeners which are added to another event`, (done) => {
      // Arrange

      const ee = new DefaultEventEmitter();
      const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

      const
        capturedArgs1: any[][] = [], handler1 = createHandler("evt1", capturedArgs1),
        capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

      ee
        .on("evt1", handler1)
        .on("evt2", handler2);

      ee[unsubscriberMethod]("evt1", handler2);
      ee[unsubscriberMethod]("evt2", handler1);

      // Act

      for (const [, args] of emittedArgs)
        ee.emit("evt1", ...args);

      // Assert

      assert.deepEqual(capturedArgs1, emittedArgs),
        assert.deepEqual(capturedArgs2, []);

      assert.strictEqual(1, ee.listenerCount("evt1"));
      assert.deepEqual([handler1], ee.listeners("evt1"));

      assert.strictEqual(1, ee.listenerCount("evt2"));
      assert.deepEqual([handler2], ee.listeners("evt2"));

      assert.deepEqual(ee.eventNames(), ["evt1", "evt2"])

      done();
    });
  }

  it(`emit() should not call listeners removed by removeAllListeners() when listeners of a specific event are removed`, (done) => {
    // Arrange

    const ee = new DefaultEventEmitter();
    const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

    const
      capturedArgs1: any[][] = [], handler1 = createHandler("evt1", capturedArgs1),
      capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

    ee
      .on("evt1", handler1)
      .on("evt2", handler2);

    ee.removeAllListeners("evt2");

    // Act

    for (const [, args] of emittedArgs)
      ee.emit("evt1", ...args);

    // Assert

    assert.deepEqual(capturedArgs1, emittedArgs);
    assert.deepEqual(capturedArgs2, []);

    assert.strictEqual(1, ee.listenerCount("evt1"));
    assert.deepEqual([handler1], ee.listeners("evt1"));

    assert.strictEqual(0, ee.listenerCount("evt2"));
    assert.deepEqual([], ee.listeners("evt2"));

    assert.deepEqual(ee.eventNames(), ["evt1"])

    done();
  });
});

it(`emit() should not call listeners removed by removeAllListeners() when listeners of all events are removed`, (done) => {
  // Arrange

  const ee = new DefaultEventEmitter();
  const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

  const
    capturedArgs1: any[][] = [], handler1 = createHandler("evt1", capturedArgs1),
    capturedArgs2: any[][] = [], handler2 = createHandler("evt2", capturedArgs2);

  ee
    .on("evt1", handler1)
    .on("evt2", handler2);

  ee.removeAllListeners();

  // Act

  for (const [, args] of emittedArgs)
    ee.emit("evt1", ...args);

  // Assert

  assert.deepEqual(capturedArgs1, []);
  assert.deepEqual(capturedArgs2, []);

  assert.strictEqual(0, ee.listenerCount("evt1"));
  assert.deepEqual([], ee.listeners("evt1"));

  assert.strictEqual(0, ee.listenerCount("evt2"));
  assert.deepEqual([], ee.listeners("evt2"));

  assert.deepEqual(ee.eventNames(), [])

  done();
});

it(`Adding/removing listeners during an emit() call should not affect the list of notified listeners when a single listener is added initially`, (done) => {
  // Arrange

  const ee = new DefaultEventEmitter();
  const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

  const
    capturedArgs1a: any[][] = [], handler1a = createHandler("evt1", capturedArgs1a),
    capturedArgs1b: any[][] = [], handler1b = createHandler("evt1", capturedArgs1b);

  const handler = (...args: any[]) => {
    handler1a(...args);
    ee.on("evt1", handler1b);
    ee.off("evt1", handler);
  };
  ee.on("evt1", handler);

  // Act

  const [, args] = emittedArgs[0];
  ee.emit("evt1", ...args);

  // Assert

  assert.deepEqual(capturedArgs1a, emittedArgs.slice(0, 1));
  assert.deepEqual(capturedArgs1b, []);

  assert.strictEqual(1, ee.listenerCount("evt1"));
  assert.deepEqual([handler1b], ee.listeners("evt1"));

  assert.deepEqual(ee.eventNames(), ["evt1"])

  done();
});

it(`Adding/removing listeners during an emit() call should not affect the list of notified listeners when multiple listeners are added initially`, (done) => {
  // Arrange

  const ee = new DefaultEventEmitter();
  const emittedArgs = [...Array(6)].map((_, i) => ["evt1", [...Array(i)].map((_, j) => j)]);

  const
    capturedArgs1a: any[][] = [], handler1a = createHandler("evt1", capturedArgs1a),
    capturedArgs1b: any[][] = [], handler1b = createHandler("evt1", capturedArgs1b);

  const handler = (...args: any[]) => {
    handler1a(...args);
    ee.on("evt1", handler1b);
    ee.off("evt1", handler);
  };
  ee.on("evt1", handler);
  ee.on("evt1", handler);

  // Act

  const [, args] = emittedArgs[0];
  ee.emit("evt1", ...args);

  // Assert

  assert.deepEqual(capturedArgs1a, emittedArgs.slice(0, 1).map(item => [item, item]).flat());
  assert.deepEqual(capturedArgs1b, []);

  assert.strictEqual(2, ee.listenerCount("evt1"));
  assert.deepEqual([handler1b, handler1b], ee.listeners("evt1"));

  assert.deepEqual(ee.eventNames(), ["evt1"])

  done();
});
