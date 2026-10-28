// src/lib/calculations.ts
// FIXED: Proper growth factor handling and updated tier classifications

import { IxTime } from "~/lib/ixtime";
import type {
  BaseCountryData,
  CountryStats,
  EconomicConfig,
  StorytellerEffect as StorytellerEffectRecord,
} from "~/types/ixstats";
import { calculateComponentEconomicModifiers } from "~/lib/government/atomic-utils";

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

enum PopulationTier {
  TIER_1 = "1", // 0-9,999,999
  TIER_2 = "2", // 10,000,000-29,999,999
  TIER_3 = "3", // 30,000,000-49,999,999
  TIER_4 = "4", // 50,000,000-79,999,999
  TIER_5 = "5", // 80,000,000-119,999,999
  TIER_6 = "6", // 120,000,000-349,999,999
  TIER_7 = "7", // 350,000,000-499,999,999
  TIER_X = "X", // 500,000,000+
}

/**
 * Effect types the projection reads (matched case-insensitively). The three growth types are
 * legacy: they change the single growth rate compounded since the baseline, so they rewrite the
 * whole projected history; new effects are level effects (see `storyteller-effects.ts`).
 */
export enum StorytellerEffectType {
  POPULATION_ADJUSTMENT = "population_adjustment",
  GDP_ADJUSTMENT = "gdp_adjustment",
  GROWTH_RATE_MODIFIER = "growth_rate_modifier",
  SPECIAL_EVENT = "special_event",
  /** Scales GDP per capita by `1 + value`; phased in over `duration` years, then kept. */
  TRADE_AGREEMENT = "trade_agreement",
  NATURAL_DISASTER = "natural_disaster",
  /** Scales GDP per capita by `1 + value`; phased in over `duration` years, then kept. */
  GDP_LEVEL_ADJUSTMENT = "gdp_level_adjustment",
  /** Scales population by `1 + value`; phased in over `duration` years, then kept. */
  POPULATION_LEVEL_ADJUSTMENT = "population_level_adjustment",
}

/**
 * Share (0-1) of a level effect in force at `targetTimeMs`: 0 before it starts, rising linearly
 * over its `duration` (IxTime years), 1 afterwards. An effect with no duration applies at once.
 */
export function levelPhaseIn(
  effect: Pick<StorytellerEffectRecord, "ixTimeTimestamp" | "duration">,
  targetTimeMs: number
): number {
  const start =
    effect.ixTimeTimestamp instanceof Date
      ? effect.ixTimeTimestamp.getTime()
      : effect.ixTimeTimestamp;
  if (targetTimeMs < start) return 0;
  if (!effect.duration || effect.duration <= 0) return 1;
  return Math.min(1, IxTime.getYearsElapsed(start, targetTimeMs) / effect.duration);
}

/** Growth rate a relative growth modifier is sized against when it becomes a level effect. */
const REFERENCE_GDP_GROWTH = 0.03;

/**
 * GDP level shift equivalent to multiplying a `referenceGrowth` growth rate by `1 + modifier`
 * for `years`: ((1 + g(1 + m)) / (1 + g))^years − 1. Rounded to 6 decimals.
 */
export function growthModifierToLevelShift(
  modifier: number,
  years: number,
  referenceGrowth = REFERENCE_GDP_GROWTH
): number {
  const g = referenceGrowth;
  const shift = Math.pow((1 + g * (1 + modifier)) / (1 + g), years) - 1;
  return Math.round(shift * 1e6) / 1e6;
}

/** GDP per capita where each economic tier above Impoverished starts (see `calculateEconomicTier`). */
const ECONOMIC_TIER_THRESHOLDS = [10000, 25000, 35000, 45000, 55000, 65000] as const;

/** The next tier threshold GDP per capita reaches growing at `rate`, or null if none. */
function nextTierThreshold(gdpPerCapita: number, rate: number): number | null {
  if (rate > 0) return ECONOMIC_TIER_THRESHOLDS.find((t) => t > gdpPerCapita) ?? null;
  if (rate < 0)
    return [...ECONOMIC_TIER_THRESHOLDS].reverse().find((t) => t < gdpPerCapita) ?? null;
  return null;
}

/** Inflation is a percent (2 = 2%); the bounds match the event spine's guardrail. */
export const DEFAULT_INFLATION_RATE = 2;
/** Unemployment is a percent (5 = 5%), read when a nation has none stored. */
export const DEFAULT_UNEMPLOYMENT_RATE = 5;
const MIN_INFLATION_RATE = -5;
const MAX_INFLATION_RATE = 100;

/** Floor for the summed annual population growth rate; keeps `1 + rate` positive. */
const MIN_POPULATION_GROWTH_RATE = -0.5;

const PERSISTED_STAT_KEYS = [
  "currentPopulation",
  "currentGdpPerCapita",
  "currentTotalGdp",
] as const;

/** Throws when a stat about to be written to the DB is non-finite or negative. */
export function assertPersistableStats(
  stats: Pick<CountryStats, (typeof PERSISTED_STAT_KEYS)[number]>
): void {
  for (const key of PERSISTED_STAT_KEYS) {
    const value = stats[key];
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Refusing to persist non-finite/negative ${key}`);
    }
  }
}

interface StatsCalculationResult {
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
      activeGovComponents: baseData.activeGovComponents,
      activeEconComponents: baseData.activeEconComponents,
      activeTaxComponents: baseData.activeTaxComponents,
      implementingGovComponents: baseData.implementingGovComponents,
      implementingEconComponents: baseData.implementingEconComponents,
      implementingTaxComponents: baseData.implementingTaxComponents,

      // Stored rates the projection adjusts by component modifiers (dropping them here made
      // every read show the defaults instead of the stored values).
      totalGovernmentSpending: baseData.totalGovernmentSpending,
      taxRevenueGDPPercent: baseData.taxRevenueGDPPercent,
      unemploymentRate: baseData.unemploymentRate,
      inflationRate: baseData.inflationRate,
      activePolicyMaintenanceCost: baseData.activePolicyMaintenanceCost,
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
  /** `targetTime`: the nation's clock time to project to (its realm's now for the present). */
  calculateTimeProgression(
    baselineStats: CountryStats,
    targetTime: number,
    effects: StorytellerEffectRecord[] = []
  ): StatsCalculationResult {
    const targetTimeMs = targetTime;
    const baselineTimeMs = this.baselineDate;

    const yearsFromBaseline = IxTime.getYearsElapsed(baselineTimeMs, targetTimeMs);

    const oldStats = { ...baselineStats };
    const activeEffects = this.getActiveEffects(effects, baselineTimeMs, targetTimeMs);

    const newPopulation = this.calculatePopulationProgression(
      baselineStats.population,
      baselineStats.populationGrowthRate,
      yearsFromBaseline,
      activeEffects
    );

    const newGdpPerCapita = this.calculateGdpPerCapitaProgression(
      baselineStats.gdpPerCapita,
      baselineStats.adjustedGdpGrowth,
      baselineStats.economicTier as EconomicTier,
      yearsFromBaseline,
      activeEffects,
      baselineStats.localGrowthFactor
    );

    const newTotalGdp = newPopulation * newGdpPerCapita;
    const newEconomicTier = this.calculateEconomicTier(newGdpPerCapita);
    const newPopulationTier = this.calculatePopulationTier(newPopulation);

    const landArea = baselineStats.landArea || 0;
    const newPopulationDensity = landArea > 0 ? newPopulation / landArea : undefined;
    const newGdpDensity = landArea > 0 ? newTotalGdp / landArea : undefined;

    const mods = calculateComponentEconomicModifiers(
      (baselineStats.activeGovComponents || []) as any[],
      (baselineStats.activeEconComponents || []) as any[],
      (baselineStats.activeTaxComponents || []) as any[]
    );

    const updatedStats: CountryStats = {
      ...baselineStats,
      effectiveGdpGrowth: this.currentGdpGrowthRate(baselineStats, newGdpPerCapita, activeEffects),
      currentPopulation: newPopulation,
      currentGdpPerCapita: newGdpPerCapita,
      currentTotalGdp: newTotalGdp,
      economicTier: newEconomicTier,
      populationTier: newPopulationTier,
      populationDensity: newPopulationDensity,
      gdpDensity: newGdpDensity,
      lastCalculated: new Date(targetTimeMs),
      totalGovernmentSpending:
        (baselineStats.totalGovernmentSpending ?? 0) +
        mods.maintenanceCost +
        (baselineStats.activePolicyMaintenanceCost ?? 0),
      taxRevenueGDPPercent: Math.max(
        0,
        Math.min(100, (baselineStats.taxRevenueGDPPercent ?? 25) + mods.taxRevenueModifier)
      ),
      unemploymentRate: Math.max(
        0,
        Math.min(
          100,
          (baselineStats.unemploymentRate ?? DEFAULT_UNEMPLOYMENT_RATE) + mods.unemploymentModifier
        )
      ),
      // Percent, like every writer (issue and directive consequences move it in points).
      inflationRate: Math.max(
        MIN_INFLATION_RATE,
        Math.min(
          MAX_INFLATION_RATE,
          (baselineStats.inflationRate ?? DEFAULT_INFLATION_RATE) + mods.inflationModifier
        )
      ),
    };

    const modifiedStats = this.applySpecialModifiers(updatedStats, activeEffects, targetTimeMs);

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
    effects: StorytellerEffectRecord[]
  ): number {
    let adjustedRate = growthRateDecimal;

    effects.forEach((input) => {
      const inputValue = this.validateGrowthRate(input.value);
      const inputTypeLower = input.inputType?.toLowerCase();
      if (inputTypeLower === StorytellerEffectType.POPULATION_ADJUSTMENT) {
        adjustedRate += inputValue;
      }
    });
    adjustedRate = Math.max(adjustedRate, MIN_POPULATION_GROWTH_RATE);

    const next = baselinePopulation * Math.pow(1 + adjustedRate, yearsFromBaseline);
    return Number.isFinite(next) && next >= 0 ? next : baselinePopulation;
  }

  /**
   * GDP per capita after `yearsFromBaseline`. The growth rate depends on the economic tier (tier
   * modifier and cap), so a forward projection is compounded piecewise: each time GDP per capita
   * crosses a tier threshold, the rest of the span grows at the new tier's rate.
   */
  private calculateGdpPerCapitaProgression(
    baselineGdpPerCapita: number,
    adjustedGrowthDecimal: number,
    tier: EconomicTier,
    yearsFromBaseline: number,
    effects: StorytellerEffectRecord[],
    localGrowthFactor = 1.0
  ): number {
    const rateFor = (t: EconomicTier) =>
      this.effectiveGdpGrowthRate(
        adjustedGrowthDecimal,
        t,
        effects,
        localGrowthFactor,
        baselineGdpPerCapita,
        yearsFromBaseline
      );
    if (yearsFromBaseline <= 0) {
      return baselineGdpPerCapita * Math.pow(1 + rateFor(tier), yearsFromBaseline);
    }

    let gdpPerCapita = baselineGdpPerCapita;
    let currentTier = tier;
    let remaining = yearsFromBaseline;
    // One segment per tier crossed; there are only 7 tiers.
    for (let segment = 0; segment < 8 && remaining > 0; segment++) {
      const rate = rateFor(currentTier);
      const threshold = nextTierThreshold(gdpPerCapita, rate);
      const yearsToThreshold =
        threshold === null ? Infinity : Math.log(threshold / gdpPerCapita) / Math.log(1 + rate);
      if (yearsToThreshold >= remaining) {
        return gdpPerCapita * Math.pow(1 + rate, remaining);
      }
      gdpPerCapita = threshold!;
      remaining -= yearsToThreshold;
      // At a threshold the upper tier applies; falling through it, the lower one.
      currentTier = this.calculateEconomicTier(rate > 0 ? threshold! : threshold! * (1 - 1e-9));
    }
    return gdpPerCapita;
  }

  /**
   * The growth rate the projection applies going forward from `gdpPerCapita`: its tier's rate,
   * with diminishing returns as the forward projection applies them.
   */
  private currentGdpGrowthRate(
    baselineStats: CountryStats,
    gdpPerCapita: number,
    effects: StorytellerEffectRecord[]
  ): number {
    return this.effectiveGdpGrowthRate(
      baselineStats.adjustedGdpGrowth,
      this.calculateEconomicTier(gdpPerCapita),
      effects,
      baselineStats.localGrowthFactor || 1,
      baselineStats.gdpPerCapita,
      1
    );
  }

  /** Annual GDP per capita growth rate for a tier: factors, legacy growth effects, cap, floor. */
  private effectiveGdpGrowthRate(
    adjustedGrowthDecimal: number,
    tier: EconomicTier,
    effects: StorytellerEffectRecord[],
    localGrowthFactor: number,
    baselineGdpPerCapita: number,
    yearsFromBaseline: number
  ): number {
    // The global growth factor amplifies the base growth rate, then local and tier factors
    let effectiveGrowthRate =
      adjustedGrowthDecimal *
      this.config.globalGrowthFactor *
      localGrowthFactor *
      (this.config.tierGrowthModifiers[tier] || 1.0);

    // Legacy growth-type storyteller effects
    effects.forEach((input) => {
      const inputValue = this.validateGrowthRate(input.value);
      const inputTypeLower = input.inputType?.toLowerCase();
      if (inputTypeLower === StorytellerEffectType.GDP_ADJUSTMENT) {
        effectiveGrowthRate += inputValue;
      } else if (inputTypeLower === StorytellerEffectType.GROWTH_RATE_MODIFIER) {
        effectiveGrowthRate *= 1 + inputValue;
      }
    });

    // Tier-based growth rate cap AFTER the global factor
    effectiveGrowthRate = Math.min(effectiveGrowthRate, this.getTierMaxGrowthRate(tier));

    // Ensure no extreme negative growth (configurable floor)
    effectiveGrowthRate = Math.max(effectiveGrowthRate, this.config.minGrowthFloor ?? -0.1);

    // Apply diminishing returns for very high GDP per capita (configurable)
    const drThreshold = this.config.diminishingReturnsThreshold ?? 60000;
    const drFactor = this.config.diminishingReturnsFactor ?? 0.5;
    if (yearsFromBaseline > 0 && baselineGdpPerCapita > drThreshold) {
      const diminishingFactor = Math.log(baselineGdpPerCapita / drThreshold + 1) / Math.log(2);
      effectiveGrowthRate /= 1 + diminishingFactor * drFactor;
    }

    return effectiveGrowthRate;
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

  private getActiveEffects(
    effects: StorytellerEffectRecord[],
    startTime: number,
    endTime: number
  ): StorytellerEffectRecord[] {
    return effects.filter((input) => {
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

  private applySpecialModifiers(
    stats: CountryStats,
    effects: StorytellerEffectRecord[],
    targetTimeMs: number
  ): CountryStats {
    const modifiedStats = { ...stats };

    effects.forEach((input) => {
      const inputValue = this.validateGrowthRate(input.value);
      switch (input.inputType?.toLowerCase()) {
        // Level effects: unlike the growth effects above they never rewrite the path before
        // their own start, and they persist after `duration`.
        case StorytellerEffectType.GDP_LEVEL_ADJUSTMENT:
        case StorytellerEffectType.TRADE_AGREEMENT:
          modifiedStats.currentGdpPerCapita *= 1 + inputValue * levelPhaseIn(input, targetTimeMs);
          break;

        case StorytellerEffectType.POPULATION_LEVEL_ADJUSTMENT:
          modifiedStats.currentPopulation *= 1 + inputValue * levelPhaseIn(input, targetTimeMs);
          break;

        // Total GDP falls 1.5x as far as population: GDP per capita carries the extra share,
        // because total GDP is recomputed from population x GDP per capita below.
        case StorytellerEffectType.NATURAL_DISASTER:
          modifiedStats.currentPopulation *= 1 + inputValue;
          modifiedStats.currentGdpPerCapita *= (1 + inputValue * 1.5) / (1 + inputValue);
          break;

        case StorytellerEffectType.SPECIAL_EVENT:
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

  getBaselineDate(): number {
    return this.baselineDate;
  }
}
