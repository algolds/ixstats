/**
 * Setting a nation's size (population and GDP per capita) from outside the stat progression: the
 * country editor's size save, the map's "Rebase stats from map" and the bottom-up rollup.
 *
 * The figures become the new baseline, dated now on the nation's realm clock, so the live projection and the stat
 * progression carry them forward instead of reverting them. The yearly budget follows the GDP
 * step (`gdpScaleRatio` against the stored total GDP), as it does for every projection step.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { scaleBudgetWithGdp } from "~/lib/government/budget-allocations";
import { gdpScaleRatio } from "~/lib/government/budget-math";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { clockForCountry } from "~/server/shared/realm-time";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";

/** The stored figures a size change starts from. */
export interface SizeBefore {
  currentPopulation: number;
  currentTotalGdp: number;
  totalWorkforce: number | null;
  landArea: number | null;
}

/** Select for the `SizeBefore` columns of a Country. */
export const SIZE_BEFORE_SELECT = {
  currentPopulation: true,
  currentTotalGdp: true,
  totalWorkforce: true,
  landArea: true,
} as const;

/** The Country columns a new population and GDP per capita set, as of `nowMs` on the nation's clock. */
export function sizeColumns(
  population: number,
  gdpPerCapita: number,
  before: Omit<SizeBefore, "currentTotalGdp">,
  nowMs: number
): Prisma.CountryUpdateInput {
  const totalGdp = population * gdpPerCapita;
  const ixNow = new Date(nowMs);
  // The workforce keeps its share of the population; a nation without one gets the usual 65%.
  const workforceShare =
    before.totalWorkforce && before.currentPopulation > 0
      ? before.totalWorkforce / before.currentPopulation
      : 0.65;
  const land = before.landArea && before.landArea > 0 ? before.landArea : null;
  return {
    baselinePopulation: population,
    baselineGdpPerCapita: gdpPerCapita,
    baselineDate: ixNow,
    currentPopulation: population,
    currentGdpPerCapita: gdpPerCapita,
    currentTotalGdp: totalGdp,
    nominalGDP: totalGdp,
    economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
    populationTier: getPopulationTierFromPopulation(population),
    totalWorkforce: Math.round(population * workforceShare),
    ...(land && { populationDensity: population / land, gdpDensity: totalGdp / land }),
    lastCalculated: ixNow,
  };
}

type SizeDb =
  | Pick<
      PrismaClient,
      "country" | "budgetAllocation" | "governmentStructure" | "realm" | "systemConfig"
    >
  | Prisma.TransactionClient;

/**
 * Rebase the nation to `population` and `gdpPerCapita` and move its yearly budget by the GDP
 * ratio. Runs on whatever client it is given; callers that need both writes atomic pass a
 * transaction client.
 */
export async function rebaseNationalSize(
  db: SizeDb,
  countryId: string,
  size: { population: number; gdpPerCapita: number },
  before: SizeBefore
) {
  const { population, gdpPerCapita } = size;
  const now = (await clockForCountry(db, countryId)).now();
  const country = await db.country.update({
    where: { id: countryId },
    data: sizeColumns(population, gdpPerCapita, before, now),
  });
  await scaleBudgetWithGdp(
    db,
    countryId,
    gdpScaleRatio(before.currentTotalGdp, population * gdpPerCapita),
    currentBudgetYear(now)
  );
  return country;
}
