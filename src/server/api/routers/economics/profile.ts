// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { assertCountryAccess } from "./_ownership";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { notificationHooks } from "~/lib/notifications/hooks";

const economicsProfileRouter = createTRPCRouter({
  // ==================== ECONOMIC PROFILE ====================
  // Schema fields: gdpGrowthVolatility, economicComplexity, innovationIndex, competitivenessRank,
  // easeOfDoingBusiness, corruptionIndex, sectorBreakdown, exportsGDPPercent, importsGDPPercent, tradeBalance

  getEconomicProfile: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.economicProfile.findUnique({
        where: { countryId: input.countryId },
      });
    }),

  updateEconomicProfile: protectedProcedure
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      await assertCountryAccess(ctx, countryId);

      // Get previous values for comparison
      const previous = await ctx.db.economicProfile.findUnique({
        where: { countryId },
      });

      const result = await ctx.db.economicProfile.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data },
      });

      // Notify about economic vitality changes
      try {
        if (
          previous &&
          data.economicComplexity !== undefined &&
          previous.economicComplexity !== null
        ) {
          const change = Math.abs(data.economicComplexity - previous.economicComplexity);
          if (change > 10) {
            await notificationHooks.onVitalityScoreChange({
              countryId,
              userId: ctx.user?.id,
              dimension: "economic",
              currentScore: data.economicComplexity,
              previousScore: previous.economicComplexity,
              threshold: 10,
            });
          }
        }
      } catch (error) {
        console.error("[Economics] Failed to send notification:", error);
      }

      return result;
    }),

  // ==================== LABOR MARKET ====================
  // Schema fields: employmentBySector, youthUnemploymentRate, femaleParticipationRate,
  // informalEmploymentRate, medianWage, wageGrowthRate, wageBySector

  getLaborMarket: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.laborMarket.findUnique({
        where: { countryId: input.countryId },
      });
    }),

  updateLaborMarket: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        employmentBySector: z.string().optional(),
        youthUnemploymentRate: z.number().optional(),
        femaleParticipationRate: z.number().optional(),
        informalEmploymentRate: z.number().optional(),
        medianWage: z.number().optional(),
        wageGrowthRate: z.number().optional(),
        wageBySector: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      await assertCountryAccess(ctx, countryId);

      return await ctx.db.laborMarket.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data },
      });
    }),

  // ==================== FISCAL SYSTEM ====================
  // Schema fields: personalIncomeTaxRates, corporateTaxRates, salesTaxRate, propertyTaxRate,
  // payrollTaxRate, exciseTaxRates, wealthTaxRate, spendingByCategory,
  // fiscalBalanceGDPPercent, primaryBalanceGDPPercent, taxEfficiency

  // ==================== INCOME DISTRIBUTION ====================
  // Schema fields: economicClasses, top10PercentWealth, bottom50PercentWealth,
  // middleClassPercent, intergenerationalMobility, educationMobility

  // ==================== ECONOMY BUILDER CONFIGURATION ====================
  // Comprehensive save endpoint for the entire economy builder state

  // Get complete economy configuration

  // ==================== GOVERNMENT BUDGET ====================
  // Schema fields: spendingCategories, spendingEfficiency, publicInvestmentRate, socialSpendingPercent

  // ==================== DEMOGRAPHICS ====================
  // Schema fields: ageDistribution, regions, educationLevels, citizenshipStatuses,
  // birthRate, deathRate, migrationRate, dependencyRatio, medianAge, populationGrowthProjection

  getDemographics: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.demographics.findUnique({
        where: { countryId: input.countryId },
      });
    }),

  updateDemographics: protectedProcedure
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      await assertCountryAccess(ctx, countryId);

      return await ctx.db.demographics.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data },
      });
    }),

  // ==================== ECONOMY BUILDER LIVE WIRING ====================
  // Real-time economy builder configuration management

  // Save economy builder state with atomic components

  // Get economy builder state with all related data

  // Auto-save economy builder changes

  // Sync economy with government components

  // Sync economy with tax system
});

export { economicsProfileRouter };
