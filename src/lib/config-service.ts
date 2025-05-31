// src/lib/config-service.ts
import type { EconomicConfig, IxStatsConfig } from '../types/ixstats';

export function getDefaultEconomicConfig(): EconomicConfig {
  return {
    globalGrowthFactor: 1.0321,
    baseInflationRate: 0.02,
    economicTierThresholds: {
      developing: 0,
      emerging: 15000,
      developed: 35000,
      advanced: 50000
    },
    populationTierThresholds: {
      micro: 1000000,
      small: 10000000,
      medium: 50000000,
      large: 200000000
    },
    tierGrowthModifiers: {
      "Developing": 1.2,
      "Emerging": 1.1,
      "Developed": 1.0,
      "Advanced": 0.9
    } as Record<"Developing" | "Emerging" | "Developed" | "Advanced", number>,
    calculationIntervalMs: 60000,
    ixTimeUpdateFrequency: 4
  };
}

export function getDefaultIxStatsConfig(): IxStatsConfig {
  return {
    economic: getDefaultEconomicConfig(),
    timeSettings: {
      baselineYear: 2028,
      currentIxTimeMultiplier: 4,
      updateIntervalSeconds: 60
    },
    displaySettings: {
      defaultCurrency: "USD",
      numberFormat: "compact",
      showHistoricalData: true,
      chartTimeRange: 5
    }
  };
}