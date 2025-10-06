// src/lib/stability-formulas.ts
// Internal stability calculation formulas
// Converts economic, demographic, and policy data into security metrics

import type { Country } from '@prisma/client';

// ====================================
// TYPE DEFINITIONS
// ====================================

export interface EconomicData {
  gdpGrowth: number; // Percentage growth rate
  unemploymentRate: number; // Percentage
  giniIndex: number; // 0-100 scale
  inflationRate: number; // Percentage
  gdpPerCapita: number; // USD
  povertyRate: number; // Percentage below poverty line
}

export interface GovernmentData {
  policingBudget: number; // USD
  educationBudget: number; // USD
  socialServicesBudget: number; // USD
  totalBudget: number; // USD
  corruptionIndex: number; // 0-100, higher = more corrupt
}

export interface DemographicData {
  population: number;
  ethnicDiversity: number; // 0-100 scale
  religiousDiversity: number; // 0-100 scale
  urbanizationRate: number; // Percentage
  youthUnemployment: number; // Percentage (ages 15-24)
  populationDensity: number; // People per sq km
}

export interface PoliticalData {
  politicalStability: number; // -2.5 to 2.5 scale (World Bank)
  politicalPolarization: number; // 0-100 scale
  electionCycle: number; // Years since last election
  democracyIndex: number; // 0-100 scale
  protestFrequency: number; // Events per year
}

export interface RecentPolicy {
  type: string;
  popularityImpact: number; // -100 to 100
  economicImpact: number; // -100 to 100
  timeSincePassed: number; // Days
}

export interface StabilityMetrics {
  // Overall score
  stabilityScore: number; // 0-100

  // Crime metrics
  crimeRate: number; // Per 100k population
  violentCrimeRate: number; // Per 100k population
  propertyCrimeRate: number; // Per 100k population
  organizedCrimeLevel: number; // 0-100 percentage

  // Law enforcement
  policingEffectiveness: number; // 0-100 percentage
  justiceSystemEfficiency: number; // 0-100 percentage

  // Public order
  protestFrequency: number; // Per year
  riotRisk: number; // 0-100 percentage
  civilDisobedience: number; // 0-100 percentage

  // Social cohesion
  socialCohesion: number; // 0-100 percentage
  ethnicTension: number; // 0-100 percentage
  politicalPolarization: number; // 0-100 percentage

  // Public confidence
  trustInGovernment: number; // 0-100 percentage
  trustInPolice: number; // 0-100 percentage
  fearOfCrime: number; // 0-100 percentage

  // Trend
  stabilityTrend: 'improving' | 'stable' | 'declining' | 'critical';
}

// ====================================
// CORE CALCULATION FUNCTIONS
// ====================================

/**
 * Calculate overall crime rate based on economic and social factors
 */
export function calculateCrimeRate(
  economic: EconomicData,
  demographic: DemographicData,
  government: GovernmentData
): { overall: number; violent: number; property: number } {
  // Base crime rate influenced by unemployment
  const unemploymentFactor = economic.unemploymentRate * 0.8;

  // Inequality drives property crime
  const inequalityFactor = (economic.giniIndex / 100) * 15;

  // Poverty increases all crime
  const povertyFactor = economic.povertyRate * 0.6;

  // Youth unemployment is a strong predictor of violent crime
  const youthFactor = demographic.youthUnemployment * 0.4;

  // Urbanization concentrates crime
  const urbanFactor = (demographic.urbanizationRate / 100) * 5;

  // Police budget effectiveness (per capita spending)
  const policingPerCapita = government.policingBudget / demographic.population;
  const policingFactor = Math.max(0, 10 - (policingPerCapita / 100) * 10);

  // Calculate base rates per 100k population
  const baseCrimeRate =
    unemploymentFactor +
    inequalityFactor +
    povertyFactor +
    urbanFactor +
    policingFactor;

  // Violent crime is more influenced by youth unemployment and poverty
  const violentCrimeRate = Math.max(
    1,
    (baseCrimeRate * 0.3) + youthFactor + (povertyFactor * 0.5)
  );

  // Property crime is more influenced by inequality and economic conditions
  const propertyCrimeRate = Math.max(
    5,
    (baseCrimeRate * 0.7) + inequalityFactor + (economic.inflationRate * 0.3)
  );

  return {
    overall: Math.min(100, violentCrimeRate + propertyCrimeRate),
    violent: Math.min(50, violentCrimeRate),
    property: Math.min(80, propertyCrimeRate),
  };
}

/**
 * Calculate organized crime level
 */
export function calculateOrganizedCrime(
  economic: EconomicData,
  government: GovernmentData,
  political: PoliticalData
): number {
  // Corruption enables organized crime
  const corruptionFactor = government.corruptionIndex * 0.4;

  // Political instability creates opportunities
  const stabilityFactor = (2.5 - Math.max(-2.5, Math.min(2.5, political.politicalStability))) * 8;

  // Weak institutions allow organized crime to flourish
  const institutionsFactor = (100 - political.democracyIndex) * 0.3;

  // Economic desperation drives participation
  const desperationFactor = (economic.unemploymentRate + economic.povertyRate) * 0.2;

  const organizedCrimeLevel =
    corruptionFactor +
    stabilityFactor +
    institutionsFactor +
    desperationFactor;

  return Math.max(0, Math.min(100, organizedCrimeLevel));
}

/**
 * Calculate policing effectiveness
 */
export function calculatePolicingEffectiveness(
  government: GovernmentData,
  demographic: DemographicData
): number {
  // Budget per capita
  const budgetPerCapita = government.policingBudget / demographic.population;
  const budgetFactor = Math.min(50, (budgetPerCapita / 200) * 50);

  // Corruption undermines effectiveness
  const corruptionPenalty = government.corruptionIndex * 0.3;

  // Base effectiveness
  const effectiveness = 50 + budgetFactor - corruptionPenalty;

  return Math.max(10, Math.min(100, effectiveness));
}

/**
 * Calculate social cohesion
 */
export function calculateSocialCohesion(
  economic: EconomicData,
  demographic: DemographicData,
  political: PoliticalData
): number {
  // Economic growth fosters social cohesion
  const growthFactor = Math.min(10, Math.max(-10, economic.gdpGrowth * 3));

  // Inequality undermines cohesion
  const inequalityPenalty = (economic.giniIndex / 100) * 30;

  // Political stability contributes to cohesion
  const stabilityFactor = ((political.politicalStability + 2.5) / 5) * 20;

  // Polarization divides society
  const polarizationPenalty = political.politicalPolarization * 0.3;

  // Diversity can be neutral or divisive depending on other factors
  const diversityFactor = (demographic.ethnicDiversity / 100) * -5;

  const cohesion =
    60 + // Base level
    growthFactor +
    stabilityFactor -
    inequalityPenalty -
    polarizationPenalty +
    diversityFactor;

  return Math.max(0, Math.min(100, cohesion));
}

/**
 * Calculate ethnic tension
 */
export function calculateEthnicTension(
  demographic: DemographicData,
  economic: EconomicData,
  political: PoliticalData
): number {
  // Diversity alone doesn't cause tension
  const diversityFactor = (demographic.ethnicDiversity / 100) * 15;

  // Economic scarcity increases tension
  const scarcityFactor = (economic.unemploymentRate + economic.povertyRate) * 0.3;

  // Inequality exacerbates tensions
  const inequalityFactor = (economic.giniIndex / 100) * 20;

  // Political manipulation can inflame tensions
  const polarizationFactor = political.politicalPolarization * 0.2;

  const tension =
    diversityFactor +
    scarcityFactor +
    inequalityFactor +
    polarizationFactor;

  return Math.max(0, Math.min(100, tension));
}

/**
 * Calculate protest frequency
 */
export function calculateProtestFrequency(
  political: PoliticalData,
  economic: EconomicData,
  recentPolicies: RecentPolicy[]
): number {
  // Base protest level from polarization
  const basePoliticalFactor = political.politicalPolarization * 0.15;

  // Economic grievances drive protests
  const unemploymentFactor = economic.unemploymentRate * 0.5;
  const inequalityFactor = (economic.giniIndex / 100) * 8;

  // Recent unpopular policies trigger protests
  const policyImpact = recentPolicies
    .filter(p => p.timeSincePassed < 90) // Last 3 months
    .reduce((sum, p) => sum + Math.max(0, -p.popularityImpact) * 0.1, 0);

  // Democracy allows for more protests (not necessarily bad)
  const democracyFactor = (political.democracyIndex / 100) * 10;

  const frequency =
    basePoliticalFactor +
    unemploymentFactor +
    inequalityFactor +
    policyImpact +
    democracyFactor;

  return Math.max(0, Math.round(frequency));
}

/**
 * Calculate riot risk
 */
export function calculateRiotRisk(
  political: PoliticalData,
  economic: EconomicData,
  crimeRate: number,
  policingEffectiveness: number
): number {
  // High polarization increases riot risk
  const polarizationFactor = political.politicalPolarization * 0.3;

  // Economic desperation
  const desperationFactor = (economic.unemploymentRate + economic.povertyRate) * 0.3;

  // Existing crime environment
  const crimeFactor = (crimeRate / 100) * 20;

  // Weak policing allows riots to occur
  const policingFactor = Math.max(0, 20 - (policingEffectiveness / 100) * 20);

  // Recent protests increase risk
  const protestFactor = Math.min(20, political.protestFrequency * 0.5);

  const riotRisk =
    polarizationFactor +
    desperationFactor +
    crimeFactor +
    policingFactor +
    protestFactor;

  return Math.max(0, Math.min(100, riotRisk));
}

/**
 * Calculate trust in government
 */
export function calculateTrustInGovernment(
  political: PoliticalData,
  government: GovernmentData,
  economic: EconomicData
): number {
  // Democracy correlates with trust
  const democracyFactor = (political.democracyIndex / 100) * 30;

  // Corruption destroys trust
  const corruptionPenalty = government.corruptionIndex * 0.4;

  // Economic performance affects trust
  const economicFactor = Math.min(15, Math.max(-15, economic.gdpGrowth * 4));

  // Political stability breeds trust
  const stabilityFactor = ((political.politicalStability + 2.5) / 5) * 20;

  // Polarization reduces trust
  const polarizationPenalty = political.politicalPolarization * 0.15;

  const trust =
    30 + // Base level
    democracyFactor +
    economicFactor +
    stabilityFactor -
    corruptionPenalty -
    polarizationPenalty;

  return Math.max(5, Math.min(95, trust));
}

/**
 * Calculate trust in police
 */
export function calculateTrustInPolice(
  policingEffectiveness: number,
  government: GovernmentData,
  crimeRate: number
): number {
  // Effective policing builds trust
  const effectivenessFactor = policingEffectiveness * 0.5;

  // Corruption undermines trust
  const corruptionPenalty = government.corruptionIndex * 0.35;

  // High crime reduces trust
  const crimePenalty = (crimeRate / 100) * 20;

  const trust =
    40 + // Base level
    effectivenessFactor -
    corruptionPenalty -
    crimePenalty;

  return Math.max(10, Math.min(95, trust));
}

/**
 * Calculate fear of crime
 */
export function calculateFearOfCrime(
  crimeRate: number,
  violentCrimeRate: number,
  policingEffectiveness: number,
  demographic: DemographicData
): number {
  // Actual crime drives fear
  const crimeFactor = (crimeRate / 100) * 40;
  const violentFactor = violentCrimeRate * 0.8;

  // Effective policing reduces fear
  const policingFactor = Math.max(0, 25 - (policingEffectiveness / 100) * 25);

  // Urban areas have higher fear
  const urbanFactor = (demographic.urbanizationRate / 100) * 10;

  const fear =
    crimeFactor +
    violentFactor +
    policingFactor +
    urbanFactor;

  return Math.max(5, Math.min(85, fear));
}

// ====================================
// MAIN AGGREGATION FUNCTION
// ====================================

/**
 * Calculate comprehensive stability metrics
 */
export function calculateStabilityMetrics(
  economic: EconomicData,
  government: GovernmentData,
  demographic: DemographicData,
  political: PoliticalData,
  recentPolicies: RecentPolicy[] = []
): StabilityMetrics {
  // Calculate crime metrics
  const crimeData = calculateCrimeRate(economic, demographic, government);
  const organizedCrimeLevel = calculateOrganizedCrime(economic, government, political);

  // Calculate law enforcement
  const policingEffectiveness = calculatePolicingEffectiveness(government, demographic);
  const justiceSystemEfficiency = Math.max(
    20,
    Math.min(90, 50 + (political.democracyIndex / 100) * 30 - government.corruptionIndex * 0.2)
  );

  // Calculate public order
  const protestFrequency = calculateProtestFrequency(political, economic, recentPolicies);
  const riotRisk = calculateRiotRisk(political, economic, crimeData.overall, policingEffectiveness);
  const civilDisobedience = Math.max(
    0,
    Math.min(100, political.politicalPolarization * 0.4 + (100 - political.democracyIndex) * 0.3)
  );

  // Calculate social metrics
  const socialCohesion = calculateSocialCohesion(economic, demographic, political);
  const ethnicTension = calculateEthnicTension(demographic, economic, political);

  // Calculate trust metrics
  const trustInGovernment = calculateTrustInGovernment(political, government, economic);
  const trustInPolice = calculateTrustInPolice(policingEffectiveness, government, crimeData.overall);
  const fearOfCrime = calculateFearOfCrime(
    crimeData.overall,
    crimeData.violent,
    policingEffectiveness,
    demographic
  );

  // Calculate overall stability score (0-100)
  const stabilityScore = Math.max(
    0,
    Math.min(
      100,
      socialCohesion * 0.25 + // Social cohesion is key
      trustInGovernment * 0.2 + // Trust in institutions
      (100 - crimeData.overall) * 0.2 + // Low crime
      (100 - ethnicTension) * 0.15 + // Low tensions
      (100 - riotRisk) * 0.1 + // Low riot risk
      policingEffectiveness * 0.1 // Effective security
    )
  );

  // Determine stability trend
  let stabilityTrend: 'improving' | 'stable' | 'declining' | 'critical' = 'stable';

  if (stabilityScore >= 70 && economic.gdpGrowth > 2) {
    stabilityTrend = 'improving';
  } else if (stabilityScore < 40 || riotRisk > 60) {
    stabilityTrend = 'critical';
  } else if (economic.gdpGrowth < 0 || political.politicalPolarization > 70) {
    stabilityTrend = 'declining';
  }

  return {
    stabilityScore: Math.round(stabilityScore),
    crimeRate: Math.round(crimeData.overall * 10) / 10,
    violentCrimeRate: Math.round(crimeData.violent * 10) / 10,
    propertyCrimeRate: Math.round(crimeData.property * 10) / 10,
    organizedCrimeLevel: Math.round(organizedCrimeLevel),
    policingEffectiveness: Math.round(policingEffectiveness),
    justiceSystemEfficiency: Math.round(justiceSystemEfficiency),
    protestFrequency,
    riotRisk: Math.round(riotRisk),
    civilDisobedience: Math.round(civilDisobedience),
    socialCohesion: Math.round(socialCohesion),
    ethnicTension: Math.round(ethnicTension),
    politicalPolarization: Math.round(political.politicalPolarization),
    trustInGovernment: Math.round(trustInGovernment),
    trustInPolice: Math.round(trustInPolice),
    fearOfCrime: Math.round(fearOfCrime),
    stabilityTrend,
  };
}

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Generate default economic data for testing
 */
export function generateDefaultEconomicData(): EconomicData {
  return {
    gdpGrowth: 2.5,
    unemploymentRate: 5.0,
    giniIndex: 35,
    inflationRate: 2.0,
    gdpPerCapita: 35000,
    povertyRate: 12,
  };
}

/**
 * Generate default government data for testing
 */
export function generateDefaultGovernmentData(population: number): GovernmentData {
  return {
    policingBudget: population * 200,
    educationBudget: population * 1500,
    socialServicesBudget: population * 800,
    totalBudget: population * 5000,
    corruptionIndex: 30,
  };
}

/**
 * Generate default demographic data for testing
 */
export function generateDefaultDemographicData(): DemographicData {
  return {
    population: 10000000,
    ethnicDiversity: 40,
    religiousDiversity: 30,
    urbanizationRate: 75,
    youthUnemployment: 12,
    populationDensity: 100,
  };
}

/**
 * Generate default political data for testing
 */
export function generateDefaultPoliticalData(): PoliticalData {
  return {
    politicalStability: 0.5,
    politicalPolarization: 45,
    electionCycle: 2,
    democracyIndex: 70,
    protestFrequency: 8,
  };
}
