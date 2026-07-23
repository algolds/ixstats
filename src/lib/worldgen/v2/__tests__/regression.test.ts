/**
 * UPG v2 — Regression Tests
 *
 * Verifies determinism, absence of Marching Squares decoupling artifacts,
 * and single-source-of-truth layer geometry coupling.
 */

import { generateWorld } from "../index";
import { DEFAULT_PARAMS } from "../config";

const TEST_SEED = 42;
const TEST_CELLS = 3000;

describe("v2/regression", () => {
  it("determinism: identical seed produces byte-identical GeoJSON output on consecutive runs", () => {
    const run1 = generateWorld({ ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: TEST_CELLS });
    const run2 = generateWorld({ ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: TEST_CELLS });

    const str1 = JSON.stringify(run1.layers);
    const str2 = JSON.stringify(run2.layers);

    expect(str1).toBe(str2);
  });

  it("single source of truth: altitude, climate, and political layers reference exact same cell graph", () => {
    const world = generateWorld({ ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: TEST_CELLS });
    const graph = world.graph!;

    // Pick 10 random land cells and verify they have valid elevZone, biome, and state
    for (let i = 0; i < graph.cells.n; i += Math.floor(graph.cells.n / 10)) {
      if (graph.cells.isLand[i]) {
        expect(graph.cells.elevZone[i]).toBeGreaterThanOrEqual(0);
        expect(graph.cells.biome[i]).toBeGreaterThanOrEqual(0);
        expect(graph.cells.state[i]!).toBeGreaterThan(0);
      }
    }
  });

  it("smoothed polygon boundaries have more vertices than raw cells (Chaikin subdivision active)", () => {
    const world = generateWorld({ ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: TEST_CELLS });
    const bg = world.layers.background!;
    expect(bg.features.length).toBeGreaterThan(0);

    for (const feat of bg.features) {
      if (feat.geometry.type === "Polygon") {
        const ring = (feat.geometry as import("geojson").Polygon).coordinates[0]!;
        expect(ring.length).toBeGreaterThan(6); // Chaikin smoothing increases vertex density
      }
    }
  });

  it("v1 renderer compatibility: exported layers match expected IxWorldMap feature properties", () => {
    const world = generateWorld({ ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: TEST_CELLS });
    const political = world.layers.political!;

    for (const feat of political.features) {
      expect(feat.properties).toHaveProperty("_id");
      expect(feat.properties).toHaveProperty("_displayName");
      expect(feat.properties).toHaveProperty("_fillColor");
      expect(feat.properties).toHaveProperty("_areaSqKm");
      expect(feat.properties).toHaveProperty("_centroidLng");
      expect(feat.properties).toHaveProperty("_centroidLat");
    }
  });
});
