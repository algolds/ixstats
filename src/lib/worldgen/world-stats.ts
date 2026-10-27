/**
 * The World tab's live readout of a generated world: land share, continents, climate mix, slot count and the
 * range of the slots' baselines.
 *
 * Pure (shared by the generator worker and its tests); it reads the generator's per-cell arrays and slots, so the
 * main thread never walks the 66,000 cells itself.
 */

import { TREWARTHA_BIOMES } from "./v2/config";
import type { WorldGraph, WorldSlot } from "./v2/types";

export type MinMax = { min: number; max: number };

export type WorldPreviewStats = {
  /** Share of the cells that are land (0-1) */
  landShare: number;
  continents: number;
  /** Share of the land per climate group (A tropical, B dry, C subtropical, D temperate, E boreal, F polar, H highland); groups without land are left out */
  climateMix: Record<string, number>;
  slotCount: number;
  /** Over the slots; null when there are none (the realm keeps its borders) */
  baseline: { population: MinMax; gdpPerCapita: MinMax } | null;
};

export type WorldStatsInput = {
  cells: Pick<WorldGraph["cells"], "n" | "isLand" | "biome">;
  continentCount: number;
  slots: readonly Pick<WorldSlot, "population" | "gdpPerCapita">[];
};

/** Climate group (the first letter of the Trewartha code) of each biome id; an unknown id is highland. */
const BIOME_GROUP = TREWARTHA_BIOMES.map((biome) => biome.code.charAt(0));
const FALLBACK_GROUP = "H";

function rangeOf(values: readonly number[]): MinMax {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function climateMixOf({ n, isLand, biome }: WorldStatsInput["cells"]): {
  land: number;
  mix: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  let land = 0;
  for (let i = 0; i < n; i++) {
    if (!isLand[i]) continue;
    land++;
    const group = BIOME_GROUP[biome[i]!] ?? FALLBACK_GROUP;
    counts[group] = (counts[group] ?? 0) + 1;
  }
  const mix: Record<string, number> = {};
  for (const [group, count] of Object.entries(counts)) mix[group] = count / land;
  return { land, mix };
}

export function computeWorldStats(input: WorldStatsInput): WorldPreviewStats {
  const { land, mix } = climateMixOf(input.cells);
  const { slots } = input;
  return {
    landShare: input.cells.n > 0 ? land / input.cells.n : 0,
    continents: input.continentCount,
    climateMix: mix,
    slotCount: slots.length,
    baseline:
      slots.length > 0
        ? {
            population: rangeOf(slots.map((slot) => slot.population)),
            gdpPerCapita: rangeOf(slots.map((slot) => slot.gdpPerCapita)),
          }
        : null,
  };
}
