import {
  economicRelationsOf,
  economyFiguresOf,
  finiteOrNull,
} from "~/lib/economy/country-relations";
import {
  TAX_CHANNELS,
  computeTaxYields,
  readSavedRates,
  sectorWeightsForProfile,
  type TaxYields,
} from "./taxChannels";

/** Where the revenue figure comes from: the saved tax rates, or the founding estimate. */
export type RevenueBasis = "rates" | "founding";

/** How each basis is captioned wherever the revenue figure shows. */
export const REVENUE_BASIS_NOTE: Record<RevenueBasis, string> = {
  rates: "Your tax rates on today's GDP",
  founding: "Founding estimate until tax rates are set",
};

export interface NationalRevenue {
  /** Yearly revenue in dollars; null when there are no rates and no founding figure. */
  total: number | null;
  basis: RevenueBasis | null;
  /** The rate per tax: `rateEdits`, else the saved rate, else null. */
  rates: Record<string, number | null>;
  /** Yield per tax from those rates (all null on the founding basis). */
  yields: TaxYields;
  /** Collection efficiency (0-1); null means yields are before collection losses. */
  taxEfficiency: number | null;
}

/**
 * The one revenue figure every Economy tab shows: the saved tax rates on today's GDP
 * (`computeTaxYields`). The founding `governmentRevenueTotal` stands in only while no rate is
 * saved. `rateEdits` lets the Fiscal policy console show unsaved edits the same way.
 */
export function nationalRevenue(
  country: unknown,
  rateEdits: Record<string, number> = {}
): NationalRevenue {
  const { economicProfile, fiscalSystem } = economicRelationsOf(country);
  const { currentTotalGdp, governmentRevenueTotal } = economyFiguresOf(country);
  const taxEfficiency = finiteOrNull(fiscalSystem?.taxEfficiency);
  const saved = readSavedRates(fiscalSystem);
  const rates: Record<string, number | null> = {};
  for (const ch of TAX_CHANNELS) rates[ch.key] = rateEdits[ch.key] ?? saved[ch.key]?.rate ?? null;

  const yields = computeTaxYields(
    rates,
    currentTotalGdp,
    taxEfficiency,
    sectorWeightsForProfile(economicProfile)
  );
  const base = { rates, yields, taxEfficiency };
  if (Object.values(rates).some((rate) => rate != null)) {
    return { ...base, total: yields.total, basis: yields.total != null ? "rates" : null };
  }
  const founding =
    governmentRevenueTotal != null && governmentRevenueTotal > 0 ? governmentRevenueTotal : null;
  return { ...base, total: founding, basis: founding != null ? "founding" : null };
}
