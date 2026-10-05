// src/server/api/routers/policies.ts
// Policy management and tracking system

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getPolicyDecretals } from "~/lib/policies/registry";
import type { PrismaClient } from "@prisma/client";
import { loadCivCapState } from "~/lib/government/civcap";
import {
  assertCountryWriteAccess,
  hasCountryWriteAccess,
} from "~/server/shared/country-authorization";

/** Policy recon context: the shared CivCap state (lib/government/civcap.ts) + an efficiency flag. */
async function loadPolicyReconContext(db: PrismaClient, countryId: string) {
  const civCap = await loadCivCapState(db, countryId);
  return {
    componentTypes: civCap.componentTypes,
    departmentCategories: civCap.departmentCategories,
    capacity: civCap.capacity,
    used: civCap.used,
    available: civCap.available,
    overCapacity: civCap.overCapacity,
    lowEfficiency: civCap.effectiveness < 45,
    breakdown: civCap.breakdown,
  };
}

function getMatchingDepartmentCategory(policyCategory: string): string {
  const mapping: Record<string, string> = {
    fiscal: "finance",
    monetary: "finance",
    trade: "commerce",
    defense: "defense",
    education: "education",
    healthcare: "health",
    infrastructure: "interior",
    environment: "interior",
    governance: "interior",
    security: "interior",
    social: "interior",
    foreign: "foreign",
    diplomatic: "foreign",
  };
  return mapping[policyCategory.toLowerCase()] || "interior";
}

function getCustomPolicyAttributes(priority: string) {
  let riskRating: "stable" | "volatile" | "high-risk" = "stable";
  let civCapCost = 10;

  if (priority === "critical" || priority === "CRITICAL") {
    riskRating = "high-risk";
    civCapCost = 25;
  } else if (priority === "high" || priority === "HIGH") {
    riskRating = "volatile";
    civCapCost = 15;
  } else if (priority === "low" || priority === "LOW") {
    riskRating = "stable";
    civCapCost = 5;
  }

  return { riskRating, civCapCost, origin: "personal" as const };
}

export const policiesCrudRouter = createTRPCRouter({
  // ==================== POLICY CRUD ====================

  createPolicy: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string().optional(), // ignored: the author is always the caller
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
        origin: z.enum(["personal", "crisis_response", "broker_request"]).optional(),
        decretalKey: z.string().optional(),
        settings: z.record(z.string(), z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const { decretalKey, settings, origin, ...baseInput } = input;

      let gdpEffect = 0;
      let employmentEffect = 0;
      let inflationEffect = 0;
      let taxRevenueEffect = 0;
      let implementationCost = baseInput.implementationCost ?? 0;
      let maintenanceCost = baseInput.maintenanceCost ?? 0;
      let calculatedEffectsJson: string | null = null;

      // Custom policy attributes derivation (default)
      const customAttrs = getCustomPolicyAttributes(baseInput.priority);
      let policyRiskRating = customAttrs.riskRating as "stable" | "volatile" | "high-risk";
      let policyOrigin = (origin || customAttrs.origin) as
        "personal" | "crisis_response" | "broker_request";
      let policyCivCapCost = customAttrs.civCapCost;

      if (!decretalKey) {
        // Custom policy category-department alignment check
        const cx = await loadPolicyReconContext(ctx.db, input.countryId);
        const reqDept = getMatchingDepartmentCategory(baseInput.category);
        if (!cx.departmentCategories.includes(reqDept)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `You must establish an active Department of ${reqDept.charAt(0).toUpperCase() + reqDept.slice(1)} before launching custom policies in this domain.`,
          });
        }
      }

      if (decretalKey) {
        const decretals = await getPolicyDecretals(ctx.db);
        const decretal = decretals[decretalKey];
        if (decretal) {
          const country = await ctx.db.country.findUnique({
            where: { id: input.countryId },
            select: { currentPopulation: true },
          });
          const metrics = {
            currentPopulation: country?.currentPopulation ?? 1000000,
          };
          const calcSettings = settings ?? {};
          const results = decretal.calculate(calcSettings, metrics);

          implementationCost = results.implementationCost;
          maintenanceCost = results.maintenanceCost;
          gdpEffect = results.gdpEffect;
          employmentEffect = results.employmentEffect;
          inflationEffect = results.inflationEffect;
          taxRevenueEffect = results.taxRevenueEffect;

          policyRiskRating = (decretal.riskRating ?? "stable") as
            "stable" | "volatile" | "high-risk";
          policyOrigin = (origin ?? decretal.origin ?? "personal") as
            "personal" | "crisis_response" | "broker_request";
          policyCivCapCost = decretal.civCapCost ?? 0;

          calculatedEffectsJson = JSON.stringify({
            decretalKey,
            settings: calcSettings,
            stabilityEffect: results.stabilityEffect,
          });
        }
      }

      // Apply discounts if reactively-born (crisis response or broker request)
      if (policyOrigin === "crisis_response" || policyOrigin === "broker_request") {
        policyCivCapCost = Math.max(
          policyCivCapCost > 0 ? 1 : 0,
          Math.round(policyCivCapCost * 0.75)
        );
        maintenanceCost = Math.round(maintenanceCost * 0.85);
      }

      return await ctx.db.policy.create({
        data: {
          ...baseInput,
          userId: ctx.auth.userId,
          implementationCost,
          maintenanceCost,
          gdpEffect,
          employmentEffect,
          inflationEffect,
          taxRevenueEffect,
          riskRating: policyRiskRating,
          origin: policyOrigin,
          civCapCost: policyCivCapCost,
          calculatedEffects: calculatedEffectsJson,
          status: "draft",
        },
      });
    }),

  /**
   * A country's policies. Drafts are the owner's: the owner and privileged roles get every
   * status, everyone else enacted and past policies only (never `draft`).
   */
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

      if (!(await hasCountryWriteAccess(ctx, input.countryId))) {
        if (input.status === "draft") return [];
        if (!input.status) where.status = { not: "draft" };
      }

      return await ctx.db.policy.findMany({
        where,
        orderBy: [{ priority: "asc" }, { effectiveDate: "desc" }],
      });
    }),

  // ==================== ENHANCED POLICY INTEGRATION ====================

  /** The nation's CivCap state (capacity, usage, breakdown). Owner / privileged roles only. */
  getPolicyReconContext: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return await loadPolicyReconContext(ctx.db, input.countryId);
    }),
});
