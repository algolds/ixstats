/**
 * What the world generator's worker and the editor say to each other. Types only.
 *
 * One request is in flight at a time: a new `generate` terminates the worker that has not answered the last one
 * (a message cannot interrupt the synchronous generator), so there is no cancel message. Every response carries
 * the id of its request; the hook drops anything but the latest.
 */

import type { FeatureCollection, Point } from "geojson";
import type { DiagnosticKind, DiagnosticLegend } from "../diagnostics";
import type { LandMaskLayers } from "../land-mask";
import type { PngWidth } from "../render-png";
import type { StageId } from "../v2/stages";
import type { ProgressCallback, WorldGenParams, WorldSlot } from "../v2/types";
import type { WorldPreviewStats } from "../world-stats";

export type WorldGenStage = Parameters<ProgressCallback>[0];

/**
 * Diagnostic, seeds and render requests are answered from the world the worker last finished. They have ids of
 * their own (`requestId`, counted apart from the generate ids), so a newer generate never makes the session drop
 * their answers, and `world` is the id of the generate whose result the asker is looking at: a request for any other
 * world gets an `request-error`, because the worker's graph is the newest one (or none, after a failed run).
 */
type WorldQuery = { requestId: number; world: number };

export type WorldWorkerRequest =
  | WorldGenerateRequest
  | ({ type: "diagnostic"; kind: DiagnosticKind } & WorldQuery)
  | ({ type: "seeds" } & WorldQuery)
  | ({ type: "render"; width: PngWidth; politics: boolean } & WorldQuery);

export type WorldGenerateRequest = {
  type: "generate";
  id: number;
  /** Merged over the generator's defaults; `seed` below wins over any seed in here */
  params: Partial<WorldGenParams>;
  seed: number;
  /**
   * The realm's own layers, which the worker rasterises into the land mask (generate to fit). Sent with the first
   * request of a `maskKey`, and with every request when there is no key.
   */
  landMaskLayers?: LandMaskLayers;
  /**
   * Names the content of the layers (the realm and its map version). The worker keeps the mask it rasterised by
   * this key, so a request with a key it has seen needs no layers, and the generator sees the same mask object
   * and keeps what it made from it. Without a key the layers are rasterised on every request.
   */
  maskKey?: string;
  /** The realm keeps its borders: no countries are generated and the result has no political layer */
  keepBorders?: boolean;
};

export type WorldWorkerResponse =
  | { type: "progress"; id: number; stage: WorldGenStage; pct: number; message: string }
  | {
      type: "result";
      id: number;
      seed: number;
      /** The parameters the world was made with, defaults filled in */
      params: WorldGenParams;
      /** Each layer as a GeoJSON string, ready for a blob URL */
      layers: Record<string, string>;
      slots: WorldSlot[];
      stats: WorldPreviewStats;
      /** The stage this run started at: the stages before it came from the worker's cache */
      restartedAt: StageId;
      /** What the generator took for this run, in ms */
      generationMs: number;
      /** Packed lng, lat, height (m) per cell as Float32; transferred */
      cells: ArrayBuffer;
      /** Hillshade as straight RGBA in Web Mercator rows (north up, +-MERCATOR_MAX_LAT); transferred */
      relief: { width: number; height: number; rgba: ArrayBuffer };
    }
  | { type: "error"; id: number; message: string }
  | { type: "diagnostic-result"; requestId: number; world: number; image: DiagnosticPayload }
  | { type: "seeds-result"; requestId: number; world: number; seeds: FeatureCollection<Point> }
  | { type: "render-result"; requestId: number; world: number; width: number; png: Blob }
  | { type: "request-error"; requestId: number; message: string };

/** A diagnostic as posted: the pixels are a buffer of their own, transferred. */
export type DiagnosticPayload = {
  kind: DiagnosticKind;
  width: number;
  height: number;
  rgba: ArrayBuffer;
  legend: DiagnosticLegend;
};

/** A diagnostic as the hook hands it out: Web Mercator rows, pinned at +-MERCATOR_MAX_LAT like the relief. */
export type DiagnosticResult = Omit<DiagnosticPayload, "rgba"> & {
  rgba: Uint8ClampedArray<ArrayBuffer>;
};

/** What the worker was asked for, by message type. */
export type WorldQueryResponse = Extract<
  WorldWorkerResponse,
  { type: "diagnostic-result" | "seeds-result" | "render-result" }
>;

/** A finished generation as the editor holds it. */
export type WorldGenResult = {
  seed: number;
  params: WorldGenParams;
  layers: Record<string, string>;
  slots: WorldSlot[];
  stats: WorldPreviewStats;
  /** The stage this run started at: "Draft, 0.4 s from Climate" */
  restartedAt: StageId;
  /** What the generator took for this run, in ms */
  generationMs: number;
  cells: Float32Array;
  relief: { width: number; height: number; rgba: Uint8ClampedArray<ArrayBuffer> };
};

/** The worker as the hook sees it, so a test can stand in for the browser's `Worker`. */
export interface WorldWorkerHandle {
  post(request: WorldWorkerRequest): void;
  terminate(): void;
}

export interface WorldWorkerListener {
  onMessage(message: WorldWorkerResponse): void;
  /** The worker died (uncaught error, script failed to load) */
  onCrash(message: string): void;
}

/** Starts a worker that reports to `listener`; the real one is `createWorldWorker`. */
export type WorldWorkerFactory = (listener: WorldWorkerListener) => WorldWorkerHandle;
