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

export const historicalDiplomaticRouter = createTRPCRouter({
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
          targetCountry: h.country1Id === input.countryId ? h.country2Id : h.country1Id,
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
          targetCountry: h.country1Id === input.countryId ? h.country2Id : h.country1Id,
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
        const targetCountry = rel.country1Id === input.countryId ? rel.country2Id : rel.country1Id;
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
        const dataPoint = historicalData.find((h) => h.ixTimeTimestamp >= change.timestamp);

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
});
