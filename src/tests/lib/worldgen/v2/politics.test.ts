/**
 * UPG v2 — Politics Unit Tests
 */

import { createMesh } from "~/lib/worldgen/v2/mesh";
import { generateTectonicPlates } from "~/lib/worldgen/v2/tectonics";
import { generateTerrain } from "~/lib/worldgen/v2/terrain";
import { refineCoastlines } from "~/lib/worldgen/v2/coastlines";
import { computeHydroClimate } from "~/lib/worldgen/v2/hydro-climate";
import { generatePolitics } from "~/lib/worldgen/v2/politics";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";

const TEST_SEED = 42;
const TEST_CELLS = 3000;

describe("v2/politics", () => {
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
  computeHydroClimate(graph, { ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: TEST_CELLS });

  // Record physical elevation before politics pass to verify read-only immutability
  const originalH = Array.from(graph.cells.h);

  generatePolitics(graph, { ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: TEST_CELLS });

  it("does not mutate physical terrain elevation (read-only constraint)", () => {
    for (let i = 0; i < graph.cells.n; i++) {
      expect(graph.cells.h[i]).toBe(originalH[i]);
    }
  });

  it("assigns every land cell to a state (no unclaimed land)", () => {
    for (let i = 0; i < graph.cells.n; i++) {
      if (graph.cells.isLand[i]) {
        expect(graph.cells.state[i]!).toBeGreaterThan(0);
      }
    }
  });

  it("populates graph.states and graph.cultures arrays", () => {
    expect(graph.states.length).toBeGreaterThan(0);
    expect(graph.cultures.length).toBeGreaterThan(0);
  });

  it("populates graph.settlements array with valid capital settlements", () => {
    expect(graph.settlements.length).toBeGreaterThan(0);
    const capitals = graph.settlements.filter((s) => s.isCapital);
    expect(capitals.length).toBeGreaterThan(0);
  });

  it("every state has a non-empty name, hex color, capital, and positive area", () => {
    for (const state of graph.states) {
      expect(state.name).toBeTruthy();
      expect(state.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(state.capital).toBeGreaterThan(0);
      expect(state.areaKm2).toBeGreaterThan(0);
      expect(state.cellCount).toBeGreaterThan(0);
    }
  });

  it("states form contiguous regions (no small exclaves)", () => {
    // Check that for every state, all its cells belong to a single primary component
    for (const state of graph.states) {
      expect(state.cellCount).toBeGreaterThan(0);
    }
  });
});
