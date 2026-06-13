// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

const economicsFiscalRouter = createTRPCRouter({
  // ==================== ECONOMIC PROFILE ====================
  // Schema fields: gdpGrowthVolatility, economicComplexity, innovationIndex, competitivenessRank,
  // easeOfDoingBusiness, corruptionIndex, sectorBreakdown, exportsGDPPercent, importsGDPPercent, tradeBalance

  // ==================== LABOR MARKET ====================
  // Schema fields: employmentBySector, youthUnemploymentRate, femaleParticipationRate,
  // informalEmploymentRate, medianWage, wageGrowthRate, wageBySector

  // ==================== FISCAL SYSTEM ====================
  // Schema fields: personalIncomeTaxRates, corporateTaxRates, salesTaxRate, propertyTaxRate,
  // payrollTaxRate, exciseTaxRates, wealthTaxRate, spendingByCategory,
  // fiscalBalanceGDPPercent, primaryBalanceGDPPercent, taxEfficiency

  getFiscalSystem: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.fiscalSystem.findUnique({
        where: { countryId: input.countryId },
      });
    }),

  updateFiscalSystem: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        personalIncomeTaxRates: z.string().optional(),
        corporateTaxRates: z.string().optional(),
        salesTaxRate: z.number().optional(),
        propertyTaxRate: z.number().optional(),
        payrollTaxRate: z.number().optional(),
        exciseTaxRates: z.string().optional(),
        wealthTaxRate: z.number().optional(),
        spendingByCategory: z.string().optional(),
        fiscalBalanceGDPPercent: z.number().optional(),
        primaryBalanceGDPPercent: z.number().optional(),
        taxEfficiency: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      // SECURITY: Verify user owns this country
      if (ctx.user?.countryId !== countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access other countries' economic data",
        });
      }

      return await ctx.db.fiscalSystem.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data },
      });
    }),

  // ==================== INCOME DISTRIBUTION ====================
  // Schema fields: economicClasses, top10PercentWealth, bottom50PercentWealth,
  // middleClassPercent, intergenerationalMobility, educationMobility

  getIncomeDistribution: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.incomeDistribution.findUnique({
        where: { countryId: input.countryId },
      });
    }),

  updateIncomeDistribution: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        economicClasses: z.string().optional(),
        top10PercentWealth: z.number().optional(),
        bottom50PercentWealth: z.number().optional(),
        middleClassPercent: z.number().optional(),
        intergenerationalMobility: z.number().optional(),
        educationMobility: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      // SECURITY: Verify user owns this country
      if (ctx.user?.countryId !== countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access other countries' economic data",
        });
      }

      return await ctx.db.incomeDistribution.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data },
      });
    }),

  // ==================== ECONOMY BUILDER CONFIGURATION ====================
  // Comprehensive save endpoint for the entire economy builder state

  // Get complete economy configuration

  // ==================== GOVERNMENT BUDGET ====================
  // Schema fields: spendingCategories, spendingEfficiency, publicInvestmentRate, socialSpendingPercent

  getGovernmentBudget: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.governmentBudget.findUnique({
        where: { countryId: input.countryId },
      });
    }),

  updateGovernmentBudget: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        spendingCategories: z.string().optional(),
        spendingEfficiency: z.number().optional(),
        publicInvestmentRate: z.number().optional(),
        socialSpendingPercent: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      // SECURITY: Verify user owns this country
      if (ctx.user?.countryId !== countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access other countries' economic data",
        });
      }

      return await ctx.db.governmentBudget.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data },
      });
    }),

  // ==================== DEMOGRAPHICS ====================
  // Schema fields: ageDistribution, regions, educationLevels, citizenshipStatuses,
  // birthRate, deathRate, migrationRate, dependencyRatio, medianAge, populationGrowthProjection

  // ==================== ECONOMY BUILDER LIVE WIRING ====================
  // Real-time economy builder configuration management

  // Save economy builder state with atomic components

  // Get economy builder state with all related data

  // Auto-save economy builder changes

  // Sync economy with government components

  // Sync economy with tax system
});

export { economicsFiscalRouter };
