/**
 * UPG v2 — Export & Orchestrator Unit Tests
 */

import type { Geometry, Position } from "geojson";
import { generateWorld } from "~/lib/worldgen/v2/index";
import { DEFAULT_PARAMS, WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { sphericalRingAreaSqKm } from "~/lib/maps/planet";
import { pointInRing, polygonsOf, ringFault } from "~/tests/helpers/ring-geometry";

const TEST_SEED = 42;
const TEST_CELLS = 3000;

describe("v2/export & generateWorld", () => {
  const world = generateWorld({
    ...DEFAULT_PARAMS,
    seed: TEST_SEED,
    cellCount: TEST_CELLS,
    plateCount: 8,
  });

  it("returns a complete GeneratedWorld object with seed and params", () => {
    expect(world.seed).toBe(TEST_SEED);
    expect(world.params).toBeDefined();
    expect(world.stats).toBeDefined();
    expect(world.layers).toBeDefined();
    expect(world.graph).toBeDefined();
  });

  it("contains all 7 required GeoJSON layers", () => {
    const requiredLayers = [
      "background",
      "altitudes",
      "climate",
      "political",
      "rivers",
      "lakes",
      "icecaps",
    ];
    for (const layerKey of requiredLayers) {
      expect(world.layers[layerKey]).toBeDefined();
      expect(world.layers[layerKey]!.type).toBe("FeatureCollection");
      expect(Array.isArray(world.layers[layerKey]!.features)).toBe(true);
    }
  });

  it("political layer features have required renderer properties", () => {
    const political = world.layers.political!;
    expect(political.features.length).toBeGreaterThan(0);

    for (const feature of political.features) {
      const props = feature.properties!;
      expect(props._id).toBeDefined();
      expect(props._displayName).toBeDefined();
      expect(props._fillColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(props._areaSqKm).toBeGreaterThan(0);
      expect(typeof props._centroidLng).toBe("number");
      expect(typeof props._centroidLat).toBe("number");
    }
  });

  it("political features carry no continent name (only countries are named)", () => {
    for (const feature of world.layers.political!.features) {
      expect(feature.properties).not.toHaveProperty("continent");
    }
  });

  it("altitudes layer features have elevation zone properties", () => {
    const altitudes = world.layers.altitudes!;
    expect(altitudes.features.length).toBeGreaterThan(0);

    for (const feature of altitudes.features) {
      const props = feature.properties!;
      expect(props.zone).toMatch(/^zone_[0-8]$/);
      expect(props._fillColor).toBeDefined();
    }
  });

  it("rivers layer features are LineStrings with positive coordinates", () => {
    const rivers = world.layers.rivers!;
    expect(rivers.features.length).toBeGreaterThan(0);

    for (const feature of rivers.features) {
      expect(feature.geometry.type).toBe("LineString");
      const coords = (feature.geometry as import("geojson").LineString).coordinates;
      expect(coords.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("computes stats properly with non-negative numbers", () => {
    const stats = world.stats;
    expect(stats.landPercentage).toBeGreaterThan(0);
    expect(stats.countryCount).toBeGreaterThan(0);
    expect(stats.riverCount).toBeGreaterThan(0);
    expect(stats.generationTimeMs).toBeGreaterThan(0);
    expect(stats.cellCount).toBeGreaterThan(0);
  });

  it("progress callback is invoked in correct stage order", () => {
    const stagesSeen: string[] = [];
    generateWorld({ ...DEFAULT_PARAMS, seed: TEST_SEED + 1, cellCount: TEST_CELLS }, (stage) => {
      if (!stagesSeen.includes(stage)) stagesSeen.push(stage);
    });

    expect(stagesSeen).toEqual([
      "mesh",
      "tectonics",
      "terrain",
      "coastlines",
      "hydro-climate",
      "quality",
      "politics",
      "export",
    ]);
  });
});

/** Geodesic area (km²) of a Polygon or MultiPolygon: each outer ring less its holes. */
function geodesicAreaKm2(geometry: Geometry): number {
  return polygonsOf(geometry).reduce(
    (sum, [outer, ...holes]) =>
      sum +
      sphericalRingAreaSqKm(outer!) -
      holes.reduce((held, hole) => held + sphericalRingAreaSqKm(hole), 0),
    0
  );
}

/** Cells of each state, in cell order. */
function cellsByState(world: ReturnType<typeof generateWorld>): Map<number, number[]> {
  const { cells } = world.graph!;
  const byState = new Map<number, number[]>();
  for (let i = 0; i < cells.n; i++) {
    const state = cells.state[i]!;
    if (state !== 0) byState.set(state, [...(byState.get(state) ?? []), i]);
  }
  return byState;
}

describe("v2/export political areas", () => {
  const worlds = [
    generateWorld({ ...WORLD_PRESETS.eurth, seed: 7, cellCount: 8000 }),
    generateWorld({ ...WORLD_PRESETS.ixnay, seed: 4, cellCount: 8000 }),
  ];

  /**
   * Slots with some mass that keep clear of the poles (rings are cut at 85°, so the caps are not exported),
   * the antimeridian slots among them.
   */
  const measurable = (world: ReturnType<typeof generateWorld>) => {
    const { cells } = world.graph!;
    const byState = cellsByState(world);
    return world.slots.filter((slot) => {
      const own = byState.get(Number(slot.key.slice(5)))!;
      return own.length >= 10 && own.every((i) => Math.abs(cells.p[i * 2 + 1]!) < 75);
    });
  };

  it("covers the surface: the exported polygons measure as much as the slots claim", () => {
    for (const world of worlds) {
      const slots = measurable(world);
      expect(slots.length).toBeGreaterThan(10);
      for (const slot of slots) {
        const feature = world.layers.political!.features.find(
          (f) => f.properties?.slotKey === slot.key
        )!;
        const ratio = geodesicAreaKm2(feature.geometry) / slot.areaKm2;
        expect({ slot: slot.key, ok: ratio > 0.97 && ratio < 1.03 }).toEqual({
          slot: slot.key,
          ok: true,
        });
      }
    }
  });

  it("includes antimeridian slots among the ones it measures", () => {
    const world = worlds[1]!;
    const { cells } = world.graph!;
    const byState = cellsByState(world);
    const seam = measurable(world).filter((slot) => {
      const lngs = byState.get(Number(slot.key.slice(5)))!.map((i) => cells.p[i * 2]!);
      return lngs.some((x) => x < -170) && lngs.some((x) => x > 170);
    });
    expect(seam.length).toBeGreaterThan(2);
  });
});

describe("v2/export polygon validity", () => {
  const worlds = [
    generateWorld({ ...WORLD_PRESETS.eurth, seed: 7, cellCount: 8000 }),
    generateWorld({ ...WORLD_PRESETS.ixnay, seed: 4, cellCount: 8000 }),
  ];

  it("exports no ring that self-intersects, and every hole inside its shell, on every layer", () => {
    for (const world of worlds) {
      for (const [name, layer] of Object.entries(world.layers)) {
        if (name === "rivers") continue;
        for (const feature of layer.features) {
          expect({ name, id: feature.id, fault: ringFault(feature.geometry) }).toEqual({
            name,
            id: feature.id,
            fault: null,
          });
        }
      }
    }
  });

  it("splits an antimeridian slot into the pieces on each side, none a hole outside its shell", () => {
    const world = worlds[0]!;
    const { cells } = world.graph!;
    const seamSlots = [...cellsByState(world)].filter(([, own]) => {
      const lngs = own.map((i) => cells.p[i * 2]!);
      return lngs.some((x) => x < -170) && lngs.some((x) => x > 170);
    });
    expect(seamSlots.length).toBeGreaterThan(0);

    for (const [state] of seamSlots) {
      const feature = world.layers.political!.features.find((f) => f.id === state)!;
      const polygons = polygonsOf(feature.geometry);
      const reaches = (edge: number) =>
        polygons.some(([shell]) => shell!.some((p) => Math.abs(p[0]! - edge) < 0.05));
      expect(reaches(-180)).toBe(true);
      expect(reaches(180)).toBe(true);
      for (const [shell, ...holes] of polygons) {
        for (const hole of holes) {
          const [a, b] = hole;
          expect(pointInRing(shell!, (a![0]! + b![0]!) / 2, (a![1]! + b![1]!) / 2)).toBe(true);
        }
      }
    }
  });
});

type World = ReturnType<typeof generateWorld>;

/** Rounded to 1e-4 and perturbed by up to 0.006, the points along the antimeridian and the polar cut stay near them. */
const onMapEdge = (p: Position) => Math.abs(p[0]!) > 179.99 || Math.abs(p[1]!) > 84.97;

const edgeKey = (a: Position, b: Position) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;
const pointKey = (p: Position) => `${p[0]},${p[1]}`;

/** Every ring point of the features of a layer (one feature when `only` names it). */
function ringPoints(world: World, layer: string, only?: number): Position[] {
  const out: Position[] = [];
  for (const feature of world.layers[layer]!.features) {
    if (only !== undefined && feature.id !== only) continue;
    for (const polygon of polygonsOf(feature.geometry))
      for (const ring of polygon) out.push(...ring);
  }
  return out;
}

describe("v2/export shared borders", () => {
  const worlds = [
    generateWorld({ ...WORLD_PRESETS.eurth, seed: 7, cellCount: 8000 }),
    generateWorld({ ...WORLD_PRESETS.ixnay, seed: 4, cellCount: 8000 }),
  ];

  it("gives every edge of a political ring a reverse in a neighbouring ring, apart from coasts and map edges", () => {
    for (const world of worlds) {
      const owners = new Map<string, number>();
      const coast = new Set<string>();
      for (const [layer, edges] of [
        ["political", owners],
        ["background", coast],
      ] as const) {
        for (const feature of world.layers[layer]!.features) {
          for (const polygon of polygonsOf(feature.geometry)) {
            for (const ring of polygon) {
              for (let i = 0; i < ring.length - 1; i++) {
                const key = edgeKey(ring[i]!, ring[i + 1]!);
                if (edges instanceof Map) edges.set(key, Number(feature.id));
                else edges.add(key);
              }
            }
          }
        }
      }

      let shared = 0;
      const stray: string[] = [];
      for (const feature of world.layers.political!.features) {
        for (const polygon of polygonsOf(feature.geometry)) {
          for (const ring of polygon) {
            for (let i = 0; i < ring.length - 1; i++) {
              const [a, b] = [ring[i]!, ring[i + 1]!];
              const other = owners.get(edgeKey(b, a));
              if (other !== undefined && other !== feature.id) shared++;
              else if (!coast.has(edgeKey(a, b)) && !(onMapEdge(a) && onMapEdge(b))) {
                stray.push(`${feature.id}: ${edgeKey(a, b)}`);
              }
            }
          }
        }
      }
      expect(shared).toBeGreaterThan(5000);
      expect(stray).toEqual([]);
    }
  });

  it("draws a coast the same in every layer", () => {
    for (const world of worlds) {
      const inland = ringPoints(world, "background").filter((p) => !onMapEdge(p));
      expect(inland.length).toBeGreaterThan(2000);
      // The whole coast is a ring point of the political and climate layers and of the lowest altitude zone
      for (const layer of ["political", "climate"]) {
        const points = new Set(ringPoints(world, layer).map(pointKey));
        expect(inland.filter((p) => !points.has(pointKey(p)))).toEqual([]);
      }
      const lowland = new Set(ringPoints(world, "altitudes", 1).map(pointKey));
      expect(inland.filter((p) => !lowland.has(pointKey(p)))).toEqual([]);

      // A higher zone follows the coast where it has coast, and then to the point: none of its points lies within
      // 0.001 degrees of a coast point without being one
      const coast = new Map<string, Position[]>();
      const cell = (v: number) => Math.floor(v / 0.01);
      for (const p of inland) {
        const key = `${cell(p[0]!)},${cell(p[1]!)}`;
        coast.set(key, [...(coast.get(key) ?? []), p]);
      }
      const coastNear = (p: Position) => {
        const found: Position[] = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (const q of coast.get(`${cell(p[0]!) + dx},${cell(p[1]!) + dy}`) ?? []) {
              if (Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!) < 0.001) found.push(q);
            }
          }
        }
        return found;
      };
      const drifting: string[] = [];
      for (const zone of world.layers.altitudes!.features) {
        for (const p of ringPoints(world, "altitudes", zone.id as number)) {
          const near = coastNear(p);
          if (near.length > 0 && !near.some((q) => pointKey(q) === pointKey(p))) {
            drifting.push(`zone ${zone.id}: ${pointKey(p)}`);
          }
        }
      }
      expect(drifting).toEqual([]);
    }
  });
});
