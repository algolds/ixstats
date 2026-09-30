/**
 * Economic tier filter options shared by the /countries and /explore pages.
 *
 * Derived from ECONOMIC_TIER_INFO so the selectable tiers can't drift from the
 * tiers countries are actually assigned.
 */

import { ECONOMIC_TIER_INFO, type EconomicTier } from "~/types/ixstats";

/** All real economic tiers, ordered from lowest to highest GDP per capita. */
export const ECONOMIC_TIERS: readonly EconomicTier[] = (
  Object.keys(ECONOMIC_TIER_INFO) as EconomicTier[]
).sort((a, b) => ECONOMIC_TIER_INFO[a].min - ECONOMIC_TIER_INFO[b].min);

export type TierFilter = "all" | EconomicTier;

export const TIER_FILTER_OPTIONS: readonly { value: TierFilter; label: string }[] = [
  { value: "all", label: "All Tiers" },
  ...ECONOMIC_TIERS.map((tier) => ({ value: tier, label: tier })),
];

export function isTierFilter(value: unknown): value is TierFilter {
  return value === "all" || ECONOMIC_TIERS.includes(value as EconomicTier);
}

export function matchesTierFilter(economicTier: string | null | undefined, filter: TierFilter) {
  return filter === "all" || economicTier === filter;
}
