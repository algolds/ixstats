/**
 * Crisis Events API Router
 *
 * Manages crisis events including natural disasters, economic crises, diplomatic incidents,
 * security threats, and other significant events that affect countries.
 *
 * Features:
 * - Active crisis event listing
 * - Crisis statistics
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { parseAffectedCountries } from "~/lib/maps/crisis-affected-countries";

export const crisisEventsRouter = createTRPCRouter({
  /**
   * Get active/ongoing crisis events
   */
  getActive: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const activeEvents = await ctx.db.crisisEvent.findMany({
        where: {
          responseStatus: {
            in: ["pending", "in_progress", "monitoring"],
          },
        },
        orderBy: [{ severity: "desc" }, { timestamp: "desc" }],
        take: input.limit,
      });

      return activeEvents;
    }),

  /**
   * Get crisis event statistics, world-wide or (with `countryId`) only for crises that list
   * that country among their affected countries.
   */
  getStatistics: publicProcedure
    .input(
      z.object({
        timeframe: z.enum(["week", "month", "quarter", "year", "all"]).default("month"),
        countryId: z.string().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Calculate date threshold based on timeframe
      const now = new Date();
      let dateThreshold = new Date(0); // Default: all time

      switch (input.timeframe) {
        case "week":
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "quarter":
          dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "year":
          dateThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      const rows = await db.crisisEvent.findMany({
        where: {
          ...(input.timeframe !== "all" ? { timestamp: { gte: dateThreshold } } : {}),
          // `affectedCountries` is a string (JSON array or legacy comma list), so the database can
          // only narrow by substring; the exact-id check below drops "c10" matching "c1".
          ...(input.countryId ? { affectedCountries: { contains: input.countryId } } : {}),
        },
      });
      const { countryId } = input;
      const events = countryId
        ? rows.filter((e) => parseAffectedCountries(e.affectedCountries).includes(countryId))
        : rows;

      // Calculate statistics
      const totalEvents = events.length;
      const criticalEvents = events.filter((e) => e.severity === "critical").length;
      const highSeverityEvents = events.filter((e) => e.severity === "high").length;
      const activeEvents = events.filter((e) =>
        ["pending", "in_progress", "monitoring"].includes(e.responseStatus || "")
      ).length;
      const resolvedEvents = events.filter((e) => e.responseStatus === "resolved").length;
      const totalCasualties = events.reduce((sum, e) => sum + (e.casualties || 0), 0);
      const totalEconomicImpact = events.reduce((sum, e) => sum + (e.economicImpact || 0), 0);

      // Events by type
      const eventsByType: Record<string, number> = {};
      events.forEach((e) => {
        eventsByType[e.type] = (eventsByType[e.type] || 0) + 1;
      });

      // Events by category
      const eventsByCategory: Record<string, number> = {};
      events.forEach((e) => {
        eventsByCategory[e.category] = (eventsByCategory[e.category] || 0) + 1;
      });

      return {
        totalEvents,
        criticalEvents,
        highSeverityEvents,
        activeEvents,
        resolvedEvents,
        totalCasualties,
        totalEconomicImpact,
        eventsByType,
        eventsByCategory,
        timeframe: input.timeframe,
      };
    }),
});
