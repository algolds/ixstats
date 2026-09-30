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
});
