/**
 * Starts the world generator's Web Worker. Kept in a file of its own, imported only by the editor, because
 * `import.meta.url` does not run under jest: the hooks take this as a `WorldWorkerFactory`, and tests pass a fake.
 */

import type { WorldWorkerFactory, WorldWorkerResponse } from "./world-messages";

export const createWorldWorker: WorldWorkerFactory = (listener) => {
  const worker = new Worker(new URL("./world.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<WorldWorkerResponse>) => listener.onMessage(event.data);
  worker.onerror = (event: ErrorEvent) =>
    listener.onCrash(event.message || "The world generator stopped unexpectedly");
  return {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a Worker has no target origin
    post: (request) => worker.postMessage(request),
    terminate: () => worker.terminate(),
  };
};
