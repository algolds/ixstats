/**
 * Utilities for formatting, normalizing, and calculating membership and economic tiers across IxStates.
 */

import type { EconomicTier, PopulationTier } from "~/types/ixstats";

export interface TierInfo {
  label: string;
  isPremium: boolean;
  badgeClass: string;
}

export function formatMembershipTier(tier?: string | null): TierInfo {
  if (!tier) {
    return {
      label: "Citizen",
      isPremium: false,
      badgeClass: "border-border/60 bg-muted/60 text-muted-foreground",
    };
  }

  const normalized = tier.toLowerCase().trim();
  const isPremium =
    normalized === "mycountry_premium" || normalized === "premium" || normalized === "executive";

  if (isPremium) {
    return {
      label: "Premium",
      isPremium: true,
      badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };
  }

  return {
    label:
      normalized === "basic"
        ? "Citizen"
        : tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, " "),
    isPremium: false,
    badgeClass: "border-border/60 bg-muted/60 text-muted-foreground",
  };
}

// ─── Economic & Population Tier Mappings ───────────────────────────────────

export const ECONOMIC_TIER_INFO: Record<
  EconomicTier,
  { min: number; max: number; maxGrowth: number }
> = {
  Impoverished: { min: 0, max: 9999, maxGrowth: 0.1 },
  Developing: { min: 10000, max: 24999, maxGrowth: 0.075 },
  Developed: { min: 25000, max: 34999, maxGrowth: 0.05 },
  Healthy: { min: 35000, max: 44999, maxGrowth: 0.035 },
  Strong: { min: 45000, max: 54999, maxGrowth: 0.0275 },
  "Very Strong": { min: 55000, max: 64999, maxGrowth: 0.015 },
  Extravagant: { min: 65000, max: Infinity, maxGrowth: 0.005 },
};

export const POPULATION_TIER_INFO: Record<PopulationTier, { min: number; max: number }> = {
  "1": { min: 0, max: 9_999_999 },
  "2": { min: 10_000_000, max: 29_999_999 },
  "3": { min: 30_000_000, max: 49_999_999 },
  "4": { min: 50_000_000, max: 79_999_999 },
  "5": { min: 80_000_000, max: 119_999_999 },
  "6": { min: 120_000_000, max: 349_999_999 },
  "7": { min: 350_000_000, max: 499_999_999 },
  X: { min: 500_000_000, max: Infinity },
};

// ─── Deterministic Tier Calculation Functions ───────────────────────────────

export function getEconomicTierFromGdpPerCapita(gdpPerCapita: number): EconomicTier {
  for (const [tier, info] of Object.entries(ECONOMIC_TIER_INFO)) {
    if (gdpPerCapita >= info.min && gdpPerCapita <= info.max) {
      return tier as EconomicTier;
    }
  }
  return "Impoverished" as EconomicTier;
}

export function getPopulationTierFromPopulation(population: number): PopulationTier {
  for (const [tier, info] of Object.entries(POPULATION_TIER_INFO)) {
    if (population >= info.min && population <= info.max) {
      return tier as PopulationTier;
    }
  }
  return "X" as PopulationTier;
}

export function decimalToPercentage(decimal: number): number {
  return decimal * 100;
}

export function percentageToDecimal(percentage: number): number {
  return percentage / 100;
}
