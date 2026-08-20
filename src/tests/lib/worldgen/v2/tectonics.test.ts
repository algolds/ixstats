/**
 * UPG v2 — Tectonics Unit Tests
 */

import { createMesh } from "~/lib/worldgen/v2/mesh";
import { generateTectonicPlates, classifyCellBoundary } from "~/lib/worldgen/v2/tectonics";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";

const TEST_SEED = 42;
const TEST_CELLS = 3000;

describe("v2/tectonics", () => {
  const graph = createMesh(TEST_SEED, TEST_CELLS, 2);
  generateTectonicPlates(graph, {
    ...DEFAULT_PARAMS,
    seed: TEST_SEED,
    cellCount: TEST_CELLS,
    plateCount: 8,
  });

  it("populates the graph.plates array with requested plate count", () => {
    expect(graph.plates.length).toBe(8);
  });

  it("assigns every cell to exactly one plate (1..plateCount)", () => {
    for (let i = 0; i < graph.cells.n; i++) {
      const pId = graph.cells.plate[i]!;
      expect(pId).toBeGreaterThanOrEqual(1);
      expect(pId).toBeLessThanOrEqual(8);
    }
  });

  it("no plate has 0 cells", () => {
    for (const plate of graph.plates) {
      expect(plate.cellCount).toBeGreaterThan(0);
    }
  });

  it("assigns valid velocity vectors and speeds to all plates", () => {
    for (const plate of graph.plates) {
      expect(plate.velocity).toHaveLength(2);
      expect(typeof plate.velocity[0]).toBe("number");
      expect(typeof plate.velocity[1]).toBe("number");
      expect(plate.speed).toBeGreaterThan(0);
    }
  });

  it("contains both continental and oceanic plates", () => {
    const types = new Set(graph.plates.map((p) => p.type));
    expect(types.has("continental")).toBe(true);
    expect(types.has("oceanic")).toBe(true);
  });

  it("computes plateDist = 0 for boundary cells and >0 for interior cells", () => {
    let boundaryCellCount = 0;
    let interiorCellCount = 0;

    for (let i = 0; i < graph.cells.n; i++) {
      const dist = graph.cells.plateDist[i]!;
      if (dist === 0) boundaryCellCount++;
      else interiorCellCount++;
    }

    expect(boundaryCellCount).toBeGreaterThan(0);
    expect(interiorCellCount).toBeGreaterThan(0);
  });

  it("classifies cell boundaries as convergent, divergent, or transform", () => {
    // Find two adjacent cells on different plates
    let testCellA = -1;
    let testCellB = -1;

    for (let i = 0; i < graph.cells.n; i++) {
      const myPlate = graph.cells.plate[i]!;
      for (const nb of graph.cells.neighbors[i]!) {
        if (graph.cells.plate[nb]! !== myPlate) {
          testCellA = i;
          testCellB = nb;
          break;
        }
      }
      if (testCellA >= 0) break;
    }

    expect(testCellA).toBeGreaterThanOrEqual(0);
    expect(testCellB).toBeGreaterThanOrEqual(0);

    const bType = classifyCellBoundary(graph, testCellA, testCellB);
    expect(["convergent", "divergent", "transform"]).toContain(bType);
  });
});
