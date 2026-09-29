/**
 * Shared helpers for MyCountry routers.
 *
 * Extracted from dashboard.ts, intelligence.ts, and actions.ts (2026-06-14)
 * to eliminate ~900 lines of duplicated code across three files.
 *
 * Lives in src/server/shared/ so routers can import without cross-router
 * dependencies (follows the layer-cache.ts pattern).
 */

import { db } from "~/server/db";
import { globalCache } from "~/lib/cache";

import type { CountryWithEconomicData, Ranking, VitalityScores } from "~/types/mycountry";

/**
 * Cache helper functions for MyCountry-specific data
 */
export async function getMyCountryCache<T = any>(key: string): Promise<T | null> {
  return globalCache.get<T>(key);
}

export async function setMyCountryCache(key: string, data: any, ttl = 60000): Promise<void> {
  await globalCache.set(key, data, { ttl: Math.round(ttl / 1000) });
}

/**
 * Calculate national vitality scores based on comprehensive country data
 */
export function calculateVitalityScores(country: CountryWithEconomicData): VitalityScores {
  // Economic Vitality — matches getActivityRingsData formula
  const gdpScore = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
  const growthBonus = Math.min(20, Math.max(-20, country.adjustedGdpGrowth * 400));
  const economicVitality = Math.min(100, Math.max(0, gdpScore * 0.7 + growthBonus + 30));

  // Population Wellbeing — matches getActivityRingsData formula
  const popGrowthRate = country.populationGrowthRate || 0;
  const growthHealth = popGrowthRate > 0 ? 70 : 40;
  const densityFactor = country.populationDensity
    ? Math.max(50, 100 - country.populationDensity / 500)
    : 60;
  const populationWellbeing = (growthHealth + densityFactor) / 2;

  // Diplomatic Standing (same formula in both endpoints)
  const diplomaticStanding = Math.min(
    100,
    Math.max(
      40,
      ((country as any).globalDiplomaticInfluence || 50) +
        ((country as any).tradeRelationshipStrength || 10) +
        ((country as any).allianceStrength || 15) -
        ((country as any).diplomaticTensions || 5)
    )
  );

  // Governmental Efficiency — matches getActivityRingsData formula
  const tierScore: Record<string, number> = {
    Extravagant: 95,
    "Very Strong": 85,
    Strong: 75,
    Healthy: 65,
    Developed: 50,
    Developing: 35,
    Impoverished: 25,
  };
  const governmentalEfficiency = (tierScore[country.economicTier] || 25) * 0.8;

  return {
    economicVitality: Math.round(economicVitality),
    populationWellbeing: Math.round(populationWellbeing),
    diplomaticStanding: Math.round(diplomaticStanding),
    governmentalEfficiency: Math.round(governmentalEfficiency),
    overallScore: Math.round(
      (economicVitality + populationWellbeing + diplomaticStanding + governmentalEfficiency) / 4
    ),
  };
}

/**
 * Generate international rankings for the country
 */
export async function generateRankings(countryId: string): Promise<Ranking[]> {
  const cacheKey = `rankings_${countryId}`;
  const cached = await getMyCountryCache<Ranking[]>(cacheKey);
  if (cached) return cached;

  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
    });

    if (!country) return [];

    // Rank against the country's own realm (ruling E-h); the rankings cache is keyed by country id.
    const allCountries = await db.country.findMany({
      where: {
        realmId: country.realmId,
        currentPopulation: { gt: 0 },
        currentGdpPerCapita: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        currentGdpPerCapita: true,
        currentPopulation: true,
        currentTotalGdp: true,
        region: true,
        economicTier: true,
        populationTier: true,
      },
    });

    const rankings: Ranking[] = [];

    // Safe sort comparator that handles NaN/null
    const safeSort = (a: number, b: number) => {
      const aVal = Number.isFinite(a) ? a : 0;
      const bVal = Number.isFinite(b) ? b : 0;
      return bVal - aVal;
    };

    // GDP per capita ranking (use spread to avoid mutating original array)
    const gdpSorted = [...allCountries].sort((a, b) =>
      safeSort(a.currentGdpPerCapita, b.currentGdpPerCapita)
    );
    const gdpRanking = gdpSorted.findIndex((c) => c.id === countryId) + 1;

    const regionalGdp = gdpSorted.filter((c) => c.region === country.region);
    const tierGdp = gdpSorted.filter((c) => c.economicTier === country.economicTier);

    rankings.push({
      category: "GDP per Capita",
      global: { position: gdpRanking, total: allCountries.length },
      regional: {
        position: regionalGdp.findIndex((c) => c.id === countryId) + 1,
        total: regionalGdp.length,
        region: country.region || "Unknown",
      },
      tier: {
        position: tierGdp.findIndex((c) => c.id === countryId) + 1,
        total: tierGdp.length,
        tier: country.economicTier,
      },
      trend:
        country.adjustedGdpGrowth > 0.03
          ? "improving"
          : country.adjustedGdpGrowth < -0.01
            ? "declining"
            : "stable",
      percentile: Math.round((1 - (gdpRanking - 1) / allCountries.length) * 100),
    });

    // Population ranking (separate sorted copy)
    const popSorted = [...allCountries].sort((a, b) =>
      safeSort(a.currentPopulation, b.currentPopulation)
    );
    const popRanking = popSorted.findIndex((c) => c.id === countryId) + 1;

    const regionalPop = popSorted.filter((c) => c.region === country.region);
    const tierPop = popSorted.filter((c) => c.populationTier === country.populationTier);

    rankings.push({
      category: "Population",
      global: { position: popRanking, total: allCountries.length },
      regional: {
        position: regionalPop.findIndex((c) => c.id === countryId) + 1,
        total: regionalPop.length,
        region: country.region || "Unknown",
      },
      tier: {
        position: tierPop.findIndex((c) => c.id === countryId) + 1,
        total: tierPop.length,
        tier: country.populationTier,
      },
      trend: "stable",
      percentile: Math.round((1 - (popRanking - 1) / allCountries.length) * 100),
    });

    const result = rankings;
    await setMyCountryCache(cacheKey, result, 600000); // Cache for 10 minutes
    return result;
  } catch (error) {
    console.error("[MyCountry Rankings] Error:", error);
    return [];
  }
}
