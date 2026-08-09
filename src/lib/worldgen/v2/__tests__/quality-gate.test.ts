/**
 * UPG v2 — Quality Gate Unit Tests
 */

import { createMesh } from "../mesh";
import { generateTectonicPlates } from "../tectonics";
import { generateTerrain } from "../terrain";
import { refineCoastlines } from "../coastlines";
import { computeHydroClimate } from "../hydro-climate";
import { validateAndRepair } from "../quality-gate";
import { DEFAULT_PARAMS } from "../config";

const TEST_SEED = 42;
const TEST_CELLS = 3000;

describe("v2/quality-gate", () => {
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

  const report = validateAndRepair(graph, {
    ...DEFAULT_PARAMS,
    seed: TEST_SEED,
    cellCount: TEST_CELLS,
  });

  it("returns a report with 9 checks", () => {
    expect(report.checks.length).toBe(9);
  });

  it("composite score is >= 85%", () => {
    expect(report.compositeScore).toBeGreaterThanOrEqual(85);
  });

  it("report passed boolean is true", () => {
    expect(report.passed).toBe(true);
  });

  it("all individual checks have non-empty details and score >= 70", () => {
    for (const check of report.checks) {
      expect(check.name).toBeTruthy();
      expect(check.details).toBeTruthy();
      expect(check.score).toBeGreaterThanOrEqual(70);
    }
  });

  it("report totalRepairs is a non-negative integer", () => {
    expect(report.totalRepairs).toBeGreaterThanOrEqual(0);
  });

  it("quality gate runs deterministically on second pass", () => {
    const report2 = validateAndRepair(graph, {
      ...DEFAULT_PARAMS,
      seed: TEST_SEED,
      cellCount: TEST_CELLS,
    });
    expect(report2.compositeScore).toBe(report.compositeScore);
  });
});
