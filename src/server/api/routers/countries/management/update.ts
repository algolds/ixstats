/**
 * Country Management — Update Procedure
 *
 * Handles updating country identity, economic indicators, government structures,
 * tax systems, and demographics.
 */

import { z } from "zod";
import { protectedProcedure } from "~/server/api/trpc";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { invalidateCache } from "~/lib/cache";
import { clearLayerCache, invalidateCatalogCache } from "~/server/shared/layer-cache";
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

export const managementUpdateProcedures = {
  updateCountry: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        economicInputs: countryEconomicInputsSchema,
        governmentComponents: z.array(countryGovernmentComponentSchema).optional(),
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
              slug,
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
              nominalGDP,
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
                  : incomeWealth.giniIndex !== undefined
                    ? incomeWealth.giniIndex / 100
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

          await syncNationalIdentity(tx, country.id, input.name, nationalIdentity);
          await syncDemographics(tx, country.id, demographics);
          await syncIncomeAndSpending(
            tx,
            country.id,
            incomeWealth,
            governmentSpending,
            fiscalSystem
          );
          await syncTaxSystem(tx, country.id, input.taxSystemData);
          await syncGovernmentStructure(tx, country.id, input.name, input.governmentStructure);
          await syncGovernmentComponents(tx, country.id, input.governmentComponents);
          await syncEconomyBuilderState(tx, country.id, input.economyBuilderState);

          return country;
        });

        await invalidateCache(["countries."]);
        clearLayerCache("political");
        invalidateCatalogCache(`gov-components:${input.id}`);

        return result;
      } catch (error) {
        console.error("[updateCountry] Transaction failed:", error);
        throw new Error(
          `Failed to update country: ${error instanceof Error ? error.message : "Unknown error"}`,
          { cause: error }
        );
      }
    }),
};
