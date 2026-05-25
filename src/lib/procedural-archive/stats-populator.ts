/**
 * IxStats Auto-Populator
 *
 * Generates realistic economic, demographic, and governance data
 * for procedurally created countries based on their geographic profile.
 *
 * Input: Generated countries with area, elevation, coastal perimeter, neighbors
 * Output: IxStats-compatible data for each country
 */

import { makeRng } from "./rng";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CountryGeoInput {
  id: string;
  name: string;
  areaKm2: number;
  elevation: number; // normalized 0-1
  coastalPerimeter: number; // 0 = landlocked, 1 = fully coastal
  neighbors: string[];
  cultureTraits?: {
    orientation?: string;
    lifestyle?: string;
    social?: string;
    economy?: string;
    temperament?: string;
  };
  habitability?: number; // 0-1 from population generator
  population?: number; // from population generator
}

export interface CountryStatsData {
  id: string;
  name: string;
  economicTier: string;
  populationTier: string;
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  maxGdpGrowthRate: number;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  governmentType: string;
  lifeExpectancy: number;
  urbanPopulationPercent: number;
  literacyRate: number;
  unemploymentRate: number;
  inflationRate: number;
  povertyRate: number;
  incomeInequalityGini: number;
  taxRevenueGDPPercent: number;
  totalDebtGDPRatio: number;
  infrastructureRating: number;
  diplomaticReputation: string;
  politicalStability: string;
}

export interface PopulationConfig {
  totalWorldPopulation?: number;
  seed: number;
}

// ──────────────────────────────────────────────
// Tier Classification
// ──────────────────────────────────────────────

/**
 * Compute an economic development score based on geography.
 * Higher = more developed potential.
 */
function geoAdvantageScore(country: CountryGeoInput): number {
  let score = 0.5; // baseline

  // Coastal access is a major economic advantage
  if (country.coastalPerimeter > 0.3) score += 0.15;
  else if (country.coastalPerimeter > 0) score += 0.08;
  else score -= 0.1; // landlocked penalty

  // Moderate elevation is fine, extreme is bad
  if (country.elevation < 0.3) score += 0.05;
  else if (country.elevation > 0.6) score -= 0.1;

  // Larger countries have more resources
  if (country.areaKm2 > 500_000) score += 0.08;
  else if (country.areaKm2 < 10_000) score -= 0.05;

  // More neighbors = more trade potential
  if (country.neighbors.length >= 4) score += 0.05;

  // Habitability bonus
  if (country.habitability) {
    score += (country.habitability - 0.5) * 0.2;
  }

  // Cultural traits influence
  if (country.cultureTraits?.economy === "mercantile") score += 0.1;
  if (country.cultureTraits?.economy === "industrial") score += 0.08;
  if (country.cultureTraits?.temperament === "expansionist") score += 0.05;
  if (country.cultureTraits?.temperament === "isolationist") score -= 0.05;

  return Math.max(0, Math.min(1, score));
}

function assignEconomicTier(score: number, rng: () => number): string {
  // Add variance
  const adjusted = score + (rng() - 0.5) * 0.2;
  if (adjusted >= 0.75) return "Tier 1";
  if (adjusted >= 0.6) return "Tier 2";
  if (adjusted >= 0.45) return "Tier 3";
  if (adjusted >= 0.3) return "Tier 4";
  return "Tier 5";
}

function assignPopulationTier(population: number): string {
  if (population >= 100_000_000) return "Superpower";
  if (population >= 50_000_000) return "Major";
  if (population >= 10_000_000) return "Medium";
  if (population >= 1_000_000) return "Small";
  return "Micro";
}

// ──────────────────────────────────────────────
// GDP Generation
// ──────────────────────────────────────────────

/** GDP per capita by tier (log-normal center) */
const TIER_GDP: Record<string, [number, number]> = {
  "Tier 1": [35_000, 80_000],
  "Tier 2": [15_000, 40_000],
  "Tier 3": [5_000, 18_000],
  "Tier 4": [1_500, 7_000],
  "Tier 5": [300, 2_500],
};

function generateGdpPerCapita(tier: string, rng: () => number): number {
  const [min, max] = TIER_GDP[tier] ?? [5_000, 15_000];
  // Log-normal-ish distribution
  const t = rng();
  return Math.round(min + (max - min) * t * t); // skew toward lower end
}

// ──────────────────────────────────────────────
// Government Type
// ──────────────────────────────────────────────

const GOVERNMENT_TYPES = [
  "Presidential Republic",
  "Parliamentary Republic",
  "Constitutional Monarchy",
  "Absolute Monarchy",
  "Federal Republic",
  "Theocracy",
  "One-Party State",
  "Military Junta",
  "Oligarchy",
  "Direct Democracy",
];

function assignGovernmentType(
  tier: string,
  traits: CountryGeoInput["cultureTraits"],
  rng: () => number
): string {
  const r = rng();

  // Higher tiers bias toward democratic governance
  if (tier === "Tier 1" || tier === "Tier 2") {
    if (traits?.social === "hierarchical") {
      return r < 0.5 ? "Constitutional Monarchy" : "Parliamentary Republic";
    }
    if (r < 0.3) return "Presidential Republic";
    if (r < 0.6) return "Parliamentary Republic";
    if (r < 0.8) return "Federal Republic";
    return "Constitutional Monarchy";
  }

  // Lower tiers have wider variance
  if (traits?.social === "hierarchical") {
    return r < 0.4 ? "Absolute Monarchy" : r < 0.7 ? "Theocracy" : "Constitutional Monarchy";
  }

  return GOVERNMENT_TYPES[Math.floor(rng() * GOVERNMENT_TYPES.length)]!;
}

// ──────────────────────────────────────────────
// Main Populator
// ──────────────────────────────────────────────

export function populateCountryStats(
  countries: CountryGeoInput[],
  config: PopulationConfig
): CountryStatsData[] {
  const rng = makeRng(config.seed);
  const totalWorldPop = config.totalWorldPopulation ?? countries.length * 5_000_000;

  // Step 1: Compute geographic scores and assign tiers
  const scores = countries.map((c) => geoAdvantageScore(c));
  const totalScore = scores.reduce((a, b) => a + b, 0);

  return countries.map((country, i) => {
    const geoScore = scores[i]!;
    const tier = assignEconomicTier(geoScore, rng);

    // Population: proportional to area + habitability, or use provided
    let population = country.population ?? 0;
    if (!population) {
      const share = totalScore > 0 ? geoScore / totalScore : 1 / countries.length;
      population = Math.round(totalWorldPop * share * (0.5 + rng()));
    }
    population = Math.max(10_000, population);

    const gdpPerCapita = generateGdpPerCapita(tier, rng);
    const totalGdp = population * gdpPerCapita;

    const govType = assignGovernmentType(tier, country.cultureTraits, rng);

    // Demographics correlated with economic tier
    const tierLevel = parseInt(tier.replace("Tier ", ""));
    const lifeExpectancy = 55 + (6 - tierLevel) * 6 + (rng() - 0.5) * 5;
    const urbanPercent = 30 + (6 - tierLevel) * 12 + (rng() - 0.5) * 10;
    const literacy = 50 + (6 - tierLevel) * 10 + rng() * 5;
    const unemployment = 2 + tierLevel * 2 + rng() * 5;
    const inflation = 1 + tierLevel * 1.5 + rng() * 3;
    const poverty = Math.max(0, tierLevel * 8 - 5 + (rng() - 0.5) * 10);
    const gini = 25 + tierLevel * 4 + (rng() - 0.5) * 10;
    const taxRevenue = 10 + (6 - tierLevel) * 5 + rng() * 5;
    const debtGdp = 20 + rng() * 60;
    const infraRating = 20 + (6 - tierLevel) * 15 + rng() * 10;

    const growthRate = 0.01 + (6 - tierLevel) * 0.005 + (rng() - 0.5) * 0.01;
    const popGrowth = tierLevel <= 2 ? 0.002 + rng() * 0.005 : 0.01 + rng() * 0.015;

    const stability =
      tierLevel <= 2
        ? "Stable"
        : tierLevel <= 3
          ? rng() < 0.7
            ? "Stable"
            : "Moderate"
          : rng() < 0.4
            ? "Moderate"
            : "Unstable";

    const dipReputation =
      tierLevel <= 2
        ? rng() < 0.5
          ? "Respected"
          : "Influential"
        : tierLevel <= 3
          ? "Neutral"
          : rng() < 0.5
            ? "Neutral"
            : "Controversial";

    return {
      id: country.id,
      name: country.name,
      economicTier: tier,
      populationTier: assignPopulationTier(population),
      baselinePopulation: population,
      baselineGdpPerCapita: gdpPerCapita,
      currentPopulation: population,
      currentGdpPerCapita: gdpPerCapita,
      currentTotalGdp: totalGdp,
      maxGdpGrowthRate: growthRate + 0.02,
      adjustedGdpGrowth: growthRate,
      populationGrowthRate: popGrowth,
      governmentType: govType,
      lifeExpectancy: Math.round(lifeExpectancy * 10) / 10,
      urbanPopulationPercent: Math.round(Math.min(95, Math.max(10, urbanPercent)) * 10) / 10,
      literacyRate: Math.round(Math.min(99.9, Math.max(30, literacy)) * 10) / 10,
      unemploymentRate: Math.round(Math.min(40, Math.max(1, unemployment)) * 10) / 10,
      inflationRate: Math.round(Math.min(30, Math.max(0.1, inflation)) * 10) / 10,
      povertyRate: Math.round(Math.min(80, Math.max(0, poverty)) * 10) / 10,
      incomeInequalityGini: Math.round(Math.min(70, Math.max(20, gini)) * 10) / 10,
      taxRevenueGDPPercent: Math.round(Math.min(50, Math.max(5, taxRevenue)) * 10) / 10,
      totalDebtGDPRatio: Math.round(Math.min(200, Math.max(5, debtGdp)) * 10) / 10,
      infrastructureRating: Math.round(Math.min(100, Math.max(5, infraRating))),
      diplomaticReputation: dipReputation,
      politicalStability: stability,
    };
  });
}
