/**
 * UPG v2 — Performance & Memory Tests
 *
 * Verifies execution time and memory footprint stay within performance budgets.
 */

import { generateWorld } from "../index";
import { DEFAULT_PARAMS } from "../config";

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

    expect(elapsed).toBeLessThan(3000);
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
      expect(timeMs).toBeLessThan(2000); // no single stage takes over 2s for 5K mesh
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
});
