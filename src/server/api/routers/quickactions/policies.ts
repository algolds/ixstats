// src/server/api/routers/quickactions.ts
// Comprehensive Quick Actions tRPC router with government integration, IxTime sync, and economic system integration

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
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
        await import("~/lib/policies");

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
