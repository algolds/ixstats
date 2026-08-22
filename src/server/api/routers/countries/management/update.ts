import { z } from "zod";
import { protectedProcedure } from "~/server/api/trpc";
import { checkComponentSynergy } from "~/lib/government/synergy";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { invalidateCache } from "~/lib/cache";
import { clearLayerCache, invalidateCatalogCache } from "~/server/shared/layer-cache";



import {
  countryEconomicInputsSchema,
  countryGovernmentComponentSchema,
} from "~/server/shared/country-payload-builder";

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
                regions: JSON.stringify(demographics.regions || []),
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
                regions: JSON.stringify(demographics.regions || []),
                birthRate: demographics.birthRate,
                deathRate: demographics.deathRate,
                migrationRate: demographics.migrationRate,
                dependencyRatio: demographics.dependencyRatio,
                medianAge: demographics.medianAge,
                populationGrowthProjection: demographics.populationGrowthRate,
              },
            });
          }

          // IncomeDistribution.economicClasses — accepted in the payload but
          // previously never written (only the scalar Country.* fields were).
          if (
            Array.isArray(incomeWealth.economicClasses) &&
            incomeWealth.economicClasses.length > 0
          ) {
            const economicClassesJson = JSON.stringify(incomeWealth.economicClasses);
            await tx.incomeDistribution.upsert({
              where: { countryId: country.id },
              update: { economicClasses: economicClassesJson },
              create: { countryId: country.id, economicClasses: economicClassesJson },
            });
          }

          // GovernmentBudget.spendingCategories — accepted in the payload but
          // previously never written (only the scalar Country.* spending fields were).
          if (
            Array.isArray(governmentSpending.spendingCategories) &&
            governmentSpending.spendingCategories.length > 0
          ) {
            const spendingCategoriesJson = JSON.stringify(governmentSpending.spendingCategories);
            await tx.governmentBudget.upsert({
              where: { countryId: country.id },
              update: { spendingCategories: spendingCategoriesJson },
              create: { countryId: country.id, spendingCategories: spendingCategoriesJson },
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
              // Exemptions can be taxSystem-scoped (categoryId null) so they don't
              // all cascade from the category delete — clear them explicitly.
              // Deductions are category-scoped and cascade with taxCategory below.
              await tx.taxExemption.deleteMany({
                where: { taxSystemId: existingTaxSys.id },
              });
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
              for (
                let categoryIndex = 0;
                categoryIndex < taxSystemData.categories.length;
                categoryIndex++
              ) {
                const categoryData = taxSystemData.categories[categoryIndex];
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

                // TaxDeduction[] for this category — keyed by category index in the
                // builder (deductions: Record<categoryIndex, TaxDeductionInput[]>).
                // Previously dropped entirely on save.
                const categoryDeductions = taxSystemData.deductions?.[String(categoryIndex)];
                if (Array.isArray(categoryDeductions)) {
                  for (const ded of categoryDeductions) {
                    await tx.taxDeduction.create({
                      data: {
                        categoryId: taxCategory.id,
                        deductionName: ded.deductionName,
                        deductionType: ded.deductionType,
                        description: ded.description,
                        maximumAmount: ded.maximumAmount,
                        percentage: ded.percentage,
                        qualifications:
                          ded.qualifications != null ? JSON.stringify(ded.qualifications) : null,
                        isActive: ded.isActive ?? true,
                        priority: ded.priority ?? 50,
                      },
                    });
                  }
                }
              }
            }

            // TaxExemption[] — taxSystem-scoped flat array in the builder; previously
            // deleted on save but never recreated. categoryId left null (the builder's
            // category linkage is index-based, not a DB id).
            if (Array.isArray(taxSystemData.exemptions) && taxSystemData.exemptions.length > 0) {
              for (const ex of taxSystemData.exemptions) {
                await tx.taxExemption.create({
                  data: {
                    taxSystemId: taxSystem.id,
                    exemptionName: ex.exemptionName,
                    exemptionType: ex.exemptionType,
                    description: ex.description,
                    exemptionAmount: ex.exemptionAmount,
                    exemptionRate: ex.exemptionRate,
                    qualifications:
                      ex.qualifications != null ? JSON.stringify(ex.qualifications) : null,
                    isActive: ex.isActive ?? true,
                    startDate: ex.startDate,
                    endDate: ex.endDate,
                  },
                });
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

              // BudgetAllocation[] — resolve the builder's departmentId to the real
              // DB id via deptIdMap; these cascade-deleted with the departments above,
              // so just recreate. Skip unresolved or duplicate (departmentId, budgetYear).
              if (Array.isArray(govInput.budgetAllocations)) {
                const seenAlloc = new Set<string>();
                for (const alloc of govInput.budgetAllocations) {
                  const realDeptId = deptIdMap.get(alloc.departmentId);
                  if (!realDeptId) continue;
                  const budgetYear = alloc.budgetYear ?? new Date().getFullYear();
                  const dedupeKey = `${realDeptId}:${budgetYear}`;
                  if (seenAlloc.has(dedupeKey)) continue;
                  seenAlloc.add(dedupeKey);
                  await tx.budgetAllocation.create({
                    data: {
                      governmentStructureId: govStructure.id,
                      departmentId: realDeptId,
                      budgetYear,
                      allocatedAmount: alloc.allocatedAmount ?? 0,
                      allocatedPercent: alloc.allocatedPercent ?? 0,
                      notes: alloc.notes,
                    },
                  });
                }
              }
            }

            // RevenueSource[] — governmentStructure-scoped (no department FK), so they
            // do NOT cascade from the department delete. Only touch them when the client
            // actually sends the array (undefined = leave DB as-is, no wipe). Previously
            // never written at all.
            if (Array.isArray(govInput.revenueSources)) {
              await tx.revenueSource.deleteMany({
                where: { governmentStructureId: govStructure.id },
              });
              for (const rev of govInput.revenueSources) {
                await tx.revenueSource.create({
                  data: {
                    governmentStructureId: govStructure.id,
                    name: rev.name,
                    category: rev.category,
                    description: rev.description,
                    rate: rev.rate,
                    revenueAmount: rev.revenueAmount ?? 0,
                    revenuePercent: rev.revenuePercent ?? 0,
                    isActive: rev.isActive ?? true,
                    collectionMethod: rev.collectionMethod,
                    administeredBy: rev.administeredBy,
                  },
                });
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

            const sectors = Array.isArray(economyState.sectors) ? economyState.sectors : [];

            // Calculate EconomicProfile metrics
            const gdpGrowthVolatility =
              sectors.length > 0
                ? sectors.reduce(
                    (sum: number, s: any) => sum + Math.abs((s.growthRate ?? 2.5) - 2.5),
                    0
                  ) / sectors.length
                : undefined;

            const economicComplexity =
              economyState.structure?.economicTier === "Advanced"
                ? 85
                : economyState.structure?.economicTier === "Developed"
                  ? 70
                  : economyState.structure?.economicTier === "Emerging"
                    ? 55
                    : 40;

            const innovationIndex =
              sectors.length > 0
                ? sectors.reduce((sum: number, s: any) => sum + (s.innovation ?? 50), 0) /
                  sectors.length
                : undefined;

            const competitivenessRank =
              sectors.length > 0
                ? Math.round(
                    100 -
                      sectors.reduce((sum: number, s: any) => sum + (s.competitiveness ?? 50), 0) /
                        sectors.length
                  )
                : undefined;

            const exportsGDPPercent =
              sectors.length > 0
                ? sectors.reduce(
                    (sum: number, s: any) =>
                      sum + ((s.exports ?? 0) * (s.gdpContribution ?? 0)) / 100,
                    0
                  )
                : undefined;

            const importsGDPPercent =
              sectors.length > 0
                ? sectors.reduce(
                    (sum: number, s: any) =>
                      sum + ((s.imports ?? 0) * (s.gdpContribution ?? 0)) / 100,
                    0
                  )
                : undefined;

            const tradeBalance =
              economyState.structure?.totalGDP !== undefined && sectors.length > 0
                ? economyState.structure.totalGDP *
                  sectors.reduce(
                    (sum: number, s: any) =>
                      sum +
                      (((s.exports ?? 0) - (s.imports ?? 0)) * (s.gdpContribution ?? 0)) / 10000,
                    0
                  )
                : undefined;

            const sectorBreakdownJson =
              sectors.length > 0
                ? JSON.stringify(
                    sectors.map((s: any) => ({
                      name: s.name,
                      gdp: s.gdpContribution,
                      employment: s.employmentShare,
                      productivity: s.productivity,
                      growthRate: s.growthRate,
                    }))
                  )
                : economyState.structure
                  ? JSON.stringify(economyState.structure)
                  : undefined;

            await tx.economicProfile.upsert({
              where: { countryId: country.id },
              update: {
                sectorBreakdown: sectorBreakdownJson,
                gdpGrowthVolatility,
                economicComplexity,
                innovationIndex,
                competitivenessRank,
                exportsGDPPercent,
                importsGDPPercent,
                tradeBalance,
              },
              create: {
                countryId: country.id,
                sectorBreakdown: sectorBreakdownJson,
                gdpGrowthVolatility: gdpGrowthVolatility ?? 2.5,
                economicComplexity: economicComplexity ?? 50,
                innovationIndex: innovationIndex ?? 50,
                competitivenessRank: competitivenessRank ?? 50,
                exportsGDPPercent: exportsGDPPercent ?? 20,
                importsGDPPercent: importsGDPPercent ?? 22,
                tradeBalance: tradeBalance ?? -2,
              },
            });

            const laborConfig = economyState.laborMarket;
            if (laborConfig) {
              const youthUnemploymentRate = laborConfig.youthUnemploymentRate;
              const femaleParticipationRate = laborConfig.femaleParticipationRate;
              const medianWage =
                laborConfig.livingWageHourly !== undefined
                  ? laborConfig.livingWageHourly * 2000
                  : undefined;
              const wageGrowthRate = 2.5;

              const employmentBySector =
                sectors.length > 0
                  ? JSON.stringify(
                      sectors.map((s: any) => ({
                        sector: s.name,
                        employment: s.employmentShare,
                        productivity: s.productivity,
                      }))
                    )
                  : undefined;

              const wageBySector =
                sectors.length > 0 && laborConfig.livingWageHourly !== undefined
                  ? JSON.stringify(
                      sectors.map((s: any) => ({
                        sector: s.name,
                        avgWage: laborConfig.livingWageHourly * ((s.productivity ?? 100) / 100),
                      }))
                    )
                  : undefined;

              await tx.laborMarket.upsert({
                where: { countryId: country.id },
                update: {
                  youthUnemploymentRate,
                  femaleParticipationRate,
                  informalEmploymentRate: laborConfig.employmentType?.informal,
                  medianWage,
                  wageGrowthRate,
                  employmentBySector,
                  wageBySector,
                },
                create: {
                  countryId: country.id,
                  youthUnemploymentRate: youthUnemploymentRate ?? 6.0,
                  femaleParticipationRate: femaleParticipationRate ?? 50,
                  informalEmploymentRate: laborConfig.employmentType?.informal ?? 5.0,
                  medianWage: medianWage ?? 30000,
                  wageGrowthRate: wageGrowthRate ?? 2.5,
                  employmentBySector: employmentBySector ?? "[]",
                  wageBySector: wageBySector ?? "[]",
                },
              });
            }

            const demoConfig = economyState.demographics;
            if (demoConfig) {
              const ageDistribution = demoConfig.ageDistribution
                ? JSON.stringify(demoConfig.ageDistribution)
                : undefined;
              const regions = demoConfig.regions ? JSON.stringify(demoConfig.regions) : undefined;
              const educationLevels = demoConfig.educationLevels
                ? JSON.stringify(demoConfig.educationLevels)
                : undefined;
              const birthRate = demoConfig.birthRate;
              const deathRate = demoConfig.deathRate;
              const migrationRate = demoConfig.netMigrationRate;
              const dependencyRatio = demoConfig.totalDependencyRatio;
              const medianAge = demoConfig.medianAge;
              const populationGrowthProjection = demoConfig.populationGrowthRate;

              await tx.demographics.upsert({
                where: { countryId: country.id },
                update: {
                  ageDistribution,
                  regions,
                  educationLevels,
                  birthRate,
                  deathRate,
                  migrationRate,
                  dependencyRatio,
                  medianAge,
                  populationGrowthProjection,
                },
                create: {
                  countryId: country.id,
                  ageDistribution: ageDistribution ?? "{}",
                  regions: regions ?? "[]",
                  educationLevels: educationLevels ?? "{}",
                  birthRate: birthRate ?? 12.5,
                  deathRate: deathRate ?? 8.0,
                  migrationRate: migrationRate ?? 0,
                  dependencyRatio: dependencyRatio ?? 54,
                  medianAge: medianAge ?? 35,
                  populationGrowthProjection: populationGrowthProjection ?? 0.5,
                },
              });
            }
          }

          return country;
        });

        await invalidateCache(["countries."]);
        clearLayerCache("political");
        invalidateCatalogCache(`gov-components:${input.id}`);

        return result;

      } catch (error) {
        console.error("[updateCountry] Transaction failed:", error);
        throw new Error(
          `Failed to update country: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // Storyteller effects endpoints
};
