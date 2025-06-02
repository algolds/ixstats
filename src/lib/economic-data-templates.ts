// src/lib/economic-data-templates.ts
// Default economic data templates for countries
// This provides standardized fallback data that can be easily replaced with live data

import type { 
  CoreEconomicIndicatorsData, 
  LaborEmploymentData, 
  FiscalSystemData, 
  IncomeWealthDistributionData, 
  GovernmentSpendingData, 
  DemographicsData 
} from "~/types/economics";

/**
 * Country profile for calculating realistic default values
 */
export interface CountryProfile {
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  economicTier: string;
  landArea?: number | null;
  continent?: string | null;
  region?: string | null;
}

/**
 * Generate default core economic indicators based on country profile
 */
export function generateCoreEconomicIndicators(profile: CountryProfile): CoreEconomicIndicatorsData {
  return {
    totalPopulation: profile.population,
    nominalGDP: profile.totalGdp,
    gdpPerCapita: profile.gdpPerCapita,
    realGDPGrowthRate: getDefaultGdpGrowthRate(profile.economicTier),
    inflationRate: getDefaultInflationRate(profile.economicTier),
    currencyExchangeRate: 1.0, // Base currency rate
  };
}

/**
 * Generate default labor and employment data based on country profile
 */
export function generateLaborEmploymentData(profile: CountryProfile): LaborEmploymentData {
  const workingAgePercent = getWorkingAgePercent(profile.economicTier);
  const participationRate = getLaborParticipationRate(profile.economicTier);
  const unemploymentRate = getUnemploymentRate(profile.economicTier);
  
  const workingAgePopulation = profile.population * workingAgePercent;
  const totalWorkforce = Math.round(workingAgePopulation * (participationRate / 100));
  const employmentRate = 100 - unemploymentRate;

  return {
    laborForceParticipationRate: participationRate,
    employmentRate: employmentRate,
    unemploymentRate: unemploymentRate,
    totalWorkforce: totalWorkforce,
    averageWorkweekHours: getAverageWorkweek(profile.economicTier),
    minimumWage: getMinimumWage(profile.gdpPerCapita),
    averageAnnualIncome: getAverageIncome(profile.gdpPerCapita),
  };
}

/**
 * Generate default fiscal system data based on country profile
 */
export function generateFiscalSystemData(profile: CountryProfile): FiscalSystemData {
  const taxRevenuePercent = getTaxRevenuePercent(profile.economicTier);
  const governmentRevenueTotal = profile.totalGdp * (taxRevenuePercent / 100);
  const spendingPercent = getGovernmentSpendingPercent(profile.economicTier);
  const totalSpending = profile.totalGdp * (spendingPercent / 100);
  const budgetBalance = governmentRevenueTotal - totalSpending;
  const debtPercent = getDebtToGdpPercent(profile.economicTier);

  return {
    taxRevenueGDPPercent: taxRevenuePercent,
    governmentRevenueTotal: governmentRevenueTotal,
    taxRevenuePerCapita: governmentRevenueTotal / profile.population,
    governmentBudgetGDPPercent: spendingPercent,
    budgetDeficitSurplus: budgetBalance,
    internalDebtGDPPercent: debtPercent * 0.7, // 70% internal
    externalDebtGDPPercent: debtPercent * 0.3, // 30% external
    totalDebtGDPRatio: debtPercent,
    debtPerCapita: (profile.totalGdp * (debtPercent / 100)) / profile.population,
    interestRates: getInterestRates(profile.economicTier),
    debtServiceCosts: (profile.totalGdp * (debtPercent / 100)) * 0.05, // 5% of debt
    taxRates: getDefaultTaxRates(profile.economicTier),
    governmentSpendingByCategory: getDefaultSpendingCategories(),
  };
}

/**
 * Generate default income and wealth distribution data
 */
export function generateIncomeWealthDistribution(profile: CountryProfile): IncomeWealthDistributionData {
  const giniCoefficient = getGiniCoefficient(profile.economicTier);
  const povertyRate = getPovertyRate(profile.economicTier);
  const mobilityIndex = getSocialMobilityIndex(profile.economicTier);

  return {
    economicClasses: getEconomicClasses(profile.gdpPerCapita, giniCoefficient),
    povertyRate: povertyRate,
    incomeInequalityGini: giniCoefficient,
    socialMobilityIndex: mobilityIndex,
  };
}

/**
 * Generate default government spending data
 */
export function generateGovernmentSpendingData(profile: CountryProfile): GovernmentSpendingData {
  const spendingPercent = getGovernmentSpendingPercent(profile.economicTier);
  const totalSpending = profile.totalGdp * (spendingPercent / 100);
  const taxRevenuePercent = getTaxRevenuePercent(profile.economicTier);
  const totalRevenue = profile.totalGdp * (taxRevenuePercent / 100);
  const deficit = totalSpending - totalRevenue;

  return {
    totalSpending: totalSpending,
    spendingGDPPercent: spendingPercent,
    spendingPerCapita: totalSpending / profile.population,
    deficitSurplus: -deficit,
    spendingCategories: getSpendingCategoriesWithAmounts(totalSpending),
  };
}

/**
 * Generate default demographics data
 */
export function generateDemographicsData(profile: CountryProfile): DemographicsData {
  return {
    lifeExpectancy: getLifeExpectancy(profile.economicTier),
    urbanRuralSplit: getUrbanRuralSplit(profile.economicTier),
    ageDistribution: getAgeDistribution(),
    regions: getDefaultRegions(profile.population),
    educationLevels: getEducationLevels(profile.economicTier),
    literacyRate: getLiteracyRate(profile.economicTier),
    citizenshipStatuses: getCitizenshipStatuses(),
  };
}

// Helper functions for calculating realistic defaults based on economic tier

function getDefaultGdpGrowthRate(tier: string): number {
  const rates = {
    'Extravagant': 0.025,
    'Very Strong': 0.03,
    'Strong': 0.035,
    'Healthy': 0.04,
    'Developed': 0.03,
    'Emerging': 0.05,
    'Developing': 0.06,
  };
  return rates[tier as keyof typeof rates] || 0.03;
}

function getDefaultInflationRate(tier: string): number {
  const rates = {
    'Extravagant': 0.015,
    'Very Strong': 0.02,
    'Strong': 0.025,
    'Healthy': 0.03,
    'Developed': 0.025,
    'Emerging': 0.04,
    'Developing': 0.06,
  };
  return rates[tier as keyof typeof rates] || 0.025;
}

function getWorkingAgePercent(tier: string): number {
  const percentages = {
    'Extravagant': 0.62,
    'Very Strong': 0.64,
    'Strong': 0.65,
    'Healthy': 0.66,
    'Developed': 0.65,
    'Emerging': 0.68,
    'Developing': 0.70,
  };
  return percentages[tier as keyof typeof percentages] || 0.65;
}

function getLaborParticipationRate(tier: string): number {
  const rates = {
    'Extravagant': 68,
    'Very Strong': 66,
    'Strong': 65,
    'Healthy': 64,
    'Developed': 65,
    'Emerging': 62,
    'Developing': 60,
  };
  return rates[tier as keyof typeof rates] || 65;
}

function getUnemploymentRate(tier: string): number {
  const rates = {
    'Extravagant': 3,
    'Very Strong': 4,
    'Strong': 5,
    'Healthy': 6,
    'Developed': 5,
    'Emerging': 8,
    'Developing': 12,
  };
  return rates[tier as keyof typeof rates] || 5;
}

function getAverageWorkweek(tier: string): number {
  const hours = {
    'Extravagant': 38,
    'Very Strong': 39,
    'Strong': 40,
    'Healthy': 41,
    'Developed': 40,
    'Emerging': 42,
    'Developing': 44,
  };
  return hours[tier as keyof typeof hours] || 40;
}

function getMinimumWage(gdpPerCapita: number): number {
  return Math.max(8, gdpPerCapita * 0.0003); // Rough correlation
}

function getAverageIncome(gdpPerCapita: number): number {
  return gdpPerCapita * 0.85; // Average income is typically 85% of GDP per capita
}

function getTaxRevenuePercent(tier: string): number {
  const percentages = {
    'Extravagant': 25,
    'Very Strong': 23,
    'Strong': 21,
    'Healthy': 19,
    'Developed': 20,
    'Emerging': 17,
    'Developing': 15,
  };
  return percentages[tier as keyof typeof percentages] || 20;
}

function getGovernmentSpendingPercent(tier: string): number {
  const percentages = {
    'Extravagant': 28,
    'Very Strong': 25,
    'Strong': 23,
    'Healthy': 21,
    'Developed': 22,
    'Emerging': 19,
    'Developing': 17,
  };
  return percentages[tier as keyof typeof percentages] || 22;
}

function getDebtToGdpPercent(tier: string): number {
  const percentages = {
    'Extravagant': 45,
    'Very Strong': 50,
    'Strong': 55,
    'Healthy': 60,
    'Developed': 50,
    'Emerging': 40,
    'Developing': 35,
  };
  return percentages[tier as keyof typeof percentages] || 50;
}

function getInterestRates(tier: string): number {
  const rates = {
    'Extravagant': 0.02,
    'Very Strong': 0.025,
    'Strong': 0.03,
    'Healthy': 0.035,
    'Developed': 0.03,
    'Emerging': 0.05,
    'Developing': 0.08,
  };
  return rates[tier as keyof typeof rates] || 0.03;
}

function getDefaultTaxRates(tier: string) {
  const baseRate = tier === 'Developing' ? 0.15 : tier === 'Emerging' ? 0.20 : 0.25;
  
  return {
    personalIncomeTaxRates: [
      { bracket: 25000, rate: baseRate * 0.4 },
      { bracket: 75000, rate: baseRate * 0.8 },
      { bracket: Infinity, rate: baseRate * 1.2 },
    ],
    corporateTaxRates: [
      { size: "Standard", rate: baseRate * 0.9 },
      { size: "Small Business", rate: baseRate * 0.6 },
    ],
    salesTaxRate: baseRate * 0.6,
    propertyTaxRate: baseRate * 0.4,
    payrollTaxRate: baseRate * 0.5,
    exciseTaxRates: [
      { type: "Tobacco", rate: 0.50 },
      { type: "Alcohol", rate: 0.30 },
      { type: "Fuel", rate: 0.20 },
    ],
    wealthTaxRate: tier === 'Extravagant' ? 0.02 : 0,
  };
}

function getDefaultSpendingCategories() {
  return [
    { category: "Education", amount: 0, percent: 20 },
    { category: "Healthcare", amount: 0, percent: 18 },
    { category: "Defense", amount: 0, percent: 15 },
    { category: "Infrastructure", amount: 0, percent: 12 },
    { category: "Social Services", amount: 0, percent: 25 },
    { category: "Other", amount: 0, percent: 10 },
  ];
}

function getGiniCoefficient(tier: string): number {
  const coefficients = {
    'Extravagant': 0.28,
    'Very Strong': 0.32,
    'Strong': 0.35,
    'Healthy': 0.38,
    'Developed': 0.35,
    'Emerging': 0.42,
    'Developing': 0.48,
  };
  return coefficients[tier as keyof typeof coefficients] || 0.35;
}

function getPovertyRate(tier: string): number {
  const rates = {
    'Extravagant': 5,
    'Very Strong': 8,
    'Strong': 12,
    'Healthy': 15,
    'Developed': 12,
    'Emerging': 20,
    'Developing': 30,
  };
  return rates[tier as keyof typeof rates] || 15;
}

function getSocialMobilityIndex(tier: string): number {
  const indices = {
    'Extravagant': 80,
    'Very Strong': 75,
    'Strong': 70,
    'Healthy': 65,
    'Developed': 70,
    'Emerging': 55,
    'Developing': 40,
  };
  return indices[tier as keyof typeof indices] || 50;
}

function getEconomicClasses(gdpPerCapita: number, gini: number) {
  // Calculate income distribution based on GDP per capita and Gini coefficient
  const avgIncome = gdpPerCapita * 0.85;
  const inequality = gini * 2; // Scale Gini for distribution
  
  return [
    {
      name: "Lower Class",
      populationPercent: 40,
      wealthPercent: Math.max(5, 20 - inequality * 15),
      averageIncome: avgIncome * 0.4,
      color: "#ef4444"
    },
    {
      name: "Middle Class",
      populationPercent: 50,
      wealthPercent: Math.max(30, 60 - inequality * 20),
      averageIncome: avgIncome * 0.9,
      color: "#3b82f6"
    },
    {
      name: "Upper Class",
      populationPercent: 10,
      wealthPercent: Math.min(65, 20 + inequality * 35),
      averageIncome: avgIncome * 3.5,
      color: "#10b981"
    },
  ];
}

function getSpendingCategoriesWithAmounts(totalSpending: number) {
  const categories = getDefaultSpendingCategories();
  
  return categories.map(cat => ({
    category: cat.category,
    amount: totalSpending * (cat.percent / 100),
    percent: cat.percent,
    icon: getCategoryIcon(cat.category),
    color: getCategoryColor(cat.category),
    description: getCategoryDescription(cat.category),
  }));
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    "Education": "GraduationCap",
    "Healthcare": "Heart",
    "Defense": "Shield",
    "Infrastructure": "Road",
    "Social Services": "Users",
    "Other": "MoreHorizontal",
  };
  return icons[category] || "MoreHorizontal";
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Education": "#3b82f6",
    "Healthcare": "#ef4444",
    "Defense": "#8b5cf6",
    "Infrastructure": "#f59e0b",
    "Social Services": "#10b981",
    "Other": "#6b7280",
  };
  return colors[category] || "#6b7280";
}

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    "Education": "Schools, universities, research",
    "Healthcare": "Hospitals, public health",
    "Defense": "Military, national security",
    "Infrastructure": "Roads, utilities, transport",
    "Social Services": "Welfare, unemployment benefits",
    "Other": "Administration, other expenses",
  };
  return descriptions[category] || "Other government expenses";
}

function getLifeExpectancy(tier: string): number {
  const expectancies = {
    'Extravagant': 82,
    'Very Strong': 80,
    'Strong': 78,
    'Healthy': 76,
    'Developed': 78,
    'Emerging': 72,
    'Developing': 68,
  };
  return expectancies[tier as keyof typeof expectancies] || 75;
}

function getUrbanRuralSplit(tier: string) {
  const urbanPercents = {
    'Extravagant': 85,
    'Very Strong': 80,
    'Strong': 75,
    'Healthy': 70,
    'Developed': 75,
    'Emerging': 60,
    'Developing': 45,
  };
  const urban = urbanPercents[tier as keyof typeof urbanPercents] || 60;
  return { urban, rural: 100 - urban };
}

function getAgeDistribution() {
  return [
    { group: "0-14", percent: 20, color: "#3b82f6" },
    { group: "15-64", percent: 65, color: "#10b981" },
    { group: "65+", percent: 15, color: "#f59e0b" },
  ];
}

function getDefaultRegions(totalPopulation: number) {
  // Generate some basic regional distribution
  return [
    {
      name: "Central Region",
      population: Math.round(totalPopulation * 0.4),
      urbanPercent: 80,
      color: "#3b82f6"
    },
    {
      name: "Northern Region",
      population: Math.round(totalPopulation * 0.3),
      urbanPercent: 60,
      color: "#10b981"
    },
    {
      name: "Southern Region",
      population: Math.round(totalPopulation * 0.3),
      urbanPercent: 50,
      color: "#f59e0b"
    },
  ];
}

function getEducationLevels(tier: string) {
  const tertiaryPercents = {
    'Extravagant': 45,
    'Very Strong': 40,
    'Strong': 35,
    'Healthy': 30,
    'Developed': 35,
    'Emerging': 20,
    'Developing': 12,
  };
  
  const tertiary = tertiaryPercents[tier as keyof typeof tertiaryPercents] || 25;
  const secondary = Math.min(50, 70 - tertiary);
  const primary = 100 - tertiary - secondary;
  
  return [
    { level: "Primary", percent: primary, color: "#ef4444" },
    { level: "Secondary", percent: secondary, color: "#f59e0b" },
    { level: "Tertiary", percent: tertiary, color: "#10b981" },
  ];
}

function getLiteracyRate(tier: string): number {
  const rates = {
    'Extravagant': 99,
    'Very Strong': 98,
    'Strong': 96,
    'Healthy': 94,
    'Developed': 96,
    'Emerging': 85,
    'Developing': 75,
  };
  return rates[tier as keyof typeof rates] || 90;
}

function getCitizenshipStatuses() {
  return [
    { status: "Citizens", percent: 85, color: "#3b82f6" },
    { status: "Permanent Residents", percent: 10, color: "#10b981" },
    { status: "Temporary Residents", percent: 5, color: "#f59e0b" },
  ];
}

/**
 * Main function to generate all economic data for a country
 */
export function generateCountryEconomicData(profile: CountryProfile) {
  return {
    core: generateCoreEconomicIndicators(profile),
    labor: generateLaborEmploymentData(profile),
    fiscal: generateFiscalSystemData(profile),
    income: generateIncomeWealthDistribution(profile),
    spending: generateGovernmentSpendingData(profile),
    demographics: generateDemographicsData(profile),
  };
} 