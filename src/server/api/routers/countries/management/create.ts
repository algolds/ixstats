/**
 * Country Management — Create Procedure
 *
 * Handles creation of new player countries from the Country Builder,
 * including foundation templates, archetypes, and initial sub-system setup.
 */

import { z } from "zod";
import { protectedProcedure } from "~/server/api/trpc";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { invalidateCache, globalCache } from "~/lib/cache";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { getBonusConfig, grantBonus } from "~/lib/vault/vault-bonus";
import {
  countryEconomicInputsSchema,
  countryGovernmentComponentSchema,
} from "~/server/shared/country-payload-builder";
import {
  syncNationalIdentity,
  syncDemographics,
  syncIncomeAndSpending,
  syncTaxSystem,
  syncGovernmentStructure,
  syncGovernmentComponents,
  syncEconomyBuilderState,
} from "~/server/shared/country-mutation-helpers";


export const managementCreateProcedures = {
  // Create a new country from builder
  createCountry: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        foundationCountry: z.string().nullable(),
        economicInputs: countryEconomicInputsSchema,
        governmentComponents: z.array(countryGovernmentComponentSchema).optional(),
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
              governmentComponentsList = parsedComps.map((type: string) => ({
                componentType: type,
                effectivenessScore: 60,
                isActive: true,
              }));
            }
          } catch (e) {
            console.error("Failed to parse archetype governmentComponents:", e);
          }
        }

        if (!economyBuilderState && archetype.economicStructure) {
          try {
            const parsedEcon = JSON.parse(archetype.economicStructure);
            economyBuilderState = {
              structure: {
                economicModel: archetype.economicModel || "Social Market",
                economicTier: "Developed",
                totalGDP: nominalGDP,
                gdpPerCapita,
                population,
                tradeOpenness: parsedEcon.tradeOpenness || 60,
                economicFreedom: parsedEcon.economicFreedom || 70,
                creditRating: "AA",
                fdi: nominalGDP * 0.03,
                foreignReserves: nominalGDP * 0.15,
              },
              sectors: parsedEcon.sectors || [],
              selectedAtomicComponents: parsedEcon.selectedAtomicComponents || [],
            };
          } catch (e) {
            console.error("Failed to parse archetype economicStructure:", e);
          }
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
              slug,
              continent: geography.continent || foundationData?.continent || "Custom",
              region: geography.region || foundationData?.region || "Custom",
              landArea: foundationData?.landArea,
              areaSqMi: foundationData?.areaSqMi,
              governmentType:
                nationalIdentity.governmentType ||
                governmentStructure?.governmentType ||
                "Federal Republic",
              religion: nationalIdentity.nationalReligion || "Secular",
              leader: nationalIdentity.leader || "President",
              flag: econ.flagUrl || foundationData?.flag || undefined,
              coatOfArms: econ.coatOfArmsUrl || foundationData?.coatOfArms || undefined,
              baselinePopulation: population,
              baselineGdpPerCapita: gdpPerCapita,
              currentPopulation: population,
              currentGdpPerCapita: gdpPerCapita,
              currentTotalGdp: totalGdp,
              adjustedGdpGrowth:
                coreIndicators.realGDPGrowthRate !== undefined
                  ? coreIndicators.realGDPGrowthRate / 100
                  : 0.025,
              populationGrowthRate:
                demographics.populationGrowthRate !== undefined
                  ? demographics.populationGrowthRate / 100
                  : 0.008,
              actualGdpGrowth:
                coreIndicators.realGDPGrowthRate !== undefined
                  ? coreIndicators.realGDPGrowthRate / 100
                  : 0.025,
              economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
              populationTier: getPopulationTierFromPopulation(population),
              nominalGDP,
              realGDPGrowthRate:
                coreIndicators.realGDPGrowthRate !== undefined
                  ? coreIndicators.realGDPGrowthRate / 100
                  : 0.025,
              maxGdpGrowthRate: 0.15,

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
              minimumWage: laborEmployment.minimumWage || 15,
              averageAnnualIncome: laborEmployment.averageAnnualIncome || gdpPerCapita * 0.8,
              taxRevenueGDPPercent:
                fiscalSystem.taxRevenueGDPPercent ||
                (taxSystemData as any)?.totalTaxRate ||
                25,
              governmentRevenueTotal:
                fiscalSystem.governmentRevenueTotal || nominalGDP * 0.25,
              taxRevenuePerCapita:
                fiscalSystem.taxRevenuePerCapita || (nominalGDP * 0.25) / population,
              governmentBudgetGDPPercent: fiscalSystem.governmentBudgetGDPPercent || 25,
              budgetDeficitSurplus: fiscalSystem.budgetDeficitSurplus || 0,
              internalDebtGDPPercent: fiscalSystem.internalDebtGDPPercent || 30,
              externalDebtGDPPercent: fiscalSystem.externalDebtGDPPercent || 20,
              totalDebtGDPRatio: fiscalSystem.totalDebtGDPRatio || 50,
              debtPerCapita: fiscalSystem.debtPerCapita || (nominalGDP * 0.5) / population,
              interestRates: fiscalSystem.interestRates || 3.5,
              debtServiceCosts: fiscalSystem.debtServiceCosts || nominalGDP * 0.02,
              povertyRate: incomeWealth.povertyRate || 12,
              incomeInequalityGini:
                incomeWealth.incomeInequalityGini ||
                (incomeWealth.giniIndex ? incomeWealth.giniIndex / 100 : 0.35),
              socialMobilityIndex: incomeWealth.socialMobilityIndex || 65,
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

          await syncNationalIdentity(tx, country.id, input.name, nationalIdentity);
          await syncDemographics(tx, country.id, demographics);
          await syncIncomeAndSpending(tx, country.id, incomeWealth, governmentSpending, fiscalSystem);
          await syncTaxSystem(tx, country.id, taxSystemData);
          await syncGovernmentStructure(tx, country.id, input.name, governmentStructure);
          await syncGovernmentComponents(tx, country.id, governmentComponentsList);
          await syncEconomyBuilderState(tx, country.id, economyBuilderState);

          await tx.user.update({
            where: { clerkUserId: userId },
            data: { countryId: country.id },
          });

          return country;
        });

        await invalidateCache(["countries.getAll"]);
        clearLayerCache("political");
        await globalCache.delete(`user_profile:${userId}`);

        // Onboarding bonuses (one-time)
        try {
          const bcfg = await getBonusConfig(ctx.db);
          await grantBonus(ctx.db, userId, "bonus:new_player", bcfg.newPlayer, {
            oneTime: true,
            metadata: { countryId: result.id, countryName: result.name },
          });
          if (input.foundationCountry) {
            await grantBonus(ctx.db, userId, "bonus:wiki_import", bcfg.wikiImport, {
              oneTime: true,
              metadata: {
                countryId: result.id,
                countryName: result.name,
                foundation: input.foundationCountry,
              },
            });
          }
        } catch (bonusError) {
          console.error("[createCountry] Failed to grant onboarding bonus:", bonusError);
        }

        return result;
      } catch (error) {
        console.error("[createCountry] Transaction failed:", error);
        throw new Error(
          `Failed to create country: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),
};
