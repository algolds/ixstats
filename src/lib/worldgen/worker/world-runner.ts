/**
 * The generator worker's logic, apart from the worker scope so it can be called directly.
 *
 * The runner owns the mesh cache, so a slider change (same seed, cell count and relaxation) reuses the mesh of the
 * previous world, which is why the editor keeps an idle worker rather than starting one per generate.
 */

import { generateWorld, MeshCache } from "~/lib/worldgen/v2";
import { rasterizeLandMask } from "~/lib/worldgen/land-mask";
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
  generate: typeof generateWorld = generateWorld
): (request: WorldWorkerRequest) => void {
  const meshCache = new MeshCache();

  const run = (request: WorldWorkerRequest): void => {
    const { id } = request;
    const landMask = request.landMaskLayers ? rasterizeLandMask(request.landMaskLayers) : undefined;
    const world = generate(
      { ...request.params, seed: request.seed },
      (stage, pct, message) => post({ type: "progress", id, stage, pct, message }),
      { landMask, keepBorders: request.keepBorders, meshCache }
    );
    const graph = world.graph;
    if (!graph) throw new Error("The generator returned no world graph");

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
