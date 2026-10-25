/**
 * The realised GDP growth rate for surfaces that read stored country rows instead of running the
 * projection: the latest history point's `gdpGrowthRate`, which stat-progression writes from the
 * engine's effective rate (tier cap, diminishing returns). Before a nation's first history point
 * the static input (`adjustedGdpGrowth`) stands in. Both are decimals (0.03 = 3%).
 */

/** Country select fragment for `effectiveGrowthOf`. */
export const LATEST_GROWTH_SELECT = {
  adjustedGdpGrowth: true,
  historicalData: {
    orderBy: { ixTimeTimestamp: "desc" },
    take: 1,
    select: { gdpGrowthRate: true },
  },
} as const;

export function effectiveGrowthOf(row: {
  adjustedGdpGrowth?: number | null;
  historicalData?: ReadonlyArray<{ gdpGrowthRate: number }>;
}): number | null {
  const realised = row.historicalData?.[0]?.gdpGrowthRate;
  if (realised != null && Number.isFinite(realised)) return realised;
  return row.adjustedGdpGrowth ?? null;
}
