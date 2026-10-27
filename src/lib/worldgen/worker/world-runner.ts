/**
 * The generator worker's logic, apart from the worker scope so it can be called directly.
 *
 * The runner owns the generator's caches: the mesh cache and the stage cache, so a slider change starts at the first
 * stage it reaches, and the land mask, rasterised once per `maskKey`. That is why the editor keeps an idle worker
 * rather than starting one per generate.
 */

import { generateWorldStaged, MeshCache, StageCache } from "~/lib/worldgen/v2";
import type { ProgressCallback, WorldGraph } from "~/lib/worldgen/v2/types";
import {
  nationSeeds,
  renderDiagnostic,
  type DiagnosticImage,
  type DiagnosticKind,
} from "~/lib/worldgen/diagnostics";
import { rasterizeLandMask, type LandMask } from "~/lib/worldgen/land-mask";
import { measureWorld, type MeasureLayers, type WorldMeasures } from "~/lib/worldgen/measure-world";
import { renderMap, type RenderedMap } from "~/lib/worldgen/render-png";
import { previewRelief } from "~/lib/worldgen/relief-preview";
import { computeWorldStats } from "~/lib/worldgen/world-stats";
import { encodePng } from "./encode-png";
import { ENCODE_FAILED } from "./world-query-errors";
import type {
  WorldGenerateRequest,
  WorldWorkerRequest,
  WorldWorkerResponse,
} from "./world-messages";

type PostToMain = (message: WorldWorkerResponse, transfer?: ArrayBuffer[]) => void;

/** The bytes of `view` in a buffer of their own, which can be transferred without taking anything else with it. */
function ownBuffer(view: Float32Array | Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return copy;
}

/** An error's message, or `fallback` for a throw that is not an Error (or has none). */
function messageOf<T>(error: T, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Turns the rendered pixels into a PNG; the worker's is `OffscreenCanvas.convertToBlob`. */
export type PngEncoder = (image: RenderedMap) => Promise<Blob>;

/** The world the worker holds for diagnostics and renders: the graph of the last finished generate. */
type HeldWorld = {
  /** The id of the generate request that made it */
  id: number;
  graph: WorldGraph;
  /** The layers calibration reads (the others enter no measure) */
  layers: MeasureLayers;
  /** Each diagnostic once drawn, until the next generate */
  diagnostics: Map<DiagnosticKind, DiagnosticImage>;
  /** The world's measures once taken, until the next generate */
  measures: WorldMeasures | null;
  /** The world was made with ice caps (`hasIcecaps`), so a render draws them */
  icecaps: boolean;
};

export function createWorldRunner(
  post: PostToMain,
  generate: typeof generateWorldStaged = generateWorldStaged,
  toPng: PngEncoder = encodePng
): (request: WorldWorkerRequest) => void {
  const meshCache = new MeshCache();
  const cache = new StageCache();
  let mask: { key: string; value: LandMask } | null = null;
  let held: HeldWorld | null = null;

  /** The request's land mask: the kept one for a key it has seen, else rasterised (and kept when it has a key). */
  const maskOf = ({ landMaskLayers, maskKey }: WorldGenerateRequest): LandMask | undefined => {
    if (maskKey !== undefined && mask?.key === maskKey) return mask.value;
    if (!landMaskLayers) {
      if (maskKey !== undefined) throw new Error("The land mask for this map was not sent");
      return undefined;
    }
    const value = rasterizeLandMask(landMaskLayers);
    if (maskKey !== undefined) mask = { key: maskKey, value };
    return value;
  };

  const run = (request: WorldGenerateRequest): void => {
    const { id } = request;
    // The stage cache rewrites its graph in place from here on: nothing may be drawn from the old one
    held = null;
    const landMask = maskOf(request);
    const params = { ...request.params, seed: request.seed };
    const onProgress: ProgressCallback = (stage, pct, message) =>
      post({ type: "progress", id, stage, pct, message });
    const options = { landMask, keepBorders: request.keepBorders, meshCache, cache };

    // A restart that fails is run again in full once: the failed run leaves the cache to start at the mesh
    const restarting = cache.ready;
    let world: ReturnType<typeof generate>;
    try {
      world = generate(params, onProgress, options);
    } catch (error) {
      if (!restarting) throw error;
      world = generate(params, onProgress, options);
    }

    const graph = world.graph;
    held = {
      id,
      graph,
      layers: {
        background: world.layers.background,
        political: world.layers.political,
        altitudes: world.layers.altitudes,
        climate: world.layers.climate,
      },
      diagnostics: new Map(),
      measures: null,
      icecaps: world.params.hasIcecaps,
    };
    const relief = previewRelief(world.cells);
    const cells = ownBuffer(world.cells);
    const rgba = ownBuffer(relief.rgba);
    post(
      {
        type: "result",
        id,
        seed: world.seed,
        params: world.params,
        layers: Object.fromEntries(
          Object.entries(world.layers).map(([type, layer]) => [type, JSON.stringify(layer)])
        ),
        slots: world.slots,
        stats: computeWorldStats({
          cells: graph.cells,
          continentCount: world.stats.continentCount,
          slots: world.slots,
        }),
        restartedAt: world.restartedAt,
        generationMs: world.stats.generationTimeMs,
        cells,
        relief: { width: relief.width, height: relief.height, rgba },
      },
      [cells, rgba]
    );
  };

  /** A diagnostic from the held world: drawn once per kind, and posted as a copy so the cached image stays whole. */
  const diagnosticOf = (world: HeldWorld, kind: DiagnosticKind): DiagnosticImage => {
    let image = world.diagnostics.get(kind);
    if (!image) {
      image = renderDiagnostic(world.graph, kind);
      world.diagnostics.set(kind, image);
    }
    return image;
  };

  const answer = (request: Exclude<WorldWorkerRequest, WorldGenerateRequest>): void => {
    const { requestId } = request;
    const fail = (message: string) => post({ type: "request-error", requestId, message });
    const world = held;
    if (!world || world.id !== request.world) {
      fail(world ? "The world has changed since it was requested" : "There is no world to draw");
      return;
    }
    switch (request.type) {
      case "diagnostic": {
        const { rgba, ...image } = diagnosticOf(world, request.kind);
        const copy = ownBuffer(rgba);
        post(
          {
            type: "diagnostic-result",
            requestId,
            world: world.id,
            image: { ...image, rgba: copy },
          },
          [copy]
        );
        return;
      }
      case "seeds":
        post({ type: "seeds-result", requestId, world: world.id, seeds: nationSeeds(world.graph) });
        return;
      case "measure":
        world.measures ??= measureWorld(world.layers);
        post({ type: "measure-result", requestId, world: world.id, measures: world.measures });
        return;
      case "render": {
        const { width, politics } = request;
        // The pixels are made now, from the graph as it is; only the encoding waits
        const image = renderMap(world.graph, width, { politics, icecaps: world.icecaps });
        toPng(image)
          .then((png) => post({ type: "render-result", requestId, world: world.id, width, png }))
          .catch(() => fail(ENCODE_FAILED));
        return;
      }
    }
  };

  return (request) => {
    if (request.type !== "generate") {
      try {
        answer(request);
      } catch (error) {
        post({
          type: "request-error",
          requestId: request.requestId,
          message: messageOf(error, "The request failed"),
        });
      }
      return;
    }
    try {
      run(request);
    } catch (error) {
      post({ type: "error", id: request.id, message: messageOf(error, "World generation failed") });
    }
  };
}
