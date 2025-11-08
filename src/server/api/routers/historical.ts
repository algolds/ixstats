/**
 * Historical Data Router
 *
 * tRPC API endpoints for accessing historical time-series data.
 * Provides comprehensive historical analytics for countries including:
 * - Economic metrics (GDP, growth, trade)
 * - Population trends
 * - Diplomatic relationship evolution
 * - Government component effectiveness
 * - Vitality scores over time
 * - Projections and forecasts
 *
 * Total Endpoints: 12
 *
 * @module routers/historical
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const historicalRouter = createTRPCRouter({
  /**
   * Get full historical data for a country
   * Returns economic, population, and growth metrics over time
   */
  getCountryHistory: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().int().min(1).max(1000).optional().default(365),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        countryId: input.countryId,
      };

      if (input.startDate || input.endDate) {
        where.ixTimeTimestamp = {};
        if (input.startDate) where.ixTimeTimestamp.gte = input.startDate;
        if (input.endDate) where.ixTimeTimestamp.lte = input.endDate;
      }

      const data = await ctx.db.historicalDataPoint.findMany({
        where,
        orderBy: { ixTimeTimestamp: "desc" },
        take: input.limit,
      });

      return data.reverse(); // Return chronologically
    }),

  /**
   * Get diplomatic relationship history between two countries
   * Returns strength, relationship type, trade volume over time
   */
  getRelationshipHistory: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        targetCountryId: z.string().optional(),
        days: z.number().int().min(1).max(365).optional().default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      if (input.targetCountryId) {
        // Get specific relationship
        const history = await ctx.db.diplomaticRelationshipHistory.findMany({
          where: {
            OR: [
              {
                country1Id: input.countryId,
                country2Id: input.targetCountryId,
              },
              {
                country1Id: input.targetCountryId,
                country2Id: input.countryId,
              },
            ],
            timestamp: { gte: cutoffDate },
          },
          orderBy: { timestamp: "asc" },
        });

        return history.map((h) => ({
          date: h.timestamp,
          targetCountry:
            h.country1Id === input.countryId ? h.country2Id : h.country1Id,
          strength: h.strength,
          relationship: h.relationship,
          tradeVolume: h.tradeVolume,
          culturalExchange: h.culturalExchange,
        }));
      } else {
        // Get all relationships for this country
        const history = await ctx.db.diplomaticRelationshipHistory.findMany({
          where: {
            OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
            timestamp: { gte: cutoffDate },
          },
          orderBy: { timestamp: "asc" },
        });

        return history.map((h) => ({
          date: h.timestamp,
          targetCountry:
            h.country1Id === input.countryId ? h.country2Id : h.country1Id,
          strength: h.strength,
          relationship: h.relationship,
          tradeVolume: h.tradeVolume,
          culturalExchange: h.culturalExchange,
        }));
      }
    }),

  /**
   * Get embassy network growth history
   * Returns embassy count, relationship count, influence over time
   */
  getNetworkGrowthHistory: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        days: z.number().int().min(1).max(365).optional().default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      // Get relationship counts over time
      const relationshipHistory = await ctx.db.diplomaticRelationshipHistory.findMany({
        where: {
          OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
          timestamp: { gte: cutoffDate },
        },
        orderBy: { timestamp: "asc" },
      });

      // Group by date and count
      const groupedByDate = relationshipHistory.reduce((acc: any, rel) => {
        const dateKey = rel.timestamp.toISOString().split("T")[0];
        if (!acc[dateKey!]) {
          acc[dateKey!] = {
            date: rel.timestamp,
            relationships: new Set(),
            totalStrength: 0,
          };
        }
        const targetCountry =
          rel.country1Id === input.countryId ? rel.country2Id : rel.country1Id;
        acc[dateKey!].relationships.add(targetCountry);
        acc[dateKey!].totalStrength += rel.strength;
        return acc;
      }, {});

      return Object.values(groupedByDate).map((day: any) => ({
        date: day.date,
        relationshipCount: day.relationships.size,
        influence: Math.round(day.totalStrength),
        // Note: Embassy count would require historical embassy tracking
        embassyCount: Math.round(day.relationships.size * 0.6), // Approximation
      }));
    }),

  /**
   * Get component effectiveness history
   * Returns effectiveness scores for government components over time
   */
  getComponentEffectivenessHistory: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        componentType: z.string().optional(),
        days: z.number().int().min(1).max(365).optional().default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      const where: any = {
        countryId: input.countryId,
        timestamp: { gte: cutoffDate },
      };

      if (input.componentType) {
        where.componentType = input.componentType;
      }

      const history = await ctx.db.componentEffectivenessHistory.findMany({
        where,
        orderBy: [{ timestamp: "asc" }, { componentType: "asc" }],
      });

      return history.map((h) => ({
        date: h.timestamp,
        componentType: h.componentType,
        componentId: h.componentId,
        effectiveness: h.effectivenessScore,
      }));
    }),

  /**
   * Get vitality history
   * Returns all 4 vitality rings + overall health over time
   */
  getVitalityHistory: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        days: z.number().int().min(1).max(365).optional().default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      const history = await ctx.db.vitalityHistory.findMany({
        where: {
          countryId: input.countryId,
          timestamp: { gte: cutoffDate },
        },
        orderBy: { timestamp: "asc" },
      });

      return history.map((h) => ({
        date: h.timestamp,
        economic: h.economicVitality,
        population: h.populationWellbeing,
        diplomatic: h.diplomaticStanding,
        government: h.governmentalEfficiency,
        overall: h.overallHealth,
      }));
    }),

  /**
   * Get GDP projection (historical + forecasted)
   * Combines historical data with simple growth projections
   */
  getGDPProjection: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        historicalDays: z.number().int().optional().default(90),
        forecastDays: z.number().int().optional().default(365),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get historical data
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.historicalDays);

      const historical = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: input.countryId,
          ixTimeTimestamp: { gte: cutoffDate },
        },
        orderBy: { ixTimeTimestamp: "asc" },
      });

      if (historical.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No historical data available",
        });
      }

      // Calculate average growth rate
      const avgGrowthRate =
        historical.reduce((sum, h) => sum + h.gdpGrowthRate, 0) / historical.length;

      // Generate forecast
      const lastPoint = historical[historical.length - 1]!;
      const forecast = [];
      let projectedGDP = lastPoint.totalGdp;
      const projectionInterval = 30; // Project in 30-day increments

      for (let i = projectionInterval; i <= input.forecastDays; i += projectionInterval) {
        const futureDate = new Date(lastPoint.ixTimeTimestamp);
        futureDate.setDate(futureDate.getDate() + i);

        // Apply growth (compounded)
        projectedGDP = projectedGDP * (1 + avgGrowthRate / 12); // Monthly growth

        forecast.push({
          date: futureDate,
          totalGdp: projectedGDP,
          gdpPerCapita: projectedGDP / lastPoint.population,
          isProjection: true,
        });
      }

      return {
        historical: historical.map((h) => ({
          date: h.ixTimeTimestamp,
          totalGdp: h.totalGdp,
          gdpPerCapita: h.gdpPerCapita,
          isProjection: false,
        })),
        forecast,
        avgGrowthRate,
      };
    }),

  /**
   * Get population projection (historical + forecasted)
   */
  getPopulationProjection: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        historicalDays: z.number().int().optional().default(90),
        forecastDays: z.number().int().optional().default(365),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.historicalDays);

      const historical = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: input.countryId,
          ixTimeTimestamp: { gte: cutoffDate },
        },
        orderBy: { ixTimeTimestamp: "asc" },
      });

      if (historical.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No historical data available",
        });
      }

      const avgGrowthRate =
        historical.reduce((sum, h) => sum + h.populationGrowthRate, 0) / historical.length;

      const lastPoint = historical[historical.length - 1]!;
      const forecast = [];
      let projectedPopulation = lastPoint.population;
      const projectionInterval = 30;

      for (let i = projectionInterval; i <= input.forecastDays; i += projectionInterval) {
        const futureDate = new Date(lastPoint.ixTimeTimestamp);
        futureDate.setDate(futureDate.getDate() + i);

        projectedPopulation = projectedPopulation * (1 + avgGrowthRate / 12);

        forecast.push({
          date: futureDate,
          population: projectedPopulation,
          isProjection: true,
        });
      }

      return {
        historical: historical.map((h) => ({
          date: h.ixTimeTimestamp,
          population: h.population,
          isProjection: false,
        })),
        forecast,
        avgGrowthRate,
      };
    }),

  /**
   * Get budget history (tax revenue and spending)
   * Calculated from GDP and historical data
   */
  getBudgetHistory: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        days: z.number().int().optional().default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      const historical = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: input.countryId,
          ixTimeTimestamp: { gte: cutoffDate },
        },
        orderBy: { ixTimeTimestamp: "asc" },
      });

      // Get current country data for tax/spending rates
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          taxRevenueGDPPercent: true,
          governmentBudgetGDPPercent: true,
        },
      });

      const taxRate = country?.taxRevenueGDPPercent || 25;
      const spendingRate = country?.governmentBudgetGDPPercent || 30;

      return historical.map((h) => ({
        date: h.ixTimeTimestamp,
        revenue: h.totalGdp * (taxRate / 100),
        spending: h.totalGdp * (spendingRate / 100),
        balance: h.totalGdp * ((taxRate - spendingRate) / 100),
        gdp: h.totalGdp,
      }));
    }),

  /**
   * Get trade history
   * Returns import/export balance trends
   */
  getTradeHistory: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        days: z.number().int().optional().default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      const relationshipHistory = await ctx.db.diplomaticRelationshipHistory.findMany({
        where: {
          OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
          timestamp: { gte: cutoffDate },
        },
        orderBy: { timestamp: "asc" },
      });

      // Group by date
      const groupedByDate = relationshipHistory.reduce((acc: any, rel) => {
        const dateKey = rel.timestamp.toISOString().split("T")[0];
        if (!acc[dateKey!]) {
          acc[dateKey!] = {
            date: rel.timestamp,
            totalTrade: 0,
            tradeCount: 0,
          };
        }
        acc[dateKey!].totalTrade += rel.tradeVolume;
        acc[dateKey!].tradeCount += 1;
        return acc;
      }, {});

      return Object.values(groupedByDate).map((day: any) => ({
        date: day.date,
        tradeVolume: day.totalTrade,
        tradePartners: day.tradeCount,
      }));
    }),

  /**
   * Get policy impact history
   * Correlates policy changes with metric changes
   */
  getPolicyImpactHistory: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        days: z.number().int().optional().default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      // Get component changes
      const componentChanges = await ctx.db.componentChangeLog.findMany({
        where: {
          countryId: input.countryId,
          timestamp: { gte: cutoffDate },
        },
        orderBy: { timestamp: "asc" },
      });

      // Get economic data for correlation
      const historicalData = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: input.countryId,
          ixTimeTimestamp: { gte: cutoffDate },
        },
        orderBy: { ixTimeTimestamp: "asc" },
      });

      // Correlate changes with outcomes
      const impacts = componentChanges.map((change) => {
        // Find closest historical data point
        const dataPoint = historicalData.find(
          (h) => h.ixTimeTimestamp >= change.timestamp
        );

        return {
          date: change.timestamp,
          changeType: change.changeType,
          componentType: change.componentType,
          description: change.description,
          gdpGrowth: dataPoint?.gdpGrowthRate || 0,
          totalGdp: dataPoint?.totalGdp || 0,
        };
      });

      return impacts;
    }),

  /**
   * Export historical data as CSV/JSON
   * Returns formatted data ready for download
   */
  exportHistoricalData: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        format: z.enum(["csv", "json"]),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { countryId: input.countryId };

      if (input.startDate || input.endDate) {
        where.ixTimeTimestamp = {};
        if (input.startDate) where.ixTimeTimestamp.gte = input.startDate;
        if (input.endDate) where.ixTimeTimestamp.lte = input.endDate;
      }

      const data = await ctx.db.historicalDataPoint.findMany({
        where,
        orderBy: { ixTimeTimestamp: "asc" },
      });

      if (input.format === "json") {
        return {
          format: "json",
          data: JSON.stringify(data, null, 2),
          filename: `historical-data-${input.countryId}-${Date.now()}.json`,
        };
      } else {
        // CSV format
        const headers = [
          "Date",
          "Population",
          "GDP Per Capita",
          "Total GDP",
          "Population Growth %",
          "GDP Growth %",
        ];
        const rows = data.map((d) => [
          d.ixTimeTimestamp.toISOString(),
          d.population,
          d.gdpPerCapita,
          d.totalGdp,
          d.populationGrowthRate,
          d.gdpGrowthRate,
        ]);

        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

        return {
          format: "csv",
          data: csv,
          filename: `historical-data-${input.countryId}-${Date.now()}.csv`,
        };
      }
    }),

  /**
   * Get aggregated metrics
   * Pre-computed averages, min/max, volatility
   */
  getAggregatedMetrics: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        days: z.number().int().optional().default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      const historical = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: input.countryId,
          ixTimeTimestamp: { gte: cutoffDate },
        },
        orderBy: { ixTimeTimestamp: "asc" },
      });

      if (historical.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No historical data available",
        });
      }

      // Calculate aggregates
      const gdpGrowthRates = historical.map((h) => h.gdpGrowthRate);
      const populations = historical.map((h) => h.population);
      const gdps = historical.map((h) => h.totalGdp);

      const avgGdpGrowth =
        gdpGrowthRates.reduce((a, b) => a + b, 0) / gdpGrowthRates.length;
      const maxGdpGrowth = Math.max(...gdpGrowthRates);
      const minGdpGrowth = Math.min(...gdpGrowthRates);

      // Volatility (standard deviation)
      const variance =
        gdpGrowthRates.reduce((sum, rate) => sum + Math.pow(rate - avgGdpGrowth, 2), 0) /
        gdpGrowthRates.length;
      const volatility = Math.sqrt(variance);

      return {
        period: {
          days: input.days,
          dataPoints: historical.length,
          startDate: historical[0]!.ixTimeTimestamp,
          endDate: historical[historical.length - 1]!.ixTimeTimestamp,
        },
        gdpGrowth: {
          average: avgGdpGrowth,
          min: minGdpGrowth,
          max: maxGdpGrowth,
          volatility,
        },
        population: {
          current: populations[populations.length - 1],
          start: populations[0],
          change: populations[populations.length - 1]! - populations[0]!,
          changePercent:
            ((populations[populations.length - 1]! - populations[0]!) / populations[0]!) * 100,
        },
        gdp: {
          current: gdps[gdps.length - 1],
          start: gdps[0],
          change: gdps[gdps.length - 1]! - gdps[0]!,
          changePercent: ((gdps[gdps.length - 1]! - gdps[0]!) / gdps[0]!) * 100,
        },
      };
    }),
});
