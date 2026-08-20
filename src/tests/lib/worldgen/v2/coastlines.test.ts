/**
 * UPG v2 — Coastlines Unit Tests
 */

import { createMesh } from "~/lib/worldgen/v2/mesh";
import { generateTectonicPlates } from "~/lib/worldgen/v2/tectonics";
import { generateTerrain } from "~/lib/worldgen/v2/terrain";
import { refineCoastlines } from "~/lib/worldgen/v2/coastlines";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";

const TEST_SEED = 42;
const TEST_CELLS = 3000;

describe("v2/coastlines", () => {
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
  refineCoastlines(graph, {
    ...DEFAULT_PARAMS,
    seed: TEST_SEED,
    cellCount: TEST_CELLS,
    coastlineComplexity: 0.8,
  });

  it("populates graph.features array", () => {
    expect(graph.features.length).toBeGreaterThan(0);
  });

  it("assigns every cell to a valid feature ID", () => {
    for (let i = 0; i < graph.cells.n; i++) {
      const fId = graph.cells.feature[i]!;
      expect(fId).toBeGreaterThan(0);
      expect(fId).toBeLessThanOrEqual(graph.features.length);
    }
  });

  it("contains both ocean and landmass (continent or island) features", () => {
    const types = new Set(graph.features.map((f) => f.type));
    expect(types.has("ocean")).toBe(true);
    expect(types.has("continent") || types.has("island")).toBe(true);
  });

  it("removes tiny landmasses < 5 cells", () => {
    for (const f of graph.features) {
      if (f.type === "island") {
        expect(f.cellCount).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("computes non-negative coastal distance for all land cells", () => {
    for (let i = 0; i < graph.cells.n; i++) {
      if (graph.cells.isLand[i]) {
        const dist = graph.cells.coastDist[i]!;
        expect(dist).toBeGreaterThanOrEqual(0);
        expect(dist).toBeLessThan(65535);
      }
    }
  });

  it("feature area is positive for all features", () => {
    for (const f of graph.features) {
      expect(f.areaKm2).toBeGreaterThan(0);
      expect(f.cellCount).toBeGreaterThan(0);
    }
  });
});
