/**
 * Worker thread for the map import engine (run-engine.ts starts it under Bun). Receives one file, posts
 * progress messages, then the result or an error, and is terminated by its parent.
 */
import { parentPort } from "node:worker_threads";
import type { MapImportKind, MapImportOptions } from "./options";
import { runImportEngineInline } from "./run-engine";

parentPort?.on(
  "message",
  async (job: { kind: MapImportKind; bytes: Uint8Array; options: MapImportOptions }) => {
    const port = parentPort!;
    let last = -1;
    try {
      const result = await runImportEngineInline(
        job.kind,
        job.bytes,
        job.options,
        (percent, stage) => {
          if (percent === last) return;
          last = percent;
          port.postMessage({ type: "progress", percent, stage });
        },
        () => false,
        Infinity
      );
      port.postMessage({ type: "result", result });
    } catch (error) {
      port.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);
