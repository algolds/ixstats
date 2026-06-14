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

export const historicalProjectionsRouter = createTRPCRouter({
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
});
