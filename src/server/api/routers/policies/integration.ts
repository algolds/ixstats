// src/server/api/routers/policies.ts
// Policy management and tracking system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { calculateRealTimePolicyEffects } from "~/lib/policies";
import { getPolicyDecretals } from "~/lib/policies/registry";

import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

export const policiesIntegrationRouter = createTRPCRouter({
  getPolicyCatalog: publicProcedure.query(async ({ ctx }) => {
    const catalog = await getPolicyDecretals(ctx.db);
    return Object.values(catalog).map((c) => ({
      key: c.key,
      name: c.name,
      description: c.description,
      category: c.category,
      policyType: c.policyType,
      sliders: c.sliders.map((s) => ({
        key: s.key,
        label: s.label,
        options: s.options.map((o) => ({
          label: o.label,
          value: o.value,
        })),
      })),
    }));
  }),
  // ==================== POLICY CRUD ====================

  // ==================== POLICY EFFECT LOGS ====================

  // ==================== ACTIVITY SCHEDULES ====================

  // ==================== QUICK ACTION TEMPLATES ====================

  // ==================== ENHANCED POLICY INTEGRATION ====================

  // Save policy selections from builder
  savePolicySelections: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        policySelections: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            policyType: z.string(),
            category: z.string(),
            relatedGovernmentComponents: z.array(z.string()).optional(),
            relatedEconomicComponents: z.array(z.string()).optional(),
            relatedTaxComponents: z.array(z.string()).optional(),
            gdpEffect: z.number().default(0),
            employmentEffect: z.number().default(0),
            inflationEffect: z.number().default(0),
            taxRevenueEffect: z.number().default(0),
            implementationCost: z.number().default(0),
            maintenanceCost: z.number().default(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      const results = [];

      for (const policyData of input.policySelections) {
        const policy = await ctx.db.policy.create({
          data: {
            countryId: input.countryId,
            userId: ctx.auth.userId,
            name: policyData.name,
            description: policyData.description,
            policyType: policyData.policyType,
            category: policyData.category,
            relatedGovernmentComponents: policyData.relatedGovernmentComponents
              ? JSON.stringify(policyData.relatedGovernmentComponents)
              : null,
            relatedEconomicComponents: policyData.relatedEconomicComponents
              ? JSON.stringify(policyData.relatedEconomicComponents)
              : null,
            relatedTaxComponents: policyData.relatedTaxComponents
              ? JSON.stringify(policyData.relatedTaxComponents)
              : null,
            gdpEffect: policyData.gdpEffect,
            employmentEffect: policyData.employmentEffect,
            inflationEffect: policyData.inflationEffect,
            taxRevenueEffect: policyData.taxRevenueEffect,
            implementationCost: policyData.implementationCost,
            maintenanceCost: policyData.maintenanceCost,
            status: "draft",
            priority: "medium",
          },
        });
        results.push(policy);
      }

      return results;
    }),

  // Calculate real-time policy effects
  calculatePolicyEffects: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const policies = await ctx.db.policy.findMany({
        where: {
          countryId: input.countryId,
          status: "active",
        },
      });

      const effects = {
        totalGdpEffect: 0,
        totalEmploymentEffect: 0,
        totalInflationEffect: 0,
        totalTaxRevenueEffect: 0,
        totalImplementationCost: 0,
        totalMaintenanceCost: 0,
        policyCount: policies.length,
        calculatedEffects: {} as Record<string, any>,
      };

      for (const policy of policies) {
        effects.totalGdpEffect += policy.gdpEffect;
        effects.totalEmploymentEffect += policy.employmentEffect;
        effects.totalInflationEffect += policy.inflationEffect;
        effects.totalTaxRevenueEffect += policy.taxRevenueEffect;
        effects.totalImplementationCost += policy.implementationCost;
        effects.totalMaintenanceCost += policy.maintenanceCost;

        // Calculate real-time effects based on country data
        const calculatedEffects = await calculateRealTimePolicyEffects(
          policy,
          input.countryId,
          ctx.db
        );
        effects.calculatedEffects[policy.id] = calculatedEffects;
      }

      return effects;
    }),

  // Get policies by selected atomic components
  getPoliciesByComponents: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        governmentComponents: z.array(z.string()).optional(),
        economicComponents: z.array(z.string()).optional(),
        taxComponents: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { countryId: input.countryId };

      // Filter policies based on component relationships
      if (
        input.governmentComponents?.length ||
        input.economicComponents?.length ||
        input.taxComponents?.length
      ) {
        where.OR = [];

        if (input.governmentComponents?.length) {
          where.OR.push({
            relatedGovernmentComponents: {
              not: null,
            },
          });
        }

        if (input.economicComponents?.length) {
          where.OR.push({
            relatedEconomicComponents: {
              not: null,
            },
          });
        }

        if (input.taxComponents?.length) {
          where.OR.push({
            relatedTaxComponents: {
              not: null,
            },
          });
        }
      }

      return await ctx.db.policy.findMany({
        where,
        orderBy: { priority: "asc" },
      });
    }),

  // Recalculate all policy effects
  recalculateAllPolicyEffects: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const policies = await ctx.db.policy.findMany({
        where: {
          countryId: input.countryId,
          status: "active",
        },
      });

      const results = [];

      for (const policy of policies) {
        // Calculate new effects based on current country state
        const newEffects = await calculateRealTimePolicyEffects(policy, input.countryId, ctx.db);

        // Update policy with calculated effects
        const updated = await ctx.db.policy.update({
          where: { id: policy.id },
          data: {
            calculatedEffects: JSON.stringify(newEffects),
            lastRecalculated: new Date(),
          },
        });

        results.push(updated);
      }

      return results;
    }),
});
