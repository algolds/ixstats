import { z } from "zod";
import { protectedProcedure, adminProcedure, publicProcedure } from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { getAtomicEffectivenessService } from "~/services/AtomicEffectivenessService";
import { checkComponentSynergy } from "~/lib/government-synergy";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { invalidateCache } from "~/lib/trpc-cache";
import { globalCache } from "~/lib/advanced-cache-system";
import { clearLayerCache } from "~/server/api/routers/geo/core";
import {
  type CoreEconomicIndicators,
  type LaborEmploymentData,
  type FiscalSystemData,
  type DemographicData,
  type IncomeWealthData,
  type GovernmentSpendingData,
  type NationalIdentityData,
  type GeographyData,
} from "~/app/builder/lib/economy-data-service";

export const managementProcedures = {
  // SECURITY: Admin-only endpoint for triggering system-wide economic narratives
  triggerEconomicNarrative: adminProcedure.mutation(async ({ ctx }) => {
    console.log(`[AUDIT] Economic narrative triggered by admin userId=${ctx.auth?.userId}`);
    const { detectEconomicMilestoneAndTriggerNarrative } = await import("~/lib/auto-post-service");
    await detectEconomicMilestoneAndTriggerNarrative();
    return { success: true, message: "Economic narrative triggered" };
  }),

  // General update mutation for country fields (used by editor)
  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string(),
        })
        .passthrough()
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!isSystemOwner(ctx.auth.userId) && (!userProfile || userProfile.countryId !== id)) {
        throw new Error("You do not have permission to edit this country.");
      }

      try {
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        const updatedCountry = await ctx.db.country.update({
          where: { id },
          data: {
            ...filteredUpdates,
            updatedAt: new Date(),
          },
        });

        await invalidateCache(["countries."]);
        clearLayerCache("political");

        let targetUserId = userProfile?.id;
        if (!targetUserId) {
          const countryOwner = await ctx.db.user.findFirst({
            where: { countryId: id },
          });
          targetUserId = countryOwner?.id;
        }

        if (targetUserId) {
          try {
            const { evaluateThresholds } = await import("../intelligence/alerts");
            await evaluateThresholds(ctx.db, id, targetUserId);
          } catch (e) {
            console.error("[Countries API] Error evaluating thresholds on country update:", e);
          }
        }

        return updatedCountry;
      } catch (error) {
        console.error("[Countries API] Failed to update country:", error);
        throw new Error(
          `Failed to update country: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  getLiveEvents: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(10),
        windowHours: z.number().optional().default(48),
      })
    )
    .query(async ({ ctx, input }) => {
      const sinceWindow = new Date(Date.now() - input.windowHours * 60 * 60 * 1000);

      const [
        country,
        crisisEvents,
        diplomaticEvents,
        embassyMissions,
        cabinetMeetings,
        securityThreats,
      ] = await Promise.all([
        ctx.db.country.findUnique({
          where: { id: input.countryId },
        }),
        ctx.db.crisisEvent.findMany({
          where: {
            affectedCountries: { contains: input.countryId },
            createdAt: { gte: sinceWindow },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        }),
        ctx.db.diplomaticEvent.findMany({
          where: {
            OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
            createdAt: { gte: sinceWindow },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        }),
        ctx.db.embassyMission.findMany({
          where: {
            embassy: {
              OR: [{ hostCountryId: input.countryId }, { guestCountryId: input.countryId }],
            },
            OR: [{ updatedAt: { gte: sinceWindow } }, { completesAt: { gte: sinceWindow } }],
          },
          include: {
            embassy: {
              include: {
                hostCountry: { select: { name: true, id: true } },
                guestCountry: { select: { name: true, id: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
        }),
        ctx.db.cabinetMeeting.findMany({
          where: {
            countryId: input.countryId,
            OR: [
              { status: { in: ["scheduled", "in_progress"] } },
              { status: "completed", completedAt: { gte: sinceWindow } },
            ],
          },
          orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
          take: input.limit,
        }),
        ctx.db.securityThreat.findMany({
          where: {
            countryId: input.countryId,
            isActive: true,
            OR: [{ updatedAt: { gte: sinceWindow } }, { createdAt: { gte: sinceWindow } }],
          },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
        }),
      ]);

      return {
        country,
        crisisEvents,
        diplomaticEvents,
        embassyMissions,
        cabinetMeetings,
        securityThreats,
      };
    }),

  // Toggle atomic government mode for a country
  toggleAtomicGovernment: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        useAtomic: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.country.update({
        where: { id: input.countryId },
        data: { usesAtomicGovernment: input.useAtomic },
      });

      // Invalidate cache for this country
      const atomicService = getAtomicEffectivenessService(ctx.db);
      atomicService.invalidateCache(input.countryId);

      await invalidateCache(["countries."]);

      return updated;
    }),

  // Recalculate atomic effectiveness
  recalculateAtomicEffectiveness: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const atomicService = getAtomicEffectivenessService(ctx.db);

      // Force recalculation by bypassing cache
      const effectiveness = await atomicService.calculateEffectiveness(input.countryId);

      return effectiveness;
    }),

  // Create a new country from builder
  createCountry: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        foundationCountry: z.string().nullable(),
        economicInputs: z
          .object({
            coreIndicators: z
              .object({
                totalPopulation: z.number().min(0),
                gdpPerCapita: z.number().min(0),
                nominalGDP: z.number().min(0),
                realGDPGrowthRate: z.number().optional(),
                inflationRate: z.number().optional(),
                currencyExchangeRate: z.number().optional(),
              })
              .optional(),
            laborEmployment: z
              .object({
                laborForceParticipationRate: z.number().min(0).max(100),
                unemploymentRate: z.number().min(0).max(100),
                totalWorkforce: z.number().optional(),
                employmentRate: z.number().optional(),
                averageWorkweekHours: z.number().optional(),
                minimumWage: z.number().optional(),
                averageAnnualIncome: z.number().optional(),
              })
              .optional(),
            fiscalSystem: z
              .object({
                taxRevenueGDPPercent: z.number().optional(),
                governmentSpendingGDPPercent: z.number().optional(),
                governmentRevenueTotal: z.number().optional(),
                taxRevenuePerCapita: z.number().optional(),
                governmentBudgetGDPPercent: z.number().optional(),
                budgetDeficitSurplus: z.number().optional(),
                internalDebtGDPPercent: z.number().optional(),
                externalDebtGDPPercent: z.number().optional(),
                totalDebtGDPRatio: z.number().optional(),
                debtPerCapita: z.number().optional(),
                interestRates: z.number().optional(),
                debtServiceCosts: z.number().optional(),
                salesTaxRate: z.number().optional(),
              })
              .optional(),
            demographics: z
              .object({
                urbanPopulationPercent: z.number().min(0).max(100).optional(),
                lifeExpectancy: z.number().optional(),
                literacyRate: z.number().min(0).max(100).optional(),
                populationGrowthRate: z.number().optional(),
                urbanRuralSplit: z
                  .object({
                    urban: z.number(),
                    rural: z.number(),
                  })
                  .optional(),
                ageDistribution: z.array(z.any()).optional(),
                educationLevels: z.array(z.any()).optional(),
              })
              .optional(),
            incomeWealth: z
              .object({
                giniIndex: z.number().min(0).max(100).optional(),
                povertyRate: z.number().optional(),
                incomeInequalityGini: z.number().optional(),
                socialMobilityIndex: z.number().optional(),
                economicClasses: z.array(z.any()).optional(),
              })
              .optional(),
            governmentSpending: z
              .object({
                totalSpending: z.number().optional(),
                spendingGDPPercent: z.number().optional(),
                spendingPerCapita: z.number().optional(),
                spendingCategories: z.array(z.any()).optional(),
              })
              .passthrough()
              .optional(),
            nationalIdentity: z
              .object({
                countryName: z.string().optional(),
                officialName: z.string().optional(),
                governmentType: z.string().optional(),
                motto: z.string().optional(),
                mottoNative: z.string().optional(),
                capitalCity: z.string().optional(),
                largestCity: z.string().optional(),
                demonym: z.string().optional(),
                nationalReligion: z.string().optional(),
                currency: z.string().optional(),
                currencySymbol: z.string().optional(),
                officialLanguages: z.string().optional(),
                nationalLanguage: z.string().optional(),
                nationalAnthem: z.string().optional(),
                nationalDay: z.string().optional(),
                nationalSport: z.string().optional(),
                nationalAnimal: z.string().optional(),
                nationalBird: z.string().optional(),
                nationalFish: z.string().optional(),
                founders: z.string().optional(),
                nationalFlower: z.string().optional(),
                nationalDish: z.string().optional(),
                nationalFruit: z.string().optional(),
                nationalDrink: z.string().optional(),
                nationalInstrument: z.string().optional(),
                nationalSymbol: z.string().optional(),
                nationalAnimalImage: z.string().optional(),
                nationalBirdImage: z.string().optional(),
                nationalFishImage: z.string().optional(),
                foundersImage: z.string().optional(),
                nationalFlowerImage: z.string().optional(),
                nationalDishImage: z.string().optional(),
                nationalFruitImage: z.string().optional(),
                nationalDrinkImage: z.string().optional(),
                nationalInstrumentImage: z.string().optional(),
                nationalSymbolImage: z.string().optional(),
                callingCode: z.string().optional(),
                internetTLD: z.string().optional(),
                drivingSide: z.string().optional(),
                timeZone: z.string().optional(),
                isoCode: z.string().optional(),
                coordinatesLatitude: z.string().optional(),
                coordinatesLongitude: z.string().optional(),
                emergencyNumber: z.string().optional(),
                postalCodeFormat: z.string().optional(),
                weekStartDay: z.string().optional(),
                leader: z.string().optional(),
              })
              .optional(),
            geography: z
              .object({
                continent: z.string().optional(),
                region: z.string().optional(),
              })
              .optional(),
            flagUrl: z.string().optional(),
            coatOfArmsUrl: z.string().optional(),
          })
          .optional(),
        governmentComponents: z
          .array(
            z.object({
              componentType: z.string(),
              effectivenessScore: z.number().min(0).max(100).optional(),
              implementationCost: z.number().optional(),
              maintenanceCost: z.number().optional(),
              requiredCapacity: z.number().min(0).max(100).optional(),
              isActive: z.boolean().optional(),
              notes: z.string().optional(),
            })
          )
          .optional(),
        taxSystemData: z.any().optional(),
        governmentStructure: z.any().optional(),
        economyBuilderState: z.any().optional(),
        archetypeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const userWithCountry = await ctx.db.user.findUnique({
        where: { clerkUserId: userId },
        include: { country: true, role: true },
      });

      if (userWithCountry?.country) {
        console.log(
          `[createCountry] User ${userId} already has country: ${userWithCountry.country.name}`
        );
        return userWithCountry.country;
      }

      if (userWithCountry && !userWithCountry.roleId) {
        const defaultRole = await ctx.db.role.findFirst({
          where: { name: "user" },
        });

        if (defaultRole) {
          await ctx.db.user.update({
            where: { clerkUserId: userId },
            data: { roleId: defaultRole.id },
          });
        }
      }

      let foundationData: any = null;
      if (input.foundationCountry) {
        const foundationCountry = await ctx.db.country.findFirst({
          where: {
            OR: [{ slug: input.foundationCountry }, { name: input.foundationCountry }],
          },
        });
        if (foundationCountry) {
          foundationData = {
            baselinePopulation: foundationCountry.baselinePopulation,
            baselineGdpPerCapita: foundationCountry.baselineGdpPerCapita,
            continent: foundationCountry.continent,
            region: foundationCountry.region,
            landArea: foundationCountry.landArea,
            areaSqMi: foundationCountry.areaSqMi,
            flag: foundationCountry.flag,
            coatOfArms: foundationCountry.coatOfArms,
          };
        }
      }

      // Query Faction Class Archetype if provided
      let archetype: any = null;
      if (input.archetypeId) {
        archetype = await ctx.db.economicArchetype.findUnique({
          where: { id: input.archetypeId },
        });
        if (!archetype) {
          archetype = await ctx.db.economicArchetype.findFirst({
            where: { key: input.archetypeId },
          });
        }
      }

      const econ = input.economicInputs || {};
      const coreIndicators = (econ.coreIndicators || {}) as any;
      const laborEmployment = (econ.laborEmployment || {}) as any;
      const fiscalSystem = (econ.fiscalSystem || {}) as any;
      const demographics = (econ.demographics || {}) as any;
      const incomeWealth = (econ.incomeWealth || {}) as any;
      const governmentSpending = (econ.governmentSpending || {}) as any;
      const nationalIdentity = (econ.nationalIdentity || {}) as any;
      const geography = (econ.geography || {}) as any;

      const population =
        coreIndicators.totalPopulation || foundationData?.baselinePopulation || 10000000;
      const gdpPerCapita =
        coreIndicators.gdpPerCapita || foundationData?.baselineGdpPerCapita || 25000;
      const nominalGDP = coreIndicators.nominalGDP || population * gdpPerCapita;
      const totalGdp = population * gdpPerCapita;

      let taxSystemData = input.taxSystemData;
      let governmentStructure = input.governmentStructure;
      let governmentComponentsList = input.governmentComponents || [];
      let economyBuilderState = input.economyBuilderState;

      // Populate defaults from selected Faction Archetype if missing in input
      if (archetype) {
        if (!taxSystemData && archetype.taxProfile) {
          try {
            const parsedProfile = JSON.parse(archetype.taxProfile);
            taxSystemData = {
              taxSystemName: `${archetype.name} Tax System`,
              taxAuthority: "Ministry of Finance",
              progressiveTax: true,
              baseRate: parsedProfile.incomeRate || 15,
              categories: [
                {
                  categoryName: "Income Tax",
                  categoryType: "income",
                  baseRate: parsedProfile.incomeRate || 15,
                  isActive: true,
                  brackets: [
                    {
                      bracketName: "Base Bracket",
                      minIncome: 0,
                      maxIncome: null,
                      rate: parsedProfile.incomeRate || 15,
                      isActive: true,
                    },
                  ],
                },
                {
                  categoryName: "Corporate Tax",
                  categoryType: "corporate",
                  baseRate: parsedProfile.corporateRate || 20,
                  isActive: true,
                },
                {
                  categoryName: "Consumption Tax",
                  categoryType: "consumption",
                  baseRate: parsedProfile.consumptionRate || 10,
                  isActive: true,
                },
              ],
            };
          } catch (e) {
            console.error("Failed to parse archetype taxProfile:", e);
          }
        }

        if (!governmentStructure) {
          governmentStructure = {
            governmentName: `Government of ${input.name}`,
            governmentType: archetype.name || "Constitutional Republic",
            totalBudget: nominalGDP * 0.3,
            fiscalYear: "Calendar Year",
            budgetCurrency: "USD",
            departments: [
              { name: "Ministry of Finance", category: "finance", isActive: true },
              { name: "Ministry of Interior", category: "interior", isActive: true },
              { name: "Ministry of Foreign Affairs", category: "foreign", isActive: true },
              { name: "Ministry of Defense", category: "defense", isActive: true },
              { name: "Ministry of Justice", category: "justice", isActive: true },
            ],
          };
        }

        if (governmentComponentsList.length === 0 && archetype.governmentComponents) {
          try {
            const parsedComps = JSON.parse(archetype.governmentComponents);
            if (Array.isArray(parsedComps)) {
              governmentComponentsList = parsedComps.map((comp: string) => ({
                componentType: comp,
              }));
            }
          } catch (e) {
            console.error("Failed to parse archetype governmentComponents:", e);
          }
        }

        if (!economyBuilderState) {
          let parsedSectors: string[] = [];
          if (archetype.economicComponents) {
            try {
              const parsed = JSON.parse(archetype.economicComponents);
              if (Array.isArray(parsed)) {
                parsedSectors = parsed;
              }
            } catch (e) {}
          }
          economyBuilderState = {
            structure: {
              economicModel: archetype.name || "Mixed Economy",
              totalGDP: nominalGDP,
              gdpCurrency: "USD",
              economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
            },
            selectedAtomicComponents: parsedSectors,
          };
        }
      }

      const slug = input.name
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      try {
        const result = await ctx.db.$transaction(async (tx) => {
          const country = await tx.country.create({
            data: {
              name: input.name,
              slug: slug,
              continent: geography.continent || foundationData?.continent || "Unknown",
              region: geography.region || foundationData?.region || "Unknown",
              governmentType:
                nationalIdentity.governmentType ||
                governmentStructure?.governmentType ||
                "Republic",
              religion: nationalIdentity.nationalReligion || "Secular",
              leader: nationalIdentity.leader || "Unknown",
              flag: econ.flagUrl || foundationData?.flag || undefined,
              coatOfArms: econ.coatOfArmsUrl || foundationData?.coatOfArms || undefined,
              landArea: foundationData?.landArea || 100000,
              areaSqMi: foundationData?.areaSqMi || 38610,
              baselinePopulation: population,
              baselineGdpPerCapita: gdpPerCapita,
              baselineDate: new Date(),
              currentPopulation: population,
              currentGdpPerCapita: gdpPerCapita,
              currentTotalGdp: totalGdp,
              maxGdpGrowthRate: 0.05,
              adjustedGdpGrowth:
                coreIndicators.realGDPGrowthRate !== undefined
                  ? coreIndicators.realGDPGrowthRate / 100
                  : 0.03,
              populationGrowthRate:
                demographics.populationGrowthRate !== undefined
                  ? demographics.populationGrowthRate / 100
                  : 0.01,
              actualGdpGrowth:
                coreIndicators.realGDPGrowthRate !== undefined
                  ? coreIndicators.realGDPGrowthRate / 100
                  : 0.03,
              localGrowthFactor: 1.0,
              economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
              populationTier: getPopulationTierFromPopulation(population),
              nominalGDP: nominalGDP,
              realGDPGrowthRate:
                coreIndicators.realGDPGrowthRate !== undefined
                  ? coreIndicators.realGDPGrowthRate / 100
                  : 0.03,
              inflationRate:
                coreIndicators.inflationRate !== undefined
                  ? coreIndicators.inflationRate / 100
                  : 0.02,
              currencyExchangeRate: coreIndicators.currencyExchangeRate || 1.0,
              laborForceParticipationRate: laborEmployment.laborForceParticipationRate || 65,
              employmentRate: laborEmployment.employmentRate || 95,
              unemploymentRate: laborEmployment.unemploymentRate || 5,
              totalWorkforce: laborEmployment.totalWorkforce || Math.round(population * 0.65),
              averageWorkweekHours: laborEmployment.averageWorkweekHours || 40,
              minimumWage: laborEmployment.minimumWage || Math.round(gdpPerCapita * 0.02),
              averageAnnualIncome:
                laborEmployment.averageAnnualIncome || Math.round(gdpPerCapita * 0.8),
              taxRevenueGDPPercent:
                fiscalSystem.taxRevenueGDPPercent || (taxSystemData as any)?.totalTaxRate || 20,
              governmentRevenueTotal: fiscalSystem.governmentRevenueTotal || nominalGDP * 0.2,
              taxRevenuePerCapita:
                fiscalSystem.taxRevenuePerCapita || (nominalGDP * 0.2) / population,
              governmentBudgetGDPPercent: fiscalSystem.governmentBudgetGDPPercent || 22,
              budgetDeficitSurplus: fiscalSystem.budgetDeficitSurplus || 0,
              internalDebtGDPPercent: fiscalSystem.internalDebtGDPPercent || 45,
              externalDebtGDPPercent: fiscalSystem.externalDebtGDPPercent || 25,
              totalDebtGDPRatio: fiscalSystem.totalDebtGDPRatio || 70,
              debtPerCapita: fiscalSystem.debtPerCapita || (nominalGDP * 0.7) / population,
              interestRates: fiscalSystem.interestRates || 3.5,
              debtServiceCosts: fiscalSystem.debtServiceCosts || nominalGDP * 0.7 * 0.035,
              povertyRate: incomeWealth.povertyRate || 15,
              incomeInequalityGini: incomeWealth.incomeInequalityGini || 0.38,
              socialMobilityIndex: incomeWealth.socialMobilityIndex || 60,
              totalGovernmentSpending: governmentSpending.totalSpending || nominalGDP * 0.22,
              spendingGDPPercent: governmentSpending.spendingGDPPercent || 22,
              spendingPerCapita:
                governmentSpending.spendingPerCapita || (nominalGDP * 0.22) / population,
              lifeExpectancy: demographics.lifeExpectancy || 78.5,
              urbanPopulationPercent: demographics.urbanRuralSplit?.urban || 65,
              ruralPopulationPercent: demographics.urbanRuralSplit?.rural || 35,
              literacyRate: demographics.literacyRate || 95,
              populationDensity: foundationData?.landArea
                ? population / foundationData.landArea
                : undefined,
              gdpDensity: foundationData?.landArea ? totalGdp / foundationData.landArea : undefined,
              lastCalculated: new Date(),
            },
          });

          if (nationalIdentity && Object.keys(nationalIdentity).length > 0) {
            await tx.nationalIdentity.create({
              data: {
                countryId: country.id,
                countryName: nationalIdentity.countryName || input.name,
                officialName: nationalIdentity.officialName,
                governmentType: nationalIdentity.governmentType,
                motto: nationalIdentity.motto,
                mottoNative: nationalIdentity.mottoNative,
                capitalCity: nationalIdentity.capitalCity,
                largestCity: nationalIdentity.largestCity,
                demonym: nationalIdentity.demonym,
                currency: nationalIdentity.currency,
                currencySymbol: nationalIdentity.currencySymbol,
                officialLanguages: nationalIdentity.officialLanguages,
                nationalLanguage: nationalIdentity.nationalLanguage,
                nationalAnthem: nationalIdentity.nationalAnthem,
                nationalReligion: nationalIdentity.nationalReligion,
                nationalDay: nationalIdentity.nationalDay,
                callingCode: nationalIdentity.callingCode,
                internetTLD: nationalIdentity.internetTLD,
                drivingSide: nationalIdentity.drivingSide,
                timeZone: nationalIdentity.timeZone,
                isoCode: nationalIdentity.isoCode,
                coordinatesLatitude: nationalIdentity.coordinatesLatitude,
                coordinatesLongitude: nationalIdentity.coordinatesLongitude,
                emergencyNumber: nationalIdentity.emergencyNumber,
                postalCodeFormat: nationalIdentity.postalCodeFormat,
                nationalSport: nationalIdentity.nationalSport,
                nationalBird: nationalIdentity.nationalBird,
                nationalFish: nationalIdentity.nationalFish,
                founders: nationalIdentity.founders,
                nationalFlower: nationalIdentity.nationalFlower,
                nationalDish: nationalIdentity.nationalDish,
                nationalFruit: nationalIdentity.nationalFruit,
                nationalDrink: nationalIdentity.nationalDrink,
                nationalInstrument: nationalIdentity.nationalInstrument,
                nationalSymbol: nationalIdentity.nationalSymbol,
                nationalAnimalImage: nationalIdentity.nationalAnimalImage,
                nationalBirdImage: nationalIdentity.nationalBirdImage,
                nationalFishImage: nationalIdentity.nationalFishImage,
                foundersImage: nationalIdentity.foundersImage,
                nationalFlowerImage: nationalIdentity.nationalFlowerImage,
                nationalDishImage: nationalIdentity.nationalDishImage,
                nationalFruitImage: nationalIdentity.nationalFruitImage,
                nationalDrinkImage: nationalIdentity.nationalDrinkImage,
                nationalInstrumentImage: nationalIdentity.nationalInstrumentImage,
                nationalSymbolImage: nationalIdentity.nationalSymbolImage,
                weekStartDay: nationalIdentity.weekStartDay,
              },
            });
          }

          if (demographics && Object.keys(demographics).length > 0) {
            await tx.demographics.create({
              data: {
                countryId: country.id,
                ageDistribution: JSON.stringify(demographics.ageDistribution || []),
                educationLevels: JSON.stringify(demographics.educationLevels || []),
                birthRate: demographics.birthRate,
                deathRate: demographics.deathRate,
                migrationRate: demographics.migrationRate,
                dependencyRatio: demographics.dependencyRatio,
                medianAge: demographics.medianAge,
                populationGrowthProjection: demographics.populationGrowthRate,
              },
            });
          }

          if (fiscalSystem && Object.keys(fiscalSystem).length > 0) {
            await tx.fiscalSystem.create({
              data: {
                countryId: country.id,
                personalIncomeTaxRates: fiscalSystem.personalIncomeTaxRates,
                corporateTaxRates: fiscalSystem.corporateTaxRates,
                salesTaxRate: fiscalSystem.salesTaxRate,
                propertyTaxRate: fiscalSystem.propertyTaxRate,
                payrollTaxRate: fiscalSystem.payrollTaxRate,
                exciseTaxRates: fiscalSystem.exciseTaxRates,
                wealthTaxRate: fiscalSystem.wealthTaxRate,
                spendingByCategory: fiscalSystem.spendingByCategory,
                fiscalBalanceGDPPercent: fiscalSystem.fiscalBalanceGDPPercent,
                primaryBalanceGDPPercent: fiscalSystem.primaryBalanceGDPPercent,
                taxEfficiency: fiscalSystem.taxEfficiency,
              },
            });
          }

          if (taxSystemData) {
            const taxSystem = await tx.taxSystem.create({
              data: {
                countryId: country.id,
                taxSystemName: taxSystemData.taxSystemName || "National Tax System",
                taxAuthority: taxSystemData.taxAuthority,
                fiscalYear: taxSystemData.fiscalYear || "calendar",
                taxCode: taxSystemData.taxCode,
                baseRate: taxSystemData.baseRate,
                progressiveTax: taxSystemData.progressiveTax ?? true,
                flatTaxRate: taxSystemData.flatTaxRate,
                alternativeMinTax: taxSystemData.alternativeMinTax ?? false,
                alternativeMinRate: taxSystemData.alternativeMinRate,
                taxHolidays: taxSystemData.taxHolidays,
                complianceRate: taxSystemData.complianceRate,
                collectionEfficiency: taxSystemData.collectionEfficiency,
                lastReform: taxSystemData.lastReform,
              },
            });

            if (taxSystemData.categories && taxSystemData.categories.length > 0) {
              for (const categoryData of taxSystemData.categories) {
                const taxCategory = await tx.taxCategory.create({
                  data: {
                    taxSystemId: taxSystem.id,
                    categoryName: categoryData.categoryName,
                    categoryType: categoryData.categoryType,
                    description: categoryData.description,
                    isActive: categoryData.isActive ?? true,
                    baseRate: categoryData.baseRate,
                    calculationMethod: categoryData.calculationMethod || "percentage",
                    minimumAmount: categoryData.minimumAmount,
                    maximumAmount: categoryData.maximumAmount,
                    exemptionAmount: categoryData.exemptionAmount,
                    deductionAllowed: categoryData.deductionAllowed ?? true,
                    standardDeduction: categoryData.standardDeduction,
                    priority: categoryData.priority || 50,
                    color: categoryData.color,
                    icon: categoryData.icon,
                  },
                });

                if (categoryData.brackets && categoryData.brackets.length > 0) {
                  for (const bracketData of categoryData.brackets) {
                    await tx.taxBracket.create({
                      data: {
                        taxSystemId: taxSystem.id,
                        categoryId: taxCategory.id,
                        bracketName: bracketData.bracketName,
                        minIncome: bracketData.minIncome,
                        maxIncome: bracketData.maxIncome,
                        rate: bracketData.rate,
                        flatAmount: bracketData.flatAmount,
                        marginalRate: bracketData.marginalRate ?? true,
                        isActive: bracketData.isActive ?? true,
                        priority: bracketData.priority || 50,
                      },
                    });
                  }
                }
              }
            }
          }

          if (governmentStructure) {
            const govInput = governmentStructure;
            const govStructure = await tx.governmentStructure.create({
              data: {
                countryId: country.id,
                governmentName: govInput.governmentName || `Government of ${input.name}`,
                governmentType: govInput.governmentType || "Federal Republic",
                headOfState: govInput.headOfState,
                headOfGovernment: govInput.headOfGovernment,
                legislatureName: govInput.legislatureName,
                executiveName: govInput.executiveName,
                judicialName: govInput.judicialName,
                totalBudget: govInput.totalBudget || 0,
                fiscalYear: govInput.fiscalYear || "Calendar Year",
                budgetCurrency: govInput.budgetCurrency || "USD",
              },
            });

            if (govInput.departments && govInput.departments.length > 0) {
              const deptIdMap = new Map<string, string>();
              for (const deptInput of govInput.departments) {
                const tempId = deptInput.id || deptInput.name;
                const department = await tx.governmentDepartment.create({
                  data: {
                    governmentStructureId: govStructure.id,
                    name: deptInput.name,
                    shortName: deptInput.shortName,
                    category: deptInput.category,
                    description: deptInput.description,
                    minister: deptInput.minister,
                    ministerTitle: deptInput.ministerTitle || "Minister",
                    headquarters: deptInput.headquarters,
                    established: deptInput.established,
                    employeeCount: deptInput.employeeCount,
                    icon: deptInput.icon,
                    color: deptInput.color || "#6366f1",
                    priority: deptInput.priority || 50,
                    isActive: deptInput.isActive ?? true,
                    organizationalLevel: deptInput.organizationalLevel || "Ministry",
                    functions: deptInput.functions ? JSON.stringify(deptInput.functions) : null,
                    kpis: deptInput.kpis ? JSON.stringify(deptInput.kpis) : null,
                  },
                });
                deptIdMap.set(tempId, department.id);
              }

              for (const deptInput of govInput.departments) {
                if (deptInput.parentDepartmentId) {
                  const tempId = deptInput.id || deptInput.name;
                  const actualDeptId = deptIdMap.get(tempId);
                  const actualParentId = deptIdMap.get(deptInput.parentDepartmentId);
                  if (actualDeptId && actualParentId) {
                    await tx.governmentDepartment.update({
                      where: { id: actualDeptId },
                      data: { parentDepartmentId: actualParentId },
                    });
                  }
                }
              }
            }
          }

          await tx.historicalDataPoint.create({
            data: {
              countryId: country.id,
              ixTimeTimestamp: new Date(),
              population: population,
              gdpPerCapita: gdpPerCapita,
              totalGdp: totalGdp,
              populationGrowthRate: demographics.populationGrowthRate || 0.5,
              gdpGrowthRate: coreIndicators.realGDPGrowthRate || 3.0,
              landArea: foundationData?.landArea || 100000,
              populationDensity: foundationData?.landArea
                ? population / foundationData.landArea
                : undefined,
              gdpDensity: foundationData?.landArea ? totalGdp / foundationData.landArea : undefined,
            },
          });

          if (governmentComponentsList && governmentComponentsList.length > 0) {
            const componentRecords = [];
            for (const componentInput of governmentComponentsList) {
              const component = await tx.governmentComponent.create({
                data: {
                  countryId: country.id,
                  componentType: componentInput.componentType as any,
                  effectivenessScore: componentInput.effectivenessScore ?? 50,
                  implementationDate: new Date(),
                  implementationCost: componentInput.implementationCost ?? 0,
                  maintenanceCost: componentInput.maintenanceCost ?? 0,
                  requiredCapacity: componentInput.requiredCapacity ?? 50,
                  isActive: componentInput.isActive ?? true,
                  notes: componentInput.notes,
                },
              });
              componentRecords.push(component);
            }

            const synergies = [];
            for (let i = 0; i < componentRecords.length; i++) {
              for (let j = i + 1; j < componentRecords.length; j++) {
                const comp1 = componentRecords[i]!;
                const comp2 = componentRecords[j]!;
                const synergyData = checkComponentSynergy(comp1.componentType, comp2.componentType);
                if (synergyData) {
                  const synergy = await tx.componentSynergy.create({
                    data: {
                      countryId: country.id,
                      primaryComponentId: comp1.id,
                      secondaryComponentId: comp2.id,
                      synergyType: synergyData.type,
                      effectMultiplier: synergyData.multiplier,
                      description: synergyData.description,
                    },
                  });
                  synergies.push(synergy);
                }
              }
            }

            let totalSynergyBonus = 0;
            let conflictPenalty = 0;
            for (const synergy of synergies) {
              if (synergy.synergyType === "CONFLICTING") conflictPenalty += 15;
              else if (synergy.synergyType === "ADDITIVE") totalSynergyBonus += 10;
              else if (synergy.synergyType === "MULTIPLICATIVE")
                totalSynergyBonus += synergy.effectMultiplier * 10;
            }

            const baseEffectiveness =
              componentRecords.reduce((sum, comp) => sum + comp.effectivenessScore, 0) /
              (componentRecords.length || 1);
            const governmentEffectiveness = Math.max(
              0,
              Math.min(100, baseEffectiveness + totalSynergyBonus - conflictPenalty)
            );

            await tx.governmentStructure.update({
              where: { countryId: country.id },
              data: { governmentEffectiveness },
            });
          }

          if (economyBuilderState) {
            const economyState = economyBuilderState;
            if (
              economyState.selectedAtomicComponents &&
              economyState.selectedAtomicComponents.length > 0
            ) {
              for (const componentType of economyState.selectedAtomicComponents) {
                await tx.economicComponent.create({
                  data: {
                    countryId: country.id,
                    componentType: componentType as any,
                    effectivenessScore: 50,
                    implementationDate: new Date(),
                    isActive: true,
                    notes: `Added during country creation via Economy Builder`,
                  },
                });
              }
            }

            await tx.economicProfile.create({
              data: {
                countryId: country.id,
                sectorBreakdown: economyState.structure
                  ? JSON.stringify(economyState.structure)
                  : undefined,
              },
            });
          }

          await tx.user.update({
            where: { clerkUserId: userId },
            data: { countryId: country.id },
          });

          return country;
        });

        await invalidateCache(["countries.getAll"]);
        clearLayerCache("political");
        await globalCache.delete(`user_profile:${userId}`);

        return result;
      } catch (error) {
        console.error("[createCountry] Transaction failed:", error);
        throw new Error(
          `Failed to create country: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  updateCountry: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        economicInputs: z
          .object({
            coreIndicators: z
              .object({
                totalPopulation: z.number().min(0),
                gdpPerCapita: z.number().min(0),
                nominalGDP: z.number().min(0),
                realGDPGrowthRate: z.number().optional(),
                inflationRate: z.number().optional(),
                currencyExchangeRate: z.number().optional(),
              })
              .optional(),
            laborEmployment: z
              .object({
                laborForceParticipationRate: z.number().min(0).max(100),
                unemploymentRate: z.number().min(0).max(100),
                totalWorkforce: z.number().optional(),
                employmentRate: z.number().optional(),
                averageWorkweekHours: z.number().optional(),
                minimumWage: z.number().optional(),
                averageAnnualIncome: z.number().optional(),
              })
              .optional(),
            fiscalSystem: z
              .object({
                taxRevenueGDPPercent: z.number().optional(),
                governmentSpendingGDPPercent: z.number().optional(),
                governmentRevenueTotal: z.number().optional(),
                taxRevenuePerCapita: z.number().optional(),
                governmentBudgetGDPPercent: z.number().optional(),
                budgetDeficitSurplus: z.number().optional(),
                internalDebtGDPPercent: z.number().optional(),
                externalDebtGDPPercent: z.number().optional(),
                totalDebtGDPRatio: z.number().optional(),
                debtPerCapita: z.number().optional(),
                interestRates: z.number().optional(),
                debtServiceCosts: z.number().optional(),
                salesTaxRate: z.number().optional(),
              })
              .optional(),
            demographics: z
              .object({
                urbanPopulationPercent: z.number().min(0).max(100).optional(),
                lifeExpectancy: z.number().optional(),
                literacyRate: z.number().min(0).max(100).optional(),
                populationGrowthRate: z.number().optional(),
                urbanRuralSplit: z
                  .object({
                    urban: z.number(),
                    rural: z.number(),
                  })
                  .optional(),
                ageDistribution: z.array(z.any()).optional(),
                educationLevels: z.array(z.any()).optional(),
              })
              .optional(),
            incomeWealth: z
              .object({
                giniIndex: z.number().min(0).max(100).optional(),
                povertyRate: z.number().optional(),
                incomeInequalityGini: z.number().optional(),
                socialMobilityIndex: z.number().optional(),
                economicClasses: z.array(z.any()).optional(),
              })
              .optional(),
            governmentSpending: z
              .object({
                totalSpending: z.number().optional(),
                spendingGDPPercent: z.number().optional(),
                spendingPerCapita: z.number().optional(),
                spendingCategories: z.array(z.any()).optional(),
              })
              .passthrough()
              .optional(),
            nationalIdentity: z
              .object({
                countryName: z.string().optional(),
                officialName: z.string().optional(),
                governmentType: z.string().optional(),
                motto: z.string().optional(),
                mottoNative: z.string().optional(),
                capitalCity: z.string().optional(),
                largestCity: z.string().optional(),
                demonym: z.string().optional(),
                nationalReligion: z.string().optional(),
                currency: z.string().optional(),
                currencySymbol: z.string().optional(),
                officialLanguages: z.string().optional(),
                nationalLanguage: z.string().optional(),
                nationalAnthem: z.string().optional(),
                nationalDay: z.string().optional(),
                nationalSport: z.string().optional(),
                nationalAnimal: z.string().optional(),
                nationalBird: z.string().optional(),
                nationalFish: z.string().optional(),
                founders: z.string().optional(),
                nationalFlower: z.string().optional(),
                nationalDish: z.string().optional(),
                nationalFruit: z.string().optional(),
                nationalDrink: z.string().optional(),
                nationalInstrument: z.string().optional(),
                nationalSymbol: z.string().optional(),
                nationalAnimalImage: z.string().optional(),
                nationalBirdImage: z.string().optional(),
                nationalFishImage: z.string().optional(),
                foundersImage: z.string().optional(),
                nationalFlowerImage: z.string().optional(),
                nationalDishImage: z.string().optional(),
                nationalFruitImage: z.string().optional(),
                nationalDrinkImage: z.string().optional(),
                nationalInstrumentImage: z.string().optional(),
                nationalSymbolImage: z.string().optional(),
                callingCode: z.string().optional(),
                internetTLD: z.string().optional(),
                drivingSide: z.string().optional(),
                timeZone: z.string().optional(),
                isoCode: z.string().optional(),
                coordinatesLatitude: z.string().optional(),
                coordinatesLongitude: z.string().optional(),
                emergencyNumber: z.string().optional(),
                postalCodeFormat: z.string().optional(),
                weekStartDay: z.string().optional(),
                leader: z.string().optional(),
              })
              .optional(),
            geography: z
              .object({
                continent: z.string().optional(),
                region: z.string().optional(),
              })
              .optional(),
            flagUrl: z.string().optional(),
            coatOfArmsUrl: z.string().optional(),
          })
          .optional(),
        governmentComponents: z
          .array(
            z.object({
              componentType: z.string(),
              effectivenessScore: z.number().min(0).max(100).optional(),
              implementationCost: z.number().optional(),
              maintenanceCost: z.number().optional(),
              requiredCapacity: z.number().min(0).max(100).optional(),
              isActive: z.boolean().optional(),
              notes: z.string().optional(),
            })
          )
          .optional(),
        taxSystemData: z.any().optional(),
        governmentStructure: z.any().optional(),
        economyBuilderState: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: userId },
        include: { role: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const existingCountry = await ctx.db.country.findUnique({
        where: { id: input.id },
      });

      if (!existingCountry) {
        throw new Error("Country not found");
      }

      if (
        user.countryId !== input.id &&
        user.role?.name !== "admin" &&
        user.role?.name !== "system-owner"
      ) {
        throw new Error("You do not have permission to update this country");
      }

      const econ = input.economicInputs || {};
      const coreIndicators = (econ.coreIndicators || {}) as any;
      const laborEmployment = (econ.laborEmployment || {}) as any;
      const fiscalSystem = (econ.fiscalSystem || {}) as any;
      const demographics = (econ.demographics || {}) as any;
      const incomeWealth = (econ.incomeWealth || {}) as any;
      const governmentSpending = (econ.governmentSpending || {}) as any;
      const nationalIdentity = (econ.nationalIdentity || {}) as any;
      const geography = (econ.geography || {}) as any;

      const population = coreIndicators.totalPopulation || existingCountry.baselinePopulation;
      const gdpPerCapita = coreIndicators.gdpPerCapita || existingCountry.baselineGdpPerCapita;
      const nominalGDP = coreIndicators.nominalGDP || population * gdpPerCapita;
      const totalGdp = population * gdpPerCapita;

      const slug = input.name
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      try {
        const result = await ctx.db.$transaction(async (tx) => {
          const country = await tx.country.update({
            where: { id: input.id },
            data: {
              name: input.name,
              slug: slug,
              continent: geography.continent || existingCountry.continent,
              region: geography.region || existingCountry.region,
              governmentType:
                nationalIdentity.governmentType ||
                input.governmentStructure?.governmentType ||
                existingCountry.governmentType,
              religion: nationalIdentity.nationalReligion || existingCountry.religion,
              leader: nationalIdentity.leader || existingCountry.leader,
              flag: econ.flagUrl || existingCountry.flag || undefined,
              coatOfArms: econ.coatOfArmsUrl || existingCountry.coatOfArms || undefined,
              baselinePopulation: existingCountry.baselinePopulation,
              baselineGdpPerCapita: existingCountry.baselineGdpPerCapita,
              currentPopulation: population,
              currentGdpPerCapita: gdpPerCapita,
              currentTotalGdp: totalGdp,
              adjustedGdpGrowth:
                coreIndicators.realGDPGrowthRate !== undefined
                  ? coreIndicators.realGDPGrowthRate / 100
                  : existingCountry.adjustedGdpGrowth,
              populationGrowthRate:
                demographics.populationGrowthRate !== undefined
                  ? demographics.populationGrowthRate / 100
                  : existingCountry.populationGrowthRate,
              actualGdpGrowth:
                coreIndicators.realGDPGrowthRate !== undefined
                  ? coreIndicators.realGDPGrowthRate / 100
                  : existingCountry.actualGdpGrowth,
              economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
              populationTier: getPopulationTierFromPopulation(population),
              nominalGDP: nominalGDP,
              realGDPGrowthRate:
                coreIndicators.realGDPGrowthRate !== undefined
                  ? coreIndicators.realGDPGrowthRate / 100
                  : existingCountry.realGDPGrowthRate,
              inflationRate:
                coreIndicators.inflationRate !== undefined
                  ? coreIndicators.inflationRate / 100
                  : existingCountry.inflationRate,
              currencyExchangeRate:
                coreIndicators.currencyExchangeRate !== undefined
                  ? coreIndicators.currencyExchangeRate
                  : existingCountry.currencyExchangeRate,
              laborForceParticipationRate:
                laborEmployment.laborForceParticipationRate !== undefined
                  ? laborEmployment.laborForceParticipationRate
                  : existingCountry.laborForceParticipationRate,
              employmentRate:
                laborEmployment.employmentRate !== undefined
                  ? laborEmployment.employmentRate
                  : existingCountry.employmentRate,
              unemploymentRate:
                laborEmployment.unemploymentRate !== undefined
                  ? laborEmployment.unemploymentRate
                  : existingCountry.unemploymentRate,
              totalWorkforce: laborEmployment.totalWorkforce || Math.round(population * 0.65),
              averageWorkweekHours:
                laborEmployment.averageWorkweekHours !== undefined
                  ? laborEmployment.averageWorkweekHours
                  : existingCountry.averageWorkweekHours,
              minimumWage:
                laborEmployment.minimumWage !== undefined
                  ? laborEmployment.minimumWage
                  : existingCountry.minimumWage,
              averageAnnualIncome:
                laborEmployment.averageAnnualIncome !== undefined
                  ? laborEmployment.averageAnnualIncome
                  : existingCountry.averageAnnualIncome,
              taxRevenueGDPPercent:
                fiscalSystem.taxRevenueGDPPercent !== undefined
                  ? fiscalSystem.taxRevenueGDPPercent
                  : (input.taxSystemData as any)?.totalTaxRate !== undefined
                    ? (input.taxSystemData as any).totalTaxRate
                    : existingCountry.taxRevenueGDPPercent,
              governmentRevenueTotal:
                fiscalSystem.governmentRevenueTotal !== undefined
                  ? fiscalSystem.governmentRevenueTotal
                  : existingCountry.governmentRevenueTotal,
              taxRevenuePerCapita:
                fiscalSystem.taxRevenuePerCapita !== undefined
                  ? fiscalSystem.taxRevenuePerCapita
                  : existingCountry.taxRevenuePerCapita,
              governmentBudgetGDPPercent:
                fiscalSystem.governmentBudgetGDPPercent !== undefined
                  ? fiscalSystem.governmentBudgetGDPPercent
                  : existingCountry.governmentBudgetGDPPercent,
              budgetDeficitSurplus:
                fiscalSystem.budgetDeficitSurplus !== undefined
                  ? fiscalSystem.budgetDeficitSurplus
                  : existingCountry.budgetDeficitSurplus,
              internalDebtGDPPercent:
                fiscalSystem.internalDebtGDPPercent !== undefined
                  ? fiscalSystem.internalDebtGDPPercent
                  : existingCountry.internalDebtGDPPercent,
              externalDebtGDPPercent:
                fiscalSystem.externalDebtGDPPercent !== undefined
                  ? fiscalSystem.externalDebtGDPPercent
                  : existingCountry.externalDebtGDPPercent,
              totalDebtGDPRatio:
                fiscalSystem.totalDebtGDPRatio !== undefined
                  ? fiscalSystem.totalDebtGDPRatio
                  : existingCountry.totalDebtGDPRatio,
              debtPerCapita:
                fiscalSystem.debtPerCapita !== undefined
                  ? fiscalSystem.debtPerCapita
                  : existingCountry.debtPerCapita,
              interestRates:
                fiscalSystem.interestRates !== undefined
                  ? fiscalSystem.interestRates
                  : existingCountry.interestRates,
              debtServiceCosts:
                fiscalSystem.debtServiceCosts !== undefined
                  ? fiscalSystem.debtServiceCosts
                  : existingCountry.debtServiceCosts,
              povertyRate:
                incomeWealth.povertyRate !== undefined
                  ? incomeWealth.povertyRate
                  : existingCountry.povertyRate,
              incomeInequalityGini:
                incomeWealth.incomeInequalityGini !== undefined
                  ? incomeWealth.incomeInequalityGini
                  : existingCountry.incomeInequalityGini,
              socialMobilityIndex:
                incomeWealth.socialMobilityIndex !== undefined
                  ? incomeWealth.socialMobilityIndex
                  : existingCountry.socialMobilityIndex,
              totalGovernmentSpending:
                governmentSpending.totalSpending !== undefined
                  ? governmentSpending.totalSpending
                  : existingCountry.totalGovernmentSpending,
              spendingGDPPercent:
                governmentSpending.spendingGDPPercent !== undefined
                  ? governmentSpending.spendingGDPPercent
                  : existingCountry.spendingGDPPercent,
              spendingPerCapita:
                governmentSpending.spendingPerCapita !== undefined
                  ? governmentSpending.spendingPerCapita
                  : existingCountry.spendingPerCapita,
              lifeExpectancy:
                demographics.lifeExpectancy !== undefined
                  ? demographics.lifeExpectancy
                  : existingCountry.lifeExpectancy,
              urbanPopulationPercent:
                demographics.urbanRuralSplit?.urban !== undefined
                  ? demographics.urbanRuralSplit.urban
                  : existingCountry.urbanPopulationPercent,
              ruralPopulationPercent:
                demographics.urbanRuralSplit?.rural !== undefined
                  ? demographics.urbanRuralSplit.rural
                  : existingCountry.ruralPopulationPercent,
              literacyRate:
                demographics.literacyRate !== undefined
                  ? demographics.literacyRate
                  : existingCountry.literacyRate,
              lastCalculated: new Date(),
            },
          });

          if (nationalIdentity && Object.keys(nationalIdentity).length > 0) {
            await tx.nationalIdentity.upsert({
              where: { countryId: country.id },
              update: {
                countryName: nationalIdentity.countryName || input.name,
                officialName: nationalIdentity.officialName,
                governmentType: nationalIdentity.governmentType,
                motto: nationalIdentity.motto,
                mottoNative: nationalIdentity.mottoNative,
                capitalCity: nationalIdentity.capitalCity,
                largestCity: nationalIdentity.largestCity,
                demonym: nationalIdentity.demonym,
                currency: nationalIdentity.currency,
                currencySymbol: nationalIdentity.currencySymbol,
                officialLanguages: nationalIdentity.officialLanguages,
                nationalLanguage: nationalIdentity.nationalLanguage,
                nationalAnthem: nationalIdentity.nationalAnthem,
                nationalReligion: nationalIdentity.nationalReligion,
                nationalDay: nationalIdentity.nationalDay,
                callingCode: nationalIdentity.callingCode,
                internetTLD: nationalIdentity.internetTLD,
                drivingSide: nationalIdentity.drivingSide,
                timeZone: nationalIdentity.timeZone,
                isoCode: nationalIdentity.isoCode,
                coordinatesLatitude: nationalIdentity.coordinatesLatitude,
                coordinatesLongitude: nationalIdentity.coordinatesLongitude,
                emergencyNumber: nationalIdentity.emergencyNumber,
                postalCodeFormat: nationalIdentity.postalCodeFormat,
                nationalSport: nationalIdentity.nationalSport,
                nationalBird: nationalIdentity.nationalBird,
                nationalFish: nationalIdentity.nationalFish,
                founders: nationalIdentity.founders,
                nationalFlower: nationalIdentity.nationalFlower,
                nationalDish: nationalIdentity.nationalDish,
                nationalFruit: nationalIdentity.nationalFruit,
                nationalDrink: nationalIdentity.nationalDrink,
                nationalInstrument: nationalIdentity.nationalInstrument,
                nationalSymbol: nationalIdentity.nationalSymbol,
                nationalAnimalImage: nationalIdentity.nationalAnimalImage,
                nationalBirdImage: nationalIdentity.nationalBirdImage,
                nationalFishImage: nationalIdentity.nationalFishImage,
                foundersImage: nationalIdentity.foundersImage,
                nationalFlowerImage: nationalIdentity.nationalFlowerImage,
                nationalDishImage: nationalIdentity.nationalDishImage,
                nationalFruitImage: nationalIdentity.nationalFruitImage,
                nationalDrinkImage: nationalIdentity.nationalDrinkImage,
                nationalInstrumentImage: nationalIdentity.nationalInstrumentImage,
                nationalSymbolImage: nationalIdentity.nationalSymbolImage,
                weekStartDay: nationalIdentity.weekStartDay,
              },
              create: {
                countryId: country.id,
                countryName: nationalIdentity.countryName || input.name,
                officialName: nationalIdentity.officialName,
                governmentType: nationalIdentity.governmentType,
                motto: nationalIdentity.motto,
                mottoNative: nationalIdentity.mottoNative,
                capitalCity: nationalIdentity.capitalCity,
                largestCity: nationalIdentity.largestCity,
                demonym: nationalIdentity.demonym,
                currency: nationalIdentity.currency,
                currencySymbol: nationalIdentity.currencySymbol,
                officialLanguages: nationalIdentity.officialLanguages,
                nationalLanguage: nationalIdentity.nationalLanguage,
                nationalAnthem: nationalIdentity.nationalAnthem,
                nationalReligion: nationalIdentity.nationalReligion,
                nationalDay: nationalIdentity.nationalDay,
                callingCode: nationalIdentity.callingCode,
                internetTLD: nationalIdentity.internetTLD,
                drivingSide: nationalIdentity.drivingSide,
                timeZone: nationalIdentity.timeZone,
                isoCode: nationalIdentity.isoCode,
                coordinatesLatitude: nationalIdentity.coordinatesLatitude,
                coordinatesLongitude: nationalIdentity.coordinatesLongitude,
                emergencyNumber: nationalIdentity.emergencyNumber,
                postalCodeFormat: nationalIdentity.postalCodeFormat,
                nationalSport: nationalIdentity.nationalSport,
                nationalBird: nationalIdentity.nationalBird,
                nationalFish: nationalIdentity.nationalFish,
                founders: nationalIdentity.founders,
                nationalFlower: nationalIdentity.nationalFlower,
                nationalDish: nationalIdentity.nationalDish,
                nationalFruit: nationalIdentity.nationalFruit,
                nationalDrink: nationalIdentity.nationalDrink,
                nationalInstrument: nationalIdentity.nationalInstrument,
                nationalSymbol: nationalIdentity.nationalSymbol,
                nationalAnimalImage: nationalIdentity.nationalAnimalImage,
                nationalBirdImage: nationalIdentity.nationalBirdImage,
                nationalFishImage: nationalIdentity.nationalFishImage,
                foundersImage: nationalIdentity.foundersImage,
                nationalFlowerImage: nationalIdentity.nationalFlowerImage,
                nationalDishImage: nationalIdentity.nationalDishImage,
                nationalFruitImage: nationalIdentity.nationalFruitImage,
                nationalDrinkImage: nationalIdentity.nationalDrinkImage,
                nationalInstrumentImage: nationalIdentity.nationalInstrumentImage,
                nationalSymbolImage: nationalIdentity.nationalSymbolImage,
                weekStartDay: nationalIdentity.weekStartDay,
              },
            });
          }

          if (demographics && Object.keys(demographics).length > 0) {
            await tx.demographics.upsert({
              where: { countryId: country.id },
              update: {
                ageDistribution: JSON.stringify(demographics.ageDistribution || []),
                educationLevels: JSON.stringify(demographics.educationLevels || []),
                birthRate: demographics.birthRate,
                deathRate: demographics.deathRate,
                migrationRate: demographics.migrationRate,
                dependencyRatio: demographics.dependencyRatio,
                medianAge: demographics.medianAge,
                populationGrowthProjection: demographics.populationGrowthRate,
              },
              create: {
                countryId: country.id,
                ageDistribution: JSON.stringify(demographics.ageDistribution || []),
                educationLevels: JSON.stringify(demographics.educationLevels || []),
                birthRate: demographics.birthRate,
                deathRate: demographics.deathRate,
                migrationRate: demographics.migrationRate,
                dependencyRatio: demographics.dependencyRatio,
                medianAge: demographics.medianAge,
                populationGrowthProjection: demographics.populationGrowthRate,
              },
            });
          }

          if (fiscalSystem && Object.keys(fiscalSystem).length > 0) {
            await tx.fiscalSystem.upsert({
              where: { countryId: country.id },
              update: {
                personalIncomeTaxRates: fiscalSystem.personalIncomeTaxRates,
                corporateTaxRates: fiscalSystem.corporateTaxRates,
                salesTaxRate: fiscalSystem.salesTaxRate,
                propertyTaxRate: fiscalSystem.propertyTaxRate,
                payrollTaxRate: fiscalSystem.payrollTaxRate,
                exciseTaxRates: fiscalSystem.exciseTaxRates,
                wealthTaxRate: fiscalSystem.wealthTaxRate,
                spendingByCategory: fiscalSystem.spendingByCategory,
                fiscalBalanceGDPPercent: fiscalSystem.fiscalBalanceGDPPercent,
                primaryBalanceGDPPercent: fiscalSystem.primaryBalanceGDPPercent,
                taxEfficiency: fiscalSystem.taxEfficiency,
              },
              create: {
                countryId: country.id,
                personalIncomeTaxRates: fiscalSystem.personalIncomeTaxRates,
                corporateTaxRates: fiscalSystem.corporateTaxRates,
                salesTaxRate: fiscalSystem.salesTaxRate,
                propertyTaxRate: fiscalSystem.propertyTaxRate,
                payrollTaxRate: fiscalSystem.payrollTaxRate,
                exciseTaxRates: fiscalSystem.exciseTaxRates,
                wealthTaxRate: fiscalSystem.wealthTaxRate,
                spendingByCategory: fiscalSystem.spendingByCategory,
                fiscalBalanceGDPPercent: fiscalSystem.fiscalBalanceGDPPercent,
                primaryBalanceGDPPercent: fiscalSystem.primaryBalanceGDPPercent,
                taxEfficiency: fiscalSystem.taxEfficiency,
              },
            });
          }

          if (input.taxSystemData) {
            const taxSystemData = input.taxSystemData;

            const existingTaxSys = await tx.taxSystem.findUnique({
              where: { countryId: country.id },
            });

            if (existingTaxSys) {
              await tx.taxBracket.deleteMany({
                where: { taxSystemId: existingTaxSys.id },
              });
              await tx.taxCategory.deleteMany({
                where: { taxSystemId: existingTaxSys.id },
              });
            }

            const taxSystem = await tx.taxSystem.upsert({
              where: { countryId: country.id },
              update: {
                taxSystemName: taxSystemData.taxSystemName || "National Tax System",
                taxAuthority: taxSystemData.taxAuthority,
                fiscalYear: taxSystemData.fiscalYear || "calendar",
                taxCode: taxSystemData.taxCode,
                baseRate: taxSystemData.baseRate,
                progressiveTax: taxSystemData.progressiveTax ?? true,
                flatTaxRate: taxSystemData.flatTaxRate,
                alternativeMinTax: taxSystemData.alternativeMinTax ?? false,
                alternativeMinRate: taxSystemData.alternativeMinRate,
                taxHolidays: taxSystemData.taxHolidays,
                complianceRate: taxSystemData.complianceRate,
                collectionEfficiency: taxSystemData.collectionEfficiency,
                lastReform: taxSystemData.lastReform,
              },
              create: {
                countryId: country.id,
                taxSystemName: taxSystemData.taxSystemName || "National Tax System",
                taxAuthority: taxSystemData.taxAuthority,
                fiscalYear: taxSystemData.fiscalYear || "calendar",
                taxCode: taxSystemData.taxCode,
                baseRate: taxSystemData.baseRate,
                progressiveTax: taxSystemData.progressiveTax ?? true,
                flatTaxRate: taxSystemData.flatTaxRate,
                alternativeMinTax: taxSystemData.alternativeMinTax ?? false,
                alternativeMinRate: taxSystemData.alternativeMinRate,
                taxHolidays: taxSystemData.taxHolidays,
                complianceRate: taxSystemData.complianceRate,
                collectionEfficiency: taxSystemData.collectionEfficiency,
                lastReform: taxSystemData.lastReform,
              },
            });

            if (taxSystemData.categories && taxSystemData.categories.length > 0) {
              for (const categoryData of taxSystemData.categories) {
                const taxCategory = await tx.taxCategory.create({
                  data: {
                    taxSystemId: taxSystem.id,
                    categoryName: categoryData.categoryName,
                    categoryType: categoryData.categoryType,
                    description: categoryData.description,
                    isActive: categoryData.isActive ?? true,
                    baseRate: categoryData.baseRate,
                    calculationMethod: categoryData.calculationMethod || "percentage",
                    minimumAmount: categoryData.minimumAmount,
                    maximumAmount: categoryData.maximumAmount,
                    exemptionAmount: categoryData.exemptionAmount,
                    deductionAllowed: categoryData.deductionAllowed ?? true,
                    standardDeduction: categoryData.standardDeduction,
                    priority: categoryData.priority || 50,
                    color: categoryData.color,
                    icon: categoryData.icon,
                  },
                });

                if (categoryData.brackets && categoryData.brackets.length > 0) {
                  for (const bracketData of categoryData.brackets) {
                    await tx.taxBracket.create({
                      data: {
                        taxSystemId: taxSystem.id,
                        categoryId: taxCategory.id,
                        bracketName: bracketData.bracketName,
                        minIncome: bracketData.minIncome,
                        maxIncome: bracketData.maxIncome,
                        rate: bracketData.rate,
                        flatAmount: bracketData.flatAmount,
                        marginalRate: bracketData.marginalRate ?? true,
                        isActive: bracketData.isActive ?? true,
                        priority: bracketData.priority || 50,
                      },
                    });
                  }
                }
              }
            }
          }

          if (input.governmentStructure) {
            const govInput = input.governmentStructure;

            const existingGovStruct = await tx.governmentStructure.findUnique({
              where: { countryId: country.id },
            });

            if (existingGovStruct) {
              await tx.governmentDepartment.deleteMany({
                where: { governmentStructureId: existingGovStruct.id },
              });
            }

            const govStructure = await tx.governmentStructure.upsert({
              where: { countryId: country.id },
              update: {
                governmentName: govInput.governmentName || `Government of ${input.name}`,
                governmentType: govInput.governmentType || "Federal Republic",
                headOfState: govInput.headOfState,
                headOfGovernment: govInput.headOfGovernment,
                legislatureName: govInput.legislatureName,
                executiveName: govInput.executiveName,
                judicialName: govInput.judicialName,
                totalBudget: govInput.totalBudget || 0,
                fiscalYear: govInput.fiscalYear || "Calendar Year",
                budgetCurrency: govInput.budgetCurrency || "USD",
              },
              create: {
                countryId: country.id,
                governmentName: govInput.governmentName || `Government of ${input.name}`,
                governmentType: govInput.governmentType || "Federal Republic",
                headOfState: govInput.headOfState,
                headOfGovernment: govInput.headOfGovernment,
                legislatureName: govInput.legislatureName,
                executiveName: govInput.executiveName,
                judicialName: govInput.judicialName,
                totalBudget: govInput.totalBudget || 0,
                fiscalYear: govInput.fiscalYear || "Calendar Year",
                budgetCurrency: govInput.budgetCurrency || "USD",
              },
            });

            if (govInput.departments && govInput.departments.length > 0) {
              const deptIdMap = new Map<string, string>();
              for (const deptInput of govInput.departments) {
                const tempId = deptInput.id || deptInput.name;
                const department = await tx.governmentDepartment.create({
                  data: {
                    governmentStructureId: govStructure.id,
                    name: deptInput.name,
                    shortName: deptInput.shortName,
                    category: deptInput.category,
                    description: deptInput.description,
                    minister: deptInput.minister,
                    ministerTitle: deptInput.ministerTitle || "Minister",
                    headquarters: deptInput.headquarters,
                    established: deptInput.established,
                    employeeCount: deptInput.employeeCount,
                    icon: deptInput.icon,
                    color: deptInput.color || "#6366f1",
                    priority: deptInput.priority || 50,
                    isActive: deptInput.isActive ?? true,
                    organizationalLevel: deptInput.organizationalLevel || "Ministry",
                    functions: deptInput.functions ? JSON.stringify(deptInput.functions) : null,
                    kpis: deptInput.kpis ? JSON.stringify(deptInput.kpis) : null,
                  },
                });
                deptIdMap.set(tempId, department.id);
              }

              for (const deptInput of govInput.departments) {
                if (deptInput.parentDepartmentId) {
                  const tempId = deptInput.id || deptInput.name;
                  const actualDeptId = deptIdMap.get(tempId);
                  const actualParentId = deptIdMap.get(deptInput.parentDepartmentId);
                  if (actualDeptId && actualParentId) {
                    await tx.governmentDepartment.update({
                      where: { id: actualDeptId },
                      data: { parentDepartmentId: actualParentId },
                    });
                  }
                }
              }
            }
          }

          if (input.governmentComponents) {
            await tx.governmentComponent.deleteMany({
              where: { countryId: country.id },
            });

            const componentRecords = [];
            for (const componentInput of input.governmentComponents) {
              const component = await tx.governmentComponent.create({
                data: {
                  countryId: country.id,
                  componentType: componentInput.componentType as any,
                  effectivenessScore: componentInput.effectivenessScore ?? 50,
                  implementationDate: new Date(),
                  implementationCost: componentInput.implementationCost ?? 0,
                  maintenanceCost: componentInput.maintenanceCost ?? 0,
                  requiredCapacity: componentInput.requiredCapacity ?? 50,
                  isActive: componentInput.isActive ?? true,
                  notes: componentInput.notes,
                },
              });
              componentRecords.push(component);
            }

            await tx.componentSynergy.deleteMany({
              where: { countryId: country.id },
            });

            const synergies = [];
            for (let i = 0; i < componentRecords.length; i++) {
              for (let j = i + 1; j < componentRecords.length; j++) {
                const comp1 = componentRecords[i]!;
                const comp2 = componentRecords[j]!;
                const synergyData = checkComponentSynergy(comp1.componentType, comp2.componentType);
                if (synergyData) {
                  const synergy = await tx.componentSynergy.create({
                    data: {
                      countryId: country.id,
                      primaryComponentId: comp1.id,
                      secondaryComponentId: comp2.id,
                      synergyType: synergyData.type,
                      effectMultiplier: synergyData.multiplier,
                      description: synergyData.description,
                    },
                  });
                  synergies.push(synergy);
                }
              }
            }

            let totalSynergyBonus = 0;
            let conflictPenalty = 0;
            for (const synergy of synergies) {
              if (synergy.synergyType === "CONFLICTING") conflictPenalty += 15;
              else if (synergy.synergyType === "ADDITIVE") totalSynergyBonus += 10;
              else if (synergy.synergyType === "MULTIPLICATIVE")
                totalSynergyBonus += synergy.effectMultiplier * 10;
            }

            const baseEffectiveness =
              componentRecords.reduce((sum, comp) => sum + comp.effectivenessScore, 0) /
              (componentRecords.length || 1);
            const governmentEffectiveness = Math.max(
              0,
              Math.min(100, baseEffectiveness + totalSynergyBonus - conflictPenalty)
            );

            await tx.governmentStructure.update({
              where: { countryId: country.id },
              data: { governmentEffectiveness },
            });
          }

          if (input.economyBuilderState) {
            const economyState = input.economyBuilderState;

            await tx.economicComponent.deleteMany({
              where: { countryId: country.id },
            });

            if (
              economyState.selectedAtomicComponents &&
              economyState.selectedAtomicComponents.length > 0
            ) {
              for (const componentType of economyState.selectedAtomicComponents) {
                await tx.economicComponent.create({
                  data: {
                    countryId: country.id,
                    componentType: componentType as any,
                    effectivenessScore: 50,
                    implementationDate: new Date(),
                    isActive: true,
                    notes: `Updated during country edit via Economy Builder`,
                  },
                });
              }
            }

            await tx.economicProfile.upsert({
              where: { countryId: country.id },
              update: {
                sectorBreakdown: economyState.structure
                  ? JSON.stringify(economyState.structure)
                  : undefined,
              },
              create: {
                countryId: country.id,
                sectorBreakdown: economyState.structure
                  ? JSON.stringify(economyState.structure)
                  : undefined,
              },
            });
          }

          return country;
        });

        await invalidateCache(["countries."]);
        clearLayerCache("political");

        return result;
      } catch (error) {
        console.error("[updateCountry] Transaction failed:", error);
        throw new Error(
          `Failed to update country: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // Storyteller effects endpoints

  getStorytellerEffects: protectedProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.storytellerEffect.findMany({
        where: input.countryId ? { countryId: input.countryId } : undefined,
        include: {
          country: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { ixTimeTimestamp: "desc" },
      });
    }),

  addStorytellerEffect: protectedProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        inputType: z.string(),
        value: z.number(),
        description: z.string(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.storytellerEffect.create({
        data: {
          countryId: input.countryId || null,
          inputType: input.inputType,
          value: input.value,
          description: input.description,
          duration: input.duration || null,
          isActive: true,
          ixTimeTimestamp: new Date(),
        },
      });

      await invalidateCache(["countries."]);
      await globalCache.deleteByPattern("user_profile:*");

      return result;
    }),

  updateStorytellerEffect: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        inputType: z.string().optional(),
        value: z.number().optional(),
        description: z.string().optional(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.db.storytellerEffect.update({
        where: { id },
        data,
      });

      await invalidateCache(["countries."]);
      await globalCache.deleteByPattern("user_profile:*");

      return result;
    }),

  deleteStorytellerEffect: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.storytellerEffect.delete({
        where: { id: input.id },
      });

      await invalidateCache(["countries."]);
      await globalCache.deleteByPattern("user_profile:*");

      return result;
    }),
};
