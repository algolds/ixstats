// src/server/api/routers/quickactions.ts
// Comprehensive Quick Actions tRPC router with government integration, IxTime sync, and economic system integration

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationHooks } from "~/lib/notifications/hooks";
import { mapTaxComponentTypeToId } from "~/lib/enums";

// ============================================================================
// COMPONENT PREREQUISITE HELPERS
// ============================================================================

/**
 * Build the set of component identifiers that are currently *active* for a country.
 * A component counts as active when isActive is set OR its implementationDate has
 * elapsed (i.e. it has finished rolling out — still-implementing components do NOT
 * count). Tax components are indexed under both their enum name and frontend id so
 * required-component lists in either form resolve correctly.
 */
async function getActiveComponentIdentifiers(db: any, countryId: string): Promise<Set<string>> {
  // implementationDate is stored in IxTime (game time), so compare against IxTime now.
  const now = new Date(IxTime.getCurrentIxTime());
  const isActive = (c: any) =>
    c.isActive === true || (c.implementationDate && new Date(c.implementationDate) <= now);

  const [gov, econ, tax] = await Promise.all([
    db.governmentComponent.findMany({
      where: { countryId },
      select: { componentType: true, isActive: true, implementationDate: true },
    }),
    db.economicComponent.findMany({
      where: { countryId },
      select: { componentType: true, isActive: true, implementationDate: true },
    }),
    db.taxComponent.findMany({
      where: { countryId },
      select: { componentType: true, isActive: true, implementationDate: true },
    }),
  ]).catch(() => [[], [], []]);

  const active = new Set<string>();
  for (const c of gov) if (isActive(c)) active.add(String(c.componentType));
  for (const c of econ) if (isActive(c)) active.add(String(c.componentType));
  for (const c of tax) {
    if (isActive(c)) {
      active.add(String(c.componentType));
      active.add(mapTaxComponentTypeToId(String(c.componentType)));
    }
  }
  return active;
}

/** Parse a policy.requiredComponents value (JSON string or array) into a string array. */
function parseRequiredComponents(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Return the subset of required components that are NOT currently active for the country. */
async function findMissingRequiredComponents(
  db: any,
  countryId: string,
  required: string[]
): Promise<string[]> {
  if (required.length === 0) return [];
  const active = await getActiveComponentIdentifiers(db, countryId);
  return required.filter((id) => !active.has(String(id)));
}

/** Throw PRECONDITION_FAILED if any required component is not fully active for the country. */
async function assertRequiredComponentsActive(
  db: any,
  countryId: string,
  required: string[]
): Promise<void> {
  const missing = await findMissingRequiredComponents(db, countryId, required);
  if (missing.length > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `This policy requires components that are not yet active: ${missing.join(
        ", "
      )}. Required components must be fully active (not still implementing) before the policy can take effect.`,
    });
  }
}

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
  // Atomic component identifiers this policy depends on (gov/econ enum names or tax
  // frontend ids). They must be fully active before the policy can be activated.
  requiredComponents: z.array(z.string()).optional(),
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

export const quickActionsPoliciesRouter = createTRPCRouter({
  // ==========================================================================
  // GOVERNMENT OFFICIALS
  // ==========================================================================

  // ==========================================================================
  // CABINET MEETINGS
  // ==========================================================================

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

      // Cross-reference required components. Creation is always allowed (drafts can be
      // staged before their prerequisites exist), but report whether requirements are
      // met so the UI can warn that the policy cannot be activated yet.
      const requiredComponents = input.policy.requiredComponents ?? [];
      const missingComponents = await findMissingRequiredComponents(
        ctx.db,
        input.countryId,
        requiredComponents
      );
      const requirementsMet = missingComponents.length === 0;

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
          requiredComponents:
            requiredComponents.length > 0 ? JSON.stringify(requiredComponents) : null,
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

      return {
        policy,
        success: true,
        requirementsMet,
        missingComponents,
        message: requirementsMet
          ? "Policy created successfully"
          : `Policy created as a draft, but it requires components that are not yet active: ${missingComponents.join(
              ", "
            )}.`,
      };
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

      // Gate activation on required atomic components being fully active (not implementing).
      await assertRequiredComponentsActive(
        ctx.db,
        policy.countryId,
        parseRequiredComponents((policy as { requiredComponents?: unknown }).requiredComponents)
      );

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
      const { objectives, targetMetrics, customEffects, requiredComponents, ...safeUpdates } =
        input.updates;

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
          ...(requiredComponents && {
            requiredComponents:
              requiredComponents.length > 0 ? JSON.stringify(requiredComponents) : null,
          }),
        },
      });

      return { policy, success: true };
    }),

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
      const { getPolicyRecommendations, getPolicyRecommendationsByType } =
        await import("~/lib/policy-recommender");

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
