// The interfaces below define a subset of Node's EventEmitter (see https://nodejs.org/api/events.html#class-eventemitter),
// so they are (structurally) compatible with instances of EventEmitter.

type Events = Record<string | symbol, any[]>;

/** Defines methods for subscribing to/unsubscribing from events. */
export interface IEventProvider<TEvents extends Events = Events> {
    /**
     * Alias for `emitter.on(eventName, listener)`.
     */
    addListener<TEventName extends keyof TEvents>(eventName: TEventName, listener: (...args: TEvents[TEventName]) => void): this;

    /**
     * Adds the `listener` function to the end of the listeners array for the
     * event named `eventName`. No checks are made to see if the `listener` has
     * already been added. Multiple calls passing the same combination of `eventName` and
     * `listener` will result in the `listener` being added, and called, multiple times.
     *
     * Returns a reference to the `EventEmitter`, so that calls can be chained.
     *
     * @param eventName The name of the event.
     * @param listener The callback function
     */
    on<TEventName extends keyof TEvents>(eventName: TEventName, listener: (...args: TEvents[TEventName]) => void): this;

    /**
     * Adds a **one-time** `listener` function for the event named `eventName`. The
     * next time `eventName` is triggered, this listener is removed and then invoked.
     *
     * Returns a reference to the `EventEmitter`, so that calls can be chained.
     *
     * @param eventName The name of the event.
     * @param listener The callback function
     */
    once<TEventName extends keyof TEvents>(eventName: TEventName, listener: (...args: TEvents[TEventName]) => void): this;

    /**
     * Removes the specified `listener` from the listener array for the event named `eventName`.
     *
     * `removeListener()` will remove, at most, one instance of a listener from the
     * listener array. If any single listener has been added multiple times to the
     * listener array for the specified `eventName`, then `removeListener()` must be
     * called multiple times to remove each instance.
     *
     * Once an event is emitted, all listeners attached to it at the
     * time of emitting are called in order. This implies that any `removeListener()` or `removeAllListeners()`
     * calls _after_ emitting and _before_ the last listener finishes execution will
     * not remove them from `emit()` in progress. Subsequent events behave as expected.
     *
     * Because listeners are managed using an internal array, calling this will
     * change the position indices of any listener registered _after_ the listener
     * being removed. This will not impact the order in which listeners are called,
     * but it means that any copies of the listener array as returned by
     * the `emitter.listeners()` method will need to be recreated.
     *
     * When a single function has been added as a handler multiple times for a single
     * event (as in the example below), `removeListener()` will remove the most
     * recently added instance.
     *
     * Returns a reference to the `EventEmitter`, so that calls can be chained.
     */
    removeListener<TEventName extends keyof TEvents>(eventName: TEventName, listener: (...args: TEvents[TEventName]) => void): this;

    /**
     * Alias for `emitter.removeListener()`.
     */
    off<TEventName extends keyof TEvents>(eventName: TEventName, listener: (...args: TEvents[TEventName]) => void): this;

    /**
     * Removes all listeners, or those of the specified `eventName`.
     *
     * It is bad practice to remove listeners added elsewhere in the code,
     * particularly when the `EventEmitter` instance was created by some other
     * component or module (e.g. sockets or file streams).
     *
     * Returns a reference to the `EventEmitter`, so that calls can be chained.
     */
    removeAllListeners(eventName?: keyof TEvents): this;

    /**
     * Returns a copy of the array of listeners for the event named `eventName`.
     */
    listeners(eventName: keyof TEvents): Function[];

    /**
     * Returns the number of listeners listening to the event named `eventName`.
     * @param eventName The name of the event being listened for
     */
    listenerCount(eventName: keyof TEvents): number;

    /**
     * Returns an array listing the events for which the emitter has registered
     * listeners. The values in the array are strings or `Symbol`s.
     */
    eventNames(): Array<keyof TEvents>;
}

/** Defines methods for emitting events. */
export interface IEventEmitter<TEvents extends Events = Events> extends IEventProvider<TEvents> {
    /**
     * Synchronously calls each of the listeners registered for the event named `eventName`,
     * in the order they were registered, passing the supplied arguments to each.
     *
     * Returns `true` if the event had listeners, `false` otherwise.
     */
    emit<TEventName extends keyof TEvents>(eventName: TEventName, ...args: TEvents[TEventName]): boolean;
}

export class NullEventEmitter implements IEventEmitter {
    addListener: () => this = this.on;

    on(): this { return this; }

    once(): this { return this; }

    removeListener(): this { return this; }

    off: () => this = this.removeListener;

    removeAllListeners(): this { return this; }

    listeners(): Function[] { return []; }

    listenerCount(): number { return 0; }

    eventNames(): (string | symbol)[] { return []; }

    emit(): boolean { return false; }
}
