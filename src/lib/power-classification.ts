// Power classification utility for countries
// Based on GDP, population, and economic development metrics

export type PowerTier = "superpower" | "major" | "regional" | "minor";

export interface PowerClassification {
  tier: PowerTier;
  score: number;
  factors: {
    economicPower: number;
    populationSize: number;
    developmentLevel: number;
    geopoliticalInfluence: number;
  };
}

export interface CountryPowerData {
  id: string;
  name: string;
  currentTotalGdp: number;
  currentPopulation: number;
  currentGdpPerCapita: number;
  economicTier: string;
  populationTier: string;
}

/**
 * Calculate economic power score (0-100)
 * Based on total GDP with logarithmic scaling
 */
function calculateEconomicPower(gdp: number): number {
  if (gdp <= 0) return 0;
  // Use logarithmic scale: 1T = 50, 10T = 75, 20T+ = 100
  const logGdp = Math.log10(gdp / 1e12);
  return Math.min(100, Math.max(0, (logGdp + 1) * 40));
}

/**
 * Calculate population influence score (0-100)
 * Large populations provide strategic depth and market size
 */
function calculatePopulationScore(population: number): number {
  if (population <= 0) return 0;
  // Use logarithmic scale: 10M = 25, 100M = 50, 1B = 75, 1.4B+ = 100
  const logPop = Math.log10(population / 1e6);
  return Math.min(100, Math.max(0, (logPop - 1) * 25));
}

/**
 * Calculate development level score (0-100)
 * Based on GDP per capita and economic tier
 */
function calculateDevelopmentLevel(gdpPerCapita: number, economicTier: string): number {
  // Base score from GDP per capita
  let score = Math.min(80, (gdpPerCapita / 50000) * 80);

  // Tier bonus
  const tierBonus = {
    Extravagant: 20,
    "Very Strong": 15,
    Strong: 10,
    Healthy: 5,
    Developed: 0,
    Developing: -10,
    Impoverished: -20,
  };

  score += tierBonus[economicTier as keyof typeof tierBonus] || 0;
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate geopolitical influence score (0-100)
 * Combination of economic size and development
 */
function calculateGeopoliticalInfluence(
  gdp: number,
  population: number,
  gdpPerCapita: number
): number {
  const economicWeight = Math.min(50, (gdp / 5e12) * 50); // Max 50 for 5T+ GDP
  const populationWeight = Math.min(25, (population / 200e6) * 25); // Max 25 for 200M+ pop
  const developmentWeight = Math.min(25, (gdpPerCapita / 40000) * 25); // Max 25 for 40K+ GDP/capita

  return economicWeight + populationWeight + developmentWeight;
}

/**
 * Classify a country's power level based on comprehensive metrics
 */
export function classifyCountryPower(country: CountryPowerData): PowerClassification {
  const factors = {
    economicPower: calculateEconomicPower(country.currentTotalGdp),
    populationSize: calculatePopulationScore(country.currentPopulation),
    developmentLevel: calculateDevelopmentLevel(country.currentGdpPerCapita, country.economicTier),
    geopoliticalInfluence: calculateGeopoliticalInfluence(
      country.currentTotalGdp,
      country.currentPopulation,
      country.currentGdpPerCapita
    ),
  };

  // Weighted score calculation
  const weights = {
    economicPower: 0.4, // 40% - Most important factor
    geopoliticalInfluence: 0.3, // 30% - Combined influence
    populationSize: 0.2, // 20% - Strategic depth
    developmentLevel: 0.1, // 10% - Quality bonus
  };

  const score =
    factors.economicPower * weights.economicPower +
    factors.geopoliticalInfluence * weights.geopoliticalInfluence +
    factors.populationSize * weights.populationSize +
    factors.developmentLevel * weights.developmentLevel;

  // Determine tier based on score and specific thresholds
  let tier: PowerTier;

  if (score >= 70 && country.currentTotalGdp > 8e12) {
    tier = "superpower";
  } else if (
    score >= 50 ||
    (country.currentTotalGdp > 2e12 && country.currentGdpPerCapita > 20000) ||
    (country.currentPopulation > 80e6 && country.currentGdpPerCapita > 30000)
  ) {
    tier = "major";
  } else if (
    score >= 30 ||
    country.currentTotalGdp > 0.5e12 ||
    (country.currentPopulation > 25e6 && country.currentGdpPerCapita > 15000)
  ) {
    tier = "regional";
  } else {
    tier = "minor";
  }

  return {
    tier,
    score: Math.round(score * 10) / 10,
    factors,
  };
}

/**
 * Get power tier display information
 */
export function getPowerTierInfo(tier: PowerTier) {
  const tierInfo = {
    superpower: {
      label: "Superpower",
      description: "Global influence, massive economy (>$8T GDP)",
      color: "#f59e0b",
      bgColor: "from-yellow-500/20 to-orange-500/20",
      borderColor: "border-yellow-500/30",
      icon: "👑",
    },
    major: {
      label: "Major Power",
      description: "Regional dominance, large economy (>$2T GDP)",
      color: "#3b82f6",
      bgColor: "from-blue-500/20 to-purple-500/20",
      borderColor: "border-blue-500/30",
      icon: "⭐",
    },
    regional: {
      label: "Regional Power",
      description: "Regional influence, substantial economy (>$500B GDP)",
      color: "#10b981",
      bgColor: "from-green-500/20 to-emerald-500/20",
      borderColor: "border-green-500/30",
      icon: "🌟",
    },
    minor: {
      label: "Minor Power",
      description: "Limited regional influence, developing economy",
      color: "#6b7280",
      bgColor: "bg-muted",
      borderColor: "border-muted",
      icon: "🏛️",
    },
  };

  return tierInfo[tier];
}

/**
 * Group countries by power tier
 */
export function groupCountriesByPower(countries: CountryPowerData[]) {
  const classified = countries.map((country) => ({
    ...country,
    powerClassification: classifyCountryPower(country),
  }));

  const grouped = {
    superpower: classified.filter((c) => c.powerClassification.tier === "superpower"),
    major: classified.filter((c) => c.powerClassification.tier === "major"),
    regional: classified.filter((c) => c.powerClassification.tier === "regional"),
    minor: classified.filter((c) => c.powerClassification.tier === "minor"),
  };

  // Sort by power score within each tier
  Object.values(grouped).forEach((group) => {
    group.sort((a, b) => b.powerClassification.score - a.powerClassification.score);
  });

  return grouped;
}
