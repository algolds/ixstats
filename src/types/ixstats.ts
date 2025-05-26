// types/ixstats.ts
// Data models and types for IxStats

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
  }
  
  export interface CountryStats extends BaseCountryData {
    // Calculated fields
    totalGdp: number;
    
    // Time-based calculations
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    
    // Historical tracking
    lastCalculated: number; // IxTime timestamp
    baselineDate: number; // IxTime timestamp when baseline was set
    
    // Economic tiers
    economicTier: EconomicTier;
    populationTier: PopulationTier;
    
    // Growth factors
    localGrowthFactor: number;
    globalGrowthFactor: number;
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
    // Global economic factors
    globalGrowthFactor: number;
    baseInflationRate: number;
    
    // Tier thresholds
    economicTierThresholds: {
      developing: number; // GDP PC threshold
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
    
    // Growth modifiers
    tierGrowthModifiers: {
      [key in EconomicTier]: number;
    };
    
    // Time factors
    calculationIntervalMs: number; // How often to recalculate
    ixTimeUpdateFrequency: number; // IxTime update frequency
  }
  
  export interface DmInputs {
    countryName: string;
    ixTimeTimestamp: number;
    inputType: DmInputType;
    value: number;
    description?: string;
    duration?: number; // For temporary effects
  }
  
  export enum DmInputType {
    POPULATION_ADJUSTMENT = "population_adjustment",
    GDP_ADJUSTMENT = "gdp_adjustment",
    GROWTH_RATE_MODIFIER = "growth_rate_modifier",
    SPECIAL_EVENT = "special_event",
    TRADE_AGREEMENT = "trade_agreement",
    NATURAL_DISASTER = "natural_disaster",
    ECONOMIC_POLICY = "economic_policy"
  }
  
  export interface HistoricalDataPoint {
    ixTimeTimestamp: number;
    population: number;
    gdpPerCapita: number;
    totalGdp: number;
    populationGrowthRate: number;
    gdpGrowthRate: number;
  }
  
  export interface CountryHistoricalData {
    countryName: string;
    dataPoints: HistoricalDataPoint[];
    dmInputs: DmInputs[];
  }
  
  export interface IxStatsConfig {
    economic: EconomicConfig;
    timeSettings: {
      baselineYear: number; // Real world year for baseline
      currentIxTimeMultiplier: number;
      updateIntervalSeconds: number;
    };
    displaySettings: {
      defaultCurrency: string;
      numberFormat: "standard" | "scientific" | "compact";
      showHistoricalData: boolean;
      chartTimeRange: number; // Years to show in charts
    };
  }
  
  // Utility types for API responses
  export interface StatsCalculationResult {
    country: string;
    oldStats: Partial<CountryStats>;
    newStats: CountryStats;
    timeElapsed: number; // Years in IxTime
    calculationDate: number; // IxTime timestamp
  }
  
  export interface GlobalEconomicSnapshot {
    ixTimeTimestamp: number;
    totalWorldPopulation: number;
    totalWorldGdp: number;
    averageGdpPerCapita: number;
    globalGrowthRate: number;
    economicTierDistribution: Record<EconomicTier, number>;
    populationTierDistribution: Record<PopulationTier, number>;
  }