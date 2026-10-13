/**
 * One editor's use of the generator worker: keeps its worker for the editor's life so the stage cache (and the land
 * mask) survive a slider change, queues the newest request while a run is in flight (a message cannot interrupt the
 * synchronous generator, and a replacement worker would start from the mesh with no cache) and posts it to the same
 * worker when the run answers, drops the answer of the run that was overtaken, and ends a run that takes too long
 * in the error state. A newer request replaces an older queued one. Cancel, reset, dispose and the timeout
 * terminate the worker and clear the queue. The last good world stays in the view through all of it.
 *
 * Diagnostic, seeds, measure and render requests are separate: they have ids of their own, are settled as promises, and are
 * never dropped for a newer generate id. They are answered from the world the worker finished last, so they are
 * refused while a generate runs (the worker holds no world then) and rejected when the worker is replaced.
 *
 * Plain TypeScript (the hook only mirrors `onChange` into React state), so it runs under jest with a fake worker.
 */

import type { FeatureCollection, Point } from "geojson";
import type { DiagnosticKind } from "../diagnostics";
import type { LandMaskLayers } from "../land-mask";
import type { WorldMeasures } from "../measure-world";
import type { PngWidth } from "../render-png";
import type { WorldGenParams } from "../v2/types";
import type {
  DiagnosticResult,
  WorldGenResult,
  WorldGenStage,
  WorldWorkerFactory,
  WorldQueryResponse,
  WorldWorkerHandle,
  WorldWorkerRequest,
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
  /**
   * Names the content of `landMaskLayers` (the realm and its map version). The layers go to a worker once per key;
   * after that the worker uses the mask it kept, and a change that leaves the mask alone restarts the generator
   * later than the land. Without a key the layers are sent, and rasterised, every time.
   */
  maskKey?: string;
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

type Pending = { resolve: (message: WorldQueryResponse) => void; reject: (error: Error) => void };

type QueuedRequest = {
  id: number;
  params: Partial<WorldGenParams>;
  seed: number;
  options: WorldGenerateOptions;
};

export class WorldGenSession {
  private worker: WorldWorkerHandle | null = null;
  private latestId = 0;
  /** The id of the run the worker is on; differs from `latestId` while a newer request is queued */
  private runningId = 0;
  private queued: QueuedRequest | null = null;
  private busy = false;
  /** The `maskKey` the current worker has been sent the layers of */
  private maskKeySent: string | null = null;
  private clock: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  /** The id of the generate whose result the worker holds the graph of; null while none does */
  private heldWorld: number | null = null;
  private nextRequestId = 0;
  private readonly pending = new Map<number, Pending>();
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
    this.heldWorld = null;
    // An answer about the world being replaced must not be taken for the next one's, whichever worker draws it
    this.rejectPending("The world changed before the answer came");
    // A busy worker cannot take another request: the newest waits for its answer, which is then dropped as stale
    if (this.busy) {
      this.queued = { id, params, seed, options };
      this.update(RUNNING_VIEW);
      return;
    }
    this.run({ id, params, seed, options });
  }

  private run({ id, params, seed, options }: QueuedRequest): void {
    try {
      const worker = (this.worker ??= this.start());
      this.busy = true;
      this.runningId = id;
      this.clock = setTimeout(() => this.timeOut(id), WORLD_GEN_TIMEOUT_MS);
      this.update(RUNNING_VIEW);
      worker.post({ type: "generate", id, params, seed, ...this.maskRequest(options) });
    } catch (error) {
      this.discardWorker();
      this.fail(
        error instanceof Error ? error.message : "The world generator could not be started"
      );
    }
  }

  /** A diagnostic layer of the world in view, drawn (or recalled) by the worker: no regeneration. */
  diagnostic(kind: DiagnosticKind): Promise<DiagnosticResult> {
    return this.query("diagnostic-result", (q) => ({ type: "diagnostic", kind, ...q })).then(
      ({ image }) => ({ ...image, rgba: new Uint8ClampedArray(image.rgba) })
    );
  }

  /** The world's nations' seeds, a GeoJSON point at each capital. */
  nationSeeds(): Promise<FeatureCollection<Point>> {
    return this.query("seeds-result", (q) => ({ type: "seeds", ...q })).then(({ seeds }) => seeds);
  }

  /** The world's calibration figures, measured by the worker on its layers. */
  measure(): Promise<WorldMeasures> {
    return this.query("measure-result", (q) => ({ type: "measure", ...q })).then(
      ({ measures }) => measures
    );
  }

  /** The world as an equirectangular PNG, drawn and encoded in the worker. */
  renderPng(width: PngWidth, politics: boolean): Promise<Blob> {
    return this.query("render-result", (q) => ({ type: "render", width, politics, ...q })).then(
      ({ png }) => png
    );
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

  private query<T extends WorldQueryResponse["type"]>(
    type: T,
    build: (query: { requestId: number; world: number }) => WorldWorkerRequest
  ): Promise<Extract<WorldQueryResponse, { type: T }>> {
    const { worker, heldWorld } = this;
    if (this.disposed || !worker || heldWorld === null) {
      return Promise.reject(new Error("There is no world to draw"));
    }
    const requestId = ++this.nextRequestId;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: (message) => resolve(message as Extract<WorldQueryResponse, { type: T }>),
        reject,
      });
      try {
        worker.post(build({ requestId, world: heldWorld }));
      } catch (error) {
        this.pending.delete(requestId);
        reject(error instanceof Error ? error : new Error("The request could not be sent"));
      }
    });
  }

  /** The answer to a diagnostic, seeds, measure or render request, by its own id. */
  private settle(message: Extract<WorldWorkerResponse, { requestId: number }>): void {
    const waiting = this.pending.get(message.requestId);
    if (!waiting) return;
    this.pending.delete(message.requestId);
    if (message.type === "request-error") waiting.reject(new Error(message.message));
    else waiting.resolve(message);
  }

  private rejectPending(message: string): void {
    const waiting = [...this.pending.values()];
    this.pending.clear();
    for (const { reject } of waiting) reject(new Error(message));
  }

  /** The request's mask fields: the layers are left out when this worker already holds the mask for the key. */
  private maskRequest(options: WorldGenerateOptions): WorldGenerateOptions {
    const { landMaskLayers, ...rest } = options;
    if (!landMaskLayers) return rest;
    if (options.maskKey !== undefined && options.maskKey === this.maskKeySent) return rest;
    if (options.maskKey !== undefined) this.maskKeySent = options.maskKey;
    return { ...rest, landMaskLayers };
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
    if ("requestId" in message) {
      this.settle(message);
      return;
    }
    if (message.id !== this.latestId) {
      this.runQueued(message);
      return;
    }
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
    this.heldWorld = message.id;
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
        restartedAt: message.restartedAt,
        generationMs: message.generationMs,
        cells: new Float32Array(message.cells),
        relief: {
          width: message.relief.width,
          height: message.relief.height,
          rgba: new Uint8ClampedArray(message.relief.rgba),
        },
      },
    });
  }

  /** The overtaken run has answered: the worker is free for the request that waited. */
  private runQueued(message: Exclude<WorldWorkerResponse, { requestId: number }>): void {
    const next = this.queued;
    if (!next || message.type === "progress" || message.id !== this.runningId) return;
    this.queued = null;
    this.stopClock();
    this.busy = false;
    this.run(next);
  }

  private timeOut(id: number): void {
    if (id !== this.runningId) return;
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
    this.maskKeySent = null;
    this.queued = null;
    this.busy = false;
    this.heldWorld = null;
    this.rejectPending("The world generator was restarted");
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
