/** @jest-environment node */
/**
 * Fitting a world to a realm's existing map, on maps with what the realms' own have: land across the antimeridian
 * (drawn whole, and cut in two at 180), a continent round the south pole (drawn to the pole, and winding once round it),
 * an inland sea (a hole), nations sharing a border, altitude bands in each encoding the realms use, and climate in both
 * encodings. One test per behaviour of the pipeline: the land mask, drawing on the raster, the Calibration measures, the
 * fitted world, and the relief made from its cells and bands.
 *
 * Folds: src/tests/lib/worldgen/land-mask.test.ts, src/tests/lib/worldgen/raster-draw.test.ts,
 * src/tests/lib/worldgen/measure-world.test.ts, src/tests/lib/worldgen/relief.test.ts,
 * src/tests/lib/worldgen/v2/generate-to-fit.test.ts
 */
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { ClimateKey } from "~/lib/maps/realm-map-settings";
import { rasterizeLandMask, sampleLandMask, type LandMask } from "~/lib/worldgen/land-mask";
import { measureWorld } from "~/lib/worldgen/measure-world";
import { drawSegment, fillRing, newRaster } from "~/lib/worldgen/raster-draw";
import {
  addDetail,
  heightsFromBands,
  heightsFromCells,
  hillshade,
  type HeightGrid,
} from "~/lib/worldgen/relief";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { makeRng } from "~/lib/worldgen/v2/helpers/rng";
import { generateWorld, type GenerateOptions } from "~/lib/worldgen/v2/index";
import { cellAreaKm2 } from "~/lib/worldgen/v2/mesh";
import { polygonsOf, ringFault } from "~/tests/helpers/ring-geometry";

/** A ring of [lng, lat] points, as a polygon and the raster's fill both take one. */
type Ring = Array<[number, number]>;

const box = (west: number, south: number, east: number, north: number): Ring => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];
const polygon = (...rings: Ring[]): Geometry => ({ type: "Polygon", coordinates: rings });
const feature = (geometry: Geometry, properties: GeoJsonProperties = {}): Feature => ({
  type: "Feature",
  geometry,
  properties,
});
const layer = (...features: Feature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

/** 170E to 170W across the antimeridian, drawn the short way: a 20 by 10 degree strip. */
const ACROSS_THE_SEAM: Ring = [
  [170, -5],
  [-170, -5],
  [-170, 5],
  [170, 5],
  [170, -5],
];
/** The 70S parallel, west to east. */
const PARALLEL_70S: Ring = Array.from({ length: 13 }, (_, i): [number, number] => [
  -180 + i * 30,
  -70,
]);
/** A south-polar continent drawn down to the pole, as most realm maps draw one. */
const POLE_FRAMED: Ring = [...PARALLEL_70S, [180, -90], [-180, -90], [-180, -70]];
/** The same continent as a ring that winds once round the pole, from the prime meridian back to it. */
const POLE_WINDING: Ring = [...PARALLEL_70S.slice(6), ...PARALLEL_70S.slice(1, 6), [0, -70]];

/** Share of the globe a lng/lat box covers (a sphere's area is proportional to the sine of latitude). */
const globeShare = (lngSpan: number, southLat: number, northLat: number): number =>
  (lngSpan / 360) *
  ((Math.sin((northLat * Math.PI) / 180) - Math.sin((southLat * Math.PI) / 180)) / 2);

describe("the land mask", () => {
  /** A realm's map at 1 degree a pixel: a continent across the seam round an inland sea, a polar cap, a mainland. */
  const mask = rasterizeLandMask(
    {
      background: layer(
        // 160E to 160W, 20S to 20N, round a sea from 175E to 175W
        feature(
          polygon(
            [
              [160, -20],
              [-160, -20],
              [-160, 20],
              [160, 20],
              [160, -20],
            ],
            [
              [175, -5],
              [-175, -5],
              [-175, 5],
              [175, 5],
              [175, -5],
            ]
          )
        ),
        feature(polygon(POLE_WINDING)),
        feature({
          type: "MultiPolygon",
          coordinates: [[box(0, 25, 60, 60)], [box(-80, 30, -70, 40)]],
        })
      ),
      // A nation drawn only on the political layer is land too
      political: layer(feature(polygon(box(-60, -60, -50, -50)))),
      // Bands over the sea are not land
      altitudes: layer(feature(polygon(box(100, 30, 110, 40)), { zone: "zone_2" })),
    },
    360
  );

  it("rasterises the realm's land across the seam and round the pole, its holes kept, the political layer joined and altitude bands left out", () => {
    // The seam continent, counted on its own rows and columns: 40 by 40 degrees less the 10 by 10 sea
    let seam = 0;
    for (let y = 70; y < 110; y++)
      for (const x of [...Array(20).keys(), ...Array.from({ length: 20 }, (_, i) => 340 + i)])
        seam += mask.land[y * 360 + x]!;
    expect(seam).toBe(40 * 40 - 10 * 10);
    const land = (lng: number, lat: number) => sampleLandMask(mask, lng, lat).land;
    expect([land(165, 0), land(179.5, 15), land(-179.5, -15), land(-165, 10)]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    // The inland sea on the seam, and the ocean the continent does not cross the long way
    expect([land(179.5, 0), land(-179.5, 0), land(0, 0), land(100, 0), land(-100, 0)]).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    // The polar cap reaches the pole at every longitude and stops at its edge
    expect([-170, -90, 0, 90, 170].map((lng) => [land(lng, -85), land(lng, -50)])).toEqual(
      Array(5).fill([true, false])
    );
    expect(land(0, 80)).toBe(false);
    // Both parts of the mainland, the political-only nation, not the band over the sea
    expect([land(30, 40), land(-75, 35), land(-55, -55), land(105, 35)]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("gives each pixel the highest altitude band over it, in every encoding the realms use", () => {
    const banded = rasterizeLandMask(
      {
        background: layer(feature(polygon(box(0, 0, 60, 60)))),
        altitudes: layer(
          feature(polygon(box(0, 0, 60, 60)), { "ixmap-subgroup": "coastlines" }),
          feature(polygon(box(0, 0, 40, 60)), { zone: "zone_1" }),
          feature(polygon(box(0, 0, 20, 60)), { "ixmap-subgroup": "Altitude-4" }),
          feature(polygon(box(0, 0, 10, 60)), { fill: "#9c7b50" })
        ),
      },
      360
    );
    expect([5, 15, 30, 50, 100].map((lng) => sampleLandMask(banded, lng, 30))).toEqual([
      { land: true, zone: 6 },
      { land: true, zone: 4 },
      { land: true, zone: 1 },
      { land: true, zone: 0 },
      { land: false, zone: 0 },
    ]);
  });
});

describe("drawing on the raster", () => {
  const alphaAt = (data: Uint8ClampedArray, width: number, x: number, y: number) =>
    data[(y * width + x) * 4 + 3]!;

  it("draws a ring and a line across the seam on both sides of it, and a pixel two neighbouring rings share once", () => {
    const seam = newRaster(360);
    fillRing(seam, box(178, 10, -178, 20), [0, 255, 0, 255]);
    drawSegment(seam, [358, 50], [2, 50], [255, 0, 0, 255]);
    expect([359, 0, 180].map((x) => alphaAt(seam.data, 360, x, 75))).toEqual([255, 255, 0]);
    expect([358, 359, 0, 1, 2, 180].map((x) => alphaAt(seam.data, 360, x, 50))).toEqual([
      255, 255, 255, 255, 255, 0,
    ]);

    // Two nations either side of a border at a fractional longitude, half-opaque: twice painted would be 3/4 opaque
    const shared = newRaster(360);
    fillRing(shared, box(-60, 0, -49.7, 10), [255, 0, 0, 128]);
    fillRing(shared, box(-49.7, 0, -39.4, 10), [255, 0, 0, 128]);
    const row = Array.from({ length: 21 }, (_, i) => alphaAt(shared.data, 360, 120 + i, 85));
    expect(row.filter((alpha) => alpha === 0)).toEqual([]);
    expect(new Set(row.slice(1, -1)).size).toBe(1);
  });
});

describe("the Calibration measures", () => {
  /** Km in one degree of a great circle on Earth. */
  const DEG_KM = (2 * Math.PI * 6371) / 360;

  it.each([
    {
      shape: "a nation across the antimeridian",
      drawn: [feature(polygon(ACROSS_THE_SEAM))],
      redrawn: [feature(polygon(box(170, -5, 180, 5))), feature(polygon(box(-180, -5, -170, 5)))],
      share: globeShare(20, -5, 5),
      coastKm: (2 * 20 + 2 * 10) * DEG_KM,
    },
    {
      shape: "a continent round the south pole",
      drawn: [feature(polygon(POLE_FRAMED))],
      redrawn: [feature(polygon(POLE_WINDING))],
      share: (1 - Math.sin((70 * Math.PI) / 180)) / 2,
      coastKm: 360 * DEG_KM * Math.cos((70 * Math.PI) / 180),
    },
    {
      shape: "two nations sharing a border",
      drawn: [feature(polygon(box(0, 0, 10, 10))), feature(polygon(box(10, 0, 20, 10)))],
      redrawn: [feature(polygon(box(0, 0, 20, 10)))],
      share: globeShare(20, 0, 10),
      coastKm: (2 * 20 + 2 * 10) * DEG_KM,
    },
  ])(
    "measures $shape by its area and its coast alone, however it is drawn: the seam, the pole and a shared border are no coast",
    ({ drawn, redrawn, share, coastKm }) => {
      for (const features of [drawn, redrawn]) {
        const measures = measureWorld({ political: layer(...features) });
        expect(measures.landShare).toBeCloseTo(share, 3);
        // Great-circle edges run a little shorter than the parallels they span
        expect(Math.abs(measures.coastlineKm / coastKm - 1)).toBeLessThan(0.02);
      }
    }
  );

  it("groups climate alike in both encodings: Trewartha codes, and Koppen codes, ids or colours through the realm's key", () => {
    const halves = (west: GeoJsonProperties, east: GeoJsonProperties, climateKey?: ClimateKey) =>
      measureWorld(
        {
          political: layer(feature(polygon(box(0, 0, 40, 40)))),
          climate: layer(
            feature(polygon(box(0, 0, 20, 40)), west),
            feature(polygon(box(20, 0, 40, 40)), east)
          ),
        },
        { climateKey }
      ).climate;
    const climateKey: ClimateKey = {
      system: "Koppen",
      zones: [
        { code: "Cfb", name: "Oceanic", color: "#00ff00" },
        { code: "BWh", name: "Hot desert", color: "#ff0000" },
      ],
    };
    const trewartha = halves({ code: "Do" }, { code: "Bw" });
    expect([trewartha.D, trewartha.B]).toEqual([expect.closeTo(0.5, 10), expect.closeTo(0.5, 10)]);
    expect(halves({ code: "Cfb" }, { code: "BWh" })).toEqual(trewartha);
    expect(halves({ climateId: "Cfb" }, { climateId: "BWh" }, climateKey)).toEqual(trewartha);
    expect(halves({ fill: "#00FF00" }, { fill: "#ff0000" }, climateKey)).toEqual(trewartha);
  });
});

describe("the fitted world", () => {
  const rect = (west: number, south: number, east: number, north: number) =>
    feature(polygon(box(west, south, east, north)));
  /** Two continents, land either side of the antimeridian and a south-polar cap, at the mask width the worker uses. */
  const realm = rasterizeLandMask(
    {
      background: layer(
        rect(-120, -30, -40, 50),
        rect(10, -35, 120, 55),
        rect(168, -25, 180, 25),
        rect(-180, -25, -165, 25),
        rect(-70, -90, 70, -72)
      ),
    },
    720
  );
  const blank: LandMask = { width: 64, height: 32, land: new Uint8Array(64 * 32) };

  /** Land share of the mask weighted by the area each pixel covers on the globe. */
  function areaWeightedShare(mask: LandMask): number {
    let land = 0;
    let total = 0;
    for (let y = 0; y < mask.height; y++) {
      const w = Math.cos(((90 - ((y + 0.5) / mask.height) * 180) * Math.PI) / 180);
      for (let x = 0; x < mask.width; x++) {
        total += w;
        if (mask.land[y * mask.width + x]) land += w;
      }
    }
    return land / total;
  }

  it.each<{ fit: string; options: GenerateOptions; nations: boolean; seam: boolean }>([
    {
      fit: "keeping the realm's borders",
      options: { landMask: realm, keepBorders: true },
      nations: false,
      seam: true,
    },
    {
      fit: "with nations generated under it",
      options: { landMask: realm },
      nations: true,
      seam: true,
    },
    {
      fit: "for a realm with no land drawn yet",
      options: { landMask: blank },
      nations: false,
      seam: false,
    },
  ])(
    "fits a world to the realm's map $fit: land exactly where the map has it, as much of it, and sound rings",
    ({ options, nations, seam }) => {
      const mask = options.landMask!;
      const world = generateWorld(
        { ...DEFAULT_PARAMS, seed: 7, cellCount: 8000 },
        undefined,
        options
      );
      const graph = world.graph!;
      const { cells } = graph;
      const misplaced: number[] = [];
      let land = 0;
      let total = 0;
      for (let i = 0; i < cells.n; i++) {
        if (
          (cells.isLand[i] === 1) !==
          sampleLandMask(mask, cells.p[i * 2]!, cells.p[i * 2 + 1]!).land
        )
          misplaced.push(i);
        const area = cellAreaKm2(graph, i);
        total += area;
        if (cells.isLand[i]) land += area;
      }
      expect(misplaced).toEqual([]);
      expect(Math.abs(land / total - areaWeightedShare(mask))).toBeLessThan(0.01);

      let reachedSeam = false;
      for (const [name, collection] of Object.entries(world.layers)) {
        if (name === "rivers") continue;
        for (const { id, geometry } of collection.features) {
          expect({ name, id, fault: ringFault(geometry) }).toEqual({ name, id, fault: null });
          if (name === "background")
            reachedSeam ||= polygonsOf(geometry).some(([shell]) =>
              shell!.some((p) => Math.abs(p[0]!) > 179.99)
            );
        }
      }
      expect(reachedSeam).toBe(seam);
      // The realm's borders kept: no political layer, no countries and no slots to claim
      expect("political" in world.layers).toBe(!options.keepBorders);
      expect([graph.states.length > 0, world.slots.length > 0]).toEqual([nations, nations]);
    }
  );
});

describe("the relief", () => {
  /** Equal-area-ish jittered lattice packed as [lng, lat, h, ...]; `rows` rows pole to pole. */
  function latticeCells(
    rows: number,
    heightAt: (lng: number, lat: number) => number
  ): Float32Array {
    const rng = makeRng(1);
    const out: number[] = [];
    for (let j = 0; j < rows; j++) {
      const lat = -90 + ((j + 0.5) * 180) / rows;
      const count = Math.max(4, Math.round(2 * rows * Math.cos((lat * Math.PI) / 180)));
      for (let i = 0; i < count; i++) {
        const lng = -180 + ((i + 0.5 + (rng() - 0.5) * 0.3) * 360) / count;
        const la = lat + ((rng() - 0.5) * 0.3 * 180) / rows;
        out.push(lng, la, heightAt(lng, la));
      }
    }
    return Float32Array.from(out);
  }
  const grid = (width: number, fill: (x: number, y: number) => number): HeightGrid => {
    const height = width >> 1;
    const metres = new Float32Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) metres[y * width + x] = fill(x, y);
    return { width, height, metres };
  };

  it("builds heights from the cells without a gap or a streak at the seam, reaching a pole only from a site within a degree of it", () => {
    // Land on both sides of the antimeridian between 40S and 40N, open sea between 150W and 150E
    const seam = heightsFromCells(
      latticeCells(36, (lng, lat) => (Math.abs(lng) > 150 && Math.abs(lat) < 40 ? 1000 : 0)),
      1024
    );
    const edges: number[] = [];
    let streak = 0;
    for (let y = 0; y < 512; y++) {
      const lat = 90 - ((y + 0.5) * 180) / 512;
      if (Math.abs(lat) <= 25) edges.push(seam.metres[y * 1024]!, seam.metres[y * 1024 + 1023]!);
      for (let x = Math.round((80 / 360) * 1024); x < Math.round((280 / 360) * 1024); x++)
        streak = Math.max(streak, seam.metres[y * 1024 + x]!);
    }
    expect(edges.filter((metres) => metres <= 900)).toEqual([]);
    expect(streak).toBe(0);

    // Land from 60S to 60N: the poles stay flat until sites within a degree of them are added
    const short: number[] = [];
    for (let lat = -60; lat <= 60; lat += 10)
      for (let lng = -175; lng <= 175; lng += 10) short.push(lng, lat, 400);
    const flat = heightsFromCells(Float32Array.from(short), 256);
    expect([flat.metres[128]!, flat.metres[127 * 256 + 128]!]).toEqual([0, 0]);
    const polar = [...short, -120, 89.8, 700, 0, 89.8, 700, 120, 89.8, 700];
    polar.push(-120, -89.8, 900, 0, -89.8, 900, 120, -89.8, 900);
    const reached = heightsFromCells(Float32Array.from(polar), 256);
    expect(reached.metres[128]!).toBeGreaterThan(650);
    expect(reached.metres[127 * 256 + 128]!).toBeGreaterThan(850);
  });

  it("keeps the heights of each altitude band within its floor and ceiling, measuring distance across the seam", () => {
    const zones = [
      { min: 0, max: 99 },
      { min: 100, max: 349 },
      { min: 350, max: 499 },
      { min: 500, max: 999 },
    ];
    // Concentric discs, band 1 outermost to 4 innermost, sea around them
    const width = 256;
    const height = 128;
    const discs = new Uint8Array(width * height);
    const radii = [60, 42, 26, 12];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const r = Math.hypot(x - 128, y - height / 2);
        for (let k = 0; k < radii.length; k++) if (r <= radii[k]!) discs[y * width + x] = k + 1;
      }
    const { metres } = heightsFromBands(discs, width, 128, zones);
    const outside = Array.from(discs.keys()).filter((i) => {
      const band = discs[i]!;
      const [lo, hi] = band === 0 ? [0, 0] : [zones[band - 1]!.min, zones[band - 1]!.max];
      return metres[i]! < lo || metres[i]! > hi;
    });
    expect(outside).toEqual([]);

    // A higher block just west of the seam: the pixel just east of it is as close to the block, through the wrap, as
    // the pixel just west of the block
    const strip = new Uint8Array(256 * 64).fill(1);
    strip.fill(0, 0, 256 * 8);
    strip.fill(0, 256 * 56);
    for (let y = 28; y < 36; y++) for (let x = 250; x < 256; x++) strip[y * 256 + x] = 2;
    const wrapped = heightsFromBands(strip, 256, 64, zones.slice(0, 2)).metres;
    const row = 32 * 256;
    expect(Math.abs(wrapped[row + 1]! - wrapped[row + 248]!)).toBeLessThan(2);
    expect(wrapped[row + 1]!).toBeGreaterThan(wrapped[row + 30]!);
  });

  it("adds the same detail every time, tiling across the seam above sea level, and shades a hill on the seam like one in the middle", () => {
    const detailed = () => {
      const g = grid(2048, () => 30);
      addDetail(g, 1);
      return g.metres;
    };
    const a = detailed();
    expect(Buffer.from(a.buffer).equals(Buffer.from(detailed().buffer))).toBe(true);
    expect(a.every((v) => v > 0)).toBe(true);
    expect(a.filter((v) => v !== 30).length).toBeGreaterThan(a.length / 2);
    // The texture repeats every eighth of the width, so its last column runs on into its first
    const row = 400 * 2048;
    const repeats = Array.from({ length: 48 }, (_, k) => k * 37).filter(
      (x) => Math.abs(a[row + x + 256]! - a[row + x]!) >= 5e-4
    );
    expect(repeats).toEqual([]);

    // A cone 12 pixels across, on the seam and in the middle of the map: the same shading, shifted
    const cone = (centre: number) =>
      grid(2048, (x, y) => {
        const dx = Math.min(Math.abs(x - centre), 2048 - Math.abs(x - centre));
        return Math.max(0, (12 - Math.hypot(dx, y - 512)) * 200);
      });
    const centred = hillshade(cone(1024));
    const seamed = hillshade(cone(0));
    let mismatches = 0;
    for (let y = 480; y < 544; y++)
      for (let x = 0; x < 2048; x++)
        for (let k = 0; k < 4; k++)
          if (centred[(y * 2048 + ((x + 1024) % 2048)) * 4 + k] !== seamed[(y * 2048 + x) * 4 + k])
            mismatches++;
    expect(mismatches).toBe(0);
    expect(seamed[(512 * 2048 + 5) * 4 + 3]!).toBeGreaterThan(0);
  });
});
