// src/lib/calculations.ts
// src/lib/calculations.ts
import { IxTime } from './ixtime';
// Corrected import for enums used as values
import { 
  DmInputType, 
  EconomicTier, 
  PopulationTier 
} from '../types/ixstats';
// Types that are only used as types can remain `import type`
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
  private baselineDate: number; // IxTime timestamp

  constructor(config: EconomicConfig, baselineDate?: number) {
    this.config = config;
    this.baselineDate = baselineDate || IxTime.getCurrentIxTime();
  }

  initializeCountryStats(baseData: BaseCountryData): CountryStats {
    const totalGdp = baseData.population * baseData.gdpPerCapita;
    const currentIxTimeMs = IxTime.getCurrentIxTime();
    
    const landArea = baseData.landArea || 0;
    const populationDensity = landArea > 0 ? baseData.population / landArea : undefined;
    const gdpDensity = landArea > 0 ? totalGdp / landArea : undefined;

    return {
      ...baseData,
      landArea,
      totalGdp,
      currentPopulation: baseData.population,
      currentGdpPerCapita: baseData.gdpPerCapita,
      currentTotalGdp: totalGdp,
      lastCalculated: currentIxTimeMs,
      baselineDate: currentIxTimeMs,
      economicTier: this.calculateEconomicTier(baseData.gdpPerCapita),
      populationTier: this.calculatePopulationTier(baseData.population),
      populationDensity,
      gdpDensity,
      localGrowthFactor: 1.0, 
      globalGrowthFactor: this.config.globalGrowthFactor || 1.0
    };
  }

  calculateTimeProgression(
    currentStats: CountryStats,
    targetTime?: number, 
    dmInputs: DmInputRecord[] = []
  ): StatsCalculationResult {
    const nowIxTimeMs = targetTime || IxTime.getCurrentIxTime();
    const yearsElapsed = IxTime.getYearsElapsed(currentStats.lastCalculated, nowIxTimeMs);
    
    if (yearsElapsed <= 0) {
      return {
        country: currentStats.country,
        oldStats: currentStats,
        newStats: { ...currentStats, lastCalculated: nowIxTimeMs },
        timeElapsed: 0,
        calculationDate: nowIxTimeMs
      };
    }

    const oldStats = { ...currentStats };
    const activeDmInputs = this.getActiveDmInputs(dmInputs, currentStats.lastCalculated, nowIxTimeMs);
    
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


    const updatedBaseStats: CountryStats = {
      ...currentStats,
      currentPopulation: newPopulation,
      currentGdpPerCapita: newGdpPerCapita,
      currentTotalGdp: newTotalGdp,
      economicTier: newEconomicTier,
      populationTier: newPopulationTier,
      populationDensity: newPopulationDensity,
      gdpDensity: newGdpDensity,
      lastCalculated: nowIxTimeMs
    };
    
    const modifiedStats = this.applySpecialModifiers(updatedBaseStats, activeDmInputs);
    
    // Recalculate densities if modifiers changed population or GDP
    if (modifiedStats.currentPopulation !== updatedBaseStats.currentPopulation || modifiedStats.currentTotalGdp !== updatedBaseStats.currentTotalGdp) {
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

  private calculatePopulationGrowth(
    basePopulation: number,
    growthRate: number,
    years: number,
    dmInputs: DmInputRecord[]
  ): number {
    let adjustedRate = growthRate;
    dmInputs.forEach(input => {
      if (input.inputType === DmInputType.POPULATION_ADJUSTMENT) {
        adjustedRate += input.value;
      }
    });
    return basePopulation * Math.pow(1 + adjustedRate, years);
  }

  private calculateGdpPerCapitaGrowth(
    baseGdpPerCapita: number,
    adjustedGrowth: number,
    maxGrowthRate: number,
    tier: EconomicTier,
    years: number,
    dmInputs: DmInputRecord[]
  ): number {
    let effectiveGrowthRate = adjustedGrowth;
    
    const tierModifier = this.config.tierGrowthModifiers[tier] || 1.0;
    effectiveGrowthRate *= tierModifier;
    effectiveGrowthRate *= this.config.globalGrowthFactor;

    dmInputs.forEach(input => {
      if (input.inputType === DmInputType.GDP_ADJUSTMENT) {
        effectiveGrowthRate += input.value;
      } else if (input.inputType === DmInputType.GROWTH_RATE_MODIFIER) {
        effectiveGrowthRate *= (1 + input.value);
      }
    });

    effectiveGrowthRate = Math.min(effectiveGrowthRate, maxGrowthRate);
    effectiveGrowthRate = Math.max(effectiveGrowthRate, -0.1);

    if (baseGdpPerCapita > 60000) {
      const diminishingFactor = Math.log(baseGdpPerCapita / 60000 + 1) / Math.log(2);
      effectiveGrowthRate /= (1 + diminishingFactor * 0.5);
    }

    return baseGdpPerCapita * Math.pow(1 + effectiveGrowthRate, years);
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
      const inputTime = input.ixTimeTimestamp;
      const inputEndTime = input.duration 
        ? IxTime.addYears(inputTime, input.duration)
        : inputTime;
      return inputTime <= endTime && (input.duration ? inputEndTime >= startTime : inputTime >= startTime);
    });
  }

  private applySpecialModifiers(stats: CountryStats, dmInputs: DmInputRecord[]): CountryStats {
    let modifiedStats = { ...stats };
    dmInputs.forEach(input => {
      switch (input.inputType) {
        case DmInputType.NATURAL_DISASTER:
          modifiedStats.currentPopulation *= (1 + input.value);
          modifiedStats.currentTotalGdp *= (1 + input.value * 1.5);
          break;
        case DmInputType.TRADE_AGREEMENT:
          modifiedStats.currentGdpPerCapita *= (1 + input.value); 
          break;
        case DmInputType.ECONOMIC_POLICY:
          modifiedStats.localGrowthFactor *= (1 + input.value);
          break;
      }
    });

    if (modifiedStats.currentPopulation !== stats.currentPopulation || modifiedStats.currentGdpPerCapita !== stats.currentGdpPerCapita) {
         modifiedStats.currentTotalGdp = modifiedStats.currentPopulation * modifiedStats.currentGdpPerCapita;
    }
    modifiedStats.economicTier = this.calculateEconomicTier(modifiedStats.currentGdpPerCapita);
    modifiedStats.populationTier = this.calculatePopulationTier(modifiedStats.currentPopulation);
    // Densities will be recalculated after this if needed

    return modifiedStats;
  }

  createHistoricalDataPoint(stats: CountryStats): HistoricalDataPoint {
    return {
      ixTimeTimestamp: stats.lastCalculated,
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
}