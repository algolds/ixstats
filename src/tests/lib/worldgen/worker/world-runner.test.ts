/**
 * The generator worker's logic, called directly: what it posts, in which order, what it transfers, what it
 * remembers between requests, and what it does when the generator throws.
 */

import type { FeatureCollection } from "geojson";
import { generateWorld, MeshCache } from "~/lib/worldgen/v2";
import type { LandMaskLayers } from "~/lib/worldgen/land-mask";
import type { WorldWorkerRequest, WorldWorkerResponse } from "~/lib/worldgen/worker/world-messages";
import { createWorldRunner } from "~/lib/worldgen/worker/world-runner";

type Posted = { message: WorldWorkerResponse; transfer: ArrayBuffer[] };
type GenerateOptions = NonNullable<Parameters<typeof generateWorld>[2]>;

/** A runner whose posts are recorded, over the real generator at a size jest can afford. */
function harness(generate: typeof generateWorld = generateWorld) {
  const posted: Posted[] = [];
  const run = createWorldRunner(
    (message, transfer = []) => posted.push({ message, transfer }),
    generate
  );
  return { posted, run };
}

const request = (over: Partial<WorldWorkerRequest> = {}): WorldWorkerRequest => ({
  type: "generate",
  id: 1,
  params: { cellCount: 2500 },
  seed: 7,
  ...over,
});

const last = (posted: Posted[]) => posted[posted.length - 1]!;

/** A realm's landmass: one box of background land over the tropics. */
const boxMap = (): LandMaskLayers => ({
  background: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-60, -30],
              [60, -30],
              [60, 30],
              [-60, 30],
              [-60, -30],
            ],
          ],
        },
      },
    ],
  },
});

describe("worldgen/world-runner", () => {
  it("reports progress with the request id, then one result", () => {
    const { posted, run } = harness();
    run(request({ id: 4 }));

    const messages = posted.map((p) => p.message);
    const progress = messages.filter((m) => m.type === "progress");
    expect(progress.length).toBeGreaterThan(3);
    expect(messages.every((m) => m.id === 4)).toBe(true);
    expect(progress.map((m) => m.pct)).toEqual(
      [...progress.map((m) => m.pct)].sort((a, b) => a - b)
    );
    expect(progress[0]).toMatchObject({ stage: "mesh" });
    expect(progress[progress.length - 1]).toMatchObject({ stage: "export", pct: 100 });
    // Progress comes first and the result is last, exactly once
    expect(messages.filter((m) => m.type === "result")).toHaveLength(1);
    expect(last(posted).message.type).toBe("result");
  });

  it("returns the layers as JSON strings, the slots, the stats and the merged params", () => {
    const { posted, run } = harness();
    run(request({ seed: 21, params: { cellCount: 2500, continentCount: 3 } }));

    const result = last(posted).message;
    if (result.type !== "result") throw new Error(`expected a result, got ${result.type}`);
    expect(result.seed).toBe(21);
    expect(result.params).toMatchObject({ seed: 21, cellCount: 2500, continentCount: 3 });
    expect(result.params.developmentLevel).toBe("industrial");

    expect(Object.keys(result.layers)).toEqual(
      expect.arrayContaining(["background", "altitudes", "climate", "political", "rivers", "lakes"])
    );
    const background = JSON.parse(result.layers.background!) as FeatureCollection;
    expect(background.type).toBe("FeatureCollection");
    expect(background.features.length).toBeGreaterThan(0);

    expect(result.slots.length).toBeGreaterThan(1);
    expect(result.slots[0]!.key).toMatch(/^slot_\d+$/);
    expect(result.stats.slotCount).toBe(result.slots.length);
    expect(result.stats.landShare).toBeGreaterThan(0.05);
    expect(result.stats.baseline).not.toBeNull();
  });

  it("transfers the packed cells and the relief pixels, and only those", () => {
    const { posted, run } = harness();
    run(request());

    const { message, transfer } = last(posted);
    if (message.type !== "result") throw new Error("expected a result");
    expect(transfer).toHaveLength(2);
    expect(transfer).toContain(message.cells);
    expect(transfer).toContain(message.relief.rgba);

    // lng, lat and height as Float32 per cell
    expect(message.cells.byteLength).toBeGreaterThan(0);
    expect(message.cells.byteLength % (3 * 4)).toBe(0);
    expect(message.relief.width).toBe(1024);
    expect(message.relief.height).toBe(1024);
    expect(message.relief.rgba.byteLength).toBe(1024 * 1024 * 4);
    // A world has hills somewhere: the hillshade is not blank
    const alpha = new Uint8Array(message.relief.rgba);
    let shaded = 0;
    for (let i = 3; i < alpha.length; i += 4) if (alpha[i]! > 0) shaded++;
    expect(shaded).toBeGreaterThan(1000);
  });

  it("reuses the mesh for a slider change and builds a new one for a new seed", () => {
    const meshes: Float64Array[] = [];
    const { run } = harness((params, onProgress, options) => {
      const world = generateWorld(params, onProgress, options);
      meshes.push(world.graph!.cells.p);
      return world;
    });
    run(request({ id: 1 }));
    run(request({ id: 2, params: { cellCount: 2500, oceanPercentage: 0.6 } }));
    run(request({ id: 3, seed: 8 }));

    expect(meshes[1]).toBe(meshes[0]);
    expect(meshes[2]).not.toBe(meshes[0]);
  });

  it("rasterises the realm's layers in the worker and fits the world to them", () => {
    const options: (GenerateOptions | undefined)[] = [];
    const { posted, run } = harness((params, onProgress, opts) => {
      options.push(opts);
      return generateWorld(params, onProgress, opts);
    });
    run(request({ landMaskLayers: boxMap() }));

    const mask = options[0]!.landMask!;
    expect(mask.width).toBe(1024);
    expect(mask.height).toBe(512);
    // Centre of the box is land, the far side of the globe is sea
    expect(mask.land[256 * 1024 + 512]).toBe(1);
    expect(mask.land[256 * 1024 + 10]).toBe(0);
    expect(last(posted).message.type).toBe("result");
  });

  it("passes no mask when there are no layers", () => {
    const options: (GenerateOptions | undefined)[] = [];
    const { run } = harness((params, onProgress, opts) => {
      options.push(opts);
      return generateWorld(params, onProgress, opts);
    });
    run(request());
    expect(options[0]!.landMask).toBeUndefined();
    expect(options[0]!.keepBorders).toBeUndefined();
  });

  it("keeps the realm's borders: no political layer, no slots, no baseline", () => {
    const { posted, run } = harness();
    run(request({ landMaskLayers: boxMap(), keepBorders: true }));

    const result = last(posted).message;
    if (result.type !== "result") throw new Error(`expected a result, got ${result.type}`);
    expect(result.layers.political).toBeUndefined();
    expect(result.slots).toEqual([]);
    expect(result.stats.slotCount).toBe(0);
    expect(result.stats.baseline).toBeNull();
  });

  it("answers a generator failure with an error message and keeps working", () => {
    let calls = 0;
    const { posted, run } = harness((params, onProgress, options) => {
      calls++;
      if (calls === 1) throw new Error("mesh exploded");
      return generateWorld(params, onProgress, options);
    });
    run(request({ id: 1 }));
    expect(last(posted).message).toEqual({ type: "error", id: 1, message: "mesh exploded" });

    posted.length = 0;
    run(request({ id: 2 }));
    expect(last(posted).message).toMatchObject({ type: "result", id: 2 });
  });

  it("gives a throw that is not an Error a plain message", () => {
    const { posted, run } = harness(() => {
      throw "nope";
    });
    run(request({ id: 3 }));
    expect(last(posted).message).toEqual({
      type: "error",
      id: 3,
      message: "World generation failed",
    });
  });

  it("lets the request's seed win over a seed in the params", () => {
    const { posted, run } = harness();
    run(request({ seed: 99, params: { cellCount: 2500, seed: 5 } }));
    const result = last(posted).message;
    if (result.type !== "result") throw new Error("expected a result");
    expect(result.seed).toBe(99);
  });
});
