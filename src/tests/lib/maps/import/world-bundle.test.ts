/** @jest-environment node */
/**
 * The world bundle: the browser generator's upload (gzip JSON) and the server's reading of it. Hostile or oversized
 * bundles are refused with a reason; a bundle that parses is safe for the `world` import job.
 */
import { gzipSync } from "node:zlib";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { generateWorld } from "~/lib/worldgen/v2";
import type { GeneratedWorld } from "~/lib/worldgen/v2/types";
import {
  decodeCells,
  encodeCells,
  encodeWorldBundle,
  isGzip,
  MAX_WORLD_BUNDLE_CELLS,
  MAX_WORLD_BUNDLE_JSON_BYTES,
  MAX_WORLD_BUNDLE_SLOTS,
  parseWorldBundleJson,
  worldGenParamsSchema,
  type WorldBundle,
  type WorldBundleSlot,
} from "~/lib/maps/import/world-bundle";
import { parseWorldBundle } from "~/lib/maps/import/world-bundle.node";

const empty = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });
const ring = [
  [0, 0],
  [10, 0],
  [10, 7.123],
  [0, 10],
  [0, 0],
];
const polygon = (properties: Feature["properties"], coordinates = [ring]): Feature<Polygon> => ({
  type: "Feature",
  properties,
  geometry: { type: "Polygon", coordinates },
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

function bundle(overrides: Partial<WorldBundle> = {}): WorldBundle {
  return {
    version: 1,
    seed: 42,
    params: { ...DEFAULT_PARAMS },
    source: "preset",
    layers: {
      background: { type: "FeatureCollection", features: [polygon({})] },
      altitudes: empty(),
      climate: empty(),
      political: {
        type: "FeatureCollection",
        features: [polygon({ slotKey: "slot_1" }), polygon({ slotKey: "slot_2" })],
      },
      rivers: {
        type: "FeatureCollection",
        features: [
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
        ],
      },
      lakes: empty(),
      icecaps: empty(),
    },
    slots: [slot(1), slot(2)],
    cells: encodeCells(new Float32Array([10, 20, 300, -10, -20, -5])),
    ...overrides,
  };
}

/** What the browser generator would upload for a generated world: all its layers, its slots left claimable. */
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
      key,
      name,
      colour,
      claimable: true,
      population,
      gdpPerCapita,
      areaKm2,
    })),
    cells: encodeCells(world.cells),
  };
}

const reasonOf = (text: string) => {
  const result = parseWorldBundleJson(text);
  return result.ok ? null : result.reason;
};
const reasonOfBundle = (b: WorldBundle) => reasonOf(JSON.stringify(b));

describe("encodeWorldBundle and parseWorldBundle", () => {
  it("round-trips a bundle through gzip", async () => {
    const original = bundle();
    const bytes = await encodeWorldBundle(original);
    expect(isGzip(bytes)).toBe(true);
    const parsed = parseWorldBundle(bytes);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bundle).toEqual(original);
    const cells = decodeCells(parsed.bundle.cells);
    expect(cells.ok && Array.from(cells.cells)).toEqual([10, 20, 300, -10, -20, -5]);
  });

  it("round-trips a generated world", async () => {
    const world = generateWorld({ ...DEFAULT_PARAMS, seed: 7, cellCount: 3000, plateCount: 8 });
    const parsed = parseWorldBundle(await encodeWorldBundle(bundleOf(world)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bundle.slots).toHaveLength(world.slots.length);
    expect(parsed.bundle.slots.length).toBeGreaterThan(0);
    const decoded = decodeCells(parsed.bundle.cells);
    expect(decoded.ok && decoded.cells).toEqual(world.cells);
  });

  it("accepts a realm-map world: a physical layer set with no political layer and no slots", () => {
    const { political: _political, ...physical } = bundle().layers;
    expect(
      parseWorldBundleJson(
        JSON.stringify(bundle({ source: "realm-map", layers: physical, slots: [] }))
      ).ok
    ).toBe(true);
  });

  it("refuses bytes that are not gzip", () => {
    const result = parseWorldBundle(new TextEncoder().encode(JSON.stringify(bundle())));
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/gzip/i) });
  });

  it("refuses corrupt gzip data", () => {
    const bytes = gzipSync(JSON.stringify(bundle()));
    const result = parseWorldBundle(bytes.subarray(0, bytes.length - 20));
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/corrupt|gzip/i) });
  });

  it("stops a zip bomb at the decompressed cap, before the JSON is parsed", () => {
    const bomb = gzipSync(Buffer.alloc(2 * 1024 * 1024));
    expect(bomb.length).toBeLessThan(10_000);
    const result = parseWorldBundle(bomb, 1024 * 1024);
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/more than 1 MB/) });
  });

  it("refuses gzip that is not JSON", () => {
    expect(parseWorldBundle(gzipSync("hello"))).toEqual({
      ok: false,
      reason: expect.stringMatching(/not valid JSON/),
    });
  });
});

describe("parseWorldBundleJson refuses", () => {
  it("malformed JSON", () => {
    expect(reasonOf("{not json")).toMatch(/not valid JSON/);
    expect(reasonOf("[]")).toMatch(/world bundle/i);
    expect(reasonOf("null")).toMatch(/world bundle/i);
  });

  it("an unknown version", () => {
    expect(reasonOf(JSON.stringify({ ...bundle(), version: 2 }))).toMatch(/version/);
  });

  it("params outside the generator's bounds", () => {
    const params = { ...DEFAULT_PARAMS, cellCount: 5_000_000 };
    expect(reasonOfBundle(bundle({ params }))).toMatch(/params/);
    expect(reasonOfBundle(bundle({ params: { ...DEFAULT_PARAMS, hypsometry: [1] } }))).toMatch(
      /hypsometry/
    );
  });

  it("more cells than the cap", () => {
    const tooMany = encodeCells(new Float32Array((MAX_WORLD_BUNDLE_CELLS + 1) * 3));
    expect(reasonOfBundle(bundle({ cells: tooMany }))).toMatch(/more than 200,000 cells/);
    const atCap = encodeCells(new Float32Array(MAX_WORLD_BUNDLE_CELLS * 3));
    expect(reasonOfBundle(bundle({ cells: atCap }))).toBeNull();
  });

  it("cells that are not whole base64 float triples", () => {
    expect(reasonOfBundle(bundle({ cells: "%%%%" }))).toMatch(/cells/);
    expect(reasonOfBundle(bundle({ cells: encodeCells(new Float32Array(4)) }))).toMatch(/cells/);
  });

  it("a non-finite cell value", () => {
    const cells = encodeCells(new Float32Array([0, 0, Number.NaN]));
    expect(reasonOfBundle(bundle({ cells }))).toMatch(/cells.*finite/i);
  });

  it("more slots than the cap", () => {
    const slots = Array.from({ length: MAX_WORLD_BUNDLE_SLOTS + 1 }, (_, i) => slot(i + 1));
    expect(reasonOfBundle(bundle({ slots }))).toMatch(/more than 500/);
  });

  it("duplicate slot keys and malformed slots", () => {
    expect(reasonOfBundle(bundle({ slots: [slot(1), slot(1)] }))).toMatch(/slot_1.*twice/);
    expect(reasonOfBundle(bundle({ slots: [{ ...slot(1), colour: "red" }] }))).toMatch(/colour/);
    expect(reasonOfBundle(bundle({ slots: [{ ...slot(1), name: "  " }] }))).toMatch(/name/);
  });

  it("a non-finite number in a slot or in a feature's properties", () => {
    const slotText = JSON.stringify(bundle()).replace('"population":1200000', '"population":1e999');
    expect(reasonOf(slotText)).toMatch(/slots/);
    const props = bundle();
    props.layers.background.features[0]!.properties = { area: 12345.678 };
    const propsText = JSON.stringify(props).replace("12345.678", "1e999");
    expect(reasonOf(propsText)).toMatch(/background.*finite/i);
  });

  it("a non-finite coordinate", () => {
    const text = JSON.stringify(bundle()).replace("7.123", "1e999");
    expect(reasonOf(text)).toMatch(/background.*feature 0.*finite/i);
  });

  it("a ring that is not closed", () => {
    const open = bundle();
    open.layers.political!.features[1] = polygon({ slotKey: "slot_2" }, [ring.slice(0, 4)]);
    expect(reasonOfBundle(open)).toMatch(/political.*feature 1.*not closed/i);
  });

  it("a ring with fewer than four points, and a polygon with no ring", () => {
    const small = bundle();
    small.layers.lakes = {
      type: "FeatureCollection",
      features: [
        polygon({}, [
          [
            [0, 0],
            [1, 1],
            [0, 0],
          ],
        ]),
      ],
    };
    expect(reasonOfBundle(small)).toMatch(/lakes.*feature 0.*fewer than 4/i);
    const none = bundle();
    none.layers.lakes = { type: "FeatureCollection", features: [polygon({}, [])] };
    expect(reasonOfBundle(none)).toMatch(/lakes.*feature 0/i);
  });

  it("a hole that is not closed", () => {
    const holed = bundle();
    holed.layers.lakes = {
      type: "FeatureCollection",
      features: [polygon({}, [ring, [...ring.slice(0, 4)]])],
    };
    expect(reasonOfBundle(holed)).toMatch(/lakes.*not closed/i);
  });

  it("a MultiPolygon with a bad ring", () => {
    const multi = bundle();
    multi.layers.icecaps = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "MultiPolygon", coordinates: [[ring], [ring.slice(0, 3)]] },
        },
      ],
    };
    expect(reasonOfBundle(multi)).toMatch(/icecaps.*feature 0/i);
  });

  it("a political feature whose slotKey is not in slots, or has none", () => {
    const stray = bundle();
    stray.layers.political!.features[0] = polygon({ slotKey: "slot_99" });
    expect(reasonOfBundle(stray)).toMatch(/slot_99/);
    const none = bundle();
    none.layers.political!.features[0] = polygon({ name: "A" });
    expect(reasonOfBundle(none)).toMatch(/political.*feature 0.*slotKey/);
  });

  it("a realm-map source with a political layer or with slots", () => {
    expect(reasonOfBundle(bundle({ source: "realm-map" }))).toMatch(/realm map.*political/i);
    const { political: _political, ...physical } = bundle().layers;
    expect(reasonOfBundle(bundle({ source: "realm-map", layers: physical }))).toMatch(
      /realm map.*slots/i
    );
  });

  it("an unknown layer, a missing layer, and a line in a polygon layer", () => {
    const extra = { ...bundle(), layers: { ...bundle().layers, labels: empty() } };
    expect(reasonOf(JSON.stringify(extra))).toMatch(/labels/);
    const { lakes: _lakes, ...short } = bundle().layers;
    expect(reasonOf(JSON.stringify({ ...bundle(), layers: short }))).toMatch(/lakes/);
    const line = bundle();
    line.layers.political!.features[0]!.geometry = {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    };
    expect(reasonOfBundle(line)).toMatch(/political.*feature 0.*polygon/i);
  });

  it("a feature with no geometry", () => {
    const empty = '"lakes":{"type":"FeatureCollection","features":[]}';
    const hollow =
      '"lakes":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":null}]}';
    const text = JSON.stringify(bundle());
    expect(text).toContain(empty);
    expect(reasonOf(text.replace(empty, hollow))).toMatch(/lakes.*feature 0.*geometry/i);
  });
});

describe("parseWorldBundleJson bounds", () => {
  const withBackground = (coordinates: number[][]) => {
    const b = bundle();
    b.layers.background = { type: "FeatureCollection", features: [polygon({}, [coordinates])] };
    return b;
  };
  const triangle = (lng: number, lat: number) => [
    [0, 0],
    [lng, lat],
    [1, 1],
    [0, 0],
  ];

  it("refuses a finite but absurd coordinate that PostGIS would later fail on", () => {
    expect(reasonOfBundle(withBackground(triangle(1, 1e300)))).toMatch(
      /background feature 0.*finite.*range/i
    );
    expect(reasonOfBundle(withBackground(triangle(1e300, 1)))).toMatch(/background feature 0/i);
    expect(reasonOfBundle(withBackground(triangle(1, 90.5)))).toMatch(/range/i);
    expect(reasonOfBundle(withBackground(triangle(360.5, 1)))).toMatch(/range/i);
  });

  it("accepts the real generator's reach: longitude past 180 on antimeridian rings, the poles", () => {
    expect(reasonOfBundle(withBackground(triangle(-203.4, 85)))).toBeNull();
    expect(reasonOfBundle(withBackground(triangle(360, 90)))).toBeNull();
    expect(reasonOfBundle(withBackground(triangle(-360, -90)))).toBeNull();
  });

  it("bounds the lng and lat of every cell, but only requires a finite height", () => {
    const cellsOf = (...values: number[]) =>
      bundle({ cells: encodeCells(new Float32Array(values)) });
    expect(reasonOfBundle(cellsOf(3e38, 0, 0))).toMatch(/cells.*range/i);
    expect(reasonOfBundle(cellsOf(0, 91, 0))).toMatch(/cells.*range/i);
    expect(reasonOfBundle(cellsOf(10, 20, 5, 0, -90.5, 0))).toMatch(/cells.*range/i);
    expect(reasonOfBundle(cellsOf(1e300, 0, 0))).toMatch(/cells.*finite/i);
    expect(reasonOfBundle(cellsOf(-360, 90, 1e30))).toBeNull();
  });

  it("finds a non-finite number at any depth in a feature's properties, without overflowing the stack", () => {
    const text = JSON.stringify(bundle());
    const background = '"background":{"type":"FeatureCollection","features":[';
    const feature = (nested: string) =>
      `${background}{"type":"Feature","properties":{"deep":${nested}},"geometry":{"type":"Polygon","coordinates":[[[0,0],[10,0],[10,7.123],[0,0]]]}},`;
    const nest = (depth: number) => `${"[".repeat(depth)}1e999${"]".repeat(depth)}`;
    expect(text).toContain(background);
    expect(reasonOf(text.replace(background, feature(nest(20))))).toMatch(
      /background feature 0.*finite/i
    );
    expect(reasonOf(text.replace(background, feature(nest(50_000))))).toMatch(
      /background feature 0.*finite/i
    );
  });
});

describe("parseWorldBundleJson accepts only bundles the importer can use", () => {
  it("takes exactly 500 slots and refuses 501", () => {
    const slots = (n: number) => Array.from({ length: n }, (_, i) => slot(i + 1));
    expect(reasonOfBundle(bundle({ slots: slots(MAX_WORLD_BUNDLE_SLOTS) }))).toBeNull();
    expect(reasonOfBundle(bundle({ slots: slots(MAX_WORLD_BUNDLE_SLOTS + 1) }))).toMatch(
      /more than 500/
    );
  });

  it("needs a political layer in a preset world", () => {
    const { political: _political, ...physical } = bundle().layers;
    expect(reasonOfBundle(bundle({ layers: physical }))).toMatch(/preset.*political/i);
  });

  it("refuses a bundle with no cells", () => {
    expect(reasonOfBundle(bundle({ cells: "" }))).toMatch(/no cells/i);
  });

  it("refuses two slots with the same name, ignoring case and surrounding spaces", () => {
    const twin = { ...slot(2), name: "  NATION 1 " };
    expect(reasonOfBundle(bundle({ slots: [slot(1), twin] }))).toMatch(
      /nation 1.*twice|twice.*nation 1/i
    );
  });
});

describe("the decompressed cap", () => {
  it("is 48 MB, a few times the largest legitimate bundle", () => {
    expect(MAX_WORLD_BUNDLE_JSON_BYTES).toBe(48 * 1024 * 1024);
  });

  it("stops a bomb at the real cap, before the JSON is parsed", () => {
    const bomb = gzipSync(Buffer.alloc(MAX_WORLD_BUNDLE_JSON_BYTES + 1));
    expect(bomb.length).toBeLessThan(200_000);
    expect(parseWorldBundle(bomb)).toEqual({
      ok: false,
      reason: expect.stringMatching(/more than 48 MB/),
    });
  });
});

describe("worlds the generator makes at the poles", () => {
  // The spline smoothing of Antarctic rivers overshot to latitude -90.74 on these seeds; the bundle gate (PostGIS
  // cannot project past 90) refused the world. The generator now clamps what it exports.
  const cases = [
    ["default params", [33, 36], {}],
    ["both polar caps", [5, 37], { polarLand: { north: true, south: true } }],
  ] as const;

  it.each(cases)(
    "%s: the generated bundle passes the gate",
    (_label, seeds, params) => {
      for (const seed of seeds) {
        const world = generateWorld({ ...DEFAULT_PARAMS, ...params, seed });
        const result = parseWorldBundleJson(JSON.stringify(bundleOf(world)));
        expect({ seed, result: result.ok ? "ok" : result.reason }).toEqual({ seed, result: "ok" });
      }
    },
    120_000
  );
});

describe("cells", () => {
  it("round-trips the generator's packed Float32Array", () => {
    const packed = new Float32Array([-179.5, 89.25, -4200.5, 0, 0, 0, 12.125, -33.75, 812]);
    const decoded = decodeCells(encodeCells(packed));
    expect(decoded.ok && decoded.cells).toEqual(packed);
  });
});

describe("worldGenParamsSchema", () => {
  it("accepts the defaults and refuses values the generator would choke on", () => {
    expect(worldGenParamsSchema.safeParse(DEFAULT_PARAMS).success).toBe(true);
    expect(worldGenParamsSchema.safeParse({ ...DEFAULT_PARAMS, cellCount: 150_001 }).success).toBe(
      false
    );
    expect(worldGenParamsSchema.safeParse({ ...DEFAULT_PARAMS, plateCount: 2 }).success).toBe(
      false
    );
    expect(
      worldGenParamsSchema.safeParse({ ...DEFAULT_PARAMS, developmentLevel: "stone-age" }).success
    ).toBe(false);
    expect(
      worldGenParamsSchema.safeParse({ ...DEFAULT_PARAMS, temperatureOffset: Infinity }).success
    ).toBe(false);
  });
});
