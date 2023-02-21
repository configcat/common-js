import type { IEventEmitter } from "./EventEmitter";

type Listener = { fn: (...args: any[]) => void, once?: boolean };
type Listeners = Listener | Listener[] & { fn?: never };

function isSingle(listeners: Listeners): listeners is Listener {
  return !!listeners.fn;
}

// NOTE: It's better to place this class into a separate module so
// it can be omitted from the final bundle in case we choose to
// make the common library EventEmitter implementation-agnostic in the future.

/** A platform-independent implementation of `IEventEmitter`. */
export class DefaultEventEmitter implements IEventEmitter {
  private events: Record<string | symbol, Listeners> = {};
  private eventCount = 0;

  private addListenerCore(eventName: string | symbol, fn: (...args: any[]) => void, once: boolean) {
    if (typeof fn !== 'function') {
      throw new TypeError("Listener must be a function");
    }

    const listeners = this.events[eventName];
    const listener: Listener = { fn, once };

    if (!listeners) {
      this.events[eventName] = listener;
      this.eventCount++;
    }
    else if (isSingle(listeners)) {
      this.events[eventName] = [listeners, listener];
    }
    else {
      listeners.push(listener);
    }

    return this;
  }

  private removeListenerCore<TState>(eventName: string | symbol, state: TState, isMatch: (listener: Listener, state: TState) => boolean) {
    const listeners = this.events[eventName];

    if (!listeners) {
      return this;
    }

    if (!isSingle(listeners)) {
      for (let i = listeners.length - 1; i >= 0; i--) {
        if (isMatch(listeners[i], state)) {
          listeners.splice(i, 1);
          if (!listeners.length) {
            this.removeEvent(eventName);
          }
          else if (listeners.length === 1) {
            this.events[eventName] = listeners[0];
          }
          break;
        }
      }
    }
    else if (isMatch(listeners, state)) {
      this.removeEvent(eventName);
    }

    return this;
  }

  private removeEvent(eventName: string | symbol) {
    if (--this.eventCount === 0) {
      this.events = {};
    }
    else {
      delete this.events[eventName];
    }
  }

  addListener: (eventName: string | symbol, listener: (...args: any[]) => void) => this = this.on;

  on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return this.addListenerCore(eventName, listener, false);
  }

  once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return this.addListenerCore(eventName, listener, true);
  }

  removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    if (typeof listener !== 'function') {
      throw new TypeError("Listener must be a function");
    }

    return this.removeListenerCore(eventName, listener, (listener, fn) => listener.fn === fn);
  }

  off: (eventName: string | symbol, listener: (...args: any[]) => void) => this = this.removeListener;

  removeAllListeners(eventName?: string | symbol | undefined): this {
    if (!eventName) {
      this.events = {};
      this.eventCount = 0;
    }
    else if (this.events[eventName]) {
      this.removeEvent(eventName);
    }

    return this;
  }

  listeners(eventName: string | symbol): Function[] {
    const listeners = this.events[eventName];

    if (!listeners) {
      return [];
    }

    if (isSingle(listeners)) {
      return [listeners.fn];
    }

    const length = listeners.length, fns = new Array<Function>(length);
    for (let i = 0; i < length; i++) {
      fns[i] = listeners[i].fn;
    }
    return fns;
  }

  listenerCount(eventName: string | symbol): number {
    const listeners = this.events[eventName];

    if (!listeners) {
      return 0;
    }

    if (isSingle(listeners)) {
      return 1;
    }

    return listeners.length;
  }

  eventNames(): (string | symbol)[] {
    const names: (string | symbol)[] = [];
    let events: Record<string | symbol, Listeners>;

    if (this.eventCount === 0) {
      return names;
    }

    events = this.events;
    for (let name in events) {
      if (events.hasOwnProperty(name)) {
        names.push(name);
      }
    }

    if (Object.getOwnPropertySymbols) {
      return names.concat(Object.getOwnPropertySymbols(events));
    }

    return names;
  }

  emit(eventName: string | symbol, arg0?: any, arg1?: any, arg2?: any, arg3?: any, ...moreArgs: any[]): boolean {
    let listeners = this.events[eventName];

    if (!listeners) {
      return false;
    }

    let listener: Listener, length: number;

    if (isSingle(listeners)) {
      [listener, length] = [listeners, 1];
    }
    else {
      // According to the specification, potential removes during emit should not change the list of notified listeners,
      // so we need to create a local copy of the current listeners.
      listeners = listeners.slice();
      [listener, length] = [listeners[0], listeners.length];
    }

    const argCount = arguments.length - 1;

    for (let i = 0; ;) {
      if (listener.once) {
        this.removeListenerCore(eventName, listener, (listener, toRemove) => listener === toRemove);
      }

      switch (argCount) {
        case 0: listener.fn.call(this); break;
        case 1: listener.fn.call(this, arg0); break;
        case 2: listener.fn.call(this, arg0, arg1); break;
        case 3: listener.fn.call(this, arg0, arg1, arg2); break;
        case 4: listener.fn.call(this, arg0, arg1, arg2, arg3); break;
        default:
          let args = new Array(argCount);
          for (let j = 0; j < argCount; j++) {
            args[j] = arguments[j + 1];
          }
          listener.fn.apply(this, args);
          break;
      }

      if (++i >= length) {
        break;
      }

      listener = (listeners as Listener[])[i];
    }

    return true;
  }
}
