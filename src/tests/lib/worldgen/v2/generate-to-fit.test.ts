/**
 * UPG v2 — generate to fit: land mask, kept borders, cached mesh, nation slots and packed cells.
 */

import type { Feature, FeatureCollection, Geometry } from "geojson";
import { generateWorld } from "~/lib/worldgen/v2/index";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { cellAreaKm2, createMesh, MeshCache } from "~/lib/worldgen/v2/mesh";
import { rasterizeLandMask, sampleLandMask, type LandMask } from "~/lib/worldgen/land-mask";
import { polygonsOf, ringFault } from "~/tests/helpers/ring-geometry";

const PARAMS = { ...DEFAULT_PARAMS, seed: 7, cellCount: 12000 };

const rect = (west: number, south: number, east: number, north: number, props = {}): Feature => ({
  type: "Feature",
  properties: props,
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  } as Geometry,
});
const layer = (...features: Feature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

/** Two continents roughly the size of Eurasia and the Americas' mid-latitudes. */
const CONTINENTS = layer(rect(-120, -30, -40, 50), rect(10, -35, 120, 55));

/** Land share of the mask weighted by the area each pixel covers on the globe. */
function areaWeightedShare(mask: LandMask): number {
  let land = 0;
  let total = 0;
  for (let y = 0; y < mask.height; y++) {
    const lat = 90 - ((y + 0.5) / mask.height) * 180;
    const w = Math.cos((lat * Math.PI) / 180);
    for (let x = 0; x < mask.width; x++) {
      total += w;
      if (mask.land[y * mask.width + x]) land += w;
    }
  }
  return land / total;
}

describe("v2 generate to fit: land mask", () => {
  const mask = rasterizeLandMask({ background: CONTINENTS }, 720);
  const world = generateWorld(PARAMS, undefined, { landMask: mask });
  const { cells } = world.graph!;

  it("puts land exactly where the mask has land", () => {
    let landCells = 0;
    for (let i = 0; i < cells.n; i++) {
      const inMask = sampleLandMask(mask, cells.p[i * 2]!, cells.p[i * 2 + 1]!).land;
      expect(cells.isLand[i] === 1).toBe(inMask);
      if (inMask) landCells++;
    }
    expect(landCells).toBeGreaterThan(cells.n * 0.1);
  });

  it("matches the mask's land share within 1%", () => {
    let land = 0;
    let total = 0;
    for (let i = 0; i < cells.n; i++) {
      const area = cellAreaKm2(world.graph!, i);
      total += area;
      if (cells.isLand[i]) land += area;
    }
    expect(Math.abs(land / total - areaWeightedShare(mask))).toBeLessThan(0.01);
  });
  it("survives a mask with no land at all", () => {
    const empty: LandMask = { width: 64, height: 32, land: new Uint8Array(64 * 32) };
    const w = generateWorld({ ...PARAMS, cellCount: 3000 }, undefined, { landMask: empty });
    expect(w.graph!.cells.isLand.reduce((a, b) => a + b, 0)).toBe(0);
    expect(w.slots).toEqual([]);
  });
});

describe("v2 generate to fit: polygon validity", () => {
  // Land across the antimeridian (a block on each side of it) and over the south pole, as well as the continents
  const seamAndPole = layer(
    rect(-120, -30, -40, 50),
    rect(10, -35, 120, 55),
    rect(168, -25, 180, 25),
    rect(-180, -25, -165, 25),
    rect(-70, -90, 70, -72)
  );
  const mask = rasterizeLandMask({ background: seamAndPole }, 720);

  it.each([
    ["generated countries", {}],
    ["kept borders", { keepBorders: true }],
  ])("exports sound rings on every layer with %s", (_label, options) => {
    const world = generateWorld({ ...PARAMS, cellCount: 8000 }, undefined, {
      landMask: mask,
      ...options,
    });
    let reachedSeam = false;
    for (const [name, collection] of Object.entries(world.layers)) {
      if (name === "rivers") continue;
      for (const feature of collection.features) {
        expect({ name, id: feature.id, fault: ringFault(feature.geometry) }).toEqual({
          name,
          id: feature.id,
          fault: null,
        });
        if (name === "background") {
          reachedSeam ||= polygonsOf(feature.geometry).some(([shell]) =>
            shell!.some((p) => Math.abs(p[0]!) > 179.99)
          );
        }
      }
    }
    // The mask puts land on the seam, so the test does cover the pieces cut there
    expect(reachedSeam).toBe(true);
  });
});

describe("v2 generate to fit: kept borders", () => {
  const world = generateWorld({ ...PARAMS, cellCount: 5000 }, undefined, { keepBorders: true });

  it("skips politics and omits the political layer", () => {
    expect("political" in world.layers).toBe(false);
    expect(world.graph!.states).toHaveLength(0);
    expect(world.slots).toEqual([]);
    expect(world.stats.countryCount).toBe(0);
  });
});

describe("v2 MeshCache", () => {
  it("generates the same world as an uncached run, then again on a hit", () => {
    const cache = new MeshCache();
    const params = { ...PARAMS, cellCount: 3000 };
    const plain = generateWorld(params);
    const miss = generateWorld(params, undefined, { meshCache: cache });
    const hit = generateWorld(params, undefined, { meshCache: cache });
    expect(JSON.stringify(miss.layers)).toBe(JSON.stringify(plain.layers));
    expect(JSON.stringify(hit.layers)).toBe(JSON.stringify(plain.layers));
    expect(hit.graph!.cells.vertices).toBe(miss.graph!.cells.vertices);
  });

  it("leaves the cached geometry untouched by the generation stages", () => {
    const cache = new MeshCache();
    const params = { ...PARAMS, cellCount: 3000 };
    const first = generateWorld(params, undefined, { meshCache: cache });
    generateWorld({ ...params, oceanPercentage: 0.6 }, undefined, { meshCache: cache });
    const fresh = createMesh(params.seed, params.cellCount, params.lloydIterations);
    expect(Array.from(first.graph!.cells.p)).toEqual(Array.from(fresh.cells.p));
    expect(first.graph!.cells.neighbors).toEqual(fresh.cells.neighbors);
    expect(first.graph!.cells.vertices).toEqual(fresh.cells.vertices);
    expect(Array.from(first.graph!.cells.boundary)).toEqual(Array.from(fresh.cells.boundary));
  });
});

describe("v2 nation slots", () => {
  const world = generateWorld({ ...PARAMS, cellCount: 8000 });
  it("carries a derived baseline inside the development band", () => {
    for (const slot of world.slots) {
      expect(Number.isInteger(slot.population)).toBe(true);
      expect(slot.population).toBeGreaterThanOrEqual(0);
      expect(slot.gdpPerCapita).toBeGreaterThanOrEqual(20000 * 0.75);
      expect(slot.gdpPerCapita).toBeLessThanOrEqual(20000 * 1.25);
    }
    const total = world.slots.reduce((a, s) => a + s.population, 0);
    expect(total).toBeGreaterThan(0);
    expect(new Set(world.slots.map((s) => s.gdpPerCapita)).size).toBeGreaterThan(3);
  });
});
