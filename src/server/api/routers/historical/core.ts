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
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const historicalCoreRouter = createTRPCRouter({
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

      const avgGdpGrowth = gdpGrowthRates.reduce((a, b) => a + b, 0) / gdpGrowthRates.length;
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
