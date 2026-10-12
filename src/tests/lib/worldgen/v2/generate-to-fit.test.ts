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

  it("keeps hypsometry, rivers, climate and the political layer downstream", () => {
    expect(world.layers.altitudes!.features.length).toBeGreaterThan(3);
    expect(world.layers.rivers!.features.length).toBeGreaterThan(0);
    expect(world.layers.climate!.features.length).toBeGreaterThan(2);
    expect(world.layers.political!.features.length).toBeGreaterThan(5);
    const heights = Array.from(cells.h).filter((h, i) => cells.isLand[i] && h >= 0);
    expect(Math.max(...heights)).toBeGreaterThan(1000);
  });

  it("draws the background from the mask's coastline", () => {
    const bg = world.layers.background!.features;
    expect(bg.length).toBeGreaterThanOrEqual(2);
    expect(bg.length).toBeLessThan(40);
  });

  it("biases the relief toward the mask's altitude bands", () => {
    const bands = layer(
      rect(-120, -30, -40, 50, { zone: "zone_0" }),
      rect(10, -35, 120, 55, { zone: "zone_0" }),
      rect(60, -35, 120, 55, { zone: "zone_6" })
    );
    const guided = rasterizeLandMask({ background: CONTINENTS, altitudes: bands }, 720);
    const g = generateWorld(PARAMS, undefined, { landMask: guided }).graph!.cells;
    let high = 0;
    let highN = 0;
    let low = 0;
    let lowN = 0;
    for (let i = 0; i < g.n; i++) {
      if (!g.isLand[i]) continue;
      const lng = g.p[i * 2]!;
      if (lng >= 60 && lng <= 120) {
        high += g.h[i]!;
        highN++;
      } else if (lng >= 10 && lng < 60) {
        low += g.h[i]!;
        lowN++;
      }
    }
    expect(highN).toBeGreaterThan(50);
    expect(lowN).toBeGreaterThan(50);
    expect(high / highN).toBeGreaterThan((low / lowN) * 1.5);
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

  it("still exports the physical layers", () => {
    for (const key of ["background", "altitudes", "climate", "rivers", "lakes", "icecaps"]) {
      expect(world.layers[key]).toBeDefined();
    }
  });
});

describe("v2 MeshCache", () => {
  it("builds a mesh once per (seed, cellCount, lloydIterations) and shares its geometry", () => {
    const build = jest.fn(createMesh);
    const cache = new MeshCache(build);
    const a = cache.get(3, 2000, 2);
    const b = cache.get(3, 2000, 2);
    expect(build).toHaveBeenCalledTimes(1);
    expect(b.cells.vertices).toBe(a.cells.vertices);
    expect(b.cells.neighbors).toBe(a.cells.neighbors);
    expect(b.cells.p).toBe(a.cells.p);
    expect(b.cells.boundary).toBe(a.cells.boundary);
    // Attribute arrays are the caller's own
    expect(b.cells.h).not.toBe(a.cells.h);
    expect(b.cells.isLand).not.toBe(a.cells.isLand);
    expect(b.cells.h.every((v) => v === 0)).toBe(true);
  });

  it("misses on a different seed, cell count or relaxation, and keeps two entries", () => {
    const build = jest.fn(createMesh);
    const cache = new MeshCache(build);
    cache.get(1, 1500, 1);
    cache.get(2, 1500, 1);
    cache.get(1, 1500, 1);
    cache.get(2, 1500, 1);
    expect(build).toHaveBeenCalledTimes(2);
    cache.get(1, 1600, 1);
    cache.get(1, 1500, 2);
    expect(build).toHaveBeenCalledTimes(4);
    // Capacity is two: the oldest entries were evicted
    cache.get(1, 1500, 1);
    expect(build).toHaveBeenCalledTimes(5);
  });

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
  const { states } = world.graph!;

  it("has one slot per generated state, with its name, colour, cells and area", () => {
    expect(states.length).toBeGreaterThan(5);
    expect(world.slots).toHaveLength(states.length);
    world.slots.forEach((slot, i) => {
      const state = states[i]!;
      expect(slot.key).toBe(`slot_${state.id}`);
      expect(slot.name).toBe(state.name);
      expect(slot.colour).toBe(state.color);
      expect(slot.cells).toBe(state.cellCount);
      expect(slot.areaKm2).toBe(state.areaKm2);
    });
    expect(new Set(world.slots.map((s) => s.key)).size).toBe(world.slots.length);
  });

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

  it("scales the GDP base with params.developmentLevel", () => {
    const mean = (w: typeof world) =>
      w.slots.reduce((a, s) => a + s.gdpPerCapita, 0) / Math.max(1, w.slots.length);
    const developing = generateWorld({
      ...PARAMS,
      cellCount: 3000,
      developmentLevel: "developing",
    });
    const modern = generateWorld({ ...PARAMS, cellCount: 3000, developmentLevel: "modern" });
    expect(mean(developing)).toBeLessThan(6000 * 1.25 + 1);
    expect(mean(modern)).toBeGreaterThan(45000 * 0.75 - 1);
  });

  it("links each political feature to its slot", () => {
    const keys = new Set(world.slots.map((s) => s.key));
    const features = world.layers.political!.features;
    expect(features.length).toBeGreaterThan(0);
    for (const f of features) {
      expect(keys.has(f.properties!.slotKey as string)).toBe(true);
    }
  });
});

describe("v2 GeneratedWorld output", () => {
  const world = generateWorld({ ...PARAMS, cellCount: 3000 });

  it("packs lng, lat and height per cell into a Float32Array", () => {
    const { cells } = world.graph!;
    expect(world.cells).toBeInstanceOf(Float32Array);
    expect(world.cells).toHaveLength(cells.n * 3);
    for (const i of [0, 1, cells.n >> 1, cells.n - 1]) {
      expect(world.cells[i * 3]).toBeCloseTo(cells.p[i * 2]!, 3);
      expect(world.cells[i * 3 + 1]).toBeCloseTo(cells.p[i * 2 + 1]!, 3);
      expect(world.cells[i * 3 + 2]).toBe(cells.h[i]);
    }
  });

  it("names no continent, river or lake", () => {
    for (const key of ["background", "rivers", "lakes"]) {
      for (const f of world.layers[key]!.features) {
        expect(f.properties).not.toHaveProperty("name");
      }
    }
  });
});
