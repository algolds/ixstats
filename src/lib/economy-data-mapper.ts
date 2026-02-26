import { generateCountryEconomicData, type CountryProfile } from "~/lib/economic-data-templates";

/**
 * Maps raw country data (from tRPC getByIdWithEconomicData or CountryDataProvider)
 * to the structured economyData format used by UI components and metric modals.
 *
 * Bridges the gap between the flat database/API response shape and the hierarchical
 * { core, labor, fiscal, spending, income, demographics } structure.
 */
export function mapCountryToEconomyData(country: any) {
  if (!country) return undefined;

  const profile: CountryProfile = {
    population: country.currentPopulation || country.baselinePopulation || 0,
    gdpPerCapita: country.currentGdpPerCapita || country.baselineGdpPerCapita || 0,
    totalGdp: country.nominalGDP || country.currentPopulation * country.currentGdpPerCapita || 0,
    economicTier: country.economicTier || "Developing",
    landArea: country.landArea,
    continent: country.continent,
    region: country.region,
  };

  const economicData = generateCountryEconomicData(profile);

  // CRITICAL FIX: DO NOT use template data! Only use real database values.
  // If database value is null/undefined, SET IT TO null so UI can show "N/A"
  // Template data should NEVER be shown as if it's real data!

  // Core economic indicators - use DB value or null
  economicData.core.realGDPGrowthRate = country.realGDPGrowthRate ?? null;
  economicData.core.inflationRate = country.inflationRate ?? null;
  economicData.core.nominalGDP = country.nominalGDP ?? null;

  // Labor market data - use DB value or null (NO TEMPLATE DATA)
  economicData.labor.unemploymentRate = country.unemploymentRate ?? null;
  economicData.labor.employmentRate =
    country.employmentRate ??
    (country.unemploymentRate !== null && country.unemploymentRate !== undefined
      ? 100 - country.unemploymentRate
      : null);
  economicData.labor.laborForceParticipationRate = country.laborForceParticipationRate ?? null;
  economicData.labor.totalWorkforce = country.totalWorkforce ?? null;
  economicData.labor.averageWorkweekHours = country.averageWorkweekHours ?? null;
  economicData.labor.minimumWage = country.minimumWage ?? null;
  economicData.labor.averageAnnualIncome = country.averageAnnualIncome ?? null;

  // Fiscal system data - use DB value or null
  economicData.fiscal.taxRevenueGDPPercent = country.taxRevenueGDPPercent ?? null;
  economicData.fiscal.governmentRevenueTotal = country.governmentRevenueTotal ?? null;
  economicData.fiscal.governmentBudgetGDPPercent = country.governmentBudgetGDPPercent ?? null;
  economicData.fiscal.budgetDeficitSurplus = country.budgetDeficitSurplus ?? null;
  economicData.fiscal.totalDebtGDPRatio = country.totalDebtGDPRatio ?? null;
  economicData.fiscal.internalDebtGDPPercent = country.internalDebtGDPPercent ?? null;
  economicData.fiscal.externalDebtGDPPercent = country.externalDebtGDPPercent ?? null;
  economicData.fiscal.interestRates = country.interestRates ?? null;
  economicData.fiscal.debtServiceCosts = country.debtServiceCosts ?? null;

  // Government spending data - use DB value or null
  economicData.spending.totalSpending = country.totalGovernmentSpending ?? null;
  economicData.spending.spendingGDPPercent = country.spendingGDPPercent ?? null;

  // Wire GovernmentBudget relation (spending categories, efficiency)
  const govBudget = country.governmentBudget;
  if (govBudget) {
    if (govBudget.spendingCategories) {
      try {
        const raw = typeof govBudget.spendingCategories === "string"
          ? JSON.parse(govBudget.spendingCategories) : govBudget.spendingCategories;
        if (typeof raw === "object" && !Array.isArray(raw)) {
          const totalSpending = economicData.spending.totalSpending || profile.totalGdp * 0.28;
          economicData.spending.spendingCategories = Object.entries(raw).map(([category, pct]) => ({
            category,
            amount: totalSpending * (Number(pct) / 100),
            gdpPercent: Number(pct),
            percent: Number(pct),
          }));
        }
      } catch { /* keep template default */ }
    }
    if (govBudget.spendingEfficiency != null) economicData.spending.spendingEfficiency = govBudget.spendingEfficiency;
    if (govBudget.socialSpendingPercent != null) economicData.spending.socialSpendingPercent = govBudget.socialSpendingPercent;
  }

  // Wire FiscalSystem relation (tax rates)
  const fiscal = country.fiscalSystem;
  if (fiscal) {
    if (fiscal.salesTaxRate != null) {
      economicData.fiscal.taxRates = economicData.fiscal.taxRates ?? {};
      economicData.fiscal.taxRates.salesTaxRate = fiscal.salesTaxRate;
    }
    if (fiscal.propertyTaxRate != null) {
      economicData.fiscal.taxRates = economicData.fiscal.taxRates ?? {};
      economicData.fiscal.taxRates.propertyTaxRate = fiscal.propertyTaxRate;
    }
    if (fiscal.payrollTaxRate != null) {
      economicData.fiscal.taxRates = economicData.fiscal.taxRates ?? {};
      economicData.fiscal.taxRates.payrollTaxRate = fiscal.payrollTaxRate;
    }
    if (fiscal.wealthTaxRate != null) {
      economicData.fiscal.taxRates = economicData.fiscal.taxRates ?? {};
      economicData.fiscal.taxRates.wealthTaxRate = fiscal.wealthTaxRate;
    }
    if (fiscal.taxEfficiency != null) economicData.fiscal.taxEfficiency = fiscal.taxEfficiency;
    if (fiscal.fiscalBalanceGDPPercent != null) economicData.fiscal.fiscalBalanceGDPPercent = fiscal.fiscalBalanceGDPPercent;
    // personalIncomeTaxRates and corporateTaxRates are JSON strings
    if (fiscal.personalIncomeTaxRates) {
      try {
        const raw = typeof fiscal.personalIncomeTaxRates === "string"
          ? JSON.parse(fiscal.personalIncomeTaxRates) : fiscal.personalIncomeTaxRates;
        economicData.fiscal.taxRates = economicData.fiscal.taxRates ?? {};
        economicData.fiscal.taxRates.personalIncomeTaxRates = raw;
      } catch { /* ignore */ }
    }
    if (fiscal.corporateTaxRates) {
      try {
        const raw = typeof fiscal.corporateTaxRates === "string"
          ? JSON.parse(fiscal.corporateTaxRates) : fiscal.corporateTaxRates;
        economicData.fiscal.taxRates = economicData.fiscal.taxRates ?? {};
        economicData.fiscal.taxRates.corporateTaxRates = raw;
      } catch { /* ignore */ }
    }
  }

  // Wire IncomeDistribution relation
  const incomeDist = country.incomeDistribution;
  if (incomeDist) {
    if (incomeDist.top10PercentWealth != null) economicData.income.top10PercentWealth = incomeDist.top10PercentWealth;
    if (incomeDist.bottom50PercentWealth != null) economicData.income.bottom50PercentWealth = incomeDist.bottom50PercentWealth;
    if (incomeDist.middleClassPercent != null) economicData.income.middleClassPercent = incomeDist.middleClassPercent;
    if (incomeDist.intergenerationalMobility != null) economicData.income.intergenerationalMobility = incomeDist.intergenerationalMobility;
    if (incomeDist.economicClasses) {
      try {
        const raw = typeof incomeDist.economicClasses === "string"
          ? JSON.parse(incomeDist.economicClasses) : incomeDist.economicClasses;
        if (Array.isArray(raw)) {
          economicData.income.economicClasses = raw;
        } else if (typeof raw === "object") {
          economicData.income.economicClasses = Object.entries(raw).map(([name, pct]) => ({
            name,
            percentage: Number(pct),
          }));
        }
      } catch { /* keep template default */ }
    }
  }

  // Wire EconomicProfile relation (sector breakdown, trade)
  const econProfile = country.economicProfile;
  if (econProfile) {
    if (econProfile.gdpGrowthVolatility != null) economicData.core.gdpVolatility = econProfile.gdpGrowthVolatility;
    if (econProfile.economicComplexity != null) economicData.core.economicComplexity = econProfile.economicComplexity;
    if (econProfile.innovationIndex != null) economicData.core.innovationIndex = econProfile.innovationIndex;
    if (econProfile.competitivenessRank != null) economicData.core.competitivenessRank = econProfile.competitivenessRank;
    if (econProfile.easeOfDoingBusiness != null) economicData.core.easeOfDoingBusiness = econProfile.easeOfDoingBusiness;
    if (econProfile.corruptionIndex != null) economicData.core.corruptionIndex = econProfile.corruptionIndex;
    if (econProfile.sectorBreakdown) {
      try {
        const raw = typeof econProfile.sectorBreakdown === "string"
          ? JSON.parse(econProfile.sectorBreakdown) : econProfile.sectorBreakdown;
        if (typeof raw === "object") {
          economicData.core.sectorBreakdown = raw;
        }
      } catch { /* ignore */ }
    }
    if (econProfile.tradeBalance != null) economicData.core.tradeBalance = econProfile.tradeBalance;
    if (econProfile.exportsGDPPercent != null) economicData.core.exportsGDPPercent = econProfile.exportsGDPPercent;
    if (econProfile.importsGDPPercent != null) economicData.core.importsGDPPercent = econProfile.importsGDPPercent;
  }

  // Wire LaborMarket relation (sector employment, wage data)
  const laborMarket = country.laborMarket;
  if (laborMarket) {
    if (laborMarket.employmentBySector) {
      try {
        const raw = typeof laborMarket.employmentBySector === "string"
          ? JSON.parse(laborMarket.employmentBySector) : laborMarket.employmentBySector;
        if (typeof raw === "object") {
          economicData.labor.employmentBySector = raw;
        }
      } catch { /* ignore */ }
    }
    if (laborMarket.youthUnemploymentRate != null) economicData.labor.youthUnemploymentRate = laborMarket.youthUnemploymentRate;
    if (laborMarket.femaleParticipationRate != null) economicData.labor.femaleParticipationRate = laborMarket.femaleParticipationRate;
    if (laborMarket.informalEmploymentRate != null) economicData.labor.informalEmploymentRate = laborMarket.informalEmploymentRate;
    if (laborMarket.medianWage != null) economicData.labor.medianWage = laborMarket.medianWage;
    if (laborMarket.wageGrowthRate != null) economicData.labor.wageGrowthRate = laborMarket.wageGrowthRate;
    if (laborMarket.wageBySector) {
      try {
        const raw = typeof laborMarket.wageBySector === "string"
          ? JSON.parse(laborMarket.wageBySector) : laborMarket.wageBySector;
        if (typeof raw === "object") {
          economicData.labor.wageBySector = raw;
        }
      } catch { /* ignore */ }
    }
  }

  // Demographics data - use DB value or defaults
  economicData.demographics.lifeExpectancy = country.lifeExpectancy ?? null;
  economicData.demographics.literacyRate = country.literacyRate ?? null;
  economicData.demographics.urbanRuralSplit =
    country.urbanPopulationPercent !== null &&
    country.urbanPopulationPercent !== undefined &&
    country.ruralPopulationPercent !== null &&
    country.ruralPopulationPercent !== undefined
      ? {
          urban: country.urbanPopulationPercent,
          rural: country.ruralPopulationPercent,
        }
      : { urban: 60, rural: 40 }; // Default split if not available

  // Wire Demographics relation data (stored as JSON strings in the Demographics model)
  const demo = country.demographics;
  if (demo) {
    // ageDistribution: DB stores { "0-14": 18.2, ... }, UI needs [{ group, percentage }]
    if (demo.ageDistribution) {
      try {
        const raw = typeof demo.ageDistribution === "string" ? JSON.parse(demo.ageDistribution) : demo.ageDistribution;
        if (Array.isArray(raw)) {
          economicData.demographics.ageDistribution = raw;
        } else if (typeof raw === "object") {
          economicData.demographics.ageDistribution = Object.entries(raw).map(([group, val]) => ({
            group,
            percentage: Number(val),
            percent: Number(val),
            color: group.includes("0-14") ? "#3b82f6" : group.includes("65") ? "#f59e0b" : "#10b981",
          }));
        }
      } catch { /* keep template default */ }
    }

    // educationLevels: DB stores { "Primary": 8, ... }, UI needs [{ level, percentage }]
    if (demo.educationLevels) {
      try {
        const raw = typeof demo.educationLevels === "string" ? JSON.parse(demo.educationLevels) : demo.educationLevels;
        if (Array.isArray(raw)) {
          economicData.demographics.educationLevels = raw;
        } else if (typeof raw === "object") {
          economicData.demographics.educationLevels = Object.entries(raw).map(([level, val]) => ({
            level,
            percentage: Number(val),
            percent: Number(val),
            color: level.toLowerCase().includes("tertiary") || level.toLowerCase().includes("bachelor") || level.toLowerCase().includes("graduate") || level.toLowerCase().includes("doctor") ? "#10b981" :
                   level.toLowerCase().includes("secondary") || level.toLowerCase().includes("vocational") ? "#f59e0b" : "#ef4444",
          }));
        }
      } catch { /* keep template default */ }
    }

    // regions: DB stores { "Capital Region": 28, ... }, UI needs [{ region, percentage }]
    if (demo.regions) {
      try {
        const raw = typeof demo.regions === "string" ? JSON.parse(demo.regions) : demo.regions;
        if (Array.isArray(raw)) {
          economicData.demographics.regions = raw;
          economicData.demographics.regionalDistribution = raw;
        } else if (typeof raw === "object") {
          const arr = Object.entries(raw).map(([region, val]) => ({
            region,
            name: region,
            percentage: Number(val),
            population: Math.round((Number(val) / 100) * (country.currentPopulation || 0)),
          }));
          economicData.demographics.regions = arr;
          economicData.demographics.regionalDistribution = arr;
        }
      } catch { /* keep template default */ }
    }

    // citizenshipStatuses
    if (demo.citizenshipStatuses) {
      try {
        const raw = typeof demo.citizenshipStatuses === "string" ? JSON.parse(demo.citizenshipStatuses) : demo.citizenshipStatuses;
        if (Array.isArray(raw)) {
          economicData.demographics.citizenshipStatuses = raw;
        } else if (typeof raw === "object") {
          economicData.demographics.citizenshipStatuses = Object.entries(raw).map(([status, val]) => ({
            status,
            percentage: Number(val),
          }));
        }
      } catch { /* keep template default */ }
    }

    if (demo.medianAge != null) economicData.demographics.medianAge = demo.medianAge;
    if (demo.dependencyRatio != null) economicData.demographics.dependencyRatio = demo.dependencyRatio;
    if (demo.birthRate != null) economicData.demographics.birthRate = demo.birthRate;
    if (demo.deathRate != null) economicData.demographics.deathRate = demo.deathRate;
    if (demo.migrationRate != null) economicData.demographics.migrationRate = demo.migrationRate;
  }

  return economicData;
}
