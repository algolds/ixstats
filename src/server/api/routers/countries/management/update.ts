/**
 * Country Management — Update Procedure
 *
 * Handles updating country identity, economic indicators, government structures,
 * tax systems, and demographics.
 */

import type { Country } from "@prisma/client";
import { z } from "zod";
import { IxTime } from "~/lib/ixtime";
import { pct, type EconInputs, type NumberKey } from "./shared";
import { generateSlug } from "~/lib/utils/slug-utils";
import { protectedProcedure } from "~/server/api/trpc";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { invalidateCache, globalCache } from "~/lib/cache";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import {
  countryEconomicInputsSchema,
  countryGovernmentComponentSchema,
  countryTaxSystemInputSchema,
  countryGovernmentStructureInputSchema,
  countryEconomyBuilderStateSchema,
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

type NumberOverrides = { [K in NumberKey]?: Country[K] };
type TextKey =
  "continent" | "region" | "governmentType" | "religion" | "leader" | "flag" | "coatOfArms";

/** Text fields: a supplied (non-empty) value wins, otherwise the stored one is kept. */
const TEXT_SOURCES: ReadonlyArray<
  readonly [TextKey, (e: EconInputs, structureType: string | undefined) => string | undefined]
> = [
  ["continent", (e) => e.geography?.continent],
  ["region", (e) => e.geography?.region],
  ["governmentType", (e, structureType) => e.nationalIdentity?.governmentType || structureType],
  ["religion", (e) => e.nationalIdentity?.nationalReligion],
  ["leader", (e) => e.nationalIdentity?.leader],
  ["flag", (e) => e.flagUrl],
  ["coatOfArms", (e) => e.coatOfArmsUrl],
];

/** Numeric fields: a supplied value (even 0) wins, otherwise the stored one is kept. */
const NUMBER_SOURCES: ReadonlyArray<
  readonly [NumberKey, (e: EconInputs, taxRate: number | undefined) => number | undefined]
> = [
  ["adjustedGdpGrowth", (e) => pct(e.coreIndicators?.realGDPGrowthRate)],
  ["actualGdpGrowth", (e) => pct(e.coreIndicators?.realGDPGrowthRate)],
  ["realGDPGrowthRate", (e) => pct(e.coreIndicators?.realGDPGrowthRate)],
  ["inflationRate", (e) => pct(e.coreIndicators?.inflationRate)],
  ["currencyExchangeRate", (e) => e.coreIndicators?.currencyExchangeRate],
  ["populationGrowthRate", (e) => pct(e.demographics?.populationGrowthRate)],
  ["lifeExpectancy", (e) => e.demographics?.lifeExpectancy],
  ["urbanPopulationPercent", (e) => e.demographics?.urbanRuralSplit?.urban],
  ["ruralPopulationPercent", (e) => e.demographics?.urbanRuralSplit?.rural],
  ["literacyRate", (e) => e.demographics?.literacyRate],
  ["laborForceParticipationRate", (e) => e.laborEmployment?.laborForceParticipationRate],
  ["employmentRate", (e) => e.laborEmployment?.employmentRate],
  ["unemploymentRate", (e) => e.laborEmployment?.unemploymentRate],
  ["averageWorkweekHours", (e) => e.laborEmployment?.averageWorkweekHours],
  ["minimumWage", (e) => e.laborEmployment?.minimumWage],
  ["averageAnnualIncome", (e) => e.laborEmployment?.averageAnnualIncome],
  ["taxRevenueGDPPercent", (e, taxRate) => e.fiscalSystem?.taxRevenueGDPPercent ?? taxRate],
  ["governmentRevenueTotal", (e) => e.fiscalSystem?.governmentRevenueTotal],
  ["taxRevenuePerCapita", (e) => e.fiscalSystem?.taxRevenuePerCapita],
  ["governmentBudgetGDPPercent", (e) => e.fiscalSystem?.governmentBudgetGDPPercent],
  ["budgetDeficitSurplus", (e) => e.fiscalSystem?.budgetDeficitSurplus],
  ["internalDebtGDPPercent", (e) => e.fiscalSystem?.internalDebtGDPPercent],
  ["externalDebtGDPPercent", (e) => e.fiscalSystem?.externalDebtGDPPercent],
  ["totalDebtGDPRatio", (e) => e.fiscalSystem?.totalDebtGDPRatio],
  ["debtPerCapita", (e) => e.fiscalSystem?.debtPerCapita],
  ["interestRates", (e) => e.fiscalSystem?.interestRates],
  ["debtServiceCosts", (e) => e.fiscalSystem?.debtServiceCosts],
  ["povertyRate", (e) => e.incomeWealth?.povertyRate],
  [
    "incomeInequalityGini",
    (e) => e.incomeWealth?.incomeInequalityGini ?? pct(e.incomeWealth?.giniIndex),
  ],
  ["socialMobilityIndex", (e) => e.incomeWealth?.socialMobilityIndex],
  ["totalGovernmentSpending", (e) => e.governmentSpending?.totalSpending],
  ["spendingGDPPercent", (e) => e.governmentSpending?.spendingGDPPercent],
  ["spendingPerCapita", (e) => e.governmentSpending?.spendingPerCapita],
];

export const managementUpdateProcedures = {
  updateCountry: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        economicInputs: countryEconomicInputsSchema,
        governmentComponents: z.array(countryGovernmentComponentSchema).optional(),
        taxSystemData: countryTaxSystemInputSchema.nullish(),
        governmentStructure: countryGovernmentStructureInputSchema.nullish(),
        economyBuilderState: countryEconomyBuilderStateSchema.nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      await assertCountryWriteAccess(ctx, input.id);

      const existingCountry = await ctx.db.country.findUnique({
        where: { id: input.id },
      });

      if (!existingCountry) {
        throw new Error("Country not found");
      }

      const econ: EconInputs = input.economicInputs ?? {};
      const { coreIndicators, laborEmployment, demographics } = econ;
      const { fiscalSystem, incomeWealth, governmentSpending, nationalIdentity } = econ;

      const population = coreIndicators?.totalPopulation || existingCountry.baselinePopulation;
      const gdpPerCapita = coreIndicators?.gdpPerCapita || existingCountry.baselineGdpPerCapita;
      const nominalGDP = coreIndicators?.nominalGDP || population * gdpPerCapita;
      const taxRate = input.taxSystemData?.totalTaxRate;

      const textOverrides = Object.fromEntries(
        TEXT_SOURCES.map(([key, get]) => [
          key,
          get(econ, input.governmentStructure?.governmentType) || existingCountry[key] || undefined,
        ])
      ) as { [K in TextKey]?: string };
      const numberOverrides = Object.fromEntries(
        NUMBER_SOURCES.map(([key, get]) => [key, get(econ, taxRate) ?? existingCountry[key]])
      ) as NumberOverrides;

      try {
        const result = await ctx.db.$transaction(async (tx) => {
          const country = await tx.country.update({
            where: { id: input.id },
            data: {
              name: input.name,
              slug: generateSlug(input.name),
              ...textOverrides,
              ...numberOverrides,
              baselinePopulation: existingCountry.baselinePopulation,
              baselineGdpPerCapita: existingCountry.baselineGdpPerCapita,
              currentPopulation: population,
              currentGdpPerCapita: gdpPerCapita,
              currentTotalGdp: population * gdpPerCapita,
              economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
              populationTier: getPopulationTierFromPopulation(population),
              nominalGDP,
              totalWorkforce: laborEmployment?.totalWorkforce || Math.round(population * 0.65),
              lastCalculated: new Date(IxTime.getCurrentIxTime()),
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
        globalCache.delete(`user_profile:${userId}`);

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
