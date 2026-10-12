/**
 * UPG v2 staged generation: which stage a change restarts at, and that a restarted run is the world a full run
 * makes, byte for byte (layers, slots, cells), whichever stage it restarts from.
 */

import { DEFAULT_PARAMS, WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { generateWorld, generateWorldStaged } from "~/lib/worldgen/v2/index";
import {
  planRestart,
  STAGE_FIELDS,
  STAGE_ORDER,
  StageCache,
  type StageId,
  type StageInputs,
} from "~/lib/worldgen/v2/stages";
import { MeshCache } from "~/lib/worldgen/v2/mesh";
import { rasterizeLandMask, type LandMask } from "~/lib/worldgen/land-mask";
import type { GeneratedWorld, WorldGenParams } from "~/lib/worldgen/v2/types";

const CELLS = 3000;
const base = (over: Partial<WorldGenParams> = {}): WorldGenParams => ({
  ...DEFAULT_PARAMS,
  cellCount: CELLS,
  ...over,
});
const inputs = (over: Partial<WorldGenParams> = {}, extra: Partial<StageInputs> = {}) => ({
  params: base(over),
  ...extra,
});

/** One changed value per parameter, none equal to the default or to a preset's. */
const CHANGED: { [K in keyof WorldGenParams]: WorldGenParams[K] } = {
  seed: 43,
  cellCount: 3500,
  plateCount: 12,
  continentCount: 4,
  continentLatitudeRange: [-30, 50],
  continentSizeVariance: 0.8,
  islandShare: 0.1,
  polarLand: { north: true, south: false },
  countryCountRange: [20, 80],
  oceanPercentage: 0.66,
  terrainRoughness: 0.7,
  coastlineComplexity: 0.3,
  hypsometry: [30, 20, 10, 20, 10, 5, 3, 1.5, 0.5],
  temperatureOffset: 2,
  precipitationScale: 1.4,
  riverDensity: 1.5,
  lakeCoverage: 0.02,
  hasIcecaps: false,
  hasRivers: false,
  hasLakes: false,
  useMarkovNaming: false,
  lloydIterations: 3,
  developmentLevel: "modern",
};

const EXPECTED_STAGE: Record<keyof WorldGenParams, StageId> = {
  seed: "mesh",
  cellCount: "mesh",
  lloydIterations: "mesh",
  plateCount: "land",
  continentCount: "land",
  continentLatitudeRange: "land",
  continentSizeVariance: "land",
  islandShare: "land",
  polarLand: "land",
  oceanPercentage: "land",
  terrainRoughness: "land",
  coastlineComplexity: "land",
  hypsometry: "land",
  temperatureOffset: "climate",
  precipitationScale: "climate",
  riverDensity: "climate",
  lakeCoverage: "climate",
  hasRivers: "climate",
  hasLakes: "climate",
  countryCountRange: "nations",
  useMarkovNaming: "nations",
  hasIcecaps: "output",
  developmentLevel: "output",
};

describe("v2/stages planRestart", () => {
  it("starts at the mesh when there is no previous run", () => {
    expect(planRestart(null, inputs())).toBe("mesh");
  });

  it("starts at the output when nothing changed", () => {
    expect(planRestart(inputs(), inputs())).toBe("output");
  });

  it.each(Object.keys(CHANGED) as (keyof WorldGenParams)[])(
    "restarts a change of %s at its stage",
    (field) => {
      const next = inputs({ [field]: CHANGED[field] });
      expect(planRestart(inputs(), next)).toBe(EXPECTED_STAGE[field]);
    }
  );

  it("takes the earliest stage when several changed", () => {
    const next = inputs({ hasIcecaps: false, temperatureOffset: 2, countryCountRange: [20, 80] });
    expect(planRestart(inputs(), next)).toBe("climate");
  });

  it("does not count an equal array or object as a change", () => {
    const next = inputs({
      hypsometry: [...DEFAULT_PARAMS.hypsometry],
      polarLand: { ...DEFAULT_PARAMS.polarLand },
      countryCountRange: [...DEFAULT_PARAMS.countryCountRange],
    });
    expect(planRestart(inputs(), next)).toBe("output");
  });

  it("does not count the same polarLand written in another key order as a change", () => {
    const next = inputs({
      polarLand: { south: DEFAULT_PARAMS.polarLand.south, north: DEFAULT_PARAMS.polarLand.north },
    });
    expect(planRestart(inputs(), next)).toBe("output");
    expect(planRestart(inputs(), inputs({ polarLand: { south: false, north: true } }))).toBe(
      "land"
    );
  });

  it("restarts a different land mask at the land and a different keep-borders at the nations", () => {
    const mask = rasterizeLandMask({}, 64);
    expect(planRestart(inputs({}, { landMask: mask }), inputs({}, { landMask: mask }))).toBe(
      "output"
    );
    expect(planRestart(inputs({}, { landMask: mask }), inputs({}, { landMask: { ...mask } }))).toBe(
      "land"
    );
    expect(planRestart(inputs(), inputs({}, { landMask: mask }))).toBe("land");
    expect(planRestart(inputs(), inputs({}, { keepBorders: true }))).toBe("nations");
    expect(planRestart(inputs({}, { keepBorders: false }), inputs())).toBe("output");
  });

  it("reads every parameter in some stage", () => {
    const listed = new Set(Object.values(STAGE_FIELDS).flat());
    expect([...listed].sort()).toEqual(Object.keys(DEFAULT_PARAMS).sort());
    expect(Object.keys(STAGE_FIELDS)).toEqual([...STAGE_ORDER]);
  });
});

const box: LandMask = rasterizeLandMask(
  {
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
                [-100, -40],
                [90, -40],
                [90, 55],
                [-100, 55],
                [-100, -40],
              ],
            ],
          },
        },
      ],
    },
  },
  360
);

interface Case {
  preset: keyof typeof WORLD_PRESETS;
  seed: number;
  masked: boolean;
  /** The realm keeps its borders (no nations are generated); a mask without it generates nations under the mask */
  keepBorders: boolean;
}
const CASES: Case[] = [
  { preset: "ixnay", seed: 7, masked: false, keepBorders: false },
  { preset: "eurth", seed: 11, masked: false, keepBorders: false },
  { preset: "ixnay", seed: 11, masked: true, keepBorders: true },
  { preset: "eurth", seed: 7, masked: true, keepBorders: true },
  { preset: "ixnay", seed: 7, masked: true, keepBorders: false },
  { preset: "eurth", seed: 11, masked: true, keepBorders: false },
];

/** The world a run made, without the time it took. */
const fingerprint = (world: GeneratedWorld) => ({
  layers: JSON.stringify(world.layers),
  slots: JSON.stringify(world.slots),
  cells: Array.from(world.cells),
  stats: { ...world.stats, generationTimeMs: 0 },
});

/** A change at each stage, from the preset's own values. */
const CHANGES: Record<StageId, (params: WorldGenParams) => Partial<WorldGenParams>> = {
  mesh: () => ({ lloydIterations: 3 }),
  land: (p) => ({ oceanPercentage: p.oceanPercentage - 0.04 }),
  climate: (p) => ({ temperatureOffset: p.temperatureOffset + 1.5 }),
  nations: () => ({ countryCountRange: [30, 90] }),
  output: () => ({ hasIcecaps: false, developmentLevel: "modern" }),
};

describe("v2/stages restart equals a full run", () => {
  describe.each(CASES)(
    "$preset, seed $seed, masked $masked, keep borders $keepBorders",
    ({ preset, seed, masked, keepBorders }) => {
      const options = masked ? { landMask: box, keepBorders } : {};
      const start = base({ ...WORLD_PRESETS[preset], seed });

      it.each(STAGE_ORDER)("restarting at %s makes the world a full run makes", (stage) => {
        const cache = new StageCache();
        const meshCache = new MeshCache();
        generateWorldStaged(start, undefined, { ...options, cache, meshCache });

        const changed = { ...start, ...CHANGES[stage](start) };
        const staged = generateWorldStaged(changed, undefined, { ...options, cache, meshCache });
        const full = generateWorld(changed, undefined, options);

        expect(staged.restartedAt).toBe(stage);
        expect(fingerprint(staged)).toEqual(fingerprint(full));
      });
    }
  );

  it("restarts a toggled keepBorders at the nations under a mask, and equals a full run", () => {
    const start = base({ ...WORLD_PRESETS.eurth, seed: 12 });
    const cache = new StageCache();
    const meshCache = new MeshCache();
    generateWorldStaged(start, undefined, { cache, meshCache, landMask: box, keepBorders: false });
    for (const keepBorders of [true, false]) {
      const options = { landMask: box, keepBorders };
      const staged = generateWorldStaged(start, undefined, { cache, meshCache, ...options });
      expect(staged.restartedAt).toBe("nations");
      expect(fingerprint(staged)).toEqual(fingerprint(generateWorld(start, undefined, options)));
    }
  });

  it("holds for a change of every single parameter", () => {
    const start = base({ ...WORLD_PRESETS.eurth, seed: 5 });
    const cache = new StageCache();
    generateWorldStaged(start, undefined, { cache });
    for (const field of Object.keys(CHANGED) as (keyof WorldGenParams)[]) {
      const changed = { ...start, [field]: CHANGED[field] };
      const staged = generateWorldStaged(changed, undefined, { cache });
      expect(staged.restartedAt).toBe(EXPECTED_STAGE[field]);
      expect(fingerprint(staged)).toEqual(fingerprint(generateWorld(changed)));
      // Back to the start, so the next field is changed from the same world
      generateWorldStaged(start, undefined, { cache });
    }
  });

  it("holds along a chain of changes that reuse each other's snapshots", () => {
    const steps: Partial<WorldGenParams>[] = [
      { temperatureOffset: 2 },
      { temperatureOffset: 2, hasIcecaps: false },
      { temperatureOffset: 2, hasIcecaps: false, countryCountRange: [25, 70] },
      { temperatureOffset: -1, hasIcecaps: false, countryCountRange: [25, 70] },
      { temperatureOffset: -1, hasIcecaps: true, countryCountRange: [25, 70] },
      { oceanPercentage: 0.74 },
      { oceanPercentage: 0.74, precipitationScale: 0.8 },
      { oceanPercentage: 0.74, precipitationScale: 0.8, useMarkovNaming: false },
    ];
    const cache = new StageCache();
    const meshCache = new MeshCache();
    const start = base({ ...WORLD_PRESETS.ixnay, seed: 3 });
    generateWorldStaged(start, undefined, { cache, meshCache });
    for (const step of steps) {
      const params = { ...start, ...step };
      const staged = generateWorldStaged(params, undefined, { cache, meshCache });
      expect(fingerprint(staged)).toEqual(fingerprint(generateWorld(params)));
    }
  });

  it("takes a changed land mask from the land stage and the same mask from the output", () => {
    const start = base({ ...WORLD_PRESETS.eurth, seed: 9 });
    const cache = new StageCache();
    const first = generateWorldStaged(start, undefined, { cache, landMask: box });
    expect(first.restartedAt).toBe("mesh");
    const again = generateWorldStaged(start, undefined, { cache, landMask: box });
    expect(again.restartedAt).toBe("output");
    expect(fingerprint(again)).toEqual(fingerprint(first));

    const other = rasterizeLandMask(
      { background: { type: "FeatureCollection", features: [] } },
      360
    );
    const unmasked = generateWorldStaged(start, undefined, { cache, landMask: other });
    expect(unmasked.restartedAt).toBe("land");
    expect(fingerprint(unmasked)).toEqual(
      fingerprint(generateWorld(start, undefined, { landMask: other }))
    );
  });

  it("reports progress only for the stages that run", () => {
    const start = base({ seed: 4 });
    const cache = new StageCache();
    generateWorldStaged(start, undefined, { cache });
    const seen: string[] = [];
    generateWorldStaged({ ...start, countryCountRange: [30, 90] }, (stage) => seen.push(stage), {
      cache,
    });
    expect(new Set(seen)).toEqual(new Set(["politics", "export"]));
  });

  it("serves the next run from the start after one that threw", () => {
    const start = base({ seed: 6 });
    const cache = new StageCache();
    generateWorldStaged(start, undefined, { cache });
    const failing = { ...start, temperatureOffset: 1 };
    expect(() =>
      generateWorldStaged(
        failing,
        () => {
          throw new Error("boom");
        },
        { cache }
      )
    ).toThrow("boom");
    const next = generateWorldStaged({ ...start, hasIcecaps: false }, undefined, { cache });
    expect(next.restartedAt).toBe("mesh");
    expect(fingerprint(next)).toEqual(fingerprint(generateWorld({ ...start, hasIcecaps: false })));
  });
});

describe("v2/stages cache memory", () => {
  it("holds one snapshot per stage however many runs went through it", () => {
    const start = base({ ...WORLD_PRESETS.eurth, seed: 2 });
    const cache = new StageCache();
    const first = generateWorldStaged(start, undefined, { cache });
    const n = first.graph.cells.n;
    const expected = { land: n * 17, climate: n * 56, nations: n * 60 };
    expect(cache.bytesHeld()).toEqual(expected);

    const params = [
      { oceanPercentage: 0.74 },
      { temperatureOffset: 2 },
      { countryCountRange: [30, 90] as [number, number] },
      { hasIcecaps: false },
      { oceanPercentage: 0.7 },
    ];
    for (const change of params) {
      generateWorldStaged({ ...start, ...change }, undefined, { cache });
      expect(cache.bytesHeld()).toEqual(expected);
    }
  });

  it("exports the finished graph again for an output change and builds a new one for any earlier change", () => {
    const start = base({ seed: 8 });
    const cache = new StageCache();
    const first = generateWorldStaged(start, undefined, { cache });
    const output = generateWorldStaged({ ...start, hasIcecaps: false }, undefined, { cache });
    expect(output.graph).toBe(first.graph);
    expect(cache.graph).toBe(first.graph);
    const nations = generateWorldStaged({ ...start, countryCountRange: [30, 90] }, undefined, {
      cache,
    });
    expect(nations.graph).not.toBe(first.graph);
    expect(cache.graph).toBe(nations.graph);
  });
});
