/**
 * Shared transaction helpers for country create and update mutations.
 * Resides in src/server/shared so country routers stay lightweight and decoupled.
 */

import type { GovernmentComponent, Prisma } from "@prisma/client";
import { checkComponentSynergy } from "~/lib/government/synergy";
import { currentBudgetYear } from "~/lib/government/budget-year";

type TxClient = Prisma.TransactionClient;

/** Copies the listed keys from `source`; absent keys become `undefined`, which Prisma ignores. */
function pick<K extends string>(source: any, keys: readonly K[]): Record<K, any> {
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Record<K, any>;
}

/** Upsert args for the one-per-country tables: the same data on update and create. */
function upsertByCountry<T extends object, C extends object = object>(
  countryId: string,
  data: T,
  createOverrides?: C
) {
  return {
    where: { countryId },
    update: data,
    create: { countryId, ...data, ...createOverrides },
  };
}

const hasKeys = (value: unknown) => !!value && Object.keys(value).length > 0;
const jsonOrUndefined = (value: unknown) => (value ? JSON.stringify(value) : undefined);
const jsonOrNull = (value: unknown) => (value != null ? JSON.stringify(value) : null);
const nonEmptyArray = (value: unknown): value is any[] => Array.isArray(value) && value.length > 0;

const NATIONAL_IDENTITY_FIELDS = [
  "officialName",
  "governmentType",
  "motto",
  "mottoNative",
  "capitalCity",
  "largestCity",
  "demonym",
  "currency",
  "currencySymbol",
  "officialLanguages",
  "nationalLanguage",
  "nationalAnthem",
  "nationalReligion",
  "nationalDay",
  "callingCode",
  "internetTLD",
  "drivingSide",
  "timeZone",
  "isoCode",
  "coordinatesLatitude",
  "coordinatesLongitude",
  "emergencyNumber",
  "postalCodeFormat",
  "nationalSport",
  "nationalBird",
  "nationalFish",
  "founders",
  "nationalFlower",
  "nationalDish",
  "nationalFruit",
  "nationalDrink",
  "nationalInstrument",
  "nationalSymbol",
  "nationalAnimalImage",
  "nationalBirdImage",
  "nationalFishImage",
  "foundersImage",
  "nationalFlowerImage",
  "nationalDishImage",
  "nationalFruitImage",
  "nationalDrinkImage",
  "nationalInstrumentImage",
  "nationalSymbolImage",
  "weekStartDay",
] as const;

/**
 * Upsert or create National Identity record.
 */
export async function syncNationalIdentity(
  tx: TxClient,
  countryId: string,
  countryName: string,
  nationalIdentity: any
): Promise<void> {
  if (!hasKeys(nationalIdentity)) return;

  const data = {
    ...pick(nationalIdentity, NATIONAL_IDENTITY_FIELDS),
    countryName: nationalIdentity.countryName || countryName,
  };
  await tx.nationalIdentity.upsert(upsertByCountry(countryId, data));
}

/**
 * Upsert or create Demographics record.
 */
export async function syncDemographics(
  tx: TxClient,
  countryId: string,
  demographics: any
): Promise<void> {
  if (!hasKeys(demographics)) return;

  const data = {
    ...pick(demographics, [
      "birthRate",
      "deathRate",
      "migrationRate",
      "dependencyRatio",
      "medianAge",
    ]),
    ageDistribution: JSON.stringify(demographics.ageDistribution || []),
    educationLevels: JSON.stringify(demographics.educationLevels || []),
    regions: jsonOrUndefined(demographics.regions),
    populationGrowthProjection: demographics.populationGrowthRate,
  };
  await tx.demographics.upsert(upsertByCountry(countryId, data));
}

const FISCAL_SYSTEM_FIELDS = [
  "personalIncomeTaxRates",
  "corporateTaxRates",
  "salesTaxRate",
  "propertyTaxRate",
  "payrollTaxRate",
  "exciseTaxRates",
  "wealthTaxRate",
  "spendingByCategory",
  "fiscalBalanceGDPPercent",
  "primaryBalanceGDPPercent",
  "taxEfficiency",
] as const;

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
  if (nonEmptyArray(incomeWealth?.economicClasses)) {
    const data = { economicClasses: JSON.stringify(incomeWealth.economicClasses) };
    await tx.incomeDistribution.upsert(upsertByCountry(countryId, data));
  }

  if (nonEmptyArray(governmentSpending?.spendingCategories)) {
    const data = { spendingCategories: JSON.stringify(governmentSpending.spendingCategories) };
    await tx.governmentBudget.upsert(upsertByCountry(countryId, data));
  }

  if (hasKeys(fiscalSystem)) {
    await tx.fiscalSystem.upsert(
      upsertByCountry(countryId, pick(fiscalSystem, FISCAL_SYSTEM_FIELDS))
    );
  }
}

const TAX_SYSTEM_FIELDS = [
  "taxAuthority",
  "taxCode",
  "baseRate",
  "flatTaxRate",
  "alternativeMinRate",
  "taxHolidays",
  "complianceRate",
  "collectionEfficiency",
  "lastReform",
] as const;
const TAX_CATEGORY_FIELDS = [
  "categoryName",
  "categoryType",
  "description",
  "baseRate",
  "minimumAmount",
  "maximumAmount",
  "exemptionAmount",
  "standardDeduction",
  "color",
  "icon",
] as const;
const TAX_BRACKET_FIELDS = ["bracketName", "minIncome", "maxIncome", "rate", "flatAmount"] as const;
const TAX_DEDUCTION_FIELDS = [
  "deductionName",
  "deductionType",
  "description",
  "maximumAmount",
  "percentage",
] as const;
const TAX_EXEMPTION_FIELDS = [
  "exemptionName",
  "exemptionType",
  "description",
  "exemptionAmount",
  "exemptionRate",
  "startDate",
  "endDate",
] as const;

/**
 * Upsert complete TaxSystem and related TaxCategories, TaxBrackets, TaxDeductions, TaxExemptions.
 */
export async function syncTaxSystem(
  tx: TxClient,
  countryId: string,
  taxSystemData: any
): Promise<void> {
  if (!taxSystemData) return;

  const existingTaxSys = await tx.taxSystem.findUnique({ where: { countryId } });
  if (existingTaxSys) {
    const where = { taxSystemId: existingTaxSys.id };
    await tx.taxExemption.deleteMany({ where });
    await tx.taxBracket.deleteMany({ where });
    await tx.taxCategory.deleteMany({ where });
  }

  const taxSystem = await tx.taxSystem.upsert(
    upsertByCountry(countryId, {
      ...pick(taxSystemData, TAX_SYSTEM_FIELDS),
      taxSystemName: taxSystemData.taxSystemName || "National Tax System",
      fiscalYear: taxSystemData.fiscalYear || "calendar",
      progressiveTax: taxSystemData.progressiveTax ?? true,
      alternativeMinTax: taxSystemData.alternativeMinTax ?? false,
    })
  );

  const categories: any[] = taxSystemData.categories ?? [];
  for (const [categoryIndex, categoryData] of categories.entries()) {
    const taxCategory = await tx.taxCategory.create({
      data: {
        ...pick(categoryData, TAX_CATEGORY_FIELDS),
        taxSystemId: taxSystem.id,
        isActive: categoryData.isActive ?? true,
        calculationMethod: categoryData.calculationMethod || "percentage",
        deductionAllowed: categoryData.deductionAllowed ?? true,
        priority: categoryData.priority || 50,
      },
    });

    await tx.taxBracket.createMany({
      data: (categoryData.brackets ?? []).map((bracket: any) => ({
        ...pick(bracket, TAX_BRACKET_FIELDS),
        taxSystemId: taxSystem.id,
        categoryId: taxCategory.id,
        marginalRate: bracket.marginalRate ?? true,
        isActive: bracket.isActive ?? true,
        priority: bracket.priority || 50,
      })),
    });

    const categoryDeductions = taxSystemData.deductions?.[String(categoryIndex)];
    if (Array.isArray(categoryDeductions)) {
      await tx.taxDeduction.createMany({
        data: categoryDeductions.map((ded) => ({
          ...pick(ded, TAX_DEDUCTION_FIELDS),
          categoryId: taxCategory.id,
          qualifications: jsonOrNull(ded.qualifications),
          isActive: ded.isActive ?? true,
          priority: ded.priority ?? 50,
        })),
      });
    }
  }

  if (Array.isArray(taxSystemData.exemptions)) {
    await tx.taxExemption.createMany({
      data: taxSystemData.exemptions.map((ex: any) => ({
        ...pick(ex, TAX_EXEMPTION_FIELDS),
        taxSystemId: taxSystem.id,
        qualifications: jsonOrNull(ex.qualifications),
        isActive: ex.isActive ?? true,
      })),
    });
  }
}

const GOV_DEPARTMENT_FIELDS = [
  "name",
  "shortName",
  "category",
  "description",
  "minister",
  "headquarters",
  "established",
  "employeeCount",
  "icon",
] as const;
const REVENUE_SOURCE_FIELDS = [
  "name",
  "category",
  "description",
  "rate",
  "collectionMethod",
  "administeredBy",
] as const;

/** Recreates the departments (two passes so parent links resolve), then their budget allocations. */
async function syncDepartments(tx: TxClient, governmentStructureId: string, govInput: any) {
  const departments: any[] = govInput.departments;
  const deptKey = (dept: any) => dept.id || dept.name;
  const deptIdMap = new Map<string, string>();
  for (const deptInput of departments) {
    const department = await tx.governmentDepartment.create({
      data: {
        ...pick(deptInput, GOV_DEPARTMENT_FIELDS),
        governmentStructureId,
        ministerTitle: deptInput.ministerTitle || "Minister",
        color: deptInput.color || "#6366f1",
        priority: deptInput.priority || 50,
        isActive: deptInput.isActive ?? true,
        organizationalLevel: deptInput.organizationalLevel || "Ministry",
        functions: jsonOrUndefined(deptInput.functions) ?? null,
        kpis: jsonOrUndefined(deptInput.kpis) ?? null,
      },
    });
    deptIdMap.set(deptKey(deptInput), department.id);
  }

  for (const deptInput of departments) {
    const actualDeptId = deptIdMap.get(deptKey(deptInput));
    const actualParentId = deptIdMap.get(deptInput.parentDepartmentId);
    if (actualDeptId && actualParentId) {
      await tx.governmentDepartment.update({
        where: { id: actualDeptId },
        data: { parentDepartmentId: actualParentId },
      });
    }
  }

  if (Array.isArray(govInput.budgetAllocations)) {
    const seenAlloc = new Set<string>();
    for (const alloc of govInput.budgetAllocations) {
      const realDeptId = deptIdMap.get(alloc.departmentId);
      if (!realDeptId) continue;
      const budgetYear = alloc.budgetYear ?? currentBudgetYear();
      const dedupeKey = `${realDeptId}:${budgetYear}`;
      if (seenAlloc.has(dedupeKey)) continue;
      seenAlloc.add(dedupeKey);
      await tx.budgetAllocation.create({
        data: {
          governmentStructureId,
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

  const existingGovStruct = await tx.governmentStructure.findUnique({ where: { countryId } });
  if (existingGovStruct) {
    await tx.governmentDepartment.deleteMany({
      where: { governmentStructureId: existingGovStruct.id },
    });
  }

  const govStructure = await tx.governmentStructure.upsert(
    upsertByCountry(countryId, {
      ...pick(govInput, [
        "headOfState",
        "headOfGovernment",
        "legislatureName",
        "executiveName",
        "judicialName",
      ]),
      governmentName: govInput.governmentName || `Government of ${countryName}`,
      governmentType: govInput.governmentType || "Federal Republic",
      totalBudget: govInput.totalBudget || 0,
      fiscalYear: govInput.fiscalYear || "Calendar Year",
      budgetCurrency: govInput.budgetCurrency || "USD",
    })
  );
  const governmentStructureId = govStructure.id;

  if (nonEmptyArray(govInput.departments))
    await syncDepartments(tx, governmentStructureId, govInput);

  if (Array.isArray(govInput.revenueSources)) {
    await tx.revenueSource.deleteMany({ where: { governmentStructureId } });
    await tx.revenueSource.createMany({
      data: govInput.revenueSources.map((rev: any) => ({
        ...pick(rev, REVENUE_SOURCE_FIELDS),
        governmentStructureId,
        revenueAmount: rev.revenueAmount ?? 0,
        revenuePercent: rev.revenuePercent ?? 0,
        isActive: rev.isActive ?? true,
      })),
    });
  }
}

/** Score adjustments per synergy type: additive bonus, multiplicative bonus, conflict penalty. */
function synergyScoreDelta(type: string, multiplier: number): number {
  if (type === "CONFLICTING") return -15;
  if (type === "ADDITIVE") return 10;
  return type === "MULTIPLICATIVE" ? multiplier * 10 : 0;
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

  await tx.governmentComponent.deleteMany({ where: { countryId } });

  const componentRecords: GovernmentComponent[] = [];
  for (const componentInput of componentsInput) {
    componentRecords.push(
      await tx.governmentComponent.create({
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
      })
    );
  }

  await tx.componentSynergy.deleteMany({ where: { countryId } });

  const synergies = componentRecords.flatMap((comp1, i) =>
    componentRecords.slice(i + 1).flatMap((comp2) => {
      const synergy = checkComponentSynergy(comp1.componentType, comp2.componentType);
      return synergy
        ? [
            {
              countryId,
              primaryComponentId: comp1.id,
              secondaryComponentId: comp2.id,
              synergyType: synergy.type,
              effectMultiplier: synergy.multiplier,
              description: synergy.description,
            },
          ]
        : [];
    })
  );
  await tx.componentSynergy.createMany({ data: synergies });

  const synergyDelta = synergies.reduce(
    (sum, s) => sum + synergyScoreDelta(s.synergyType, s.effectMultiplier),
    0
  );
  const baseEffectiveness =
    componentRecords.reduce((sum, comp) => sum + comp.effectivenessScore, 0) /
    (componentRecords.length || 1);

  await tx.governmentStructure.update({
    where: { countryId },
    data: { governmentEffectiveness: Math.max(0, Math.min(100, baseEffectiveness + synergyDelta)) },
  });
}

const TIER_COMPLEXITY: Record<string, number> = { Advanced: 85, Developed: 70, Emerging: 55 };

/** Sector-derived economic profile columns; all undefined when no sectors were supplied. */
function sectorProfile(sectors: any[], structure: any) {
  if (sectors.length === 0) return {};
  const total = (value: (s: any) => number) => sectors.reduce((sum, s) => sum + value(s), 0);
  const mean = (value: (s: any) => number) => total(value) / sectors.length;
  const contribution = (s: any) => s.gdpContribution ?? 0;

  return {
    gdpGrowthVolatility: mean((s) => Math.abs((s.growthRate ?? 2.5) - 2.5)),
    innovationIndex: mean((s) => s.innovation ?? 50),
    competitivenessRank: Math.round(100 - mean((s) => s.competitiveness ?? 50)),
    exportsGDPPercent: total((s) => ((s.exports ?? 0) * contribution(s)) / 100),
    importsGDPPercent: total((s) => ((s.imports ?? 0) * contribution(s)) / 100),
    tradeBalance:
      structure?.totalGDP !== undefined
        ? structure.totalGDP *
          total((s) => (((s.exports ?? 0) - (s.imports ?? 0)) * contribution(s)) / 10000)
        : undefined,
  };
}

async function syncEconomicProfile(
  tx: TxClient,
  countryId: string,
  economyState: any,
  sectors: any[]
) {
  const sectorBreakdown =
    sectors.length > 0
      ? JSON.stringify(
          sectors.map((s) => ({
            name: s.name,
            gdp: s.gdpContribution,
            employment: s.employmentShare,
            productivity: s.productivity,
            growthRate: s.growthRate,
          }))
        )
      : jsonOrUndefined(economyState.structure);

  const profileData = {
    sectorBreakdown,
    economicComplexity: TIER_COMPLEXITY[economyState.structure?.economicTier] ?? 40,
    ...sectorProfile(sectors, economyState.structure),
  };
  await tx.economicProfile.upsert(upsertByCountry(countryId, profileData));
}

async function syncLaborMarket(tx: TxClient, countryId: string, laborConfig: any, sectors: any[]) {
  const livingWage = laborConfig.livingWageHourly;
  const sectorJson = (row: (s: any) => object) => JSON.stringify(sectors.map(row));

  const employmentBySector =
    sectors.length > 0
      ? sectorJson((s) => ({
          sector: s.name,
          employment: s.employmentShare,
          productivity: s.productivity,
        }))
      : undefined;
  const wageBySector =
    sectors.length > 0 && livingWage !== undefined
      ? sectorJson((s) => ({
          sector: s.name,
          avgWage: livingWage * ((s.productivity ?? 100) / 100),
        }))
      : undefined;

  const laborData = {
    ...pick(laborConfig, ["youthUnemploymentRate", "femaleParticipationRate"]),
    informalEmploymentRate: laborConfig.employmentType?.informal,
    medianWage: livingWage !== undefined ? livingWage * 2000 : undefined,
    employmentBySector,
    wageBySector,
  };
  await tx.laborMarket.upsert(
    upsertByCountry(countryId, laborData, {
      employmentBySector: employmentBySector ?? "[]",
      wageBySector: wageBySector ?? "[]",
    })
  );
}

async function syncEconomyDemographics(tx: TxClient, countryId: string, demoConfig: any) {
  const ageDistribution = jsonOrUndefined(demoConfig.ageDistribution);
  const regions = jsonOrUndefined(demoConfig.regions);
  const educationLevels = jsonOrUndefined(demoConfig.educationLevels);

  const demographicsData = {
    ...pick(demoConfig, ["birthRate", "deathRate", "medianAge"]),
    ageDistribution,
    regions,
    educationLevels,
    migrationRate: demoConfig.netMigrationRate,
    dependencyRatio: demoConfig.totalDependencyRatio,
    populationGrowthProjection: demoConfig.populationGrowthRate,
  };
  await tx.demographics.upsert(
    upsertByCountry(countryId, demographicsData, {
      ageDistribution: ageDistribution ?? "{}",
      regions: regions ?? "[]",
      educationLevels: educationLevels ?? "{}",
    })
  );
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

  await tx.economicComponent.deleteMany({ where: { countryId } });

  if (nonEmptyArray(economyState.selectedAtomicComponents)) {
    await tx.economicComponent.createMany({
      data: economyState.selectedAtomicComponents.map((componentType: any) => ({
        countryId,
        componentType,
        effectivenessScore: 50,
        implementationDate: new Date(),
        isActive: true,
        notes: `Updated during country edit via Economy Builder`,
      })),
    });
  }

  const sectors = Array.isArray(economyState.sectors) ? economyState.sectors : [];
  await syncEconomicProfile(tx, countryId, economyState, sectors);
  if (economyState.laborMarket)
    await syncLaborMarket(tx, countryId, economyState.laborMarket, sectors);
  if (economyState.demographics)
    await syncEconomyDemographics(tx, countryId, economyState.demographics);
}
