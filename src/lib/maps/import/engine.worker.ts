/**
 * Worker thread for the map engines (run-engine.ts starts it under Bun): an import of one file, or the physical
 * layer engine on a realm's art. Receives one task, posts progress messages, then the result or an error, and is
 * terminated by its parent.
 */
import { parentPort } from "node:worker_threads";
import { runLayerEngine } from "./png/layer-engine";
import { engineContext, type ProgressFn } from "./progress";
import { runImportEngineInline, type EngineTask } from "./run-engine";

function run(job: EngineTask, progress: ProgressFn) {
  if (job.task === "layers") {
    return runLayerEngine(job.sources, job.options, engineContext(progress, { sliceMs: Infinity }));
  }
  return runImportEngineInline(job.kind, job.bytes, job.options, progress, () => false, Infinity);
}

parentPort?.on("message", async (job: EngineTask) => {
  const port = parentPort!;
  let last = -1;
  try {
    const result = await run(job, (percent, stage) => {
      if (percent === last) return;
      last = percent;
      port.postMessage({ type: "progress", percent, stage });
    });
    port.postMessage({ type: "result", result });
  } catch (error) {
    port.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
