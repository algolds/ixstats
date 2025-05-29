// src/types/ixstats.ts
// Core type definitions for IxStats system

// Economic and Population Tier Enums
export enum EconomicTier {
  DEVELOPING = "Developing",
  EMERGING = "Emerging", 
  DEVELOPED = "Developed",
  ADVANCED = "Advanced"
}

export enum PopulationTier {
  MICRO = "Micro",
  SMALL = "Small",
  MEDIUM = "Medium", 
  LARGE = "Large",
  MASSIVE = "Massive"
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

// Base country data from roster
export interface BaseCountryData {
  country: string;
  population: number;
  gdpPerCapita: number;
  maxGdpGrowthRate: number;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  projected2040Population: number;
  projected2040Gdp: number;
  projected2040GdpPerCapita: number;
  actualGdpGrowth: number;
  landArea?: number | null;
}

// Current country statistics (calculated)
export interface CountryStats extends BaseCountryData {
  // Database fields
  id?: string;
  name: string;
  
  // Calculated current values
  totalGdp: number;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  
  // Time tracking
  lastCalculated: Date | number;
  baselineDate: Date | number;
  
  // Categorization
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
  populationGrowthRate: number;
  gdpGrowthRate: number;
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
  value: number;
  description?: string | null;
  duration?: number | null;
  isActive: boolean;
  createdBy?: string | null;
}

// Economic configuration
export interface EconomicConfig {
  globalGrowthFactor: number;
  baseInflationRate: number;
  economicTierThresholds: {
    developing: number;
    emerging: number;
    developed: number;
    advanced: number;
  };
  populationTierThresholds: {
    micro: number;
    small: number;
    medium: number;
    large: number;
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

export interface BotStatusResponse extends BotTimeResponse {
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
    existingData?: any;
    changes?: Array<{
      field: string;
      oldValue: any;
      newValue: any;
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

// System status types
export interface SystemStatus {
  ixTime: {
    currentRealTime: string;
    currentIxTime: string;
    formattedIxTime: string;
    multiplier: number;
    isPaused: boolean;
    hasTimeOverride: boolean;
    timeOverrideValue?: string | null;
    hasMultiplierOverride: boolean;
    multiplierOverrideValue?: number | null;
    realWorldEpoch: string;
    inGameEpoch: string;
    yearsSinceGameStart: number;
    currentGameYear: number;
    gameTimeDescription: string;
    botAvailable: boolean;
    lastSyncTime?: string | null;
    lastKnownBotTime?: string | null;
    botStatus?: any;
  };
  countryCount: number;
  activeDmInputs: number;
  lastCalculation?: {
    timestamp: string;
    ixTimeTimestamp: string;
    countriesUpdated: number;
    executionTimeMs: number;
  } | null;
}

// API response wrappers
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
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
export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
  data?: any;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
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
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  maxGdpGrowthRate: number;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  projected2040Population: number;
  projected2040Gdp: number;
  projected2040GdpPerCapita: number;
  actualGdpGrowth: number;
  landArea?: number | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  lastCalculated: Date;
  baselineDate: Date;
  economicTier: string;
  populationTier: string;
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