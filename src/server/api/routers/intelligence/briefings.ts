import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  premiumProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { calculateIntelligence } from "~/lib/intelligence/calculator";

export const intelligenceBriefingRouter = createTRPCRouter({
  getForCountry: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.intelligenceBriefing.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        include: {
          recommendations: {
            where: { isActive: true },
            orderBy: { urgency: "asc" },
          },
          alerts: {
            where: { isActive: true },
            orderBy: { severity: "desc" },
          },
        },
        orderBy: [{ priority: "desc" }, { generatedAt: "desc" }],
      });
    }),

  getVitalitySnapshots: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.vitalitySnapshot.findMany({
        where: {
          countryId: input.countryId,
        },
        orderBy: { calculatedAt: "desc" },
        take: 4,
      });
    }),

  getRecommendations: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.intelligenceRecommendation.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
          isImplemented: false,
        },
        orderBy: [{ urgency: "asc" }, { successProbability: "desc" }],
      });
    }),

  implementRecommendation: premiumProcedure
    .input(z.object({ recommendationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.intelligenceRecommendation.update({
        where: { id: input.recommendationId },
        data: {
          isImplemented: true,
          implementedAt: new Date(),
        },
      });
    }),

  recalculateForCountry: premiumProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx: _ctx, input }) => {
      await calculateIntelligence({ countryId: input.countryId, forceRecalculate: true });
      return { success: true, message: `Intelligence recalculated for country ${input.countryId}` };
    }),

  recalculateAll: adminProcedure.mutation(async () => {
    await calculateIntelligence({ forceRecalculate: true });
    return { success: true, message: "Intelligence recalculated for all countries" };
  }),

  getGlobalSummary: publicProcedure.query(async ({ ctx }) => {
    const activeCrises = await ctx.db.crisisEvent.count({
      where: { responseStatus: { not: "resolved" } },
    });

    const criticalCrises = await ctx.db.crisisEvent.count({
      where: {
        responseStatus: { not: "resolved" },
        severity: "critical",
      },
    });

    const diplomaticMissions = await ctx.db.diplomaticEvent.count({
      where: {
        status: "active",
        eventType: { in: ["summit", "trade_mission", "state_visit"] },
      },
    });

    const recentIntelligence = await ctx.db.intelligenceItem.count({
      where: {
        isActive: true,
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    const intelligenceAlerts = await ctx.db.intelligenceItem.count({
      where: {
        isActive: true,
        priority: { in: ["HIGH", "CRITICAL"] },
      },
    });

    return {
      activeCrises,
      criticalCrises,
      diplomaticMissions,
      recentIntelligence,
      intelligenceAlerts,
      timestamp: new Date(),
    };
  }),
});
