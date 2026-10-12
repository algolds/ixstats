/**
 * UPG v2 — Performance & Memory Tests
 *
 * Verifies execution time and memory footprint stay within performance budgets.
 */

import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { generateWorld } from "~/lib/worldgen/v2/index";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { MeshCache } from "~/lib/worldgen/v2/mesh";

const TEST_SEED = 42;

describe("v2/performance", () => {
  it("completes 10,000 cell world generation in under 3000ms", () => {
    const t0 = performance.now();
    const world = generateWorld({
      ...DEFAULT_PARAMS,
      seed: TEST_SEED,
      cellCount: 10000,
      plateCount: 8,
    });
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(3000 * TIMING_BUDGET_SCALE);
    expect(world.layers.background!.features.length).toBeGreaterThan(0);
  });

  it("individual pipeline stages run within budgeted time allocations", () => {
    let stageTimes: Record<string, number> = {};
    let lastTime = performance.now();

    generateWorld({ ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: 5000 }, (stage) => {
      const now = performance.now();
      stageTimes[stage] = now - lastTime;
      lastTime = now;
    });

    // Assert fast execution per stage for 5K mesh
    for (const [stage, timeMs] of Object.entries(stageTimes)) {
      expect(timeMs).toBeLessThan(2000 * TIMING_BUDGET_SCALE); // no single stage takes over 2s for 5K mesh
    }
  });

  it("memory footprint remains stable (RSS peak stays reasonable)", () => {
    const initialMem = process.memoryUsage().heapUsed;
    generateWorld({ ...DEFAULT_PARAMS, seed: TEST_SEED + 99, cellCount: 10000 });
    const finalMem = process.memoryUsage().heapUsed;

    // Delta should be reasonable (< 150MB heap delta)
    const memDeltaMb = (finalMem - initialMem) / (1024 * 1024);
    expect(memDeltaMb).toBeLessThan(150);
  });

  it("regenerates a 66k-cell world on a cached mesh (slider change) within budget", () => {
    // Target 600 ms in a plain bun/node process; the budget is twice that, scaled like the other
    // gates because jest's sandbox runs this loop-heavy code about 2-3x slower than node does.
    const cache = new MeshCache();
    const params = { ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: 100000 };
    generateWorld(params, undefined, { meshCache: cache });

    const t0 = performance.now();
    const world = generateWorld({ ...params, oceanPercentage: 0.65 }, undefined, {
      meshCache: cache,
    });
    const elapsed = performance.now() - t0;

    expect(world.stats.cellCount).toBeGreaterThan(60000);
    expect(elapsed).toBeLessThan(1200 * TIMING_BUDGET_SCALE);
  });
});
