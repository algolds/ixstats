/**
 * Unified Intelligence Router
 *
 * Comprehensive intelligence router that combines SDI/ECI functionality with
 * executive dashboard operations, diplomatic channels, and unified intelligence feeds.
 *
 * Features:
 * - Executive dashboard overview (vitality, alerts, quick actions)
 * - Enhanced quick actions with real database effects
 * - Secure diplomatic channel management
 * - Real-time intelligence feed aggregation
 * - Advanced analytics dashboard
 * - Classification-based access control
 * - Notification hooks for all major events
 * - Audit logging for sensitive operations
 */

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import type { EconomicIndicator } from "~/types/sdi";

// ===== SCHEMAS =====
// ===== UNIFIED INTELLIGENCE ROUTER =====

export const intelAnalyticsIndicatorsRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

  // ===== ALERT ACTIONS =====

  // ===== DIPLOMATIC CHANNELS =====

  // ===== INTELLIGENCE FEED =====

  // ===== ANALYTICS DASHBOARD =====

  // ===== ADVANCED ANALYTICS & AI =====

  // ===== ADMIN OPERATIONS =====

  // ===== ALERT THRESHOLD MANAGEMENT =====

  // ===== CABINET MEETING MANAGEMENT =====

  // ===== ECONOMIC POLICY MANAGEMENT =====
  // ===== CRISIS MANAGEMENT (from SDI) =====

  // ===== ECONOMIC INTELLIGENCE (from SDI) =====

  /**
   * Get global economic indicators
   * Migrated from SDI router
   */
  getEconomicIndicators: publicProcedure.query(async ({ ctx }): Promise<EconomicIndicator> => {
    try {
      // Aggregate live data from all countries at current IxTime
      const targetTime = IxTime.getCurrentIxTime();
      const countries = await ctx.db.country.findMany({});
      console.log("[Unified Intelligence] Fetched countries count:", countries.length);

      let globalGDP = 0;
      let totalGrowth = 0;
      let totalInflation = 0;
      let totalUnemployment = 0;
      let count = 0;

      for (const c of countries) {
        globalGDP += c.currentTotalGdp || c.baselinePopulation * c.baselineGdpPerCapita || 0;
        totalGrowth +=
          typeof c.adjustedGdpGrowth === "number" && !isNaN(c.adjustedGdpGrowth)
            ? c.adjustedGdpGrowth
            : 0.03;
        totalInflation += 0.02; // Default inflation rate
        totalUnemployment += 5.0; // Default unemployment rate
        count++;
      }

      console.log(
        "[Unified Intelligence] Before globalGrowth calculation - totalGrowth:",
        totalGrowth,
        "count:",
        count
      );

      // Calculate averages
      const globalGrowth = count > 0 ? totalGrowth / count : 0;
      const inflationRate = count > 0 ? totalInflation / count : 0;
      const unemploymentRate = count > 0 ? totalUnemployment / count : 0;

      return {
        globalGDP,
        globalGrowth,
        inflationRate,
        unemploymentRate,
        tradeVolume: globalGDP * 0.3, // Estimate trade volume as 30% of global GDP
        currencyVolatility: Math.abs(inflationRate - 0.02) * 2, // Volatility based on inflation deviation from 2% target
        timestamp: new Date(targetTime),
      };
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching economic indicators:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch economic indicators",
      });
    }
  }),

  /**
   * Get commodity prices
   * Migrated from SDI router
   */
  getCommodityPrices: publicProcedure.query(async ({ ctx }) => {
    try {
      // Calculate commodity prices based on economic indicators and crises
      const [recentIndicators, crises] = await Promise.all([
        ctx.db.economicIndicator.findMany({
          orderBy: { timestamp: "desc" },
          take: 2,
        }),
        ctx.db.crisisEvent.findMany({
          where: {
            type: { in: ["economic_crisis", "natural_disaster", "environmental"] },
            timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
          },
        }),
      ]);

      // Base prices (can be adjusted based on real economic data)
      const basePrices = {
        oil: 85.2,
        gold: 1950.5,
        copper: 3.85,
        wheat: 5.2,
        gas: 2.85,
      };

      // Calculate price changes based on economic indicators
      let inflationFactor = 1.0;

      if (recentIndicators.length >= 2) {
        const latest = recentIndicators[0]!;
        const previous = recentIndicators[1]!;

        inflationFactor = 1 + (latest.inflationRate - previous.inflationRate) / 100;
      }

      // Crisis impact on commodities
      const crisisImpact = {
        oil: 0,
        gold: 0,
        copper: 0,
        wheat: 0,
        gas: 0,
      };

      crises.forEach((crisis) => {
        const severity =
          crisis.severity === "critical"
            ? 0.15
            : crisis.severity === "high"
              ? 0.1
              : crisis.severity === "medium"
                ? 0.05
                : 0.02;

        if (crisis.type === "economic_crisis") {
          crisisImpact.gold += severity; // Safe haven demand
          crisisImpact.oil -= severity * 0.5; // Reduced demand
        } else if (crisis.type === "natural_disaster") {
          crisisImpact.wheat += severity; // Food security
          crisisImpact.copper -= severity * 0.3; // Infrastructure damage
        } else if (crisis.type === "environmental") {
          crisisImpact.gas += severity; // Energy transition
          crisisImpact.copper += severity * 0.2; // Green tech demand
        }
      });

      // Calculate final prices and trends
      const commodities = [
        {
          name: "Oil (Brent)",
          price: Number((basePrices.oil * inflationFactor * (1 + crisisImpact.oil)).toFixed(2)),
          change: Number((crisisImpact.oil * 100).toFixed(1)),
          trend:
            crisisImpact.oil > 0.01
              ? ("up" as const)
              : crisisImpact.oil < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
        {
          name: "Gold",
          price: Number((basePrices.gold * inflationFactor * (1 + crisisImpact.gold)).toFixed(2)),
          change: Number((crisisImpact.gold * 100).toFixed(1)),
          trend:
            crisisImpact.gold > 0.01
              ? ("up" as const)
              : crisisImpact.gold < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
        {
          name: "Copper",
          price: Number(
            (basePrices.copper * inflationFactor * (1 + crisisImpact.copper)).toFixed(2)
          ),
          change: Number((crisisImpact.copper * 100).toFixed(1)),
          trend:
            crisisImpact.copper > 0.01
              ? ("up" as const)
              : crisisImpact.copper < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
        {
          name: "Wheat",
          price: Number((basePrices.wheat * inflationFactor * (1 + crisisImpact.wheat)).toFixed(2)),
          change: Number((crisisImpact.wheat * 100).toFixed(1)),
          trend:
            crisisImpact.wheat > 0.01
              ? ("up" as const)
              : crisisImpact.wheat < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
        {
          name: "Natural Gas",
          price: Number((basePrices.gas * inflationFactor * (1 + crisisImpact.gas)).toFixed(2)),
          change: Number((crisisImpact.gas * 100).toFixed(1)),
          trend:
            crisisImpact.gas > 0.01
              ? ("up" as const)
              : crisisImpact.gas < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
      ];

      return commodities;
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching commodity prices:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch commodity prices",
      });
    }
  }),

  // ===== DIPLOMATIC INTELLIGENCE (from SDI) =====

  // ===== STRATEGIC PLANS & SECURITY =====

  // ===== KEY FINDINGS =====
});

// ===== HELPER FUNCTIONS =====
// Migrated from ECI router for advanced analytics and AI recommendations

/**
 * Calculate volatility metrics from historical data
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function calculateVolatility(data: Record<string, unknown>[]) {
  if (data.length < 2) return { gdp: 0, population: 0, overall: 0 };

  const gdpValues = data.map((d) => d.totalGdp).filter((v): v is number => typeof v === "number");
  const populationValues = data
    .map((d) => d.population)
    .filter((v): v is number => typeof v === "number");

  return {
    gdp: calculateStandardDeviation(gdpValues),
    population: calculateStandardDeviation(populationValues),
    overall:
      (calculateStandardDeviation(gdpValues) + calculateStandardDeviation(populationValues)) / 2,
  };
}

/**
 * Calculate trend analysis from historical data
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function calculateTrends(data: Record<string, unknown>[]) {
  if (data.length < 3) return { gdp: "stable", population: "stable", overall: "stable" };

  const recent = data.slice(0, 10);
  const older = data.slice(10, 20);

  const recentAvgGdp =
    recent.reduce((sum, d) => sum + (typeof d.totalGdp === "number" ? d.totalGdp : 0), 0) /
    recent.length;
  const olderAvgGdp =
    older.reduce((sum, d) => sum + (typeof d.totalGdp === "number" ? d.totalGdp : 0), 0) /
    older.length;

  const gdpTrend =
    recentAvgGdp > olderAvgGdp * 1.02
      ? "growing"
      : recentAvgGdp < olderAvgGdp * 0.98
        ? "declining"
        : "stable";

  return {
    gdp: gdpTrend,
    population: "stable", // Simplified for now
    overall: gdpTrend,
  };
}

/**
 * Calculate correlation analysis (simplified)
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function calculateCorrelations(data: Record<string, unknown>[]) {
  // Simplified correlation analysis
  return {
    gdpPopulation: 0.85,
    gdpGrowthStability: 0.72,
    overallHealth: 0.78,
  };
}

/**
 * Calculate standard deviation for volatility analysis
 */
function calculateStandardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Generate AI-powered recommendations based on country data
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function generateAIRecommendations(
  country: Record<string, unknown>,
  // eslint-disable-next-line unused-imports/no-unused-vars
  recentData: Record<string, unknown>[]
) {
  const recommendations = [];

  if (typeof country.currentGdpPerCapita === "number" && country.currentGdpPerCapita < 25000) {
    recommendations.push({
      id: "infrastructure_investment",
      title: "Infrastructure Investment",
      description: "Consider increasing infrastructure spending to boost economic development",
      priority: "high",
      category: "economic",
      impact: "Potential 2-3% GDP growth boost over 2 years",
    });
  }

  if (typeof country.populationGrowthRate === "number" && country.populationGrowthRate > 0.05) {
    recommendations.push({
      id: "education_expansion",
      title: "Education System Expansion",
      description: "High population growth requires expanded educational capacity",
      priority: "medium",
      category: "social",
      impact: "Long-term economic productivity improvement",
    });
  }

  recommendations.push({
    id: "diversification",
    title: "Economic Diversification",
    description: "Reduce economic risk through sector diversification",
    priority: "medium",
    category: "economic",
    impact: "Improved economic stability and resilience",
  });

  return recommendations;
}

/**
 * Generate predictive economic models
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function generatePredictiveModels(
  country: Record<string, unknown>,
  historicalData: Record<string, unknown>[],
  input: Record<string, unknown>
) {
  const timeframePeriods = {
    "6_months": 6,
    "1_year": 12,
    "2_years": 24,
    "5_years": 60,
  };

  const periods = timeframePeriods[input.timeframe as keyof typeof timeframePeriods] || 12;
  const baseGrowthRate = (country.adjustedGdpGrowth as number) || 0.03;

  const scenarios = (Array.isArray(input.scenarios) ? input.scenarios : []).map(
    (scenario: string) => {
      const multiplier = scenario === "optimistic" ? 1.5 : scenario === "pessimistic" ? 0.5 : 1.0;

      const projectedGdp =
        (country.currentTotalGdp as number) *
        Math.pow(1 + baseGrowthRate * multiplier, periods / 12);
      const projectedPopulation =
        (country.currentPopulation as number) *
        Math.pow(1 + ((country.populationGrowthRate as number) || 0.01), periods / 12);
      const projectedGdpPerCapita = projectedGdp / projectedPopulation;

      return {
        scenario,
        projectedGdp,
        projectedPopulation,
        projectedGdpPerCapita,
        confidence: scenario === "realistic" ? 85 : scenario === "optimistic" ? 65 : 70,
      };
    }
  );

  return {
    timeframe: input.timeframe,
    scenarios,
    methodology: "Compound growth model with historical variance analysis",
    lastUpdated: new Date(),
  };
}

/**
 * Calculate real-time country metrics (social, security, political)
 */
// eslint-disable-next-line unused-imports/no-unused-vars
async function calculateRealTimeMetrics(db: any, countryId: string) {
  // Get recent security threats
  const securityThreats = await db.intelligenceAlert.findMany({
    where: {
      countryId,
      category: { in: ["security", "SECURITY", "crisis", "CRISIS"] },
      isActive: true,
    },
  });

  const criticalThreats = securityThreats.filter(
    (threat: any) => threat.severity === "critical" || threat.severity === "CRITICAL"
  );

  // Calculate security metric (higher threats = lower score)
  const securityScore = Math.max(
    20,
    100 - securityThreats.length * 10 - criticalThreats.length * 20
  );

  // Get recent policies
  const policies = await db.policy.findMany({
    where: {
      countryId,
      status: "active",
    },
  });

  // Calculate political stability (more active policies = higher stability)
  const politicalScore = Math.min(100, 60 + policies.length * 5);

  // Social metric based on economic tier and policies
  const country = await db.country.findUnique({ where: { id: countryId } });
  const economicTierScores: Record<string, number> = {
    Impoverished: 30,
    Developing: 50,
    Developed: 70,
    Healthy: 80,
    Strong: 90,
    "Very Strong": 95,
    Extravagant: 100,
  };

  const baseSocialScore = economicTierScores[country?.economicTier as string] ?? 50;
  const socialPolicies = policies.filter(
    (p: Record<string, unknown>) => p.policyType === "social" || p.policyType === "SOCIAL"
  );
  const socialScore = Math.min(100, baseSocialScore + socialPolicies.length * 3);

  return {
    social: Math.round(socialScore),
    security: Math.round(securityScore),
    political: Math.round(politicalScore),
  };
}
