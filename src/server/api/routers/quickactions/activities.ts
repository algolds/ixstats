// src/server/api/routers/quickactions.ts
// Comprehensive Quick Actions tRPC router with government integration, IxTime sync, and economic system integration

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * QUICK ACTIONS ROUTER
 *
 * Integrated system for managing:
 * - Cabinet meetings with government official sync
 * - Policy creation with economic effect tracking
 * - Activity scheduling with IxTime integration
 * - Government officials management
 * - Meeting agendas with tagging and categorization
 */

// ============================================================================
// ROUTER DEFINITION
// ============================================================================

export const quickActionsActivitiesRouter = createTRPCRouter({
  // ==========================================================================
  // GOVERNMENT OFFICIALS
  // ==========================================================================

  // ==========================================================================
  // CABINET MEETINGS
  // ==========================================================================

  // ==========================================================================
  // POLICIES
  // ==========================================================================

  // ==========================================================================
  // ACTIVITY SCHEDULE
  // ==========================================================================

  /**
   * Get activity schedule (planner view)
   */
  getActivitySchedule: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string().optional(),
        fromDate: z.date(),
        toDate: z.date(),
        activityType: z
          .enum(["meeting", "policy_review", "economic_review", "diplomatic_event", "custom"])
          .optional(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const activities = await ctx.db.activitySchedule.findMany({
        where: {
          countryId: input.countryId,
          ...(input.userId && { userId: input.userId }),
          ...(input.activityType && { activityType: input.activityType }),
          ...(input.status && { status: input.status }),
          scheduledDate: {
            gte: input.fromDate,
            lte: input.toDate,
          },
        },
        orderBy: { scheduledDate: "asc" },
      });

      return activities.map((activity) => ({
        ...activity,
        tags: activity.tags ? JSON.parse(activity.tags) : [],
        relatedIds: activity.relatedIds ? JSON.parse(activity.relatedIds) : null,
        recurrence: activity.recurrence ? JSON.parse(activity.recurrence) : null,
        reminderSettings: activity.reminderSettings ? JSON.parse(activity.reminderSettings) : null,
      }));
    }),

  /**
   * Get upcoming activities (next 7 days)
   */
  getUpcomingActivities: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string().optional(),
        days: z.number().int().min(1).max(30).default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + input.days);

      const activities = await ctx.db.activitySchedule.findMany({
        where: {
          countryId: input.countryId,
          ...(input.userId && { userId: input.userId }),
          status: { in: ["scheduled", "in_progress"] },
          scheduledDate: {
            gte: now,
            lte: future,
          },
        },
        orderBy: { scheduledDate: "asc" },
      });

      return activities.map((activity) => ({
        ...activity,
        tags: activity.tags ? JSON.parse(activity.tags) : [],
        relatedIds: activity.relatedIds ? JSON.parse(activity.relatedIds) : null,
      }));
    }),

  // ==========================================================================
  // AGGREGATE VIEWS
  // ==========================================================================

  /**
   * Get dashboard overview (meetings, policies, activities)
   */
  getDashboardOverview: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);

      // Get upcoming meetings
      const upcomingMeetings = await ctx.db.cabinetMeeting.findMany({
        where: {
          countryId: input.countryId,
          status: "scheduled",
          scheduledDate: {
            gte: now,
            lte: weekFromNow,
          },
        },
        include: {
          attendances: {
            include: {
              official: {
                select: {
                  name: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: { scheduledDate: "asc" },
        take: 5,
      });

      // Get active policies
      const activePolicies = await ctx.db.policy.findMany({
        where: {
          countryId: input.countryId,
          status: "active",
        },
        orderBy: { effectiveDate: "desc" },
        take: 5,
      });

      // Get upcoming activities
      const upcomingActivities = await ctx.db.activitySchedule.findMany({
        where: {
          countryId: input.countryId,
          status: { in: ["scheduled", "in_progress"] },
          scheduledDate: {
            gte: now,
            lte: weekFromNow,
          },
        },
        orderBy: { scheduledDate: "asc" },
        take: 10,
      });

      // Get government officials count
      const govStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        include: {
          _count: {
            select: { officials: true },
          },
        },
      });

      return {
        upcomingMeetings,
        activePolicies,
        upcomingActivities: upcomingActivities.map((a) => ({
          ...a,
          tags: a.tags ? JSON.parse(a.tags) : [],
        })),
        officialsCount: govStructure?._count.officials ?? 0,
        stats: {
          totalMeetingsThisWeek: upcomingMeetings.length,
          activePoliciesCount: activePolicies.length,
          upcomingActivitiesCount: upcomingActivities.length,
        },
      };
    }),

  // ==========================================================================
  // MEETING DECISIONS & ACTION ITEMS
  // ==========================================================================

  /**
   * Get decisions and action items for a meeting
   */
  getMeetingOutcomes: publicProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [decisions, actionItems] = await Promise.all([
        ctx.db.meetingDecision.findMany({
          where: { meetingId: input.meetingId },
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.meetingActionItem.findMany({
          where: { meetingId: input.meetingId },
          orderBy: { priority: "desc" },
        }),
      ]);

      return {
        decisions: decisions.map((d) => ({
          ...d,
          votingResult: d.votingResult ? JSON.parse(d.votingResult) : null,
          relatedMetrics: d.relatedMetrics ? JSON.parse(d.relatedMetrics) : null,
          decisionMakers: d.decisionMakers ? JSON.parse(d.decisionMakers) : null,
        })),
        actionItems: actionItems.map((a) => ({
          ...a,
          tags: a.tags ? JSON.parse(a.tags) : [],
        })),
      };
    }),

  // ==========================================================================
  // INTELLIGENT POLICY RECOMMENDATIONS
  // ==========================================================================
});
