// src/types/ixstats.ts
// FIXED: Updated tier classifications and comprehensive type system

// FIXED: Economic Tier Enums per user specifications
export enum EconomicTier {
  IMPOVERISHED = "Impoverished",    // $0-$9,999 (10% max growth)
  DEVELOPING = "Developing",        // $10,000-$24,999 (7.50% max growth)
  DEVELOPED = "Developed",          // $25,000-$34,999 (5% max growth)
  HEALTHY = "Healthy",              // $35,000-$44,999 (3.50% max growth)
  STRONG = "Strong",                // $45,000-$54,999 (2.75% max growth)
  VERY_STRONG = "Very Strong",      // $55,000-$64,999 (1.50% max growth)
  EXTRAVAGANT = "Extravagant"       // $65,000+ (0.50% max growth)
}

// FIXED: Population Tier Enums per user specifications
export enum PopulationTier {
  TIER_1 = "1",    // 0-9,999,999
  TIER_2 = "2",    // 10,000,000-29,999,999
  TIER_3 = "3",    // 30,000,000-49,999,999
  TIER_4 = "4",    // 50,000,000-79,999,999
  TIER_5 = "5",    // 80,000,000-119,999,999
  TIER_6 = "6",    // 120,000,000-349,999,999
  TIER_7 = "7",    // 350,000,000-499,999,999
  TIER_X = "X"     // 500,000,000+
}

// DM Input Types
export enum DmInputType {
  POPULATION_ADJUSTMENT = "population_adjustment",
  GDP_ADJUSTMENT = "gdp_adjustment",
  GROWTH_RATE_MODIFIER = "growth_rate_modifier",
  SPECIAL_EVENT = "special_event",
  TRADE_AGREEMENT = "trade_agreement",
  NATURAL_DISASTER = "natural_disaster",
  ECONOMIC_POLICY = "economic_policy"
}

// Base country data from Excel roster
export interface BaseCountryData {
  country: string; // From Excel "Country"
  continent?: string | null; // From Excel "Continent"
  region?: string | null; // From Excel "Region"
  governmentType?: string | null; // From Excel "Government Type"
  religion?: string | null; // From Excel "Religion"
  leader?: string | null; // From Excel "Leader"
  population: number; // From Excel "Population"
  gdpPerCapita: number; // From Excel "GDP PC"
  landArea?: number | null; // From Excel "Area (km²)"
  areaSqMi?: number | null; // From Excel "Area (sq mi)"
  
  // FIXED: Growth rates stored as decimals (0.005 for 0.5%)
  maxGdpGrowthRate: number; // From Excel "Max GDPPC Grow Rt" - as decimal
  adjustedGdpGrowth: number; // From Excel "Adj GDPPC Growth" - as decimal
  populationGrowthRate: number; // From Excel "Pop Growth Rate" - as decimal
  actualGdpGrowth: number; // Calculated or from Excel - as decimal
  
  // Projection fields
  projected2040Population: number;
  projected2040Gdp: number;
  projected2040GdpPerCapita: number;
  
  localGrowthFactor: number;
}

// Current country statistics (calculated)
export interface CountryStats extends BaseCountryData {
  // Database fields
  id?: string;
  name: string; // Will be same as 'country' from BaseCountryData
  slug?: string;

  // Descriptive fields from Excel, carried over
  continent?: string | null;
  region?: string | null;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
  areaSqMi?: number | null;

  // Calculated current values
  totalGdp: number; // Derived from population * gdpPerCapita
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;

  // Time tracking
  lastCalculated: Date | number;
  baselineDate: Date | number;

  // FIXED: Use updated tier classifications
  economicTier: EconomicTier;
  populationTier: PopulationTier;

  // Geographic calculations
  populationDensity?: number | null;
  gdpDensity?: number | null;

  // Growth modifiers
  localGrowthFactor: number;
  globalGrowthFactor: number;

  // Historical data (optional)
  historicalData?: HistoricalDataPoint[];
}

// Historical data point
export interface HistoricalDataPoint {
  id?: string;
  countryId?: string;
  ixTimeTimestamp: Date | number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationGrowthRate: number; // Stored as decimal
  gdpGrowthRate: number; // Stored as decimal
  landArea?: number | null;
  populationDensity?: number | null;
  gdpDensity?: number | null;
}

// DM Input record
export interface DmInputs {
  id?: string;
  countryId?: string | null;
  ixTimeTimestamp: Date | number;
  inputType: DmInputType | string;
  value: number; // Should be in decimal form for growth rates
  description?: string | null;
  duration?: number | null;
  isActive: boolean;
  createdBy?: string | null;
}

// FIXED: Economic configuration with updated tier thresholds
export interface EconomicConfig {
  globalGrowthFactor: number;
  baseInflationRate: number;
  
  // FIXED: Economic tier thresholds per user specifications
  economicTierThresholds: {
    impoverished: number;    // $0-$9,999
    developing: number;      // $10,000-$24,999
    developed: number;       // $25,000-$34,999
    healthy: number;         // $35,000-$44,999
    strong: number;          // $45,000-$54,999
    veryStrong: number;      // $55,000-$64,999
    extravagant: number;     // $65,000+
  };
  
  // FIXED: Population tier thresholds per user specifications
  populationTierThresholds: {
    tier1: number;          // 0-9,999,999
    tier2: number;          // 10,000,000-29,999,999
    tier3: number;          // 30,000,000-49,999,999
    tier4: number;          // 50,000,000-79,999,999
    tier5: number;          // 80,000,000-119,999,999
    tier6: number;          // 120,000,000-349,999,999
    tier7: number;          // 350,000,000-499,999,999
    tierX: number;          // 500,000,000+
  };
  
  tierGrowthModifiers: Record<string, number>;
  calculationIntervalMs: number;
  ixTimeUpdateFrequency: number;
}

// System configuration
export interface IxStatsConfig {
  economic: EconomicConfig;
  timeSettings: {
    baselineYear: number;
    currentIxTimeMultiplier: number;
    updateIntervalSeconds: number;
  };
  displaySettings: {
    defaultCurrency: string;
    numberFormat: string;
    showHistoricalData: boolean;
    chartTimeRange: number;
  };
}

// Global economic snapshot
export interface GlobalEconomicSnapshot {
  timestamp: any;
  totalPopulation: number;
  totalGdp: number;
  averageGdpPerCapita: number;
  countryCount: number;
  economicTierDistribution: Record<EconomicTier, number>;
  populationTierDistribution: Record<PopulationTier, number>;
  averagePopulationDensity: number;
  averageGdpDensity: number;
  globalGrowthRate: number;
  ixTimeTimestamp: number;
}

// Bot time response types
export interface BotTimeResponse {
  ixTimeTimestamp: number;
  ixTimeFormatted: string;
  multiplier: number;
  isPaused: boolean;
  hasTimeOverride: boolean;
  hasMultiplierOverride: boolean;
  realWorldTime: number;
  gameYear: number;
}

export interface BotEndpointStatusResponse extends BotTimeResponse {
  pausedAt?: number | null;
  pauseTimestamp?: number | null;
  botStatus: {
    ready: boolean;
    user?: {
      id: string;
      username: string;
      discriminator: string;
    };
    guilds: number;
    uptime: number;
  };
}

export interface DerivedBotDisplayStatus extends BotTimeResponse {
  pausedAt?: number | null;
  pauseTimestamp?: number | null;
  botReady: boolean;
  botUser?: {
    id: string;
    username: string;
    discriminator: string;
  };
  guilds?: number;
  uptime?: number;
}

export interface IxTimeState {
  currentRealTime: string;
  currentIxTime: string;
  formattedIxTime: string;
  multiplier: number;
  isPaused: boolean;
  hasTimeOverride: boolean;
  timeOverrideValue?: string | null;
  hasMultiplierOverride?: boolean;
  multiplierOverrideValue?: number | null | undefined;
  realWorldEpoch?: string;
  inGameEpoch?: string;
  yearsSinceGameStart?: number;
  currentGameYear?: number;
  gameTimeDescription?: string;
  botAvailable?: boolean;
  lastSyncTime?: string | null;
  lastKnownBotTime?: string | null;
  botStatus: DerivedBotDisplayStatus | null;
}

export interface AdminPageBotStatusView extends IxTimeState {
  botHealth: {
    available: boolean;
    message: string;
  };
}

export interface SystemStatus {
  ixTime: IxTimeState;
  countryCount: number;
  activeDmInputs: number;
  lastCalculation?: {
    timestamp: string;
    ixTimeTimestamp: string;
    countriesUpdated: number;
    executionTimeMs: number;
  } | null;
}

// Calculation result types
export interface CalculationResult {
  country: string;
  oldStats: Partial<CountryStats>;
  newStats: CountryStats;
  timeElapsed: number;
  calculationDate: number;
  changes?: {
    population: number;
    gdpPerCapita: number;
    totalGdp: number;
    economicTier?: string;
    populationTier?: string;
  };
}

// Import/Export types
export interface ImportAnalysis {
  totalCountries: number;
  newCountries: number;
  updatedCountries: number;
  unchangedCountries: number;
  changes: Array<{
    type: 'new' | 'update';
    country: BaseCountryData;
    existingData?: BaseCountryData;
    changes?: Array<{
      field: string;
      oldValue: string | number | null;
      newValue: string | number | null;
      fieldLabel: string;
    }>;
  }>;
  analysisTime: number;
}

export interface ImportResult {
  imported: number;
  totalInFile: number;
  countries: string[];
  importTime: number;
  timeSource: string;
  errors?: string[];
}

// Time context information
export interface TimeContext {
  currentIxTime: number;
  formattedCurrentTime: string;
  gameEpoch: number;
  formattedGameEpoch: string;
  yearsSinceGameStart: number;
  currentGameYear: number;
  gameTimeDescription: string;
  timeMultiplier: number;
}

// Forecast data
export interface ForecastPoint {
  ixTime: number;
  formattedTime: string;
  gameYear: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  economicTier: EconomicTier;
  populationTier: PopulationTier;
}

export interface ForecastRange {
  countryId: string;
  countryName: string;
  startTime: number;
  endTime: number;
  dataPoints: ForecastPoint[];
}

// Chart data types
export interface ChartDataPoint {
  date: string;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity: number;
  gdpDensity: number;
  economicEfficiency: number;
  areaUtilization: number;
}

// API response wrappers
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormState {
  isValid: boolean;
  errors: ValidationError[];
  isDirty: boolean;
  isSubmitting: boolean;
}

// UI State types
type LoadingState<T = unknown> = {
  isLoading: boolean;
  error?: string | null;
  data?: T;
};

export interface TableColumn<T = unknown> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: T, row: T) => React.ReactNode;
}

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  mode: ThemeMode;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  spacing: Record<string, string>;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Database model types (matching Prisma schema)
export interface Country {
  id: string;
  name: string;
  continent?: string | null;
  region?: string | null;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
  areaSqMi?: number | null;

  baselinePopulation: number;
  baselineGdpPerCapita: number;
  maxGdpGrowthRate: number; // Stored as decimal in DB
  adjustedGdpGrowth: number; // Stored as decimal in DB
  populationGrowthRate: number; // Stored as decimal in DB
  landArea?: number | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  lastCalculated: Date;
  baselineDate: Date;
  economicTier: string; // Maps to EconomicTier enum
  populationTier: string; // Maps to PopulationTier enum
  localGrowthFactor: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalculationLog {
  id: string;
  timestamp: Date;
  ixTimeTimestamp: Date;
  countriesUpdated: number;
  executionTimeMs: number;
  globalGrowthFactor: number;
  notes?: string | null;
}

// FIXED: Tier mapping utilities
export const ECONOMIC_TIER_INFO: Record<EconomicTier, { min: number; max: number; maxGrowth: number }> = {
  [EconomicTier.IMPOVERISHED]: { min: 0, max: 9999, maxGrowth: 0.10 },
  [EconomicTier.DEVELOPING]: { min: 10000, max: 24999, maxGrowth: 0.075 },
  [EconomicTier.DEVELOPED]: { min: 25000, max: 34999, maxGrowth: 0.05 },
  [EconomicTier.HEALTHY]: { min: 35000, max: 44999, maxGrowth: 0.035 },
  [EconomicTier.STRONG]: { min: 45000, max: 54999, maxGrowth: 0.0275 },
  [EconomicTier.VERY_STRONG]: { min: 55000, max: 64999, maxGrowth: 0.015 },
  [EconomicTier.EXTRAVAGANT]: { min: 65000, max: Infinity, maxGrowth: 0.005 },
};

export const POPULATION_TIER_INFO: Record<PopulationTier, { min: number; max: number }> = {
  [PopulationTier.TIER_1]: { min: 0, max: 9_999_999 },
  [PopulationTier.TIER_2]: { min: 10_000_000, max: 29_999_999 },
  [PopulationTier.TIER_3]: { min: 30_000_000, max: 49_999_999 },
  [PopulationTier.TIER_4]: { min: 50_000_000, max: 79_999_999 },
  [PopulationTier.TIER_5]: { min: 80_000_000, max: 119_999_999 },
  [PopulationTier.TIER_6]: { min: 120_000_000, max: 349_999_999 },
  [PopulationTier.TIER_7]: { min: 350_000_000, max: 499_999_999 },
  [PopulationTier.TIER_X]: { min: 500_000_000, max: Infinity },
};

// Helper functions for tier determination
export function getEconomicTierFromGdpPerCapita(gdpPerCapita: number): EconomicTier {
  for (const [tier, info] of Object.entries(ECONOMIC_TIER_INFO)) {
    if (gdpPerCapita >= info.min && gdpPerCapita <= info.max) {
      return tier as EconomicTier;
    }
  }
  return EconomicTier.IMPOVERISHED;
}

export function getPopulationTierFromPopulation(population: number): PopulationTier {
  for (const [tier, info] of Object.entries(POPULATION_TIER_INFO)) {
    if (population >= info.min && population <= info.max) {
      return tier as PopulationTier;
    }
  }
  return PopulationTier.TIER_X;
}

// FIXED: Growth rate conversion utilities
export function decimalToPercentage(decimal: number): number {
  return decimal * 100;
}

export function percentageToDecimal(percentage: number): number {
  return percentage / 100;
}

// Define explicit types for complex fields
export interface CalculatedStats {
  gdpGrowth: number;
  populationGrowth: number;
  inflation: number;
  economicTier?: string;
  populationTier?: string;
  // Add more fields as needed
}

export interface Projection {
  year: number;
  gdp: number;
  population: number;
  // Add more fields as needed
}

export interface HistoricalData {
  year: number;
  gdp: number;
  population: number;
  // Add more fields as needed
}

export interface DMInput {
  id: string;
  countryId: string;
  inputType: string;
  value: number;
  description?: string;
  timestamp: Date;
}

export interface EconomicProfile {
  sectorBreakdown: Record<string, number>;
  // Add more fields as needed
}

export interface LaborMarket {
  employmentRate: number;
  unemploymentRate: number;
  // Add more fields as needed
}

export interface FiscalSystem {
  taxRates: Record<string, number>;
  // Add more fields as needed
}

export interface IncomeDistribution {
  quintiles: number[];
  economicClasses?: string | any[];
  // Add more fields as needed
}

export interface GovernmentBudget {
  total: number;
  categories: Record<string, number>;
  spendingCategories?: string | any[];
  // Add more fields as needed
}

// National Identity (database relation)
export interface NationalIdentity {
  countryName?: string | null;
  officialName?: string | null;
  governmentType?: string | null;
  motto?: string | null;
  mottoNative?: string | null;
  capitalCity?: string | null;
  largestCity?: string | null;
  demonym?: string | null;
  currency?: string | null;
  currencySymbol?: string | null;
  officialLanguages?: string | null;
  nationalLanguage?: string | null;
  nationalAnthem?: string | null;
  nationalDay?: string | null;
  callingCode?: string | null;
  internetTLD?: string | null;
  drivingSide?: string | null;
  timeZone?: string | null;
  isoCode?: string | null;
  coordinatesLatitude?: string | null;
  coordinatesLongitude?: string | null;
  emergencyNumber?: string | null;
  postalCodeFormat?: string | null;
  nationalSport?: string | null;
  weekStartDay?: string | null;
  flagUrl?: string | null;
  coatOfArmsUrl?: string | null;
}

export interface Demographics {
  ageDistribution: Record<string, number>;
  regions?: string | any[];
  educationLevels?: string | any[];
  citizenshipStatuses?: string | any[];
  // Add more fields as needed
}

export interface TierChangeProjection {
  year: number;
  newTier: string;
  // Add more fields as needed
}

// Update ImportAnalysis and CountryWithEconomicData to use these types
export interface CountryWithEconomicData {
  // Core country properties
  id: string;
  name: string;
  slug?: string | null;
  continent?: string | null;
  region?: string | null;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
  areaSqMi?: number | null;
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  maxGdpGrowthRate: number;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  landArea?: number | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  lastCalculated: Date | number;
  baselineDate: Date | number;
  economicTier: string;
  populationTier: string;
  localGrowthFactor: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Economic data
  calculatedStats: CalculatedStats;
  projections: Projection[];
  historical: HistoricalData[];
  dmInputs: DMInput[];
  nominalGDP: number;
  realGDPGrowthRate: number;
  inflationRate: number;
  currencyExchangeRate: number;
  
  // Labor market data
  laborForceParticipationRate?: number;
  employmentRate?: number;
  unemploymentRate?: number;
  totalWorkforce?: number;
  averageWorkweekHours?: number;
  minimumWage?: number;
  averageAnnualIncome?: number;
  
  // Fiscal and debt data
  governmentRevenueTotal?: number | null;
  taxRevenueGDPPercent?: number;
  taxRevenuePerCapita?: number;
  governmentBudgetGDPPercent?: number;
  budgetDeficitSurplus?: number;
  internalDebtGDPPercent?: number;
  externalDebtGDPPercent?: number;
  totalDebtGDPRatio?: number;
  debtPerCapita?: number;
  interestRates?: number;
  debtServiceCosts?: number;
  
  // Income distribution
  povertyRate?: number;
  incomeInequalityGini?: number;
  socialMobilityIndex?: number;
  
  // Government spending
  totalGovernmentSpending?: number;
  spendingGDPPercent?: number;
  spendingPerCapita?: number;
  
  // Demographics
  lifeExpectancy?: number;
  urbanPopulationPercent?: number | null;
  ruralPopulationPercent?: number | null;
  literacyRate?: number;
  
  // Complex objects
  economicProfile?: EconomicProfile;
  laborMarket?: LaborMarket;
  fiscalSystem?: FiscalSystem;
  incomeDistribution?: IncomeDistribution;
  governmentBudget?: GovernmentBudget;
  demographics?: Demographics;
  // National identity relation (if included by API)
  nationalIdentity?: NationalIdentity | null;
  
  // Analytics
  analytics: {
    growthTrends: {
      avgPopGrowth: number;
      avgGdpGrowth: number;
    };
    volatility: {
      popVolatility: number;
      gdpVolatility: number;
    };
    riskFlags: string[];
    tierChangeProjection: TierChangeProjection;
    vulnerabilities: string[];
  };
}

// Economic Policy Types
export type PolicyCategory = 'fiscal' | 'monetary' | 'trade' | 'investment' | 'labor' | 'infrastructure';

export type PolicyStatus = 'draft' | 'proposed' | 'under_review' | 'approved' | 'rejected' | 'implemented';

export interface EconomicPolicy {
  id: string;
  title: string;
  description: string;
  category: PolicyCategory;
  status: PolicyStatus;
  proposedBy: string;
  proposedDate: Date;
  impact?: {
    gdpGrowthProjection?: number;
    unemploymentImpact?: number;
    inflationImpact?: number;
    budgetImpact?: number;
  };
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}