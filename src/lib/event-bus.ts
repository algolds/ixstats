import { EventEmitter } from "events";

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish an event to the EventBus
   */
  public publish(eventName: string, payload?: any): void {
    this.emit(eventName, payload);
  }

  /**
   * Subscribe to an event on the EventBus
   */
  public subscribe(eventName: string, handler: (payload: any) => void | Promise<void>): void {
    this.on(eventName, handler);
  }

  /**
   * Unsubscribe from an event
   */
  public unsubscribe(eventName: string, handler: (payload: any) => void): void {
    this.off(eventName, handler);
  }
}

export const eventBus = EventBus.getInstance();
