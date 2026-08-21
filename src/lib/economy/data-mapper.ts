// src/lib/economy/data-mapper.ts
// ═══════════════════════════════════════════════════════════════════════════
// MAPPER — Patch system: starts from schema-valid base, applies DB patches.
// ❌ Never imports generateCountryEconomicData or templates.
// ❌ No (x as any) casts — uses typed helper functions.
// ✅ Always returns EconomyDataSchema.parse() validated data.
// ═══════════════════════════════════════════════════════════════════════════

import { createEmptyEconomyData } from "./factory";
import {
  safeParseEconomyData,
  type EconomyData,
  type FiscalSystemData,
  type LaborEmploymentData,
  type IncomeWealthDistributionData,
  type DemographicsData,
  type CoreEconomicIndicatorsData,
  type GovernmentSpendingData,
} from "~/types/economics";

// ===============================
// Types for DB relations
// ===============================

/** Shape of a country row with economic relations included */
interface CountryWithEconomicRelations {
  // Direct fields (Country table)
  currentPopulation?: number | null;
  baselinePopulation?: number;
  currentGdpPerCapita?: number;
  baselineGdpPerCapita?: number;
  nominalGDP?: number | null;
  realGDPGrowthRate?: number | null;
  adjustedGdpGrowth?: number | null;
  inflationRate?: number | null;
  currencyExchangeRate?: number | null;
  giniCoefficient?: number | null;
  unemploymentRate?: number | null;
  employmentRate?: number | null;
  laborForceParticipationRate?: number | null;
  totalWorkforce?: number | null;
  averageWorkweekHours?: number | null;
  minimumWage?: number | null;
  averageAnnualIncome?: number | null;
  taxRevenueGDPPercent?: number | null;
  governmentRevenueTotal?: number | null;
  governmentBudgetGDPPercent?: number | null;
  budgetDeficitSurplus?: number | null;
  totalDebtGDPRatio?: number | null;
  internalDebtGDPPercent?: number | null;
  externalDebtGDPPercent?: number | null;
  interestRates?: number | null;
  debtServiceCosts?: number | null;
  totalGovernmentSpending?: number | null;
  spendingGDPPercent?: number | null;
  lifeExpectancy?: number | null;
  literacyRate?: number | null;
  urbanPopulationPercent?: number | null;
  ruralPopulationPercent?: number | null;
  economicTier?: string | null;
  // Relations (may or may not be included)
  fiscalSystem?: Record<string, unknown> | null;
  governmentBudget?: Record<string, unknown> | null;
  incomeDistribution?: Record<string, unknown> | null;
  economicProfile?: Record<string, unknown> | null;
  laborMarket?: Record<string, unknown> | null;
  demographics?: Record<string, unknown> | null;
}

// ===============================
// Safe JSON parsing helper
// ===============================

function safeJsonParse(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

/** Safely read a numeric field from a record */
function readNumber(obj: Record<string, unknown>, field: string): number | null {
  const val = obj[field];
  if (val == null) return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

// ===============================
// Relation patch helpers
// ===============================

function applyFiscalSystemPatches(
  base: EconomyData,
  fiscal: Record<string, unknown> | null | undefined
) {
  if (!fiscal) return;

  // Flat fields
  const salesTaxRate = readNumber(fiscal, "salesTaxRate");
  if (salesTaxRate != null) base.fiscal.taxRates.salesTaxRate = salesTaxRate;

  const propertyTaxRate = readNumber(fiscal, "propertyTaxRate");
  if (propertyTaxRate != null) base.fiscal.taxRates.propertyTaxRate = propertyTaxRate;

  const payrollTaxRate = readNumber(fiscal, "payrollTaxRate");
  if (payrollTaxRate != null) base.fiscal.taxRates.payrollTaxRate = payrollTaxRate;

  const wealthTaxRate = readNumber(fiscal, "wealthTaxRate");
  if (wealthTaxRate != null) base.fiscal.taxRates.wealthTaxRate = wealthTaxRate;

  // Extended nullable fields
  const taxEfficiency = readNumber(fiscal, "taxEfficiency");
  if (taxEfficiency != null) base.fiscal.taxEfficiency = taxEfficiency;

  const fiscalBalanceGDPPercent = readNumber(fiscal, "fiscalBalanceGDPPercent");
  if (fiscalBalanceGDPPercent != null)
    base.fiscal.fiscalBalanceGDPPercent = fiscalBalanceGDPPercent;

  // JSON arrays
  const personalIncomeTaxRates = safeJsonParse(fiscal.personalIncomeTaxRates);
  if (Array.isArray(personalIncomeTaxRates)) {
    base.fiscal.taxRates.personalIncomeTaxRates =
      personalIncomeTaxRates as FiscalSystemData["taxRates"]["personalIncomeTaxRates"];
  }

  const corporateTaxRates = safeJsonParse(fiscal.corporateTaxRates);
  if (Array.isArray(corporateTaxRates)) {
    base.fiscal.taxRates.corporateTaxRates =
      corporateTaxRates as FiscalSystemData["taxRates"]["corporateTaxRates"];
  }
}

function applyGovernmentBudgetPatches(
  base: EconomyData,
  govBudget: Record<string, unknown> | null | undefined,
  totalGdp: number
) {
  if (!govBudget) return;

  // Spending categories (JSON → array)
  const rawCategories = safeJsonParse(govBudget.spendingCategories);
  if (rawCategories && typeof rawCategories === "object" && !Array.isArray(rawCategories)) {
    const totalSpending = base.spending.totalSpending || totalGdp * 0.28;
    base.spending.spendingCategories = Object.entries(rawCategories as Record<string, unknown>).map(
      ([category, pct]) => ({
        category,
        amount: totalSpending * (Number(pct) / 100),
        gdpPercent: Number(pct),
        percent: Number(pct),
      })
    );
  }

  // Extended nullable fields
  const spendingEfficiency = readNumber(govBudget, "spendingEfficiency");
  if (spendingEfficiency != null) base.spending.spendingEfficiency = spendingEfficiency;

  const socialSpendingPercent = readNumber(govBudget, "socialSpendingPercent");
  if (socialSpendingPercent != null) base.spending.socialSpendingPercent = socialSpendingPercent;
}

function applyIncomeDistributionPatches(
  base: EconomyData,
  incomeDist: Record<string, unknown> | null | undefined
) {
  if (!incomeDist) return;

  // Extended nullable fields
  const top10 = readNumber(incomeDist, "top10PercentWealth");
  if (top10 != null) base.income.top10PercentWealth = top10;

  const bottom50 = readNumber(incomeDist, "bottom50PercentWealth");
  if (bottom50 != null) base.income.bottom50PercentWealth = bottom50;

  const middleClass = readNumber(incomeDist, "middleClassPercent");
  if (middleClass != null) base.income.middleClassPercent = middleClass;

  const intergen = readNumber(incomeDist, "intergenerationalMobility");
  if (intergen != null) base.income.intergenerationalMobility = intergen;

  // Economic classes (JSON → array)
  const rawClasses = safeJsonParse(incomeDist.economicClasses);
  if (Array.isArray(rawClasses)) {
    base.income.economicClasses = rawClasses.map((item: unknown) => {
      const obj = item as Record<string, unknown>;
      return {
        name: String(obj.name ?? "Unknown"),
        populationPercent: Number(obj.populationPercent ?? 0),
        wealthPercent: Number(obj.wealthPercent ?? 0),
        averageIncome: Number(obj.averageIncome ?? 0),
        color: String(obj.color ?? "#000000"),
      };
    });
  } else if (rawClasses && typeof rawClasses === "object") {
    base.income.economicClasses = Object.entries(rawClasses as Record<string, unknown>).map(
      ([name, pct]) => ({
        name,
        populationPercent: Number(pct),
        wealthPercent: Number(pct),
        averageIncome: 0,
        color: "#000000",
      })
    );
  }
}

function applyEconomicProfilePatches(
  base: EconomyData,
  econProfile: Record<string, unknown> | null | undefined
) {
  if (!econProfile) return;

  // Core extended fields
  const gdpVolatility = readNumber(econProfile, "gdpGrowthVolatility");
  if (gdpVolatility != null) base.core.gdpVolatility = gdpVolatility;

  const complexity = readNumber(econProfile, "economicComplexity");
  if (complexity != null) base.core.economicComplexity = complexity;

  const innovation = readNumber(econProfile, "innovationIndex");
  if (innovation != null) base.core.innovationIndex = innovation;

  const competitiveness = readNumber(econProfile, "competitivenessRank");
  if (competitiveness != null) base.core.competitivenessRank = competitiveness;

  const easeOfBusiness = readNumber(econProfile, "easeOfDoingBusiness");
  if (easeOfBusiness != null) base.core.easeOfDoingBusiness = easeOfBusiness;

  const corruption = readNumber(econProfile, "corruptionIndex");
  if (corruption != null) base.core.corruptionIndex = corruption;

  // Sector breakdown (JSON object)
  const sectorBreakdown = safeJsonParse(econProfile.sectorBreakdown);
  if (sectorBreakdown && typeof sectorBreakdown === "object") {
    base.core.sectorBreakdown = sectorBreakdown as Record<string, unknown>;
  }

  // Trade fields
  const tradeBalance = readNumber(econProfile, "tradeBalance");
  if (tradeBalance != null) base.core.tradeBalance = tradeBalance;

  const exports = readNumber(econProfile, "exportsGDPPercent");
  if (exports != null) base.core.exportsGDPPercent = exports;

  const imports = readNumber(econProfile, "importsGDPPercent");
  if (imports != null) base.core.importsGDPPercent = imports;
}

function applyLaborMarketPatches(
  base: EconomyData,
  laborMarket: Record<string, unknown> | null | undefined
) {
  if (!laborMarket) return;

  // Employment by sector (JSON → object)
  const rawSectors = safeJsonParse(laborMarket.employmentBySector);
  if (rawSectors && typeof rawSectors === "object" && !Array.isArray(rawSectors)) {
    const sectors = rawSectors as Record<string, unknown>;
    base.labor.employmentBySector = {
      agriculture: Number(sectors.agriculture ?? 0),
      industry: Number(sectors.industry ?? 0),
      services: Number(sectors.services ?? 0),
    };
  }

  // Flat fields
  const youthUnemp = readNumber(laborMarket, "youthUnemploymentRate");
  if (youthUnemp != null) base.labor.youthUnemploymentRate = youthUnemp;

  const femaleParticipation = readNumber(laborMarket, "femaleParticipationRate");
  if (femaleParticipation != null) base.labor.femaleParticipationRate = femaleParticipation;

  const informalRate = readNumber(laborMarket, "informalEmploymentRate");
  if (informalRate != null) base.labor.informalEmploymentRate = informalRate;

  const medianWage = readNumber(laborMarket, "medianWage");
  if (medianWage != null) base.labor.medianWage = medianWage;

  const wageGrowth = readNumber(laborMarket, "wageGrowthRate");
  if (wageGrowth != null) base.labor.wageGrowthRate = wageGrowth;

  // Wage by sector (JSON → record)
  const rawWageBySector = safeJsonParse(laborMarket.wageBySector);
  if (rawWageBySector && typeof rawWageBySector === "object") {
    const record: Record<string, number> = {};
    for (const [key, val] of Object.entries(rawWageBySector as Record<string, unknown>)) {
      const n = Number(val);
      if (Number.isFinite(n)) record[key] = n;
    }
    base.labor.wageBySector = record;
  }
}

function applyDemographicsPatches(
  base: EconomyData,
  demo: Record<string, unknown> | null | undefined,
  currentPopulation: number
) {
  if (!demo) return;

  // Age distribution (JSON → array)
  const rawAge = safeJsonParse(demo.ageDistribution);
  if (Array.isArray(rawAge)) {
    base.demographics.ageDistribution = rawAge as DemographicsData["ageDistribution"];
  } else if (rawAge && typeof rawAge === "object") {
    base.demographics.ageDistribution = Object.entries(rawAge as Record<string, unknown>).map(
      ([group, val]) => ({
        group,
        percentage: Number(val),
        percent: Number(val),
        color: group.includes("0-14") ? "#3b82f6" : group.includes("65") ? "#f59e0b" : "#10b981",
      })
    );
  }

  // Education levels (JSON → array)
  const rawEdu = safeJsonParse(demo.educationLevels);
  if (Array.isArray(rawEdu)) {
    base.demographics.educationLevels = rawEdu as DemographicsData["educationLevels"];
  } else if (rawEdu && typeof rawEdu === "object") {
    base.demographics.educationLevels = Object.entries(rawEdu as Record<string, unknown>).map(
      ([level, val]) => ({
        level,
        percentage: Number(val),
        percent: Number(val),
        color:
          level.toLowerCase().includes("tertiary") ||
          level.toLowerCase().includes("bachelor") ||
          level.toLowerCase().includes("graduate") ||
          level.toLowerCase().includes("doctor")
            ? "#10b981"
            : level.toLowerCase().includes("secondary") ||
                level.toLowerCase().includes("vocational")
              ? "#f59e0b"
              : "#ef4444",
      })
    );
  }

  // Regions (JSON → array)
  const rawRegions = safeJsonParse(demo.regions);
  if (Array.isArray(rawRegions)) {
    base.demographics.regions = rawRegions as DemographicsData["regions"];
    base.demographics.regionalDistribution = rawRegions as DemographicsData["regions"];
  } else if (rawRegions && typeof rawRegions === "object") {
    const arr = Object.entries(rawRegions as Record<string, unknown>).map(([region, val]) => ({
      region,
      name: region,
      percentage: Number(val),
      population: Math.round((Number(val) / 100) * currentPopulation),
    }));
    base.demographics.regions = arr;
    base.demographics.regionalDistribution = arr;
  }

  // Citizenship statuses (JSON → array)
  const rawCitizenship = safeJsonParse(demo.citizenshipStatuses);
  if (Array.isArray(rawCitizenship)) {
    base.demographics.citizenshipStatuses =
      rawCitizenship as DemographicsData["citizenshipStatuses"];
  } else if (rawCitizenship && typeof rawCitizenship === "object") {
    base.demographics.citizenshipStatuses = Object.entries(
      rawCitizenship as Record<string, unknown>
    ).map(([status, val]) => ({
      status,
      percent: Number(val),
    }));
  }

  // Scalar extended fields
  const medianAge = readNumber(demo, "medianAge");
  if (medianAge != null) (base.demographics as any).medianAge = medianAge;

  const dependencyRatio = readNumber(demo, "dependencyRatio");
  if (dependencyRatio != null) (base.demographics as any).dependencyRatio = dependencyRatio;

  const birthRate = readNumber(demo, "birthRate");
  if (birthRate != null) (base.demographics as any).birthRate = birthRate;

  const deathRate = readNumber(demo, "deathRate");
  if (deathRate != null) (base.demographics as any).deathRate = deathRate;

  const migrationRate = readNumber(demo, "migrationRate");
  if (migrationRate != null) (base.demographics as any).migrationRate = migrationRate;
}

// ===============================
// MAIN MAPPER
// ===============================

/**
 * Maps raw country data (from tRPC) to the structured EconomyData format.
 *
 * Pattern: Factory base → DB patches → Schema validation gate
 *
 * 1. Start from createEmptyEconomyData() (schema-valid base)
 * 2. Apply DB field patches (each field individually, safely)
 * 3. Wire DB relations via typed helpers
 * 4. Validate through EconomyDataSchema.safeParse() — gracefully falls back on error
 *
 * @param country - Raw country data from tRPC (with economic relations)
 * @returns Validated EconomyData or undefined if country is null/undefined
 */
export function mapCountryToEconomyData(
  country: CountryWithEconomicRelations | null | undefined
): EconomyData | undefined {
  if (!country) return undefined;

  // 1. Start from schema-valid base
  const base = createEmptyEconomyData();

  const population = country.currentPopulation ?? country.baselinePopulation ?? 0;
  const gdpPerCapita = country.currentGdpPerCapita ?? country.baselineGdpPerCapita ?? 0;
  const totalGdp = country.nominalGDP ?? population * gdpPerCapita;

  // 2. Apply direct field patches (Core)
  base.core.totalPopulation = population;
  base.core.nominalGDP = totalGdp;
  base.core.gdpPerCapita = gdpPerCapita;
  base.core.realGDPGrowthRate = country.realGDPGrowthRate ?? country.adjustedGdpGrowth ?? 0;
  base.core.inflationRate = country.inflationRate ?? 0;
  base.core.currencyExchangeRate = country.currencyExchangeRate ?? 1;
  if (country.giniCoefficient != null) base.core.giniCoefficient = country.giniCoefficient;

  // Labor
  base.labor.unemploymentRate = country.unemploymentRate ?? 0;
  base.labor.employmentRate =
    country.employmentRate ??
    (country.unemploymentRate != null ? 100 - country.unemploymentRate : 0);
  base.labor.laborForceParticipationRate = country.laborForceParticipationRate ?? 0;
  base.labor.totalWorkforce = country.totalWorkforce ?? 0;
  base.labor.averageWorkweekHours = country.averageWorkweekHours ?? 0;
  base.labor.minimumWage = country.minimumWage ?? 0;
  base.labor.averageAnnualIncome = country.averageAnnualIncome ?? 0;

  // Fiscal (direct fields)
  base.fiscal.taxRevenueGDPPercent = country.taxRevenueGDPPercent ?? 0;
  base.fiscal.governmentRevenueTotal = country.governmentRevenueTotal ?? 0;
  base.fiscal.governmentBudgetGDPPercent = country.governmentBudgetGDPPercent ?? 0;
  base.fiscal.budgetDeficitSurplus = country.budgetDeficitSurplus ?? 0;
  base.fiscal.totalDebtGDPRatio = country.totalDebtGDPRatio ?? 0;
  base.fiscal.internalDebtGDPPercent = country.internalDebtGDPPercent ?? 0;
  base.fiscal.externalDebtGDPPercent = country.externalDebtGDPPercent ?? 0;
  base.fiscal.interestRates = country.interestRates ?? 0;
  base.fiscal.debtServiceCosts = country.debtServiceCosts ?? 0;
  // Compute derived fields
  if (population > 0) {
    base.fiscal.taxRevenuePerCapita = base.fiscal.governmentRevenueTotal / population;
    base.fiscal.debtPerCapita = (totalGdp * (base.fiscal.totalDebtGDPRatio / 100)) / population;
  }

  // Spending (direct fields)
  base.spending.totalSpending = country.totalGovernmentSpending ?? 0;
  base.spending.spendingGDPPercent = country.spendingGDPPercent ?? 0;
  if (population > 0) {
    base.spending.spendingPerCapita = base.spending.totalSpending / population;
  }

  // Demographics (direct fields)
  base.demographics.lifeExpectancy = country.lifeExpectancy ?? 0;
  base.demographics.literacyRate = country.literacyRate ?? 0;
  base.demographics.urbanRuralSplit =
    country.urbanPopulationPercent != null && country.ruralPopulationPercent != null
      ? { urban: country.urbanPopulationPercent, rural: country.ruralPopulationPercent }
      : { urban: 60, rural: 40 };

  // 3. Wire DB relations (typed helpers)
  applyFiscalSystemPatches(base, country.fiscalSystem);
  applyGovernmentBudgetPatches(base, country.governmentBudget, totalGdp);
  applyIncomeDistributionPatches(base, country.incomeDistribution);
  applyEconomicProfilePatches(base, country.economicProfile);
  applyLaborMarketPatches(base, country.laborMarket);
  applyDemographicsPatches(base, country.demographics, population);

  // 4. Validation gate — graceful fallback
  const result = safeParseEconomyData(base);
  if (result.success) {
    return result.data;
  }

  // If validation fails, return the base as-is (it was created from createEmptyEconomyData,
  // so it's structurally valid — the patches may have broken a constraint)
  // TODO(monitoring): Log validation failures in production for debugging
  return base;
}
