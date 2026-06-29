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
import { getPolicyDecretals } from "~/lib/policies/registry";
import { IxTime } from "~/lib/ixtime";
import { calculateCivilServiceCapacity, calculateTotalConsumedStaff } from "~/lib/atomic-government-utils";
import { deriveBrokers } from "~/lib/statecraft-power-brokers";

const RECON_CAPACITY_COST = 20;

async function loadPolicyReconContext(db: any, countryId: string) {
  const now = IxTime.getCurrentIxTime();
  const [country, structure, components, pendingRecon, allocations, activePoliciesSum, dismissedIssuesCount] = await Promise.all([
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
        budgetYear: new Date().getFullYear(),
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
  const isTechnocratsSatisfied = activeBrokers.some((b: any) => b.id === "technocrats" && b.satisfied);

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
  const used = effectiveGovStaff + pendingRecon * RECON_CAPACITY_COST + policyCivCap + dismissedCivCap;

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
        origin: z.enum(["personal", "crisis_response", "broker_request"]).optional(),
        decretalKey: z.string().optional(),
        settings: z.record(z.string(), z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
      let policyOrigin = (origin || customAttrs.origin) as "personal" | "crisis_response" | "broker_request";
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

          policyRiskRating = (decretal.riskRating ?? "stable") as "stable" | "volatile" | "high-risk";
          policyOrigin = (origin ?? decretal.origin ?? "personal") as "personal" | "crisis_response" | "broker_request";
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
        policyCivCapCost = Math.max(policyCivCapCost > 0 ? 1 : 0, Math.round(policyCivCapCost * 0.75));
        maintenanceCost = Math.round(maintenanceCost * 0.85);
      }

      return await ctx.db.policy.create({
        data: {
          ...baseInput,
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

      let extraData: any = {};
      if (data.priority) {
        const existing = await ctx.db.policy.findUnique({
          where: { id },
          select: { calculatedEffects: true, origin: true },
        });

        let isCustom = true;
        if (existing?.calculatedEffects) {
          try {
            const parsed = JSON.parse(existing.calculatedEffects);
            if (parsed?.decretalKey) {
              isCustom = false;
            }
          } catch {}
        }

        if (isCustom) {
          const derived = getCustomPolicyAttributes(data.priority);
          let derivedCivCap = derived.civCapCost;
          const policyOrigin = existing?.origin || "personal";
          if (policyOrigin === "crisis_response" || policyOrigin === "broker_request") {
            derivedCivCap = Math.max(derivedCivCap > 0 ? 1 : 0, Math.round(derivedCivCap * 0.75));
          }
          extraData = {
            riskRating: derived.riskRating,
            civCapCost: derivedCivCap,
          };
        }
      }

      return await ctx.db.policy.update({
        where: { id },
        data: {
          ...data,
          ...extraData,
        },
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
      return await ctx.db.$transaction(async (tx: any) => {
        const policy = await tx.policy.findUnique({
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

        const structure = await tx.governmentStructure.findUnique({
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

        if (cost > 0) {
          await tx.governmentStructure.update({
            where: { countryId: policy.countryId },
            data: {
              totalBudget: { decrement: cost },
            },
          });

          await CountryEventSpine.recordCountryEvent({
            db: tx,
            countryId: policy.countryId,
            sourceType: "policy",
            sourceId: policy.id,
            description: `Enacted policy "${policy.name}": Cost of ${cost} deducted from treasury`,
            consequences: [
              {
                targetModel: "GovernmentStructure",
                targetField: "totalBudget",
                operation: "subtract",
                value: cost,
              },
            ],
          }).catch((err) =>
            console.error("[Policies] Failed to log budget deduction to spine:", err)
          );
        }

        const currentIxTime = IxTime.getCurrentIxTime();

        const meeting = await tx.cabinetMeeting.create({
          data: {
            countryId: policy.countryId,
            userId: ctx.auth.userId,
            title: `Cabinet Session: Enactment of ${policy.name}`,
            description: `A cabinet session convened to formally enact the policy: ${policy.name}.`,
            scheduledDate: new Date(),
            scheduledIxTime: currentIxTime,
            completedAt: new Date(),
            status: "completed",
            duration: 45,
          },
        });

        const decision = await tx.meetingDecision.create({
          data: {
            meetingId: meeting.id,
            title: `Enactment of ${policy.name}`,
            description: `Decided to enact the policy: ${policy.name}. Modifiers: GDP ${policy.gdpEffect}%, Unemployment ${policy.employmentEffect}%, Inflation ${policy.inflationEffect}%.`,
            decisionType: "policy_approval",
            implementationStatus: "implemented",
            relatedPolicyId: policy.id,
          },
        });

        const categoryToRole: Record<string, string> = {
          fiscal: "Minister of Finance",
          trade: "Minister of Trade",
          labor: "Minister of Labor",
          education: "Minister of Education",
          healthcare: "Minister of Health",
          environment: "Minister of Environment",
          defense: "Minister of Defense",
          housing: "Minister of Housing",
          technology: "Minister of Science and Technology",
          agriculture: "Minister of Agriculture",
        };
        const assignedRole = categoryToRole[policy.category] ?? "Cabinet Member";

        await tx.meetingActionItem.create({
          data: {
            meetingId: meeting.id,
            decisionId: decision.id,
            title: `Oversee rollout of ${policy.name}`,
            description: `Oversee implementation and ensure operational stability of the newly active policy: ${policy.name}.`,
            status: "pending",
            priority:
              policy.priority === "critical" || policy.priority === "high" ? "high" : "normal",
            assignedTo: assignedRole,
            dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
            dueIxTime: currentIxTime + 7 * 24 * 3600,
            category: policy.category,
          },
        });

        const updatedPolicy = await tx.policy.update({
          where: { id: input.id },
          data: {
            status: "active",
            effectiveDate: new Date(),
            effectiveIxTime: currentIxTime,
          },
        });

        await applyPolicyEffect(tx, updatedPolicy).catch((err) =>
          console.error("[Policies] Failed to apply policy effect:", err)
        );

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

        const user = await tx.user.findFirst({
          where: { countryId: policy.countryId },
          select: { clerkUserId: true },
        });

        if (policy.category === "economic") {
          await ActivityHooks.Economic.onTaxPolicyChange(
            policy.countryId,
            policy.category,
            policy.name,
            0,
            user?.clerkUserId
          ).catch((err) => console.error("Failed to create policy activity:", err));
        }

        const country = await tx.country.findUnique({
          where: { id: policy.countryId },
          select: { name: true },
        });
        void generateDiplomaticNews(tx, policy.countryId, "free_trade_signed", {
          countryName: country?.name ?? "Government",
          targetName: policy.name,
          severity: "light",
          reason: `New policy enacted: ${policy.description || policy.name}`,
        }).catch((err) => console.error("[Policies] Failed to generate policy news:", err));

        return updatedPolicy;
      });
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

      await CountryEventSpine.recordCountryEvent({
        db: ctx.db as any,
        countryId: policy.countryId,
        sourceType: "policy",
        sourceId: policy.id,
        description: `Policy suspended: ${policy.name}`,
        newsTemplate: "sanction_imposed",
        newsVars: {
          targetName: policy.name,
          severity: "light",
          reason: input.reason ?? "Policy suspended",
        },
      });

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

      await CountryEventSpine.recordCountryEvent({
        db: ctx.db as any,
        countryId: policy.countryId,
        sourceType: "policy",
        sourceId: policy.id,
        description: `Policy repealed: ${policy.name}`,
        newsTemplate: "policy_lifted",
        newsVars: {
          targetName: policy.name,
          severity: "moderate",
          reason: input.reason ?? "Policy repealed",
        },
      });

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

  getPolicyReconContext: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await loadPolicyReconContext(ctx.db, input.countryId);
    }),
});


