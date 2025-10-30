// src/lib/enhanced-calculations.ts
// Enhanced growth formula based on IxSheetz methodology

export interface IxSheetzGrowthParams {
  basePopulation: number;
  baseGdpPerCapita: number;
  populationGrowthRate: number;
  gdpGrowthRate: number;
  maxGdpGrowthRate: number;
  economicTier: string;
  populationTier: string;
  globalGrowthFactor: number;
  localGrowthFactor: number;
  timeElapsed: number; // years
  // Optional economic indicators for deterministic volatility
  unemploymentRate?: number;
  inflationRate?: number;
  politicalStability?: number; // 0-100 scale
  tradeOpenness?: number; // 0-100 scale
  countryId?: string; // For deterministic seeding
}

export interface GrowthModifiers {
  // Logarithmic growth parameters
  gdpDiminishingThreshold: number; // GDP per capita where diminishing returns start
  gdpDiminishingFactor: number; // How strong the diminishing effect is

  // Population modifiers
  populationBonus: Record<string, number>; // Bonus growth based on population tier
  populationPenalty: Record<string, number>; // Penalty for very large populations

  // Economic tier modifiers (more sophisticated)
  tierModifiers: Record<
    string,
    {
      gdpMultiplier: number;
      populationMultiplier: number;
      stabilityFactor: number; // How stable the economy is
      innovationBonus: number; // Innovation-driven growth
    }
  >;

  // Time-based modifiers
  volatilityFactor: number; // Random fluctuations
  cyclicalPeriod: number; // Economic cycles (boom/bust)
  trendStrength: number; // How strong long-term trends are
}

export class IxSheetzCalculator {
  private modifiers: GrowthModifiers;

  constructor() {
    this.modifiers = {
      gdpDiminishingThreshold: 75000,
      gdpDiminishingFactor: 1.5,

      populationBonus: {
        Micro: 1.15, // Small countries can be more agile
        Small: 1.1, // Moderate bonus
        Medium: 1.05, // Slight bonus
        Large: 1.0, // No bonus/penalty
        Massive: 0.95, // Slight penalty for coordination challenges
      },

      populationPenalty: {
        Micro: 0.95, // May lack resources
        Small: 1.0, // No penalty
        Medium: 1.05, // Sweet spot
        Large: 1.02, // Good market size
        Massive: 0.98, // Infrastructure challenges
      },

      tierModifiers: {
        Developing: {
          gdpMultiplier: 1.3, // High growth potential
          populationMultiplier: 1.1,
          stabilityFactor: 0.8, // Less stable
          innovationBonus: 0.7, // Lower innovation
        },
        Emerging: {
          gdpMultiplier: 1.2,
          populationMultiplier: 1.05,
          stabilityFactor: 0.9,
          innovationBonus: 0.85,
        },
        Developed: {
          gdpMultiplier: 1.0,
          populationMultiplier: 1.0,
          stabilityFactor: 1.0, // Baseline stability
          innovationBonus: 1.0, // Baseline innovation
        },
        Advanced: {
          gdpMultiplier: 0.8, // Slower growth, higher base
          populationMultiplier: 0.95,
          stabilityFactor: 1.1, // More stable
          innovationBonus: 1.3, // High innovation
        },
      },

      volatilityFactor: 0.05, // ±5% random variation
      cyclicalPeriod: 7, // 7-year economic cycles
      trendStrength: 0.3, // 30% trend influence
    };
  }

  /**
   * Calculate enhanced population growth using IxSheetz methodology
   */
  calculatePopulationGrowth(params: IxSheetzGrowthParams): number {
    const {
      basePopulation,
      populationGrowthRate,
      economicTier,
      populationTier,
      globalGrowthFactor,
      localGrowthFactor,
      timeElapsed,
    } = params;

    // Base exponential growth
    let effectiveGrowthRate = populationGrowthRate;

    // Apply tier modifiers
    const tierMod = this.modifiers.tierModifiers[economicTier];
    if (tierMod) {
      effectiveGrowthRate *= tierMod.populationMultiplier;
    }

    // Apply population size effects
    const popBonus = this.modifiers.populationBonus[populationTier] || 1.0;
    const popPenalty = this.modifiers.populationPenalty[populationTier] || 1.0;
    effectiveGrowthRate *= popBonus * popPenalty;

    // Apply global and local factors
    effectiveGrowthRate *= globalGrowthFactor * localGrowthFactor;

    // Add cyclical effects (population cycles are longer and less volatile)
    const cyclicalAdjustment =
      this.calculateCyclicalEffect(timeElapsed, this.modifiers.cyclicalPeriod * 1.5) * 0.3;
    effectiveGrowthRate *= 1 + cyclicalAdjustment;

    // Apply logarithmic diminishing returns for very high populations
    if (basePopulation > 500000000) {
      // 500M threshold
      const diminishingFactor = Math.log(basePopulation / 500000000 + 1) / Math.log(2);
      effectiveGrowthRate /= 1 + diminishingFactor * 0.3;
    }

    // Cap growth rates (populations can't grow infinitely fast)
    effectiveGrowthRate = Math.min(effectiveGrowthRate, 0.15); // Max 15% annual growth
    effectiveGrowthRate = Math.max(effectiveGrowthRate, -0.05); // Max 5% annual decline

    // Calculate final population
    return basePopulation * Math.pow(1 + effectiveGrowthRate, timeElapsed);
  }

  /**
   * Calculate enhanced GDP per capita growth using IxSheetz methodology
   */
  calculateGdpPerCapitaGrowth(params: IxSheetzGrowthParams): number {
    const {
      baseGdpPerCapita,
      gdpGrowthRate,
      maxGdpGrowthRate,
      economicTier,
      populationTier,
      globalGrowthFactor,
      localGrowthFactor,
      timeElapsed,
    } = params;

    // Base growth rate
    let effectiveGrowthRate = gdpGrowthRate;

    // Apply tier modifiers with innovation bonus
    const tierMod = this.modifiers.tierModifiers[economicTier];
    if (tierMod) {
      effectiveGrowthRate *= tierMod.gdpMultiplier;

      // Innovation-driven growth (higher for advanced economies)
      const innovationEffect = tierMod.innovationBonus * this.calculateInnovationCycle(params);
      effectiveGrowthRate *= 1 + innovationEffect * 0.1;

      // Add stability factor (reduces volatility for developed economies)
      const stabilityAdjustment = (tierMod.stabilityFactor - 1) * 0.2;
      const volatility = this.modifiers.volatilityFactor * (1 - stabilityAdjustment);
      const deterministicAdjustment = this.calculateDeterministicVolatility(params) * volatility;
      effectiveGrowthRate *= 1 + deterministicAdjustment;
    }

    // Apply population effects (larger markets can drive growth)
    const popEffect = this.modifiers.populationBonus[populationTier] || 1.0;
    effectiveGrowthRate *= popEffect;

    // Apply global and local factors
    effectiveGrowthRate *= globalGrowthFactor * localGrowthFactor;

    // Add economic cyclical effects
    const cyclicalAdjustment = this.calculateCyclicalEffect(
      timeElapsed,
      this.modifiers.cyclicalPeriod
    );
    effectiveGrowthRate *= 1 + cyclicalAdjustment;

    // Apply diminishing returns for very high GDP per capita
    if (baseGdpPerCapita > this.modifiers.gdpDiminishingThreshold) {
      const diminishingFactor =
        Math.log(baseGdpPerCapita / this.modifiers.gdpDiminishingThreshold + 1) /
        Math.log(this.modifiers.gdpDiminishingFactor);
      effectiveGrowthRate /= 1 + diminishingFactor;
    }

    // Apply convergence theory (poorer countries grow faster)
    if (baseGdpPerCapita < 30000) {
      const convergenceBonus = ((30000 - baseGdpPerCapita) / 30000) * 0.02; // Up to 2% bonus
      effectiveGrowthRate += convergenceBonus;
    }

    // Cap growth rates
    effectiveGrowthRate = Math.min(effectiveGrowthRate, maxGdpGrowthRate);
    effectiveGrowthRate = Math.max(effectiveGrowthRate, -0.15); // Max 15% annual decline

    // Calculate final GDP per capita with compound growth
    let finalGdpPerCapita = baseGdpPerCapita;

    // Apply growth year by year for more realistic compound effects
    for (let year = 0; year < Math.floor(timeElapsed); year++) {
      const yearlyRate = effectiveGrowthRate + this.calculateYearlyVariation(year);
      finalGdpPerCapita *= 1 + yearlyRate;
    }

    // Apply fractional year growth
    const fractionalYear = timeElapsed - Math.floor(timeElapsed);
    if (fractionalYear > 0) {
      finalGdpPerCapita *= Math.pow(1 + effectiveGrowthRate, fractionalYear);
    }

    return finalGdpPerCapita;
  }

  /**
   * Calculate deterministic volatility based on economic indicators
   * This replaces Math.random() with reproducible calculations
   */
  private calculateDeterministicVolatility(params: IxSheetzGrowthParams): number {
    const {
      unemploymentRate = 5.0,
      inflationRate = 2.0,
      politicalStability = 70,
      tradeOpenness = 60,
      countryId = "default",
      timeElapsed,
    } = params;

    // Create a deterministic seed from country ID
    let seed = 0;
    for (let i = 0; i < countryId.length; i++) {
      seed = (seed << 5) - seed + countryId.charCodeAt(i);
      seed = seed & seed; // Convert to 32bit integer
    }

    // Deterministic pseudo-random function (0 to 1)
    const seededRandom = (x: number) => {
      const mixed = Math.abs(Math.sin(seed + x * 12.9898) * 43758.5453123);
      return mixed - Math.floor(mixed);
    };

    // Economic instability factors (higher = more volatility)
    // Unemployment above 5% increases volatility
    const unemploymentVolatility = Math.max(0, (unemploymentRate - 5) / 20); // 0-0.5 range

    // Inflation outside 2-3% target increases volatility
    const inflationTarget = 2.5;
    const inflationDeviation = Math.abs(inflationRate - inflationTarget);
    const inflationVolatility = Math.min(inflationDeviation / 10, 0.5); // 0-0.5 range

    // Political instability (lower stability = higher volatility)
    const politicalVolatility = (100 - politicalStability) / 100; // 0-1 range

    // Trade openness affects external shock vulnerability
    const tradeVolatility = tradeOpenness / 200; // 0-0.5 range

    // Combine volatility factors
    const totalVolatilityFactor =
      unemploymentVolatility * 0.3 +
      inflationVolatility * 0.3 +
      politicalVolatility * 0.25 +
      tradeVolatility * 0.15;

    // Use time-based seeding for deterministic but varying results
    const timeComponent = seededRandom(timeElapsed * 1.7);
    const volatilityDirection = (timeComponent - 0.5) * 2; // -1 to 1

    // Return volatility adjustment (-volatilityFactor to +volatilityFactor)
    return volatilityDirection * totalVolatilityFactor;
  }

  /**
   * Calculate cyclical economic effects (boom/bust cycles)
   */
  private calculateCyclicalEffect(timeElapsed: number, period: number): number {
    const phase = ((timeElapsed % period) / period) * 2 * Math.PI;
    return Math.sin(phase) * 0.1; // ±10% cyclical variation
  }

  /**
   * Calculate innovation cycle effects (technological progress)
   * Uses deterministic breakthrough detection based on economic factors
   */
  private calculateInnovationCycle(params: IxSheetzGrowthParams): number {
    const {
      timeElapsed,
      baseGdpPerCapita,
      politicalStability = 70,
      countryId = "default",
    } = params;

    // Innovation comes in waves, with major breakthroughs every ~20 years
    const innovationPhase = ((timeElapsed % 20) / 20) * 2 * Math.PI;
    const baseInnovation = Math.sin(innovationPhase) * 0.5 + 0.5; // 0 to 1

    // Deterministic breakthrough detection based on economic capacity
    // Higher GDP per capita and stability increase breakthrough likelihood
    const breakthroughCapacity =
      (baseGdpPerCapita / 100000) * 0.5 + // Wealth factor
      (politicalStability / 100) * 0.3 + // Stability factor
      0.2; // Base factor

    // Create deterministic seed for breakthrough timing
    let seed = 0;
    for (let i = 0; i < countryId.length; i++) {
      seed = (seed << 5) - seed + countryId.charCodeAt(i);
    }

    // Deterministic breakthrough function
    const breakthroughPhase = Math.abs(Math.sin(seed + timeElapsed * 7.3)) * breakthroughCapacity;
    const breakthrough = breakthroughPhase > 0.85 ? 0.3 : 0; // Threshold-based breakthrough

    return (baseInnovation + breakthrough) * 0.2; // Scale to reasonable impact
  }

  /**
   * Calculate yearly variation for more realistic growth patterns
   */
  private calculateYearlyVariation(year: number): number {
    // Some years are just better than others
    const variation = (Math.sin(year * 1.7) + Math.cos(year * 2.3)) * 0.01;
    return variation;
  }

  /**
   * Calculate regional growth factors based on neighboring countries
   */
  calculateRegionalEffects(country: any, allCountries: any[]): number {
    // TODO: Implement regional spillover effects
    // Countries with prosperous neighbors tend to do better
    return 1.0; // Placeholder
  }

  /**
   * Calculate resource-based growth modifiers
   */
  calculateResourceEffects(country: any, globalCommodityPrices: Record<string, number>): number {
    // TODO: Implement resource-based growth
    // Oil-rich countries affected by oil prices, etc.
    return 1.0; // Placeholder
  }

  /**
   * Main calculation method that combines all effects
   */
  calculateEnhancedGrowth(params: IxSheetzGrowthParams) {
    const newPopulation = this.calculatePopulationGrowth(params);
    const newGdpPerCapita = this.calculateGdpPerCapitaGrowth(params);
    const newTotalGdp = newPopulation * newGdpPerCapita;

    return {
      population: newPopulation,
      gdpPerCapita: newGdpPerCapita,
      totalGdp: newTotalGdp,
      populationGrowthRate: (newPopulation / params.basePopulation) ** (1 / params.timeElapsed) - 1,
      gdpGrowthRate: (newGdpPerCapita / params.baseGdpPerCapita) ** (1 / params.timeElapsed) - 1,
    };
  }
}
