/**
 * Vitality Score Calculator
 *
 * Calculates health scores for all national vitality indicators
 * These scores are stored in the database for fast access
 */

import type { Country } from '@prisma/client';

export interface VitalityScores {
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
  overallNationalHealth: number;
}

/**
 * Calculate Economic Vitality Score (0-100)
 * Based on: GDP per capita, growth rate, economic tier, employment
 */
export function calculateEconomicVitality(country: Partial<Country>): number {
  let score = 50; // Base score

  // GDP Per Capita contribution (0-30 points)
  const gdpPerCapita = country.currentGdpPerCapita || 0;
  if (gdpPerCapita >= 80000) score += 30;
  else if (gdpPerCapita >= 60000) score += 25;
  else if (gdpPerCapita >= 40000) score += 20;
  else if (gdpPerCapita >= 20000) score += 15;
  else if (gdpPerCapita >= 10000) score += 10;
  else score += Math.max(0, (gdpPerCapita / 10000) * 10);

  // GDP Growth Rate contribution (0-20 points)
  const growthRate = country.realGDPGrowthRate || country.adjustedGdpGrowth || 0;
  if (growthRate >= 5) score += 20;
  else if (growthRate >= 3) score += 15;
  else if (growthRate >= 1) score += 10;
  else if (growthRate >= 0) score += 5;
  else score -= Math.abs(growthRate) * 2; // Penalty for negative growth

  // Employment contribution (0-20 points)
  const employmentRate = country.employmentRate || 0;
  const unemploymentRate = country.unemploymentRate || 0;
  if (employmentRate > 0) {
    score += Math.min(20, employmentRate / 5);
  } else if (unemploymentRate > 0) {
    // Use unemployment as inverse indicator
    const effectiveEmployment = 100 - unemploymentRate;
    score += Math.min(20, effectiveEmployment / 5);
  }

  // Economic Tier contribution (0-15 points)
  const tier = country.economicTier || '';
  if (tier.includes('Very Strong')) score += 15;
  else if (tier.includes('Strong')) score += 12;
  else if (tier.includes('Stable')) score += 9;
  else if (tier.includes('Developing')) score += 6;
  else score += 3;

  // Trade Balance contribution (0-10 points)
  const tradeBalance = country.tradeBalance || 0;
  if (tradeBalance > 0) {
    score += Math.min(10, (tradeBalance / 1000000000) * 2);
  }

  // Inflation control (0-5 points or -10 penalty)
  const inflation = country.inflationRate || 2;
  if (inflation >= 0 && inflation <= 3) score += 5; // Healthy inflation
  else if (inflation <= 5) score += 2;
  else if (inflation > 10) score -= 10; // High inflation penalty

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Population Wellbeing Score (0-100)
 * Based on: Life expectancy, literacy, inequality, poverty, quality of life
 */
export function calculatePopulationWellbeing(country: Partial<Country>): number {
  let score = 50; // Base score

  // Life Expectancy contribution (0-25 points)
  const lifeExpectancy = country.lifeExpectancy || 0;
  if (lifeExpectancy >= 80) score += 25;
  else if (lifeExpectancy >= 75) score += 20;
  else if (lifeExpectancy >= 70) score += 15;
  else if (lifeExpectancy >= 65) score += 10;
  else if (lifeExpectancy >= 60) score += 5;
  else score += Math.max(0, (lifeExpectancy / 60) * 5);

  // Literacy Rate contribution (0-20 points)
  const literacyRate = country.literacyRate || 0;
  score += Math.min(20, (literacyRate / 100) * 20);

  // Income Inequality contribution (0-20 points, inverted)
  const gini = country.incomeInequalityGini || 0.35;
  if (gini <= 0.25) score += 20; // Very equal
  else if (gini <= 0.35) score += 15;
  else if (gini <= 0.45) score += 10;
  else if (gini <= 0.55) score += 5;
  // High inequality (>0.55) gets no points

  // Poverty Rate contribution (0-15 points, inverted)
  const povertyRate = country.povertyRate || 0;
  if (povertyRate <= 5) score += 15;
  else if (povertyRate <= 10) score += 12;
  else if (povertyRate <= 20) score += 8;
  else if (povertyRate <= 30) score += 4;
  // High poverty (>30%) gets no points

  // Population Growth (0-10 points)
  const popGrowth = country.populationGrowthRate || 0;
  if (popGrowth >= 0.5 && popGrowth <= 2) score += 10; // Healthy growth
  else if (popGrowth >= 0 && popGrowth < 0.5) score += 7; // Slow growth
  else if (popGrowth > 2 && popGrowth <= 3) score += 5; // High growth
  else if (popGrowth < 0) score += 3; // Declining population
  // Very high growth (>3%) gets no points

  // Social Mobility contribution (0-10 points)
  const socialMobility = country.socialMobilityIndex || 0;
  score += Math.min(10, (socialMobility / 100) * 10);

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Diplomatic Standing Score (0-100)
 * Based on: Active alliances, treaties, reputation, regional influence
 */
export function calculateDiplomaticStanding(country: Partial<Country>): number {
  let score = 50; // Base score

  // Active Alliances contribution (0-30 points)
  const alliances = country.activeAlliances || 0;
  if (alliances >= 10) score += 30;
  else if (alliances >= 7) score += 25;
  else if (alliances >= 5) score += 20;
  else if (alliances >= 3) score += 15;
  else if (alliances >= 1) score += 10;
  // Isolated countries get no bonus

  // Active Treaties contribution (0-25 points)
  const treaties = country.activeTreaties || 0;
  if (treaties >= 30) score += 25;
  else if (treaties >= 20) score += 20;
  else if (treaties >= 10) score += 15;
  else if (treaties >= 5) score += 10;
  else score += treaties * 2;

  // Diplomatic Reputation contribution (0-30 points)
  const reputation = country.diplomaticReputation || 'Neutral';
  if (reputation === 'Excellent' || reputation === 'Rising') score += 30;
  else if (reputation === 'Good' || reputation === 'Stable') score += 20;
  else if (reputation === 'Neutral') score += 10;
  else if (reputation === 'Declining') score += 5;
  else if (reputation === 'Poor') score += 0;
  // Negative reputations get no points

  // Regional influence (based on economic and population size) (0-15 points)
  const gdpPerCapita = country.currentGdpPerCapita || 0;
  const population = country.currentPopulation || 0;
  const totalGdp = gdpPerCapita * population;

  if (totalGdp >= 5000000000000) score += 15; // $5T+ GDP
  else if (totalGdp >= 1000000000000) score += 12; // $1T+ GDP
  else if (totalGdp >= 500000000000) score += 9; // $500B+ GDP
  else if (totalGdp >= 100000000000) score += 6; // $100B+ GDP
  else score += Math.min(6, (totalGdp / 100000000000) * 6);

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Governmental Efficiency Score (0-100)
 * Based on: Public approval, political stability, infrastructure, spending efficiency
 */
export function calculateGovernmentalEfficiency(country: Partial<Country>): number {
  let score = 50; // Base score

  // Public Approval contribution (0-30 points)
  const approval = country.publicApproval || 50;
  score += Math.min(30, ((approval - 50) / 50) * 30);

  // Political Stability contribution (0-25 points)
  const stability = country.politicalStability || 'Stable';
  if (stability === 'Very Stable') score += 25;
  else if (stability === 'Stable') score += 20;
  else if (stability === 'Moderate' || stability === 'Monitored') score += 10;
  else if (stability === 'Unstable') score += 0;
  else if (stability === 'Critical') score -= 10;

  // Government Efficiency Rating contribution (0-20 points)
  const efficiency = country.governmentEfficiency || 'Moderate';
  if (efficiency === 'Excellent' || efficiency === 'Very High') score += 20;
  else if (efficiency === 'Good' || efficiency === 'High') score += 15;
  else if (efficiency === 'Moderate') score += 10;
  else if (efficiency === 'Low') score += 5;
  else score += 0;

  // Infrastructure Rating contribution (0-15 points)
  const infrastructure = country.infrastructureRating || 50;
  score += Math.min(15, (infrastructure / 100) * 15);

  // Fiscal Responsibility (0-10 points)
  const budgetBalance = country.budgetDeficitSurplus || 0;
  const gdp = (country.currentGdpPerCapita || 0) * (country.currentPopulation || 1);
  const balancePercent = gdp > 0 ? (budgetBalance / gdp) * 100 : 0;

  if (balancePercent > 0) score += 10; // Surplus
  else if (balancePercent > -3) score += 7; // Small deficit
  else if (balancePercent > -5) score += 4; // Moderate deficit
  else if (balancePercent > -10) score += 1; // Large deficit
  // Very large deficit (>10%) gets no points

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Overall National Health Score (0-100)
 * Weighted average of all vitality scores
 */
export function calculateOverallNationalHealth(scores: {
  economic: number;
  population: number;
  diplomatic: number;
  governmental: number;
}): number {
  // Weighted average
  const weights = {
    economic: 0.35,      // 35% weight
    population: 0.30,    // 30% weight
    governmental: 0.20,  // 20% weight
    diplomatic: 0.15     // 15% weight
  };

  const overall =
    scores.economic * weights.economic +
    scores.population * weights.population +
    scores.governmental * weights.governmental +
    scores.diplomatic * weights.diplomatic;

  return Math.round(overall);
}

/**
 * Calculate all vitality scores for a country
 */
export function calculateAllVitalityScores(country: Partial<Country>): VitalityScores {
  const economicVitality = calculateEconomicVitality(country);
  const populationWellbeing = calculatePopulationWellbeing(country);
  const diplomaticStanding = calculateDiplomaticStanding(country);
  const governmentalEfficiency = calculateGovernmentalEfficiency(country);

  const overallNationalHealth = calculateOverallNationalHealth({
    economic: economicVitality,
    population: populationWellbeing,
    diplomatic: diplomaticStanding,
    governmental: governmentalEfficiency
  });

  return {
    economicVitality,
    populationWellbeing,
    diplomaticStanding,
    governmentalEfficiency,
    overallNationalHealth
  };
}
