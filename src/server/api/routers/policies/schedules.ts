// src/server/api/routers/policies.ts
// Policy management and tracking system

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const policiesSchedulesRouter = createTRPCRouter({
  // ==================== POLICY CRUD ====================

  // ==================== POLICY EFFECT LOGS ====================

  // ==================== ACTIVITY SCHEDULES ====================

  scheduleActivity: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        policyId: z.string().optional(),
        activityType: z.enum(["meeting", "review", "implementation", "assessment", "other"]),
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        scheduledDate: z.date(),
        duration: z.number().optional(),
        participants: z.string().optional(),
        location: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get userId from context - use clerk user id
      const userId = ctx.user?.clerkUserId;
      if (!userId) {
        throw new Error("Not authenticated");
      }

      return await ctx.db.activitySchedule.create({
        data: {
          countryId: input.countryId,
          userId: userId,
          activityType: input.activityType,
          title: input.title,
          description: input.description,
          scheduledDate: input.scheduledDate,
          duration: input.duration,
          status: "scheduled",
          relatedIds: input.policyId ? JSON.stringify({ policyId: input.policyId }) : undefined,
          tags: input.participants ? JSON.stringify([input.participants]) : undefined,
          category: input.location,
        },
      });
    }),

  getScheduledActivities: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        policyId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { countryId: input.countryId };
      if (input.status) where.status = input.status;
      if (input.startDate || input.endDate) {
        where.scheduledDate = {};
        if (input.startDate) where.scheduledDate.gte = input.startDate;
        if (input.endDate) where.scheduledDate.lte = input.endDate;
      }

      const activities = await ctx.db.activitySchedule.findMany({
        where,
        orderBy: { scheduledDate: "asc" },
      });

      if (!input.policyId) {
        return activities;
      }

      return activities.filter((activity) => {
        if (!activity.relatedIds) return false;
        try {
          const related = JSON.parse(activity.relatedIds) as { policyId?: string };
          return related?.policyId === input.policyId;
        } catch (error) {
          console.warn("[Policies] Failed to parse relatedIds for activity", activity.id, error);
          return false;
        }
      });
    }),

  updateActivity: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        scheduledDate: z.date().optional(),
        duration: z.number().optional(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
        participants: z.string().optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return await ctx.db.activitySchedule.update({
        where: { id },
        data,
      });
    }),

  deleteActivity: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.activitySchedule.delete({
        where: { id: input.id },
      });
    }),

  // ==================== QUICK ACTION TEMPLATES ====================

  // ==================== ENHANCED POLICY INTEGRATION ====================

  // Save policy selections from builder

  // Calculate real-time policy effects

  // Get policies by selected atomic components

  // Recalculate all policy effects
});

// Helper function to calculate real-time policy effects
// eslint-disable-next-line unused-imports/no-unused-vars
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
