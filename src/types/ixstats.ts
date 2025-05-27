// src/types/ixstats.ts
// Data models and types for IxStats - Fixed to match Prisma exactly

export interface BaseCountryData {
  country: string;
  population: number;
  gdpPerCapita: number; // GDP PC
  maxGdpGrowthRate: number; // Max GDPPC Grow Rt
  adjustedGdpGrowth: number; // Adj GDPPC Growth
  populationGrowthRate: number; // Pop Growth Rate
  projected2040Population: number; // 2040 Population
  projected2040Gdp: number; // 2040 GDP
  projected2040GdpPerCapita: number; // 2040 GDP PC
  actualGdpGrowth: number; // Actual GDP Growth
  landArea?: number; // Land area in square kilometers
}

// Database types (matching Prisma exactly)
export interface CountryFromDB {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Base data
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  maxGdpGrowthRate: number;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  projected2040Population: number;
  projected2040Gdp: number;
  projected2040GdpPerCapita: number;
  actualGdpGrowth: number;
  
  // Current calculated values
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  
  // Geography and density fields
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  
  // System fields
  lastCalculated: Date;
  baselineDate: Date;
  economicTier: string;
  populationTier: string;
  localGrowthFactor: number;
  
  // Relationships (when included)
  historicalData?: HistoricalDataFromDB[];
  dmInputs?: DmInputFromDB[];
}

// Computed interface for business logic (with timestamp helpers)
export interface CountryStats extends BaseCountryData {
  id?: string; // Optional if it comes from DB
  name: string; // Add name property for component compatibility
  totalGdp: number; // Calculated: population * gdpPerCapita (baseline)
  
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  
  // Keep as Date objects to match Prisma
  lastCalculated: Date;
  baselineDate: Date;
  
  // Add computed timestamp properties for backward compatibility
  lastCalculatedTimestamp?: number; // Helper: lastCalculated.getTime()
  baselineDateTimestamp?: number; // Helper: baselineDate.getTime()
  
  economicTier: EconomicTier;
  populationTier: PopulationTier;
  
  localGrowthFactor: number;
  globalGrowthFactor: number; // This might be better managed globally or passed in

  populationDensity?: number | null; // Population per square kilometer
  gdpDensity?: number | null; // GDP per square kilometer
  
  // Add historicalData and dmInputs for full compatibility
  historicalData?: HistoricalDataPoint[];
  dmInputs?: DmInputs[];
}

export enum EconomicTier {
  DEVELOPING = "Developing",
  EMERGING = "Emerging", 
  DEVELOPED = "Developed",
  ADVANCED = "Advanced"
}

export enum PopulationTier {
  MICRO = "Micro", // < 1M
  SMALL = "Small", // 1M - 10M
  MEDIUM = "Medium", // 10M - 50M
  LARGE = "Large", // 50M - 200M
  MASSIVE = "Massive" // > 200M
}

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
    large: number; // Threshold for 'Large', anything above is 'Massive'
  };
  
  // Using EconomicTier enum as keys for better type safety
  tierGrowthModifiers: {
    [key in EconomicTier]: number;
  };
  
  calculationIntervalMs: number; 
  ixTimeUpdateFrequency: number; // (e.g., how many real seconds per IxTime second if multiplier changes)
}

// Database type for DM Inputs (matching Prisma exactly)
export interface DmInputFromDB {
  id: string;
  countryId: string | null;
  ixTimeTimestamp: Date;
  inputType: string;
  value: number;
  description: string | null;
  duration: number | null;
  isActive: boolean;
  createdBy: string | null;
  
  // Relationship
  country?: CountryFromDB | null;
}

// Business logic interface for DM Inputs (backward compatibility)
export interface DmInputs {
  id: string;
  countryId?: string | null; // Can be null for global inputs (match Prisma)
  ixTimeTimestamp: Date; // Keep as Date to match Prisma
  ixTimeTimestampMs?: number; // Helper: ixTimeTimestamp.getTime()
  inputType: string;
  value: number;
  description?: string | null; // Change to match Prisma (string | null)
  duration?: number | null; // Change to match Prisma (number | null)
  isActive: boolean;
  createdBy?: string | null; // Change to match Prisma (string | null)
}

export enum DmInputType {
  POPULATION_ADJUSTMENT = "population_adjustment", // e.g., +0.05 for +5% pop
  GDP_ADJUSTMENT = "gdp_adjustment",               // e.g., -0.10 for -10% GDP
  GROWTH_RATE_MODIFIER = "growth_rate_modifier",   // e.g., 1.1 for +10% to existing growth rate
  SPECIAL_EVENT = "special_event",                 // Generic, value might determine magnitude
  TRADE_AGREEMENT = "trade_agreement",             // Could be a boolean or % impact
  NATURAL_DISASTER = "natural_disaster",           // Usually negative impact value
  ECONOMIC_POLICY = "economic_policy"              // Can be positive or negative
}

// Database type for Historical Data (matching Prisma exactly)
export interface HistoricalDataFromDB {
  id: string;
  countryId: string;
  ixTimeTimestamp: Date;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationGrowthRate: number;
  gdpGrowthRate: number;
  
  // Add geography and density tracking
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  
  // Relationship
  country: CountryFromDB;
}

// Business logic interface for Historical Data
export interface HistoricalDataPoint {
  id?: string; // Optional if it comes from DB
  countryId?: string; // Link to country
  ixTimeTimestamp: Date; // Keep as Date to match Prisma
  ixTimeTimestampMs?: number; // Helper: ixTimeTimestamp.getTime()
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationGrowthRate: number; // Rate during the period leading to this point
  gdpGrowthRate: number; // Rate during the period leading to this point
  landArea?: number | null;
  populationDensity?: number | null;
  gdpDensity?: number | null;
}
  
export interface IxStatsConfig {
  economic: EconomicConfig;
  timeSettings: {
    baselineYear: number; 
    currentIxTimeMultiplier: number;
    updateIntervalSeconds: number; // How often real-time updates IxTime
  };
  displaySettings: {
    defaultCurrency: string;
    numberFormat: "standard" | "scientific" | "compact";
    showHistoricalData: boolean;
    chartTimeRange: number; 
  };
}

export interface StatsCalculationResult {
  country: string; // Country name or ID
  oldStats: Partial<CountryStats>;
  newStats: CountryStats;
  timeElapsed: number; // Years in IxTime for this calculation step
  calculationDate: number; // IxTime timestamp of this calculation
}

export interface GlobalEconomicSnapshot {
  ixTimeTimestamp: number;
  totalPopulation: number; // Keep this name for component compatibility
  totalGdp: number; // Add this property
  countryCount: number; // Add this property
  averageGdpPerCapita: number;
  globalGrowthRate: number; // The current effective global growth rate
  economicTierDistribution: Record<EconomicTier, number>; // Count of countries in each tier
  populationTierDistribution: Record<PopulationTier, number>; // Count of countries in each tier
  averagePopulationDensity?: number;
  averageGdpDensity?: number;
}

// SystemConfig interface to match Prisma exactly
export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description: string | null; // Match Prisma: string | null, not string | undefined
  updatedAt: Date;
}

// Database type for Calculation Logs (matching Prisma exactly)
export interface CalculationLogFromDB {
  id: string;
  timestamp: Date;
  ixTimeTimestamp: Date;
  countriesUpdated: number;
  executionTimeMs: number;
  globalGrowthFactor: number;
}

// Utility type for transforming DB dates to timestamps
export type WithTimestamps<T> = T & {
  [K in keyof T as T[K] extends Date ? `${K & string}Timestamp` : never]: number;
};

// Helper function type for converting Date objects to timestamps
export interface TimestampConverter {
  toTimestamp(date: Date): number;
  fromTimestamp(timestamp: number): Date;
  formatIxTime(timestamp: number, includeTime?: boolean): string;
}

// Bot Status Types (for Discord bot integration)
export interface BotTimeResponse {
  realTime: string;
  ixTimeTimestamp: number;
  ixTimeFormatted: string;
  multiplier: number;
  isPaused: boolean;
  hasTimeOverride: boolean;
  hasMultiplierOverride: boolean;
  epoch: string;
  pausedAt?: string | null;
  pauseTimestamp?: string | null;
}

export interface BotStatusResponse extends BotTimeResponse {
  ixTimeFormattedShort: string;
  baseMultiplier: number;
  timeOverrideValue: number | null;
  multiplierOverrideValue: number | null;
  pausedTime: number | null;
  epochTimestamp: number;
  botStatus: {
    ready: boolean;
    readyAt: string | null;
    uptime: number | null;
    user: {
      id: string;
      username: string;
      tag: string;
    } | null;
  };
}

export interface BotHealthResponse {
  available: boolean;
  message: string;
}