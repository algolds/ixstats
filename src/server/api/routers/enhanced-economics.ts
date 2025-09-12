// Enhanced Economics tRPC Router
// Provides advanced economic analysis and intelligence via API

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { 
  analyzeCountryEconomics,
  getQuickEconomicHealth,
  getBuilderEconomicMetrics,
  getIntelligenceEconomicData
} from "~/lib/enhanced-economic-service";
import { IxStatsCalculator } from "~/lib/calculations";
import { getDefaultEconomicConfig } from "~/lib/config-service";
import type { CountryStats, HistoricalDataPoint } from "~/types/ixstats";
// Using string literals instead of importing missing types
type EconomicTier = 'emerging' | 'developing' | 'advanced' | 'powerhouse';
type PopulationTier = 'small' | 'medium' | 'large' | 'massive';

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
  populationGrowthRate: z.number()
});

const economyDataSchema = z.object({
  core: z.object({
    nominalGDP: z.number(),
    gdpPerCapita: z.number(),
    realGDPGrowthRate: z.number(),
    inflationRate: z.number()
  }),
  fiscal: z.object({
    totalDebtGDPRatio: z.number(),
    budgetDeficitSurplus: z.number(),
    taxRevenueGDPPercent: z.number(),
    debtServiceCosts: z.number(),
    interestRates: z.number()
  }),
  labor: z.object({
    unemploymentRate: z.number(),
    employmentRate: z.number(),
    laborForceParticipationRate: z.number()
  }),
  income: z.object({
    incomeInequalityGini: z.number(),
    socialMobilityIndex: z.number(),
    economicClasses: z.array(z.object({
      wealthPercent: z.number()
    }))
  }),
  spending: z.object({
    spendingGDPPercent: z.number(),
    spendingCategories: z.array(z.object({
      category: z.string(),
      percent: z.number()
    }))
  }),
  demographics: z.object({
    lifeExpectancy: z.number(),
    literacyRate: z.number(),
    regions: z.array(z.object({
      name: z.string()
    }))
  })
});

const historicalDataSchema = z.array(z.object({
  gdpGrowthRate: z.number(),
  timestamp: z.string().optional()
}));

export const enhancedEconomicsRouter = createTRPCRouter({
  /**
   * Get comprehensive economic analysis for a country
   */
  getComprehensiveAnalysis: publicProcedure
    .input(z.object({
      countryStats: countryStatsSchema,
      economyData: economyDataSchema,
      historicalData: historicalDataSchema.optional(),
      options: z.object({
        includeIntuitiveAnalysis: z.boolean().default(true),
        includeGroupedAnalysis: z.boolean().default(true),
        includeProjections: z.boolean().default(false),
        includeSimulations: z.boolean().default(false)
      }).optional()
    }))
    .query(async ({ input }) => {
      try {
        const { countryStats, economyData, historicalData = [], options = {} } = input;
        
        const analysis = await analyzeCountryEconomics(
          countryStats as unknown as CountryStats,
          economyData as any, 
          historicalData as HistoricalDataPoint[],
          options
        );
        
        return analysis;
      } catch (error) {
        console.error('Comprehensive economic analysis failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Economic analysis failed: ${(error as Error).message || 'Unknown error'}`
        });
      }
    }),

  /**
   * Get quick economic health check for dashboard use
   */
  getQuickHealthCheck: publicProcedure
    .input(z.object({
      countryStats: countryStatsSchema,
      economyData: economyDataSchema
    }))
    .query(async ({ input }) => {
      try {
        const { countryStats, economyData } = input;
        
        const healthCheck = getQuickEconomicHealth(
          countryStats as unknown as CountryStats,
          economyData as any
        );
        
        return healthCheck;
      } catch (error) {
        console.error('Quick health check failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Health check failed: ${(error as Error).message || 'Unknown error'}`
        });
      }
    }),

  /**
   * Get economic metrics for builder components
   */
  getBuilderMetrics: publicProcedure
    .input(z.object({
      countryStats: countryStatsSchema,
      economyData: economyDataSchema
    }))
    .query(async ({ input }) => {
      try {
        const { countryStats, economyData } = input;
        
        const metrics = getBuilderEconomicMetrics(
          countryStats as unknown as CountryStats,
          economyData as any
        );
        
        return metrics;
      } catch (error) {
        console.error('Builder metrics failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Builder metrics failed: ${(error as Error).message || 'Unknown error'}`
        });
      }
    }),

  /**
   * Get intelligence economic data for MyCountry components
   */
  getIntelligenceData: publicProcedure
    .input(z.object({
      countryStats: countryStatsSchema,
      economyData: economyDataSchema
    }))
    .query(async ({ input }) => {
      try {
        const { countryStats, economyData } = input;
        
        const intelligenceData = getIntelligenceEconomicData(
          countryStats as unknown as CountryStats,
          economyData as any
        );
        
        return intelligenceData;
      } catch (error) {
        console.error('Intelligence data failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Intelligence data failed: ${(error as Error).message || 'Unknown error'}`
        });
      }
    }),

  /**
   * Get economic analysis for a specific country by ID
   */
  getCountryEconomicAnalysis: publicProcedure
    .input(z.object({
      countryId: z.string(),
      analysisType: z.enum(['comprehensive', 'health', 'builder', 'intelligence']).default('comprehensive')
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { countryId, analysisType } = input;
        
        // Get country data from database
        const country = await ctx.db.country.findUnique({
          where: { id: countryId },
          include: {
            historicalData: {
              orderBy: { createdAt: 'desc' },
              take: 20
            }
          }
        });
        
        if (!country) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Country not found'
          });
        }

        // Convert to required format
        const countryStats: CountryStats = {
          countryId: country.id,
          name: country.name,
          currentTotalGdp: (country as any).totalGdp || country.currentTotalGdp || 0,
          currentGdpPerCapita: (country as any).gdpPerCapita || country.currentGdpPerCapita || 0,
          currentPopulation: country.currentPopulation || 0,
          adjustedGdpGrowth: (country as any).growthRate || country.adjustedGdpGrowth || 0,
          economicTier: (country.economicTier || 'Developing') as EconomicTier,
          populationTier: (country.populationTier || '2') as PopulationTier,
          populationGrowthRate: country.populationGrowthRate || 0.02
        };

        // Create economy data from country economic data
        const economyData: any = {
          core: {
            nominalGDP: (country as any).totalGdp || (country as any).currentTotalGdp || 0,
            gdpPerCapita: (country as any).gdpPerCapita || country.currentGdpPerCapita,
            realGDPGrowthRate: (country as any).growthRate || country.adjustedGdpGrowth,
            inflationRate: (country as any).economicData?.inflationRate || 0.02
          },
          fiscal: {
            totalDebtGDPRatio: (country as any).economicData?.debtToGdpRatio || 60,
            budgetDeficitSurplus: (country as any).economicData?.budgetBalance || 0,
            taxRevenueGDPPercent: (country as any).economicData?.taxRevenue || 20,
            debtServiceCosts: (country as any).economicData?.debtServiceCosts || (country.currentTotalGdp * 0.03),
            interestRates: (country as any).economicData?.interestRates || 0.03
          },
          labor: {
            unemploymentRate: (country as any).economicData?.unemploymentRate || 6,
            employmentRate: 100 - ((country as any).economicData?.unemploymentRate || 6),
            laborForceParticipationRate: (country as any).economicData?.laborForceParticipation || 65
          },
          income: {
            incomeInequalityGini: (country as any).economicData?.giniCoefficient || 0.35,
            socialMobilityIndex: (country as any).economicData?.socialMobilityIndex || 60,
            economicClasses: [
              { wealthPercent: 40 }, // Top 10%
              { wealthPercent: 30 }, // Middle class
              { wealthPercent: 30 }  // Lower income
            ]
          },
          spending: {
            spendingGDPPercent: (country as any).economicData?.governmentSpending || 35,
            spendingCategories: [
              { category: 'healthcare', percent: 8 },
              { category: 'education', percent: 6 },
              { category: 'infrastructure', percent: 5 },
              { category: 'defense', percent: 4 },
              { category: 'social', percent: 12 }
            ]
          },
          demographics: {
            lifeExpectancy: (country as any).economicData?.lifeExpectancy || 75,
            literacyRate: (country as any).economicData?.literacyRate || 95,
            regions: [
              { name: 'National Average' }
            ]
          }
        };

        const historicalData: HistoricalDataPoint[] = (country as any).historicalData.map((h: any) => ({
          gdpGrowthRate: h.gdpGrowthRate,
          timestamp: h.timestamp.toISOString()
        }));

        // Return appropriate analysis based on type
        switch (analysisType) {
          case 'health':
            return getQuickEconomicHealth(countryStats, economyData);
          
          case 'builder':
            return getBuilderEconomicMetrics(countryStats, economyData);
          
          case 'intelligence':
            return getIntelligenceEconomicData(countryStats, economyData);
          
          default:
            return await analyzeCountryEconomics(countryStats, economyData, historicalData);
        }
        
      } catch (error) {
        console.error('Country economic analysis failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Country analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  /**
   * Get economic comparison between countries
   */
  compareCountries: publicProcedure
    .input(z.object({
      countryIds: z.array(z.string()).min(2).max(5),
      metrics: z.array(z.enum(['resilience', 'productivity', 'wellbeing', 'complexity', 'overall'])).default(['overall'])
    }))
    .query(async ({ ctx, input }): Promise<{ countryId: string; analysis: any }[]> => {
      try {
        const { countryIds, metrics } = input;
        
        const comparisons: { countryId: string; analysis: any }[] = [];
        
        for (const countryId of countryIds) {
          // Get individual country analysis (reusing the logic above)
          const analysis = await enhancedEconomicsRouter
            .createCaller(ctx as any)
            .getCountryEconomicAnalysis({ countryId, analysisType: 'comprehensive' });
          
          comparisons.push({
            countryId,
            analysis: analysis as any // Type assertion needed for complex return type
          });
        }
        
        // Create comparison structure
        const comparison: { countries: { countryId: string; analysis: any }[]; rankings: any[] } = {
          countries: comparisons,
          rankings: metrics.map(metric => ({
            metric,
            ranking: comparisons
              .map((c, index) => ({
                countryId: c.countryId,
                score: metric === 'overall' ? 
                  c.analysis.comprehensive.overallRating.score :
                  c.analysis.comprehensive[metric]?.overallScore || 0,
                rank: index + 1
              }))
              .sort((a, b) => b.score - a.score)
              .map((item, index) => ({ ...item, rank: index + 1 }))
          }))
        };
        
        return comparison.countries;
      } catch (error) {
        console.error('Country comparison failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Country comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    })
});

export type EnhancedEconomicsRouter = typeof enhancedEconomicsRouter;