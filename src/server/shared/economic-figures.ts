import type { PrismaClient } from "@prisma/client";
import {
  ECONOMIC_FIGURE_SELECT,
  effectiveFiguresOfCountry,
  type EffectiveEconomicFigures,
} from "~/lib/economy/figure-estimates";
import { growthDecimalToPercent } from "~/lib/national-issues/country-snapshot";

/**
 * One nation's inflation, unemployment and debt as recorded, else estimated from its economy, with growth read the
 * way the issue snapshot reads it (the latest history point, else the founding rate). Null when there is no nation.
 */
export async function loadEffectiveEconomicFigures(
  db: PrismaClient,
  countryId: string
): Promise<EffectiveEconomicFigures | null> {
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
  return effectiveFiguresOfCountry(row, growthDecimalToPercent(growth));
}
