/**
 * Progress and cooperative yielding for the import engines. An engine that runs on the server's main thread (no
 * worker thread available) calls `tick()` inside its long loops: it yields to the event loop at most every
 * `sliceMs`, so requests keep being served while a large map is traced. Inside a worker thread the same calls
 * are cheap no-ops apart from the clock read.
 */

/** Progress callback: overall percent (0-100) and a short stage text for the wizard. */
export type ProgressFn = (percent: number, stage: string) => void;

export class ImportCancelledError extends Error {
  constructor() {
    super("The import was cancelled");
    this.name = "ImportCancelledError";
  }
}

export interface EngineContext {
  progress: ProgressFn;
  /** Yield to the event loop if the current slice has run long enough. Throws when the job was cancelled. */
  tick: () => Promise<void>;
}

const yieldNow = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * An engine context. `isCancelled` is polled on every yield; `sliceMs` is how long the engine may run between
 * yields (Infinity in a worker thread, where blocking is fine).
 */
export function engineContext(
  progress: ProgressFn = () => undefined,
  options: { sliceMs?: number; isCancelled?: () => boolean } = {}
): EngineContext {
  const sliceMs = options.sliceMs ?? 40;
  let sliceStart = Date.now();
  return {
    progress,
    tick: async () => {
      if (Date.now() - sliceStart < sliceMs) return;
      if (options.isCancelled?.()) throw new ImportCancelledError();
      await yieldNow();
      sliceStart = Date.now();
    },
  };
}

/** Map a stage's own 0-1 progress into its slice of the overall percent. */
export function stageProgress(progress: ProgressFn, from: number, to: number, stage: string) {
  return (fraction: number) =>
    progress(Math.round(from + (to - from) * Math.max(0, Math.min(1, fraction))), stage);
}
