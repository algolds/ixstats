/**
 * The browser factory: a module worker on world.worker.ts whose messages and crashes reach the listener.
 */

import type { WorldWorkerRequest, WorldWorkerResponse } from "~/lib/worldgen/worker/world-messages";
import { createWorldWorker } from "~/lib/worldgen/worker/create-world-worker";

class StubWorker {
  static last: StubWorker;
  onmessage: ((event: { data: WorldWorkerResponse }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  posted: WorldWorkerRequest[] = [];
  terminated = false;
  constructor(
    readonly url: URL,
    readonly options: { type: string }
  ) {
    StubWorker.last = this;
  }
  postMessage(message: WorldWorkerRequest) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "Worker", { value: StubWorker, configurable: true });
});

describe("worldgen/create-world-worker", () => {
  it("starts a module worker on the world worker script", () => {
    createWorldWorker({ onMessage: jest.fn(), onCrash: jest.fn() });
    expect(StubWorker.last.options).toEqual({ type: "module" });
    expect(String(StubWorker.last.url)).toMatch(/world\.worker\.ts$/);
  });

  it("passes requests to the worker and terminates it", () => {
    const handle = createWorldWorker({ onMessage: jest.fn(), onCrash: jest.fn() });
    handle.post({ type: "generate", id: 1, params: {}, seed: 2 });
    expect(StubWorker.last.posted).toEqual([{ type: "generate", id: 1, params: {}, seed: 2 }]);
    handle.terminate();
    expect(StubWorker.last.terminated).toBe(true);
  });

  it("hands the data of a worker message to the listener", () => {
    const onMessage = jest.fn();
    createWorldWorker({ onMessage, onCrash: jest.fn() });
    const message: WorldWorkerResponse = { type: "error", id: 3, message: "no" };
    StubWorker.last.onmessage!({ data: message });
    expect(onMessage).toHaveBeenCalledWith(message);
  });

  it("reports a crash with the browser's message, or one of its own when there is none", () => {
    const onCrash = jest.fn();
    createWorldWorker({ onMessage: jest.fn(), onCrash });
    StubWorker.last.onerror!({ message: "SyntaxError: bad script" });
    StubWorker.last.onerror!({ message: "" });
    expect(onCrash).toHaveBeenNthCalledWith(1, "SyntaxError: bad script");
    expect(onCrash).toHaveBeenNthCalledWith(2, "The world generator stopped unexpectedly");
  });

  it("reports an answer the browser could not deserialise as a crash", () => {
    const onCrash = jest.fn();
    createWorldWorker({ onMessage: jest.fn(), onCrash });
    StubWorker.last.onmessageerror!();
    expect(onCrash).toHaveBeenCalledWith("The world generator sent an unreadable answer");
  });
});
