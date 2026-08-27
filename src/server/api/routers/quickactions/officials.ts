// src/server/api/routers/quickactions.ts
// Comprehensive Quick Actions tRPC router with government integration, IxTime sync, and economic system integration

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

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

const _meetingInputSchema = z.object({
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
const _policyCreateSchema = policyBaseSchema;

// Update schema - all fields optional
const _policyUpdateSchema = policyBaseSchema.partial();

const _activityScheduleInputSchema = z.object({
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

export const quickActionsOfficialsRouter = createTRPCRouter({
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
      // oxlint-disable-next-line typescript/no-unused-vars
      const {
        governmentStructureId: _governmentStructureId,
        departmentId,
        responsibilities,
        ...safeUpdates
      } = input.updates;

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

  // ==========================================================================
  // INTELLIGENT POLICY RECOMMENDATIONS
  // ==========================================================================
});
