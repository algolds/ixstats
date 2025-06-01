// src/lib/calculations.ts
// FIXED: Proper percentage handling and updated tier classifications

import { IxTime } from './ixtime';
import type { 
  BaseCountryData, 
  CountryStats, 
  EconomicConfig, 
  DmInputs as DmInputRecord,
  HistoricalDataPoint 
} from '../types/ixstats';

// FIXED: Updated tier enums to match user specifications
export enum EconomicTier {
  IMPOVERISHED = "Impoverished",
  DEVELOPING = "Developing", 
  DEVELOPED = "Developed",
  HEALTHY = "Healthy",
  STRONG = "Strong",
  VERY_STRONG = "Very Strong",
  EXTRAVAGANT = "Extravagant"
}

export enum PopulationTier {
  TIER_1 = "1",
  TIER_2 = "2", 
  TIER_3 = "3",
  TIER_4 = "4",
  TIER_5 = "5",
  TIER_6 = "6",
  TIER_7 = "7",
  TIER_X = "X"
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

export interface StatsCalculationResult {
  country: string;
  oldStats: Partial<CountryStats>;
  newStats: CountryStats;
  timeElapsed: number;
  calculationDate: number;
}

export class IxStatsCalculator {
  private config: EconomicConfig;
  private baselineDate: number;

  constructor(config: EconomicConfig, baselineDate?: number) {
    this.config = config;
    this.baselineDate = baselineDate || IxTime.getInGameEpoch();
  }

  /**
   * FIXED: Initialize country stats with proper growth rate handling
   */
  initializeCountryStats(baseData: BaseCountryData): CountryStats {
    const totalGdp = baseData.population * baseData.gdpPerCapita;
    const gameEpoch = IxTime.getInGameEpoch();
    
    const landArea = baseData.landArea || 0;
    const populationDensity = landArea > 0 ? baseData.population / landArea : undefined;
    const gdpDensity = landArea > 0 ? totalGdp / landArea : undefined;

    // FIXED: Growth rates are already in decimal form from parser (0.005 for 0.5%)
    // No conversion needed - they're ready for calculations
    const populationGrowthDecimal = this.validateGrowthRate(baseData.populationGrowthRate);
    const maxGdpGrowthDecimal = this.validateGrowthRate(baseData.maxGdpGrowthRate);
    const adjustedGdpGrowthDecimal = this.validateGrowthRate(baseData.adjustedGdpGrowth);
    const actualGdpGrowthDecimal = baseData.actualGdpGrowth ? this.validateGrowthRate(baseData.actualGdpGrowth) : 0;

    return {
      // Basic country data
      country: baseData.country,
      continent: baseData.continent,
      region: baseData.region,
      governmentType: baseData.governmentType,
      religion: baseData.religion,
      leader: baseData.leader,
      
      // Area information
      landArea,
      areaSqMi: baseData.areaSqMi,
      
      // Growth rates (stored as decimals for calculations)
      maxGdpGrowthRate: maxGdpGrowthDecimal,
      adjustedGdpGrowth: adjustedGdpGrowthDecimal,
      populationGrowthRate: populationGrowthDecimal,
      actualGdpGrowth: actualGdpGrowthDecimal,
      
      // Required fields
      projected2040Population: baseData.projected2040Population || 0,
      projected2040Gdp: baseData.projected2040Gdp || 0,
      projected2040GdpPerCapita: baseData.projected2040GdpPerCapita || 0,
      
      // Baseline values
      population: baseData.population,
      gdpPerCapita: baseData.gdpPerCapita,
      
      name: baseData.country,
      totalGdp,
      
      // Current stats start as baseline stats
      currentPopulation: baseData.population,
      currentGdpPerCapita: baseData.gdpPerCapita,
      currentTotalGdp: totalGdp,
      
      // Timestamps
      lastCalculated: new Date(gameEpoch),
      baselineDate: new Date(gameEpoch),
      
      // FIXED: Use updated tier calculations
      economicTier: this.calculateEconomicTier(baseData.gdpPerCapita),
      populationTier: this.calculatePopulationTier(baseData.population),
      populationDensity,
      gdpDensity,
      localGrowthFactor: baseData.localGrowthFactor || 1.0,
      globalGrowthFactor: this.config.globalGrowthFactor || 1.0
    };
  }

  /**
   * FIXED: Validate growth rates (already in decimal form)
   */
  private validateGrowthRate(rate: number): number {
    const numValue = Number(rate);
    if (!isFinite(numValue) || isNaN(numValue)) return 0;
    
    // Growth rates should be reasonable decimals
    // Cap at -50% to +50% annually
    return Math.min(Math.max(numValue, -0.5), 0.5);
  }

  /**
   * Calculate country stats for a specific point in time
   */
  calculateTimeProgression(
    baselineStats: CountryStats,
    targetTime?: number, 
    dmInputs: DmInputRecord[] = []
  ): StatsCalculationResult {
    const targetTimeMs = targetTime || IxTime.getCurrentIxTime();
    const baselineTimeMs = this.baselineDate;
    
    const yearsFromBaseline = IxTime.getYearsElapsed(baselineTimeMs, targetTimeMs);
    
    if (Math.abs(yearsFromBaseline) < 0.001) {
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
    
    const newPopulation = this.calculatePopulationProgression(
      baselineStats.population,
      baselineStats.populationGrowthRate,
      yearsFromBaseline,
      activeDmInputs
    );

    const newGdpPerCapita = this.calculateGdpPerCapitaProgression(
      baselineStats.gdpPerCapita,
      baselineStats.adjustedGdpGrowth,
      baselineStats.maxGdpGrowthRate,
      baselineStats.economicTier as EconomicTier,
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

  private calculatePopulationProgression(
    baselinePopulation: number,
    growthRateDecimal: number,
    yearsFromBaseline: number,
    dmInputs: DmInputRecord[]
  ): number {
    let adjustedRate = growthRateDecimal;
    
    dmInputs.forEach(input => {
      const inputValue = this.validateGrowthRate(input.value);
      if (input.inputType === DmInputType.POPULATION_ADJUSTMENT) {
        adjustedRate += inputValue;
      }
    });
    
    return baselinePopulation * Math.pow(1 + adjustedRate, yearsFromBaseline);
  }

  private calculateGdpPerCapitaProgression(
    baselineGdpPerCapita: number,
    adjustedGrowthDecimal: number,
    maxGrowthRateDecimal: number,
    tier: EconomicTier,
    yearsFromBaseline: number,
    dmInputs: DmInputRecord[]
  ): number {
    let effectiveGrowthRate = adjustedGrowthDecimal;
    
    // Apply tier and global modifiers
    const tierModifier = this.config.tierGrowthModifiers[tier] || 1.0;
    effectiveGrowthRate *= tierModifier;
    effectiveGrowthRate *= this.config.globalGrowthFactor;

    dmInputs.forEach(input => {
      const inputValue = this.validateGrowthRate(input.value);
      if (input.inputType === DmInputType.GDP_ADJUSTMENT) {
        effectiveGrowthRate += inputValue;
      } else if (input.inputType === DmInputType.GROWTH_RATE_MODIFIER) {
        effectiveGrowthRate *= (1 + inputValue);
      }
    });

    // Apply growth rate caps
    effectiveGrowthRate = Math.min(effectiveGrowthRate, maxGrowthRateDecimal);
    effectiveGrowthRate = Math.max(effectiveGrowthRate, -0.1);

    // Apply diminishing returns for very high GDP per capita
    if (yearsFromBaseline > 0 && baselineGdpPerCapita > 60000) {
      const diminishingFactor = Math.log(baselineGdpPerCapita / 60000 + 1) / Math.log(2);
      effectiveGrowthRate /= (1 + diminishingFactor * 0.5);
    }

    return baselineGdpPerCapita * Math.pow(1 + effectiveGrowthRate, yearsFromBaseline);
  }

  /**
   * FIXED: Updated economic tier calculation per user specifications
   */
  private calculateEconomicTier(gdpPerCapita: number): EconomicTier {
    if (gdpPerCapita >= 65000) return EconomicTier.EXTRAVAGANT;
    if (gdpPerCapita >= 55000) return EconomicTier.VERY_STRONG;
    if (gdpPerCapita >= 45000) return EconomicTier.STRONG;
    if (gdpPerCapita >= 35000) return EconomicTier.HEALTHY;
    if (gdpPerCapita >= 25000) return EconomicTier.DEVELOPED;
    if (gdpPerCapita >= 10000) return EconomicTier.DEVELOPING;
    return EconomicTier.IMPOVERISHED;
  }

  /**
   * FIXED: Updated population tier calculation per user specifications
   */
  private calculatePopulationTier(population: number): PopulationTier {
    if (population >= 500_000_000) return PopulationTier.TIER_X;
    if (population >= 350_000_000) return PopulationTier.TIER_7;
    if (population >= 120_000_000) return PopulationTier.TIER_6;
    if (population >= 80_000_000) return PopulationTier.TIER_5;
    if (population >= 50_000_000) return PopulationTier.TIER_4;
    if (population >= 30_000_000) return PopulationTier.TIER_3;
    if (population >= 10_000_000) return PopulationTier.TIER_2;
    return PopulationTier.TIER_1;
  }

  /**
   * Enhanced method to calculate stats relative to current time
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
    
    const newPopulation = this.calculatePopulationProgression(
      currentStats.currentPopulation,
      currentStats.populationGrowthRate,
      yearsElapsed,
      activeDmInputs
    );

    const newGdpPerCapita = this.calculateGdpPerCapitaProgression(
      currentStats.currentGdpPerCapita,
      currentStats.adjustedGdpGrowth,
      currentStats.maxGdpGrowthRate,
      currentStats.economicTier as EconomicTier,
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

  private getActiveDmInputs(dmInputs: DmInputRecord[], startTime: number, endTime: number): DmInputRecord[] {
    return dmInputs.filter(input => {
      const inputTime = input.ixTimeTimestamp instanceof Date 
        ? input.ixTimeTimestamp.getTime() 
        : input.ixTimeTimestamp;
      
      if (inputTime > endTime) return false;
      
      if (input.duration) {
        const inputEndTime = IxTime.addYears(inputTime, input.duration);
        return inputEndTime >= startTime;
      }
      
      return inputTime <= endTime;
    });
  }

  private applySpecialModifiers(stats: CountryStats, dmInputs: DmInputRecord[]): CountryStats {
    let modifiedStats = { ...stats };
    
    dmInputs.forEach(input => {
      const inputValue = this.validateGrowthRate(input.value);
      switch (input.inputType) {
        case DmInputType.NATURAL_DISASTER:
          modifiedStats.currentPopulation *= (1 + inputValue);
          modifiedStats.currentTotalGdp *= (1 + inputValue * 1.5);
          break;
          
        case DmInputType.TRADE_AGREEMENT:
          modifiedStats.currentGdpPerCapita *= (1 + inputValue); 
          break;
          
        case DmInputType.ECONOMIC_POLICY:
          modifiedStats.localGrowthFactor *= (1 + inputValue);
          break;
          
        case DmInputType.SPECIAL_EVENT:
          modifiedStats.currentPopulation *= (1 + inputValue * 0.5);
          modifiedStats.currentGdpPerCapita *= (1 + inputValue * 0.8);
          break;
      }
    });

    if (modifiedStats.currentPopulation !== stats.currentPopulation || 
        modifiedStats.currentGdpPerCapita !== stats.currentGdpPerCapita) {
      modifiedStats.currentTotalGdp = modifiedStats.currentPopulation * modifiedStats.currentGdpPerCapita;
    }
    
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

  getBaselineDate(): number {
    return this.baselineDate;
  }

  isHistoricalTime(targetTime: number): boolean {
    return targetTime < this.baselineDate;
  }

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

  /**
   * FIXED: Helper to get growth rates in percentage form for display
   * Converts internal decimal rates to percentages for UI display
   */
  getGrowthRateAsPercentage(decimalRate: number): number {
    return decimalRate * 100;
  }
}