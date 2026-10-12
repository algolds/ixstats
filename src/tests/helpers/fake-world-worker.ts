/**
 * A stand-in for the world generator's Web Worker: records the requests it is sent and lets a test speak for it.
 * `workers` lists every worker the factory started, so a test can see which one was terminated and reused.
 */

import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import type {
  WorldGenResult,
  WorldWorkerFactory,
  WorldWorkerHandle,
  WorldWorkerListener,
  WorldGenerateRequest,
  WorldWorkerRequest,
  WorldWorkerResponse,
} from "~/lib/worldgen/worker/world-messages";

export type FakeWorldWorker = WorldWorkerHandle & {
  listener: WorldWorkerListener;
  /** The generate requests */
  posted: WorldGenerateRequest[];
  /** The diagnostic, seeds and render requests */
  queries: Exclude<WorldWorkerRequest, WorldGenerateRequest>[];
  terminated: boolean;
  /** Deliver a message as if the worker had posted it (also after termination, as a queued one could) */
  say(message: WorldWorkerResponse): void;
};

export function fakeWorldWorkers() {
  const workers: FakeWorldWorker[] = [];
  const factory: WorldWorkerFactory = (listener) => {
    const worker: FakeWorldWorker = {
      listener,
      posted: [],
      queries: [],
      terminated: false,
      post: (request) => {
        if (request.type === "generate") worker.posted.push(request);
        else worker.queries.push(request);
      },
      terminate: () => {
        worker.terminated = true;
      },
      say: (message) => listener.onMessage(message),
    };
    workers.push(worker);
    return worker;
  };
  return { factory, workers };
}

type ResultMessage = Extract<WorldWorkerResponse, { type: "result" }>;

const emptyLayer = JSON.stringify({ type: "FeatureCollection", features: [] });

/** A finished generation the way the worker posts it: tiny, but with every field. */
export function resultMessage(id: number, over: Partial<ResultMessage> = {}): ResultMessage {
  return {
    type: "result",
    id,
    seed: 7,
    params: { ...DEFAULT_PARAMS, seed: 7 },
    layers: {
      background: emptyLayer,
      altitudes: emptyLayer,
      political: emptyLayer,
      lakes: emptyLayer,
      rivers: emptyLayer,
    },
    slots: [],
    stats: { landShare: 0.3, continents: 4, climateMix: { D: 1 }, slotCount: 0, baseline: null },
    restartedAt: "mesh",
    generationMs: 10,
    cells: new Float32Array([10, 20, 300]).buffer,
    relief: { width: 2, height: 2, rgba: new Uint8Array(16).buffer },
    ...over,
  };
}

/** A GeoJSON layer as a string; `tag` makes two layers differ. */
export const layerJson = (tag: string): string =>
  JSON.stringify({ type: "FeatureCollection", features: [], tag });

/** A finished generation as the hooks hold it (typed arrays, not buffers). */
export function worldResult(over: Partial<WorldGenResult> = {}): WorldGenResult {
  return {
    seed: 7,
    params: { ...DEFAULT_PARAMS, seed: 7 },
    layers: {
      background: layerJson("background"),
      altitudes: layerJson("altitudes"),
      climate: layerJson("climate"),
      political: layerJson("political"),
      lakes: layerJson("lakes"),
      rivers: layerJson("rivers"),
      icecaps: layerJson("icecaps"),
    },
    slots: [],
    stats: { landShare: 0.3, continents: 4, climateMix: { D: 1 }, slotCount: 0, baseline: null },
    restartedAt: "mesh",
    generationMs: 10,
    cells: new Float32Array([10, 20, 300]),
    relief: { width: 2, height: 2, rgba: new Uint8ClampedArray(16) },
    ...over,
  };
}
