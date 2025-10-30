/**
 * Economy Builder Type Definitions
 *
 * Comprehensive type system for the economy builder with atomic components.
 * Provides complete economic modeling capabilities including structure, sectors,
 * labor markets, demographics, and cross-builder integration.
 *
 * @module economy-builder
 */

import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";

// ============================================
// ECONOMY BUILDER STATE
// ============================================

/**
 * EconomyBuilderState - Complete state management for the economy builder
 *
 * Central state container that manages all aspects of economy construction,
 * including validation, errors, and cross-builder integration. This is the
 * primary interface for economy builder operations.
 *
 * @interface EconomyBuilderState
 * @property {EconomyStructure} structure - Core economic structure and model configuration
 * @property {SectorConfiguration[]} sectors - Detailed sector configurations and metrics
 * @property {LaborConfiguration} laborMarket - Labor market structure and employment data
 * @property {DemographicsConfiguration} demographics - Population and demographic information
 * @property {EconomicComponentType[]} selectedAtomicComponents - Active atomic economic components
 * @property {boolean} isValid - Overall validation status of the economy configuration
 * @property {EconomyBuilderErrors} errors - Categorized error messages by section
 * @property {Object} [validation] - Detailed validation results
 * @property {string[]} [validation.errors] - Critical validation errors
 * @property {string[]} [validation.warnings] - Non-critical validation warnings
 * @property {boolean} [validation.isValid] - Comprehensive validation status
 * @property {Date} lastUpdated - Timestamp of last state modification
 * @property {string} version - Schema version for migration compatibility
 *
 * @example
 * ```ts
 * const economyState: EconomyBuilderState = {
 *   structure: { economicModel: 'Mixed', ... },
 *   sectors: [{ id: 'tech', name: 'Technology', ... }],
 *   laborMarket: { totalWorkforce: 1000000, ... },
 *   demographics: { totalPopulation: 2000000, ... },
 *   selectedAtomicComponents: ['FREE_MARKET', 'TECH_HUB'],
 *   isValid: true,
 *   errors: {},
 *   lastUpdated: new Date(),
 *   version: '1.0.0'
 * };
 * ```
 */
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

/**
 * EconomyStructure - High-level economic framework definition
 *
 * Defines the fundamental structure and classification of an economy,
 * including economic model, sectoral composition, and growth strategy.
 * Used as the foundation for all economic calculations.
 *
 * @interface EconomyStructure
 * @property {string} economicModel - Economic system type (e.g., 'Market', 'Mixed', 'Planned')
 * @property {string[]} primarySectors - Primary sector activities (agriculture, mining, extraction)
 * @property {string[]} secondarySectors - Secondary sector activities (manufacturing, construction)
 * @property {string[]} tertiarySectors - Tertiary sector activities (services, finance, technology)
 * @property {number} totalGDP - Total Gross Domestic Product in base currency
 * @property {string} gdpCurrency - Currency code for GDP calculations (e.g., 'USD', 'EUR')
 * @property {'Developing'|'Emerging'|'Developed'|'Advanced'} economicTier - Development classification
 * @property {'Export-Led'|'Import-Substitution'|'Balanced'|'Innovation-Driven'} growthStrategy - Primary growth approach
 * @property {SectorConfiguration[]} [sectors] - Optional detailed sector configurations
 *
 * @example
 * ```ts
 * const structure: EconomyStructure = {
 *   economicModel: 'Mixed Economy',
 *   primarySectors: ['Agriculture', 'Mining'],
 *   secondarySectors: ['Manufacturing', 'Construction'],
 *   tertiarySectors: ['Technology', 'Finance', 'Tourism'],
 *   totalGDP: 500000000000,
 *   gdpCurrency: 'USD',
 *   economicTier: 'Developed',
 *   growthStrategy: 'Innovation-Driven'
 * };
 * ```
 */
export interface EconomyStructure {
  economicModel: string;
  primarySectors: string[];
  secondarySectors: string[];
  tertiarySectors: string[];
  totalGDP: number;
  gdpCurrency: string;
  economicTier: "Developing" | "Emerging" | "Developed" | "Advanced";
  growthStrategy: "Export-Led" | "Import-Substitution" | "Balanced" | "Innovation-Driven";
  sectors?: SectorConfiguration[];
}

/**
 * EconomyBuilderErrors - Categorized validation errors
 *
 * Organizes validation errors by section for targeted error display
 * and user guidance. Each category can contain multiple error messages.
 *
 * @interface EconomyBuilderErrors
 * @property {string[]} [structure] - Errors in economic structure configuration
 * @property {Object} [sectors] - Sector-specific errors keyed by sector ID
 * @property {string[]} [labor] - Labor market configuration errors
 * @property {string[]} [demographics] - Demographic data validation errors
 * @property {string[]} [atomicComponents] - Atomic component compatibility errors
 * @property {string[]} [validation] - General validation errors
 *
 * @example
 * ```ts
 * const errors: EconomyBuilderErrors = {
 *   structure: ['GDP must be positive'],
 *   sectors: {
 *     'tech-sector': ['Employment share exceeds 100%']
 *   },
 *   labor: ['Total workforce exceeds population']
 * };
 * ```
 */
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

/**
 * SectorConfiguration - Detailed economic sector definition
 *
 * Comprehensive configuration for individual economic sectors including
 * performance metrics, technology levels, and policy settings. Each sector
 * contributes to overall economic calculations.
 *
 * @interface SectorConfiguration
 * @property {string} id - Unique sector identifier
 * @property {string} name - Display name of the sector
 * @property {'Primary'|'Secondary'|'Tertiary'} category - Sectoral classification
 * @property {number} gdpContribution - Percentage of total GDP (0-100)
 * @property {number} employmentShare - Percentage of total employment (0-100)
 * @property {number} productivity - Productivity index relative to national average
 * @property {number} growthRate - Annual growth rate percentage
 * @property {number} exports - Percentage of output exported (0-100)
 * @property {number} imports - Percentage of consumption imported (0-100)
 * @property {'Traditional'|'Modern'|'Advanced'|'Cutting-Edge'} technologyLevel - Technology adoption level
 * @property {number} automation - Automation percentage (0-100)
 * @property {'Light'|'Moderate'|'Heavy'|'Comprehensive'} regulation - Regulatory intensity
 * @property {number} subsidy - Government subsidy percentage (0-100)
 * @property {number} innovation - Innovation index score (0-100)
 * @property {number} sustainability - Environmental sustainability score (0-100)
 * @property {number} competitiveness - Global competitiveness score (0-100)
 *
 * @example
 * ```ts
 * const techSector: SectorConfiguration = {
 *   id: 'technology',
 *   name: 'Technology & Innovation',
 *   category: 'Tertiary',
 *   gdpContribution: 25,
 *   employmentShare: 15,
 *   productivity: 180,
 *   growthRate: 8.5,
 *   exports: 60,
 *   imports: 30,
 *   technologyLevel: 'Cutting-Edge',
 *   automation: 75,
 *   regulation: 'Light',
 *   subsidy: 5,
 *   innovation: 95,
 *   sustainability: 80,
 *   competitiveness: 90
 * };
 * ```
 */
export interface SectorConfiguration {
  id: string;
  name: string;
  category: "Primary" | "Secondary" | "Tertiary";
  gdpContribution: number; // percentage
  employmentShare: number; // percentage
  productivity: number; // productivity index
  growthRate: number; // annual growth percentage
  exports: number; // percentage of sector output exported
  imports: number; // percentage of sector consumption imported
  technologyLevel: "Traditional" | "Modern" | "Advanced" | "Cutting-Edge";
  automation: number; // automation percentage
  regulation: "Light" | "Moderate" | "Heavy" | "Comprehensive";
  subsidy: number; // government subsidy percentage
  innovation: number; // innovation index 0-100
  sustainability: number; // sustainability score 0-100
  competitiveness: number; // global competitiveness score 0-100
}

/**
 * SectorImpact - Calculated impact metrics for a sector
 *
 * Quantifies the multidimensional impact of a sector on the economy,
 * environment, and society. Used for policy analysis and optimization.
 *
 * @interface SectorImpact
 * @property {string} sectorId - Reference to the sector being analyzed
 * @property {number} economicImpact - Economic multiplier effect (1.0 = neutral)
 * @property {number} employmentImpact - Net jobs created/destroyed
 * @property {number} taxRevenueImpact - Tax revenue contribution in base currency
 * @property {number} environmentalImpact - Environmental impact score (0-100, higher is better)
 * @property {number} socialImpact - Social development impact score (0-100)
 *
 * @example
 * ```ts
 * const impact: SectorImpact = {
 *   sectorId: 'technology',
 *   economicImpact: 1.8,
 *   employmentImpact: 50000,
 *   taxRevenueImpact: 15000000000,
 *   environmentalImpact: 75,
 *   socialImpact: 85
 * };
 * ```
 */
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

/**
 * LaborConfiguration - Comprehensive labor market structure
 *
 * Defines the complete labor market including workforce composition,
 * employment types, working conditions, and labor protections. This is
 * one of the most detailed configuration interfaces in the system.
 *
 * @interface LaborConfiguration
 *
 * Workforce Structure:
 * @property {number} totalWorkforce - Total number of workers in the labor force
 * @property {number} laborForceParticipationRate - Percentage of working-age population employed or seeking work (0-100)
 * @property {number} employmentRate - Percentage of labor force currently employed (0-100)
 * @property {number} unemploymentRate - Percentage of labor force unemployed (0-100)
 * @property {number} underemploymentRate - Percentage working below capacity (0-100)
 *
 * Demographic Breakdown:
 * @property {number} youthUnemploymentRate - Unemployment rate for ages 15-24 (0-100)
 * @property {number} seniorEmploymentRate - Employment rate for ages 55+ (0-100)
 * @property {number} femaleParticipationRate - Female labor force participation (0-100)
 * @property {number} maleParticipationRate - Male labor force participation (0-100)
 *
 * Constraint: employmentRate + unemploymentRate should equal 100
 * Constraint: totalWorkforce should not exceed working-age population
 *
 * @example
 * ```ts
 * const laborConfig: LaborConfiguration = {
 *   totalWorkforce: 5000000,
 *   laborForceParticipationRate: 68,
 *   employmentRate: 94,
 *   unemploymentRate: 6,
 *   underemploymentRate: 8,
 *   youthUnemploymentRate: 12,
 *   seniorEmploymentRate: 35,
 *   femaleParticipationRate: 62,
 *   maleParticipationRate: 74,
 *   // ... additional fields
 * };
 * ```
 */
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
  averageAnnualIncome: number;

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

/**
 * DemographicsConfiguration - Population and demographic metrics
 *
 * Comprehensive demographic data including population structure, geographic
 * distribution, social indicators, migration patterns, and health metrics.
 * Critical for labor force calculations and social policy planning.
 *
 * @interface DemographicsConfiguration
 *
 * Population Structure:
 * @property {number} totalPopulation - Total population count
 * @property {number} populationGrowthRate - Annual growth rate percentage
 * @property {Object} ageDistribution - Age distribution breakdown
 * @property {number} ageDistribution.under15 - Percentage under 15 years (0-100)
 * @property {number} ageDistribution.age15to64 - Percentage 15-64 years (0-100)
 * @property {number} ageDistribution.over65 - Percentage over 65 years (0-100)
 *
 * Constraint: Age distribution percentages must sum to 100
 * Constraint: Total population should align with labor force calculations
 *
 * @example
 * ```ts
 * const demographics: DemographicsConfiguration = {
 *   totalPopulation: 10000000,
 *   populationGrowthRate: 1.2,
 *   ageDistribution: {
 *     under15: 22,
 *     age15to64: 68,
 *     over65: 10
 *   },
 *   urbanRuralSplit: { urban: 75, rural: 25 },
 *   // ... additional fields
 * };
 * ```
 */
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
  developmentLevel: "Underdeveloped" | "Developing" | "Developed" | "Advanced";
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
  tradeOpenness: "Closed" | "Limited" | "Moderate" | "Open" | "Very Open";
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
  relationship: "Strategic" | "Important" | "Standard" | "Limited";
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
  businessRegulation: "Light" | "Moderate" | "Heavy" | "Comprehensive";

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

  // Labor Market Indicators
  unemploymentRate: number; // percentage

  // Innovation Indicators
  innovationIndex: number; // 0-100
  productivityIndex: number; // 0-100

  // Risk Assessment
  economicRiskLevel: "Low" | "Medium" | "High" | "Very High";
  externalVulnerability: number; // 0-100
  domesticVulnerability: number; // 0-100
  systemicRisk: number; // 0-100
}

// ============================================
// ATOMIC COMPONENT IMPACT
// ============================================

/**
 * AtomicComponentImpact - Impact analysis for atomic economic components
 *
 * Calculates the comprehensive economic, fiscal, and policy impact of
 * individual atomic components. Used for cross-builder integration and
 * effectiveness calculations.
 *
 * @interface AtomicComponentImpact
 * @property {EconomicComponentType} componentType - Type of atomic component being analyzed
 * @property {Object} economicImpact - Direct economic effects
 * @property {number} economicImpact.gdpImpact - GDP multiplier effect (1.0 = neutral)
 * @property {number} economicImpact.growthImpact - Annual growth rate change (percentage points)
 * @property {number} economicImpact.employmentImpact - Employment percentage change
 * @property {number} economicImpact.productivityImpact - Productivity percentage change
 * @property {Record<string, number>} sectorImpact - Sector-specific multipliers by sector ID
 * @property {Object} taxImpact - Tax system implications
 * @property {number} taxImpact.revenueImpact - Tax revenue percentage change
 * @property {Object} taxImpact.optimalRates - Recommended tax rates
 * @property {number} taxImpact.optimalRates.corporate - Optimal corporate tax rate (0-100)
 * @property {number} taxImpact.optimalRates.income - Optimal income tax rate (0-100)
 * @property {number} taxImpact.optimalRates.consumption - Optimal consumption tax rate (0-100)
 * @property {Object} governmentImpact - Government capacity requirements
 * @property {number} governmentImpact.spendingNeeds - Government spending percentage change
 * @property {number} governmentImpact.capacityRequirements - Institutional capacity needed (0-100)
 * @property {number} governmentImpact.policyAlignment - Alignment with component goals (0-100)
 *
 * @example
 * ```ts
 * const componentImpact: AtomicComponentImpact = {
 *   componentType: 'FREE_MARKET',
 *   economicImpact: {
 *     gdpImpact: 1.15,
 *     growthImpact: 0.8,
 *     employmentImpact: -2.5,
 *     productivityImpact: 12
 *   },
 *   sectorImpact: {
 *     'technology': 1.3,
 *     'finance': 1.25,
 *     'manufacturing': 1.1
 *   },
 *   taxImpact: {
 *     revenueImpact: -5,
 *     optimalRates: { corporate: 18, income: 25, consumption: 12 }
 *   },
 *   governmentImpact: {
 *     spendingNeeds: -8,
 *     capacityRequirements: 40,
 *     policyAlignment: 85
 *   }
 * };
 * ```
 */
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

/**
 * CrossBuilderIntegration - Integration analysis across builders
 *
 * Analyzes synergies, conflicts, and optimization opportunities when
 * combining economy, government, and tax systems. Critical for unified
 * effectiveness calculations and builder recommendations.
 *
 * @interface CrossBuilderIntegration
 * @property {Array} governmentSynergies - Beneficial government component interactions
 * @property {string} governmentSynergies[].componentType - Government component type
 * @property {number} governmentSynergies[].synergyStrength - Synergy strength (0-100)
 * @property {string} governmentSynergies[].description - Explanation of synergy
 * @property {Array} governmentConflicts - Government component conflicts
 * @property {string} governmentConflicts[].componentType - Conflicting component type
 * @property {number} governmentConflicts[].conflictStrength - Conflict severity (0-100)
 * @property {string} governmentConflicts[].description - Explanation of conflict
 * @property {Array} taxRecommendations - Tax system recommendations
 * @property {string} taxRecommendations[].taxType - Type of tax being recommended
 * @property {number} taxRecommendations[].recommendedRate - Optimal rate (0-100)
 * @property {string} taxRecommendations[].rationale - Reasoning for recommendation
 * @property {number} taxRecommendations[].impact - Expected impact percentage
 * @property {number} unifiedEffectiveness - Overall system effectiveness (0-100)
 * @property {string[]} optimizationSuggestions - Actionable improvement suggestions
 * @property {string[]} riskFactors - Identified risk factors and warnings
 *
 * @example
 * ```ts
 * const integration: CrossBuilderIntegration = {
 *   governmentSynergies: [{
 *     componentType: 'CENTRAL_BANK',
 *     synergyStrength: 85,
 *     description: 'Monetary policy aligns with free market principles'
 *   }],
 *   governmentConflicts: [{
 *     componentType: 'PRICE_CONTROLS',
 *     conflictStrength: 75,
 *     description: 'Price controls conflict with market-based economy'
 *   }],
 *   taxRecommendations: [{
 *     taxType: 'corporate',
 *     recommendedRate: 20,
 *     rationale: 'Competitive rate for tech hub economy',
 *     impact: 5
 *   }],
 *   unifiedEffectiveness: 78,
 *   optimizationSuggestions: ['Reduce regulatory burden'],
 *   riskFactors: ['High dependency on tech sector']
 * };
 * ```
 */
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

/**
 * EconomyValidationRules - Validation constraints for economy configuration
 *
 * Defines the business rules and constraints that must be satisfied for
 * a valid economy configuration. Used by validation services to ensure
 * data integrity and realistic economic models.
 *
 * @interface EconomyValidationRules
 *
 * Sector Constraints:
 * @property {boolean} sectorSumMustEqual100 - Whether sector percentages must sum to 100
 * @property {number} maxSectorContribution - Maximum allowed sector contribution (0-100)
 * @property {number} minSectorContribution - Minimum allowed sector contribution (0-100)
 *
 * Labor Constraints:
 * @property {[number, number]} participationRateRange - Valid range for labor participation [min, max]
 * @property {[number, number]} unemploymentRateRange - Valid range for unemployment [min, max]
 * @property {boolean} employmentTypesMustSumTo100 - Whether employment types must sum to 100
 *
 * Demographic Constraints:
 * @property {boolean} ageDistributionMustSumTo100 - Whether age groups must sum to 100
 * @property {boolean} urbanRuralMustSumTo100 - Whether urban/rural split must sum to 100
 * @property {[number, number]} populationGrowthRange - Valid range for population growth [min, max]
 *
 * Economic Constraints:
 * @property {[number, number]} gdpGrowthRange - Valid range for GDP growth [min, max]
 * @property {[number, number]} inflationRange - Valid range for inflation [min, max]
 * @property {[number, number]} giniRange - Valid range for Gini coefficient [min, max]
 *
 * Atomic Component Constraints:
 * @property {number} maxAtomicComponents - Maximum number of atomic components allowed
 * @property {number} minAtomicComponents - Minimum number of atomic components required
 * @property {number} maxConflictsAllowed - Maximum acceptable component conflicts
 * @property {number} minSynergiesRequired - Minimum required component synergies
 *
 * @example
 * ```ts
 * const rules: EconomyValidationRules = {
 *   sectorSumMustEqual100: true,
 *   maxSectorContribution: 60,
 *   minSectorContribution: 0.1,
 *   participationRateRange: [40, 85],
 *   unemploymentRateRange: [0, 30],
 *   employmentTypesMustSumTo100: true,
 *   ageDistributionMustSumTo100: true,
 *   urbanRuralMustSumTo100: true,
 *   populationGrowthRange: [-5, 10],
 *   gdpGrowthRange: [-10, 20],
 *   inflationRange: [-5, 30],
 *   giniRange: [0.2, 0.7],
 *   maxAtomicComponents: 10,
 *   minAtomicComponents: 1,
 *   maxConflictsAllowed: 3,
 *   minSynergiesRequired: 2
 * };
 * ```
 */
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
  category: "Developed" | "Emerging" | "Developing" | "Transitional";

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

/**
 * EconomyBuilderTab - Available tabs in the economy builder UI
 *
 * Defines the navigation structure of the economy builder interface.
 * Each tab represents a major configuration section.
 *
 * @typedef {'atomicComponents'|'sectors'|'labor'|'demographics'|'income'|'trade'|'productivity'|'business'|'preview'} EconomyBuilderTab
 */
export type EconomyBuilderTab =
  | "atomicComponents"
  | "sectors"
  | "labor"
  | "demographics"
  | "income"
  | "trade"
  | "productivity"
  | "business"
  | "preview";

/**
 * EconomyBuilderMode - Operating mode for the economy builder
 *
 * @typedef {'create'|'edit'|'view'} EconomyBuilderMode
 * @property {'create'} create - Creating a new economy from scratch
 * @property {'edit'} edit - Editing an existing economy configuration
 * @property {'view'} view - Read-only view of economy data
 */
export type EconomyBuilderMode = "create" | "edit" | "view";

/**
 * EconomyBuilderConfig - Configuration options for the economy builder
 *
 * Controls feature availability and behavior of the economy builder interface.
 * Used to customize the builder experience based on user permissions and context.
 *
 * @interface EconomyBuilderConfig
 * @property {EconomyBuilderMode} mode - Current operating mode
 * @property {boolean} allowAtomicComponents - Enable atomic component selection
 * @property {number} maxAtomicComponents - Maximum number of atomic components (typically 10)
 * @property {boolean} allowAdvancedSettings - Show advanced configuration options
 * @property {boolean} enableCrossBuilderSync - Enable integration with government/tax builders
 * @property {boolean} enableRealTimeValidation - Validate changes in real-time
 * @property {boolean} showEffectivenessPreview - Display effectiveness calculations
 *
 * @example
 * ```ts
 * const config: EconomyBuilderConfig = {
 *   mode: 'create',
 *   allowAtomicComponents: true,
 *   maxAtomicComponents: 10,
 *   allowAdvancedSettings: true,
 *   enableCrossBuilderSync: true,
 *   enableRealTimeValidation: true,
 *   showEffectivenessPreview: true
 * };
 * ```
 */
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

// Re-export EconomicInputs from the canonical source
export type { EconomicInputs } from "~/app/builder/lib/economy-data-service";
