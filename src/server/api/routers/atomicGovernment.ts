import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { ComponentType } from "@prisma/client";

export const atomicGovernmentRouter = createTRPCRouter({
  // Get all government components for a country
  getComponents: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.governmentComponent.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        orderBy: {
          effectivenessScore: "desc",
        },
      });
    }),

  // Create a new government component
  createComponent: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        componentType: z.nativeEnum(ComponentType),
        effectivenessScore: z.number().min(0).max(100).default(50),
        implementationCost: z.number().default(0),
        maintenanceCost: z.number().default(0),
        requiredCapacity: z.number().min(0).max(100).default(50),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if component already exists for this country
      const existing = await ctx.db.governmentComponent.findFirst({
        where: {
          countryId: input.countryId,
          componentType: input.componentType,
          isActive: true,
        },
      });

      if (existing) {
        throw new Error(`Component ${input.componentType} already exists for this country`);
      }

      return ctx.db.governmentComponent.create({
        data: {
          countryId: input.countryId,
          componentType: input.componentType,
          effectivenessScore: input.effectivenessScore,
          implementationCost: input.implementationCost,
          maintenanceCost: input.maintenanceCost,
          requiredCapacity: input.requiredCapacity,
          notes: input.notes,
        },
      });
    }),

  // Update government component
  updateComponent: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        effectivenessScore: z.number().min(0).max(100).optional(),
        implementationCost: z.number().optional(),
        maintenanceCost: z.number().optional(),
        requiredCapacity: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      return ctx.db.governmentComponent.update({
        where: { id },
        data: updateData,
      });
    }),

  // Remove/deactivate government component
  removeComponent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.governmentComponent.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  // Get component synergies for a country
  getSynergies: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.componentSynergy.findMany({
        where: {
          countryId: input.countryId,
        },
        include: {
          primaryComponent: true,
          secondaryComponent: true,
        },
      });
    }),

  // Create component synergy
  createSynergy: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        primaryComponentId: z.string(),
        secondaryComponentId: z.string(),
        synergyType: z.enum(["MULTIPLICATIVE", "ADDITIVE", "CONFLICTING"]),
        effectMultiplier: z.number().default(1.0),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if synergy already exists
      const existing = await ctx.db.componentSynergy.findFirst({
        where: {
          OR: [
            {
              primaryComponentId: input.primaryComponentId,
              secondaryComponentId: input.secondaryComponentId,
            },
            {
              primaryComponentId: input.secondaryComponentId,
              secondaryComponentId: input.primaryComponentId,
            },
          ],
        },
      });

      if (existing) {
        throw new Error("Synergy relationship already exists between these components");
      }

      return ctx.db.componentSynergy.create({
        data: input,
      });
    }),

  // Get government effectiveness analysis
  getEffectivenessAnalysis: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const components = await ctx.db.governmentComponent.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
      });

      if (components.length === 0) {
        return {
          overallEffectiveness: 0,
          totalComponents: 0,
          categoryBreakdown: {},
          recommendations: [],
        };
      }

      const synergies = await ctx.db.componentSynergy.findMany({
        where: {
          countryId: input.countryId,
        },
        include: {
          primaryComponent: true,
          secondaryComponent: true,
        },
      });

      // Calculate overall effectiveness with synergies
      const baseEffectiveness =
        components.reduce((sum, c) => sum + c.effectivenessScore, 0) / components.length;

      // Apply synergy modifiers
      let synergyBonus = 0;
      synergies.forEach((synergy) => {
        if (synergy.synergyType === "MULTIPLICATIVE") {
          synergyBonus += (synergy.effectMultiplier - 1) * 10;
        } else if (synergy.synergyType === "ADDITIVE") {
          synergyBonus += synergy.effectMultiplier * 5;
        } else if (synergy.synergyType === "CONFLICTING") {
          synergyBonus -= synergy.effectMultiplier * 10;
        }
      });

      const overallEffectiveness = Math.max(0, Math.min(100, baseEffectiveness + synergyBonus));

      // Category breakdown
      const categoryBreakdown: Record<string, { count: number; avgEffectiveness: number }> = {};

      components.forEach((component) => {
        const category = component.componentType.split("_")[0]; // Get first part as category
        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = { count: 0, avgEffectiveness: 0 };
        }
        categoryBreakdown[category].count++;
        categoryBreakdown[category].avgEffectiveness += component.effectivenessScore;
      });

      Object.keys(categoryBreakdown).forEach((category) => {
        categoryBreakdown[category]!.avgEffectiveness =
          categoryBreakdown[category]!.avgEffectiveness / categoryBreakdown[category]!.count;
      });

      // Generate recommendations
      const recommendations: string[] = [];

      if (overallEffectiveness < 70) {
        recommendations.push("Consider adding more high-effectiveness components");
      }

      if (synergies.filter((s) => s.synergyType === "CONFLICTING").length > 0) {
        recommendations.push("Review conflicting components to improve system harmony");
      }

      if (components.length < 5) {
        recommendations.push("Expand government structure with additional specialized components");
      }

      const totalCost = components.reduce(
        (sum, c) => sum + c.implementationCost + c.maintenanceCost,
        0
      );

      return {
        overallEffectiveness: Math.round(overallEffectiveness),
        totalComponents: components.length,
        totalCost,
        categoryBreakdown,
        recommendations,
        synergyCount: synergies.length,
        conflictCount: synergies.filter((s) => s.synergyType === "CONFLICTING").length,
      };
    }),

  // Get budget scenarios for country
  getBudgetScenarios: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.budgetScenario.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        include: {
          categories: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }),

  // Create budget scenario
  createBudgetScenario: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        totalBudget: z.number(),
        assumptions: z.string().optional(),
        riskLevel: z.enum(["low", "medium", "high"]),
        feasibility: z.number().min(0).max(100).default(50),
        categories: z.array(
          z.object({
            categoryName: z.string(),
            allocatedAmount: z.number(),
            allocatedPercent: z.number(),
            priority: z.enum(["critical", "high", "medium", "low"]),
            efficiency: z.number().min(0).max(100).default(50),
            performance: z.number().min(0).max(100).default(50),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { categories, ...scenarioData } = input;

      const scenario = await ctx.db.budgetScenario.create({
        data: scenarioData,
      });

      // Create scenario categories
      await ctx.db.budgetScenarioCategory.createMany({
        data: categories.map((category) => ({
          ...category,
          scenarioId: scenario.id,
        })),
      });

      return scenario;
    }),

  // Get fiscal policies for country
  getFiscalPolicies: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.fiscalPolicy.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }),

  // Create fiscal policy
  createFiscalPolicy: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string(),
        policyType: z.enum(["TAX_POLICY", "SPENDING_POLICY", "DEBT_POLICY"]),
        impact: z.number(),
        implementation: z.enum(["IMMEDIATE", "SHORT_TERM", "LONG_TERM"]),
        cost: z.number(),
        benefits: z.number(),
        description: z.string().optional(),
        appliedDate: z.date().optional(),
        expiryDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.fiscalPolicy.create({
        data: input,
      });
    }),

  // Apply fiscal policy
  applyFiscalPolicy: protectedProcedure
    .input(
      z.object({
        policyId: z.string(),
        measuredImpact: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.fiscalPolicy.update({
        where: { id: input.policyId },
        data: {
          appliedDate: new Date(),
          measuredImpact: input.measuredImpact,
        },
      });
    }),
});
