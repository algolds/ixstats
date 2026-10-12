/**
 * One editor's use of the generator worker: keeps an idle worker so its mesh cache survives a slider change,
 * replaces a worker that is still busy when a newer request arrives (a message cannot interrupt the synchronous
 * generator, so terminating is the only way to cancel), drops answers to anything but the latest request, and ends
 * a run that takes too long in the error state. The last good world stays in the view through all of it.
 *
 * Plain TypeScript (the hook only mirrors `onChange` into React state), so it runs under jest with a fake worker.
 */

import type { LandMaskLayers } from "../land-mask";
import type { WorldGenParams } from "../v2/types";
import type {
  WorldGenResult,
  WorldGenStage,
  WorldWorkerFactory,
  WorldWorkerHandle,
  WorldWorkerResponse,
} from "./world-messages";

export const WORLD_GEN_TIMEOUT_MS = 30_000;

export type WorldGenStatus = "idle" | "generating" | "ready" | "error";

export type WorldGenView = {
  state: WorldGenStatus;
  /** Where the running generation is; null when none is running */
  stage: WorldGenStage | null;
  /** 0-100 */
  pct: number;
  /** The stage message for the status bar */
  message: string;
  error: string | null;
  /** The last good world, kept through a run and through an error */
  result: WorldGenResult | null;
};

export const IDLE_VIEW: WorldGenView = {
  state: "idle",
  stage: null,
  pct: 0,
  message: "",
  error: null,
  result: null,
};

export type WorldGenerateOptions = {
  /** The realm's layers, rasterised by the worker into the land mask (generate to fit) */
  landMaskLayers?: LandMaskLayers;
  /** The realm keeps its borders: no countries are generated */
  keepBorders?: boolean;
};

const RUNNING_VIEW = {
  state: "generating",
  stage: null,
  pct: 0,
  message: "",
  error: null,
} as const;

export class WorldGenSession {
  private worker: WorldWorkerHandle | null = null;
  private latestId = 0;
  private busy = false;
  private clock: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private view: WorldGenView = IDLE_VIEW;

  constructor(
    private readonly createWorker: WorldWorkerFactory,
    private readonly onChange: (view: WorldGenView) => void
  ) {}

  generate(
    params: Partial<WorldGenParams>,
    seed: number,
    options: WorldGenerateOptions = {}
  ): void {
    if (this.disposed) return;
    const id = ++this.latestId;
    // A worker still busy cannot take another request; its answer is no longer wanted
    if (this.busy) this.discardWorker();
    try {
      const worker = (this.worker ??= this.start());
      this.busy = true;
      this.clock = setTimeout(() => this.timeOut(id), WORLD_GEN_TIMEOUT_MS);
      this.update(RUNNING_VIEW);
      worker.post({ type: "generate", id, params, seed, ...options });
    } catch (error) {
      this.discardWorker();
      this.fail(
        error instanceof Error ? error.message : "The world generator could not be started"
      );
    }
  }

  /** Ends the run in flight; the view goes back to the last good world, or to idle. */
  cancel(): void {
    if (!this.busy) return;
    this.latestId++;
    this.discardWorker();
    this.update({ state: this.view.result ? "ready" : "idle", stage: null, pct: 0, message: "" });
  }

  /** Ends the run in flight and forgets the world and the error: back to idle, as on a fresh mount. */
  reset(): void {
    if (this.disposed) return;
    this.latestId++;
    this.discardWorker();
    this.update(IDLE_VIEW);
  }

  dispose(): void {
    this.disposed = true;
    this.latestId++;
    this.discardWorker();
  }

  private start(): WorldWorkerHandle {
    const worker: WorldWorkerHandle = this.createWorker({
      onMessage: (message) => this.receive(message),
      onCrash: (message) => {
        // A worker that has been replaced is none of our business
        if (this.worker !== worker) return;
        const wasBusy = this.busy;
        this.latestId++;
        this.discardWorker();
        if (wasBusy) this.fail(message);
      },
    });
    return worker;
  }

  private receive(message: WorldWorkerResponse): void {
    if (message.id !== this.latestId) return;
    if (message.type === "progress") {
      this.update({ stage: message.stage, pct: message.pct, message: message.message });
      return;
    }
    this.stopClock();
    this.busy = false;
    if (message.type === "error") {
      this.fail(message.message);
      return;
    }
    this.update({
      state: "ready",
      stage: null,
      pct: 0,
      message: "",
      error: null,
      result: {
        seed: message.seed,
        params: message.params,
        layers: message.layers,
        slots: message.slots,
        stats: message.stats,
        cells: new Float32Array(message.cells),
        relief: {
          width: message.relief.width,
          height: message.relief.height,
          rgba: new Uint8ClampedArray(message.relief.rgba),
        },
      },
    });
  }

  private timeOut(id: number): void {
    if (id !== this.latestId) return;
    // Whatever the terminated worker still delivers is for a request nobody waits for
    this.latestId++;
    this.discardWorker();
    this.fail("Generating the world took too long");
  }

  /** The error state, with the last good world still in the view. */
  private fail(error: string): void {
    this.update({ state: "error", stage: null, pct: 0, message: "", error });
  }

  private discardWorker(): void {
    this.stopClock();
    this.worker?.terminate();
    this.worker = null;
    this.busy = false;
  }

  private stopClock(): void {
    if (this.clock !== null) clearTimeout(this.clock);
    this.clock = null;
  }

  private update(patch: Partial<WorldGenView>): void {
    this.view = { ...this.view, ...patch };
    if (!this.disposed) this.onChange(this.view);
  }
}
