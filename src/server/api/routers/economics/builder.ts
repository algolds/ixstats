// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { notificationAPI } from "~/lib/notification-api";
import { notificationHooks } from "~/lib/notification-hooks";

const economicsBuilderRouter = createTRPCRouter({
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

  // Get complete economy configuration

  // ==================== GOVERNMENT BUDGET ====================
  // Schema fields: spendingCategories, spendingEfficiency, publicInvestmentRate, socialSpendingPercent

  // ==================== DEMOGRAPHICS ====================
  // Schema fields: ageDistribution, regions, educationLevels, citizenshipStatuses,
  // birthRate, deathRate, migrationRate, dependencyRatio, medianAge, populationGrowthProjection

  // ==================== ECONOMY BUILDER LIVE WIRING ====================
  // Real-time economy builder configuration management

  // Save economy builder state with atomic components
  saveEconomyBuilderState: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        economyBuilder: z.object({
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
          selectedAtomicComponents: z.array(z.string()),
          lastUpdated: z.date().optional(),
          version: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, economyBuilder } = input;

      // SECURITY: Verify user owns this country
      if (ctx.user?.countryId !== countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access other countries' economic data",
        });
      }

      // Get previous values for notifications
      const previousCountry = await ctx.db.country.findUnique({
        where: { id: countryId },
        select: {
          currentTotalGdp: true,
          currentGdpPerCapita: true,
          actualGdpGrowth: true,
          economicTier: true,
          populationTier: true,
        },
      });

      // Start transaction to update multiple tables atomically
      const result = await ctx.db.$transaction(async (tx) => {
        // Update Economic Profile with calculated metrics
        const economicProfile = await tx.economicProfile.upsert({
          where: { countryId },
          update: {
            gdpGrowthVolatility:
              economyBuilder.sectors.reduce((sum, s) => sum + Math.abs(s.growthRate - 2.5), 0) /
              economyBuilder.sectors.length,
            economicComplexity:
              economyBuilder.structure.economicTier === "Advanced"
                ? 85
                : economyBuilder.structure.economicTier === "Developed"
                  ? 70
                  : economyBuilder.structure.economicTier === "Emerging"
                    ? 55
                    : 40,
            innovationIndex:
              economyBuilder.sectors.reduce((sum, s) => sum + s.innovation, 0) /
              economyBuilder.sectors.length,
            competitivenessRank: Math.round(
              100 -
                economyBuilder.sectors.reduce((sum, s) => sum + s.competitiveness, 0) /
                  economyBuilder.sectors.length
            ),
            sectorBreakdown: JSON.stringify(
              economyBuilder.sectors.map((s) => ({
                name: s.name,
                gdp: s.gdpContribution,
                employment: s.employmentShare,
                productivity: s.productivity,
                growthRate: s.growthRate,
              }))
            ),
            exportsGDPPercent: economyBuilder.sectors.reduce(
              (sum, s) => sum + (s.exports * s.gdpContribution) / 100,
              0
            ),
            importsGDPPercent: economyBuilder.sectors.reduce(
              (sum, s) => sum + (s.imports * s.gdpContribution) / 100,
              0
            ),
            tradeBalance:
              economyBuilder.structure.totalGDP *
              economyBuilder.sectors.reduce(
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
            sectorBreakdown: JSON.stringify(economyBuilder.sectors),
            exportsGDPPercent: 20,
            importsGDPPercent: 22,
            tradeBalance: -2,
          },
        });

        // Update Labor Market with detailed metrics
        const laborMarket = await tx.laborMarket.upsert({
          where: { countryId },
          update: {
            youthUnemploymentRate: economyBuilder.laborMarket.youthUnemploymentRate,
            femaleParticipationRate: economyBuilder.laborMarket.femaleParticipationRate,
            medianWage: economyBuilder.laborMarket.livingWageHourly * 2000, // Annual approximation
            wageGrowthRate: 2.5, // Default, could be calculated from sectors
            employmentBySector: JSON.stringify(
              economyBuilder.sectors.map((s) => ({
                sector: s.name,
                employment: s.employmentShare,
                productivity: s.productivity,
              }))
            ),
            wageBySector: JSON.stringify(
              economyBuilder.sectors.map((s) => ({
                sector: s.name,
                avgWage: economyBuilder.laborMarket.livingWageHourly * (s.productivity / 100),
              }))
            ),
          },
          create: {
            countryId,
            youthUnemploymentRate: economyBuilder.laborMarket.youthUnemploymentRate,
            femaleParticipationRate: economyBuilder.laborMarket.femaleParticipationRate,
            medianWage: economyBuilder.laborMarket.livingWageHourly * 2000,
            wageGrowthRate: 2.5,
            employmentBySector: JSON.stringify({}),
            wageBySector: JSON.stringify({}),
          },
        });

        // Update Demographics with economy-influenced data
        const demographics = await tx.demographics.upsert({
          where: { countryId },
          update: {
            ageDistribution: JSON.stringify({
              under15: 18,
              age15to64: 65,
              over65: 17,
            }),
            regions: JSON.stringify([
              {
                name: "Capital Region",
                population: Math.round(economyBuilder.demographics.totalPopulation * 0.3),
                populationPercent: 30,
                urbanPercent: 90,
                economicActivity: 40,
                developmentLevel: economyBuilder.structure.economicTier,
              },
            ]),
            educationLevels: JSON.stringify({
              noEducation: 2,
              primary: 25,
              secondary: 45,
              tertiary: 28,
            }),
            birthRate: 12.5,
            deathRate: 8.0,
            migrationRate: economyBuilder.demographics.netMigrationRate,
            dependencyRatio: 54,
            medianAge: 35,
            populationGrowthProjection: economyBuilder.demographics.populationGrowthRate,
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
            populationGrowthProjection: 0.5,
          },
        });

        // Delete all old economic components for the country
        await tx.economicComponent.deleteMany({
          where: { countryId },
        });

        // Insert new ones
        if (
          economyBuilder.selectedAtomicComponents &&
          economyBuilder.selectedAtomicComponents.length > 0
        ) {
          await tx.economicComponent.createMany({
            data: economyBuilder.selectedAtomicComponents.map((cType) => ({
              countryId,
              componentType: cType as any,
              effectivenessScore: 50,
              isActive: true,
            })),
          });
        }

        // Update Country with comprehensive economy data
        const country = await tx.country.update({
          where: { id: countryId },
          data: {
            // Note: economic components are stored in government components relation

            // Update core indicators from economy builder using correct field names
            currentTotalGdp: economyBuilder.structure.totalGDP,
            currentGdpPerCapita:
              economyBuilder.structure.totalGDP / economyBuilder.demographics.totalPopulation,
            actualGdpGrowth: economyBuilder.sectors.reduce(
              (sum, s) => sum + (s.growthRate * s.gdpContribution) / 100,
              0
            ),
            currentPopulation: economyBuilder.demographics.totalPopulation,
            populationGrowthRate: economyBuilder.demographics.populationGrowthRate,
            unemploymentRate: economyBuilder.laborMarket.unemploymentRate,
            laborForceParticipationRate: economyBuilder.laborMarket.laborForceParticipationRate,
            urbanPopulationPercent: economyBuilder.demographics.urbanRuralSplit.urban,
            lifeExpectancy: economyBuilder.demographics.lifeExpectancy,
            literacyRate: economyBuilder.demographics.literacyRate,

            // Update calculated fields
            economicTier: economyBuilder.structure.economicTier,
            updatedAt: new Date(),
          },
        });

        return { economicProfile, laborMarket, demographics, country };
      });

      // Send notifications for significant changes (non-blocking)
      const newGdpPerCapita =
        economyBuilder.structure.totalGDP / economyBuilder.demographics.totalPopulation;
      const newTotalGdp = economyBuilder.structure.totalGDP;
      const newEconomicTier = economyBuilder.structure.economicTier;

      try {
        // GDP per capita change notification
        if (previousCountry && previousCountry.currentGdpPerCapita) {
          const gdpPerCapitaChange =
            ((newGdpPerCapita - previousCountry.currentGdpPerCapita) /
              previousCountry.currentGdpPerCapita) *
            100;

          if (Math.abs(gdpPerCapitaChange) > 5) {
            await notificationHooks.onEconomicCalculation({
              countryId,
              userId: ctx.user?.id,
              calculationType: "gdp",
              metric: "GDP per Capita",
              currentValue: newGdpPerCapita,
              previousValue: previousCountry.currentGdpPerCapita,
              changePercent: gdpPerCapitaChange,
            });
          }
        }

        // Total GDP milestone notification
        if (previousCountry && previousCountry.currentTotalGdp) {
          const totalGdpChange =
            ((newTotalGdp - previousCountry.currentTotalGdp) / previousCountry.currentTotalGdp) *
            100;

          if (Math.abs(totalGdpChange) > 5) {
            await notificationHooks.onEconomicCalculation({
              countryId,
              userId: ctx.user?.id,
              calculationType: "gdp",
              metric: "Total GDP",
              currentValue: newTotalGdp,
              previousValue: previousCountry.currentTotalGdp,
              changePercent: totalGdpChange,
            });
          }
        }

        // Economic tier transition notification
        if (
          previousCountry &&
          previousCountry.economicTier &&
          previousCountry.economicTier !== newEconomicTier
        ) {
          await notificationHooks.onTierTransition({
            countryId,
            userId: ctx.user?.id,
            tierType: "economic",
            fromTier: previousCountry.economicTier,
            toTier: newEconomicTier,
            metric: "GDP per Capita",
            currentValue: newGdpPerCapita,
          });
        }

        // Recession detection (negative growth for 2+ consecutive periods)
        const currentGrowth = economyBuilder.sectors.reduce(
          (sum, s) => sum + (s.growthRate * s.gdpContribution) / 100,
          0
        );
        if (previousCountry && previousCountry.actualGdpGrowth < 0 && currentGrowth < 0) {
          await notificationAPI.create({
            title: "⚠️ Recession Alert",
            message: `Your economy has experienced negative growth for consecutive periods (${currentGrowth.toFixed(2)}%)`,
            userId: ctx.user?.id || null,
            countryId,
            category: "economic",
            type: "warning",
            priority: "critical",
            severity: "urgent",
            href: "/mycountry/new?tab=economy",
            actionable: true,
            metadata: {
              currentGrowth,
              previousGrowth: previousCountry.actualGdpGrowth,
            },
          });
        }
      } catch (error) {
        console.error("[Economics] Failed to send notifications:", error);
      }

      return {
        success: true,
        countryId,
        message: "Economy builder state saved successfully",
        data: result,
        timestamp: new Date(),
      };
    }),

  // Get economy builder state with all related data
  getEconomyBuilderState: publicProcedure
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
          demographics: true,
          economicModel: true,
          nationalIdentity: true,
          economicComponents: true,
        },
      });

      if (!country) {
        return null;
      }

      // Fallback values if current stats are empty/0
      const totalPopulation = country.currentPopulation || country.baselinePopulation || 10000000;
      const totalGDP =
        country.currentTotalGdp ||
        country.baselinePopulation * country.baselineGdpPerCapita ||
        250000000000;

      // Transform database data back to economy builder format
      const sectorBreakdown = country.economicProfile?.sectorBreakdown
        ? JSON.parse(country.economicProfile.sectorBreakdown)
        : [];

      return {
        structure: {
          economicModel: "Mixed Economy",
          primarySectors: sectorBreakdown
            .filter((s: any) => s.category === "Primary")
            .map((s: any) => s.name),
          secondarySectors: sectorBreakdown
            .filter((s: any) => s.category === "Secondary")
            .map((s: any) => s.name),
          tertiarySectors: sectorBreakdown
            .filter((s: any) => s.category === "Tertiary")
            .map((s: any) => s.name),
          totalGDP,
          gdpCurrency: country.nationalIdentity?.currency || "USD",
          economicTier: country.economicTier || "Developing",
          growthStrategy: "Balanced",
        },
        sectors: sectorBreakdown.map((s: any) => ({
          id: s.name.toLowerCase().replace(/\s+/g, "_"),
          name: s.name,
          category: s.category || "Tertiary",
          gdpContribution: s.gdp || 0,
          employmentShare: s.employment || 0,
          productivity: s.productivity || 75,
          growthRate: s.growthRate || 2.0,
          exports: 15,
          imports: 18,
          technologyLevel: "Modern" as const,
          automation: 20,
          regulation: "Moderate" as const,
          subsidy: 5,
          innovation: 50,
          sustainability: 70,
          competitiveness: 60,
        })),
        laborMarket: {
          totalWorkforce: Math.round(
            (totalPopulation * (country.laborForceParticipationRate || 65)) / 100
          ),
          laborForceParticipationRate: country.laborForceParticipationRate || 65,
          employmentRate: 100 - (country.unemploymentRate || 5),
          unemploymentRate: country.unemploymentRate || 5,
          underemploymentRate: (country.unemploymentRate || 5) * 0.6,
          youthUnemploymentRate: country.laborMarket?.youthUnemploymentRate || 10,
          seniorEmploymentRate: 55,
          femaleParticipationRate: country.laborMarket?.femaleParticipationRate || 60,
          maleParticipationRate: (country.laborForceParticipationRate || 65) * 1.15,
          averageWorkweekHours: 38.5,
          minimumWageHourly: 12.5,
          livingWageHourly: 18.75,
          unionizationRate: 12.5,
          collectiveBargainingCoverage: 18.0,
          workplaceSafetyIndex: 72,
          laborRightsScore: 68,
        },
        demographics: {
          totalPopulation,
          populationGrowthRate: country.populationGrowthRate || 0,
          urbanRuralSplit: {
            urban: country.urbanPopulationPercent || 50,
            rural: 100 - (country.urbanPopulationPercent || 50),
          },
          lifeExpectancy: country.lifeExpectancy || 75,
          literacyRate: country.literacyRate || 90,
          netMigrationRate: 2.5,
          infantMortalityRate: 5,
          healthExpenditureGDP: 8.5,
        },
        selectedAtomicComponents: country.economicComponents
          ? country.economicComponents.map((c) => c.componentType as any)
          : [],
        lastUpdated: country.updatedAt,
        version: "1.0.0",
      };
    }),

  // Auto-save economy builder changes
  autoSaveEconomyBuilder: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        changes: z.record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean(), z.null(), z.date()])
        ), // Economic field changes
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, changes } = input;

      // SECURITY: Verify user owns this country
      if (ctx.user?.countryId !== countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access other countries' economic data",
        });
      }

      try {
        // Update country with changes
        // eslint-disable-next-line unused-imports/no-unused-vars
        const updated = await ctx.db.country.update({
          where: { id: countryId },
          data: {
            ...changes,
            updatedAt: new Date(),
          },
        });

        // Log autosave to audit trail
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "autosave:economy",
            target: countryId,
            details: JSON.stringify({
              fields: Object.keys(changes),
              timestamp: new Date().toISOString(),
            }),
            success: true,
          },
        });

        return {
          success: true,
          countryId,
          message: "Auto-save completed",
          timestamp: new Date(),
        };
      } catch (error) {
        // Log autosave failure to audit trail
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "autosave:economy",
            target: countryId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });

        throw error;
      }
    }),

  // Sync economy with government components

  // Sync economy with tax system
});

export { economicsBuilderRouter };
