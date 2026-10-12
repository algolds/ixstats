/**
 * UPG v2 — Export & Orchestrator Unit Tests
 */

import type { Geometry } from "geojson";
import { generateWorld } from "~/lib/worldgen/v2/index";
import { DEFAULT_PARAMS, WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { sphericalRingAreaSqKm } from "~/lib/maps/planet";

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
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  return polygons.reduce(
    (sum, [outer, ...holes]) =>
      sum +
      sphericalRingAreaSqKm(outer!) -
      holes.reduce((held, hole) => held + sphericalRingAreaSqKm(hole), 0),
    0
  );
}

describe("v2/export political areas", () => {
  const world = generateWorld({ ...WORLD_PRESETS.eurth, seed: 7, cellCount: 8000 });
  const { cells } = world.graph!;

  /** Slots away from the poles (the export clamps rings at 85°) and the antimeridian seam, with some mass. */
  const interior = world.slots.filter((slot) => {
    const own: number[] = [];
    for (let i = 0; i < cells.n; i++) if (cells.state[i] === Number(slot.key.slice(5))) own.push(i);
    return (
      own.length >= 6 &&
      own.every((i) => Math.abs(cells.p[i * 2 + 1]!) < 75 && Math.abs(cells.p[i * 2]!) < 170)
    );
  });

  it("covers the surface: the exported polygons measure as much as the slots claim", () => {
    expect(interior.length).toBeGreaterThan(20);
    for (const slot of interior) {
      const feature = world.layers.political!.features.find(
        (f) => f.properties?.slotKey === slot.key
      )!;
      const ratio = geodesicAreaKm2(feature.geometry) / slot.areaKm2;
      expect(ratio).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThan(1.06);
    }
  });
});
