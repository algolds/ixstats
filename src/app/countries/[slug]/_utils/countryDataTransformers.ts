// Refactored from main CountryPage - transforms country data for various components

import { createDefaultGovernmentSpendingData } from "~/lib/government-spending-defaults";
import type {
  CoreEconomicIndicatorsData,
  DemographicsData,
  LaborEmploymentData,
  FiscalSystemData,
  GovernmentSpendingData,
} from "~/types/economics";

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentTotalGdp: number;
  currentGdpPerCapita: number;
  adjustedGdpGrowth: number | null;
  economicTier: string;
  populationTier: string;
}

export interface EconomicsData {
  core: CoreEconomicIndicatorsData;
  demographics: DemographicsData;
  labor: LaborEmploymentData;
  fiscal: FiscalSystemData;
  spending: GovernmentSpendingData;
}

/**
 * Transform country database data into format required by economics components
 */
export function transformCountryEconomicsData(country: CountryData): EconomicsData {
  const coreIndicators: CoreEconomicIndicatorsData = {
    totalPopulation: country.currentPopulation,
    nominalGDP: country.currentTotalGdp,
    gdpPerCapita: country.currentGdpPerCapita,
    realGDPGrowthRate: country.adjustedGdpGrowth ?? 0.03,
    inflationRate: 0.02,
    currencyExchangeRate: 1.0,
    giniCoefficient: 35,
  };

  const demographicsData: DemographicsData = {
    lifeExpectancy: 78,
    urbanRuralSplit: { urban: 75, rural: 25 },
    ageDistribution: [
      { group: "0-14", percent: 18, color: "#3b82f6" },
      { group: "15-24", percent: 12, color: "#10b981" },
      { group: "25-54", percent: 42, color: "#f59e0b" },
      { group: "55-64", percent: 15, color: "#ef4444" },
      { group: "65+", percent: 13, color: "#8b5cf6" },
    ],
    regions: [],
    educationLevels: [
      { level: "Primary", percent: 15, color: "#3b82f6" },
      { level: "Secondary", percent: 45, color: "#10b981" },
      { level: "Tertiary", percent: 30, color: "#f59e0b" },
      { level: "Post-graduate", percent: 10, color: "#ef4444" },
    ],
    literacyRate: 95,
    citizenshipStatuses: [
      { status: "Citizen", percent: 92, color: "#3b82f6" },
      { status: "Permanent Resident", percent: 5, color: "#10b981" },
      { status: "Temporary", percent: 3, color: "#f59e0b" },
    ],
  };

  const laborData: LaborEmploymentData = {
    laborForceParticipationRate: 65,
    employmentRate: 94,
    unemploymentRate: 6,
    totalWorkforce: country.currentPopulation * 0.65,
    averageWorkweekHours: 40,
    minimumWage: (country.currentGdpPerCapita * 0.4) / 2080,
    averageAnnualIncome: country.currentGdpPerCapita * 0.85,
    employmentBySector: {
      agriculture: 5,
      industry: 25,
      services: 70,
    },
    employmentByType: {
      fullTime: 75,
      partTime: 15,
      temporary: 5,
      selfEmployed: 10,
      informal: 5,
    },
    skillsAndProductivity: {
      averageEducationYears: 12.5,
      tertiaryEducationRate: 30,
      vocationalTrainingRate: 20,
      skillsGapIndex: 25,
      laborProductivityIndex: 100,
      productivityGrowthRate: 2.5,
    },
    demographicsAndConditions: {
      youthUnemploymentRate: 12,
      femaleParticipationRate: 60,
      genderPayGap: 15,
      unionizationRate: 25,
      workplaceSafetyIndex: 85,
      averageCommutingTime: 30,
    },
    regionalEmployment: {
      urban: {
        participationRate: 70,
        unemploymentRate: 5,
        averageIncome: country.currentGdpPerCapita * 1.1,
      },
      rural: {
        participationRate: 55,
        unemploymentRate: 8,
        averageIncome: country.currentGdpPerCapita * 0.7,
      },
    },
    socialProtection: {
      unemploymentBenefitCoverage: 80,
      pensionCoverage: 95,
      healthInsuranceCoverage: 90,
      paidSickLeaveDays: 10,
      paidVacationDays: 20,
      parentalLeaveWeeks: 16,
    },
  };

  const fiscalData: FiscalSystemData = {
    taxRevenueGDPPercent: 25,
    governmentRevenueTotal: country.currentTotalGdp * 0.25,
    taxRevenuePerCapita: country.currentGdpPerCapita * 0.25,
    governmentBudgetGDPPercent: 28,
    budgetDeficitSurplus: -country.currentTotalGdp * 0.03,
    internalDebtGDPPercent: 40,
    externalDebtGDPPercent: 20,
    totalDebtGDPRatio: 60,
    debtPerCapita: country.currentGdpPerCapita * 0.6,
    interestRates: 0.03,
    debtServiceCosts: country.currentTotalGdp * 0.02,
    taxRates: {
      personalIncomeTaxRates: [
        { bracket: 0, rate: 10 },
        { bracket: 50000, rate: 20 },
        { bracket: 100000, rate: 30 },
        { bracket: 200000, rate: 40 },
      ],
      corporateTaxRates: [
        { size: "Small", rate: 15 },
        { size: "Medium", rate: 20 },
        { size: "Large", rate: 25 },
      ],
      salesTaxRate: 8,
      propertyTaxRate: 1.5,
      payrollTaxRate: 7.5,
      exciseTaxRates: [],
      wealthTaxRate: 0.5,
    },
    governmentSpendingByCategory: [
      {
        category: "Healthcare",
        amount: country.currentTotalGdp * 0.06,
        percent: 20,
        color: "#3b82f6",
      },
      {
        category: "Education",
        amount: country.currentTotalGdp * 0.05,
        percent: 18,
        color: "#10b981",
      },
      {
        category: "Defense",
        amount: country.currentTotalGdp * 0.04,
        percent: 15,
        color: "#ef4444",
      },
      {
        category: "Social Security",
        amount: country.currentTotalGdp * 0.07,
        percent: 25,
        color: "#8b5cf6",
      },
    ],
  };

  const spendingData: GovernmentSpendingData = createDefaultGovernmentSpendingData({
    education: country.currentTotalGdp * 0.05,
    healthcare: country.currentTotalGdp * 0.06,
    socialSafety: country.currentTotalGdp * 0.07,
    totalSpending: country.currentTotalGdp * 0.28,
    spendingGDPPercent: 28,
    spendingPerCapita: country.currentGdpPerCapita * 0.28,
    deficitSurplus: -country.currentTotalGdp * 0.03,
    spendingCategories: [
      {
        category: "Healthcare",
        amount: country.currentTotalGdp * 0.06,
        percent: 21,
        color: "#3b82f6",
      },
      {
        category: "Education",
        amount: country.currentTotalGdp * 0.05,
        percent: 18,
        color: "#10b981",
      },
      {
        category: "Defense",
        amount: country.currentTotalGdp * 0.04,
        percent: 14,
        color: "#ef4444",
      },
      {
        category: "Social Security",
        amount: country.currentTotalGdp * 0.07,
        percent: 25,
        color: "#8b5cf6",
      },
      {
        category: "Infrastructure",
        amount: country.currentTotalGdp * 0.03,
        percent: 11,
        color: "#f59e0b",
      },
      { category: "Other", amount: country.currentTotalGdp * 0.03, percent: 11, color: "#6b7280" },
    ],
    performanceBasedBudgeting: true,
    universalBasicServices: false,
    greenInvestmentPriority: true,
    digitalGovernmentInitiative: true,
  });

  return {
    core: coreIndicators,
    demographics: demographicsData,
    labor: laborData,
    fiscal: fiscalData,
    spending: spendingData,
  };
}

/**
 * Calculate vitality metrics for country overview display
 */
export function calculateVitalityData(country: {
  economicTier: string;
  adjustedGdpGrowth: number | null;
  populationGrowthRate: number | null;
  populationDensity: number | null;
}) {
  // Economic Vitality (based on GDP per capita and growth)
  const economicTierScore =
    {
      Extravagant: 95,
      "Very Strong": 85,
      Strong: 75,
      Healthy: 65,
      Developed: 50,
      Developing: 35,
    }[country.economicTier] || 25;

  const gdpGrowthBonus = Math.min(20, Math.max(-20, (country.adjustedGdpGrowth ?? 0) * 400));
  const economicVitality = Math.min(100, Math.max(0, economicTierScore + gdpGrowthBonus));

  // Population Wellbeing (based on population growth and density)
  const popGrowthHealth = (country.populationGrowthRate ?? 0) > 0 ? 70 : 40;
  const densityFactor = country.populationDensity
    ? Math.max(50, 100 - country.populationDensity / 500)
    : 60;
  const populationWellbeing = (popGrowthHealth + densityFactor) / 2;

  // Diplomatic Standing (simplified for public view)
  const diplomaticStanding = 60;

  // Governmental Efficiency (based on economic tier as proxy)
  const governmentalEfficiency = economicTierScore * 0.8;

  return {
    economicVitality,
    populationWellbeing,
    diplomaticStanding,
    governmentalEfficiency,
  };
}

/**
 * Prepare metrics for CountryMetricsGrid display
 */
export function transformCountryMetrics(country: {
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  adjustedGdpGrowth: number | null;
  economicTier: string;
  populationTier: string;
  landArea: number | null;
  populationDensity: number | null;
}) {
  return [
    {
      label: "Population",
      value: `${((country.currentPopulation || 0) / 1000000).toFixed(1)}M`,
      subtext: `${(country.currentPopulation || 0).toLocaleString()} citizens`,
      colorClass: "bg-blue-50 dark:bg-blue-950/50 text-blue-600",
      tooltip: {
        title: "Current Population",
        details: [
          `Total: ${(country.currentPopulation || 0).toLocaleString()} citizens`,
          `Population Tier: ${country.populationTier || "Unknown"}`,
        ],
      },
    },
    {
      label: "GDP/Capita",
      value: `$${((country.currentGdpPerCapita || 0) / 1000).toFixed(0)}k`,
      subtext: `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
      colorClass: "bg-green-50 dark:bg-green-950/50 text-green-600",
      tooltip: {
        title: "GDP per Capita",
        details: [
          `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
          "Economic strength indicator",
        ],
      },
    },
    {
      label: "Growth",
      value: `${((country.adjustedGdpGrowth || 0) * 100).toFixed(2)}%`,
      subtext: "Adjusted GDP growth rate",
      colorClass: "bg-purple-50 dark:bg-purple-950/50 text-purple-600",
      tooltip: {
        title: "Economic Growth Rate",
        details: [
          "Adjusted GDP growth rate after global factors",
          (country.adjustedGdpGrowth || 0) > 0.05
            ? "Strong growth"
            : (country.adjustedGdpGrowth || 0) > 0.02
              ? "Moderate growth"
              : (country.adjustedGdpGrowth || 0) > 0
                ? "Slow growth"
                : "Declining",
        ],
      },
    },
    {
      label: "Economic Tier",
      value: country.economicTier || "Unknown",
      subtext: "Development classification",
      colorClass: "bg-orange-50 dark:bg-orange-950/50 text-orange-600",
      tooltip: {
        title: "Economic Development Tier",
        details: [
          "Based on GDP per capita and economic indicators",
          `Current classification: ${country.economicTier || "Unknown"}`,
        ],
      },
    },
    {
      label: "Total GDP",
      value: `$${((country.currentTotalGdp || 0) / 1000000000).toFixed(1)}B`,
      subtext: "National economic output",
      colorClass: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600",
      tooltip: {
        title: "Total GDP",
        details: [
          `$${(country.currentTotalGdp || 0).toLocaleString()}`,
          "Total national economic output",
        ],
      },
    },
    {
      label: "Land Area",
      value: country.landArea ? `${(country.landArea / 1000).toFixed(0)}k km²` : "N/A",
      subtext: country.landArea ? `${country.landArea.toLocaleString()} km²` : "Not available",
      colorClass: "bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600",
      tooltip: {
        title: "Territory",
        details: [
          country.landArea ? `${country.landArea.toLocaleString()} km²` : "Data not available",
          country.populationDensity
            ? `Density: ${Math.round(country.populationDensity)}/km²`
            : "Density: N/A",
        ],
      },
    },
  ];
}
