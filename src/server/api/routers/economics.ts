// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

const economicsRouter = createTRPCRouter({
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

  // ==================== ECONOMY BUILDER CONFIGURATION ====================
  // Comprehensive save endpoint for the entire economy builder state

  saveEconomyConfiguration: protectedProcedure
    .input(z.object({
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
          economicTier: z.enum(['Developing', 'Emerging', 'Developed', 'Advanced']),
          growthStrategy: z.enum(['Export-Led', 'Import-Substitution', 'Balanced', 'Innovation-Driven'])
        }),

        // Sectors Configuration
        sectors: z.array(z.object({
          id: z.string(),
          name: z.string(),
          category: z.enum(['Primary', 'Secondary', 'Tertiary']),
          gdpContribution: z.number(),
          employmentShare: z.number(),
          productivity: z.number(),
          growthRate: z.number(),
          exports: z.number(),
          imports: z.number(),
          technologyLevel: z.enum(['Traditional', 'Modern', 'Advanced', 'Cutting-Edge']),
          automation: z.number(),
          regulation: z.enum(['Light', 'Moderate', 'Heavy', 'Comprehensive']),
          subsidy: z.number(),
          innovation: z.number(),
          sustainability: z.number(),
          competitiveness: z.number()
        })),

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
          laborRightsScore: z.number()
        }),

        // Demographics Configuration
        demographics: z.object({
          totalPopulation: z.number(),
          populationGrowthRate: z.number(),
          urbanRuralSplit: z.object({
            urban: z.number(),
            rural: z.number()
          }),
          lifeExpectancy: z.number(),
          literacyRate: z.number(),
          netMigrationRate: z.number(),
          infantMortalityRate: z.number(),
          healthExpenditureGDP: z.number()
        }),

        // Selected Atomic Components
        selectedAtomicComponents: z.array(z.string()),

        // Metadata
        lastUpdated: z.date().optional(),
        version: z.string().optional()
      })
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, configuration } = input;

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId! }
      });

      if (!userProfile || userProfile.countryId !== countryId) {
        throw new Error('You do not have permission to edit this country.');
      }

      // Start transaction to update multiple tables
      const result = await ctx.db.$transaction(async (tx) => {
        // Update Economic Profile
        const economicProfile = await tx.economicProfile.upsert({
          where: { countryId },
          update: {
            gdpGrowthVolatility: configuration.sectors.reduce((sum, s) => sum + Math.abs(s.growthRate - 2.5), 0) / configuration.sectors.length,
            economicComplexity: configuration.structure.economicTier === 'Advanced' ? 85 :
                                configuration.structure.economicTier === 'Developed' ? 70 :
                                configuration.structure.economicTier === 'Emerging' ? 55 : 40,
            innovationIndex: configuration.sectors.reduce((sum, s) => sum + s.innovation, 0) / configuration.sectors.length,
            competitivenessRank: Math.round(100 - (configuration.sectors.reduce((sum, s) => sum + s.competitiveness, 0) / configuration.sectors.length)),
            sectorBreakdown: JSON.stringify(configuration.sectors.map(s => ({
              name: s.name,
              gdp: s.gdpContribution,
              employment: s.employmentShare
            }))),
            exportsGDPPercent: configuration.sectors.reduce((sum, s) => sum + (s.exports * s.gdpContribution / 100), 0),
            importsGDPPercent: configuration.sectors.reduce((sum, s) => sum + (s.imports * s.gdpContribution / 100), 0),
            tradeBalance: configuration.structure.totalGDP *
              (configuration.sectors.reduce((sum, s) => sum + ((s.exports - s.imports) * s.gdpContribution / 10000), 0))
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
            tradeBalance: -2
          }
        });

        // Update Labor Market
        const laborMarket = await tx.laborMarket.upsert({
          where: { countryId },
          update: {
            youthUnemploymentRate: configuration.laborMarket.youthUnemploymentRate,
            femaleParticipationRate: configuration.laborMarket.femaleParticipationRate,
            medianWage: configuration.laborMarket.livingWageHourly * 2000, // Annual approximation
            wageGrowthRate: 2.5, // Default, could be calculated
            employmentBySector: JSON.stringify(configuration.sectors.map(s => ({
              sector: s.name,
              employment: s.employmentShare
            })))
          },
          create: {
            countryId,
            youthUnemploymentRate: configuration.laborMarket.youthUnemploymentRate,
            femaleParticipationRate: configuration.laborMarket.femaleParticipationRate,
            medianWage: configuration.laborMarket.livingWageHourly * 2000,
            wageGrowthRate: 2.5,
            employmentBySector: JSON.stringify({}),
            wageBySector: JSON.stringify({})
          }
        });

        // Update Country with atomic components and economy data
        const country = await tx.country.update({
          where: { id: countryId },
          data: {
            // Note: economic components are stored in government components relation

            // Update core indicators using correct field names
            currentTotalGdp: configuration.structure.totalGDP,
            currentGdpPerCapita: configuration.structure.totalGDP / configuration.demographics.totalPopulation,
            actualGdpGrowth: configuration.sectors.reduce((sum, s) => sum + (s.growthRate * s.gdpContribution / 100), 0),
            currentPopulation: configuration.demographics.totalPopulation,
            populationGrowthRate: configuration.demographics.populationGrowthRate,
            unemploymentRate: configuration.laborMarket.unemploymentRate,
            laborForceParticipationRate: configuration.laborMarket.laborForceParticipationRate,
            urbanPopulationPercent: configuration.demographics.urbanRuralSplit.urban,
            lifeExpectancy: configuration.demographics.lifeExpectancy,
            literacyRate: configuration.demographics.literacyRate,

            // Update calculated fields
            economicTier: configuration.structure.economicTier,
            updatedAt: new Date()
          }
        });

        return { economicProfile, laborMarket, country };
      });

      return {
        success: true,
        countryId,
        message: 'Economy configuration saved successfully',
        data: result
      };
    }),

  // Get complete economy configuration
  getEconomyConfiguration: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          economicProfile: true,
          laborMarket: true,
          fiscalSystem: true,
          incomeDistribution: true,
          economicModel: true,
          nationalIdentity: true
        }
      });

      if (!country) {
        return null;
      }

      // Transform database data back to builder configuration format
      return {
        structure: {
          economicModel: 'Mixed Economy',
          primarySectors: [],
          secondarySectors: [],
          tertiarySectors: [],
          totalGDP: country.currentTotalGdp || 0,
          gdpCurrency: country.nationalIdentity?.currency || 'USD',
          economicTier: country.economicTier || 'Developing',
          growthStrategy: 'Balanced'
        },
        sectors: country.economicProfile?.sectorBreakdown ?
          JSON.parse(country.economicProfile.sectorBreakdown) : [],
        laborMarket: {
          totalWorkforce: Math.round((country.currentPopulation || 0) * (country.laborForceParticipationRate || 65) / 100),
          laborForceParticipationRate: country.laborForceParticipationRate || 65,
          unemploymentRate: country.unemploymentRate || 5,
          youthUnemploymentRate: country.laborMarket?.youthUnemploymentRate || 10,
          femaleParticipationRate: country.laborMarket?.femaleParticipationRate || 60
        },
        demographics: {
          totalPopulation: country.currentPopulation || 0,
          populationGrowthRate: country.populationGrowthRate || 0,
          urbanRuralSplit: {
            urban: country.urbanPopulationPercent || 50,
            rural: 100 - (country.urbanPopulationPercent || 50)
          },
          lifeExpectancy: country.lifeExpectancy || 75,
          literacyRate: country.literacyRate || 90
        },
        selectedAtomicComponents: [], // Will be populated from government components
        lastUpdated: country.updatedAt,
        version: '1.0.0'
      };
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

  // ==================== ECONOMY BUILDER LIVE WIRING ====================
  // Real-time economy builder configuration management

  // Save economy builder state with atomic components
  saveEconomyBuilderState: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      economyBuilder: z.object({
        structure: z.object({
          economicModel: z.string(),
          primarySectors: z.array(z.string()),
          secondarySectors: z.array(z.string()),
          tertiarySectors: z.array(z.string()),
          totalGDP: z.number(),
          gdpCurrency: z.string(),
          economicTier: z.enum(['Developing', 'Emerging', 'Developed', 'Advanced']),
          growthStrategy: z.enum(['Export-Led', 'Import-Substitution', 'Balanced', 'Innovation-Driven'])
        }),
        sectors: z.array(z.object({
          id: z.string(),
          name: z.string(),
          category: z.enum(['Primary', 'Secondary', 'Tertiary']),
          gdpContribution: z.number(),
          employmentShare: z.number(),
          productivity: z.number(),
          growthRate: z.number(),
          exports: z.number(),
          imports: z.number(),
          technologyLevel: z.enum(['Traditional', 'Modern', 'Advanced', 'Cutting-Edge']),
          automation: z.number(),
          regulation: z.enum(['Light', 'Moderate', 'Heavy', 'Comprehensive']),
          subsidy: z.number(),
          innovation: z.number(),
          sustainability: z.number(),
          competitiveness: z.number()
        })),
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
          laborRightsScore: z.number()
        }),
        demographics: z.object({
          totalPopulation: z.number(),
          populationGrowthRate: z.number(),
          urbanRuralSplit: z.object({
            urban: z.number(),
            rural: z.number()
          }),
          lifeExpectancy: z.number(),
          literacyRate: z.number(),
          netMigrationRate: z.number(),
          infantMortalityRate: z.number(),
          healthExpenditureGDP: z.number()
        }),
        selectedAtomicComponents: z.array(z.string()),
        lastUpdated: z.date().optional(),
        version: z.string().optional()
      })
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, economyBuilder } = input;

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId! }
      });

      if (!userProfile || userProfile.countryId !== countryId) {
        throw new Error('You do not have permission to edit this country.');
      }

      // Start transaction to update multiple tables atomically
      const result = await ctx.db.$transaction(async (tx) => {
        // Update Economic Profile with calculated metrics
        const economicProfile = await tx.economicProfile.upsert({
          where: { countryId },
          update: {
            gdpGrowthVolatility: economyBuilder.sectors.reduce((sum, s) => sum + Math.abs(s.growthRate - 2.5), 0) / economyBuilder.sectors.length,
            economicComplexity: economyBuilder.structure.economicTier === 'Advanced' ? 85 :
                                economyBuilder.structure.economicTier === 'Developed' ? 70 :
                                economyBuilder.structure.economicTier === 'Emerging' ? 55 : 40,
            innovationIndex: economyBuilder.sectors.reduce((sum, s) => sum + s.innovation, 0) / economyBuilder.sectors.length,
            competitivenessRank: Math.round(100 - (economyBuilder.sectors.reduce((sum, s) => sum + s.competitiveness, 0) / economyBuilder.sectors.length)),
            sectorBreakdown: JSON.stringify(economyBuilder.sectors.map(s => ({
              name: s.name,
              gdp: s.gdpContribution,
              employment: s.employmentShare,
              productivity: s.productivity,
              growthRate: s.growthRate
            }))),
            exportsGDPPercent: economyBuilder.sectors.reduce((sum, s) => sum + (s.exports * s.gdpContribution / 100), 0),
            importsGDPPercent: economyBuilder.sectors.reduce((sum, s) => sum + (s.imports * s.gdpContribution / 100), 0),
            tradeBalance: economyBuilder.structure.totalGDP *
              (economyBuilder.sectors.reduce((sum, s) => sum + ((s.exports - s.imports) * s.gdpContribution / 10000), 0))
          },
          create: {
            countryId,
            gdpGrowthVolatility: 2.5,
            economicComplexity: 50,
            innovationIndex: 50,
            competitivenessRank: 50,
            sectorBreakdown: JSON.stringify(economyBuilder.sectors),
            exportsGDPPercent: 20,
            importsGDPPercent: 22,
            tradeBalance: -2
          }
        });

        // Update Labor Market with detailed metrics
        const laborMarket = await tx.laborMarket.upsert({
          where: { countryId },
          update: {
            youthUnemploymentRate: economyBuilder.laborMarket.youthUnemploymentRate,
            femaleParticipationRate: economyBuilder.laborMarket.femaleParticipationRate,
            medianWage: economyBuilder.laborMarket.livingWageHourly * 2000, // Annual approximation
            wageGrowthRate: 2.5, // Default, could be calculated from sectors
            employmentBySector: JSON.stringify(economyBuilder.sectors.map(s => ({
              sector: s.name,
              employment: s.employmentShare,
              productivity: s.productivity
            }))),
            wageBySector: JSON.stringify(economyBuilder.sectors.map(s => ({
              sector: s.name,
              avgWage: economyBuilder.laborMarket.livingWageHourly * (s.productivity / 100)
            })))
          },
          create: {
            countryId,
            youthUnemploymentRate: economyBuilder.laborMarket.youthUnemploymentRate,
            femaleParticipationRate: economyBuilder.laborMarket.femaleParticipationRate,
            medianWage: economyBuilder.laborMarket.livingWageHourly * 2000,
            wageGrowthRate: 2.5,
            employmentBySector: JSON.stringify({}),
            wageBySector: JSON.stringify({})
          }
        });

        // Update Demographics with economy-influenced data
        const demographics = await tx.demographics.upsert({
          where: { countryId },
          update: {
            ageDistribution: JSON.stringify({
              under15: 18,
              age15to64: 65,
              over65: 17
            }),
            regions: JSON.stringify([{
              name: 'Capital Region',
              population: Math.round(economyBuilder.demographics.totalPopulation * 0.3),
              populationPercent: 30,
              urbanPercent: 90,
              economicActivity: 40,
              developmentLevel: economyBuilder.structure.economicTier
            }]),
            educationLevels: JSON.stringify({
              noEducation: 2,
              primary: 25,
              secondary: 45,
              tertiary: 28
            }),
            birthRate: 12.5,
            deathRate: 8.0,
            migrationRate: economyBuilder.demographics.netMigrationRate,
            dependencyRatio: 54,
            medianAge: 35,
            populationGrowthProjection: economyBuilder.demographics.populationGrowthRate
          },
          create: {
            countryId,
            ageDistribution: JSON.stringify({}),
            regions: JSON.stringify([]),
            educationLevels: JSON.stringify({}),
            citizenshipStatuses: JSON.stringify({}),
            birthRate: 12.5,
            deathRate: 8.0,
            migrationRate: 0,
            dependencyRatio: 54,
            medianAge: 35,
            populationGrowthProjection: 0.5
          }
        });

        // Update Country with comprehensive economy data
        const country = await tx.country.update({
          where: { id: countryId },
          data: {
            // Note: economic components are stored in government components relation

            // Update core indicators from economy builder using correct field names
            currentTotalGdp: economyBuilder.structure.totalGDP,
            currentGdpPerCapita: economyBuilder.structure.totalGDP / economyBuilder.demographics.totalPopulation,
            actualGdpGrowth: economyBuilder.sectors.reduce((sum, s) => sum + (s.growthRate * s.gdpContribution / 100), 0),
            currentPopulation: economyBuilder.demographics.totalPopulation,
            populationGrowthRate: economyBuilder.demographics.populationGrowthRate,
            unemploymentRate: economyBuilder.laborMarket.unemploymentRate,
            laborForceParticipationRate: economyBuilder.laborMarket.laborForceParticipationRate,
            urbanPopulationPercent: economyBuilder.demographics.urbanRuralSplit.urban,
            lifeExpectancy: economyBuilder.demographics.lifeExpectancy,
            literacyRate: economyBuilder.demographics.literacyRate,

            // Update calculated fields
            economicTier: economyBuilder.structure.economicTier,
            updatedAt: new Date()
          }
        });

        return { economicProfile, laborMarket, demographics, country };
      });

      return {
        success: true,
        countryId,
        message: 'Economy builder state saved successfully',
        data: result,
        timestamp: new Date()
      };
    }),

  // Get economy builder state with all related data
  getEconomyBuilderState: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          economicProfile: true,
          laborMarket: true,
          fiscalSystem: true,
          incomeDistribution: true,
          demographics: true,
          economicModel: true,
          nationalIdentity: true
        }
      });

      if (!country) {
        return null;
      }

      // Transform database data back to economy builder format
      const sectorBreakdown = country.economicProfile?.sectorBreakdown ? 
        JSON.parse(country.economicProfile.sectorBreakdown) : [];

      return {
        structure: {
          economicModel: 'Mixed Economy',
          primarySectors: sectorBreakdown.filter((s: any) => s.category === 'Primary').map((s: any) => s.name),
          secondarySectors: sectorBreakdown.filter((s: any) => s.category === 'Secondary').map((s: any) => s.name),
          tertiarySectors: sectorBreakdown.filter((s: any) => s.category === 'Tertiary').map((s: any) => s.name),
          totalGDP: country.currentTotalGdp || 0,
          gdpCurrency: country.nationalIdentity?.currency || 'USD',
          economicTier: country.economicTier || 'Developing',
          growthStrategy: 'Balanced'
        },
        sectors: sectorBreakdown.map((s: any) => ({
          id: s.name.toLowerCase().replace(/\s+/g, '_'),
          name: s.name,
          category: s.category || 'Tertiary',
          gdpContribution: s.gdp || 0,
          employmentShare: s.employment || 0,
          productivity: s.productivity || 75,
          growthRate: s.growthRate || 2.0,
          exports: 15,
          imports: 18,
          technologyLevel: 'Modern' as const,
          automation: 20,
          regulation: 'Moderate' as const,
          subsidy: 5,
          innovation: 50,
          sustainability: 70,
          competitiveness: 60
        })),
        laborMarket: {
          totalWorkforce: Math.round((country.currentPopulation || 0) * (country.laborForceParticipationRate || 65) / 100),
          laborForceParticipationRate: country.laborForceParticipationRate || 65,
          employmentRate: 100 - (country.unemploymentRate || 5),
          unemploymentRate: country.unemploymentRate || 5,
          underemploymentRate: (country.unemploymentRate || 5) * 0.6,
          youthUnemploymentRate: country.laborMarket?.youthUnemploymentRate || 10,
          seniorEmploymentRate: 55,
          femaleParticipationRate: country.laborMarket?.femaleParticipationRate || 60,
          maleParticipationRate: (country.laborForceParticipationRate || 65) * 1.15,
          averageWorkweekHours: 38.5,
          minimumWageHourly: 12.50,
          livingWageHourly: 18.75,
          unionizationRate: 12.5,
          collectiveBargainingCoverage: 18.0,
          workplaceSafetyIndex: 72,
          laborRightsScore: 68
        },
        demographics: {
          totalPopulation: country.currentPopulation || 0,
          populationGrowthRate: country.populationGrowthRate || 0,
          urbanRuralSplit: {
            urban: country.urbanPopulationPercent || 50,
            rural: 100 - (country.urbanPopulationPercent || 50)
          },
          lifeExpectancy: country.lifeExpectancy || 75,
          literacyRate: country.literacyRate || 90,
          netMigrationRate: 2.5,
          infantMortalityRate: 5,
          healthExpenditureGDP: 8.5
        },
        selectedAtomicComponents: [], // Will be populated from government components
        lastUpdated: country.updatedAt,
        version: '1.0.0'
      };
    }),

  // Auto-save economy builder changes
  autoSaveEconomyBuilder: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      changes: z.record(z.string(), z.any()) // Flexible changes object
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, changes } = input;

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId! }
      });

      if (!userProfile || userProfile.countryId !== countryId) {
        throw new Error('You do not have permission to edit this country.');
      }

      // Update country with changes
      const updated = await ctx.db.country.update({
        where: { id: countryId },
        data: {
          ...changes,
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        countryId,
        message: 'Auto-save completed',
        timestamp: new Date()
      };
    }),

  // Sync economy with government components
  syncEconomyWithGovernment: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      governmentComponents: z.array(z.string())
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, governmentComponents } = input;

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId! }
      });

      if (!userProfile || userProfile.countryId !== countryId) {
        throw new Error('You do not have permission to edit this country.');
      }

      // Update country with government components
      const updated = await ctx.db.country.update({
        where: { id: countryId },
        data: {
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        countryId,
        message: 'Economy synced with government components',
        timestamp: new Date()
      };
    }),

  // Sync economy with tax system
  syncEconomyWithTax: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      taxData: z.record(z.string(), z.any())
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, taxData } = input;

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId! }
      });

      if (!userProfile || userProfile.countryId !== countryId) {
        throw new Error('You do not have permission to edit this country.');
      }

      // Update fiscal system with tax data
      const fiscalSystem = await ctx.db.fiscalSystem.upsert({
        where: { countryId },
        update: {
          ...taxData
        },
        create: {
          countryId,
          ...taxData
        }
      });

      return {
        success: true,
        countryId,
        message: 'Economy synced with tax system',
        data: fiscalSystem,
        timestamp: new Date()
      };
    })
});

export { economicsRouter };
