// lib/calculations.ts
// Core calculation engine for IxStats

import { IxTime } from './ixtime';
import {
  CountryStats,
  BaseCountryData,
  EconomicTier,
  PopulationTier,
  EconomicConfig,
  DmInputs,
  DmInputType,
  StatsCalculationResult,
  HistoricalDataPoint
} from '../types/ixstats';

export class IxStatsCalculator {
  private config: EconomicConfig;
  private baselineDate: number; // IxTime timestamp

  constructor(config: EconomicConfig, baselineDate?: number) {
    this.config = config;
    this.baselineDate = baselineDate || IxTime.getCurrentIxTime();
  }

  /**
   * Initialize country stats from base data
   */
  initializeCountryStats(baseData: BaseCountryData): CountryStats {
    const totalGdp = baseData.population * baseData.gdpPerCapita;
    
    return {
      ...baseData,
      totalGdp,
      currentPopulation: baseData.population,
      currentGdpPerCapita: baseData.gdpPerCapita,
      currentTotalGdp: totalGdp,
      lastCalculated: this.baselineDate,
      baselineDate: this.baselineDate,
      economicTier: this.calculateEconomicTier(baseData.gdpPerCapita),
      populationTier: this.calculatePopulationTier(baseData.population),
      localGrowthFactor: 1.0,
      globalGrowthFactor: this.config.globalGrowthFactor || 1.0
    };
  }

  /**
   * Calculate updated stats based on time progression
   */
  calculateTimeProgression(
    currentStats: CountryStats,
    targetTime?: number,
    dmInputs: DmInputs[] = []
  ): StatsCalculationResult {
    const now = targetTime || IxTime.getCurrentIxTime();
    const yearsElapsed = IxTime.getYearsElapsed(currentStats.lastCalculated, now);
    
    if (yearsElapsed <= 0) {
      return {
        country: currentStats.country,
        oldStats: currentStats,
        newStats: currentStats,
        timeElapsed: 0,
        calculationDate: now
      };
    }

    const oldStats = { ...currentStats };
    
    // Apply DM inputs that are active during this period
    const activeDmInputs = this.getActiveDmInputs(dmInputs, currentStats.lastCalculated, now);
    
    // Calculate population growth
    const newPopulation = this.calculatePopulationGrowth(
      currentStats.currentPopulation,
      currentStats.populationGrowthRate,
      yearsElapsed,
      activeDmInputs
    );

    // Calculate GDP per capita growth
    const newGdpPerCapita = this.calculateGdpPerCapitaGrowth(
      currentStats.currentGdpPerCapita,
      currentStats.adjustedGdpGrowth,
      currentStats.maxGdpGrowthRate,
      currentStats.economicTier,
      yearsElapsed,
      activeDmInputs
    );

    // Calculate total GDP
    const newTotalGdp = newPopulation * newGdpPerCapita;

    // Update tiers
    const newEconomicTier = this.calculateEconomicTier(newGdpPerCapita);
    const newPopulationTier = this.calculatePopulationTier(newPopulation);

    // Apply any special modifiers
    const modifiedStats = this.applySpecialModifiers(
      {
        ...currentStats,
        currentPopulation: newPopulation,
        currentGdpPerCapita: newGdpPerCapita,
        currentTotalGdp: newTotalGdp,
        economicTier: newEconomicTier,
        populationTier: newPopulationTier,
        lastCalculated: now
      },
      activeDmInputs
    );

    return {
      country: currentStats.country,
      oldStats,
      newStats: modifiedStats,
      timeElapsed: yearsElapsed,
      calculationDate: now
    };
  }

  /**
   * Calculate compound population growth
   */
  private calculatePopulationGrowth(
    basePopulation: number,
    growthRate: number,
    years: number,
    dmInputs: DmInputs[]
  ): number {
    let adjustedRate = growthRate;
    
    // Apply DM adjustments
    dmInputs.forEach(input => {
      if (input.inputType === DmInputType.POPULATION_ADJUSTMENT) {
        adjustedRate += input.value;
      }
    });

    // Compound growth formula: P = P₀ * (1 + r)^t
    return basePopulation * Math.pow(1 + adjustedRate, years);
  }

  /**
   * Calculate GDP per capita growth with tier and cap considerations
   */
  private calculateGdpPerCapitaGrowth(
    baseGdpPerCapita: number,
    adjustedGrowth: number,
    maxGrowthRate: number,
    tier: EconomicTier,
    years: number,
    dmInputs: DmInputs[]
  ): number {
    let effectiveGrowthRate = adjustedGrowth;
    
    // Apply tier modifier
    const tierModifier = this.config.tierGrowthModifiers[tier] || 1.0;
    effectiveGrowthRate *= tierModifier;

    // Apply global growth factor
    effectiveGrowthRate *= this.config.globalGrowthFactor;

    // Apply DM adjustments
    dmInputs.forEach(input => {
      if (input.inputType === DmInputType.GDP_ADJUSTMENT) {
        effectiveGrowthRate += input.value;
      } else if (input.inputType === DmInputType.GROWTH_RATE_MODIFIER) {
        effectiveGrowthRate *= (1 + input.value);
      }
    });

    // Cap growth rate
    effectiveGrowthRate = Math.min(effectiveGrowthRate, maxGrowthRate);
    effectiveGrowthRate = Math.max(effectiveGrowthRate, -0.1); // Prevent extreme negative growth

    // Apply logarithmic growth for very high GDP countries
    if (baseGdpPerCapita > 60000) {
      const diminishingFactor = Math.log(baseGdpPerCapita / 60000 + 1) / Math.log(2);
      effectiveGrowthRate /= diminishingFactor;
    }

    return baseGdpPerCapita * Math.pow(1 + effectiveGrowthRate, years);
  }

  /**
   * Determine economic tier based on GDP per capita
   */
  private calculateEconomicTier(gdpPerCapita: number): EconomicTier {
    const thresholds = this.config.economicTierThresholds;
    
    if (gdpPerCapita >= thresholds.advanced) return EconomicTier.ADVANCED;
    if (gdpPerCapita >= thresholds.developed) return EconomicTier.DEVELOPED;
    if (gdpPerCapita >= thresholds.emerging) return EconomicTier.EMERGING;
    return EconomicTier.DEVELOPING;
  }

  /**
   * Determine population tier based on population size
   */
  private calculatePopulationTier(population: number): PopulationTier {
    const thresholds = this.config.populationTierThresholds;
    
    if (population >= thresholds.large) return PopulationTier.MASSIVE;
    if (population >= thresholds.medium) return PopulationTier.LARGE;
    if (population >= thresholds.small) return PopulationTier.MEDIUM;
    if (population >= thresholds.micro) return PopulationTier.SMALL;
    return PopulationTier.MICRO;
  }

  /**
   * Get DM inputs that are active during a time period
   */
  private getActiveDmInputs(dmInputs: DmInputs[], startTime: number, endTime: number): DmInputs[] {
    return dmInputs.filter(input => {
      const inputTime = input.ixTimeTimestamp;
      const inputEndTime = input.duration 
        ? IxTime.addYears(inputTime, input.duration)
        : inputTime;
      
      return inputTime <= endTime && inputEndTime >= startTime;
    });
  }

  /**
   * Apply special modifiers from DM inputs
   */
  private applySpecialModifiers(stats: CountryStats, dmInputs: DmInputs[]): CountryStats {
    let modifiedStats = { ...stats };

    dmInputs.forEach(input => {
      switch (input.inputType) {
        case DmInputType.NATURAL_DISASTER:
          // Temporary negative impact on population and GDP
          modifiedStats.currentPopulation *= (1 + input.value);
          modifiedStats.currentTotalGdp *= (1 + input.value * 1.5); // GDP hit harder
          break;
          
        case DmInputType.TRADE_AGREEMENT:
          // Boost to GDP growth
          modifiedStats.currentGdpPerCapita *= (1 + input.value);
          break;
          
        case DmInputType.ECONOMIC_POLICY:
          // Various effects depending on value
          modifiedStats.localGrowthFactor *= (1 + input.value);
          break;
      }
    });

    // Recalculate total GDP after modifications
    modifiedStats.currentTotalGdp = modifiedStats.currentPopulation * modifiedStats.currentGdpPerCapita;

    return modifiedStats;
  }

  /**
   * Create historical data point from current stats
   */
  createHistoricalDataPoint(stats: CountryStats): HistoricalDataPoint {
    return {
      ixTimeTimestamp: stats.lastCalculated,
      population: stats.currentPopulation,
      gdpPerCapita: stats.currentGdpPerCapita,
      totalGdp: stats.currentTotalGdp,
      populationGrowthRate: stats.populationGrowthRate,
      gdpGrowthRate: stats.adjustedGdpGrowth
    };
  }

  /**
   * Update config (useful for DM adjustments to global factors)
   */
  updateConfig(newConfig: Partial<EconomicConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}