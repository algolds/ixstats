/** @jest-environment node */
/**
 * The World tab and the Studio, from recipe to generation to upload: the controls and fields stay inside the bounds the
 * server's bundle parser accepts, a stored recipe and the job in flight survive what browser storage holds, which realm
 * may take a world from which source, the bundle the server reads for both sources and the draft key that tells a
 * stale check, the generator worker's answers about the world it holds and how it recovers from a failure, and the
 * zip the layers download as.
 *
 * Node, for the gzip the server reads; the draft recipe gets a stand-in for the browser's storage.
 *
 * Folds: src/tests/lib/worldgen/world-controls.test.ts, src/tests/lib/worldgen/studio-fields.test.ts,
 * src/tests/lib/worldgen/world-draft-recipe.test.ts, src/tests/lib/worldgen/studio-apply.test.ts,
 * src/tests/lib/worldgen/zip-store.test.ts, src/tests/lib/worldgen/worker/world-runner.test.ts,
 * src/tests/lib/worldgen/worker/world-runner-queries.test.ts
 */
import { ATLAS_ENGINE_VERSION } from "~/lib/buildVersion";
import { encodeWorldBundle, worldGenParamsSchema } from "~/lib/maps/import/world-bundle";
import { parseWorldBundle } from "~/lib/maps/import/world-bundle.node";
import type { LandMaskLayers } from "~/lib/worldgen/land-mask";
import { applyBlock } from "~/lib/worldgen/studio-apply";
import { PARAM_RANGES } from "~/lib/worldgen/studio-fields";
import { generateWorld, generateWorldStaged } from "~/lib/worldgen/v2";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { buildWorldBundle, draftKey } from "~/lib/worldgen/world-apply";
import {
  CONTROL_LIMITS,
  clampControls,
  controlsForPreset,
  newWorldSeed,
  paramsFromControls,
} from "~/lib/worldgen/world-controls";
import {
  clearWorldRecipe,
  loadWorldJob,
  loadWorldRecipe,
  saveWorldJob,
  saveWorldRecipe,
  WORLD_RECIPE_VERSION,
  worldRecipeKey,
  type WorldJobRef,
  type WorldRecipe,
} from "~/lib/worldgen/world-draft-recipe";
import { FACTORY_PRESETS, type WorldPresetOption } from "~/lib/worldgen/world-presets";
import type {
  WorldGenerateRequest,
  WorldGenResult,
  WorldWorkerResponse,
} from "~/lib/worldgen/worker/world-messages";
import { createWorldRunner } from "~/lib/worldgen/worker/world-runner";
import { crc32, zipStore, type ZipEntry } from "~/lib/worldgen/zip-store";
import { realWorld } from "~/tests/helpers/real-world-result";

jest.setTimeout(30_000);

describe("the controls and the recipe", () => {
  type End = "min" | "max";
  /** Every World tab slider at one end, with a seed from the lowest or the highest draw. */
  const sliderParams = (end: End) => {
    const { continents, landShare, nations, temperature, rainfall } = CONTROL_LIMITS;
    const { sizeSpread, islands, rivers, lakes, coastComplexity, latitude } = CONTROL_LIMITS;
    return {
      ...DEFAULT_PARAMS,
      ...paramsFromControls({
        ...controlsForPreset("earthlike"),
        continents: continents[end],
        landShare: landShare[end],
        nations: nations[end],
        temperature: temperature[end],
        rainfall: rainfall[end],
        sizeSpread: sizeSpread[end],
        islands: islands[end],
        rivers: rivers[end],
        lakes: lakes[end],
        coastComplexity: coastComplexity[end],
        latitudeBand: [latitude[end], latitude[end]],
      }),
      seed: newWorldSeed(() => (end === "min" ? 0 : 0.999999999)),
    };
  };
  /** Every Studio field at one end of its range (a range pair at that end on both sides). */
  const fieldParams = (end: End) => ({
    ...DEFAULT_PARAMS,
    ...Object.fromEntries(
      Object.entries(PARAM_RANGES).map(([key, range]) => [
        key,
        key === "continentLatitudeRange" || key === "countryCountRange"
          ? [range[end], range[end]]
          : range[end],
      ])
    ),
  });

  it.each([
    ["the World tab's sliders", sliderParams],
    ["the Studio's fields", fieldParams],
  ] as const)(
    "put %s at either end inside the bounds a world bundle accepts",
    (_name, paramsAt) => {
      for (const end of ["min", "max"] as const) {
        const parsed = worldGenParamsSchema.safeParse(paramsAt(end));
        const refused = parsed.success
          ? []
          : parsed.error.issues.map((issue) => issue.path.join("."));
        expect({ end, refused }).toEqual({ end, refused: [] });
      }
    }
  );

  it("reproduces a published preset from its own controls, inside the slider limits and without sharing its elevation profile", () => {
    const tuned: WorldPresetOption = {
      slug: "badlands",
      name: "Badlands",
      params: {
        continentCount: 4,
        temperatureOffset: 6,
        terrainRoughness: 0.9,
        hasIcecaps: false,
        plateCount: 14,
        hypsometry: [10, 10, 10, 10, 10, 10, 10, 10, 20],
      },
    };
    const presets = [...FACTORY_PRESETS, tuned];
    const controls = controlsForPreset("badlands", presets);
    expect(clampControls(controls)).toEqual(controls);
    const params = paramsFromControls(controls, presets) as Record<string, unknown>;
    for (const [key, value] of Object.entries(tuned.params))
      expect({ key, value: params[key] }).toEqual({ key, value });
    expect(params.hypsometry).not.toBe(tuned.params.hypsometry);
  });

  /** Browser storage for the draft recipe, which reads `window.localStorage`. */
  const items = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
  };
  beforeAll(() =>
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } })
  );
  afterAll(() => Reflect.deleteProperty(globalThis, "window"));
  beforeEach(() => items.clear());

  const recipe = (): WorldRecipe => ({
    seed: 4242,
    controls: { ...controlsForPreset("eurth"), source: "realm-map", continents: 3 },
  });
  /** What storage holds for a recipe under the current format and engine. */
  const stored = (fields: object) =>
    JSON.stringify({ version: WORLD_RECIPE_VERSION, engine: ATLAS_ENGINE_VERSION, ...fields });

  it("pulls a stored recipe's numbers back inside the slider limits, and a control that is not a finite number to the Earth-like value", () => {
    items.set(
      worldRecipeKey("realm_a"),
      stored({ seed: 9, controls: { ...recipe().controls, continents: 99, rainfall: -3 } })
    );
    expect(loadWorldRecipe("realm_a")?.controls).toMatchObject({
      continents: CONTROL_LIMITS.continents.max,
      rainfall: CONTROL_LIMITS.rainfall.min,
    });
    const earthlike = controlsForPreset("earthlike");
    expect(
      clampControls({ ...earthlike, temperature: Number.NaN, nations: Infinity })
    ).toMatchObject({
      temperature: earthlike.temperature,
      nations: earthlike.nations,
    });
  });

  it.each([
    [
      "made by another engine",
      JSON.stringify({
        ...recipe(),
        version: WORLD_RECIPE_VERSION,
        engine: `${ATLAS_ENGINE_VERSION}-old`,
      }),
    ],
    ["that is not JSON", "{not json"],
  ])("drops a stored recipe %s, so it is not read again", (_name, raw) => {
    items.set(worldRecipeKey("realm_a"), raw);
    expect(loadWorldRecipe("realm_a")).toBeNull();
    expect(items.has(worldRecipeKey("realm_a"))).toBe(false);
  });

  it("keeps the job in flight per realm, apart from the recipe: saving the recipe again or discarding the draft does not lose it", () => {
    const job: WorldJobRef = {
      checkJobId: "j_check",
      applyJobId: "j_apply",
      draftKey: '["preset",7]',
    };
    saveWorldJob("realm_a", job);
    saveWorldRecipe("realm_a", recipe());
    expect(loadWorldJob("realm_a")).toEqual(job);
    clearWorldRecipe("realm_a");
    expect([loadWorldRecipe("realm_a"), loadWorldJob("realm_a"), loadWorldJob("realm_b")]).toEqual([
      null,
      job,
      null,
    ]);
  });
});

describe("which realm may take a world", () => {
  const ixnay = { isIxnay: true };
  it.each([
    [
      "Ixnay, from a preset",
      { sourceKind: "preset", target: ixnay, layers: ["altitudes"] },
      /Fit to a realm's map/,
    ],
    [
      "Ixnay, fitted, with no layer ticked",
      { sourceKind: "fit", target: ixnay, layers: [] },
      /at least one layer/,
    ],
    [
      "Ixnay, fitted, with a layer ticked",
      { sourceKind: "fit", target: ixnay, layers: ["climate"] },
      null,
    ],
    [
      "another realm, from a preset",
      { sourceKind: "preset", target: { isIxnay: false }, layers: [] },
      null,
    ],
  ] as const)("%s", (_name, choice, refusal) => {
    const blocked = applyBlock(choice);
    if (refusal === null) expect(blocked).toBeNull();
    else expect(blocked).toMatch(refusal);
  });
});

describe("the bundle the server reads", () => {
  /** A realm's landmass and borders: a box of land with one country in it. */
  const boxLayer = (
    properties: Record<string, string>
  ): NonNullable<LandMaskLayers["background"]> => ({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties,
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
  });
  const realm: LandMaskLayers = {
    background: boxLayer({}),
    political: boxLayer({ name: "Boxland" }),
  };

  let worlds: { preset: WorldGenResult; fitted: WorldGenResult } | null = null;
  /** Worlds the generator makes through the worker runner; the preset one's request seed is not its params' seed. */
  const generated = () =>
    (worlds ??= {
      preset: realWorld({ seed: 99, params: { cellCount: 3000, plateCount: 8, seed: 5 } }),
      fitted: realWorld({ landMaskLayers: realm, keepBorders: true }),
    });

  it.each([
    { source: "preset", seed: 99, nations: true },
    { source: "realm-map", seed: 7, nations: false },
  ] as const)(
    "reads a $source world from the gzip the browser sends, with the request's seed and slots only for a preset",
    async ({ source, seed, nations }) => {
      const world = source === "preset" ? generated().preset : generated().fitted;
      const bundle = buildWorldBundle(world, source);
      const parsed = parseWorldBundle(await encodeWorldBundle(bundle));
      if (!parsed.ok) throw new Error(parsed.reason);
      expect(parsed.bundle).toMatchObject({
        source,
        seed,
        slots: bundle.slots,
        cells: bundle.cells,
      });
      expect(parsed.bundle.params).toMatchObject({
        seed,
        developmentLevel: bundle.params.developmentLevel,
      });
      // The realm keeps its borders: no political layer, no slots, no baseline range
      expect([
        "political" in parsed.bundle.layers,
        parsed.bundle.slots.length > 0,
        world.stats.baseline !== null,
      ]).toEqual([nations, nations, nations]);
    }
  );

  it("keys a draft by its source, seed, parameters and layer choice, so a check of another draft is stale", () => {
    const world = generated().preset;
    const key = draftKey(world, "preset");
    expect(draftKey({ ...world }, "preset")).toBe(key);
    expect(
      [
        draftKey(world, "realm-map"),
        draftKey({ ...world, seed: world.seed + 1 }, "preset"),
        draftKey({ ...world, params: { ...world.params, temperatureOffset: 3 } }, "preset"),
      ].filter((other) => other === key)
    ).toEqual([]);
    const choice = draftKey(world, "realm-map", ["rivers", "climate"]);
    expect(draftKey(world, "realm-map", ["climate", "rivers"])).toBe(choice);
    expect(choice).not.toBe(draftKey(world, "realm-map"));
  });
});

describe("the generator worker", () => {
  const generate = (over: Partial<WorldGenerateRequest> = {}): WorldGenerateRequest => ({
    type: "generate",
    id: 1,
    params: { cellCount: 2500 },
    seed: 7,
    ...over,
  });
  /** A runner over the real generator; `failNext` runs throw half way, once the climate stage began. */
  function harness() {
    const posted: WorldWorkerResponse[] = [];
    const control = { failNext: 0 };
    const run = createWorldRunner(
      (message) => posted.push(message),
      (params, onProgress, options) =>
        generateWorldStaged(
          params,
          (stage, pct, message) => {
            if (stage === "hydro-climate" && control.failNext > 0) {
              control.failNext--;
              throw new Error("climate exploded");
            }
            onProgress?.(stage, pct, message);
          },
          options
        )
    );
    return { run, control, last: () => posted[posted.length - 1]! };
  }

  it("never answers from a world it no longer holds: before any, after a newer one, or once a failed generate may have half rewritten its graph", () => {
    const { run, control, last } = harness();
    run({ type: "seeds", requestId: 1, world: 1 });
    expect(last()).toMatchObject({ type: "request-error", message: "There is no world to draw" });
    run(generate({ id: 1 }));
    run(generate({ id: 2 }));
    run({ type: "measure", requestId: 2, world: 1 });
    expect(last()).toMatchObject({ type: "request-error", requestId: 2 });
    run({ type: "diagnostic", requestId: 3, world: 2, kind: "height" });
    expect(last()).toMatchObject({ type: "diagnostic-result", requestId: 3, world: 2 });
    // The restart fails, and so does its run in full: there is no world any more
    control.failNext = 2;
    run(generate({ id: 3, params: { cellCount: 2500, temperatureOffset: 1 } }));
    expect(last()).toMatchObject({ type: "error", id: 3 });
    run({ type: "seeds", requestId: 4, world: 2 });
    expect(last()).toMatchObject({
      type: "request-error",
      requestId: 4,
      message: "There is no world to draw",
    });
  });

  it("recovers from a failure without a stale world: an error the next request recovers from, and a failed restart run again in full", () => {
    const { run, control, last } = harness();
    control.failNext = 1;
    run(generate({ id: 1 }));
    expect(last()).toEqual({ type: "error", id: 1, message: "climate exploded" });
    run(generate({ id: 2, maskKey: "unseen" }));
    expect(last()).toMatchObject({ type: "error", id: 2 });
    run(generate({ id: 3 }));
    expect(last()).toMatchObject({ type: "result", id: 3, restartedAt: "mesh" });

    // A restart that fails half way is run again from the mesh (the cached one): the world a plain run makes
    control.failNext = 1;
    const params = { cellCount: 2500, temperatureOffset: 1 };
    run(generate({ id: 4, params }));
    const result = last();
    if (result.type !== "result") throw new Error(`expected a result, got ${result.type}`);
    expect([result.id, result.restartedAt]).toEqual([4, "mesh"]);
    const plain = generateWorld({ ...params, seed: 7 });
    for (const [type, layer] of Object.entries(plain.layers))
      expect({ type, same: result.layers[type] === JSON.stringify(layer) }).toEqual({
        type,
        same: true,
      });
  });
});

describe("the layers' zip", () => {
  const utf8 = new TextEncoder();
  const file = (name: string, content: string): ZipEntry => ({ name, data: utf8.encode(content) });

  /** The entries read back the way an unzip tool does: end record, central directory, then each local header. */
  function readZip(zip: Uint8Array) {
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocd = zip.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    const count = view.getUint16(eocd + 10, true);
    let at = view.getUint32(eocd + 16, true);
    const entries: Array<{ name: string; data: number[]; crc: number; method: number }> = [];
    for (let i = 0; i < count; i++) {
      expect(view.getUint32(at, true)).toBe(0x02014b50);
      const crc = view.getUint32(at + 16, true);
      const size = view.getUint32(at + 24, true);
      expect(view.getUint32(at + 20, true)).toBe(size);
      const nameLength = view.getUint16(at + 28, true);
      const skip = nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
      const local = view.getUint32(at + 42, true);
      expect([view.getUint32(local, true), view.getUint32(local + 14, true)]).toEqual([
        0x04034b50,
        crc,
      ]);
      const dataAt =
        local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      entries.push({
        name: new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength)),
        data: Array.from(zip.subarray(dataAt, dataAt + size)),
        crc,
        method: view.getUint16(at + 10, true),
      });
      at += 46 + skip;
    }
    expect(at).toBe(eocd);
    return entries;
  }

  it("writes an archive an unzip tool reads back name for name and byte for byte, with the standard CRC-32", () => {
    const files = [
      file("political.geojson", '{"type":"FeatureCollection","features":[]}'),
      file("background.geojson", "a".repeat(5000)),
      file("check.txt", "123456789"),
      file("empty.geojson", ""),
    ];
    const entries = readZip(zipStore(files));
    expect(entries).toEqual(
      files.map(({ name, data }) => ({ name, data: Array.from(data), crc: crc32(data), method: 0 }))
    );
    // The CRC-32 check value every implementation agrees on
    expect(entries[2]!.crc).toBe(0xcbf43926);
  });

  it("refuses a name that is empty or twice in the archive", () => {
    expect(() => zipStore([file("", "x")])).toThrow(/name/i);
    expect(() => zipStore([file("a", "x"), file("a", "y")])).toThrow(/twice/i);
  });
});
