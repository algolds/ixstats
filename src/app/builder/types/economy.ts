// Comprehensive Economy Builder Types
// Inspired by CAPHIRIA MASTER DATA economic structure

import type { ComponentType } from "~/types/government";

// ==================== EMPLOYMENT & LABOR ====================

export interface EmploymentData {
  // Overall metrics
  totalWorkforce: number;
  laborForceParticipationRate: number; // percent
  employmentRate: number; // percent
  unemploymentRate: number; // percent
  underemploymentRate: number; // percent

  // Demographic breakdown
  youthUnemploymentRate: number; // ages 15-24
  seniorEmploymentRate: number; // ages 55+
  femaleParticipationRate: number; // percent
  maleParticipationRate: number; // percent

  // Sector distribution (percent of workforce)
  sectorDistribution: {
    agriculture: number;
    mining: number;
    manufacturing: number;
    construction: number;
    utilities: number;
    wholesale: number;
    retail: number;
    transportation: number;
    information: number;
    finance: number;
    professional: number;
    education: number;
    healthcare: number;
    hospitality: number;
    government: number;
    other: number;
  };

  // Employment type breakdown
  employmentType: {
    fullTime: number; // percent
    partTime: number;
    temporary: number;
    seasonal: number;
    selfEmployed: number;
    gig: number;
    informal: number;
  };

  // Working conditions
  averageWorkweekHours: number;
  averageOvertimeHours: number;
  paidVacationDays: number;
  paidSickLeaveDays: number;
  parentalLeaveWeeks: number;

  // Labor rights & protections
  unionizationRate: number; // percent
  collectiveBargainingCoverage: number; // percent
  minimumWageHourly: number;
  livingWageHourly: number;
  workplaceSafetyIndex: number; // 0-100
  laborRightsScore: number; // 0-100
}

// ==================== INCOME & WAGES ====================

export interface IncomeData {
  // Aggregate measures
  nationalMedianIncome: number;
  nationalMeanIncome: number;
  nationalMedianWage: number;
  nationalMeanWage: number;

  // Income distribution by percentile
  incomePercentiles: {
    p10: number;
    p25: number;
    p50: number; // median
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    p99_9: number;
  };

  // Income by class (percent distribution)
  incomeClasses: {
    lowerClass: { percent: number; averageIncome: number; threshold: number };
    lowerMiddleClass: { percent: number; averageIncome: number; threshold: number };
    middleClass: { percent: number; averageIncome: number; threshold: number };
    upperMiddleClass: { percent: number; averageIncome: number; threshold: number };
    upperClass: { percent: number; averageIncome: number; threshold: number };
    wealthyClass: { percent: number; averageIncome: number; threshold: number };
  };

  // Inequality metrics
  giniCoefficient: number; // 0-1 scale
  palmRatio: number; // ratio of top 10% to bottom 40%
  incomeShare: {
    bottom50: number;
    middle40: number;
    top10: number;
    top1: number;
  };

  // Poverty metrics
  povertyLine: number;
  povertyRate: number; // percent
  extremePovertyRate: number; // percent
  childPovertyRate: number;
  seniorPovertyRate: number;

  // Wage data by sector
  averageWageBySector: {
    agriculture: number;
    mining: number;
    manufacturing: number;
    construction: number;
    utilities: number;
    wholesale: number;
    retail: number;
    transportation: number;
    information: number;
    finance: number;
    professional: number;
    education: number;
    healthcare: number;
    hospitality: number;
    government: number;
  };

  // Gender and demographic gaps
  genderPayGap: number; // percent
  racialWageGap: number; // percent (if applicable)
  urbanRuralIncomeGap: number; // percent

  // Social mobility
  socialMobilityIndex: number; // 0-100
  interGenerationalElasticity: number; // 0-1, lower is better
  economicMobilityRate: number; // percent moving up quintiles
}

// ==================== ECONOMIC SECTORS ====================

export interface SectorData {
  // GDP contribution by sector (percent)
  sectorGDPContribution: {
    agriculture: number;
    mining: number;
    manufacturing: number;
    construction: number;
    utilities: number;
    wholesale: number;
    retail: number;
    transportation: number;
    information: number;
    finance: number;
    professional: number;
    education: number;
    healthcare: number;
    hospitality: number;
    government: number;
    other: number;
  };

  // Sector growth rates (annual percent change)
  sectorGrowthRates: {
    agriculture: number;
    manufacturing: number;
    services: number;
    technology: number;
    finance: number;
    construction: number;
    retail: number;
  };

  // Economic structure
  economicStructure: {
    primarySector: number; // agriculture, mining, extraction
    secondarySector: number; // manufacturing, construction
    tertiarySector: number; // services
    quaternarySector: number; // knowledge, research, IT
  };

  // Productivity by sector (output per worker, indexed to 100)
  sectorProductivity: {
    agriculture: number;
    manufacturing: number;
    services: number;
    technology: number;
    overall: number;
  };

  // Innovation metrics
  researchDevelopmentGDPPercent: number;
  patentsPerCapita: number;
  techAdoptionIndex: number; // 0-100
  digitalEconomyShare: number; // percent of GDP
}

// ==================== TRADE & INTERNATIONAL ====================

export interface TradeData {
  // Trade volumes
  totalExports: number;
  totalImports: number;
  tradeBalance: number;
  exportsGDPPercent: number;
  importsGDPPercent: number;

  // Trade composition
  exportComposition: {
    goods: number; // percent
    services: number;
    commodities: number;
    manufactured: number;
    technology: number;
    agricultural: number;
  };

  importComposition: {
    goods: number; // percent
    services: number;
    commodities: number;
    manufactured: number;
    technology: number;
    agricultural: number;
  };

  // Major trading partners (top 5)
  tradingPartners: Array<{
    country: string;
    exportsTo: number;
    importsFrom: number;
    tradeBalance: number;
  }>;

  // Trade agreements
  freeTradeAgreements: number;
  customsUnionMembership: boolean;
  wtoMembership: boolean;

  // International metrics
  foreignDirectInvestmentInflow: number;
  foreignDirectInvestmentOutflow: number;
  foreignExchangeReserves: number;
  currentAccountBalance: number;
  currentAccountGDPPercent: number;

  // Trade openness
  tradeOpennessIndex: number; // (exports + imports) / GDP
  economicComplexityIndex: number; // -3 to 3 scale
  exportDiversificationIndex: number; // 0-1 scale
}

// ==================== PRODUCTIVITY & COMPETITIVENESS ====================

export interface ProductivityData {
  // Labor productivity
  laborProductivityIndex: number; // GDP per hour worked, base 100
  laborProductivityGrowthRate: number; // annual percent
  multifactorProductivityGrowth: number; // annual percent

  // Capital productivity
  capitalProductivity: number; // output per unit of capital
  capitalIntensity: number; // capital per worker
  returnOnInvestedCapital: number; // percent

  // Efficiency metrics
  energyEfficiency: number; // GDP per unit of energy
  resourceProductivity: number; // GDP per ton of material

  // Competitiveness
  globalCompetitivenessIndex: number; // 0-100
  innovationIndex: number; // 0-100
  infrastructureQualityIndex: number; // 0-100
  institutionalQualityIndex: number; // 0-100

  // Human capital
  averageEducationYears: number;
  tertiaryEducationRate: number; // percent
  skillsIndex: number; // 0-100
  brainDrainIndex: number; // higher is worse
}

// ==================== BUSINESS & INVESTMENT ====================

export interface BusinessData {
  // Business demographics
  totalBusinesses: number;
  smallBusinesses: number; // <50 employees
  mediumBusinesses: number; // 50-250
  largeBusinesses: number; // >250
  startupFormationRate: number; // per 1000 people
  businessFailureRate: number; // percent

  // Business environment
  easeOfDoingBusinessRank: number;
  timeToStartBusiness: number; // days
  costToStartBusiness: number; // percent of income per capita
  corporateRegistrationRate: number;

  // Investment climate
  domesticInvestmentGDPPercent: number;
  foreignInvestmentGDPPercent: number;
  grossCapitalFormation: number;
  investmentGrowthRate: number;

  // Credit and finance
  domesticCreditToPrivateSector: number; // percent of GDP
  interestRateCommercial: number;
  interestRateSavings: number;
  bankLendingRate: number;

  // Entrepreneurship
  entrepreneurshipRate: number; // percent of adults
  venturCapitalAvailability: number; // 0-100 scale
  accessToFinanceScore: number; // 0-100
  regulatoryQualityIndex: number; // 0-100
}

// ==================== ECONOMIC HEALTH & STABILITY ====================

export interface EconomicHealthData {
  // Growth metrics
  gdpGrowthRateCurrent: number;
  gdpGrowthRate5YearAverage: number;
  potentialGDPGrowthRate: number;
  outputGap: number; // percent

  // Price stability
  inflationRateCurrent: number;
  inflationRate5YearAverage: number;
  inflationTargetRate: number;
  coreInflationRate: number;
  priceStabilityIndex: number; // 0-100

  // Economic stability
  economicVolatilityIndex: number; // 0-100, lower is better
  recessionRiskIndex: number; // 0-100
  financialStabilityIndex: number; // 0-100

  // Fiscal health
  budgetBalanceGDPPercent: number;
  structuralBalanceGDPPercent: number;
  publicDebtGDPPercent: number;
  debtSustainabilityScore: number; // 0-100

  // External health
  externalDebtGDPPercent: number;
  debtServiceRatio: number; // percent of exports
  reserveCoverMonths: number; // months of imports

  // Overall health score
  economicHealthScore: number; // 0-100, composite metric
  sustainabilityScore: number; // 0-100, long-term viability
  resilienceScore: number; // 0-100, shock absorption capacity
}

// ==================== COMPREHENSIVE ECONOMY DATA ====================

export interface ComprehensiveEconomyData {
  employment: EmploymentData;
  income: IncomeData;
  sectors: SectorData;
  trade: TradeData;
  productivity: ProductivityData;
  business: BusinessData;
  health: EconomicHealthData;

  // Meta information
  dataQuality: number; // 0-100 confidence score
  lastUpdated: Date;
  sourceReliability: "high" | "medium" | "low";
  coveragePeriod: {
    start: Date;
    end: Date;
  };
}

// ==================== INTEGRATION TYPES ====================

export interface EconomyBuilderState {
  economyData: Partial<ComprehensiveEconomyData>;
  activeView:
    | "overview"
    | "employment"
    | "income"
    | "sectors"
    | "trade"
    | "productivity"
    | "business"
    | "health";
  showAdvanced: boolean;
  atomicComponents: ComponentType[];
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export interface EconomyMetric {
  id: string;
  label: string;
  value: number | string;
  unit: string;
  trend?: "up" | "down" | "neutral";
  change?: number;
  compareValue?: number;
  description?: string;
  icon?: React.ComponentType;
  color?: string;
  category: "employment" | "income" | "sectors" | "trade" | "productivity" | "business" | "health";
}

export interface EconomySectionProps {
  inputs: any;
  onInputsChange: (inputs: any) => void;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
  referenceCountry?: any;
  className?: string;
  countryId?: string;
  nominalGDP: number;
  totalPopulation: number;
}

// ==================== TAX SYSTEM CONSIDERATION ====================

/**
 * RECOMMENDATION ON TAX SYSTEM PLACEMENT:
 *
 * Based on analysis of the CAPHIRIA structure and modern economic modeling best practices:
 *
 * OPTION 1: Keep Tax System Separate (RECOMMENDED)
 * - Taxes are a fiscal/government policy tool, not purely economic
 * - Allows for independent tax policy experimentation
 * - Clearer separation of concerns: Economy = outcomes, Fiscal = inputs
 * - Better aligns with real-world government structure (Treasury/Finance Ministry separate from Economic Development)
 *
 * OPTION 2: Integrate Tax as Economy Sub-System
 * - Tax revenue directly impacts economy
 * - Could show real-time tax impact on economic metrics
 * - More holistic economic view
 * - May become overwhelming with too much data in one section
 *
 * HYBRID APPROACH (IMPLEMENTED):
 * - Keep FiscalSystemSection for detailed tax configuration
 * - Include tax impact metrics and visualizations in EconomySection
 * - Use atomic components to bridge both systems
 * - Show tax-economy relationships without duplicating controls
 */

export interface TaxEconomyIntegration {
  // Tax impacts on economy (read-only in Economy section)
  effectiveTaxRatePersonal: number;
  effectiveTaxRateCorporate: number;
  taxBurdenGDPPercent: number;
  taxWedge: number; // difference between labor cost and take-home pay

  // Economic effects of taxation
  taxCompetitivenessIndex: number; // 0-100
  taxComplexityScore: number; // 0-100, lower is better
  taxComplianceRate: number; // percent
  taxRevenueEfficiency: number; // revenue collected vs potential

  // Distributional effects
  taxProgressivityIndex: number; // 0-1, higher is more progressive
  taxIncidenceByIncome: {
    bottom20: number; // effective tax rate
    middle60: number;
    top20: number;
    top1: number;
  };
}

export { type ComponentType };
