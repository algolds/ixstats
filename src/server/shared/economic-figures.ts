import type { PrismaClient } from "@prisma/client";
import {
  ECONOMIC_FIGURE_SELECT,
  effectiveFiguresOfCountry,
  type EconomicFigures,
  type EffectiveEconomicFigures,
} from "~/lib/economy/figure-estimates";
import { growthDecimalToPercent } from "~/lib/national-issues/country-snapshot";

/** The figure columns plus growth read the way the issue snapshot reads it (latest history point, else founding). */
async function loadFigureRow(db: PrismaClient, countryId: string) {
  const row = await db.country.findUnique({
    where: { id: countryId },
    select: {
      ...ECONOMIC_FIGURE_SELECT,
      actualGdpGrowth: true,
      historicalData: {
        orderBy: { ixTimeTimestamp: "desc" },
        take: 1,
        select: { gdpGrowthRate: true },
      },
    },
  });
  if (!row) return null;
  const growth = row.historicalData?.[0]?.gdpGrowthRate ?? row.actualGdpGrowth;
  return { row, growthPct: growthDecimalToPercent(growth) };
}

/** One nation's inflation, unemployment and debt as recorded, else estimated from its economy. Null: no nation. */
export async function loadEffectiveEconomicFigures(
  db: PrismaClient,
  countryId: string
): Promise<EffectiveEconomicFigures | null> {
  const loaded = await loadFigureRow(db, countryId);
  return loaded ? effectiveFiguresOfCountry(loaded.row, loaded.growthPct) : null;
}

/** The estimates alone, whatever is recorded: the editor's hint for each figure. Null: no nation. */
export async function loadEconomicFigureEstimates(
  db: PrismaClient,
  countryId: string
): Promise<EconomicFigures | null> {
  const loaded = await loadFigureRow(db, countryId);
  if (!loaded) return null;
  const blank = { inflationRate: null, unemploymentRate: null, totalDebtGDPRatio: null };
  const effective = effectiveFiguresOfCountry({ ...loaded.row, ...blank }, loaded.growthPct);
  return {
    inflationRate: effective.inflationRate.value,
    unemploymentRate: effective.unemploymentRate.value,
    totalDebtGDPRatio: effective.totalDebtGDPRatio.value,
  };
}
