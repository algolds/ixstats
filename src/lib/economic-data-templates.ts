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
    // Basic metrics
    laborForceParticipationRate: participationRate,
    employmentRate: employmentRate,
    unemploymentRate: unemploymentRate,
    totalWorkforce: totalWorkforce,
    averageWorkweekHours: getAverageWorkweek(profile.economicTier),
    minimumWage: getMinimumWage(profile.gdpPerCapita),
    averageAnnualIncome: getAverageIncome(profile.gdpPerCapita),
    
    // Employment by sector
    employmentBySector: {
      agriculture: getAgricultureEmployment(profile.economicTier),
      industry: getIndustryEmployment(profile.economicTier),
      services: getServicesEmployment(profile.economicTier),
    },
    
    // Employment by type
    employmentByType: {
      fullTime: getFullTimeEmployment(profile.economicTier),
      partTime: getPartTimeEmployment(profile.economicTier),
      temporary: getTemporaryEmployment(profile.economicTier),
      selfEmployed: getSelfEmployment(profile.economicTier),
      informal: getInformalEmployment(profile.economicTier),
    },
    
    // Skills and productivity
    skillsAndProductivity: {
      averageEducationYears: getAverageEducationYears(profile.economicTier),
      tertiaryEducationRate: getTertiaryEducationRate(profile.economicTier),
      vocationalTrainingRate: getVocationalTrainingRate(profile.economicTier),
      skillsGapIndex: getSkillsGapIndex(profile.economicTier),
      laborProductivityIndex: getLaborProductivityIndex(profile.economicTier),
      productivityGrowthRate: getProductivityGrowthRate(profile.economicTier),
    },
    
    // Demographics and conditions
    demographicsAndConditions: {
      youthUnemploymentRate: getYouthUnemploymentRate(profile.economicTier, unemploymentRate),
      femaleParticipationRate: getFemaleParticipationRate(profile.economicTier),
      genderPayGap: getGenderPayGap(profile.economicTier),
      unionizationRate: getUnionizationRate(profile.economicTier),
      workplaceSafetyIndex: getWorkplaceSafetyIndex(profile.economicTier),
      averageCommutingTime: getAverageCommutingTime(profile.economicTier),
    },
    
    // Regional breakdown
    regionalEmployment: {
      urban: {
        participationRate: participationRate + getUrbanParticipationBonus(profile.economicTier),
        unemploymentRate: unemploymentRate - getUrbanUnemploymentAdjustment(profile.economicTier),
        averageIncome: getAverageIncome(profile.gdpPerCapita) * getUrbanIncomeMultiplier(profile.economicTier),
      },
      rural: {
        participationRate: participationRate - getRuralParticipationPenalty(profile.economicTier),
        unemploymentRate: unemploymentRate + getRuralUnemploymentAdjustment(profile.economicTier),
        averageIncome: getAverageIncome(profile.gdpPerCapita) * getRuralIncomeMultiplier(profile.economicTier),
      },
    },
    
    // Benefits and social protection
    socialProtection: {
      unemploymentBenefitCoverage: getUnemploymentBenefitCoverage(profile.economicTier),
      pensionCoverage: getPensionCoverage(profile.economicTier),
      healthInsuranceCoverage: getHealthInsuranceCoverage(profile.economicTier),
      paidSickLeaveDays: getPaidSickLeaveDays(profile.economicTier),
      paidVacationDays: getPaidVacationDays(profile.economicTier),
      parentalLeaveWeeks: getParentalLeaveWeeks(profile.economicTier),
    },
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
    governmentSpendingByCategory: getSpendingCategoriesWithAmounts(totalSpending),
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
    { status: 'Citizens', percent: 85, color: '#3b82f6' },
    { status: 'Permanent Residents', percent: 10, color: '#10b981' },
    { status: 'Temporary Workers', percent: 4, color: '#f59e0b' },
    { status: 'Other', percent: 1, color: '#6b7280' },
  ];
}

// Enhanced Labor Market Helper Functions

function getAgricultureEmployment(tier: string): number {
  const rates = {
    'Extravagant': 2,
    'Very Strong': 3,
    'Strong': 4,
    'Healthy': 6,
    'Developed': 5,
    'Emerging': 15,
    'Developing': 35,
  };
  return rates[tier as keyof typeof rates] || 10;
}

function getIndustryEmployment(tier: string): number {
  const rates = {
    'Extravagant': 20,
    'Very Strong': 22,
    'Strong': 25,
    'Healthy': 28,
    'Developed': 25,
    'Emerging': 30,
    'Developing': 25,
  };
  return rates[tier as keyof typeof rates] || 25;
}

function getServicesEmployment(tier: string): number {
  const agriculture = getAgricultureEmployment(tier);
  const industry = getIndustryEmployment(tier);
  return Math.max(0, 100 - agriculture - industry);
}

function getFullTimeEmployment(tier: string): number {
  const rates = {
    'Extravagant': 85,
    'Very Strong': 82,
    'Strong': 80,
    'Healthy': 78,
    'Developed': 80,
    'Emerging': 75,
    'Developing': 70,
  };
  return rates[tier as keyof typeof rates] || 78;
}

function getPartTimeEmployment(tier: string): number {
  const rates = {
    'Extravagant': 12,
    'Very Strong': 14,
    'Strong': 15,
    'Healthy': 16,
    'Developed': 15,
    'Emerging': 12,
    'Developing': 10,
  };
  return rates[tier as keyof typeof rates] || 14;
}

function getTemporaryEmployment(tier: string): number {
  const rates = {
    'Extravagant': 8,
    'Very Strong': 10,
    'Strong': 12,
    'Healthy': 15,
    'Developed': 12,
    'Emerging': 18,
    'Developing': 25,
  };
  return rates[tier as keyof typeof rates] || 15;
}

function getSelfEmployment(tier: string): number {
  const rates = {
    'Extravagant': 12,
    'Very Strong': 14,
    'Strong': 16,
    'Healthy': 18,
    'Developed': 15,
    'Emerging': 25,
    'Developing': 35,
  };
  return rates[tier as keyof typeof rates] || 20;
}

function getInformalEmployment(tier: string): number {
  const rates = {
    'Extravagant': 5,
    'Very Strong': 8,
    'Strong': 12,
    'Healthy': 15,
    'Developed': 10,
    'Emerging': 30,
    'Developing': 50,
  };
  return rates[tier as keyof typeof rates] || 20;
}

function getAverageEducationYears(tier: string): number {
  const years = {
    'Extravagant': 14.5,
    'Very Strong': 13.8,
    'Strong': 13.2,
    'Healthy': 12.5,
    'Developed': 12.8,
    'Emerging': 10.5,
    'Developing': 8.2,
  };
  return years[tier as keyof typeof years] || 11;
}

function getTertiaryEducationRate(tier: string): number {
  const rates = {
    'Extravagant': 55,
    'Very Strong': 48,
    'Strong': 42,
    'Healthy': 38,
    'Developed': 40,
    'Emerging': 25,
    'Developing': 15,
  };
  return rates[tier as keyof typeof rates] || 35;
}

function getVocationalTrainingRate(tier: string): number {
  const rates = {
    'Extravagant': 35,
    'Very Strong': 40,
    'Strong': 45,
    'Healthy': 50,
    'Developed': 45,
    'Emerging': 30,
    'Developing': 20,
  };
  return rates[tier as keyof typeof rates] || 35;
}

function getSkillsGapIndex(tier: string): number {
  const indices = {
    'Extravagant': 85,
    'Very Strong': 80,
    'Strong': 75,
    'Healthy': 70,
    'Developed': 75,
    'Emerging': 60,
    'Developing': 45,
  };
  return indices[tier as keyof typeof indices] || 65;
}

function getLaborProductivityIndex(tier: string): number {
  const indices = {
    'Extravagant': 140,
    'Very Strong': 125,
    'Strong': 115,
    'Healthy': 108,
    'Developed': 110,
    'Emerging': 95,
    'Developing': 80,
  };
  return indices[tier as keyof typeof indices] || 100;
}

function getProductivityGrowthRate(tier: string): number {
  const rates = {
    'Extravagant': 2.5,
    'Very Strong': 3.0,
    'Strong': 3.5,
    'Healthy': 4.0,
    'Developed': 3.0,
    'Emerging': 4.5,
    'Developing': 5.0,
  };
  return rates[tier as keyof typeof rates] || 3.5;
}

function getYouthUnemploymentRate(tier: string, baseUnemploymentRate: number): number {
  const multipliers = {
    'Extravagant': 1.5,
    'Very Strong': 1.8,
    'Strong': 2.0,
    'Healthy': 2.2,
    'Developed': 2.0,
    'Emerging': 2.5,
    'Developing': 3.0,
  };
  const multiplier = multipliers[tier as keyof typeof multipliers] || 2.0;
  return Math.min(baseUnemploymentRate * multiplier, 50); // Cap at 50%
}

function getFemaleParticipationRate(tier: string): number {
  const rates = {
    'Extravagant': 72,
    'Very Strong': 68,
    'Strong': 65,
    'Healthy': 62,
    'Developed': 64,
    'Emerging': 55,
    'Developing': 45,
  };
  return rates[tier as keyof typeof rates] || 60;
}

function getGenderPayGap(tier: string): number {
  const gaps = {
    'Extravagant': 8,
    'Very Strong': 12,
    'Strong': 15,
    'Healthy': 18,
    'Developed': 15,
    'Emerging': 25,
    'Developing': 35,
  };
  return gaps[tier as keyof typeof gaps] || 20;
}

function getUnionizationRate(tier: string): number {
  const rates = {
    'Extravagant': 25,
    'Very Strong': 30,
    'Strong': 35,
    'Healthy': 40,
    'Developed': 35,
    'Emerging': 20,
    'Developing': 15,
  };
  return rates[tier as keyof typeof rates] || 25;
}

function getWorkplaceSafetyIndex(tier: string): number {
  const indices = {
    'Extravagant': 95,
    'Very Strong': 90,
    'Strong': 85,
    'Healthy': 80,
    'Developed': 85,
    'Emerging': 70,
    'Developing': 55,
  };
  return indices[tier as keyof typeof indices] || 75;
}

function getAverageCommutingTime(tier: string): number {
  const times = {
    'Extravagant': 25,
    'Very Strong': 28,
    'Strong': 32,
    'Healthy': 35,
    'Developed': 30,
    'Emerging': 40,
    'Developing': 45,
  };
  return times[tier as keyof typeof times] || 35;
}

function getUrbanParticipationBonus(tier: string): number {
  const bonuses = {
    'Extravagant': 5,
    'Very Strong': 4,
    'Strong': 3,
    'Healthy': 2,
    'Developed': 3,
    'Emerging': 8,
    'Developing': 12,
  };
  return bonuses[tier as keyof typeof bonuses] || 5;
}

function getUrbanUnemploymentAdjustment(tier: string): number {
  const adjustments = {
    'Extravagant': 1,
    'Very Strong': 1,
    'Strong': 0.5,
    'Healthy': 0,
    'Developed': 0.5,
    'Emerging': -2,
    'Developing': -3,
  };
  return adjustments[tier as keyof typeof adjustments] || 0;
}

function getUrbanIncomeMultiplier(tier: string): number {
  const multipliers = {
    'Extravagant': 1.3,
    'Very Strong': 1.25,
    'Strong': 1.2,
    'Healthy': 1.15,
    'Developed': 1.2,
    'Emerging': 1.4,
    'Developing': 1.6,
  };
  return multipliers[tier as keyof typeof multipliers] || 1.25;
}

function getRuralParticipationPenalty(tier: string): number {
  const penalties = {
    'Extravagant': 3,
    'Very Strong': 4,
    'Strong': 5,
    'Healthy': 6,
    'Developed': 5,
    'Emerging': 10,
    'Developing': 15,
  };
  return penalties[tier as keyof typeof penalties] || 7;
}

function getRuralUnemploymentAdjustment(tier: string): number {
  const adjustments = {
    'Extravagant': 1,
    'Very Strong': 1.5,
    'Strong': 2,
    'Healthy': 2.5,
    'Developed': 2,
    'Emerging': 3,
    'Developing': 4,
  };
  return adjustments[tier as keyof typeof adjustments] || 2;
}

function getRuralIncomeMultiplier(tier: string): number {
  const multipliers = {
    'Extravagant': 0.8,
    'Very Strong': 0.75,
    'Strong': 0.7,
    'Healthy': 0.65,
    'Developed': 0.7,
    'Emerging': 0.5,
    'Developing': 0.4,
  };
  return multipliers[tier as keyof typeof multipliers] || 0.65;
}

function getUnemploymentBenefitCoverage(tier: string): number {
  const coverages = {
    'Extravagant': 85,
    'Very Strong': 80,
    'Strong': 75,
    'Healthy': 70,
    'Developed': 75,
    'Emerging': 45,
    'Developing': 25,
  };
  return coverages[tier as keyof typeof coverages] || 60;
}

function getPensionCoverage(tier: string): number {
  const coverages = {
    'Extravagant': 95,
    'Very Strong': 90,
    'Strong': 85,
    'Healthy': 80,
    'Developed': 85,
    'Emerging': 60,
    'Developing': 40,
  };
  return coverages[tier as keyof typeof coverages] || 75;
}

function getHealthInsuranceCoverage(tier: string): number {
  const coverages = {
    'Extravagant': 98,
    'Very Strong': 95,
    'Strong': 90,
    'Healthy': 85,
    'Developed': 90,
    'Emerging': 65,
    'Developing': 40,
  };
  return coverages[tier as keyof typeof coverages] || 80;
}

function getPaidSickLeaveDays(tier: string): number {
  const days = {
    'Extravagant': 15,
    'Very Strong': 12,
    'Strong': 10,
    'Healthy': 8,
    'Developed': 10,
    'Emerging': 5,
    'Developing': 2,
  };
  return days[tier as keyof typeof days] || 8;
}

function getPaidVacationDays(tier: string): number {
  const days = {
    'Extravagant': 30,
    'Very Strong': 25,
    'Strong': 22,
    'Healthy': 20,
    'Developed': 22,
    'Emerging': 15,
    'Developing': 10,
  };
  return days[tier as keyof typeof days] || 20;
}

function getParentalLeaveWeeks(tier: string): number {
  const weeks = {
    'Extravagant': 20,
    'Very Strong': 16,
    'Strong': 14,
    'Healthy': 12,
    'Developed': 14,
    'Emerging': 8,
    'Developing': 4,
  };
  return weeks[tier as keyof typeof weeks] || 12;
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