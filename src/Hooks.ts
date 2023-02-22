import type { IEventEmitter, IEventProvider } from "./EventEmitter";
import { NullEventEmitter } from "./EventEmitter";
import type { ProjectConfig } from "./ProjectConfig";
import type { IEvaluationDetails } from "./RolloutEvaluator";

export type HookEvents = {
  clientReady: [];
  flagEvaluated: [evaluationDetails: IEvaluationDetails];
  configChanged: [newConfig: ProjectConfig];
  clientError: [message: string, exception?: any];
};

/** Defines hooks (events) for providing notifications of `ConfigCatClient`'s actions. */
export interface IProvidesHooks extends IEventProvider<HookEvents> { }

const disconnectedEventEmitter = new NullEventEmitter();

export class Hooks implements IProvidesHooks, IEventEmitter<HookEvents> {
  private eventEmitter: IEventEmitter;

  constructor(eventEmitter: IEventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  tryDisconnect(): boolean {
    // Replacing the current IEventEmitter object (eventEmitter) with a special instance of IEventEmitter (disconnectedEventEmitter) achieves multiple things:
    // 1. determines whether the hooks instance has already been disconnected or not,
    // 2. removes implicit references to subscriber objects (so this instance won't keep them alive under any circumstances),
    // 3. makes sure that future subscriptions are ignored from this point on.
    const originalEventEmitter = this.eventEmitter as IEventEmitter<HookEvents>;
    this.eventEmitter = disconnectedEventEmitter;

    return originalEventEmitter !== disconnectedEventEmitter;
  }

  /** @inheritdoc */
  addListener: <TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void) => this = this.on;

  /** @inheritdoc */
  on<TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void): this {
    this.eventEmitter.on(eventName, listener as (...args: any[]) => void);
    return this;
  }

  /** @inheritdoc */
  once<TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void): this {
    this.eventEmitter.once(eventName, listener as (...args: any[]) => void);
    return this;
  }

  /** @inheritdoc */
  removeListener<TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void): this {
    this.eventEmitter.removeListener(eventName, listener as (...args: any[]) => void);
    return this;
  }

  /** @inheritdoc */
  off: <TEventName extends keyof HookEvents>(eventName: TEventName, listener: (...args: HookEvents[TEventName]) => void) => this = this.removeListener;

  /** @inheritdoc */
  removeAllListeners(eventName?: keyof HookEvents): this {
    this.eventEmitter.removeAllListeners(eventName);
    return this;
  }

  /** @inheritdoc */
  listeners(eventName: keyof HookEvents): Function[] {
    return this.eventEmitter.listeners(eventName);
  }

  /** @inheritdoc */
  listenerCount(eventName: keyof HookEvents): number {
    return this.eventEmitter.listenerCount(eventName);
  }

  /** @inheritdoc */
  eventNames(): Array<keyof HookEvents> {
    return this.eventEmitter.eventNames() as Array<keyof HookEvents>;
  }

  /** @inheritdoc */
  emit<TEventName extends keyof HookEvents>(eventName: TEventName, ...args: HookEvents[TEventName]): boolean {
    return this.eventEmitter.emit(eventName, ...args);
  }
}
