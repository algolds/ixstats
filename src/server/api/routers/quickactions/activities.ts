// src/server/api/routers/quickactions.ts
// Comprehensive Quick Actions tRPC router with government integration, IxTime sync, and economic system integration

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { notificationHooks } from "~/lib/notification-hooks";

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
// INPUT VALIDATION SCHEMAS
// ============================================================================

// Base schema for government officials
const governmentOfficialBaseSchema = z.object({
  governmentStructureId: z.string().optional(),
  departmentId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  title: z.string().min(1, "Title is required"),
  role: z.enum(["Cabinet Member", "Department Head", "Advisor", "Staff", "External Consultant"]),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  appointedDate: z.date().optional(),
  termEndDate: z.date().optional().nullable(),
  responsibilities: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(100).default(50),
  isActive: z.boolean().default(true),
});

// Create schema - all required fields with defaults
// eslint-disable-next-line unused-imports/no-unused-vars
const governmentOfficialCreateSchema = governmentOfficialBaseSchema;

// Update schema - all fields optional
// eslint-disable-next-line unused-imports/no-unused-vars
const governmentOfficialUpdateSchema = governmentOfficialBaseSchema.partial();

// eslint-disable-next-line unused-imports/no-unused-vars
const meetingInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  scheduledDate: z.date(),
  scheduledIxTime: z.number().optional(), // Optional IxTime override (if provided, scheduledDate is treated as IxTime)
  duration: z.number().int().min(15).max(480).default(60),
  attendeeIds: z.array(z.string()).default([]),
  customAttendees: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  agendaItems: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        duration: z.number().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        presenter: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

// Base schema for policies
const policyBaseSchema = z.object({
  name: z.string().min(1, "Policy name is required"),
  description: z.string().min(10, "Description is required (min 10 characters)"),
  policyType: z.enum(["economic", "social", "diplomatic", "infrastructure", "governance"]),
  category: z.string().min(1, "Category is required"),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  objectives: z.array(z.string()).optional().default([]),
  targetMetrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  implementationCost: z.number().min(0).default(0),
  maintenanceCost: z.number().min(0).default(0),
  estimatedBenefit: z.string().optional().nullable(),
  effectiveDate: z.date().optional().nullable(),
  expiryDate: z.date().optional().nullable(),
  // Economic effects
  gdpEffect: z.number().default(0),
  employmentEffect: z.number().default(0),
  inflationEffect: z.number().default(0),
  taxRevenueEffect: z.number().default(0),
  customEffects: z.record(z.string(), z.number()).optional(),
  approvalRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// Create schema - all required fields with defaults
// eslint-disable-next-line unused-imports/no-unused-vars
const policyCreateSchema = policyBaseSchema;

// Update schema - all fields optional
// eslint-disable-next-line unused-imports/no-unused-vars
const policyUpdateSchema = policyBaseSchema.partial();

const activityScheduleInputSchema = z.object({
  activityType: z.enum([
    "meeting",
    "policy_review",
    "economic_review",
    "diplomatic_event",
    "custom",
  ]),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  scheduledDate: z.date(),
  duration: z.number().int().min(15).optional().nullable(),
  priority: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  relatedIds: z.record(z.string(), z.string()).optional(),
  recurrence: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
      interval: z.number().int().min(1),
      endDate: z.date().optional(),
    })
    .optional()
    .nullable(),
});

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
   * Create activity schedule entry
   */
  createActivity: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string(),
        activity: activityScheduleInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scheduledIxTime = IxTime.convertToIxTime(input.activity.scheduledDate.getTime());

      const activity = await ctx.db.activitySchedule.create({
        data: {
          countryId: input.countryId,
          userId: input.userId,
          activityType: input.activity.activityType,
          title: input.activity.title,
          description: input.activity.description ?? null,
          scheduledDate: input.activity.scheduledDate,
          scheduledIxTime,
          duration: input.activity.duration ?? null,
          priority: input.activity.priority,
          category: input.activity.category ?? null,
          tags: input.activity.tags.length > 0 ? JSON.stringify(input.activity.tags) : null,
          relatedIds: input.activity.relatedIds ? JSON.stringify(input.activity.relatedIds) : null,
          recurrence: input.activity.recurrence ? JSON.stringify(input.activity.recurrence) : null,
          status: "scheduled",
        },
      });

      // Notify about activity scheduled
      try {
        // eslint-disable-next-line unused-imports/no-unused-vars
        const isUrgent = input.activity.priority === "urgent";
        await notificationHooks.onQuickActionComplete({
          userId: input.userId,
          countryId: input.countryId,
          actionType: "activity",
          actionName: input.activity.title,
          status: "scheduled",
          impactSummary: `${input.activity.activityType} scheduled for ${input.activity.scheduledDate.toLocaleDateString()}`,
          href: "/mycountry/quickactions",
        });
      } catch (error) {
        console.error("[QuickActions] Failed to send activity scheduled notification:", error);
      }

      return { activity, success: true };
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
