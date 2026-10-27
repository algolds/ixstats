/**
 * The world generator's Web Worker (started by `create-world-worker.ts`). All of the logic is in `world-runner.ts`;
 * this file only connects it to the worker scope.
 */

import { createWorldRunner } from "./world-runner";
import type { WorldWorkerRequest, WorldWorkerResponse } from "./world-messages";

/** The slice of the dedicated worker scope used here (the project compiles against the DOM lib, not WebWorker). */
interface WorldWorkerScope {
  onmessage: ((event: { data: WorldWorkerRequest }) => void) | null;
  postMessage(message: WorldWorkerResponse, transfer: ArrayBuffer[]): void;
}
declare const self: WorldWorkerScope;

const run = createWorldRunner((message, transfer = []) => self.postMessage(message, transfer));
self.onmessage = (event) => run(event.data);
