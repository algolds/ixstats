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

  it("keeps the rings of neighbouring states on the same borders", () => {
    const world = worlds[1]!;
    const edge = (a: Position, b: Position) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;
    const owners = new Map<string, number>();
    const features = world.layers.political!.features;
    for (const feature of features) {
      for (const polygon of polygonsOf(feature.geometry)) {
        for (const ring of polygon) {
          for (let i = 0; i < ring.length - 1; i++) {
            owners.set(edge(ring[i]!, ring[i + 1]!), Number(feature.id));
          }
        }
      }
    }

    // Every pair of states whose cells touch shares a stretch of border that both rings run, in opposite directions
    const { cells } = world.graph!;
    const touching = new Set<string>();
    for (let i = 0; i < cells.n; i++) {
      for (const j of cells.neighbors[i]!) {
        const [a, b] = [cells.state[i]!, cells.state[j]!];
        if (a > 0 && b > a && Math.abs(cells.p[i * 2]! - cells.p[j * 2]!) < 180) {
          touching.add(`${a}|${b}`);
        }
      }
    }
    const sharing = new Set<string>();
    for (const feature of features) {
      for (const polygon of polygonsOf(feature.geometry)) {
        for (const ring of polygon) {
          for (let i = 0; i < ring.length - 1; i++) {
            const other = owners.get(edge(ring[i + 1]!, ring[i]!));
            if (other !== undefined && other !== feature.id) {
              sharing.add(
                `${Math.min(Number(feature.id), other)}|${Math.max(Number(feature.id), other)}`
              );
            }
          }
        }
      }
    }
    expect(touching.size).toBeGreaterThan(20);
    const apart = [...touching].filter((pair) => !sharing.has(pair));
    // Corner contacts apart, which share no stretch of border
    expect(apart.length).toBeLessThan(touching.size * 0.03);
  });
});
