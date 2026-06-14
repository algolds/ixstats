/**
 * MyCountry API Router - Dedicated endpoints for MyCountry system
 *
 * This router provides specialized endpoints for the MyCountry interface including:
 * - Intelligence feed aggregation from multiple sources
 * - Achievement system with real-time calculations
 * - Executive dashboard data compilation
 * - National vitality metrics computation
 * - Historical timeline and milestone tracking
 * - Real-time notification generation
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { db } from "~/server/db";
import { globalCache } from "~/lib/advanced-cache-system";

import type {
  CountryWithEconomicData,
  IntelligenceItem,
  Achievement,
  Milestone,
  Ranking,
  VitalityScores,
  NationalSummary,
} from "~/types/mycountry";

/**
 * Cache helper functions for MyCountry-specific data
 */
async function getMyCountryCache<T = any>(key: string): Promise<T | null> {
  return globalCache.get<T>(key);
}

async function setMyCountryCache(key: string, data: any, ttl = 60000): Promise<void> {
  await globalCache.set(key, data, { ttl: Math.round(ttl / 1000) });
}

/**
 * Calculate national vitality scores based on comprehensive country data
 */
function calculateVitalityScores(country: CountryWithEconomicData): VitalityScores {
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
 * Generate intelligence feed by aggregating data from multiple sources
 */
// eslint-disable-next-line unused-imports/no-unused-vars
async function generateIntelligenceFeed(countryId: string): Promise<IntelligenceItem[]> {
  const cacheKey = `intelligence_${countryId}`;
  const cached = await getMyCountryCache<IntelligenceItem[]>(cacheKey);
  if (cached) return cached;

  try {
    // Get country data for context
    const country = await db.country.findUnique({
      where: { id: countryId },
      include: {
        historicalData: {
          orderBy: { ixTimeTimestamp: "desc" },
          take: 5,
        },
      },
    });

    if (!country) return [];

    const intelligenceItems: IntelligenceItem[] = [];
    const currentTime = IxTime.getCurrentIxTime();

    // Economic Intelligence
    const recentHistory = country.historicalData[0];
    if (recentHistory && country.historicalData.length > 1) {
      const previousHistory = country.historicalData[1];
      if (previousHistory) {
        const gdpChange =
          ((recentHistory.gdpPerCapita - previousHistory.gdpPerCapita) /
            previousHistory.gdpPerCapita) *
          100;

        if (Math.abs(gdpChange) > 2) {
          intelligenceItems.push({
            id: `econ_${Date.now()}`,
            createdAt: currentTime,
            type: gdpChange > 0 ? "opportunity" : "alert",
            severity: (Math.abs(gdpChange) > 5 ? "high" : "medium") as any,
            title: `Economic ${gdpChange > 0 ? "Growth" : "Decline"} Detected`,
            description: `GDP per capita has ${gdpChange > 0 ? "increased" : "decreased"} by ${Math.abs(gdpChange).toFixed(2)}% this period.`,
            category: "economic" as any,
            timestamp: currentTime,
            actionable: true,
            source: "Economic Intelligence Unit",
            affectedRegions: [country.region].filter(Boolean) as string[],
            confidence: 0.95,
          });
        }
      }
    }

    // Population Intelligence
    if (country.populationGrowthRate > 0.05) {
      intelligenceItems.push({
        id: `pop_${Date.now()}`,
        createdAt: currentTime,
        type: "update",
        severity: "medium" as any,
        title: "High Population Growth Detected",
        description: `Population growing at ${(country.populationGrowthRate * 100).toFixed(2)}% - infrastructure planning may be needed.`,
        category: "population" as any,
        timestamp: currentTime,
        actionable: true,
        source: "Demographics Bureau",
        confidence: 0.9,
      });
    }

    // Get system-wide intelligence items
    const globalIntelligence = await db.intelligenceItem.findMany({
      where: {
        isActive: true,
        OR: [
          { affectedCountries: { contains: country.name } },
          { region: country.region },
          { affectedCountries: null }, // Global items
        ],
      },
      orderBy: { timestamp: "desc" },
      take: 10,
    });

    // Convert database intelligence items
    globalIntelligence.forEach((item) => {
      intelligenceItems.push({
        id: item.id,
        createdAt: item.timestamp.getTime(),
        type: item.category === "security" ? "alert" : "update",
        severity: item.priority.toLowerCase() as "low" | "medium" | "high" | "critical",
        title: item.title,
        description: item.content,
        category: item.category.toLowerCase() as
          | "economic"
          | "diplomatic"
          | "social"
          | "governance",
        timestamp: item.timestamp.getTime(),
        actionable: item.priority !== "low",
        source: item.source,
        confidence: 0.85,
      });
    });

    // Sort by priority and timestamp
    intelligenceItems.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.severity] - priorityOrder[a.severity];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp - a.timestamp;
    });

    const result = intelligenceItems.slice(0, 20); // Limit to 20 items
    await setMyCountryCache(cacheKey, result, 120000); // Cache for 2 minutes
    return result;
  } catch (error) {
    console.error("[MyCountry Intelligence Feed] Error:", error);
    return [];
  }
}

/**
 * Calculate achievements based on country performance and milestones
 */
async function calculateAchievements(countryId: string): Promise<Achievement[]> {
  const cacheKey = `achievements_${countryId}`;
  const cached = await getMyCountryCache<Achievement[]>(cacheKey);
  if (cached) return cached;

  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
      include: {
        historicalData: {
          orderBy: { ixTimeTimestamp: "desc" },
          take: 50,
        },
      },
    });

    if (!country) return [];

    const achievements: Achievement[] = [];

    // Economic achievements
    if (country.currentGdpPerCapita > 50000) {
      achievements.push({
        id: "wealthy_nation",
        title: "Wealthy Nation",
        description: "Achieved GDP per capita above $50,000",
        category: "economic",
        rarity: "epic",
        achievedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        points: 500,
        icon: "TrendingUp",
        progress: 100,
      });
    }

    // Population achievements
    if (country.currentPopulation > 100000000) {
      achievements.push({
        id: "population_giant",
        title: "Population Giant",
        description: "Reached over 100 million citizens",
        category: "social",
        rarity: "rare",
        achievedAt: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
        points: 300,
        icon: "Users",
        progress: 100,
      });
    }

    // Growth achievements
    if (country.adjustedGdpGrowth > 0.05) {
      achievements.push({
        id: "rapid_growth",
        title: "Rapid Economic Growth",
        description: "Sustained GDP growth above 5% annually",
        category: "economic",
        rarity: "rare",
        achievedAt: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
        points: 250,
        icon: "TrendingUp",
        progress: 100,
      });
    }

    const result = achievements.slice(0, 10);
    await setMyCountryCache(cacheKey, result, 300000); // Cache for 5 minutes
    return result;
  } catch (error) {
    console.error("[MyCountry Achievements] Error:", error);
    return [];
  }
}

/**
 * Generate international rankings for the country
 */
async function generateRankings(countryId: string): Promise<Ranking[]> {
  const cacheKey = `rankings_${countryId}`;
  const cached = await getMyCountryCache<Ranking[]>(cacheKey);
  if (cached) return cached;

  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
    });

    if (!country) return [];

    // Get all countries with valid economic data for comparative rankings
    const allCountries = await db.country.findMany({
      where: {
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

/**
 * Generate historical milestones for the country
 */
async function generateMilestones(countryId: string): Promise<Milestone[]> {
  const cacheKey = `milestones_${countryId}`;
  const cached = await getMyCountryCache<Milestone[]>(cacheKey);
  if (cached) return cached;

  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
      include: {
        historicalData: {
          orderBy: { ixTimeTimestamp: "asc" },
        },
      },
    });

    if (!country) return [];

    const milestones: Milestone[] = [];
    const history = country.historicalData;

    // Population milestones
    const populationMilestones = [1000000, 5000000, 10000000, 25000000, 50000000, 100000000];
    populationMilestones.forEach((milestone) => {
      const record = history.find((h) => h.population >= milestone);
      if (record && country.currentPopulation >= milestone) {
        milestones.push({
          id: `pop_${milestone}`,
          title: `${(milestone / 1000000).toFixed(0)}M Population Milestone`,
          description: `Successfully reached ${milestone.toLocaleString()} citizens`,
          achievedAt: record.ixTimeTimestamp.getTime(),
          impact: "Expanded national capacity and influence",
          category: "population",
          significance: "major",
        });
      }
    });

    // Economic milestones
    const gdpMilestones = [10000, 25000, 50000, 75000, 100000];
    gdpMilestones.forEach((milestone) => {
      const record = history.find((h) => h.gdpPerCapita >= milestone);
      if (record && country.currentGdpPerCapita >= milestone) {
        milestones.push({
          id: `gdp_${milestone}`,
          title: `$${milestone.toLocaleString()} GDP per Capita`,
          description: `Achieved ${milestone >= 50000 ? "high-income" : "middle-income"} status`,
          achievedAt: record.ixTimeTimestamp.getTime(),
          impact: `Enhanced living standards and economic development`,
          category: "economic",
          significance: milestone >= 50000 ? "major" : "moderate",
        });
      }
    });

    // Sort by achievement date
    milestones.sort((a, b) => b.achievedAt - a.achievedAt);

    const result = milestones.slice(0, 15);
    await setMyCountryCache(cacheKey, result, 900000); // Cache for 15 minutes
    return result;
  } catch (error) {
    console.error("[MyCountry Milestones] Error:", error);
    return [];
  }
}

export const myCountryDashboardRouter = createTRPCRouter({
  /**
   * Get comprehensive country data with vitality scores for MyCountry dashboard
   */
  getCountryDashboard: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        includeHistory: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const cacheKey = `dashboard_${input.countryId}_hist_${input.includeHistory}`;
      try {
        const cached = await globalCache.get<any>(cacheKey);
        if (cached) return cached;

        const country = await db.country.findUnique({
          where: { id: input.countryId },
          include: {
            historicalData: input.includeHistory
              ? {
                  orderBy: { ixTimeTimestamp: "desc" },
                  take: 30,
                }
              : false,
            demographics: true,
            economicProfile: true,
            laborMarket: true,
            fiscalSystem: true,
            incomeDistribution: true,
            governmentBudget: true,
          },
        });

        if (!country) {
          throw new Error("Country not found");
        }

        // Calculate vitality scores
        const vitalityScores = calculateVitalityScores(country as any);

        const result = {
          ...country,
          ...vitalityScores,
          lastCalculated: country.lastCalculated.getTime(),
          baselineDate: country.baselineDate.getTime(),
        };

        await globalCache.set(cacheKey, result, { ttl: 15 });
        return result;
      } catch (error) {
        console.error("[MyCountry Dashboard] Error:", error);
        throw new Error("Failed to get country dashboard data");
      }
    }),

  /**
   * Get achievements and recognition for the country
   */
  getAchievements: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return calculateAchievements(input.countryId);
    }),

  /**
   * Get international rankings for the country
   */
  getRankings: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return generateRankings(input.countryId);
    }),

  /**
   * Get historical milestones for the country
   */
  getMilestones: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return generateMilestones(input.countryId);
    }),

  /**
   * Get summary statistics for national overview
   */
  getNationalSummary: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const cacheKey = `summary_${input.countryId}`;
      const cached = await getMyCountryCache<NationalSummary>(cacheKey);
      if (cached) return cached;

      try {
        const country = await db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          throw new Error("Country not found");
        }

        const vitalityScores = calculateVitalityScores(country as any);

        const summary: NationalSummary = {
          countryId: country.id,
          countryName: country.name,
          overallHealth: vitalityScores.overallScore,
          keyMetrics: {
            population: country.currentPopulation,
            gdpPerCapita: country.currentGdpPerCapita,
            totalGdp: country.currentTotalGdp,
            economicTier: country.economicTier,
            populationTier: country.populationTier,
          },
          growthRates: {
            population: country.populationGrowthRate,
            economic: country.adjustedGdpGrowth,
          },
          vitalityScores,
          lastUpdated: country.lastCalculated.getTime(),
        };

        await setMyCountryCache(cacheKey, summary, 180000); // Cache for 3 minutes
        return summary;
      } catch (error) {
        console.error("[MyCountry Summary] Error:", error);
        throw new Error("Failed to get national summary");
      }
    }),
});
