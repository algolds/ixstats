// src/server/api/routers/policies.ts
// Policy management and tracking system

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const policiesEffectsRouter = createTRPCRouter({
  // ==================== POLICY CRUD ====================

  // ==================== POLICY EFFECT LOGS ====================

  logPolicyEffect: protectedProcedure
    .input(
      z.object({
        policyId: z.string(),
        metricName: z.string(),
        previousValue: z.number(),
        newValue: z.number(),
        changePercentage: z.number(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.policyEffectLog.create({
        data: {
          policyId: input.policyId,
          appliedIxTime: Date.now() / 1000, // Convert to seconds
          effectType: "periodic",
          actualEffect: JSON.stringify({
            metricName: input.metricName,
            previousValue: input.previousValue,
            newValue: input.newValue,
            changePercentage: input.changePercentage,
          }),
          notes: input.notes,
        },
      });
    }),

  getPolicyEffects: publicProcedure
    .input(
      z.object({
        policyId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.policyEffectLog.findMany({
        where: { policyId: input.policyId },
        orderBy: { appliedAt: "desc" },
        take: input.limit,
      });
    }),

  getPolicyEffectiveness: publicProcedure
    .input(
      z.object({
        policyId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.findUnique({
        where: { id: input.policyId },
        include: {
          policyEffectLog: {
            orderBy: { appliedAt: "desc" },
          },
        },
      });

      if (!policy) {
        throw new Error("Policy not found");
      }

      // Parse effect logs to calculate effectiveness
      const effectLogs = policy.policyEffectLog.map((log) => {
        try {
          return JSON.parse(log.actualEffect || "{}");
        } catch {
          return {};
        }
      });

      // Calculate effectiveness metrics
      const totalEffects = effectLogs.length;
      const positiveEffects = effectLogs.filter((e: any) => (e.changePercentage || 0) > 0).length;
      const negativeEffects = effectLogs.filter((e: any) => (e.changePercentage || 0) < 0).length;

      const averageChange =
        effectLogs.length > 0
          ? effectLogs.reduce((sum: number, e: any) => sum + (e.changePercentage || 0), 0) /
            effectLogs.length
          : 0;

      const recentEffects = effectLogs.slice(0, 10);
      const recentAverageChange =
        recentEffects.length > 0
          ? recentEffects.reduce((sum: number, e: any) => sum + (e.changePercentage || 0), 0) /
            recentEffects.length
          : 0;

      // Parse targetMetrics if it exists
      const targetMetrics = policy.targetMetrics ? JSON.parse(policy.targetMetrics) : null;
      const targetMet = targetMetrics
        ? recentEffects.some(
            (e: any) => targetMetrics[e.metricName] && e.newValue >= targetMetrics[e.metricName]
          )
        : null;

      return {
        policy,
        effectiveness: {
          totalEffects,
          positiveEffects,
          negativeEffects,
          averageChange,
          recentAverageChange,
          targetMet,
          trend:
            recentAverageChange > averageChange
              ? "improving"
              : recentAverageChange < averageChange
                ? "declining"
                : "stable",
        },
      };
    }),

  // ==================== ACTIVITY SCHEDULES ====================

  // ==================== QUICK ACTION TEMPLATES ====================

  // ==================== ENHANCED POLICY INTEGRATION ====================

  // Save policy selections from builder

  // Calculate real-time policy effects

  // Get policies by selected atomic components

  // Recalculate all policy effects
});

// Helper function to calculate real-time policy effects
async function calculateRealTimePolicyEffects(policy: any, countryId: string, db: any) {
  // Get current country data
  const country = await db.country.findUnique({
    where: { id: countryId },
  });

  if (!country) {
    return {};
  }

  // Calculate effects based on current country metrics
  const effects = {
    gdpMultiplier: 1 + policy.gdpEffect / 100,
    employmentMultiplier: 1 + policy.employmentEffect / 100,
    inflationMultiplier: 1 + policy.inflationEffect / 100,
    taxRevenueMultiplier: 1 + policy.taxRevenueEffect / 100,
    calculatedAt: new Date().toISOString(),
    baseValues: {
      currentGdp: country.currentTotalGdp,
      currentPopulation: country.currentPopulation,
      currentTaxRevenue: country.taxRevenueGDPPercent,
    },
  };

  return effects;
}
