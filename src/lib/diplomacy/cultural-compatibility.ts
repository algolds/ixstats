/**
 * Cultural Compatibility Calculation System
 *
 * Calculates cultural compatibility scores between countries for the Cultural Exchange Program.
 * Scoring algorithm factors in economic tier similarity, diplomatic relationships, embassy connections,
 * geographic proximity, and previous exchange history.
 *
 * @module cultural-compatibility
 */

export interface CountryBasicInfo {
  id: string;
  name: string;
  economicTier: string;
  continent?: string;
  flagUrl?: string;
}

export interface DiplomaticRelationship {
  relationship: string; // 'Allied', 'Friendly', 'Neutral', 'Tense', 'Hostile'
  strength: number; // 0-100
}

export interface EmbassyConnection {
  id: string;
  status: string; // 'active', 'suspended', etc.
}

export interface CompatibilityResult {
  score: number; // 0-100
  level: "Excellent" | "Good" | "Fair" | "Low";
  breakdown: {
    economicTierSimilarity: number;
    diplomaticRelationship: number;
    embassyBonus: number;
    geographicProximity: number;
    exchangeHistory: number;
  };
}

export interface RecommendedPartner extends CountryBasicInfo {
  compatibilityScore: number;
  compatibilityLevel: "Excellent" | "Good" | "Fair" | "Low";
  diplomaticStatus?: string;
  hasEmbassy: boolean;
  hasExchangeHistory: boolean;
}

const ECONOMIC_TIERS: Record<string, number> = {
  Advanced: 4,
  Emerging: 3,
  Developing: 2,
  Frontier: 1,
};

/**
 * Calculate cultural compatibility score between two countries
 */
export function calculateCulturalCompatibility(
  country1: CountryBasicInfo,
  country2: CountryBasicInfo,
  diplomaticRelation?: DiplomaticRelationship,
  embassyConnection?: EmbassyConnection,
  exchangeHistory?: number
): CompatibilityResult {
  let economicTierSimilarity = 0;
  let diplomaticRelationship = 0;
  let embassyBonus = 0;
  let geographicProximity = 0;
  let exchangeHistoryScore = 0;

  // 1. Economic Tier Similarity (0-30 points)
  const tier1 = ECONOMIC_TIERS[country1.economicTier] || 2;
  const tier2 = ECONOMIC_TIERS[country2.economicTier] || 2;
  const tierDifference = Math.abs(tier1 - tier2);

  if (tierDifference === 0) {
    economicTierSimilarity = 30;
  } else if (tierDifference === 1) {
    economicTierSimilarity = 20;
  } else if (tierDifference === 2) {
    economicTierSimilarity = 10;
  } else {
    economicTierSimilarity = 5;
  }

  // 2. Diplomatic Relationship (0-40 points)
  if (diplomaticRelation) {
    const baseScore = (() => {
      const rel = diplomaticRelation.relationship.toLowerCase();
      if (rel.includes("allied") || rel.includes("ally")) return 40;
      if (rel.includes("friendly") || rel.includes("friend")) return 30;
      if (rel.includes("neutral")) return 15;
      if (rel.includes("tense") || rel.includes("strained")) return 5;
      if (rel.includes("hostile") || rel.includes("enemy")) return 0;
      return 15; // Default to neutral
    })();

    const strengthMultiplier = diplomaticRelation.strength / 100;
    diplomaticRelationship = Math.round(baseScore * strengthMultiplier);
  } else {
    diplomaticRelationship = 10;
  }

  // 3. Embassy Connection Bonus (+20 points)
  if (embassyConnection && embassyConnection.status === "active") {
    embassyBonus = 20;
  }

  // 4. Geographic Proximity (+10 points)
  if (country1.continent && country2.continent && country1.continent === country2.continent) {
    geographicProximity = 10;
  }

  // 5. Exchange History (+5 to +15 points)
  if (exchangeHistory && exchangeHistory > 0) {
    if (exchangeHistory >= 3) {
      exchangeHistoryScore = 15;
    } else if (exchangeHistory === 2) {
      exchangeHistoryScore = 10;
    } else {
      exchangeHistoryScore = 5;
    }
  }

  const score = Math.min(
    economicTierSimilarity +
      diplomaticRelationship +
      embassyBonus +
      geographicProximity +
      exchangeHistoryScore,
    100
  );

  return {
    score,
    level: getCulturalCompatibilityLevel(score),
    breakdown: {
      economicTierSimilarity,
      diplomaticRelationship,
      embassyBonus,
      geographicProximity,
      exchangeHistory: exchangeHistoryScore,
    },
  };
}

export function getCulturalCompatibilityLevel(
  score: number
): "Excellent" | "Good" | "Fair" | "Low" {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Low";
}

export function generateRecommendedPartners(
  hostCountry: CountryBasicInfo,
  allCountries: CountryBasicInfo[],
  diplomaticRelations: Map<string, DiplomaticRelationship>,
  embassies: Map<string, EmbassyConnection>,
  exchangeHistory?: Map<string, number>
): RecommendedPartner[] {
  const recommendations: RecommendedPartner[] = [];

  for (const country of allCountries) {
    if (country.id === hostCountry.id) continue;

    const relation = diplomaticRelations.get(country.id);
    const embassy = embassies.get(country.id);
    const history = exchangeHistory?.get(country.id) || 0;

    const compatibility = calculateCulturalCompatibility(
      hostCountry,
      country,
      relation,
      embassy,
      history
    );

    recommendations.push({
      ...country,
      compatibilityScore: compatibility.score,
      compatibilityLevel: compatibility.level,
      diplomaticStatus: relation?.relationship,
      hasEmbassy: !!embassy && embassy.status === "active",
      hasExchangeHistory: history > 0,
    });
  }

  return recommendations.sort((a, b) => b.compatibilityScore - a.compatibilityScore).slice(0, 5);
}
