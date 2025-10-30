// src/lib/calculations.ts
// FIXED: Proper growth factor handling and updated tier classifications

import { IxTime } from "./ixtime";
import type {
  BaseCountryData,
  CountryStats,
  EconomicConfig,
  DmInputs as DmInputRecord,
  HistoricalDataPoint,
} from "../types/ixstats";

// FIXED: Updated tier enums to match user specifications
export enum EconomicTier {
  IMPOVERISHED = "Impoverished", // $0-$9,999 (10% max growth)
  DEVELOPING = "Developing", // $10,000-$24,999 (7.50% max growth)
  DEVELOPED = "Developed", // $25,000-$34,999 (5% max growth)
  HEALTHY = "Healthy", // $35,000-$44,999 (3.50% max growth)
  STRONG = "Strong", // $45,000-$54,999 (2.75% max growth)
  VERY_STRONG = "Very Strong", // $55,000-$64,999 (1.50% max growth)
  EXTRAVAGANT = "Extravagant", // $65,000+ (0.50% max growth)
}

export enum PopulationTier {
  TIER_1 = "1", // 0-9,999,999
  TIER_2 = "2", // 10,000,000-29,999,999
  TIER_3 = "3", // 30,000,000-49,999,999
  TIER_4 = "4", // 50,000,000-79,999,999
  TIER_5 = "5", // 80,000,000-119,999,999
  TIER_6 = "6", // 120,000,000-349,999,999
  TIER_7 = "7", // 350,000,000-499,999,999
  TIER_X = "X", // 500,000,000+
}

export enum DmInputType {
  POPULATION_ADJUSTMENT = "population_adjustment",
  GDP_ADJUSTMENT = "gdp_adjustment",
  GROWTH_RATE_MODIFIER = "growth_rate_modifier",
  SPECIAL_EVENT = "special_event",
  TRADE_AGREEMENT = "trade_agreement",
  NATURAL_DISASTER = "natural_disaster",
  ECONOMIC_POLICY = "economic_policy",
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

    // FIXED: Validate and ensure growth rates are in decimal form
    const populationGrowthDecimal = this.validateGrowthRate(baseData.populationGrowthRate);
    const maxGdpGrowthDecimal = this.validateGrowthRate(baseData.maxGdpGrowthRate);
    const adjustedGdpGrowthDecimal = this.validateGrowthRate(baseData.adjustedGdpGrowth);
    const actualGdpGrowthDecimal = baseData.actualGdpGrowth
      ? this.validateGrowthRate(baseData.actualGdpGrowth)
      : 0;

    // FIXED: Determine tiers before creating stats
    const economicTier = this.calculateEconomicTier(baseData.gdpPerCapita);
    const populationTier = this.calculatePopulationTier(baseData.population);

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

      // FIXED: Growth rates stored as decimals for calculations
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

      // FIXED: Use calculated tiers
      economicTier,
      populationTier,
      populationDensity,
      gdpDensity,
      localGrowthFactor: baseData.localGrowthFactor || 1.0,
      globalGrowthFactor: this.config.globalGrowthFactor || 1.0321,
    };
  }

  /**
   * FIXED: Validate growth rates (input should be in decimal form)
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
          lastCalculated: new Date(targetTimeMs),
        },
        timeElapsed: 0,
        calculationDate: targetTimeMs,
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
      activeDmInputs,
      baselineStats.localGrowthFactor
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
      lastCalculated: new Date(targetTimeMs),
    };

    const modifiedStats = this.applySpecialModifiers(updatedStats, activeDmInputs);

    if (
      modifiedStats.currentPopulation !== updatedStats.currentPopulation ||
      modifiedStats.currentTotalGdp !== updatedStats.currentTotalGdp
    ) {
      modifiedStats.populationDensity =
        landArea > 0 ? modifiedStats.currentPopulation / landArea : undefined;
      modifiedStats.gdpDensity =
        landArea > 0 ? modifiedStats.currentTotalGdp / landArea : undefined;
    }

    return {
      country: baselineStats.country,
      oldStats,
      newStats: modifiedStats,
      timeElapsed: Math.abs(yearsFromBaseline),
      calculationDate: targetTimeMs,
    };
  }

  private calculatePopulationProgression(
    baselinePopulation: number,
    growthRateDecimal: number,
    yearsFromBaseline: number,
    dmInputs: DmInputRecord[]
  ): number {
    let adjustedRate = growthRateDecimal;

    dmInputs.forEach((input) => {
      const inputValue = this.validateGrowthRate(input.value);
      if (input.inputType === DmInputType.POPULATION_ADJUSTMENT) {
        adjustedRate += inputValue;
      }
    });

    return baselinePopulation * Math.pow(1 + adjustedRate, yearsFromBaseline);
  }

  /**
   * FIXED: GDP per capita progression with proper global growth factor application
   */
  private calculateGdpPerCapitaProgression(
    baselineGdpPerCapita: number,
    adjustedGrowthDecimal: number,
    maxGrowthRateDecimal: number,
    tier: EconomicTier,
    yearsFromBaseline: number,
    dmInputs: DmInputRecord[],
    localGrowthFactor = 1.0
  ): number {
    // Start with the base adjusted growth rate
    let effectiveGrowthRate = adjustedGrowthDecimal;

    // FIXED: Apply global growth factor (3.21% = 1.0321 multiplier)
    // The global growth factor amplifies the base growth rate
    effectiveGrowthRate *= this.config.globalGrowthFactor;

    // Apply local growth factor
    effectiveGrowthRate *= localGrowthFactor;

    // Apply tier growth modifiers (usually 1.0 unless specified otherwise)
    const tierModifier = this.config.tierGrowthModifiers[tier] || 1.0;
    effectiveGrowthRate *= tierModifier;

    // Apply DM inputs
    dmInputs.forEach((input) => {
      const inputValue = this.validateGrowthRate(input.value);
      if (input.inputType === DmInputType.GDP_ADJUSTMENT) {
        effectiveGrowthRate += inputValue;
      } else if (input.inputType === DmInputType.GROWTH_RATE_MODIFIER) {
        effectiveGrowthRate *= 1 + inputValue;
      }
    });

    // FIXED: Apply tier-based growth rate caps AFTER global factor
    const tierMaxRate = this.getTierMaxGrowthRate(tier);
    effectiveGrowthRate = Math.min(effectiveGrowthRate, tierMaxRate);

    // Ensure no extreme negative growth
    effectiveGrowthRate = Math.max(effectiveGrowthRate, -0.1); // -10% minimum

    // Apply diminishing returns for very high GDP per capita
    if (yearsFromBaseline > 0 && baselineGdpPerCapita > 60000) {
      const diminishingFactor = Math.log(baselineGdpPerCapita / 60000 + 1) / Math.log(2);
      effectiveGrowthRate /= 1 + diminishingFactor * 0.5;
    }

    return baselineGdpPerCapita * Math.pow(1 + effectiveGrowthRate, yearsFromBaseline);
  }

  /**
   * FIXED: Get tier-specific maximum growth rates
   */
  private getTierMaxGrowthRate(tier: EconomicTier): number {
    const maxRates = {
      [EconomicTier.IMPOVERISHED]: 0.1, // 10%
      [EconomicTier.DEVELOPING]: 0.075, // 7.50%
      [EconomicTier.DEVELOPED]: 0.05, // 5%
      [EconomicTier.HEALTHY]: 0.035, // 3.50%
      [EconomicTier.STRONG]: 0.0275, // 2.75%
      [EconomicTier.VERY_STRONG]: 0.015, // 1.50%
      [EconomicTier.EXTRAVAGANT]: 0.005, // 0.50%
    };

    return maxRates[tier] ?? 0.05; // Default to 5% if tier not found
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
    const lastCalculatedMs =
      currentStats.lastCalculated instanceof Date
        ? currentStats.lastCalculated.getTime()
        : currentStats.lastCalculated;

    const yearsElapsed = IxTime.getYearsElapsed(lastCalculatedMs, nowIxTimeMs);

    if (yearsElapsed <= 0) {
      return {
        country: currentStats.country,
        oldStats: currentStats,
        newStats: {
          ...currentStats,
          lastCalculated: new Date(nowIxTimeMs),
        },
        timeElapsed: 0,
        calculationDate: nowIxTimeMs,
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
      activeDmInputs,
      currentStats.localGrowthFactor
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
      lastCalculated: new Date(nowIxTimeMs),
    };

    const modifiedStats = this.applySpecialModifiers(updatedStats, activeDmInputs);

    if (
      modifiedStats.currentPopulation !== updatedStats.currentPopulation ||
      modifiedStats.currentTotalGdp !== updatedStats.currentTotalGdp
    ) {
      modifiedStats.populationDensity =
        landArea > 0 ? modifiedStats.currentPopulation / landArea : undefined;
      modifiedStats.gdpDensity =
        landArea > 0 ? modifiedStats.currentTotalGdp / landArea : undefined;
    }

    return {
      country: currentStats.country,
      oldStats,
      newStats: modifiedStats,
      timeElapsed: yearsElapsed,
      calculationDate: nowIxTimeMs,
    };
  }

  private getActiveDmInputs(
    dmInputs: DmInputRecord[],
    startTime: number,
    endTime: number
  ): DmInputRecord[] {
    return dmInputs.filter((input) => {
      const inputTime =
        input.ixTimeTimestamp instanceof Date
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
    const modifiedStats = { ...stats };

    dmInputs.forEach((input) => {
      const inputValue = this.validateGrowthRate(input.value);
      switch (input.inputType) {
        case DmInputType.NATURAL_DISASTER:
          modifiedStats.currentPopulation *= 1 + inputValue;
          modifiedStats.currentTotalGdp *= 1 + inputValue * 1.5;
          break;

        case DmInputType.TRADE_AGREEMENT:
          modifiedStats.currentGdpPerCapita *= 1 + inputValue;
          break;

        case DmInputType.ECONOMIC_POLICY:
          modifiedStats.localGrowthFactor *= 1 + inputValue;
          break;

        case DmInputType.SPECIAL_EVENT:
          modifiedStats.currentPopulation *= 1 + inputValue * 0.5;
          modifiedStats.currentGdpPerCapita *= 1 + inputValue * 0.8;
          break;
      }
    });

    if (
      modifiedStats.currentPopulation !== stats.currentPopulation ||
      modifiedStats.currentGdpPerCapita !== stats.currentGdpPerCapita
    ) {
      modifiedStats.currentTotalGdp =
        modifiedStats.currentPopulation * modifiedStats.currentGdpPerCapita;
    }

    modifiedStats.economicTier = this.calculateEconomicTier(modifiedStats.currentGdpPerCapita);
    modifiedStats.populationTier = this.calculatePopulationTier(modifiedStats.currentPopulation);

    return modifiedStats;
  }

  createHistoricalDataPoint(stats: CountryStats, ixTime?: number): HistoricalDataPoint {
    const timestamp =
      ixTime ||
      (stats.lastCalculated instanceof Date
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

  /**
   * FIXED: Helper to get effective growth rate after all modifiers
   * This is useful for debugging and display purposes
   */
  getEffectiveGrowthRate(
    baseGrowthRate: number,
    tier: EconomicTier,
    localGrowthFactor = 1.0
  ): {
    baseRate: number;
    withGlobalFactor: number;
    withLocalFactor: number;
    withTierModifier: number;
    finalRate: number;
    tierMax: number;
  } {
    const baseRate = this.validateGrowthRate(baseGrowthRate);
    const withGlobalFactor = baseRate * this.config.globalGrowthFactor;
    const withLocalFactor = withGlobalFactor * localGrowthFactor;
    const tierModifier = this.config.tierGrowthModifiers[tier] || 1.0;
    const withTierModifier = withLocalFactor * tierModifier;
    const tierMax = this.getTierMaxGrowthRate(tier);
    const finalRate = Math.min(withTierModifier, tierMax);

    return {
      baseRate,
      withGlobalFactor,
      withLocalFactor,
      withTierModifier,
      finalRate,
      tierMax,
    };
  }
}
