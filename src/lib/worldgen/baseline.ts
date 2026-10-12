/**
 * Derived nation baseline: what a generated slot starts with when a player claims it.
 *
 * Pure (shared by the generator worker, which previews the numbers, and the server, which writes
 * the country). Population comes from the slot's habitable land and its climate mix; GDP per
 * capita from the founder's development level, varied by coast, river access and climate within
 * 0.75-1.25 of the level's base.
 */

import type { DevelopmentLevel } from "./v2/types";

export type BaselineInput = {
  /** Land cells in the slot (0 = no land) */
  cells: number;
  /** Land area that people can live on: no ice caps, high peaks or lakes */
  habitableKm2: number;
  /** Share of the habitable land per climate group: A tropical, B dry, C subtropical, D temperate, E boreal, F polar, H highland */
  climateMix: Record<string, number>;
  /** Share of the habitable land on or near the coast (0-1) */
  coastShare: number;
  /** Share of the habitable land on or next to a river (0-1) */
  riverShare: number;
  developmentLevel: DevelopmentLevel;
};

export type Baseline = { population: number; gdpPerCapita: number };

/** People per km² on habitable land at the industrial level. */
const DENSITY: Record<string, number> = { A: 55, B: 10, C: 110, D: 80, E: 6, F: 0.5, H: 15 };

/** Development moves the whole density curve: developing worlds are less crowded, modern ones denser. */
const DENSITY_SCALE: Record<DevelopmentLevel, number> = {
  developing: 0.8,
  industrial: 1,
  modern: 1.25,
};

const GDP_BASE: Record<DevelopmentLevel, number> = {
  developing: 6000,
  industrial: 20000,
  modern: 45000,
};

/** Change to the GDP factor per climate group: temperate lands prosper, deserts and ice do not. */
const CLIMATE_GDP: Record<string, number> = {
  A: -0.06,
  B: -0.1,
  C: 0.06,
  D: 0.1,
  E: -0.04,
  F: -0.15,
  H: -0.08,
};

const GDP_FACTOR_RANGE = { min: 0.75, max: 1.25 } as const;
/** The median nation of a generated world (measured on the presets): coast and river access neither help nor hurt there. */
const TYPICAL = { coast: 0.45, river: 0.2 } as const;
const COAST_WEIGHT = 0.25;
const RIVER_WEIGHT = 0.3;

const unit = (v: number) => Math.min(1, Math.max(0, v));

/** Mean of `table` over the climate mix, which need not sum to 1; unknown groups are ignored. */
function mixMean(mix: Record<string, number>, table: Record<string, number>): number {
  let total = 0;
  let sum = 0;
  for (const [group, share] of Object.entries(mix)) {
    const value = table[group];
    if (value === undefined || !(share > 0)) continue;
    total += share;
    sum += share * value;
  }
  return total > 0 ? sum / total : 0;
}

export function deriveBaseline(input: BaselineInput): Baseline {
  if (!(input.cells > 0)) return { population: 0, gdpPerCapita: 0 };

  const density = mixMean(input.climateMix, DENSITY) * DENSITY_SCALE[input.developmentLevel];
  const population = Math.round(Math.max(0, input.habitableKm2) * density);

  const factor =
    1 +
    mixMean(input.climateMix, CLIMATE_GDP) +
    COAST_WEIGHT * (unit(input.coastShare) - TYPICAL.coast) +
    RIVER_WEIGHT * (unit(input.riverShare) - TYPICAL.river);
  const clamped = Math.min(GDP_FACTOR_RANGE.max, Math.max(GDP_FACTOR_RANGE.min, factor));
  return { population, gdpPerCapita: Math.round(GDP_BASE[input.developmentLevel] * clamped) };
}
