/** Shared economies and states for the defense model tests. */
import { starterNation, type EconomyInputs, type NationState } from "~/lib/military/model";

export const T0 = 1.9e12;

/** A median-ish nation: 27M people at 21k GDP per capita, 2% of GDP on defense. */
export function economy(overrides: Partial<EconomyInputs> = {}): EconomyInputs {
  const population = overrides.population ?? 27e6;
  const gdpPerCapita = overrides.gdpPerCapita ?? 21_000;
  const gdp = overrides.gdp ?? population * gdpPerCapita;
  return {
    population,
    gdpPerCapita,
    gdp,
    defenseBudget: gdp * 0.02,
    realmMedianGdpPerCapita: 21_000,
    frontierYear: 2030,
    ...overrides,
  };
}

export const starter = (econ: EconomyInputs = economy(), policy = {}): NationState =>
  starterNation({ econ, clockMs: T0, policy });

export const totalActive = (state: NationState) =>
  state.branches.reduce((sum, b) => sum + b.active, 0);
