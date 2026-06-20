// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { assertCountryAccess } from "./_ownership";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

const economicsConfigRouter = createTRPCRouter({
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

  // ==================== INCOME DISTRIBUTION ====================
  // Schema fields: economicClasses, top10PercentWealth, bottom50PercentWealth,
  // middleClassPercent, intergenerationalMobility, educationMobility

  // ==================== ECONOMY BUILDER CONFIGURATION ====================
  // Comprehensive save endpoint for the entire economy builder state

  saveEconomyConfiguration: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        configuration: z.object({
          // Economic Structure
          structure: z.object({
            economicModel: z.string(),
            primarySectors: z.array(z.string()),
            secondarySectors: z.array(z.string()),
            tertiarySectors: z.array(z.string()),
            totalGDP: z.number(),
            gdpCurrency: z.string(),
            economicTier: z.enum(["Developing", "Emerging", "Developed", "Advanced"]),
            growthStrategy: z.enum([
              "Export-Led",
              "Import-Substitution",
              "Balanced",
              "Innovation-Driven",
            ]),
          }),

          // Sectors Configuration
          sectors: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              category: z.enum(["Primary", "Secondary", "Tertiary"]),
              gdpContribution: z.number(),
              employmentShare: z.number(),
              productivity: z.number(),
              growthRate: z.number(),
              exports: z.number(),
              imports: z.number(),
              technologyLevel: z.enum(["Traditional", "Modern", "Advanced", "Cutting-Edge"]),
              automation: z.number(),
              regulation: z.enum(["Light", "Moderate", "Heavy", "Comprehensive"]),
              subsidy: z.number(),
              innovation: z.number(),
              sustainability: z.number(),
              competitiveness: z.number(),
            })
          ),

          // Labor Market Configuration
          laborMarket: z.object({
            totalWorkforce: z.number(),
            laborForceParticipationRate: z.number(),
            employmentRate: z.number(),
            unemploymentRate: z.number(),
            underemploymentRate: z.number(),
            youthUnemploymentRate: z.number(),
            seniorEmploymentRate: z.number(),
            femaleParticipationRate: z.number(),
            maleParticipationRate: z.number(),
            averageWorkweekHours: z.number(),
            minimumWageHourly: z.number(),
            livingWageHourly: z.number(),
            unionizationRate: z.number(),
            collectiveBargainingCoverage: z.number(),
            workplaceSafetyIndex: z.number(),
            laborRightsScore: z.number(),
          }),

          // Demographics Configuration
          demographics: z.object({
            totalPopulation: z.number(),
            populationGrowthRate: z.number(),
            urbanRuralSplit: z.object({
              urban: z.number(),
              rural: z.number(),
            }),
            lifeExpectancy: z.number(),
            literacyRate: z.number(),
            netMigrationRate: z.number(),
            infantMortalityRate: z.number(),
            healthExpenditureGDP: z.number(),
          }),

          // Selected Atomic Components
          selectedAtomicComponents: z.array(z.string()),

          // Metadata
          lastUpdated: z.date().optional(),
          version: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, configuration } = input;

      await assertCountryAccess(ctx, countryId);

      // Start transaction to update multiple tables
      const result = await ctx.db.$transaction(async (tx) => {
        // Update Economic Profile
        const economicProfile = await tx.economicProfile.upsert({
          where: { countryId },
          update: {
            gdpGrowthVolatility:
              configuration.sectors.reduce((sum, s) => sum + Math.abs(s.growthRate - 2.5), 0) /
              configuration.sectors.length,
            economicComplexity:
              configuration.structure.economicTier === "Advanced"
                ? 85
                : configuration.structure.economicTier === "Developed"
                  ? 70
                  : configuration.structure.economicTier === "Emerging"
                    ? 55
                    : 40,
            innovationIndex:
              configuration.sectors.reduce((sum, s) => sum + s.innovation, 0) /
              configuration.sectors.length,
            competitivenessRank: Math.round(
              100 -
                configuration.sectors.reduce((sum, s) => sum + s.competitiveness, 0) /
                  configuration.sectors.length
            ),
            sectorBreakdown: JSON.stringify(
              configuration.sectors.map((s) => ({
                name: s.name,
                gdp: s.gdpContribution,
                employment: s.employmentShare,
              }))
            ),
            exportsGDPPercent: configuration.sectors.reduce(
              (sum, s) => sum + (s.exports * s.gdpContribution) / 100,
              0
            ),
            importsGDPPercent: configuration.sectors.reduce(
              (sum, s) => sum + (s.imports * s.gdpContribution) / 100,
              0
            ),
            tradeBalance:
              configuration.structure.totalGDP *
              configuration.sectors.reduce(
                (sum, s) => sum + ((s.exports - s.imports) * s.gdpContribution) / 10000,
                0
              ),
          },
          create: {
            countryId,
            gdpGrowthVolatility: 2.5,
            economicComplexity: 50,
            innovationIndex: 50,
            competitivenessRank: 50,
            sectorBreakdown: JSON.stringify(configuration.sectors),
            exportsGDPPercent: 20,
            importsGDPPercent: 22,
            tradeBalance: -2,
          },
        });

        // Update Labor Market
        const laborMarket = await tx.laborMarket.upsert({
          where: { countryId },
          update: {
            youthUnemploymentRate: configuration.laborMarket.youthUnemploymentRate,
            femaleParticipationRate: configuration.laborMarket.femaleParticipationRate,
            medianWage: configuration.laborMarket.livingWageHourly * 2000, // Annual approximation
            wageGrowthRate: 2.5, // Default, could be calculated
            employmentBySector: JSON.stringify(
              configuration.sectors.map((s) => ({
                sector: s.name,
                employment: s.employmentShare,
              }))
            ),
          },
          create: {
            countryId,
            youthUnemploymentRate: configuration.laborMarket.youthUnemploymentRate,
            femaleParticipationRate: configuration.laborMarket.femaleParticipationRate,
            medianWage: configuration.laborMarket.livingWageHourly * 2000,
            wageGrowthRate: 2.5,
            employmentBySector: JSON.stringify({}),
            wageBySector: JSON.stringify({}),
          },
        });

        // Update Country with atomic components and economy data
        const country = await tx.country.update({
          where: { id: countryId },
          data: {
            // Note: economic components are stored in government components relation

            // Update core indicators using correct field names
            currentTotalGdp: configuration.structure.totalGDP,
            currentGdpPerCapita:
              configuration.structure.totalGDP / configuration.demographics.totalPopulation,
            actualGdpGrowth: configuration.sectors.reduce(
              (sum, s) => sum + (s.growthRate * s.gdpContribution) / 100,
              0
            ),
            currentPopulation: configuration.demographics.totalPopulation,
            populationGrowthRate: configuration.demographics.populationGrowthRate,
            unemploymentRate: configuration.laborMarket.unemploymentRate,
            laborForceParticipationRate: configuration.laborMarket.laborForceParticipationRate,
            urbanPopulationPercent: configuration.demographics.urbanRuralSplit.urban,
            lifeExpectancy: configuration.demographics.lifeExpectancy,
            literacyRate: configuration.demographics.literacyRate,

            // Update calculated fields
            economicTier: configuration.structure.economicTier,
            updatedAt: new Date(),
          },
        });

        return { economicProfile, laborMarket, country };
      });

      return {
        success: true,
        countryId,
        message: "Economy configuration saved successfully",
        data: result,
      };
    }),

  // Get complete economy configuration
  getEconomyConfiguration: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          economicProfile: true,
          laborMarket: true,
          fiscalSystem: true,
          incomeDistribution: true,
          economicModel: true,
          nationalIdentity: true,
        },
      });

      if (!country) {
        return null;
      }

      // Transform database data back to builder configuration format
      return {
        structure: {
          economicModel: "Mixed Economy",
          primarySectors: [],
          secondarySectors: [],
          tertiarySectors: [],
          totalGDP: country.currentTotalGdp || 0,
          gdpCurrency: country.nationalIdentity?.currency || "USD",
          economicTier: country.economicTier || "Developing",
          growthStrategy: "Balanced",
        },
        sectors: country.economicProfile?.sectorBreakdown
          ? JSON.parse(country.economicProfile.sectorBreakdown)
          : [],
        laborMarket: {
          totalWorkforce: Math.round(
            ((country.currentPopulation || 0) * (country.laborForceParticipationRate || 65)) / 100
          ),
          laborForceParticipationRate: country.laborForceParticipationRate || 65,
          unemploymentRate: country.unemploymentRate || 5,
          youthUnemploymentRate: country.laborMarket?.youthUnemploymentRate || 10,
          femaleParticipationRate: country.laborMarket?.femaleParticipationRate || 60,
        },
        demographics: {
          totalPopulation: country.currentPopulation || 0,
          populationGrowthRate: country.populationGrowthRate || 0,
          urbanRuralSplit: {
            urban: country.urbanPopulationPercent || 50,
            rural: 100 - (country.urbanPopulationPercent || 50),
          },
          lifeExpectancy: country.lifeExpectancy || 75,
          literacyRate: country.literacyRate || 90,
        },
        selectedAtomicComponents: [], // Will be populated from government components
        lastUpdated: country.updatedAt,
        version: "1.0.0",
      };
    }),

  // ==================== GOVERNMENT BUDGET ====================
  // Schema fields: spendingCategories, spendingEfficiency, publicInvestmentRate, socialSpendingPercent

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

export { economicsConfigRouter };
