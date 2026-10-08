/**
 * Run an import engine on an uploaded file, or the physical layer engine on a realm's map art. Under Bun (the cron
 * runner, scripts) a PNG is traced in a worker thread, so the process's event loop stays free; elsewhere (the
 * Next.js server under Node, tests) the engine runs inline and yields between slices (progress.ts). SVG and
 * GeoJSON are light and always run inline. Server only.
 */
import fs from "node:fs";
import path from "node:path";
import type { EngineResult, MapImportKind, MapImportOptions } from "./options";
import { runPngEngine } from "./png/engine";
import type { LayerEngineOptions } from "./png/layer-engine-options";
import {
  runLayerEngine,
  type LayerEngineResult,
  type LayerEngineSources,
} from "./png/layer-engine";
import { runSvgEngine } from "./svg-engine";
import { runGeojsonEngine } from "./geojson-engine";
import { engineContext, ImportCancelledError, type ProgressFn } from "./progress";

/** The engine for one kind of file, inline. */
export async function runImportEngineInline(
  kind: MapImportKind,
  bytes: Uint8Array,
  options: MapImportOptions,
  progress: ProgressFn,
  isCancelled: () => boolean = () => false,
  sliceMs = 40
): Promise<EngineResult> {
  const ctx = engineContext(progress, { sliceMs, isCancelled });
  if (kind === "png") return runPngEngine(bytes, options.png, ctx);
  const text = new TextDecoder("utf-8").decode(bytes);
  progress(10, kind === "svg" ? "Reading the SVG" : "Reading the GeoJSON");
  const result =
    kind === "svg" ? runSvgEngine(text, options.svg) : runGeojsonEngine(text, options.geojson);
  progress(99, "Done");
  return result;
}

/** The worker script, run from source: only Bun runs TypeScript in a worker thread directly. */
function workerScript(): string | null {
  if (typeof (globalThis as { Bun?: unknown }).Bun === "undefined") return null;
  const file = path.join(process.cwd(), "src", "lib", "maps", "import", "engine.worker.ts");
  return fs.existsSync(file) ? file : null;
}

/** What the worker thread runs: an import of one file, or the physical layer engine on a realm's art. */
export type EngineTask =
  | { task: "import"; kind: MapImportKind; bytes: Uint8Array; options: MapImportOptions }
  | { task: "layers"; sources: LayerEngineSources; options: Partial<LayerEngineOptions> };

interface WorkerMessage<T> {
  type: "progress" | "result" | "error";
  percent?: number;
  stage?: string;
  result?: T;
  message?: string;
}

/** One task in a worker thread; `isCancelled` is polled on progress and stops the worker. */
async function runInWorker<T>(
  script: string,
  task: EngineTask,
  progress: ProgressFn,
  isCancelled: () => boolean
): Promise<T> {
  const { Worker } = await import("node:worker_threads");
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(script);
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      fn();
    };
    worker.on("message", (message: WorkerMessage<T>) => {
      if (message.type === "progress") {
        if (isCancelled()) finish(() => reject(new ImportCancelledError()));
        else progress(message.percent ?? 0, message.stage ?? "");
      } else if (message.type === "result" && message.result) {
        finish(() => resolve(message.result!));
      } else if (message.type === "error") {
        finish(() => reject(new Error(message.message ?? "The import engine failed")));
      }
    });
    worker.on("error", (error) => finish(() => reject(error)));
    worker.on("exit", (code) => {
      if (code !== 0)
        finish(() => reject(new Error(`The import engine stopped (exit code ${code})`)));
    });
    worker.postMessage(task, []);
  });
}

/**
 * The engine off the main thread when possible. `isCancelled` is polled on progress; a cancelled run stops the
 * worker and rejects with ImportCancelledError.
 */
export async function runImportEngine(
  kind: MapImportKind,
  bytes: Uint8Array,
  options: MapImportOptions,
  progress: ProgressFn,
  isCancelled: () => boolean = () => false
): Promise<EngineResult> {
  const script = kind === "png" ? workerScript() : null;
  if (!script) return runImportEngineInline(kind, bytes, options, progress, isCancelled);
  return runInWorker<EngineResult>(
    script,
    { task: "import", kind, bytes, options },
    progress,
    isCancelled
  );
}

/** The physical layer engine (png/layer-engine.ts) on a realm's art, in a worker thread when possible. */
export async function runLayerEngineTask(
  sources: LayerEngineSources,
  options: Partial<LayerEngineOptions>,
  progress: ProgressFn,
  isCancelled: () => boolean = () => false
): Promise<LayerEngineResult> {
  const script = workerScript();
  if (!script) return runLayerEngine(sources, options, engineContext(progress, { isCancelled }));
  return runInWorker<LayerEngineResult>(
    script,
    { task: "layers", sources, options },
    progress,
    isCancelled
  );
}
