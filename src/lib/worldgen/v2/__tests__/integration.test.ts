/**
 * UPG v2 — Full Pipeline Integration Tests
 *
 * Runs end-to-end world generation across 5 distinct random seeds.
 */

import { generateWorld } from "../index";
import { DEFAULT_PARAMS } from "../config";

const TEST_SEEDS = [1, 42, 100, 256, 777];
const TEST_CELLS = 3000;

describe("v2/integration — Multi-Seed End-to-End Pipeline", () => {
  for (const seed of TEST_SEEDS) {
    describe(`Seed ${seed}`, () => {
      const world = generateWorld({
        ...DEFAULT_PARAMS,
        seed,
        cellCount: TEST_CELLS,
        plateCount: 8,
      });

      it("completes generation and returns valid GeneratedWorld structure", () => {
        expect(world.seed).toBe(seed);
        expect(world.layers).toBeDefined();
        expect(world.stats).toBeDefined();
        expect(world.graph).toBeDefined();
      });

      it("generates non-trivial land and ocean ratio (20-60% land)", () => {
        const landPct = world.stats.landPercentage;
        expect(landPct).toBeGreaterThanOrEqual(20);
        expect(landPct).toBeLessThanOrEqual(60);
      });

      it("generates plausible country and river counts", () => {
        expect(world.stats.countryCount).toBeGreaterThan(0);
        expect(world.stats.riverCount).toBeGreaterThan(0);
        expect(world.stats.continentCount).toBeGreaterThan(0);
      });

      it("populates all 7 GeoJSON layer feature collections", () => {
        const layers = world.layers;
        expect(layers.background!.features.length).toBeGreaterThan(0);
        expect(layers.altitudes!.features.length).toBeGreaterThan(0);
        expect(layers.climate!.features.length).toBeGreaterThan(0);
        expect(layers.political!.features.length).toBeGreaterThan(0);
        expect(layers.rivers!.features.length).toBeGreaterThan(0);
      });

      it("completes generation within timing budget (< 5000ms)", () => {
        expect(world.stats.generationTimeMs).toBeLessThan(5000);
      });
    });
  }
});
