/**
 * Economic Modeling Engine - Pure Business Logic
 *
 * This module contains all pure calculation functions for economic modeling,
 * including GDP projections, policy effects, model health assessment, and validation.
 * All functions are side-effect free and fully testable.
 *
 * @module economic-modeling-engine
 */

/**
 * Core model parameters for economic projections
 */
export interface ModelParameters {
  baseYear: number;
  projectionYears: number;
  gdpGrowthRate: number;
  inflationRate: number;
  unemploymentRate: number;
  interestRate: number;
  exchangeRate: number;
  populationGrowthRate: number;
  investmentRate: number;
  fiscalBalance: number;
  tradeBalance: number;
}

/**
 * Sectoral GDP output data for a specific year
 */
export interface SectorData {
  year: number;
  agriculture: number;
  industry: number;
  services: number;
  government: number;
  totalGDP: number;
}

/**
 * Policy effect definition with temporal scope
 */
export interface PolicyData {
  id: string;
  name: string;
  description: string;
  gdpEffectPercentage: number;
  inflationEffectPercentage: number;
  employmentEffectPercentage: number;
  yearImplemented: number;
  durationYears: number;
  economicModelId: string;
}

/**
 * Single year projection result
 */
export interface YearProjection {
  year: string;
  gdp: number;
  gdpPerCapita: number;
  inflation: number;
  unemployment: number;
  population: number;
}

/**
 * Adjusted economic rates for a specific year after policy effects
 */
export interface AdjustedRates {
  gdpGrowthRate: number;
  inflationRate: number;
  unemploymentRate: number;
}

/**
 * Model health assessment result
 */
export interface ModelHealth {
  score: number;
  status: "excellent" | "good" | "fair" | "poor";
  warnings: string[];
}

/**
 * Validation result for model parameters
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Apply policy effects to base economic rates for a specific year
 *
 * Checks if each policy is active in the given year (within yearImplemented to yearImplemented + durationYears)
 * and accumulates their effects on GDP growth, inflation, and unemployment.
 *
 * @param year - The year to calculate effects for
 * @param policies - Array of policy effects to consider
 * @param baseRates - Base economic rates before policy effects
 * @returns Adjusted rates with policy effects applied
 *
 * @example
 * ```ts
 * const adjusted = applyPolicyEffects(2025, policies, {
 *   gdpGrowthRate: 3.0,
 *   inflationRate: 2.0,
 *   unemploymentRate: 5.0
 * });
 * // Returns: { gdpGrowthRate: 3.5, inflationRate: 2.3, unemploymentRate: 4.5 }
 * ```
 */
export function applyPolicyEffects(
  year: number,
  policies: PolicyData[],
  baseRates: AdjustedRates
): AdjustedRates {
  let gdpGrowthRate = baseRates.gdpGrowthRate;
  let inflationRate = baseRates.inflationRate;
  let unemploymentRate = baseRates.unemploymentRate;

  policies.forEach((policy) => {
    const isActive =
      year >= policy.yearImplemented && year < policy.yearImplemented + (policy.durationYears ?? 0);

    if (isActive) {
      gdpGrowthRate += policy.gdpEffectPercentage ?? 0;
      inflationRate += policy.inflationEffectPercentage ?? 0;
      unemploymentRate -= policy.employmentEffectPercentage ?? 0;
    }
  });

  return {
    gdpGrowthRate,
    inflationRate,
    unemploymentRate: Math.max(0, unemploymentRate), // Unemployment cannot be negative
  };
}

/**
 * Calculate multi-year GDP projections with growth rates and policy effects
 *
 * Generates year-by-year projections starting from base year, applying:
 * - GDP growth (compounded annually)
 * - Population growth (compounded annually)
 * - Policy effects (temporal, applied only during active years)
 *
 * @param parameters - Core model parameters
 * @param baseGdp - Starting GDP value (from sectoral data or economic data)
 * @param basePopulation - Starting population value
 * @param policyEffects - Array of policy effects to apply
 * @returns Array of yearly projection data
 *
 * @example
 * ```ts
 * const projections = calculateGdpProjections(
 *   { baseYear: 2024, projectionYears: 5, gdpGrowthRate: 3.0, ... },
 *   1000000000,
 *   5000000,
 *   policies
 * );
 * // Returns: [{ year: "2024", gdp: 1030000000, gdpPerCapita: 206.12, ... }, ...]
 * ```
 */
export function calculateGdpProjections(
  parameters: ModelParameters,
  baseGdp: number,
  basePopulation: number,
  policyEffects: PolicyData[]
): YearProjection[] {
  const data: YearProjection[] = [];
  let currentGDP = baseGdp;
  let currentPopulation = basePopulation;

  for (let i = 0; i < parameters.projectionYears; i++) {
    const year = parameters.baseYear + i;

    // Apply policy effects to base rates
    const adjustedRates = applyPolicyEffects(year, policyEffects, {
      gdpGrowthRate: parameters.gdpGrowthRate,
      inflationRate: parameters.inflationRate,
      unemploymentRate: parameters.unemploymentRate,
    });

    // Apply growth rates (compounded)
    currentGDP *= 1 + adjustedRates.gdpGrowthRate / 100;
    currentPopulation *= 1 + parameters.populationGrowthRate / 100;

    data.push({
      year: year.toString(),
      gdp: parseFloat(currentGDP.toFixed(2)),
      gdpPerCapita: parseFloat((currentGDP / currentPopulation).toFixed(2)),
      inflation: parseFloat(adjustedRates.inflationRate.toFixed(2)),
      unemployment: parseFloat(adjustedRates.unemploymentRate.toFixed(2)),
      population: Math.round(currentPopulation),
    });
  }

  return data;
}

/**
 * Calculate model health score based on economic parameters
 *
 * Assesses economic health across multiple dimensions:
 * - GDP Growth: Optimal 2-5%, negative growth penalized
 * - Inflation: Optimal 1-3%, high inflation (>8%) penalized
 * - Unemployment: Lower is better, very high (>15%) penalized
 * - Fiscal Balance: Optimal ±3%, large deficits/surpluses (>10%) penalized
 *
 * @param parameters - Model parameters to assess
 * @returns Health assessment with score (0-100), status label, and warnings
 *
 * @example
 * ```ts
 * const health = calculateModelHealth(parameters);
 * // Returns: { score: 85, status: 'excellent', warnings: [] }
 * ```
 */
export function calculateModelHealth(parameters: ModelParameters): ModelHealth {
  let score = 70; // Base score
  const warnings: string[] = [];

  // GDP Growth Assessment (optimal: 2-5%)
  if (parameters.gdpGrowthRate >= 2 && parameters.gdpGrowthRate <= 5) {
    score += 10;
  } else if (parameters.gdpGrowthRate < 0) {
    score -= 15;
    warnings.push("Negative GDP growth indicates economic contraction");
  } else if (parameters.gdpGrowthRate > 10) {
    warnings.push("Very high GDP growth may indicate overheating");
  }

  // Inflation Assessment (optimal: 1-3%)
  if (parameters.inflationRate >= 1 && parameters.inflationRate <= 3) {
    score += 10;
  } else if (parameters.inflationRate > 8) {
    score -= 15;
    warnings.push("High inflation may erode purchasing power");
  } else if (parameters.inflationRate < 0) {
    warnings.push("Deflation detected - may indicate weak demand");
  }

  // Unemployment Assessment (lower is better)
  if (parameters.unemploymentRate <= 5) {
    score += 10;
  } else if (parameters.unemploymentRate > 15) {
    score -= 15;
    warnings.push("Very high unemployment indicates labor market stress");
  } else if (parameters.unemploymentRate > 10) {
    warnings.push("Elevated unemployment levels");
  }

  // Fiscal Balance Assessment (optimal: ±3%)
  if (Math.abs(parameters.fiscalBalance) <= 3) {
    score += 5;
  } else if (Math.abs(parameters.fiscalBalance) > 10) {
    score -= 10;
    if (parameters.fiscalBalance < -10) {
      warnings.push("Large fiscal deficit may indicate unsustainable debt");
    } else {
      warnings.push("Large fiscal surplus - consider productive investments");
    }
  }

  // Trade Balance Assessment
  if (Math.abs(parameters.tradeBalance) > 15) {
    warnings.push("Large trade imbalance may indicate structural issues");
  }

  // Interest Rate Assessment
  if (parameters.interestRate < 0) {
    warnings.push("Negative interest rates - unconventional monetary policy");
  } else if (parameters.interestRate > 15) {
    warnings.push("Very high interest rates may constrain growth");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  const status: ModelHealth["status"] =
    finalScore >= 85 ? "excellent" : finalScore >= 70 ? "good" : finalScore >= 55 ? "fair" : "poor";

  return {
    score: finalScore,
    status,
    warnings,
  };
}

/**
 * Validate model parameters for completeness and range compliance
 *
 * Checks all parameters against their defined constraints and ensures
 * required fields are present and within acceptable ranges.
 *
 * @param params - Model parameters to validate
 * @returns Validation result with validity flag and error messages
 *
 * @example
 * ```ts
 * const validation = validateModelParameters(parameters);
 * if (!validation.valid) {
 *   console.error('Validation errors:', validation.errors);
 * }
 * ```
 */
export function validateModelParameters(params: ModelParameters): ValidationResult {
  const errors: string[] = [];

  // Base Year validation
  if (!params.baseYear || params.baseYear < 1900 || params.baseYear > 2100) {
    errors.push("Base year must be between 1900 and 2100");
  }

  // Projection Years validation
  if (!params.projectionYears || params.projectionYears < 1 || params.projectionYears > 50) {
    errors.push("Projection years must be between 1 and 50");
  }

  // GDP Growth Rate validation
  if (params.gdpGrowthRate < -20 || params.gdpGrowthRate > 20) {
    errors.push("GDP growth rate must be between -20% and 20%");
  }

  // Inflation Rate validation
  if (params.inflationRate < -10 || params.inflationRate > 50) {
    errors.push("Inflation rate must be between -10% and 50%");
  }

  // Unemployment Rate validation
  if (params.unemploymentRate < 0 || params.unemploymentRate > 50) {
    errors.push("Unemployment rate must be between 0% and 50%");
  }

  // Interest Rate validation
  if (params.interestRate < -5 || params.interestRate > 30) {
    errors.push("Interest rate must be between -5% and 30%");
  }

  // Exchange Rate validation
  if (params.exchangeRate < 0 || params.exchangeRate > 1000) {
    errors.push("Exchange rate must be between 0 and 1000");
  }

  // Population Growth Rate validation
  if (params.populationGrowthRate < -5 || params.populationGrowthRate > 10) {
    errors.push("Population growth rate must be between -5% and 10%");
  }

  // Investment Rate validation
  if (params.investmentRate < 0 || params.investmentRate > 50) {
    errors.push("Investment rate must be between 0% and 50%");
  }

  // Fiscal Balance validation
  if (params.fiscalBalance < -20 || params.fiscalBalance > 20) {
    errors.push("Fiscal balance must be between -20% and 20%");
  }

  // Trade Balance validation
  if (params.tradeBalance < -20 || params.tradeBalance > 20) {
    errors.push("Trade balance must be between -20% and 20%");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate sectoral growth and updated outputs
 *
 * Applies sector-specific growth rates to sectoral outputs to project
 * future sectoral composition of the economy.
 *
 * @param sectors - Current sectoral output data
 * @param growthRates - Growth rates for each sector
 * @returns Updated sectoral outputs after growth application
 *
 * @example
 * ```ts
 * const updated = calculateSectoralGrowth(
 *   [{ year: 2024, agriculture: 100, industry: 300, services: 500, government: 100, totalGDP: 1000 }],
 *   { agriculture: 2.0, industry: 3.5, services: 4.0, government: 2.0 }
 * );
 * ```
 */
export function calculateSectoralGrowth(
  sectors: SectorData[],
  growthRates: {
    agriculture: number;
    industry: number;
    services: number;
    government: number;
  }
): SectorData[] {
  return sectors.map((sector) => {
    const agriculture = sector.agriculture * (1 + growthRates.agriculture / 100);
    const industry = sector.industry * (1 + growthRates.industry / 100);
    const services = sector.services * (1 + growthRates.services / 100);
    const government = sector.government * (1 + growthRates.government / 100);
    const totalGDP = agriculture + industry + services + government;

    return {
      year: sector.year + 1,
      agriculture: parseFloat(agriculture.toFixed(2)),
      industry: parseFloat(industry.toFixed(2)),
      services: parseFloat(services.toFixed(2)),
      government: parseFloat(government.toFixed(2)),
      totalGDP: parseFloat(totalGDP.toFixed(2)),
    };
  });
}

/**
 * Generate complete yearly projection data
 *
 * Main projection generator that combines all calculation functions to produce
 * comprehensive multi-year economic projections including GDP, per capita values,
 * inflation, unemployment, and population.
 *
 * @param params - Model parameters
 * @param baseData - Base economic data (GDP, population)
 * @param policies - Policy effects to apply
 * @returns Complete projection dataset for all years
 *
 * @example
 * ```ts
 * const projections = generateYearlyProjectionData(
 *   parameters,
 *   { gdp: 1000000000, population: 5000000, sectoralOutputs: [...] },
 *   policyEffects
 * );
 * ```
 */
export function generateYearlyProjectionData(
  params: ModelParameters,
  baseData: {
    gdp: number;
    population: number;
    sectoralOutputs: SectorData[];
  },
  policies: PolicyData[]
): YearProjection[] {
  // Find base GDP from sectoral outputs or use provided GDP
  const baseGdp =
    baseData.sectoralOutputs.find((s) => s.year === params.baseYear)?.totalGDP ?? baseData.gdp;

  // Calculate projections
  return calculateGdpProjections(params, baseGdp, baseData.population, policies);
}
