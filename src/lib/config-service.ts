// src/lib/config-service.ts
// FIXED: Updated configuration service with proper tier classifications

import type { EconomicConfig, IxStatsConfig } from '../types/ixstats';

/**
 * FIXED: Get default economic configuration with updated tier system
 * Per user specifications:
 * - Economic Tiers: Impoverished ($0-$9,999, 10%), Developing ($10,000-$24,999, 7.50%), 
 *   Developed ($25,000-$34,999, 5%), Healthy ($35,000-$44,999, 3.50%), 
 *   Strong ($45,000-$54,999, 2.75%), Very Strong ($55,000-$64,999, 1.50%), 
 *   Extravagant ($65,000+, 0.50%)
 * - Population Tiers: 1 (0-9,999,999), 2 (10M-29.9M), 3 (30M-49.9M), 
 *   4 (50M-79.9M), 5 (80M-119.9M), 6 (120M-349.9M), 7 (350M-499.9M), X (500M+)
 */
export function getDefaultEconomicConfig(): EconomicConfig {
  return {
    // Global growth factor from user spec: 0.0321% = 0.000321
    globalGrowthFactor: 0.000321,
    baseInflationRate: 0.02, // 2% annual inflation
    
    // FIXED: Economic tier thresholds per user specifications
    economicTierThresholds: {
      impoverished: 0,        // $0-$9,999
      developing: 10000,      // $10,000-$24,999
      developed: 25000,       // $25,000-$34,999
      healthy: 35000,         // $35,000-$44,999
      strong: 45000,          // $45,000-$54,999
      veryStrong: 55000,      // $55,000-$64,999
      extravagant: 65000,     // $65,000+
    },
    
    // FIXED: Population tier thresholds per user specifications
    populationTierThresholds: {
      tier1: 0,               // 0-9,999,999
      tier2: 10_000_000,      // 10,000,000-29,999,999
      tier3: 30_000_000,      // 30,000,000-49,999,999
      tier4: 50_000_000,      // 50,000,000-79,999,999
      tier5: 80_000_000,      // 80,000,000-119,999,999
      tier6: 120_000_000,     // 120,000,000-349,999,999
      tier7: 350_000_000,     // 350,000,000-499,999,999
      tierX: 500_000_000,     // 500,000,000+
    },
    
    // FIXED: Tier growth modifiers - these affect base growth rates
    // Each tier has different characteristics, but we apply modifiers conservatively
    tierGrowthModifiers: {
      "Impoverished": 1.2,    // Higher growth potential for developing economies
      "Developing": 1.1,      // Moderate boost for emerging economies
      "Developed": 1.0,       // Baseline growth
      "Healthy": 0.95,        // Slight reduction as economies mature
      "Strong": 0.9,          // More mature, slower growth
      "Very Strong": 0.85,    // Advanced economies with slower growth
      "Extravagant": 0.8,     // Highly developed economies with limited growth potential
    },
    
    // System timing configuration
    calculationIntervalMs: 60_000,      // Update every minute
    ixTimeUpdateFrequency: 30_000,      // Sync time every 30 seconds
  };
}

/**
 * Get default IxStats system configuration
 */
export function getDefaultIxStatsConfig(): IxStatsConfig {
  return {
    economic: getDefaultEconomicConfig(),
    
    timeSettings: {
      baselineYear: 2028,                // In-game epoch year
      currentIxTimeMultiplier: 4.0,      // 4x real-time speed
      updateIntervalSeconds: 60,         // Auto-update every minute
    },
    
    displaySettings: {
      defaultCurrency: "USD",
      numberFormat: "en-US",
      showHistoricalData: true,
      chartTimeRange: 10,                // Default 10-year chart range
    },
  };
}

/**
 * FIXED: Validate growth rate values to ensure they're in decimal form
 * Excel exports percentages as decimals (0.5% → 0.005)
 */
export function validateGrowthRate(value: number, context: string = ""): number {
  const numValue = Number(value);
  
  if (!isFinite(numValue) || isNaN(numValue)) {
    console.warn(`[Config] Invalid growth rate for ${context}: ${value}, defaulting to 0`);
    return 0;
  }
  
  // Growth rates should be reasonable decimals
  // Anything above 50% annually is probably an error
  if (Math.abs(numValue) > 0.5) {
    console.warn(`[Config] Suspicious growth rate for ${context}: ${(numValue * 100).toFixed(2)}%, capping at ±50%`);
    return Math.sign(numValue) * 0.5;
  }
  
  // If value is between 1-100, it's likely a percentage that needs conversion
  if (Math.abs(numValue) > 1 && Math.abs(numValue) <= 100) {
    console.warn(`[Config] Converting percentage to decimal for ${context}: ${numValue}% → ${(numValue/100).toFixed(4)}`);
    return numValue / 100;
  }
  
  return numValue;
}

/**
 * FIXED: Validate GDP per capita value and determine appropriate tier
 */
export function validateGdpPerCapita(value: number, countryName: string = ""): { 
  value: number; 
  tier: string; 
  maxGrowthRate: number 
} {
  const numValue = Number(value);
  
  if (!isFinite(numValue) || isNaN(numValue) || numValue <= 0) {
    console.warn(`[Config] Invalid GDP per capita for ${countryName}: ${value}, defaulting to $1,000`);
    return { 
      value: 1000, 
      tier: "Impoverished", 
      maxGrowthRate: 0.10 
    };
  }
  
  // Determine tier and max growth rate based on user specifications
  if (numValue >= 65000) {
    return { value: numValue, tier: "Extravagant", maxGrowthRate: 0.005 };
  } else if (numValue >= 55000) {
    return { value: numValue, tier: "Very Strong", maxGrowthRate: 0.015 };
  } else if (numValue >= 45000) {
    return { value: numValue, tier: "Strong", maxGrowthRate: 0.0275 };
  } else if (numValue >= 35000) {
    return { value: numValue, tier: "Healthy", maxGrowthRate: 0.035 };
  } else if (numValue >= 25000) {
    return { value: numValue, tier: "Developed", maxGrowthRate: 0.05 };
  } else if (numValue >= 10000) {
    return { value: numValue, tier: "Developing", maxGrowthRate: 0.075 };
  } else {
    return { value: numValue, tier: "Impoverished", maxGrowthRate: 0.10 };
  }
}

/**
 * FIXED: Validate population value and determine appropriate tier
 */
export function validatePopulation(value: number, countryName: string = ""): { 
  value: number; 
  tier: string 
} {
  const numValue = Number(value);
  
  if (!isFinite(numValue) || isNaN(numValue) || numValue <= 0) {
    console.warn(`[Config] Invalid population for ${countryName}: ${value}, defaulting to 1,000,000`);
    return { value: 1_000_000, tier: "1" };
  }
  
  // Determine tier based on user specifications
  if (numValue >= 500_000_000) {
    return { value: numValue, tier: "X" };
  } else if (numValue >= 350_000_000) {
    return { value: numValue, tier: "7" };
  } else if (numValue >= 120_000_000) {
    return { value: numValue, tier: "6" };
  } else if (numValue >= 80_000_000) {
    return { value: numValue, tier: "5" };
  } else if (numValue >= 50_000_000) {
    return { value: numValue, tier: "4" };
  } else if (numValue >= 30_000_000) {
    return { value: numValue, tier: "3" };
  } else if (numValue >= 10_000_000) {
    return { value: numValue, tier: "2" };
  } else {
    return { value: numValue, tier: "1" };
  }
}

/**
 * FIXED: Get maximum allowed growth rate for a given GDP per capita
 * Based on user-specified tier system
 */
export function getMaxGrowthRateForGdpPerCapita(gdpPerCapita: number): number {
  const validation = validateGdpPerCapita(gdpPerCapita);
  return validation.maxGrowthRate;
}

/**
 * FIXED: Validate and adjust growth rate against tier-based maximum
 * Ensures growth rates don't exceed tier-based caps
 */
export function adjustGrowthRateForTier(
  growthRate: number, 
  gdpPerCapita: number, 
  context: string = ""
): number {
  const validatedRate = validateGrowthRate(growthRate, context);
  const maxRate = getMaxGrowthRateForGdpPerCapita(gdpPerCapita);
  
  if (validatedRate > maxRate) {
    console.warn(
      `[Config] Growth rate ${(validatedRate * 100).toFixed(2)}% exceeds max ${(maxRate * 100).toFixed(2)}% for GDP per capita $${gdpPerCapita.toLocaleString()} in ${context}`
    );
    return maxRate;
  }
  
  return validatedRate;
}

/**
 * Create a configuration object for a specific country based on its current stats
 */
export function createCountrySpecificConfig(
  baseConfig: EconomicConfig,
  countryGdpPerCapita: number,
  countryPopulation: number,
  localGrowthFactor: number = 1.0
): EconomicConfig & { 
  countryEconomicTier: string;
  countryPopulationTier: string;
  countryMaxGrowthRate: number;
} {
  const gdpValidation = validateGdpPerCapita(countryGdpPerCapita);
  const popValidation = validatePopulation(countryPopulation);
  
  return {
    ...baseConfig,
    // Apply local growth factor to global modifier
    globalGrowthFactor: baseConfig.globalGrowthFactor * localGrowthFactor,
    
    // Country-specific metadata
    countryEconomicTier: gdpValidation.tier,
    countryPopulationTier: popValidation.tier,
    countryMaxGrowthRate: gdpValidation.maxGrowthRate,
  };
}

/**
 * FIXED: Log configuration summary for debugging
 */
export function logConfigSummary(config: EconomicConfig, context: string = ""): void {
  console.log(`[Config] ${context} Configuration Summary:`);
  console.log(`  Global Growth Factor: ${(config.globalGrowthFactor * 100).toFixed(4)}%`);
  console.log(`  Base Inflation Rate: ${(config.baseInflationRate * 100).toFixed(2)}%`);
  console.log(`  Economic Tiers: ${Object.keys(config.economicTierThresholds).length}`);
  console.log(`  Population Tiers: ${Object.keys(config.populationTierThresholds).length}`);
  console.log(`  Update Interval: ${config.calculationIntervalMs / 1000}s`);
  
  // Log tier breakdowns
  console.log(`  Economic Tier Breakdown:`);
  Object.entries(config.economicTierThresholds).forEach(([tier, threshold]) => {
    const modifier = config.tierGrowthModifiers[tier] || 1.0;
    console.log(`    ${tier}: $${threshold.toLocaleString()}+ (${(modifier * 100).toFixed(0)}% growth modifier)`);
  });
}

/**
 * Export commonly used constants
 */
export const CONFIG_CONSTANTS = {
  // Time multipliers
  IXTIME_MULTIPLIER: 4.0,
  
  // Update frequencies (milliseconds)
  STATS_UPDATE_INTERVAL: 60_000,
  TIME_SYNC_INTERVAL: 30_000,
  
  // Growth rate limits (as decimals)
  MAX_ANNUAL_GROWTH: 0.5,     // 50%
  MAX_ANNUAL_DECLINE: -0.5,   // -50%
  
  // Default values
  DEFAULT_POPULATION: 1_000_000,
  DEFAULT_GDP_PER_CAPITA: 1_000,
  DEFAULT_GROWTH_RATE: 0.02,   // 2%
  
  // Validation thresholds
  SUSPICIOUS_GROWTH_THRESHOLD: 0.2,  // 20% - log warning
  EXTREME_GROWTH_THRESHOLD: 0.5,     // 50% - cap value
} as const;