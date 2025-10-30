// src/server/api/routers/quickactions.ts
// Comprehensive Quick Actions tRPC router with government integration, IxTime sync, and economic system integration

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
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

export const quickActionsRouter = createTRPCRouter({
  // ==========================================================================
  // GOVERNMENT OFFICIALS
  // ==========================================================================

  /**
   * Get all government officials for a country
   */
  getOfficials: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        governmentStructureId: z.string().optional(),
        departmentId: z.string().optional(),
        role: z.string().optional(),
        activeOnly: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      // First get the government structure for the country
      let governmentStructureId = input.governmentStructureId;

      if (!governmentStructureId) {
        const govStructure = await ctx.db.governmentStructure.findUnique({
          where: { countryId: input.countryId },
          select: { id: true },
        });
        governmentStructureId = govStructure?.id;
      }

      if (!governmentStructureId) {
        return [];
      }

      const officials = await ctx.db.governmentOfficial.findMany({
        where: {
          governmentStructureId,
          ...(input.departmentId && { departmentId: input.departmentId }),
          ...(input.role && { role: input.role }),
          ...(input.activeOnly && { isActive: true }),
        },
        include: {
          department: {
            select: {
              name: true,
              shortName: true,
              category: true,
            },
          },
        },
        orderBy: [{ priority: "desc" }, { appointedDate: "desc" }],
      });

      return officials.map((official) => ({
        ...official,
        responsibilities: official.responsibilities ? JSON.parse(official.responsibilities) : [],
      }));
    }),

  /**
   * Create a new government official
   */
  createOfficial: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        official: governmentOfficialCreateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get government structure
      const govStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
      });

      if (!govStructure) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Government structure not found for this country",
        });
      }

      const official = await ctx.db.governmentOfficial.create({
        data: {
          governmentStructureId: govStructure.id,
          name: input.official.name,
          title: input.official.title,
          role: input.official.role,
          email: input.official.email ?? null,
          phone: input.official.phone ?? null,
          bio: input.official.bio ?? null,
          photoUrl: input.official.photoUrl ?? null,
          appointedDate: input.official.appointedDate ?? new Date(),
          termEndDate: input.official.termEndDate ?? null,
          priority: input.official.priority,
          responsibilities: input.official.responsibilities
            ? JSON.stringify(input.official.responsibilities)
            : null,
          ...(input.official.departmentId && { departmentId: input.official.departmentId }),
        },
      });

      return official;
    }),

  /**
   * Update a government official
   */
  updateOfficial: protectedProcedure
    .input(
      z.object({
        officialId: z.string(),
        updates: governmentOfficialUpdateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { governmentStructureId, departmentId, responsibilities, ...safeUpdates } =
        input.updates;

      const official = await ctx.db.governmentOfficial.update({
        where: { id: input.officialId },
        data: {
          ...safeUpdates,
          ...(responsibilities && {
            responsibilities: JSON.stringify(responsibilities),
          }),
        },
      });

      return official;
    }),

  /**
   * Delete a government official (soft delete by marking inactive)
   */
  deleteOfficial: protectedProcedure
    .input(
      z.object({
        officialId: z.string(),
        hardDelete: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.hardDelete) {
        await ctx.db.governmentOfficial.delete({
          where: { id: input.officialId },
        });
      } else {
        await ctx.db.governmentOfficial.update({
          where: { id: input.officialId },
          data: { isActive: false },
        });
      }

      return { success: true };
    }),

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

  /**
   * Get all policies for a country
   */
  getPolicies: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string().optional(),
        policyType: z
          .enum(["economic", "social", "diplomatic", "infrastructure", "governance"])
          .optional(),
        status: z.enum(["draft", "proposed", "active", "expired", "repealed"]).optional(),
        activeOnly: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const policies = await ctx.db.policy.findMany({
        where: {
          countryId: input.countryId,
          ...(input.userId && { userId: input.userId }),
          ...(input.policyType && { policyType: input.policyType }),
          ...(input.status && { status: input.status }),
          ...(input.activeOnly && { status: "active" }),
        },
        include: {
          policyEffectLog: {
            orderBy: { appliedAt: "desc" },
            take: 5,
          },
        },
        orderBy: { proposedDate: "desc" },
        take: input.limit,
      });

      return policies.map((policy) => ({
        ...policy,
        objectives: policy.objectives ? JSON.parse(policy.objectives) : [],
        targetMetrics: policy.targetMetrics ? JSON.parse(policy.targetMetrics) : null,
        customEffects: policy.customEffects ? JSON.parse(policy.customEffects) : null,
        policyEffectLog: policy.policyEffectLog.map((log) => ({
          ...log,
          metricsBefore: log.metricsBefore ? JSON.parse(log.metricsBefore) : null,
          metricsAfter: log.metricsAfter ? JSON.parse(log.metricsAfter) : null,
          actualEffect: log.actualEffect ? JSON.parse(log.actualEffect) : null,
        })),
      }));
    }),

  /**
   * Create a new policy with economic effect tracking
   */
  createPolicy: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string(),
        policy: policyCreateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current IxTime
      const currentIxTime = IxTime.getCurrentIxTime();
      const effectiveIxTime = input.policy.effectiveDate
        ? IxTime.convertToIxTime(input.policy.effectiveDate.getTime())
        : null;

      // Get current country metrics for before snapshot
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          currentPopulation: true,
          unemploymentRate: true,
          inflationRate: true,
          taxRevenueGDPPercent: true,
        },
      });

      const metricsBefore = {
        gdpPerCapita: country?.currentGdpPerCapita ?? 0,
        totalGdp: country?.currentTotalGdp ?? 0,
        population: country?.currentPopulation ?? 0,
        unemploymentRate: country?.unemploymentRate ?? 0,
        inflationRate: country?.inflationRate ?? 0,
        taxRevenueGDPPercent: country?.taxRevenueGDPPercent ?? 0,
        timestamp: currentIxTime,
      };

      // Create the policy
      const policy = await ctx.db.policy.create({
        data: {
          countryId: input.countryId,
          userId: input.userId,
          name: input.policy.name,
          description: input.policy.description,
          policyType: input.policy.policyType,
          category: input.policy.category,
          status: "draft",
          priority: input.policy.priority,
          objectives:
            input.policy.objectives.length > 0 ? JSON.stringify(input.policy.objectives) : null,
          targetMetrics: input.policy.targetMetrics
            ? JSON.stringify(input.policy.targetMetrics)
            : null,
          implementationCost: input.policy.implementationCost,
          maintenanceCost: input.policy.maintenanceCost,
          estimatedBenefit: input.policy.estimatedBenefit ?? null,
          proposedDate: new Date(),
          proposedIxTime: currentIxTime,
          effectiveDate: input.policy.effectiveDate ?? null,
          effectiveIxTime,
          expiryDate: input.policy.expiryDate ?? null,
          gdpEffect: input.policy.gdpEffect,
          employmentEffect: input.policy.employmentEffect,
          inflationEffect: input.policy.inflationEffect,
          taxRevenueEffect: input.policy.taxRevenueEffect,
          customEffects: input.policy.customEffects
            ? JSON.stringify(input.policy.customEffects)
            : null,
          approvalRequired: input.policy.approvalRequired,
        },
      });

      // Create initial effect log
      await ctx.db.policyEffectLog.create({
        data: {
          policyId: policy.id,
          appliedIxTime: currentIxTime,
          effectType: "initial",
          metricsBefore: JSON.stringify(metricsBefore),
          notes: "Policy created",
        },
      });

      // Notify about policy creation
      try {
        await notificationHooks.onQuickActionComplete({
          userId: input.userId,
          countryId: input.countryId,
          actionType: "policy",
          actionName: input.policy.name,
          status: "scheduled",
          impactSummary: `Draft policy created (${input.policy.policyType})`,
          href: "/mycountry/quickactions",
        });
      } catch (error) {
        console.error("[QuickActions] Failed to send policy created notification:", error);
      }

      return { policy, success: true, message: "Policy created successfully" };
    }),

  /**
   * Activate a policy and apply its effects
   */
  activatePolicy: protectedProcedure
    .input(
      z.object({
        policyId: z.string(),
        applyEffects: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.findUnique({
        where: { id: input.policyId },
        include: {
          policyEffectLog: {
            orderBy: { appliedAt: "desc" },
            take: 1,
          },
        },
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });
      }

      const currentIxTime = IxTime.getCurrentIxTime();

      // Update policy status
      await ctx.db.policy.update({
        where: { id: input.policyId },
        data: {
          status: "active",
          effectiveDate: new Date(),
          effectiveIxTime: currentIxTime,
        },
      });

      if (input.applyEffects) {
        // Get current country metrics
        const country = await ctx.db.country.findUnique({
          where: { id: policy.countryId },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        const metricsBefore = {
          gdpPerCapita: country.currentGdpPerCapita,
          totalGdp: country.currentTotalGdp,
          unemploymentRate: country.unemploymentRate,
          inflationRate: country.inflationRate,
          taxRevenueGDPPercent: country.taxRevenueGDPPercent,
        };

        // Apply policy effects to country
        const newGdpPerCapita = country.currentGdpPerCapita * (1 + policy.gdpEffect / 100);
        const newUnemploymentRate =
          (country.unemploymentRate ?? 5.0) * (1 + policy.employmentEffect / 100);
        const newInflationRate =
          (country.inflationRate ?? 2.0) * (1 + policy.inflationEffect / 100);
        const newTaxRevenueGDPPercent =
          (country.taxRevenueGDPPercent ?? 25.0) * (1 + policy.taxRevenueEffect / 100);

        await ctx.db.country.update({
          where: { id: policy.countryId },
          data: {
            currentGdpPerCapita: newGdpPerCapita,
            currentTotalGdp: newGdpPerCapita * country.currentPopulation,
            unemploymentRate: newUnemploymentRate,
            inflationRate: newInflationRate,
            taxRevenueGDPPercent: newTaxRevenueGDPPercent,
          },
        });

        const metricsAfter = {
          gdpPerCapita: newGdpPerCapita,
          totalGdp: newGdpPerCapita * country.currentPopulation,
          unemploymentRate: newUnemploymentRate,
          inflationRate: newInflationRate,
          taxRevenueGDPPercent: newTaxRevenueGDPPercent,
        };

        const actualEffect = {
          gdpPerCapitaChange: newGdpPerCapita - country.currentGdpPerCapita,
          unemploymentRateChange: newUnemploymentRate - (country.unemploymentRate ?? 5.0),
          inflationRateChange: newInflationRate - (country.inflationRate ?? 2.0),
          taxRevenueChange: newTaxRevenueGDPPercent - (country.taxRevenueGDPPercent ?? 25.0),
        };

        // Log the effect
        await ctx.db.policyEffectLog.create({
          data: {
            policyId: policy.id,
            appliedIxTime: currentIxTime,
            effectType: "initial",
            metricsBefore: JSON.stringify(metricsBefore),
            metricsAfter: JSON.stringify(metricsAfter),
            actualEffect: JSON.stringify(actualEffect),
            notes: "Policy activated and effects applied",
          },
        });

        // Notify about policy activation with impact summary
        try {
          const impactDetails = [
            `GDP/capita: ${actualEffect.gdpPerCapitaChange > 0 ? "+" : ""}${actualEffect.gdpPerCapitaChange.toFixed(2)}`,
            `Unemployment: ${actualEffect.unemploymentRateChange > 0 ? "+" : ""}${actualEffect.unemploymentRateChange.toFixed(2)}%`,
            `Tax Revenue: ${actualEffect.taxRevenueChange > 0 ? "+" : ""}${actualEffect.taxRevenueChange.toFixed(2)}%`,
          ].join(", ");

          await notificationHooks.onQuickActionComplete({
            countryId: policy.countryId,
            actionType: "policy",
            actionName: policy.name,
            status: "completed",
            impactSummary: `Policy activated with effects: ${impactDetails}`,
            href: "/mycountry/quickactions",
          });
        } catch (error) {
          console.error("[QuickActions] Failed to send policy activation notification:", error);
        }

        return {
          success: true,
          message: "Policy activated and effects applied",
          effectSummary: actualEffect,
        };
      }

      // Notify about policy activation without effects
      try {
        await notificationHooks.onQuickActionComplete({
          countryId: policy.countryId,
          actionType: "policy",
          actionName: policy.name,
          status: "completed",
          impactSummary: "Policy activated (effects not applied)",
          href: "/mycountry/quickactions",
        });
      } catch (error) {
        console.error("[QuickActions] Failed to send policy activation notification:", error);
      }

      return { success: true, message: "Policy activated" };
    }),

  /**
   * Update policy status
   */
  updatePolicy: protectedProcedure
    .input(
      z.object({
        policyId: z.string(),
        updates: policyUpdateSchema.extend({
          status: z.enum(["draft", "proposed", "active", "expired", "repealed"]).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { objectives, targetMetrics, customEffects, ...safeUpdates } = input.updates;

      const policy = await ctx.db.policy.update({
        where: { id: input.policyId },
        data: {
          ...safeUpdates,
          ...(objectives && {
            objectives: JSON.stringify(objectives),
          }),
          ...(targetMetrics && {
            targetMetrics: JSON.stringify(targetMetrics),
          }),
          ...(customEffects && {
            customEffects: JSON.stringify(customEffects),
          }),
        },
      });

      return { policy, success: true };
    }),

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

  /**
   * Get policy recommendations based on country context
   */
  getPolicyRecommendations: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().int().min(1).max(20).default(10),
        policyType: z
          .enum(["economic", "social", "diplomatic", "infrastructure", "governance"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Import the policy recommender
      const { getPolicyRecommendations, getPolicyRecommendationsByType } = await import(
        "~/lib/policy-recommender"
      );

      // Get country data
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
      });

      if (!country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country not found",
        });
      }

      // Get government components
      const govStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        include: {
          country: {
            include: {
              governmentComponents: true,
            },
          },
        },
      });

      // Get active policies
      const activePolicies = await ctx.db.policy.findMany({
        where: {
          countryId: input.countryId,
          status: "active",
        },
        select: { id: true },
      });

      // Build context
      const context = {
        country,
        governmentComponents: govStructure?.country.governmentComponents ?? [],
        economyData: {
          gdpPerCapita: country.currentGdpPerCapita,
          totalGdp:
            country.currentTotalGdp ?? country.currentGdpPerCapita * country.currentPopulation,
          unemploymentRate: country.unemploymentRate ?? 5.0,
          inflationRate: country.inflationRate ?? 2.0,
          taxRevenueGDPPercent: country.taxRevenueGDPPercent ?? 20.0,
          laborForceParticipationRate: country.laborForceParticipationRate ?? 65.0,
        },
        activePolicies: activePolicies.map((p) => p.id),
      };

      // Get recommendations
      const recommendations = input.policyType
        ? getPolicyRecommendationsByType(context, input.policyType)
        : getPolicyRecommendations(context);

      return recommendations.slice(0, input.limit);
    }),
});
