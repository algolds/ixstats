// Enhanced Economics tRPC Router
// Provides advanced economic analysis and intelligence via API

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  analyzeCountryEconomics,
  getQuickEconomicHealth,
  getBuilderEconomicMetrics,
  getIntelligenceEconomicData,
} from "~/lib/enhanced-economic-service";
import type {
  CountryStats,
  HistoricalDataPoint,
  EconomicTier,
  PopulationTier,
} from "~/types/ixstats";
import type { EconomyData } from "~/types/economics";
import type { EconomicAnalysisResult } from "~/lib/enhanced-economic-service";

// Input validation schemas
const countryStatsSchema = z.object({
  countryId: z.string(),
  name: z.string(),
  currentTotalGdp: z.number(),
  currentGdpPerCapita: z.number(),
  currentPopulation: z.number(),
  adjustedGdpGrowth: z.number(),
  economicTier: z.string(),
  populationTier: z.string(),
  populationGrowthRate: z.number(),
});

const economyDataSchema = z.object({
  core: z.object({
    nominalGDP: z.number(),
    gdpPerCapita: z.number(),
    realGDPGrowthRate: z.number(),
    inflationRate: z.number(),
  }),
  fiscal: z.object({
    totalDebtGDPRatio: z.number(),
    budgetDeficitSurplus: z.number(),
    taxRevenueGDPPercent: z.number(),
    debtServiceCosts: z.number(),
    interestRates: z.number(),
  }),
  labor: z.object({
    unemploymentRate: z.number(),
    employmentRate: z.number(),
    laborForceParticipationRate: z.number(),
  }),
  income: z.object({
    incomeInequalityGini: z.number(),
    socialMobilityIndex: z.number(),
    economicClasses: z.array(
      z.object({
        wealthPercent: z.number(),
      })
    ),
  }),
  spending: z.object({
    spendingGDPPercent: z.number(),
    spendingCategories: z.array(
      z.object({
        category: z.string(),
        percent: z.number(),
      })
    ),
  }),
  demographics: z.object({
    lifeExpectancy: z.number(),
    literacyRate: z.number(),
    regions: z.array(
      z.object({
        name: z.string(),
      })
    ),
  }),
});

const historicalDataSchema = z.array(
  z.object({
    gdpGrowthRate: z.number(),
    timestamp: z.string().optional(),
  })
);

export const enhancedEconomicsRouter = createTRPCRouter({
  /**
   * Get comprehensive economic analysis for a country
   */
  getComprehensiveAnalysis: publicProcedure
    .input(
      z.object({
        countryStats: countryStatsSchema,
        economyData: economyDataSchema,
        historicalData: historicalDataSchema.optional(),
        options: z
          .object({
            includeIntuitiveAnalysis: z.boolean().default(true),
            includeGroupedAnalysis: z.boolean().default(true),
            includeProjections: z.boolean().default(false),
            includeSimulations: z.boolean().default(false),
          })
          .optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const { countryStats, economyData, historicalData = [], options = {} } = input;

        const analysis = await analyzeCountryEconomics(
          countryStats as unknown as CountryStats,
          economyData as unknown as EconomyData,
          historicalData as HistoricalDataPoint[],
          options
        );

        return analysis;
      } catch (error) {
        console.error("Comprehensive economic analysis failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Economic analysis failed: ${(error as Error).message || "Unknown error"}`,
        });
      }
    }),

  /**
   * Get quick economic health check for dashboard use
   */
  getQuickHealthCheck: publicProcedure
    .input(
      z.object({
        countryStats: countryStatsSchema,
        economyData: economyDataSchema,
      })
    )
    .query(async ({ input }) => {
      try {
        const { countryStats, economyData } = input;

        const healthCheck = getQuickEconomicHealth(
          countryStats as unknown as CountryStats,
          economyData as unknown as EconomyData
        );

        return healthCheck;
      } catch (error) {
        console.error("Quick health check failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Health check failed: ${(error as Error).message || "Unknown error"}`,
        });
      }
    }),

  /**
   * Get economic metrics for builder components
   */
  getBuilderMetrics: publicProcedure
    .input(
      z.object({
        countryStats: countryStatsSchema,
        economyData: economyDataSchema,
      })
    )
    .query(async ({ input }) => {
      try {
        const { countryStats, economyData } = input;

        const metrics = getBuilderEconomicMetrics(
          countryStats as unknown as CountryStats,
          economyData as unknown as EconomyData
        );

        return metrics;
      } catch (error) {
        console.error("Builder metrics failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Builder metrics failed: ${(error as Error).message || "Unknown error"}`,
        });
      }
    }),

  /**
   * Get intelligence economic data for MyCountry components
   */
  getIntelligenceData: publicProcedure
    .input(
      z.object({
        countryStats: countryStatsSchema,
        economyData: economyDataSchema,
      })
    )
    .query(async ({ input }) => {
      try {
        const { countryStats, economyData } = input;

        const intelligenceData = getIntelligenceEconomicData(
          countryStats as unknown as CountryStats,
          economyData as unknown as EconomyData
        );

        return intelligenceData;
      } catch (error) {
        console.error("Intelligence data failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Intelligence data failed: ${(error as Error).message || "Unknown error"}`,
        });
      }
    }),

  /**
   * Get economic analysis for a specific country by ID
   */
  getCountryEconomicAnalysis: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        analysisType: z
          .enum(["comprehensive", "health", "builder", "intelligence"])
          .default("comprehensive"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { countryId, analysisType } = input;

        // Get country data from database
        const country = await ctx.db.country.findUnique({
          where: { id: countryId },
          include: {
            economicData: true,
            historicalData: {
              orderBy: { createdAt: "desc" },
              take: 20,
            },
          },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Convert to required format - use Partial to handle missing fields
        const countryStats = {
          id: country.id,
          name: country.name,
          currentTotalGdp: country.currentTotalGdp || 0,
          currentGdpPerCapita: country.currentGdpPerCapita || 0,
          adjustedGdpGrowth: country.adjustedGdpGrowth || 0,
          economicTier: (country.economicTier || "Developing") as EconomicTier,
          populationTier: (country.populationTier || "2") as PopulationTier,
          populationGrowthRate: country.populationGrowthRate || 0.02,
          totalGdp: country.currentTotalGdp || 0,
          lastCalculated: Date.now(),
          baselineDate: Date.now(),
          localGrowthFactor: 1.0,
          maxGdpGrowthRate: country.adjustedGdpGrowth || 0.02,
          actualGdpGrowth: country.adjustedGdpGrowth || 0.02,
          projected2040Population: country.currentPopulation || 0,
          projected2040Gdp: country.currentTotalGdp || 0,
          projected2040GdpPerCapita:
            country.currentGdpPerCapita || 0,
        } as CountryStats;

        // Create economy data from country economic data
        const economyData: Record<string, unknown> = {
          core: {
            nominalGDP: country.currentTotalGdp || 0,
            gdpPerCapita: country.currentGdpPerCapita,
            realGDPGrowthRate: country.adjustedGdpGrowth,
            inflationRate: country.inflationRate || 0.02,
          },
          fiscal: {
            totalDebtGDPRatio: country.totalDebtGDPRatio || 60,
            budgetDeficitSurplus: country.budgetDeficitSurplus || 0,
            taxRevenueGDPPercent: country.taxRevenueGDPPercent || 20,
            debtServiceCosts:
              country.debtServiceCosts || country.currentTotalGdp * 0.03,
            interestRates: country.interestRates || 0.03,
          },
          labor: {
            unemploymentRate: country.unemploymentRate || 6,
            employmentRate: 100 - (country.unemploymentRate || 6),
            laborForceParticipationRate:
              country.laborForceParticipationRate || 65,
          },
          income: {
            incomeInequalityGini: country.incomeInequalityGini || 0.35,
            socialMobilityIndex: country.socialMobilityIndex || 60,
            economicClasses: [
              { wealthPercent: 40 }, // Top 10%
              { wealthPercent: 30 }, // Middle class
              { wealthPercent: 30 }, // Lower income
            ],
          },
          spending: {
            spendingGDPPercent: country.governmentBudgetGDPPercent || 35,
            spendingCategories: [
              { category: "healthcare", percent: 8 },
              { category: "education", percent: 6 },
              { category: "infrastructure", percent: 5 },
              { category: "defense", percent: 4 },
              { category: "social", percent: 12 },
            ],
          },
          demographics: {
            lifeExpectancy: country.lifeExpectancy || 75,
            literacyRate: country.literacyRate || 95,
            regions: [{ name: "National Average" }],
          },
        };

        const historicalData: HistoricalDataPoint[] = country.historicalData.map(
          (h: HistoricalDataPoint) => ({
            gdpGrowthRate: h.gdpGrowthRate,
            timestamp: h.timestamp.toISOString(),
          })
        );

        // Return appropriate analysis based on type
        switch (analysisType) {
          case "health":
            return getQuickEconomicHealth(countryStats, economyData);

          case "builder":
            return getBuilderEconomicMetrics(countryStats, economyData);

          case "intelligence":
            return getIntelligenceEconomicData(countryStats, economyData);

          default:
            return await analyzeCountryEconomics(countryStats, economyData, historicalData);
        }
      } catch (error) {
        console.error("Country economic analysis failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Country analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get economic comparison between countries
   */
  compareCountries: publicProcedure
    .input(
      z.object({
        countryIds: z.array(z.string()).min(2).max(5),
        metrics: z
          .array(z.enum(["resilience", "productivity", "wellbeing", "complexity", "overall"]))
          .default(["overall"]),
      })
    )
    .query(async ({ ctx, input }): Promise<{ countryId: string; analysis: EconomicAnalysisResult }[]> => {
      try {
        const { countryIds, metrics } = input;

        const comparisons: { countryId: string; analysis: EconomicAnalysisResult }[] = [];

        for (const countryId of countryIds) {
          // Get individual country analysis (reusing the logic above)
          const analysis = await enhancedEconomicsRouter
            .createCaller(ctx as Record<string, unknown>)
            .getCountryEconomicAnalysis({ countryId, analysisType: "comprehensive" });

          comparisons.push({
            countryId,
            analysis,
          });
        }

        // Create comparison structure
        const comparison: { countries: { countryId: string; analysis: EconomicAnalysisResult }[]; rankings: Record<string, unknown>[] } = {
          countries: comparisons,
          rankings: metrics.map((metric) => ({
            metric,
            ranking: comparisons
              .map((c, index) => ({
                countryId: c.countryId,
                score:
                  metric === "overall"
                    ? c.analysis.comprehensive.overallRating.score
                    : c.analysis.comprehensive[metric]?.overallScore || 0,
                rank: index + 1,
              }))
              .sort((a, b) => b.score - a.score)
              .map((item, index) => ({ ...item, rank: index + 1 })),
          })),
        };

        return comparison.countries;
      } catch (error) {
        console.error("Country comparison failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Country comparison failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),
});

export type EnhancedEconomicsRouter = typeof enhancedEconomicsRouter;
