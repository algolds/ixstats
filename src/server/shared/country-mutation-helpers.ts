/**
 * Shared transaction helpers for country create and update mutations.
 * Resides in src/server/shared so country routers stay lightweight and decoupled.
 */

import type { Prisma } from "@prisma/client";
import { checkComponentSynergy } from "~/lib/government/synergy";

type TxClient = Prisma.TransactionClient;

/**
 * Upsert or create National Identity record.
 */
export async function syncNationalIdentity(
  tx: TxClient,
  countryId: string,
  countryName: string,
  nationalIdentity: any
): Promise<void> {
  if (!nationalIdentity || Object.keys(nationalIdentity).length === 0) return;

  const data = {
    countryName: nationalIdentity.countryName || countryName,
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
  };

  await tx.nationalIdentity.upsert({
    where: { countryId },
    update: data,
    create: { countryId, ...data },
  });
}

/**
 * Upsert or create Demographics record.
 */
export async function syncDemographics(
  tx: TxClient,
  countryId: string,
  demographics: any
): Promise<void> {
  if (!demographics || Object.keys(demographics).length === 0) return;

  const data = {
    ageDistribution: JSON.stringify(demographics.ageDistribution || []),
    educationLevels: JSON.stringify(demographics.educationLevels || []),
    regions: demographics.regions ? JSON.stringify(demographics.regions) : undefined,
    birthRate: demographics.birthRate,
    deathRate: demographics.deathRate,
    migrationRate: demographics.migrationRate,
    dependencyRatio: demographics.dependencyRatio,
    medianAge: demographics.medianAge,
    populationGrowthProjection: demographics.populationGrowthRate,
  };

  await tx.demographics.upsert({
    where: { countryId },
    update: data,
    create: { countryId, ...data },
  });
}

/**
 * Upsert FiscalSystem, IncomeDistribution, and GovernmentBudget records.
 */
export async function syncIncomeAndSpending(
  tx: TxClient,
  countryId: string,
  incomeWealth: any,
  governmentSpending: any,
  fiscalSystem: any
): Promise<void> {
  if (Array.isArray(incomeWealth?.economicClasses) && incomeWealth.economicClasses.length > 0) {
    const economicClassesJson = JSON.stringify(incomeWealth.economicClasses);
    await tx.incomeDistribution.upsert({
      where: { countryId },
      update: { economicClasses: economicClassesJson },
      create: { countryId, economicClasses: economicClassesJson },
    });
  }

  if (
    Array.isArray(governmentSpending?.spendingCategories) &&
    governmentSpending.spendingCategories.length > 0
  ) {
    const spendingCategoriesJson = JSON.stringify(governmentSpending.spendingCategories);
    await tx.governmentBudget.upsert({
      where: { countryId },
      update: { spendingCategories: spendingCategoriesJson },
      create: { countryId, spendingCategories: spendingCategoriesJson },
    });
  }

  if (fiscalSystem && Object.keys(fiscalSystem).length > 0) {
    const fiscalData = {
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
    };

    await tx.fiscalSystem.upsert({
      where: { countryId },
      update: fiscalData,
      create: { countryId, ...fiscalData },
    });
  }
}

/**
 * Upsert complete TaxSystem and related TaxCategories, TaxBrackets, TaxDeductions, TaxExemptions.
 */
export async function syncTaxSystem(
  tx: TxClient,
  countryId: string,
  taxSystemData: any
): Promise<void> {
  if (!taxSystemData) return;

  const existingTaxSys = await tx.taxSystem.findUnique({
    where: { countryId },
  });

  if (existingTaxSys) {
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
    where: { countryId },
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
      countryId,
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
    for (let categoryIndex = 0; categoryIndex < taxSystemData.categories.length; categoryIndex++) {
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
          qualifications: ex.qualifications != null ? JSON.stringify(ex.qualifications) : null,
          isActive: ex.isActive ?? true,
          startDate: ex.startDate,
          endDate: ex.endDate,
        },
      });
    }
  }
}

/**
 * Upsert GovernmentStructure, Departments, BudgetAllocations, and RevenueSources.
 */
export async function syncGovernmentStructure(
  tx: TxClient,
  countryId: string,
  countryName: string,
  govInput: any
): Promise<void> {
  if (!govInput) return;

  const existingGovStruct = await tx.governmentStructure.findUnique({
    where: { countryId },
  });

  if (existingGovStruct) {
    await tx.governmentDepartment.deleteMany({
      where: { governmentStructureId: existingGovStruct.id },
    });
  }

  const govStructure = await tx.governmentStructure.upsert({
    where: { countryId },
    update: {
      governmentName: govInput.governmentName || `Government of ${countryName}`,
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
      countryId,
      governmentName: govInput.governmentName || `Government of ${countryName}`,
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

/**
 * Recreate GovernmentComponents and calculate component synergies.
 */
export async function syncGovernmentComponents(
  tx: TxClient,
  countryId: string,
  componentsInput?: any[]
): Promise<void> {
  if (!componentsInput) return;

  await tx.governmentComponent.deleteMany({
    where: { countryId },
  });

  const componentRecords = [];
  for (const componentInput of componentsInput) {
    const component = await tx.governmentComponent.create({
      data: {
        countryId,
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
    where: { countryId },
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
            countryId,
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
    where: { countryId },
    data: { governmentEffectiveness },
  });
}

/**
 * Recreate EconomicComponents, EconomicProfile, and EconomicSectors.
 */
export async function syncEconomyBuilderState(
  tx: TxClient,
  countryId: string,
  economyState: any
): Promise<void> {
  if (!economyState) return;

  await tx.economicComponent.deleteMany({
    where: { countryId },
  });

  if (economyState.selectedAtomicComponents && economyState.selectedAtomicComponents.length > 0) {
    for (const componentType of economyState.selectedAtomicComponents) {
      await tx.economicComponent.create({
        data: {
          countryId,
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

  const gdpGrowthVolatility =
    sectors.length > 0
      ? sectors.reduce((sum: number, s: any) => sum + Math.abs((s.growthRate ?? 2.5) - 2.5), 0) /
        sectors.length
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
      ? sectors.reduce((sum: number, s: any) => sum + (s.innovation ?? 50), 0) / sectors.length
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
          (sum: number, s: any) => sum + ((s.exports ?? 0) * (s.gdpContribution ?? 0)) / 100,
          0
        )
      : undefined;

  const importsGDPPercent =
    sectors.length > 0
      ? sectors.reduce(
          (sum: number, s: any) => sum + ((s.imports ?? 0) * (s.gdpContribution ?? 0)) / 100,
          0
        )
      : undefined;

  const tradeBalance =
    economyState.structure?.totalGDP !== undefined && sectors.length > 0
      ? economyState.structure.totalGDP *
        sectors.reduce(
          (sum: number, s: any) =>
            sum + (((s.exports ?? 0) - (s.imports ?? 0)) * (s.gdpContribution ?? 0)) / 10000,
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
    where: { countryId },
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
      countryId,
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
      laborConfig.livingWageHourly !== undefined ? laborConfig.livingWageHourly * 2000 : undefined;
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
      where: { countryId },
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
        countryId,
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
      where: { countryId },
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
        countryId,
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
