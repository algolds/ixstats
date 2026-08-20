/**
 * Tests for BaseBuilderService
 *
 * Phase 3 Task 3.6: Service layer testing
 */

import {
  BaseBuilderService,
  type NotifyOptions,
  type QueueOptions,
} from "~/app/builder/services/base/BaseBuilderService";

// Concrete implementation for testing
interface TestState {
  count: number;
  name: string;
  items: string[];
}

interface TestEvent {
  type: "increment" | "decrement" | "setName";
  payload?: unknown;
}

class TestService extends BaseBuilderService<TestState, TestEvent> {
  public processedEvents: TestEvent[] = [];

  protected getInitialState(): TestState {
    return {
      count: 0,
      name: "initial",
      items: [],
    };
  }

  // Expose protected methods for testing
  public testNotifyListeners(options?: NotifyOptions): void {
    this.notifyListeners(options);
  }

  public testAddToQueue(event: TestEvent, options?: QueueOptions): void {
    this.addToQueue(event, options);
  }

  public getQueueLength(): number {
    return this.updateQueue.length;
  }

  public updateState(partial: Partial<TestState>): void {
    this.state = { ...this.state, ...partial };
  }

  protected override async processEvent(event: TestEvent): Promise<void> {
    this.processedEvents.push(event);

    switch (event.type) {
      case "increment":
        this.state = { ...this.state, count: this.state.count + 1 };
        break;
      case "decrement":
        this.state = { ...this.state, count: this.state.count - 1 };
        break;
      case "setName":
        this.state = { ...this.state, name: event.payload as string };
        break;
    }

    this.notifyListeners();
  }
}

describe("BaseBuilderService", () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    service.dispose();
    jest.useRealTimers();
  });

  describe("Initialization", () => {
    it("initializes with default state from getInitialState", () => {
      const state = service.getState();

      expect(state.count).toBe(0);
      expect(state.name).toBe("initial");
      expect(state.items).toEqual([]);
    });

    it("starts with no listeners", () => {
      expect(service.getListenerCount()).toBe(0);
    });
  });

  describe("Subscribe/Unsubscribe", () => {
    it("adds a listener when subscribed", () => {
      const listener = jest.fn();
      service.subscribe(listener);

      expect(service.getListenerCount()).toBe(1);
    });

    it("removes a listener when unsubscribed", () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);

      expect(service.getListenerCount()).toBe(1);

      unsubscribe();

      expect(service.getListenerCount()).toBe(0);
    });

    it("supports multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      service.subscribe(listener1);
      service.subscribe(listener2);
      service.subscribe(listener3);

      expect(service.getListenerCount()).toBe(3);
    });

    it("only removes the specific listener when unsubscribed", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      service.subscribe(listener1);
      const unsubscribe2 = service.subscribe(listener2);

      unsubscribe2();

      expect(service.getListenerCount()).toBe(1);
    });

    it("handles double unsubscribe gracefully", () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);

      unsubscribe();
      unsubscribe(); // Should not throw

      expect(service.getListenerCount()).toBe(0);
    });
  });

  describe("Notification", () => {
    it("notifies all listeners with current state", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      service.subscribe(listener1);
      service.subscribe(listener2);
      service.updateState({ count: 5 });
      service.testNotifyListeners();

      expect(listener1).toHaveBeenCalledWith(expect.objectContaining({ count: 5 }));
      expect(listener2).toHaveBeenCalledWith(expect.objectContaining({ count: 5 }));
    });

    it("skips notification with deepEqual when state unchanged", () => {
      const listener = jest.fn();
      service.subscribe(listener);

      service.testNotifyListeners();
      const callCount = listener.mock.calls.length;

      // Notify again with same state
      service.testNotifyListeners({ deepEqual: true });

      expect(listener.mock.calls.length).toBe(callCount);
    });

    it("notifies with force option even if state unchanged", () => {
      const listener = jest.fn();
      service.subscribe(listener);

      service.testNotifyListeners();
      const callCount = listener.mock.calls.length;

      // Force notification
      service.testNotifyListeners({ force: true });

      expect(listener.mock.calls.length).toBe(callCount + 1);
    });

    it("handles errors in listeners gracefully", () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const errorListener = jest.fn(() => {
        throw new Error("Listener error");
      });
      const goodListener = jest.fn();

      service.subscribe(errorListener);
      service.subscribe(goodListener);

      // Should not throw, and good listener should still be called
      expect(() => service.testNotifyListeners()).not.toThrow();
      expect(goodListener).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("Update Queue", () => {
    it("adds events to queue", () => {
      service.testAddToQueue({ type: "increment" });

      expect(service.getQueueLength()).toBe(1);
    });

    it("processes queue after debounce timeout", async () => {
      service.testAddToQueue({ type: "increment" });

      expect(service.processedEvents.length).toBe(0);

      // Fast-forward past debounce and run all pending timers/promises
      await jest.runAllTimersAsync();

      expect(service.processedEvents.length).toBe(1);
      expect(service.processedEvents[0]).toEqual({ type: "increment" });
    });

    it("batches multiple events within debounce window", async () => {
      service.testAddToQueue({ type: "increment" });
      service.testAddToQueue({ type: "increment" });
      service.testAddToQueue({ type: "decrement" });

      // Fast-forward past debounce and run all pending timers/promises
      await jest.runAllTimersAsync();

      expect(service.processedEvents.length).toBe(3);
      expect(service.getState().count).toBe(1); // +1 +1 -1 = 1
    });

    it("processes immediately with immediate option", async () => {
      service.testAddToQueue({ type: "increment" }, { immediate: true });

      // processQueue is async, wait for it
      await Promise.resolve();

      expect(service.processedEvents.length).toBe(1);
      expect(service.getState().count).toBe(1);
    });

    it("respects custom debounceMs", async () => {
      service.testAddToQueue({ type: "increment" }, { debounceMs: 500 });

      jest.advanceTimersByTime(200);
      expect(service.processedEvents.length).toBe(0);

      // Advance past 500ms total and process
      await jest.advanceTimersByTimeAsync(350);
      expect(service.processedEvents.length).toBe(1);
    });

    it("clears queue without processing", () => {
      service.testAddToQueue({ type: "increment" });
      service.testAddToQueue({ type: "increment" });

      service.clearQueue();

      expect(service.getQueueLength()).toBe(0);

      // Fast-forward - nothing should process
      jest.advanceTimersByTime(150);
      expect(service.processedEvents.length).toBe(0);
    });

    it("forces immediate queue processing", async () => {
      service.testAddToQueue({ type: "increment" });
      service.testAddToQueue({ type: "setName", payload: "forced" });

      await service.forceProcessQueue();

      expect(service.processedEvents.length).toBe(2);
      expect(service.getState().count).toBe(1);
      expect(service.getState().name).toBe("forced");
    });
  });

  describe("State Management", () => {
    it("returns immutable copy of state", () => {
      const state1 = service.getState();
      const state2 = service.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it("resets to initial state", () => {
      service.updateState({ count: 100, name: "modified" });
      service.testAddToQueue({ type: "increment" });

      service.reset();

      const state = service.getState();
      expect(state.count).toBe(0);
      expect(state.name).toBe("initial");
      expect(service.getQueueLength()).toBe(0);
    });

    it("notifies listeners on reset", () => {
      const listener = jest.fn();
      service.subscribe(listener);
      service.updateState({ count: 100 });

      service.reset();

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ count: 0, name: "initial" }));
    });
  });

  describe("Dispose", () => {
    it("clears all listeners on dispose", () => {
      service.subscribe(jest.fn());
      service.subscribe(jest.fn());

      service.dispose();

      expect(service.getListenerCount()).toBe(0);
    });

    it("clears queue on dispose", () => {
      service.testAddToQueue({ type: "increment" });
      service.testAddToQueue({ type: "increment" });

      service.dispose();

      expect(service.getQueueLength()).toBe(0);
    });
  });
});
