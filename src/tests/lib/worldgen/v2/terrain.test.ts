/**
 * UPG v2 — Terrain Unit Tests
 */

import { createMesh } from "~/lib/worldgen/v2/mesh";
import { generateTectonicPlates } from "~/lib/worldgen/v2/tectonics";
import { generateTerrain } from "~/lib/worldgen/v2/terrain";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";

const TEST_SEED = 42;
const TEST_CELLS = 3000;

describe("v2/terrain", () => {
  const graph = createMesh(TEST_SEED, TEST_CELLS, 2);
  generateTectonicPlates(graph, {
    ...DEFAULT_PARAMS,
    seed: TEST_SEED,
    cellCount: TEST_CELLS,
    plateCount: 8,
  });
  generateTerrain(graph, {
    ...DEFAULT_PARAMS,
    seed: TEST_SEED,
    cellCount: TEST_CELLS,
    oceanPercentage: 0.65,
  });

  it("populates elevation array h in meters", () => {
    for (let i = 0; i < graph.cells.n; i++) {
      expect(typeof graph.cells.h[i]).toBe("number");
      expect(isNaN(graph.cells.h[i]!)).toBe(false);
    }
  });

  it("sets isLand = 1 for h >= 0 and isLand = 0 for h < 0", () => {
    for (let i = 0; i < graph.cells.n; i++) {
      const h = graph.cells.h[i]!;
      const isLand = graph.cells.isLand[i]!;
      if (h >= 0) {
        expect(isLand).toBe(1);
      } else {
        expect(isLand).toBe(0);
      }
    }
  });

  it("land percentage matches target oceanPercentage within tolerance", () => {
    let landCount = 0;
    for (let i = 0; i < graph.cells.n; i++) {
      if (graph.cells.isLand[i]) landCount++;
    }
    const landPct = landCount / graph.cells.n;
    const expectedLandPct = 1 - 0.65; // 0.35
    // Should be within ±10% tolerance
    expect(landPct).toBeGreaterThan(expectedLandPct - 0.1);
    expect(landPct).toBeLessThan(expectedLandPct + 0.1);
  });

  it("assigns elevation zones 0-8 for land cells", () => {
    const zonesPresent = new Set<number>();
    for (let i = 0; i < graph.cells.n; i++) {
      if (graph.cells.isLand[i]) {
        const zone = graph.cells.elevZone[i]!;
        expect(zone).toBeGreaterThanOrEqual(0);
        expect(zone).toBeLessThanOrEqual(8);
        zonesPresent.add(zone);
      }
    }
    // Multiple elevation zones should be represented across land
    expect(zonesPresent.size).toBeGreaterThan(3);
  });

  it("marks mountain ridge cells near convergent boundaries", () => {
    let mountainRidgeCount = 0;
    for (let i = 0; i < graph.cells.n; i++) {
      if (graph.cells.isMountainRidge[i]) mountainRidgeCount++;
    }
    // Some mountain ridge cells should exist
    expect(mountainRidgeCount).toBeGreaterThan(0);
  });

  it("continental plate cells average higher elevation than oceanic plate cells", () => {
    let continentalSum = 0;
    let continentalCount = 0;
    let oceanicSum = 0;
    let oceanicCount = 0;

    for (let i = 0; i < graph.cells.n; i++) {
      const pId = graph.cells.plate[i]!;
      const plate = graph.plates[pId - 1];
      if (plate) {
        if (plate.type === "continental") {
          continentalSum += graph.cells.h[i]!;
          continentalCount++;
        } else {
          oceanicSum += graph.cells.h[i]!;
          oceanicCount++;
        }
      }
    }

    if (continentalCount > 0 && oceanicCount > 0) {
      const continentalAvg = continentalSum / continentalCount;
      const oceanicAvg = oceanicSum / oceanicCount;
      expect(continentalAvg).toBeGreaterThan(oceanicAvg);
    }
  });
});
