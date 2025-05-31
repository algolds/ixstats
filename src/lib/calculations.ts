// src/lib/calculations.ts
// Updated calculations with reduced field set (no projected 2040 fields)

import { IxTime } from './ixtime';
import { 
  DmInputType, 
  EconomicTier, 
  PopulationTier 
} from '../types/ixstats';
import type { 
  BaseCountryData, 
  CountryStats, 
  EconomicConfig, 
  DmInputs as DmInputRecord,
  HistoricalDataPoint 
} from '../types/ixstats';

export interface StatsCalculationResult {
  country: string;
  oldStats: Partial<CountryStats>;
  newStats: CountryStats;
  timeElapsed: number;
  calculationDate: number; // IxTime timestamp
}

export class IxStatsCalculator {
  private config: EconomicConfig;
  private baselineDate: number; // IxTime timestamp for roster baseline (January 1, 2028)

  constructor(config: EconomicConfig, baselineDate?: number) {
    this.config = config;
    // If no baseline provided, use the in-game epoch (January 1, 2028)
    // This is when the roster data represents - the "in-game year zero"
    this.baselineDate = baselineDate || IxTime.getInGameEpoch();
  }

  /**
   * Initialize country stats from roster data
   * Roster data represents stats as of January 1, 2028 (in-game epoch)
   */
  initializeCountryStats(baseData: BaseCountryData): CountryStats {
    const totalGdp = baseData.population * baseData.gdpPerCapita;
    const gameEpoch = IxTime.getInGameEpoch(); // January 1, 2028
    
    const landArea = baseData.landArea || 0;
    const populationDensity = landArea > 0 ? baseData.population / landArea : undefined;
    const gdpDensity = landArea > 0 ? totalGdp / landArea : undefined;

    return {
      // Basic country data
      country: baseData.country,
      continent: baseData.continent,
      region: baseData.region,
      projected2040Population: baseData.population,
      projected2040Gdp: totalGdp,
      projected2040GdpPerCapita: baseData.gdpPerCapita,
      actualGdpGrowth: baseData.adjustedGdpGrowth,
      governmentType: baseData.governmentType,
      religion: baseData.religion,
      leader: baseData.leader,
      
      // Area information
      landArea,
      areaSqMi: baseData.areaSqMi,
      
      // Growth rates from Excel
      maxGdpGrowthRate: baseData.maxGdpGrowthRate,
      adjustedGdpGrowth: baseData.adjustedGdpGrowth,
      populationGrowthRate: baseData.populationGrowthRate,
      
      // Baseline values (from roster - represents 2028 baseline)
      population: baseData.population,
      gdpPerCapita: baseData.gdpPerCapita,
      
      name: baseData.country,
      totalGdp,
      
      // Current stats start as baseline stats (roster data)
      currentPopulation: baseData.population,
      currentGdpPerCapita: baseData.gdpPerCapita,
      currentTotalGdp: totalGdp,
      
      // Baseline date is January 1, 2028 (when roster data represents)
      lastCalculated: new Date(gameEpoch),
      baselineDate: new Date(gameEpoch),
      
      economicTier: this.calculateEconomicTier(baseData.gdpPerCapita),
      populationTier: this.calculatePopulationTier(baseData.population),
      populationDensity,
      gdpDensity,
      localGrowthFactor: 1.0, 
      globalGrowthFactor: this.config.globalGrowthFactor || 1.0
    };
  }

  /**
   * Calculate country stats for a specific point in time
   * This handles both historical (before baseline) and future projections
   */
  calculateTimeProgression(
    baselineStats: CountryStats,
    targetTime?: number, 
    dmInputs: DmInputRecord[] = []
  ): StatsCalculationResult {
    const targetTimeMs = targetTime || IxTime.getCurrentIxTime();
    const baselineTimeMs = this.baselineDate;
    
    // Calculate years from baseline (January 1, 2028) to target time
    // Negative means going back before roster data baseline
    // Positive means projecting forward from roster data baseline
    const yearsFromBaseline = IxTime.getYearsElapsed(baselineTimeMs, targetTimeMs);
    
    if (Math.abs(yearsFromBaseline) < 0.001) { // Essentially no time change
      return {
        country: baselineStats.country,
        oldStats: baselineStats,
        newStats: { 
          ...baselineStats, 
          lastCalculated: new Date(targetTimeMs)
        },
        timeElapsed: 0,
        calculationDate: targetTimeMs
      };
    }

    const oldStats = { ...baselineStats };
    const activeDmInputs = this.getActiveDmInputs(dmInputs, baselineTimeMs, targetTimeMs);
    
    // Calculate progression from baseline
    const newPopulation = this.calculatePopulationProgression(
      baselineStats.population, // Use original roster population as baseline
      baselineStats.populationGrowthRate,
      yearsFromBaseline,
      activeDmInputs
    );

    const newGdpPerCapita = this.calculateGdpPerCapitaProgression(
      baselineStats.gdpPerCapita, // Use original roster GDP per capita as baseline
      baselineStats.adjustedGdpGrowth,
      baselineStats.maxGdpGrowthRate,
      baselineStats.economicTier,
      yearsFromBaseline,
      activeDmInputs
    );

    const newTotalGdp = newPopulation * newGdpPerCapita;
    const newEconomicTier = this.calculateEconomicTier(newGdpPerCapita);
    const newPopulationTier = this.calculatePopulationTier(newPopulation);
    
    const landArea = baselineStats.landArea || 0;
    const newPopulationDensity = landArea > 0 ? newPopulation / landArea : undefined;
    const newGdpDensity = landArea > 0 ? newTotalGdp / landArea : undefined;

    const updatedStats: CountryStats = {
      ...baselineStats,
      currentPopulation: newPopulation,
      currentGdpPerCapita: newGdpPerCapita,
      currentTotalGdp: newTotalGdp,
      economicTier: newEconomicTier,
      populationTier: newPopulationTier,
      populationDensity: newPopulationDensity,
      gdpDensity: newGdpDensity,
      lastCalculated: new Date(targetTimeMs)
    };
    
    const modifiedStats = this.applySpecialModifiers(updatedStats, activeDmInputs);
    
    // Recalculate densities if modifiers changed population or GDP
    if (modifiedStats.currentPopulation !== updatedStats.currentPopulation || 
        modifiedStats.currentTotalGdp !== updatedStats.currentTotalGdp) {
      modifiedStats.populationDensity = landArea > 0 ? modifiedStats.currentPopulation / landArea : undefined;
      modifiedStats.gdpDensity = landArea > 0 ? modifiedStats.currentTotalGdp / landArea : undefined;
    }

    return {
      country: baselineStats.country,
      oldStats,
      newStats: modifiedStats,
      timeElapsed: Math.abs(yearsFromBaseline),
      calculationDate: targetTimeMs
    };
  }

  /**
   * Calculate population progression from baseline (can be negative for historical)
   */
  private calculatePopulationProgression(
    baselinePopulation: number,
    growthRate: number,
    yearsFromBaseline: number,
    dmInputs: DmInputRecord[]
  ): number {
    let adjustedRate = growthRate;
    
    // Apply DM input modifications
    dmInputs.forEach(input => {
      if (input.inputType === DmInputType.POPULATION_ADJUSTMENT) {
        adjustedRate += input.value;
      }
    });
    
    // Use compound growth/decline formula
    // For negative years, this naturally calculates backwards
    return baselinePopulation * Math.pow(1 + adjustedRate, yearsFromBaseline);
  }

  /**
   * Calculate GDP per capita progression from baseline (can be negative for historical)
   */
  private calculateGdpPerCapitaProgression(
    baselineGdpPerCapita: number,
    adjustedGrowth: number,
    maxGrowthRate: number,
    tier: EconomicTier,
    yearsFromBaseline: number,
    dmInputs: DmInputRecord[]
  ): number {
    let effectiveGrowthRate = adjustedGrowth;
    
    // Apply tier and global modifiers
    const tierModifier = this.config.tierGrowthModifiers[tier] || 1.0;
    effectiveGrowthRate *= tierModifier;
    effectiveGrowthRate *= this.config.globalGrowthFactor;

    // Apply DM input modifications
    dmInputs.forEach(input => {
      if (input.inputType === DmInputType.GDP_ADJUSTMENT) {
        effectiveGrowthRate += input.value;
      } else if (input.inputType === DmInputType.GROWTH_RATE_MODIFIER) {
        effectiveGrowthRate *= (1 + input.value);
      }
    });

    // Apply growth rate caps
    effectiveGrowthRate = Math.min(effectiveGrowthRate, maxGrowthRate);
    effectiveGrowthRate = Math.max(effectiveGrowthRate, -0.1); // Max 10% annual decline

    // Apply diminishing returns for very high GDP per capita
    // Only apply this for positive growth periods
    if (yearsFromBaseline > 0 && baselineGdpPerCapita > 60000) {
      const diminishingFactor = Math.log(baselineGdpPerCapita / 60000 + 1) / Math.log(2);
      effectiveGrowthRate /= (1 + diminishingFactor * 0.5);
    }

    // Use compound growth/decline formula
    return baselineGdpPerCapita * Math.pow(1 + effectiveGrowthRate, yearsFromBaseline);
  }

  /**
   * Enhanced method to calculate stats relative to current time
   * This is useful for the existing update systems that work from "current" state
   */
  calculateCurrentTimeProgression(
    currentStats: CountryStats,
    targetTime?: number, 
    dmInputs: DmInputRecord[] = []
  ): StatsCalculationResult {
    const nowIxTimeMs = targetTime || IxTime.getCurrentIxTime();
    const lastCalculatedMs = currentStats.lastCalculated instanceof Date 
      ? currentStats.lastCalculated.getTime() 
      : currentStats.lastCalculated;
    
    const yearsElapsed = IxTime.getYearsElapsed(lastCalculatedMs, nowIxTimeMs);
    
    if (yearsElapsed <= 0) {
      return {
        country: currentStats.country,
        oldStats: currentStats,
        newStats: { 
          ...currentStats, 
          lastCalculated: new Date(nowIxTimeMs) 
        },
        timeElapsed: 0,
        calculationDate: nowIxTimeMs
      };
    }

    const oldStats = { ...currentStats };
    const activeDmInputs = this.getActiveDmInputs(dmInputs, lastCalculatedMs, nowIxTimeMs);
    
    const newPopulation = this.calculatePopulationGrowth(
      currentStats.currentPopulation,
      currentStats.populationGrowthRate,
      yearsElapsed,
      activeDmInputs
    );

    const newGdpPerCapita = this.calculateGdpPerCapitaGrowth(
      currentStats.currentGdpPerCapita,
      currentStats.adjustedGdpGrowth,
      currentStats.maxGdpGrowthRate,
      currentStats.economicTier,
      yearsElapsed,
      activeDmInputs
    );

    const newTotalGdp = newPopulation * newGdpPerCapita;
    const newEconomicTier = this.calculateEconomicTier(newGdpPerCapita);
    const newPopulationTier = this.calculatePopulationTier(newPopulation);
    
    const landArea = currentStats.landArea || 0;
    const newPopulationDensity = landArea > 0 ? newPopulation / landArea : undefined;
    const newGdpDensity = landArea > 0 ? newTotalGdp / landArea : undefined;

    const updatedStats: CountryStats = {
      ...currentStats,
      currentPopulation: newPopulation,
      currentGdpPerCapita: newGdpPerCapita,
      currentTotalGdp: newTotalGdp,
      economicTier: newEconomicTier,
      populationTier: newPopulationTier,
      populationDensity: newPopulationDensity,
      gdpDensity: newGdpDensity,
      lastCalculated: new Date(nowIxTimeMs)
    };
    
    const modifiedStats = this.applySpecialModifiers(updatedStats, activeDmInputs);
    
    // Recalculate densities if modifiers changed population or GDP
    if (modifiedStats.currentPopulation !== updatedStats.currentPopulation || 
        modifiedStats.currentTotalGdp !== updatedStats.currentTotalGdp) {
      modifiedStats.populationDensity = landArea > 0 ? modifiedStats.currentPopulation / landArea : undefined;
      modifiedStats.gdpDensity = landArea > 0 ? modifiedStats.currentTotalGdp / landArea : undefined;
    }

    return {
      country: currentStats.country,
      oldStats,
      newStats: modifiedStats,
      timeElapsed: yearsElapsed,
      calculationDate: nowIxTimeMs
    };
  }

  // Legacy methods for backward compatibility
  private calculatePopulationGrowth(
    basePopulation: number,
    growthRate: number,
    years: number,
    dmInputs: DmInputRecord[]
  ): number {
    return this.calculatePopulationProgression(basePopulation, growthRate, years, dmInputs);
  }

  private calculateGdpPerCapitaGrowth(
    baseGdpPerCapita: number,
    adjustedGrowth: number,
    maxGrowthRate: number,
    tier: EconomicTier,
    years: number,
    dmInputs: DmInputRecord[]
  ): number {
    return this.calculateGdpPerCapitaProgression(
      baseGdpPerCapita, adjustedGrowth, maxGrowthRate, tier, years, dmInputs
    );
  }

  private calculateEconomicTier(gdpPerCapita: number): EconomicTier {
    const thresholds = this.config.economicTierThresholds;
    if (gdpPerCapita >= thresholds.advanced) return EconomicTier.ADVANCED;
    if (gdpPerCapita >= thresholds.developed) return EconomicTier.DEVELOPED;
    if (gdpPerCapita >= thresholds.emerging) return EconomicTier.EMERGING;
    return EconomicTier.DEVELOPING;
  }

  private calculatePopulationTier(population: number): PopulationTier {
    const thresholds = this.config.populationTierThresholds;
    if (population >= thresholds.large) return PopulationTier.MASSIVE;
    if (population >= thresholds.medium) return PopulationTier.LARGE;
    if (population >= thresholds.small) return PopulationTier.MEDIUM;
    if (population >= thresholds.micro) return PopulationTier.SMALL;
    return PopulationTier.MICRO;
  }

  private getActiveDmInputs(dmInputs: DmInputRecord[], startTime: number, endTime: number): DmInputRecord[] {
    return dmInputs.filter(input => {
      const inputTime = input.ixTimeTimestamp instanceof Date 
        ? input.ixTimeTimestamp.getTime() 
        : input.ixTimeTimestamp;
      
      // Input must have been created before or at the end time
      if (inputTime > endTime) return false;
      
      // If input has duration, check if it's still active during the period
      if (input.duration) {
        const inputEndTime = IxTime.addYears(inputTime, input.duration);
        return inputEndTime >= startTime; // Input effect ends after or during the period
      }
      
      // Permanent inputs are active if they were created before the end time
      return inputTime <= endTime;
    });
  }

  private applySpecialModifiers(stats: CountryStats, dmInputs: DmInputRecord[]): CountryStats {
    let modifiedStats = { ...stats };
    
    dmInputs.forEach(input => {
      switch (input.inputType) {
        case DmInputType.NATURAL_DISASTER:
          // Natural disasters typically reduce both population and GDP
          modifiedStats.currentPopulation *= (1 + input.value);
          modifiedStats.currentTotalGdp *= (1 + input.value * 1.5); // GDP hit harder
          break;
          
        case DmInputType.TRADE_AGREEMENT:
          // Trade agreements typically boost GDP per capita
          modifiedStats.currentGdpPerCapita *= (1 + input.value); 
          break;
          
        case DmInputType.ECONOMIC_POLICY:
          // Economic policies modify the local growth factor
          modifiedStats.localGrowthFactor *= (1 + input.value);
          break;
          
        case DmInputType.SPECIAL_EVENT:
          // Special events can have varied effects - apply as population modifier
          modifiedStats.currentPopulation *= (1 + input.value * 0.5);
          modifiedStats.currentGdpPerCapita *= (1 + input.value * 0.8);
          break;
      }
    });

    // Recalculate total GDP if individual components changed
    if (modifiedStats.currentPopulation !== stats.currentPopulation || 
        modifiedStats.currentGdpPerCapita !== stats.currentGdpPerCapita) {
      modifiedStats.currentTotalGdp = modifiedStats.currentPopulation * modifiedStats.currentGdpPerCapita;
    }
    
    // Recalculate tiers if stats changed significantly
    modifiedStats.economicTier = this.calculateEconomicTier(modifiedStats.currentGdpPerCapita);
    modifiedStats.populationTier = this.calculatePopulationTier(modifiedStats.currentPopulation);

    return modifiedStats;
  }

  createHistoricalDataPoint(stats: CountryStats, ixTime?: number): HistoricalDataPoint {
    const timestamp = ixTime || (stats.lastCalculated instanceof Date 
      ? stats.lastCalculated.getTime() 
      : stats.lastCalculated);
      
    return {
      ixTimeTimestamp: new Date(timestamp),
      population: stats.currentPopulation,
      gdpPerCapita: stats.currentGdpPerCapita,
      totalGdp: stats.currentTotalGdp,
      populationGrowthRate: stats.populationGrowthRate,
      gdpGrowthRate: stats.adjustedGdpGrowth,
      landArea: stats.landArea,
      populationDensity: stats.populationDensity,
      gdpDensity: stats.gdpDensity,
    };
  }

  updateConfig(newConfig: Partial<EconomicConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get the baseline date for this calculator (January 1, 2028)
   */
  getBaselineDate(): number {
    return this.baselineDate;
  }

  /**
   * Helper method to determine if a target time is before or after baseline
   */
  isHistoricalTime(targetTime: number): boolean {
    return targetTime < this.baselineDate;
  }

  /**
   * Get a description of the time relationship to baseline
   */
  getTimeDescription(targetTime: number): string {
    const yearsFromBaseline = IxTime.getYearsElapsed(this.baselineDate, targetTime);
    
    if (Math.abs(yearsFromBaseline) < 0.1) {
      return "Baseline Period (Roster Data)";
    } else if (yearsFromBaseline < 0) {
      return `${Math.abs(yearsFromBaseline).toFixed(1)} years before roster baseline`;
    } else {
      return `${yearsFromBaseline.toFixed(1)} years after roster baseline`;
    }
  }
}