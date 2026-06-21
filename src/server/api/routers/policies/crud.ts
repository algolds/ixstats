// src/server/api/routers/policies.ts
// Policy management and tracking system

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { ActivityHooks } from "~/lib/activity-hooks";
import { notificationAPI } from "~/lib/notification-api";
import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";
import { applyPolicyEffect, clearPolicyEffect } from "~/lib/policy-effects-sync";
import { CountryEventSpine } from "~/lib/country-event-spine";
import { TRPCError } from "@trpc/server";

export const policiesCrudRouter = createTRPCRouter({
  // ==================== POLICY CRUD ====================

  createPolicy: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string(),
        name: z.string().min(1).max(200),
        description: z.string(),
        policyType: z.enum(["economic", "social", "diplomatic", "infrastructure", "governance"]),
        category: z.string(),
        effectiveDate: z.date().optional(),
        expiryDate: z.date().optional(),
        targetMetrics: z.string().optional(),
        implementationCost: z.number().optional(),
        maintenanceCost: z.number().optional(),
        priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.policy.create({
        data: {
          ...input,
          status: "draft",
        },
      });
    }),

  getPolicies: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        category: z
          .enum([
            "economic",
            "social",
            "defense",
            "education",
            "healthcare",
            "infrastructure",
            "environment",
            "trade",
            "other",
          ])
          .optional(),
        status: z.enum(["draft", "active", "suspended", "expired", "repealed"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { countryId: input.countryId };
      if (input.category) where.category = input.category;
      if (input.status) where.status = input.status;

      return await ctx.db.policy.findMany({
        where,
        orderBy: [{ priority: "asc" }, { effectiveDate: "desc" }],
      });
    }),

  getPolicy: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.policy.findUnique({
        where: { id: input.id },
        include: {
          policyEffectLog: {
            orderBy: { appliedAt: "desc" },
          },
        },
      });
    }),

  updatePolicy: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        category: z
          .enum([
            "economic",
            "social",
            "defense",
            "education",
            "healthcare",
            "infrastructure",
            "environment",
            "trade",
            "other",
          ])
          .optional(),
        status: z.enum(["draft", "active", "suspended", "expired", "repealed"]).optional(),
        expirationDate: z.date().optional(),
        targetMetric: z.string().optional(),
        targetValue: z.number().optional(),
        cost: z.number().optional(),
        priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return await ctx.db.policy.update({
        where: { id },
        data,
      });
    }),

  deletePolicy: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Clear any active sim effect before removing the policy.
      await clearPolicyEffect(ctx.db, input.id).catch((err) =>
        console.error("[Policies] Failed to clear policy effect on delete:", err)
      );
      return await ctx.db.policy.delete({
        where: { id: input.id },
      });
    }),

  activatePolicy: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.findUnique({
        where: { id: input.id },
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });
      }

      if (policy.status === "active") {
        return policy;
      }

      // Check country budget
      const structure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: policy.countryId },
      });

      if (!structure) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Government structure not found. Please configure your government first.",
        });
      }

      const cost = policy.implementationCost || 0;
      if (cost > 0 && structure.totalBudget < cost) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient budget to enact this policy. Required: ${cost}, Available: ${structure.totalBudget}`,
        });
      }

      // Deduct budget
      if (cost > 0) {
        await ctx.db.governmentStructure.update({
          where: { countryId: policy.countryId },
          data: {
            totalBudget: { decrement: cost },
          },
        });

        // Record budget deduction consequence via the Event Spine
        await CountryEventSpine.recordCountryEvent({
          db: ctx.db,
          countryId: policy.countryId,
          sourceType: "policy",
          sourceId: policy.id,
          description: `Enacted policy "${policy.name}": Cost of ${cost} deducted from treasury`,
          consequences: [{
            targetModel: "GovernmentStructure",
            targetField: "totalBudget",
            operation: "subtract",
            value: cost
          }]
        }).catch((err) => console.error("[Policies] Failed to log budget deduction to spine:", err));
      }

      const updatedPolicy = await ctx.db.policy.update({
        where: { id: input.id },
        data: {
          status: "active",
          effectiveDate: new Date(),
        },
      });

      // ⚙️ Make the policy real: emit the StorytellerEffect the economic engine reads.
      await applyPolicyEffect(ctx.db, updatedPolicy).catch((err) =>
        console.error("[Policies] Failed to apply policy effect:", err)
      );

      const policyToReturn = updatedPolicy;

      // Get user for activity feed
      const user = await ctx.db.user.findFirst({
        where: { countryId: policy.countryId },
        select: { clerkUserId: true },
      });

      // Generate activity for policy activation (non-blocking)
      if (policy.category === "economic") {
        await ActivityHooks.Economic.onTaxPolicyChange(
          policy.countryId,
          policy.category,
          policy.name,
          0, // Population affected - could be calculated
          user?.clerkUserId
        ).catch((err) => console.error("Failed to create policy activity:", err));
      }

      // 🔔 Notify country about policy activation
      try {
        const priorityMap: Record<string, "high" | "medium" | "low"> = {
          critical: "high",
          high: "high",
          medium: "medium",
          low: "low",
        };

        await notificationAPI.create({
          title: "📜 Policy Activated",
          message: `"${policy.name}" has been activated and is now in effect`,
          countryId: policy.countryId,
          category: "policy",
          priority: priorityMap[policy.priority] || "medium",
          type: "success",
          href: "/mycountry/policies",
          source: "policy-system",
          actionable: false,
          metadata: { policyId: policy.id, policyType: policy.policyType },
        });
      } catch (error) {
        console.error("[Policies] Failed to send policy activation notification:", error);
      }

      // Narrative output: post policy enactment to ThinkPages (fire-and-forget)
      const country = await ctx.db.country.findUnique({
        where: { id: policy.countryId },
        select: { name: true },
      });
      void generateDiplomaticNews(ctx.db, policy.countryId, "free_trade_signed", {
        countryName: country?.name ?? "Government",
        targetName: policy.name,
        severity: "light",
        reason: `New policy enacted: ${policy.description || policy.name}`,
      }).catch((err) => console.error("[Policies] Failed to generate policy news:", err));

      return policyToReturn;
    }),

  suspendPolicy: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.update({
        where: { id: input.id },
        data: {
          status: "suspended",
        },
      });

      // Pause the sim effect while suspended.
      await clearPolicyEffect(ctx.db, input.id).catch((err) =>
        console.error("[Policies] Failed to clear policy effect on suspend:", err)
      );

      // 🔔 Notify country about policy suspension
      try {
        await notificationAPI.create({
          title: "⚠️ Policy Suspended",
          message: `"${policy.name}" has been suspended${input.reason ? `: ${input.reason}` : ""}`,
          countryId: policy.countryId,
          category: "policy",
          priority: "medium",
          type: "warning",
          href: "/mycountry/policies",
          source: "policy-system",
          actionable: true,
          metadata: { policyId: policy.id, reason: input.reason },
        });
      } catch (error) {
        console.error("[Policies] Failed to send policy suspension notification:", error);
      }

      const country = await ctx.db.country.findUnique({
        where: { id: policy.countryId },
        select: { name: true },
      });
      void generateDiplomaticNews(ctx.db, policy.countryId, "sanction_imposed", {
        countryName: country?.name ?? "Government",
        targetName: policy.name,
        severity: "light",
        reason: input.reason ?? "Policy suspended",
      }).catch((err) => console.error("[Policies] Failed to generate suspension news:", err));

      return policy;
    }),

  repealPolicy: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.update({
        where: { id: input.id },
        data: {
          status: "repealed",
          expiryDate: new Date(),
        },
      });

      // Remove the sim effect — repealed policies no longer influence the economy.
      await clearPolicyEffect(ctx.db, input.id).catch((err) =>
        console.error("[Policies] Failed to clear policy effect on repeal:", err)
      );

      // 🔔 Notify country about policy repeal
      try {
        await notificationAPI.create({
          title: "❌ Policy Repealed",
          message: `"${policy.name}" has been repealed and is no longer in effect${input.reason ? `: ${input.reason}` : ""}`,
          countryId: policy.countryId,
          category: "policy",
          priority: "high",
          type: "error",
          href: "/mycountry/policies",
          source: "policy-system",
          actionable: false,
          metadata: { policyId: policy.id, reason: input.reason },
        });
      } catch (error) {
        console.error("[Policies] Failed to send policy repeal notification:", error);
      }

      const country = await ctx.db.country.findUnique({
        where: { id: policy.countryId },
        select: { name: true },
      });
      void generateDiplomaticNews(ctx.db, policy.countryId, "policy_lifted", {
        countryName: country?.name ?? "Government",
        targetName: policy.name,
        severity: "moderate",
        reason: input.reason ?? "Policy repealed",
      }).catch((err) => console.error("[Policies] Failed to generate repeal news:", err));

      return policy;
    }),

  // ==================== POLICY EFFECT LOGS ====================

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
