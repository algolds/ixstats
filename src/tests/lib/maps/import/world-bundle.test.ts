/** @jest-environment node */
/**
 * The world bundle: the browser generator's upload (gzip JSON) and the server's reading of it. A bundle is untrusted
 * input: every hostile or oversized one is refused with its reason, one row per class of refusal (zip bombs, each
 * cap, non-finite and out-of-range numbers, bad rings, the wrong geometry for a layer, unknown slots and layers), and
 * a bundle that parses is safe for the `world` import job, at every cap, past the antimeridian and at both poles.
 */
import { gzipSync } from "node:zlib";
import type { Feature, FeatureCollection, Polygon, Position } from "geojson";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { generateWorld } from "~/lib/worldgen/v2";
import type { GeneratedWorld } from "~/lib/worldgen/v2/types";
import {
  decodeCells,
  encodeCells,
  encodeWorldBundle,
  isGzip,
  MAX_WORLD_BUNDLE_CELLS,
  MAX_WORLD_BUNDLE_FEATURES,
  MAX_WORLD_BUNDLE_JSON_BYTES,
  MAX_WORLD_BUNDLE_POSITIONS,
  MAX_WORLD_BUNDLE_SLOTS,
  parseWorldBundleJson,
  type WorldBundle,
  type WorldBundleSlot,
} from "~/lib/maps/import/world-bundle";
import { parseWorldBundle } from "~/lib/maps/import/world-bundle.node";

const empty = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });
const RING: Position[] = [
  [0, 0],
  [10, 0],
  [10, 7.123],
  [0, 10],
  [0, 0],
];
const polygon = (properties: Feature["properties"], coordinates = [RING]): Feature<Polygon> => ({
  type: "Feature",
  properties,
  geometry: { type: "Polygon", coordinates },
});
const collection = (features: Feature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features,
});
const slot = (n: number): WorldBundleSlot => ({
  key: `slot_${n}`,
  name: `Nation ${n}`,
  colour: "#aa3322",
  claimable: true,
  population: 1_200_000,
  gdpPerCapita: 20_000,
  areaKm2: 80_000,
});
const slots = (n: number) => Array.from({ length: n }, (_, i) => slot(i + 1));

/** A valid bundle: a land, two nations, a river and three cells (4 features, 17 positions besides any lakes). */
function bundle(overrides: Partial<WorldBundle> = {}): WorldBundle {
  return {
    version: 1,
    seed: 42,
    params: { ...DEFAULT_PARAMS },
    source: "preset",
    layers: {
      background: collection([polygon({})]),
      altitudes: empty(),
      climate: empty(),
      political: collection([polygon({ slotKey: "slot_1" }), polygon({ slotKey: "slot_2" })]),
      rivers: collection([
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [1, 1],
              [2, 2],
            ],
          },
        },
      ]),
      lakes: empty(),
      icecaps: empty(),
    },
    slots: [slot(1), slot(2)],
    cells: encodeCells(new Float32Array([10, 20, 300, -10, -20, -5])),
    ...overrides,
  };
}
/** The bundle with one layer replaced. */
const withLayer = (name: keyof WorldBundle["layers"], features: Feature[]) =>
  bundle({ layers: { ...bundle().layers, [name]: collection(features) } });
const { political: _political, ...PHYSICAL } = bundle().layers;
const cellsOf = (...values: number[]) => bundle({ cells: encodeCells(new Float32Array(values)) });
const triangle = (lng: number, lat: number): Position[] => [
  [0, 0],
  [lng, lat],
  [1, 1],
  [0, 0],
];
const polygons = (n: number) => Array.from({ length: n }, () => polygon({}));
/** `n` positions in rings of up to 100,000, each the same two points written out again (short JSON). */
function lakesOf(n: number): Feature[] {
  const ring = (k: number): Position[] => [
    ...Array.from({ length: k - 1 }, (_, i): Position => [i % 2, 0]),
    [0, 0],
  ];
  const rings = Array.from({ length: Math.floor(n / 100_000) }, () => polygon({}, [ring(100_000)]));
  return n % 100_000 >= 4 ? [...rings, polygon({}, [ring(n % 100_000)])] : rings;
}
/** The text of `bundle()` with `find` replaced (for values JSON.stringify cannot write, such as 1e999). */
function textWith(find: string, replace: string) {
  const text = JSON.stringify(bundle());
  if (!text.includes(find)) throw new Error(`the bundle's text has no ${find}`);
  return text.replace(find, replace);
}
const BACKGROUND = '"background":{"type":"FeatureCollection","features":[';
const deepProperty = (depth: number) =>
  textWith(
    BACKGROUND,
    `${BACKGROUND}{"type":"Feature","properties":{"deep":${"[".repeat(depth)}1e999${"]".repeat(depth)}},"geometry":{"type":"Polygon","coordinates":[[[0,0],[10,0],[10,7.123],[0,0]]]}},`
  );

/** What the server's parser says of a bundle (or of its raw text). */
const reasonOf = (input: WorldBundle | string) => {
  const result = parseWorldBundleJson(typeof input === "string" ? input : JSON.stringify(input));
  return result.ok ? null : result.reason;
};

/** What the browser generator uploads for a generated world: all its layers, its slots left claimable. */
function bundleOf(world: GeneratedWorld): WorldBundle {
  const { background, altitudes, climate, political, rivers, lakes, icecaps } = world.layers;
  return {
    version: 1,
    seed: world.seed,
    params: world.params,
    source: "preset",
    layers: {
      background: background!,
      altitudes: altitudes!,
      climate: climate!,
      political: political!,
      rivers: rivers!,
      lakes: lakes!,
      icecaps: icecaps!,
    },
    slots: world.slots.map(({ key, name, colour, population, gdpPerCapita, areaKm2 }) => ({
      ...{ key, name, colour, claimable: true, population, gdpPerCapita, areaKm2 },
    })),
    cells: encodeCells(world.cells),
  };
}

/**
 * A preset world at every cap at once: the most slots, cells and features, with rings past 180 (the generator's
 * reach) and at both poles, and a cell at the far corner of the range with a height no planet has.
 */
function atEveryCap(): WorldBundle {
  const cells = new Float32Array(MAX_WORLD_BUNDLE_CELLS * 3);
  cells.set([-360, 90, 1e30]);
  const background = [triangle(-203.4, 85), triangle(360, 90), triangle(-360, -90)];
  return bundle({
    slots: slots(MAX_WORLD_BUNDLE_SLOTS),
    cells: encodeCells(cells),
    layers: {
      ...bundle().layers,
      background: collection(background.map((ring) => polygon({}, [ring]))),
      lakes: collection(polygons(MAX_WORLD_BUNDLE_FEATURES - 6)),
    },
  });
}

describe("a world bundle the server can use", () => {
  it("round-trips through gzip, a realm-map bundle as written and a generated world with both polar caps", async () => {
    const realmMap = bundle({ source: "realm-map", layers: PHYSICAL, slots: [] });
    const bytes = await encodeWorldBundle(realmMap);
    expect(isGzip(bytes)).toBe(true);
    expect(parseWorldBundle(bytes)).toEqual({ ok: true, bundle: realmMap });
    const polar = { north: true, south: true };
    const world = generateWorld({ ...DEFAULT_PARAMS, seed: 7, cellCount: 6000, polarLand: polar });
    const parsed = parseWorldBundle(await encodeWorldBundle(bundleOf(world)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bundle.slots).toHaveLength(world.slots.length);
    const decoded = decodeCells(parsed.bundle.cells);
    expect(decoded.ok && decoded.cells).toEqual(world.cells);
    const packed = new Float32Array([-179.5, 89.25, -4200.5, 0, 0, 0, 12.125, -33.75, 812]);
    expect(decodeCells(encodeCells(packed))).toEqual({ ok: true, cells: packed });
  });

  it("accepts a world at every cap at once, past the antimeridian and at both poles", () => {
    expect(reasonOf(atEveryCap())).toBeNull();
  });
});

describe("a hostile or broken bundle", () => {
  const twoPolitical = (first: Feature) =>
    withLayer("political", [first, polygon({ slotKey: "slot_2" })]);
  const line: Feature = {
    type: "Feature",
    properties: { slotKey: "slot_1" },
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
  };
  const bad: Array<[string, WorldBundle | string, RegExp]> = [
    ["malformed JSON", "{not json", /not valid JSON/],
    [
      "params past the generator's bounds",
      bundle({ params: { ...DEFAULT_PARAMS, cellCount: 5e6 } }),
      /params/,
    ],
    [
      "more cells than the cap",
      bundle({ cells: encodeCells(new Float32Array((MAX_WORLD_BUNDLE_CELLS + 1) * 3)) }),
      /more than 200,000 cells/,
    ],
    [
      "cells that are not whole triples",
      bundle({ cells: encodeCells(new Float32Array(4)) }),
      /cells/,
    ],
    ["a non-finite cell", cellsOf(0, 0, Number.NaN), /cells.*finite/i],
    ["a cell latitude past the pole", cellsOf(10, 20, 5, 0, -90.5, 0), /cells.*range/i],
    [
      "more slots than the cap",
      bundle({ slots: slots(MAX_WORLD_BUNDLE_SLOTS + 1) }),
      /more than 500/,
    ],
    [
      "one slot name twice, whatever its case and spaces",
      bundle({ slots: [slot(1), { ...slot(2), name: "  NATION 1 " }] }),
      /nation 1.*twice|twice.*nation 1/i,
    ],
    [
      "a non-finite property 50,000 arrays deep, without overflowing the stack",
      deepProperty(50_000),
      /background feature 0.*finite/i,
    ],
    ["a non-finite coordinate", textWith("7.123", "1e999"), /background.*feature 0.*finite/i],
    [
      "a finite latitude PostGIS would fail on",
      withLayer("background", [polygon({}, [triangle(1, 1e300)])]),
      /background feature 0.*finite.*range/i,
    ],
    [
      "a hole that is not closed",
      withLayer("lakes", [polygon({}, [RING, RING.slice(0, 4)])]),
      /lakes.*not closed/i,
    ],
    ["a line in a polygon layer", twoPolitical(line), /political.*feature 0.*polygon/i],
    [
      "a political feature naming an unknown slot",
      twoPolitical(polygon({ slotKey: "slot_99" })),
      /slot_99/,
    ],
    [
      "an unknown layer",
      JSON.stringify({ ...bundle(), layers: { ...bundle().layers, labels: empty() } }),
      /labels/,
    ],
    [
      "a realm-map world with slots",
      bundle({ source: "realm-map", layers: PHYSICAL }),
      /realm map.*slots/i,
    ],
    [
      "the most features counted over every layer together",
      bundle({
        layers: {
          ...bundle().layers,
          lakes: collection(polygons(MAX_WORLD_BUNDLE_FEATURES / 2)),
          icecaps: collection(polygons(MAX_WORLD_BUNDLE_FEATURES / 2)),
        },
      }),
      /has 20,004 map features; a world has at most 20,000/,
    ],
    [
      "one position more than the most",
      withLayer("lakes", lakesOf(MAX_WORLD_BUNDLE_POSITIONS - 17 + 1)),
      /more than 4,000,000 points in its shapes; a world has at most 4,000,000/,
    ],
  ];

  it.each(bad)("is refused: %s", (_name, input, reason) => {
    expect(reasonOf(input)).toMatch(reason);
  });

  it.each([
    ["corrupt gzip", () => gzipSync(JSON.stringify(bundle())).subarray(0, -20), /corrupt|gzip/i],
    [
      "a zip bomb past the 48 MB cap, stopped before the JSON is parsed",
      () => gzipSync(Buffer.alloc(MAX_WORLD_BUNDLE_JSON_BYTES + 1)),
      /more than 48 MB/,
    ],
  ])("is refused from the upload: %s", (_name, bytes, reason) => {
    expect(parseWorldBundle(bytes())).toEqual({ ok: false, reason: expect.stringMatching(reason) });
  });
});
