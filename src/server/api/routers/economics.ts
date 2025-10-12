// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const economicsRouter = createTRPCRouter({
  // ==================== ECONOMIC PROFILE ====================
  // Schema fields: gdpGrowthVolatility, economicComplexity, innovationIndex, competitivenessRank,
  // easeOfDoingBusiness, corruptionIndex, sectorBreakdown, exportsGDPPercent, importsGDPPercent, tradeBalance

  getEconomicProfile: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.economicProfile.findUnique({
        where: { countryId: input.countryId }
      });
    }),

  updateEconomicProfile: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      gdpGrowthVolatility: z.number().optional(),
      economicComplexity: z.number().optional(),
      innovationIndex: z.number().optional(),
      competitivenessRank: z.number().int().optional(),
      easeOfDoingBusiness: z.number().int().optional(),
      corruptionIndex: z.number().optional(),
      sectorBreakdown: z.string().optional(),
      exportsGDPPercent: z.number().optional(),
      importsGDPPercent: z.number().optional(),
      tradeBalance: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      // Verify user owns this country
      if (ctx.auth?.userId) {
        const userProfile = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth.userId }
        });
        if (!userProfile || userProfile.countryId !== countryId) {
          throw new Error('You do not have permission to edit this country.');
        }
      }

      return await ctx.db.economicProfile.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data }
      });
    }),

  // ==================== LABOR MARKET ====================
  // Schema fields: employmentBySector, youthUnemploymentRate, femaleParticipationRate,
  // informalEmploymentRate, medianWage, wageGrowthRate, wageBySector

  getLaborMarket: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.laborMarket.findUnique({
        where: { countryId: input.countryId }
      });
    }),

  updateLaborMarket: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      employmentBySector: z.string().optional(),
      youthUnemploymentRate: z.number().optional(),
      femaleParticipationRate: z.number().optional(),
      informalEmploymentRate: z.number().optional(),
      medianWage: z.number().optional(),
      wageGrowthRate: z.number().optional(),
      wageBySector: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      // Verify user owns this country
      if (ctx.auth?.userId) {
        const userProfile = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth.userId }
        });
        if (!userProfile || userProfile.countryId !== countryId) {
          throw new Error('You do not have permission to edit this country.');
        }
      }

      return await ctx.db.laborMarket.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data }
      });
    }),

  // ==================== FISCAL SYSTEM ====================
  // Schema fields: personalIncomeTaxRates, corporateTaxRates, salesTaxRate, propertyTaxRate,
  // payrollTaxRate, exciseTaxRates, wealthTaxRate, spendingByCategory,
  // fiscalBalanceGDPPercent, primaryBalanceGDPPercent, taxEfficiency

  getFiscalSystem: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.fiscalSystem.findUnique({
        where: { countryId: input.countryId }
      });
    }),

  updateFiscalSystem: protectedProcedure
    .input(z.object({
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
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      // Verify user owns this country
      if (ctx.auth?.userId) {
        const userProfile = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth.userId }
        });
        if (!userProfile || userProfile.countryId !== countryId) {
          throw new Error('You do not have permission to edit this country.');
        }
      }

      return await ctx.db.fiscalSystem.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data }
      });
    }),

  // ==================== INCOME DISTRIBUTION ====================
  // Schema fields: economicClasses, top10PercentWealth, bottom50PercentWealth,
  // middleClassPercent, intergenerationalMobility, educationMobility

  getIncomeDistribution: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.incomeDistribution.findUnique({
        where: { countryId: input.countryId }
      });
    }),

  updateIncomeDistribution: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      economicClasses: z.string().optional(),
      top10PercentWealth: z.number().optional(),
      bottom50PercentWealth: z.number().optional(),
      middleClassPercent: z.number().optional(),
      intergenerationalMobility: z.number().optional(),
      educationMobility: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      // Verify user owns this country
      if (ctx.auth?.userId) {
        const userProfile = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth.userId }
        });
        if (!userProfile || userProfile.countryId !== countryId) {
          throw new Error('You do not have permission to edit this country.');
        }
      }

      return await ctx.db.incomeDistribution.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data }
      });
    }),

  // ==================== GOVERNMENT BUDGET ====================
  // Schema fields: spendingCategories, spendingEfficiency, publicInvestmentRate, socialSpendingPercent

  getGovernmentBudget: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.governmentBudget.findUnique({
        where: { countryId: input.countryId }
      });
    }),

  updateGovernmentBudget: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      spendingCategories: z.string().optional(),
      spendingEfficiency: z.number().optional(),
      publicInvestmentRate: z.number().optional(),
      socialSpendingPercent: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      // Verify user owns this country
      if (ctx.auth?.userId) {
        const userProfile = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth.userId }
        });
        if (!userProfile || userProfile.countryId !== countryId) {
          throw new Error('You do not have permission to edit this country.');
        }
      }

      return await ctx.db.governmentBudget.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data }
      });
    }),

  // ==================== DEMOGRAPHICS ====================
  // Schema fields: ageDistribution, regions, educationLevels, citizenshipStatuses,
  // birthRate, deathRate, migrationRate, dependencyRatio, medianAge, populationGrowthProjection

  getDemographics: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.demographics.findUnique({
        where: { countryId: input.countryId }
      });
    }),

  updateDemographics: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      ageDistribution: z.string().optional(),
      regions: z.string().optional(),
      educationLevels: z.string().optional(),
      citizenshipStatuses: z.string().optional(),
      birthRate: z.number().optional(),
      deathRate: z.number().optional(),
      migrationRate: z.number().optional(),
      dependencyRatio: z.number().optional(),
      medianAge: z.number().optional(),
      populationGrowthProjection: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      // Verify user owns this country
      if (ctx.auth?.userId) {
        const userProfile = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth.userId }
        });
        if (!userProfile || userProfile.countryId !== countryId) {
          throw new Error('You do not have permission to edit this country.');
        }
      }

      return await ctx.db.demographics.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data }
      });
    }),
});
