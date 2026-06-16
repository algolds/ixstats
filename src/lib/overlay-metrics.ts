/**
 * overlay-metrics.ts — Derive map-overlay metric values from existing DB columns.
 *
 * The `country` table stores `overallNationalHealth` and `tradeBalance` columns,
 * but they default to 0 and are largely unpopulated. These helpers compute
 * meaningful, non-uniform values at query time from related data so the
 * Health and Trade Balance choropleth overlays render variation without a
 * schema migration or background write loop.
 */

/** Clamp a number to the inclusive [min, max] range. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Fields read from `country` to build a deterministic health score. */
export interface HealthInput {
  lifeExpectancy?: number | null;
  literacyRate?: number | null;
  povertyRate?: number | null;
  urbanPopulationPercent?: number | null;
  populationWellbeing?: number | null;
  economicVitality?: number | null;
  currentGdpPerCapita?: number | null;
}

/** Fields read from a `bilateralTrade` row. */
export interface BilateralTradeRow {
  country1Id: string;
  country2Id: string;
  exportsFrom1?: number | null;
  exportsFrom2?: number | null;
  tradeBalance1?: number | null;
}

/**
 * Derive a national health index (0–100) from the demographic and economic
 * fields that are normally populated for countries.
 *
 * When dedicated health metrics (life expectancy, literacy, poverty) are
 * available, they dominate the score. Otherwise the score falls back to a
 * blend of GDP per capita, economic vitality, and population wellbeing so
 * the choropleth still shows variation on a fresh or sparse database.
 */
export function deriveNationalHealthScore(input: HealthInput): number {
  const lifeExpectancyScore = clamp(((input.lifeExpectancy ?? 0) / 85) * 100, 0, 100);
  const wellbeingScore = clamp(input.populationWellbeing ?? 0, 0, 100);
  const literacyScore = clamp(input.literacyRate ?? 0, 0, 100);
  const povertyScore = clamp(100 - (input.povertyRate ?? 0), 0, 100);
  const gdpPerCapita = Math.max(input.currentGdpPerCapita ?? 0, 1);
  const gdpScore = clamp((Math.log(gdpPerCapita) / Math.log(100_000)) * 100, 0, 100);
  const vitalityScore = clamp(input.economicVitality ?? 0, 0, 100);

  const hasHealthMetrics =
    (input.lifeExpectancy ?? 0) > 0 ||
    (input.literacyRate ?? 0) > 0 ||
    (input.povertyRate ?? 0) > 0;

  if (hasHealthMetrics) {
    return clamp(
      lifeExpectancyScore * 0.25 +
        wellbeingScore * 0.2 +
        literacyScore * 0.2 +
        povertyScore * 0.2 +
        gdpScore * 0.1 +
        vitalityScore * 0.05,
      0,
      100
    );
  }

  // Sparse-health fallback: still deterministic and varies with GDP/wellbeing.
  return clamp(gdpScore * 0.45 + vitalityScore * 0.3 + wellbeingScore * 0.25, 0, 100);
}

/**
 * Compute a country's net trade balance from bilateral trade rows.
 *
 * `tradeBalance1` is the surplus/deficit for `country1`; from `country2`'s
 * perspective it is the inverse. We also validate against the export values
 * when `tradeBalance1` is missing or zero.
 */
export function deriveNetTradeBalance(
  countryId: string,
  bilateralTrades: BilateralTradeRow[]
): number {
  let balance = 0;

  for (const t of bilateralTrades) {
    if (t.country1Id === countryId) {
      const explicit = t.tradeBalance1 ?? 0;
      balance += explicit !== 0 ? explicit : (t.exportsFrom1 ?? 0) - (t.exportsFrom2 ?? 0);
    } else if (t.country2Id === countryId) {
      const explicit = t.tradeBalance1 ?? 0;
      balance -= explicit !== 0 ? explicit : (t.exportsFrom1 ?? 0) - (t.exportsFrom2 ?? 0);
    }
  }

  return balance;
}
