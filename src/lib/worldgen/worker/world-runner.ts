/**
 * The generator worker's logic, apart from the worker scope so it can be called directly.
 *
 * The runner owns the generator's caches: the mesh cache and the stage cache, so a slider change starts at the first
 * stage it reaches, and the land mask, rasterised once per `maskKey`. That is why the editor keeps an idle worker
 * rather than starting one per generate.
 */

import { generateWorldStaged, MeshCache, StageCache } from "~/lib/worldgen/v2";
import type { ProgressCallback } from "~/lib/worldgen/v2/types";
import { rasterizeLandMask, type LandMask } from "~/lib/worldgen/land-mask";
import { previewRelief } from "~/lib/worldgen/relief-preview";
import { computeWorldStats } from "~/lib/worldgen/world-stats";
import type { WorldWorkerRequest, WorldWorkerResponse } from "./world-messages";

type PostToMain = (message: WorldWorkerResponse, transfer?: ArrayBuffer[]) => void;

/** The bytes of `view` in a buffer of their own, which can be transferred without taking anything else with it. */
function ownBuffer(view: Float32Array | Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return copy;
}

export function createWorldRunner(
  post: PostToMain,
  generate: typeof generateWorldStaged = generateWorldStaged
): (request: WorldWorkerRequest) => void {
  const meshCache = new MeshCache();
  const cache = new StageCache();
  let mask: { key: string; value: LandMask } | null = null;

  /** The request's land mask: the kept one for a key it has seen, else rasterised (and kept when it has a key). */
  const maskOf = ({ landMaskLayers, maskKey }: WorldWorkerRequest): LandMask | undefined => {
    if (maskKey !== undefined && mask?.key === maskKey) return mask.value;
    if (!landMaskLayers) {
      if (maskKey !== undefined) throw new Error("The land mask for this map was not sent");
      return undefined;
    }
    const value = rasterizeLandMask(landMaskLayers);
    if (maskKey !== undefined) mask = { key: maskKey, value };
    return value;
  };

  const run = (request: WorldWorkerRequest): void => {
    const { id } = request;
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

  return (request) => {
    try {
      run(request);
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "World generation failed";
      post({ type: "error", id: request.id, message });
    }
  };
}
