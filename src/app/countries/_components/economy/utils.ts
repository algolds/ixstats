import type { EconomyData, CoreEconomicIndicatorsData, LaborEmploymentData } from "~/types/economics";

export function formatCurrency(amount: number | null | undefined, precision = 1): string {
  if (amount === null || amount === undefined) return 'N/A';
  const prefix = '$';
  if (Math.abs(amount) >= 1e12) return `${prefix}${(amount / 1e12).toFixed(precision)}T`;
  if (Math.abs(amount) >= 1e9) return `${prefix}${(amount / 1e9).toFixed(precision)}B`;
  if (Math.abs(amount) >= 1e6) return `${prefix}${(amount / 1e6).toFixed(precision)}M`;
  if (Math.abs(amount) >= 1e3) return `${prefix}${(amount / 1e3).toFixed(precision)}K`;
  return `${prefix}${amount.toFixed(precision)}`;
}

export function formatPopulation(population: number | null | undefined): string {
  if (population === null || population === undefined) return 'N/A';
  if (Math.abs(population) >= 1e6) return `${(population / 1e6).toFixed(1)}M`;
  if (Math.abs(population) >= 1e3) return `${(population / 1e3).toFixed(1)}K`;
  return population.toFixed(0);
}

export function formatPercentage(value: number | null | undefined, precision = 1): string {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toFixed(precision)}%`;
}

export function getEconomicTier(gdpPerCapita: number): 'Developing' | 'Emerging' | 'Developed' | 'Advanced' {
  if (gdpPerCapita >= 40000) return 'Advanced';
  if (gdpPerCapita >= 20000) return 'Developed';
  if (gdpPerCapita >= 5000) return 'Emerging';
  return 'Developing';
}

export function getEconomicHealthScore(economyData: EconomyData): {
  score: number;
  label: string;
  color: string;
} {
  let score = 70;

  // GDP per capita factor
  if (economyData.core.gdpPerCapita >= 50000) score += 15;
  else if (economyData.core.gdpPerCapita >= 25000) score += 10;
  else if (economyData.core.gdpPerCapita >= 10000) score += 5;
  else score -= 5;

  // Unemployment factor (skip if null)
  if (economyData.labor.unemploymentRate !== null && economyData.labor.unemploymentRate !== undefined) {
    if (economyData.labor.unemploymentRate <= 5) score += 10;
    else if (economyData.labor.unemploymentRate <= 10) score += 5;
    else if (economyData.labor.unemploymentRate >= 20) score -= 15;
    else if (economyData.labor.unemploymentRate >= 15) score -= 10;
  }

  // Fiscal health factor (skip if null)
  if (economyData.fiscal.taxRevenueGDPPercent !== null && economyData.fiscal.taxRevenueGDPPercent !== undefined) {
    if (economyData.fiscal.taxRevenueGDPPercent >= 15 && economyData.fiscal.taxRevenueGDPPercent <= 30) score += 5;
    else if (economyData.fiscal.taxRevenueGDPPercent < 10 || economyData.fiscal.taxRevenueGDPPercent > 40) score -= 5;
  }

  // Debt factor (skip if null)
  if (economyData.fiscal.totalDebtGDPRatio !== null && economyData.fiscal.totalDebtGDPRatio !== undefined) {
    if (economyData.fiscal.totalDebtGDPRatio <= 60) score += 5;
    else if (economyData.fiscal.totalDebtGDPRatio >= 150) score -= 10;
    else if (economyData.fiscal.totalDebtGDPRatio >= 100) score -= 5;
  }

  // Inflation factor
  if (economyData.core.inflationRate >= 0.02 && economyData.core.inflationRate <= 0.03) score += 5;
  else if (economyData.core.inflationRate > 0.08) score -= 10;
  else if (economyData.core.inflationRate > 0.05) score -= 5;

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  let label: string;
  let color: string;

  if (finalScore >= 85) {
    label = 'Excellent';
    color = 'text-green-600';
  } else if (finalScore >= 70) {
    label = 'Good';
    color = 'text-blue-600';
  } else if (finalScore >= 55) {
    label = 'Fair';
    color = 'text-yellow-600';
  } else if (finalScore >= 40) {
    label = 'Poor';
    color = 'text-orange-600';
  } else {
    label = 'Critical';
    color = 'text-red-600';
  }

  return { score: finalScore, label, color };
}

export function calculateBudgetHealth(fiscalData: any): {
  color: string;
  label: string;
} {
  const deficit = fiscalData.budgetDeficitSurplus || 0;
  const gdp = fiscalData.nominalGDP || 1;
  const deficitPercent = (deficit / gdp) * 100;

  if (deficitPercent > 1) return { color: "text-green-600", label: "Surplus" };
  if (deficitPercent > -2) return { color: "text-blue-600", label: "Balanced" };
  if (deficitPercent > -5) return { color: "text-yellow-600", label: "Moderate Deficit" };
  return { color: "text-red-600", label: "High Deficit" };
}

export function validateEconomicData(data: EconomyData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Core indicators validation
  if (data.core.totalPopulation <= 0) {
    errors.push("Population must be greater than 0");
  }
  if (data.core.gdpPerCapita <= 0) {
    errors.push("GDP per capita must be greater than 0");
  }
  if (data.core.realGDPGrowthRate < -0.2 || data.core.realGDPGrowthRate > 0.2) {
    warnings.push("GDP growth rate seems unrealistic");
  }
  if (data.core.inflationRate < 0 || data.core.inflationRate > 0.5) {
    warnings.push("Inflation rate seems extreme");
  }

  // Labor validation (skip if null)
  if (data.labor.unemploymentRate !== null && data.labor.unemploymentRate !== undefined) {
    if (data.labor.unemploymentRate < 0 || data.labor.unemploymentRate > 100) {
      errors.push("Unemployment rate must be between 0-100%");
    }
  }
  if (data.labor.laborForceParticipationRate !== null && data.labor.laborForceParticipationRate !== undefined) {
    if (data.labor.laborForceParticipationRate < 0 || data.labor.laborForceParticipationRate > 100) {
      errors.push("Labor force participation rate must be between 0-100%");
    }
  }

  // Fiscal validation (skip if null)
  if (data.fiscal.taxRevenueGDPPercent !== null && data.fiscal.taxRevenueGDPPercent !== undefined) {
    if (data.fiscal.taxRevenueGDPPercent < 0 || data.fiscal.taxRevenueGDPPercent > 100) {
      errors.push("Tax revenue percentage must be between 0-100%");
    }
  }
  if (data.fiscal.totalDebtGDPRatio !== null && data.fiscal.totalDebtGDPRatio !== undefined) {
    if (data.fiscal.totalDebtGDPRatio > 300) {
      warnings.push("Debt levels may be unsustainable");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
} 