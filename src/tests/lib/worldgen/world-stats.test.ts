/**
 * The World tab's live readout: land share, continents, climate mix and the baseline range of the slots.
 */

import { computeWorldStats } from "~/lib/worldgen/world-stats";
import { generateWorld } from "~/lib/worldgen/v2";

/** Biome ids by Trewartha code: Ar 0, Aw 1, Bw 3, E 8, Fi 10 (see TREWARTHA_BIOMES). */
const cells = (isLand: number[], biome: number[]) => ({
  n: isLand.length,
  isLand: Uint8Array.from(isLand),
  biome: Uint8Array.from(biome),
});

const slot = (population: number, gdpPerCapita: number) => ({ population, gdpPerCapita });

describe("worldgen/world-stats", () => {
  it("gives an empty mesh a zero share instead of NaN", () => {
    const stats = computeWorldStats({ cells: cells([], []), continentCount: 0, slots: [] });
    expect(stats.landShare).toBe(0);
    expect(stats.climateMix).toEqual({});
  });
  it("counts the slots and ranges their population and GDP per capita", () => {
    const stats = computeWorldStats({
      cells: cells([1, 1], [0, 0]),
      continentCount: 1,
      slots: [slot(4_000_000, 21_000), slot(250_000, 17_500), slot(12_000_000, 24_000)],
    });
    expect(stats.slotCount).toBe(3);
    expect(stats.baseline).toEqual({
      population: { min: 250_000, max: 12_000_000 },
      gdpPerCapita: { min: 17_500, max: 24_000 },
    });
  });

  it("agrees with the generator's own land percentage on a real world", () => {
    const world = generateWorld({ seed: 11, cellCount: 2500 });
    const stats = computeWorldStats({
      cells: world.graph!.cells,
      continentCount: world.stats.continentCount,
      slots: world.slots,
    });
    expect(Math.round(stats.landShare * 100)).toBe(world.stats.landPercentage);
    expect(stats.slotCount).toBe(world.slots.length);
    const total = Object.values(stats.climateMix).reduce((sum, share) => sum + share, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});
