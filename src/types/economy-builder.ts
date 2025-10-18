// Economy Builder Type Definitions
// Comprehensive type system for the economy builder with atomic components

import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';

// ============================================
// ECONOMY BUILDER STATE
// ============================================

export interface EconomyBuilderState {
  structure: EconomyStructure;
  sectors: SectorConfiguration[];
  laborMarket: LaborConfiguration;
  demographics: DemographicsConfiguration;
  selectedAtomicComponents: EconomicComponentType[];
  isValid: boolean;
  errors: EconomyBuilderErrors;
  validation?: {
    errors: string[];
    warnings: string[];
    isValid: boolean;
  };
  lastUpdated: Date;
  version: string;
}

export interface EconomyStructure {
  economicModel: string;
  primarySectors: string[];
  secondarySectors: string[];
  tertiarySectors: string[];
  totalGDP: number;
  gdpCurrency: string;
  economicTier: 'Developing' | 'Emerging' | 'Developed' | 'Advanced';
  growthStrategy: 'Export-Led' | 'Import-Substitution' | 'Balanced' | 'Innovation-Driven';
  sectors?: SectorConfiguration[];
}

export interface EconomyBuilderErrors {
  structure?: string[];
  sectors?: { [key: string]: string[] };
  labor?: string[];
  demographics?: string[];
  atomicComponents?: string[];
  validation?: string[];
}

// ============================================
// SECTOR CONFIGURATION
// ============================================

export interface SectorConfiguration {
  id: string;
  name: string;
  category: 'Primary' | 'Secondary' | 'Tertiary';
  gdpContribution: number; // percentage
  employmentShare: number; // percentage
  productivity: number; // productivity index
  growthRate: number; // annual growth percentage
  exports: number; // percentage of sector output exported
  imports: number; // percentage of sector consumption imported
  technologyLevel: 'Traditional' | 'Modern' | 'Advanced' | 'Cutting-Edge';
  automation: number; // automation percentage
  regulation: 'Light' | 'Moderate' | 'Heavy' | 'Comprehensive';
  subsidy: number; // government subsidy percentage
  innovation: number; // innovation index 0-100
  sustainability: number; // sustainability score 0-100
  competitiveness: number; // global competitiveness score 0-100
}

export interface SectorImpact {
  sectorId: string;
  economicImpact: number; // multiplier effect
  employmentImpact: number; // jobs created/lost
  taxRevenueImpact: number; // tax revenue generated
  environmentalImpact: number; // environmental score
  socialImpact: number; // social development impact
}

// ============================================
// LABOR CONFIGURATION
// ============================================

export interface LaborConfiguration {
  // Workforce Structure
  totalWorkforce: number;
  laborForceParticipationRate: number; // percentage
  employmentRate: number; // percentage
  unemploymentRate: number; // percentage
  underemploymentRate: number; // percentage
  
  // Demographic Breakdown
  youthUnemploymentRate: number; // ages 15-24
  seniorEmploymentRate: number; // ages 55+
  femaleParticipationRate: number; // percentage
  maleParticipationRate: number; // percentage
  
  // Sector Distribution (percent of workforce)
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
  
  // Employment Types
  employmentType: {
    fullTime: number; // percentage
    partTime: number;
    temporary: number;
    seasonal: number;
    selfEmployed: number;
    gig: number;
    informal: number;
  };
  
  // Working Conditions
  averageWorkweekHours: number;
  averageOvertimeHours: number;
  paidVacationDays: number;
  paidSickLeaveDays: number;
  parentalLeaveWeeks: number;
  
  // Labor Rights & Protections
  unionizationRate: number; // percentage
  collectiveBargainingCoverage: number; // percentage
  minimumWageHourly: number;
  livingWageHourly: number;
  workplaceSafetyIndex: number; // 0-100
  laborRightsScore: number; // 0-100
  workerProtections: {
    jobSecurity: number; // 0-100
    wageProtection: number; // 0-100
    healthSafety: number; // 0-100
    discriminationProtection: number; // 0-100
    collectiveRights: number; // 0-100
  };
}

// ============================================
// DEMOGRAPHICS CONFIGURATION
// ============================================

export interface DemographicsConfiguration {
  // Population Structure
  totalPopulation: number;
  populationGrowthRate: number; // annual percentage
  ageDistribution: {
    under15: number; // percentage
    age15to64: number; // percentage
    over65: number; // percentage
  };
  
  // Geographic Distribution
  urbanRuralSplit: {
    urban: number; // percentage
    rural: number; // percentage
  };
  
  regions: RegionDistribution[];
  
  // Social Indicators
  lifeExpectancy: number; // years
  literacyRate: number; // percentage
  educationLevels: {
    noEducation: number; // percentage
    primary: number; // percentage
    secondary: number; // percentage
    tertiary: number; // percentage
  };
  
  // Migration
  netMigrationRate: number; // per 1000 population
  immigrationRate: number; // per 1000 population
  emigrationRate: number; // per 1000 population
  
  // Health
  infantMortalityRate: number; // per 1000 live births
  maternalMortalityRate: number; // per 100,000 live births
  healthExpenditureGDP: number; // percentage of GDP
  
  // Dependency Ratios
  youthDependencyRatio: number; // (0-14) / (15-64) * 100
  elderlyDependencyRatio: number; // (65+) / (15-64) * 100
  totalDependencyRatio: number; // youth + elderly dependency ratios
}

export interface RegionDistribution {
  name: string;
  population: number;
  populationPercent: number;
  urbanPercent: number;
  economicActivity: number; // percentage of national economic activity
  developmentLevel: 'Underdeveloped' | 'Developing' | 'Developed' | 'Advanced';
}

// ============================================
// INCOME & WEALTH CONFIGURATION
// ============================================

export interface IncomeWealthConfiguration {
  // Aggregate Measures
  nationalMedianIncome: number;
  nationalMeanIncome: number;
  nationalMedianWage: number;
  nationalMeanWage: number;
  
  // Income Distribution by Percentile
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
  
  // Income Classes
  incomeClasses: {
    lowerClass: { percent: number; averageIncome: number; threshold: number };
    lowerMiddleClass: { percent: number; averageIncome: number; threshold: number };
    middleClass: { percent: number; averageIncome: number; threshold: number };
    upperMiddleClass: { percent: number; averageIncome: number; threshold: number };
    upperClass: { percent: number; averageIncome: number; threshold: number };
    wealthyClass: { percent: number; averageIncome: number; threshold: number };
  };
  
  // Inequality Metrics
  giniCoefficient: number; // 0-1 scale
  palmRatio: number; // ratio of top 10% to bottom 40%
  incomeShare: {
    bottom50: number;
    middle40: number;
    top10: number;
    top1: number;
  };
  
  // Poverty Metrics
  povertyLine: number;
  povertyRate: number; // percentage
  extremePovertyRate: number; // percentage
  childPovertyRate: number;
  seniorPovertyRate: number;
  
  // Wage Data by Sector
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
  
  // Gender and Demographic Gaps
  genderPayGap: number; // percentage
  racialWageGap: number; // percentage (if applicable)
  urbanRuralIncomeGap: number; // percentage
  
  // Social Mobility
  socialMobilityIndex: number; // 0-100
  interGenerationalElasticity: number; // 0-1, lower is better
  economicMobilityRate: number; // percentage moving up quintiles
}

// ============================================
// TRADE CONFIGURATION
// ============================================

export interface TradeConfiguration {
  // Trade Flows
  totalExports: number; // USD
  totalImports: number; // USD
  tradeBalance: number; // USD
  exportsGDPPercent: number; // percentage
  importsGDPPercent: number; // percentage
  
  // Trade Policy
  tradeOpenness: 'Closed' | 'Limited' | 'Moderate' | 'Open' | 'Very Open';
  averageTariffRate: number; // percentage
  nonTariffBarriers: number; // index 0-100
  tradeAgreements: string[]; // list of trade agreements
  
  // Export/Import Composition
  exportComposition: {
    primary: number; // percentage
    manufactured: number; // percentage
    services: number; // percentage
    highTech: number; // percentage
  };
  
  importComposition: {
    primary: number; // percentage
    manufactured: number; // percentage
    services: number; // percentage
    energy: number; // percentage
  };
  
  // Trade Partners
  majorExportDestinations: TradePartner[];
  majorImportSources: TradePartner[];
  
  // Competitiveness
  tradeCompetitivenessIndex: number; // 0-100
  exportDiversificationIndex: number; // 0-100
  importDependencyIndex: number; // 0-100
}

export interface TradePartner {
  country: string;
  share: number; // percentage of total trade
  tradeValue: number; // USD
  relationship: 'Strategic' | 'Important' | 'Standard' | 'Limited';
}

// ============================================
// PRODUCTIVITY CONFIGURATION
// ============================================

export interface ProductivityConfiguration {
  // Labor Productivity
  laborProductivity: number; // GDP per worker
  laborProductivityGrowth: number; // annual percentage
  capitalProductivity: number; // GDP per unit of capital
  totalFactorProductivity: number; // index
  
  // Technology Adoption
  technologyAdoptionIndex: number; // 0-100
  digitalizationIndex: number; // 0-100
  automationLevel: number; // percentage
  
  // Innovation
  innovationIndex: number; // 0-100
  rdInvestmentGDP: number; // percentage
  patentApplications: number; // per capita
  technologyTransfer: number; // index
  
  // Infrastructure
  infrastructureQuality: number; // 0-100
  logisticsPerformance: number; // 0-100
  connectivityIndex: number; // 0-100
  
  // Human Capital
  humanCapitalIndex: number; // 0-100
  skillsMatch: number; // percentage
  trainingInvestment: number; // percentage of GDP
}

// ============================================
// BUSINESS ENVIRONMENT
// ============================================

export interface BusinessEnvironmentConfiguration {
  // Ease of Doing Business
  easeOfDoingBusiness: number; // 0-100
  businessStartupTime: number; // days
  businessStartupCost: number; // percentage of income per capita
  businessRegulation: 'Light' | 'Moderate' | 'Heavy' | 'Comprehensive';
  
  // Market Structure
  marketConcentration: number; // index
  competitionLevel: number; // 0-100
  marketBarriers: number; // 0-100
  
  // Financial System
  financialDevelopment: number; // 0-100
  creditAvailability: number; // 0-100
  bankingEfficiency: number; // 0-100
  capitalMarketDevelopment: number; // 0-100
  
  // Corruption and Governance
  corruptionPerceptionIndex: number; // 0-100
  regulatoryQuality: number; // 0-100
  ruleOfLaw: number; // 0-100
  governmentEffectiveness: number; // 0-100
}

// ============================================
// ECONOMIC HEALTH METRICS
// ============================================

export interface EconomicHealthMetrics {
  // Overall Health
  economicHealthScore: number; // 0-100
  sustainabilityScore: number; // 0-100
  resilienceScore: number; // 0-100
  competitivenessScore: number; // 0-100
  
  // Growth Indicators
  gdpGrowthRate: number; // annual percentage
  potentialGrowthRate: number; // annual percentage
  growthSustainability: number; // 0-100
  
  // Stability Indicators
  inflationRate: number; // annual percentage
  inflationVolatility: number; // standard deviation
  exchangeRateStability: number; // 0-100
  fiscalStability: number; // 0-100
  
  // Risk Assessment
  economicRiskLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  externalVulnerability: number; // 0-100
  domesticVulnerability: number; // 0-100
  systemicRisk: number; // 0-100
}

// ============================================
// ATOMIC COMPONENT IMPACT
// ============================================

export interface AtomicComponentImpact {
  componentType: EconomicComponentType;
  economicImpact: {
    gdpImpact: number; // multiplier
    growthImpact: number; // percentage change
    employmentImpact: number; // percentage change
    productivityImpact: number; // percentage change
  };
  sectorImpact: Record<string, number>; // sector-specific multipliers
  taxImpact: {
    revenueImpact: number; // percentage change
    optimalRates: {
      corporate: number;
      income: number;
      consumption: number;
    };
  };
  governmentImpact: {
    spendingNeeds: number; // percentage change
    capacityRequirements: number; // 0-100
    policyAlignment: number; // 0-100
  };
}

// ============================================
// CROSS-BUILDER INTEGRATION
// ============================================

export interface CrossBuilderIntegration {
  // Government Integration
  governmentSynergies: {
    componentType: string; // Government component type
    synergyStrength: number; // 0-100
    description: string;
  }[];
  governmentConflicts: {
    componentType: string;
    conflictStrength: number; // 0-100
    description: string;
  }[];
  
  // Tax Integration
  taxRecommendations: {
    taxType: string;
    recommendedRate: number;
    rationale: string;
    impact: number; // percentage change
  }[];
  
  // Unified Effectiveness
  unifiedEffectiveness: number; // 0-100
  optimizationSuggestions: string[];
  riskFactors: string[];
}

// ============================================
// VALIDATION & CONSTRAINTS
// ============================================

export interface EconomyValidationRules {
  // Sector Constraints
  sectorSumMustEqual100: boolean;
  maxSectorContribution: number; // percentage
  minSectorContribution: number; // percentage
  
  // Labor Constraints
  participationRateRange: [number, number]; // [min, max]
  unemploymentRateRange: [number, number]; // [min, max]
  employmentTypesMustSumTo100: boolean;
  
  // Demographic Constraints
  ageDistributionMustSumTo100: boolean;
  urbanRuralMustSumTo100: boolean;
  populationGrowthRange: [number, number]; // [min, max] percentage
  
  // Economic Constraints
  gdpGrowthRange: [number, number]; // [min, max] percentage
  inflationRange: [number, number]; // [min, max] percentage
  giniRange: [number, number]; // [min, max]
  
  // Atomic Component Constraints
  maxAtomicComponents: number;
  minAtomicComponents: number;
  maxConflictsAllowed: number;
  minSynergiesRequired: number;
}

// ============================================
// ARCHETYPE TEMPLATES
// ============================================

export interface EconomicArchetype {
  id: string;
  name: string;
  description: string;
  category: 'Developed' | 'Emerging' | 'Developing' | 'Transitional';
  
  // Component Configuration
  atomicComponents: EconomicComponentType[];
  
  // Sector Configuration
  sectorTemplate: Partial<SectorConfiguration>[];
  
  // Labor Configuration
  laborTemplate: Partial<LaborConfiguration>;
  
  // Trade Configuration
  tradeTemplate: Partial<TradeConfiguration>;
  
  // Typical Metrics
  typicalMetrics: {
    gdpPerCapita: number;
    growthRate: number;
    unemploymentRate: number;
    inflationRate: number;
    giniCoefficient: number;
  };
  
  // Examples
  realWorldExamples: string[];
  effectiveness: number; // 0-100
}

// ============================================
// UTILITY TYPES
// ============================================

export type EconomyBuilderTab = 
  | 'atomicComponents'
  | 'sectors'
  | 'labor'
  | 'demographics'
  | 'income'
  | 'trade'
  | 'productivity'
  | 'business'
  | 'preview';

export type EconomyBuilderMode = 'create' | 'edit' | 'view';

export interface EconomyBuilderConfig {
  mode: EconomyBuilderMode;
  allowAtomicComponents: boolean;
  maxAtomicComponents: number;
  allowAdvancedSettings: boolean;
  enableCrossBuilderSync: boolean;
  enableRealTimeValidation: boolean;
  showEffectivenessPreview: boolean;
}

// ============================================
// EXPORT TYPES
// Note: All types are already exported via 'export interface' above
// ============================================
