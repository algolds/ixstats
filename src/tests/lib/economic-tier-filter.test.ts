/**
 * Tests for economic-tier-filter.ts - tier options used by /countries and /explore
 */

import {
  ECONOMIC_TIERS,
  TIER_FILTER_OPTIONS,
  isTierFilter,
  matchesTierFilter,
} from "~/lib/economic-tier-filter";
import { EconomicTier } from "~/types/ixstats";
import { EconomicTier as CalculationsEconomicTier } from "~/lib/economy/calculations";

describe("economic tier filter", () => {
  test("offers exactly the real economic tiers, lowest to highest", () => {
    expect(ECONOMIC_TIERS).toEqual([
      "Impoverished",
      "Developing",
      "Developed",
      "Healthy",
      "Strong",
      "Very Strong",
      "Extravagant",
    ]);
    expect([...ECONOMIC_TIERS].sort()).toEqual(Object.values(EconomicTier).sort());
    expect([...ECONOMIC_TIERS].sort()).toEqual(Object.values(CalculationsEconomicTier).sort());
  });

  test("options are 'All Tiers' followed by every real tier", () => {
    expect(TIER_FILTER_OPTIONS.map((o) => o.value)).toEqual(["all", ...ECONOMIC_TIERS]);
    expect(TIER_FILTER_OPTIONS[0]).toEqual({ value: "all", label: "All Tiers" });
  });

  test("rejects tiers that don't exist", () => {
    expect(isTierFilter("Advanced")).toBe(false);
    expect(isTierFilter("Emerging")).toBe(false);
    expect(isTierFilter("developed")).toBe(false);
    expect(isTierFilter("all")).toBe(true);
    for (const tier of ECONOMIC_TIERS) expect(isTierFilter(tier)).toBe(true);
  });

  test("each tier matches only nations in that tier", () => {
    const nations = ECONOMIC_TIERS.map((tier, i) => ({ name: `Nation ${i}`, economicTier: tier }));
    for (const tier of ECONOMIC_TIERS) {
      const matched = nations.filter((n) => matchesTierFilter(n.economicTier, tier));
      expect(matched).toHaveLength(1);
      expect(matched[0]!.economicTier).toBe(tier);
    }
    expect(nations.filter((n) => matchesTierFilter(n.economicTier, "all"))).toHaveLength(
      nations.length
    );
    expect(matchesTierFilter(null, EconomicTier.DEVELOPED)).toBe(false);
  });
});
