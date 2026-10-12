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
  it("reads the land share and the climate mix over land cells only", () => {
    const stats = computeWorldStats({
      cells: cells([1, 1, 1, 0, 0, 1], [0, 1, 3, 0, 0, 8]),
      continentCount: 2,
      slots: [],
    });

    expect(stats.landShare).toBeCloseTo(4 / 6, 10);
    expect(stats.continents).toBe(2);
    // Ar and Aw are both group A; the two sea cells (biome 0) do not count
    expect(stats.climateMix).toEqual({ A: 0.5, B: 0.25, E: 0.25 });
  });

  it("gives a world with no land an empty climate mix and a zero share", () => {
    const stats = computeWorldStats({
      cells: cells([0, 0, 0], [0, 0, 0]),
      continentCount: 0,
      slots: [],
    });
    expect(stats.landShare).toBe(0);
    expect(stats.climateMix).toEqual({});
  });

  it("gives an empty mesh a zero share instead of NaN", () => {
    const stats = computeWorldStats({ cells: cells([], []), continentCount: 0, slots: [] });
    expect(stats.landShare).toBe(0);
    expect(stats.climateMix).toEqual({});
  });

  it("files a biome id the table does not know under highland, as the slot geography does", () => {
    const stats = computeWorldStats({
      cells: cells([1, 1], [200, 11]),
      continentCount: 1,
      slots: [],
    });
    expect(stats.climateMix).toEqual({ H: 1 });
  });

  it("has no baseline range without slots (kept borders)", () => {
    const stats = computeWorldStats({
      cells: cells([1], [0]),
      continentCount: 1,
      slots: [],
    });
    expect(stats.slotCount).toBe(0);
    expect(stats.baseline).toBeNull();
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
