/**
 * UPG v2 — Comprehensive Multi-Seed Quality Audit
 *
 * Runs full 8-stage generation for 10 seeds and evaluates composite quality scores
 * across Physical Geography, Hydrology, Climate, Politics, and Vector Quality.
 *
 * Mandatory requirement:
 * - Composite score >= 85% across all 10 seeds
 * - Every individual seed score >= 80%
 */

import { generateWorld } from "~/lib/worldgen/v2/index";
import { validateAndRepair } from "~/lib/worldgen/v2/quality-gate";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";

const AUDIT_SEEDS = [1, 42, 100, 256, 500, 777, 1000, 2025, 9999, 31415];
const AUDIT_CELLS = 3000;

describe("v2/multi-seed-audit — 10-Seed Quality Audit (≥85% Threshold)", () => {
  const reports: { seed: number; compositeScore: number; passed: boolean }[] = [];

  for (const seed of AUDIT_SEEDS) {
    it(`Seed ${seed}: passes quality audit with score >= 80%`, () => {
      const world = generateWorld({
        ...DEFAULT_PARAMS,
        seed,
        cellCount: AUDIT_CELLS,
        plateCount: 8,
      });

      const report = validateAndRepair(world.graph!, {
        ...DEFAULT_PARAMS,
        seed,
        cellCount: AUDIT_CELLS,
      });

      reports.push({
        seed,
        compositeScore: report.compositeScore,
        passed: report.passed,
      });

      // Individual seed threshold: >= 80%
      expect(report.compositeScore).toBeGreaterThanOrEqual(80);
      expect(report.checks.length).toBe(9);
    });
  }

  it("composite average score across all 10 seeds is >= 85%", () => {
    expect(reports.length).toBe(10);
    const avgScore = reports.reduce((sum, r) => sum + r.compositeScore, 0) / reports.length;

    console.log(`\n=== UPG v2 Multi-Seed Quality Audit Summary ===`);
    console.log(`Seeds audited: ${reports.length}`);
    console.log(`Average Composite Quality Score: ${avgScore.toFixed(1)}%`);
    for (const r of reports) {
      console.log(`  - Seed ${r.seed}: ${r.compositeScore}% (${r.passed ? "PASS" : "FAIL"})`);
    }
    console.log(`=================================================\n`);

    expect(avgScore).toBeGreaterThanOrEqual(85);
  });
});
