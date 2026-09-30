// src/server/api/routers/policies.ts
// Policy management and tracking system

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getPolicyDecretals } from "~/lib/policies/registry";
import { IxTime } from "~/lib/ixtime";
import {
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
} from "~/lib/government/atomic-utils";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

const RECON_CAPACITY_COST = 20;

async function loadPolicyReconContext(db: any, countryId: string) {
  const now = IxTime.getCurrentIxTime();
  const [
    country,
    structure,
    components,
    pendingRecon,
    allocations,
    activePoliciesSum,
    dismissedIssuesCount,
  ] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      select: { currentPopulation: true, governmentalEfficiency: true },
    }),
    db.governmentStructure.findUnique({
      where: { countryId },
      select: {
        governmentEffectiveness: true,
        departments: { where: { isActive: true }, select: { category: true } },
      },
    }),
    db.governmentComponent.findMany({
      where: { countryId, isActive: true },
      select: { componentType: true },
    }),
    db.nationalIssue.count({ where: { countryId, reconReadyIxTime: { gt: now } } }),
    db.budgetAllocation.findMany({
      where: {
        governmentStructure: { countryId },
        budgetYear: currentBudgetYear(),
      },
      include: { department: { select: { category: true } } },
    }),
    db.policy.aggregate({
      where: { countryId, status: "active" },
      _sum: { civCapCost: true },
    }),
    db.nationalIssue.count({
      where: {
        countryId,
        status: "dismissed",
        respondedIxTime: { gte: now - 5 },
      },
    }),
  ]);

  const spendByCategory: Record<string, number> = {};
  allocations.forEach((alloc: any) => {
    const cat = alloc.department.category;
    spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
  });

  const activeComponentTypes = components.map((c: any) => c.componentType);
  const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
  const isTechnocratsSatisfied = activeBrokers.some(
    (b: any) => b.id === "technocrats" && b.satisfied
  );

  const effectiveness = structure?.governmentEffectiveness ?? country?.governmentalEfficiency ?? 50;
  const capacity = calculateCivilServiceCapacity(country?.currentPopulation ?? 0, effectiveness);

  const govStaff = calculateTotalConsumedStaff(
    components.map((c: any) => c.componentType as any),
    [],
    []
  );

  const effectiveGovStaff = isTechnocratsSatisfied ? Math.round(govStaff * 0.85) : govStaff;
  const policyCivCap = activePoliciesSum._sum.civCapCost ?? 0;
  const dismissedCivCap = dismissedIssuesCount * 15;
  const used =
    effectiveGovStaff + pendingRecon * RECON_CAPACITY_COST + policyCivCap + dismissedCivCap;

  return {
    componentTypes: components.map((c: any) => String(c.componentType)),
    departmentCategories: (structure?.departments ?? []).map((d: any) => d.category),
    capacity,
    used,
    available: Math.max(0, capacity - used),
    overCapacity: used > capacity,
    lowEfficiency: effectiveness < 45,
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

  createPolicy: protectedProcedure
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

  // ==================== ENHANCED POLICY INTEGRATION ====================

  getPolicyReconContext: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await loadPolicyReconContext(ctx.db, input.countryId);
    }),
});
