// src/server/api/routers/quickactions.ts
// Comprehensive Quick Actions tRPC router with government integration, IxTime sync, and economic system integration

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationHooks } from "~/lib/notification-hooks";
import { CountryEventSpine } from "~/lib/country-event-spine";
import { applyPolicyEffect } from "~/lib/policy-effects-sync";

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
const governmentOfficialCreateSchema = governmentOfficialBaseSchema;

// Update schema - all fields optional
const governmentOfficialUpdateSchema = governmentOfficialBaseSchema.partial();

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
const policyCreateSchema = policyBaseSchema;

// Update schema - all fields optional
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

export const quickActionsMeetingsRouter = createTRPCRouter({
  // ==========================================================================
  // GOVERNMENT OFFICIALS
  // ==========================================================================

  // ==========================================================================
  // CABINET MEETINGS
  // ==========================================================================

  /**
   * Get all meetings for a country
   */
  getMeetings: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string().optional(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
        fromDate: z.date().optional(),
        toDate: z.date().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const meetings = await ctx.db.cabinetMeeting.findMany({
        where: {
          countryId: input.countryId,
          ...(input.userId && { userId: input.userId }),
          ...(input.status && { status: input.status }),
          ...(input.fromDate && { scheduledDate: { gte: input.fromDate } }),
          ...(input.toDate && { scheduledDate: { lte: input.toDate } }),
        },
        include: {
          attendances: {
            include: {
              official: {
                select: {
                  id: true,
                  name: true,
                  title: true,
                  role: true,
                },
              },
            },
          },
          agendaItems: {
            orderBy: { order: "asc" },
          },
        },
        orderBy: { scheduledDate: "desc" },
        take: input.limit,
      });

      return meetings.map((meeting) => ({
        ...meeting,
        attendances: meeting.attendances.map((attendance) => ({
          ...attendance,
        })),
        agendaItems: meeting.agendaItems.map((item) => ({
          ...item,
          tags: item.tags ? JSON.parse(item.tags) : [],
          relatedMetrics: item.relatedMetrics ? JSON.parse(item.relatedMetrics) : null,
        })),
      }));
    }),

  /**
   * Create a new cabinet meeting with IxTime sync
   */
  createMeeting: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string(),
        meeting: meetingInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current IxTime
      const currentIxTime = IxTime.getCurrentIxTime();

      // Use provided IxTime if available, otherwise convert from scheduledDate
      // If scheduledIxTime is provided, scheduledDate is already an IxTime date
      const scheduledIxTime =
        input.meeting.scheduledIxTime ??
        IxTime.convertToIxTime(input.meeting.scheduledDate.getTime());

      // Create the meeting
      const meeting = await ctx.db.cabinetMeeting.create({
        data: {
          countryId: input.countryId,
          userId: input.userId,
          title: input.meeting.title,
          description: input.meeting.description ?? null,
          scheduledDate: input.meeting.scheduledDate,
          scheduledIxTime,
          duration: input.meeting.duration,
          status: "scheduled",
        },
      });

      // Add attendances for government officials
      if (input.meeting.attendeeIds.length > 0) {
        await ctx.db.meetingAttendance.createMany({
          data: input.meeting.attendeeIds.map((officialId) => ({
            meetingId: meeting.id,
            officialId,
            attendeeName: "", // Will be filled from official relation
            attendanceStatus: "invited",
          })),
        });
      }

      // Add custom attendees
      if (input.meeting.customAttendees && input.meeting.customAttendees.length > 0) {
        await ctx.db.meetingAttendance.createMany({
          data: input.meeting.customAttendees.map((attendee) => ({
            meetingId: meeting.id,
            attendeeName: attendee.name,
            attendeeRole: attendee.role ?? null,
            attendanceStatus: "invited",
          })),
        });
      }

      // Add agenda items
      if (input.meeting.agendaItems && input.meeting.agendaItems.length > 0) {
        await ctx.db.meetingAgendaItem.createMany({
          data: input.meeting.agendaItems.map((item, index) => ({
            meetingId: meeting.id,
            title: item.title,
            description: item.description ?? null,
            order: index,
            duration: item.duration ?? null,
            category: item.category ?? null,
            tags: item.tags ? JSON.stringify(item.tags) : null,
            presenter: item.presenter ?? null,
            status: "pending",
          })),
        });
      }

      // Create activity schedule entry
      await ctx.db.activitySchedule.create({
        data: {
          countryId: input.countryId,
          userId: input.userId,
          activityType: "meeting",
          title: input.meeting.title,
          description: input.meeting.description ?? null,
          scheduledDate: input.meeting.scheduledDate,
          scheduledIxTime,
          duration: input.meeting.duration,
          status: "scheduled",
          priority: "normal",
          category: "government",
          relatedIds: JSON.stringify({ meetingId: meeting.id }),
        },
      });

      // Notify about meeting scheduled
      try {
        await notificationHooks.onQuickActionComplete({
          userId: input.userId,
          countryId: input.countryId,
          actionType: "meeting",
          actionName: input.meeting.title,
          status: "scheduled",
          impactSummary: `Scheduled for ${input.meeting.scheduledDate.toLocaleDateString()} with ${input.meeting.attendeeIds.length} attendees`,
          href: "/mycountry/quickactions",
        });
      } catch (error) {
        console.error("[QuickActions] Failed to send meeting scheduled notification:", error);
      }

      return { meeting, success: true, message: "Cabinet meeting scheduled successfully" };
    }),

  /**
   * Update meeting status and add notes
   */
  updateMeeting: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        updates: z.object({
          status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.cabinetMeeting.update({
        where: { id: input.meetingId },
        data: {
          ...(input.updates.status && { status: input.updates.status }),
          ...(input.updates.notes && { notes: input.updates.notes }),
        },
      });

      // Update related activity schedule
      if (input.updates.status) {
        await ctx.db.activitySchedule.updateMany({
          where: {
            relatedIds: { contains: input.meetingId },
            activityType: "meeting",
          },
          data: {
            status:
              input.updates.status === "completed"
                ? "completed"
                : input.updates.status === "cancelled"
                  ? "cancelled"
                  : input.updates.status === "in_progress"
                    ? "in_progress"
                    : "scheduled",
          },
        });
      }

      return { meeting, success: true };
    }),

  /**
   * Update agenda item status
   */
  updateAgendaItem: protectedProcedure
    .input(
      z.object({
        agendaItemId: z.string(),
        status: z.enum(["pending", "discussed", "deferred", "completed"]),
        outcome: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agendaItem = await ctx.db.meetingAgendaItem.update({
        where: { id: input.agendaItemId },
        data: {
          status: input.status,
          ...(input.outcome && { outcome: input.outcome }),
        },
      });

      return { agendaItem, success: true };
    }),

  // ==========================================================================
  // POLICIES
  // ==========================================================================

  // ==========================================================================
  // ACTIVITY SCHEDULE
  // ==========================================================================

  // ==========================================================================
  // AGGREGATE VIEWS
  // ==========================================================================

  // ==========================================================================
  // MEETING DECISIONS & ACTION ITEMS
  // ==========================================================================

  /**
   * Complete a meeting and trigger decision/action prompts
   */
  completeMeeting: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the meeting with agenda items
      const meeting = await ctx.db.cabinetMeeting.findUnique({
        where: { id: input.meetingId },
        include: {
          agendaItems: true,
        },
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      // Update meeting status
      await ctx.db.cabinetMeeting.update({
        where: { id: input.meetingId },
        data: {
          status: "completed",
          completedAt: new Date(),
          notes: input.notes ?? null,
        },
      });

      // Update related activity schedule
      await ctx.db.activitySchedule.updateMany({
        where: {
          relatedIds: { contains: input.meetingId },
          activityType: "meeting",
        },
        data: {
          status: "completed",
        },
      });

      // Notify about meeting completion
      try {
        const discussedCount = meeting.agendaItems.filter((i) => i.status === "discussed").length;
        await notificationHooks.onQuickActionComplete({
          countryId: meeting.countryId,
          actionType: "meeting",
          actionName: meeting.title,
          status: "completed",
          impactSummary: `Meeting completed with ${discussedCount} items discussed`,
          href: "/mycountry/quickactions",
        });
      } catch (error) {
        console.error("[QuickActions] Failed to send meeting completion notification:", error);
      }

      // Generate suggested decisions based on agenda items
      const suggestedDecisions: Array<{
        title: string;
        description: string;
        decisionType: string;
        agendaItemId?: string;
        agendaTitle: string;
      }> = [];

      for (const item of meeting.agendaItems) {
        const category = item.category?.toLowerCase() ?? "";
        const tags = item.tags ? (JSON.parse(item.tags) as string[]) : [];

        // Generate context-appropriate decision suggestions
        if (category === "economic" || tags.includes("budget") || tags.includes("finance")) {
          suggestedDecisions.push({
            title: `Budget Allocation for ${item.title}`,
            description: `Approve budget allocation related to: ${item.title}`,
            decisionType: "budget_allocation",
            agendaItemId: item.id,
            agendaTitle: item.title,
          });
        }

        if (category === "social" || tags.includes("policy")) {
          suggestedDecisions.push({
            title: `Policy Decision on ${item.title}`,
            description: `Approve or modify policy discussed in: ${item.title}`,
            decisionType: "policy_approval",
            agendaItemId: item.id,
            agendaTitle: item.title,
          });
        }

        if (tags.includes("appointment") || tags.includes("personnel")) {
          suggestedDecisions.push({
            title: `Personnel Decision for ${item.title}`,
            description: `Approve appointment or personnel change for: ${item.title}`,
            decisionType: "appointment",
            agendaItemId: item.id,
            agendaTitle: item.title,
          });
        }

        // Always suggest a general resolution for discussed items
        if (item.status === "discussed") {
          suggestedDecisions.push({
            title: `Resolution on ${item.title}`,
            description: `Record formal decision regarding: ${item.title}`,
            decisionType: "resolution",
            agendaItemId: item.id,
            agendaTitle: item.title,
          });
        }
      }

      return {
        success: true,
        message: "Meeting completed successfully",
        suggestedDecisions,
      };
    }),

  /**
   * Create a meeting decision
   */
  createDecision: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        agendaItemId: z.string().optional(),
        title: z.string(),
        description: z.string(),
        decisionType: z.enum([
          "policy_approval",
          "budget_allocation",
          "appointment",
          "directive",
          "resolution",
          "other",
        ]),
        impact: z.enum(["high", "medium", "low"]).optional(),
        createPolicy: z.boolean().default(false),
        policyData: z
          .object({
            name: z.string(),
            policyType: z.enum([
              "economic",
              "social",
              "diplomatic",
              "infrastructure",
              "governance",
            ]),
            category: z.string(),
            gdpEffect: z.number().default(0),
            employmentEffect: z.number().default(0),
            inflationEffect: z.number().default(0),
            taxRevenueEffect: z.number().default(0),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.cabinetMeeting.findUnique({
        where: { id: input.meetingId },
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      // Create the decision
      const decision = await ctx.db.meetingDecision.create({
        data: {
          meetingId: input.meetingId,
          agendaItemId: input.agendaItemId ?? null,
          title: input.title,
          description: input.description,
          decisionType: input.decisionType,
          impact: input.impact ?? null,
          implementationStatus: "pending",
        },
      });

      // If creating a policy from this decision
      let policy = null;
      if (input.createPolicy && input.policyData) {
        const currentIxTime = IxTime.getCurrentIxTime();

        policy = await ctx.db.policy.create({
          data: {
            countryId: meeting.countryId,
            userId: meeting.userId,
            name: input.policyData.name,
            description: input.description,
            policyType: input.policyData.policyType,
            category: input.policyData.category,
            status: "proposed",
            priority: "medium",
            proposedDate: new Date(),
            proposedIxTime: currentIxTime,
            gdpEffect: input.policyData.gdpEffect,
            employmentEffect: input.policyData.employmentEffect,
            inflationEffect: input.policyData.inflationEffect,
            taxRevenueEffect: input.policyData.taxRevenueEffect,
          },
        });

        // Link policy to decision
        await ctx.db.meetingDecision.update({
          where: { id: decision.id },
          data: { relatedPolicyId: policy.id },
        });
      }

      return {
        decision,
        policy,
        success: true,
        message: "Decision recorded successfully",
      };
    }),

  /**
   * Create action items from a meeting
   */
  createActionItems: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        items: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            assignedTo: z.string().optional(),
            dueDate: z.date().optional(),
            priority: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
            category: z.string().optional(),
            tags: z.array(z.string()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actionItems = await Promise.all(
        input.items.map((item) => {
          const dueIxTime = item.dueDate ? IxTime.convertToIxTime(item.dueDate.getTime()) : null;

          return ctx.db.meetingActionItem.create({
            data: {
              meetingId: input.meetingId,
              title: item.title,
              description: item.description ?? null,
              assignedTo: item.assignedTo ?? null,
              dueDate: item.dueDate ?? null,
              dueIxTime,
              priority: item.priority,
              category: item.category ?? null,
              tags: item.tags ? JSON.stringify(item.tags) : null,
              status: "pending",
            },
          });
        })
      );

      return {
        actionItems,
        success: true,
        message: `${actionItems.length} action items created`,
      };
    }),

  // ==========================================================================
  // INTELLIGENT POLICY RECOMMENDATIONS
  // ==========================================================================

  implementDecision: protectedProcedure
    .input(
      z.object({
        decisionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const decision = await ctx.db.meetingDecision.findUnique({
        where: { id: input.decisionId },
        include: { meeting: true },
      });

      if (!decision) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Decision not found",
        });
      }

      if (decision.implementationStatus === "implemented") {
        return { success: true, message: "Decision already implemented" };
      }

      // Parse estimatedEffect (consequences JSON)
      let consequences: any[] = [];
      if (decision.estimatedEffect) {
        try {
          consequences = JSON.parse(decision.estimatedEffect);
        } catch (e) {
          console.error("[Meetings] Failed to parse estimatedEffect JSON:", e);
        }
      }

      // Apply consequences via spine
      let applied = [];
      if (consequences.length > 0) {
        applied = await CountryEventSpine.recordCountryEvent({
          db: ctx.db,
          countryId: decision.meeting.countryId,
          sourceType: "decision",
          sourceId: decision.id,
          description: `Implemented cabinet decision: "${decision.title}"`,
          consequences: consequences.map((c: any) => ({
            targetModel: c.targetModel,
            targetField: c.targetField,
            operation: c.operation || "add",
            value: c.value,
            effectType: c.effectType,
            durationDays: c.durationDays,
          })),
        });
      } else {
        // Record a trace in ledger even if no consequences are present
        await CountryEventSpine.recordCountryEvent({
          db: ctx.db,
          countryId: decision.meeting.countryId,
          sourceType: "decision",
          sourceId: decision.id,
          description: `Implemented cabinet decision: "${decision.title}"`,
        });
      }

      // Update implementationStatus to "implemented"
      const updatedDecision = await ctx.db.meetingDecision.update({
        where: { id: decision.id },
        data: {
          implementationStatus: "implemented",
        },
      });

      // If there is a related policy, we can activate it!
      let activatedPolicy = null;
      if (decision.relatedPolicyId) {
        const policy = await ctx.db.policy.findUnique({
          where: { id: decision.relatedPolicyId },
        });

        if (policy && policy.status !== "active") {
          // Check budget
          const structure = await ctx.db.governmentStructure.findUnique({
            where: { countryId: policy.countryId },
          });

          if (structure && structure.totalBudget >= policy.implementationCost) {
            // Deduct budget
            if (policy.implementationCost > 0) {
              await ctx.db.governmentStructure.update({
                where: { countryId: policy.countryId },
                data: { totalBudget: { decrement: policy.implementationCost } },
              });

              // Log budget deduction consequence via Event Spine
              await CountryEventSpine.recordCountryEvent({
                db: ctx.db,
                countryId: policy.countryId,
                sourceType: "policy",
                sourceId: policy.id,
                description: `Enacted policy "${policy.name}" via decision: Cost of ${policy.implementationCost} deducted from treasury`,
                consequences: [
                  {
                    targetModel: "GovernmentStructure",
                    targetField: "totalBudget",
                    operation: "subtract",
                    value: policy.implementationCost,
                  },
                ],
              });
            }

            activatedPolicy = await ctx.db.policy.update({
              where: { id: policy.id },
              data: {
                status: "active",
                effectiveDate: new Date(),
              },
            });

            // Make the policy real in the simulation
            await applyPolicyEffect(ctx.db, activatedPolicy).catch((err) =>
              console.error("[Meetings] Failed to apply policy effect on decision resolve:", err)
            );
          }
        }
      }

      return {
        success: true,
        decision: updatedDecision,
        policy: activatedPolicy,
        appliedConsequencesCount: applied.length,
      };
    }),
});
