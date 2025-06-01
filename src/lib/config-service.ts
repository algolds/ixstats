// src/lib/config-service.ts
// FIXED: Configuration service with proper global growth factor handling

import type { EconomicConfig, IxStatsConfig } from '../types/ixstats';

/**
 * FIXED: Get default economic configuration with proper global growth factor
 * Global growth factor is 3.21% annually = 1.0321 as multiplier
 */
export function getDefaultEconomicConfig(): EconomicConfig {
  return {
    // FIXED: Global growth factor of 3.21% annually (1.0321 as multiplier)
    globalGrowthFactor: 1.0321, // This multiplies the base growth rates
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
    
    // FIXED: Tier growth modifiers - these multiply the base growth rates
    // Base growth rates are already set per tier, these provide fine-tuning
    tierGrowthModifiers: {
      "Impoverished": 1.0,    // 10% max growth rate
      "Developing": 1.0,      // 7.50% max growth rate
      "Developed": 1.0,       // 5% max growth rate
      "Healthy": 1.0,         // 3.50% max growth rate
      "Strong": 1.0,          // 2.75% max growth rate
      "Very Strong": 1.0,     // 1.50% max growth rate
      "Extravagant": 1.0,     // 0.50% max growth rate
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
 * FIXED: Validate GDP per capita value and determine appropriate tier with max growth rates
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
      maxGrowthRate: 0.10 // 10% max for impoverished
    };
  }
  
  // FIXED: Determine tier and max growth rate based on user specifications
  if (numValue >= 65000) {
    return { value: numValue, tier: "Extravagant", maxGrowthRate: 0.005 }; // 0.50%
  } else if (numValue >= 55000) {
    return { value: numValue, tier: "Very Strong", maxGrowthRate: 0.015 }; // 1.50%
  } else if (numValue >= 45000) {
    return { value: numValue, tier: "Strong", maxGrowthRate: 0.0275 }; // 2.75%
  } else if (numValue >= 35000) {
    return { value: numValue, tier: "Healthy", maxGrowthRate: 0.035 }; // 3.50%
  } else if (numValue >= 25000) {
    return { value: numValue, tier: "Developed", maxGrowthRate: 0.05 }; // 5%
  } else if (numValue >= 10000) {
    return { value: numValue, tier: "Developing", maxGrowthRate: 0.075 }; // 7.50%
  } else {
    return { value: numValue, tier: "Impoverished", maxGrowthRate: 0.10 }; // 10%
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
 * FIXED: Calculate effective growth rate with global and tier modifiers
 * This shows how growth rates are actually applied in calculations
 */
export function calculateEffectiveGrowthRate(
  baseGrowthRate: number,
  gdpPerCapita: number,
  globalGrowthFactor: number = 1.0321,
  localGrowthFactor: number = 1.0
): number {
  const validatedBase = validateGrowthRate(baseGrowthRate);
  const maxAllowed = getMaxGrowthRateForGdpPerCapita(gdpPerCapita);
  
  // Apply global growth factor (3.21% boost)
  let effectiveRate = validatedBase * globalGrowthFactor;
  
  // Apply local growth factor
  effectiveRate *= localGrowthFactor;
  
  // Cap at tier maximum
  effectiveRate = Math.min(effectiveRate, maxAllowed);
  
  // Ensure no negative growth beyond -50%
  effectiveRate = Math.max(effectiveRate, -0.5);
  
  return effectiveRate;
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
    // Keep the global growth factor as-is (it's already a multiplier)
    globalGrowthFactor: baseConfig.globalGrowthFactor,
    
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
  console.log(`  Global Growth Factor: ${((config.globalGrowthFactor - 1) * 100).toFixed(2)}% (${config.globalGrowthFactor}x)`);
  console.log(`  Base Inflation Rate: ${(config.baseInflationRate * 100).toFixed(2)}%`);
  console.log(`  Economic Tiers: ${Object.keys(config.economicTierThresholds).length}`);
  console.log(`  Population Tiers: ${Object.keys(config.populationTierThresholds).length}`);
  console.log(`  Update Interval: ${config.calculationIntervalMs / 1000}s`);
  
  // Log tier breakdowns with max growth rates
  console.log(`  Economic Tier Breakdown:`);
  console.log(`    Impoverished ($0-$9,999): 10% max growth`);
  console.log(`    Developing ($10K-$24.9K): 7.50% max growth`);
  console.log(`    Developed ($25K-$34.9K): 5% max growth`);
  console.log(`    Healthy ($35K-$44.9K): 3.50% max growth`);
  console.log(`    Strong ($45K-$54.9K): 2.75% max growth`);
  console.log(`    Very Strong ($55K-$64.9K): 1.50% max growth`);
  console.log(`    Extravagant ($65K+): 0.50% max growth`);
}

/**
 * FIXED: Export commonly used constants with proper values
 */
export const CONFIG_CONSTANTS = {
  // Time multipliers
  IXTIME_MULTIPLIER: 4.0,
  
  // FIXED: Global growth factor (3.21% annually)
  GLOBAL_GROWTH_FACTOR: 1.0321,
  
  // Update frequencies (milliseconds)
  STATS_UPDATE_INTERVAL: 60_000,
  TIME_SYNC_INTERVAL: 30_000,
  
  // Growth rate limits (as decimals)
  MAX_ANNUAL_GROWTH: 0.5,     // 50%
  MAX_ANNUAL_DECLINE: -0.5,   // -50%
  
  // Tier-specific max growth rates (as decimals)
  TIER_MAX_GROWTH: {
    "Impoverished": 0.10,    // 10%
    "Developing": 0.075,     // 7.50%
    "Developed": 0.05,       // 5%
    "Healthy": 0.035,        // 3.50%
    "Strong": 0.0275,        // 2.75%
    "Very Strong": 0.015,    // 1.50%
    "Extravagant": 0.005,    // 0.50%
  },
  
  // Default values
  DEFAULT_POPULATION: 1_000_000,
  DEFAULT_GDP_PER_CAPITA: 1_000,
  DEFAULT_GROWTH_RATE: 0.02,   // 2%
  
  // Validation thresholds
  SUSPICIOUS_GROWTH_THRESHOLD: 0.2,  // 20% - log warning
  EXTREME_GROWTH_THRESHOLD: 0.5,     // 50% - cap value
} as const;

/**
 * FIXED: Helper to format growth rates for display
 */
export function formatGrowthRateForDisplay(decimal: number): string {
  return `${(decimal * 100).toFixed(2)}%`;
}

/**
 * FIXED: Helper to parse growth rates from Excel/user input
 */
export function parseGrowthRateFromInput(input: string | number): number {
  if (typeof input === 'number') {
    return validateGrowthRate(input);
  }
  
  const str = String(input).trim();
  if (str.includes('%')) {
    // Parse as percentage and convert to decimal
    const percentValue = parseFloat(str.replace('%', ''));
    return validateGrowthRate(percentValue / 100);
  } else {
    // Parse as decimal
    return validateGrowthRate(parseFloat(str));
  }
}