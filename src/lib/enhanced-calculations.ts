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
}

export interface GrowthModifiers {
  // Logarithmic growth parameters
  gdpDiminishingThreshold: number; // GDP per capita where diminishing returns start
  gdpDiminishingFactor: number; // How strong the diminishing effect is
  
  // Population modifiers
  populationBonus: Record<string, number>; // Bonus growth based on population tier
  populationPenalty: Record<string, number>; // Penalty for very large populations
  
  // Economic tier modifiers (more sophisticated)
  tierModifiers: Record<string, {
    gdpMultiplier: number;
    populationMultiplier: number;
    stabilityFactor: number; // How stable the economy is
    innovationBonus: number; // Innovation-driven growth
  }>;
  
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
        "Micro": 1.15,    // Small countries can be more agile
        "Small": 1.10,    // Moderate bonus
        "Medium": 1.05,   // Slight bonus
        "Large": 1.00,    // No bonus/penalty
        "Massive": 0.95,  // Slight penalty for coordination challenges
      },
      
      populationPenalty: {
        "Micro": 0.95,    // May lack resources
        "Small": 1.00,    // No penalty
        "Medium": 1.05,   // Sweet spot
        "Large": 1.02,    // Good market size
        "Massive": 0.98,  // Infrastructure challenges
      },
      
      tierModifiers: {
        "Developing": {
          gdpMultiplier: 1.3,     // High growth potential
          populationMultiplier: 1.1,
          stabilityFactor: 0.8,   // Less stable
          innovationBonus: 0.7,   // Lower innovation
        },
        "Emerging": {
          gdpMultiplier: 1.2,
          populationMultiplier: 1.05,
          stabilityFactor: 0.9,
          innovationBonus: 0.85,
        },
        "Developed": {
          gdpMultiplier: 1.0,
          populationMultiplier: 1.0,
          stabilityFactor: 1.0,   // Baseline stability
          innovationBonus: 1.0,   // Baseline innovation
        },
        "Advanced": {
          gdpMultiplier: 0.8,     // Slower growth, higher base
          populationMultiplier: 0.95,
          stabilityFactor: 1.1,   // More stable
          innovationBonus: 1.3,   // High innovation
        },
      },
      
      volatilityFactor: 0.05,  // ±5% random variation
      cyclicalPeriod: 7,       // 7-year economic cycles
      trendStrength: 0.3,      // 30% trend influence
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
    const cyclicalAdjustment = this.calculateCyclicalEffect(timeElapsed, this.modifiers.cyclicalPeriod * 1.5) * 0.3;
    effectiveGrowthRate *= (1 + cyclicalAdjustment);

    // Apply logarithmic diminishing returns for very high populations
    if (basePopulation > 500000000) { // 500M threshold
      const diminishingFactor = Math.log(basePopulation / 500000000 + 1) / Math.log(2);
      effectiveGrowthRate /= (1 + diminishingFactor * 0.3);
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
      const innovationEffect = tierMod.innovationBonus * this.calculateInnovationCycle(timeElapsed);
      effectiveGrowthRate *= (1 + innovationEffect * 0.1);

      // Add stability factor (reduces volatility for developed economies)
      const stabilityAdjustment = (tierMod.stabilityFactor - 1) * 0.2;
      const volatility = this.modifiers.volatilityFactor * (1 - stabilityAdjustment);
      const randomAdjustment = (Math.random() - 0.5) * 2 * volatility;
      effectiveGrowthRate *= (1 + randomAdjustment);
    }

    // Apply population effects (larger markets can drive growth)
    const popEffect = this.modifiers.populationBonus[populationTier] || 1.0;
    effectiveGrowthRate *= popEffect;

    // Apply global and local factors
    effectiveGrowthRate *= globalGrowthFactor * localGrowthFactor;

    // Add economic cyclical effects
    const cyclicalAdjustment = this.calculateCyclicalEffect(timeElapsed, this.modifiers.cyclicalPeriod);
    effectiveGrowthRate *= (1 + cyclicalAdjustment);

    // Apply diminishing returns for very high GDP per capita
    if (baseGdpPerCapita > this.modifiers.gdpDiminishingThreshold) {
      const diminishingFactor = Math.log(baseGdpPerCapita / this.modifiers.gdpDiminishingThreshold + 1) / 
                               Math.log(this.modifiers.gdpDiminishingFactor);
      effectiveGrowthRate /= (1 + diminishingFactor);
    }

    // Apply convergence theory (poorer countries grow faster)
    if (baseGdpPerCapita < 30000) {
      const convergenceBonus = (30000 - baseGdpPerCapita) / 30000 * 0.02; // Up to 2% bonus
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
      finalGdpPerCapita *= (1 + yearlyRate);
    }
    
    // Apply fractional year growth
    const fractionalYear = timeElapsed - Math.floor(timeElapsed);
    if (fractionalYear > 0) {
      finalGdpPerCapita *= Math.pow(1 + effectiveGrowthRate, fractionalYear);
    }

    return finalGdpPerCapita;
  }

  /**
   * Calculate cyclical economic effects (boom/bust cycles)
   */
  private calculateCyclicalEffect(timeElapsed: number, period: number): number {
    const phase = (timeElapsed % period) / period * 2 * Math.PI;
    return Math.sin(phase) * 0.1; // ±10% cyclical variation
  }

  /**
   * Calculate innovation cycle effects (technological progress)
   */
  private calculateInnovationCycle(timeElapsed: number): number {
    // Innovation comes in waves, with major breakthroughs every ~20 years
    const innovationPhase = (timeElapsed % 20) / 20 * 2 * Math.PI;
    const baseInnovation = Math.sin(innovationPhase) * 0.5 + 0.5; // 0 to 1
    
    // Add random breakthrough effects
    const breakthroughChance = 0.05; // 5% chance per year
    const breakthrough = Math.random() < (breakthroughChance * timeElapsed) ? 0.3 : 0;
    
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