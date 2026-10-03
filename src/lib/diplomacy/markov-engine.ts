/**
 * Diplomatic Markov Chain Engine
 *
 * Intelligent system for predicting and driving diplomatic relationship evolution
 * based on historical patterns, player actions, and world state using Markov chain mathematics.
 *
 * Design Philosophy:
 * - Relationships evolve probabilistically based on actions and context
 * - Historical patterns influence future state transitions
 * - Multiple factors combine to determine transition probabilities
 * - Confidence intervals reflect prediction reliability
 *
 * Mathematical Foundation:
 * - P(X_t+1 = s' | X_t = s) = probability of transitioning from state s to s' at time t+1
 * - Transition probabilities calculated from weighted context factors
 * - Weighted formula: action_weight * 0.4 + economic_weight * 0.25 + cultural_weight * 0.15 +
 *                     geographic_weight * 0.1 + alliance_weight * 0.1
 */

import type { DiplomaticChoice } from "./choice-tracker";

// RELATIONSHIP STATES

/**
 * Five-state Markov model for diplomatic relationships
 * States are ordered from least to most favorable
 */
export type RelationshipState = "hostile" | "tense" | "neutral" | "friendly" | "allied";

/**
 * State ranking for distance calculations
 * Lower values = worse relations, higher values = better relations
 */
const STATE_RANK: Record<RelationshipState, number> = {
  hostile: 0,
  tense: 1,
  neutral: 2,
  friendly: 3,
  allied: 4,
};
// CONTEXT FACTORS

/**
 * Context factors that influence transition probabilities
 */
export interface TransitionContext {
  // Historical player actions
  recentActions: DiplomaticChoice[];
  actionHistory: {
    cooperativeActions: number; // 0-100 scale
    aggressiveActions: number; // 0-100 scale
    consistencyScore: number; // 0-100 scale (policy predictability)
  };

  // Economic interdependence
  economic: {
    tradeVolume: number; // Annual trade in dollars
    tradeGrowth: number; // % change year-over-year
    hasTradeTreaty: boolean;
    economicTierSimilarity: number; // 0-100 scale (similar economies cooperate better)
  };

  // Cultural similarity and exchanges
  cultural: {
    culturalExchangeLevel: "none" | "low" | "medium" | "high";
    culturalAffinityScore: number; // 0-100 scale
    sharedLanguage: boolean;
    historicalTies: boolean;
  };

  // Geographic proximity
  geographic: {
    adjacency: boolean; // Share a border
    sameRegion: boolean; // Same geographic region
    sameContinent: boolean;
    distance: number; // 0-100 scale (0=adjacent, 100=opposite sides of world)
  };

  // Alliance network effects
  alliances: {
    mutualAllies: number; // Count of shared allies
    mutualRivals: number; // Count of shared rivals
    inCompetingBlocs: boolean; // In opposing alliance structures
    thirdPartyMediation: boolean; // Active mediation by mutual ally
  };
}

// MARKOV DIPLOMACY ENGINE

export class MarkovDiplomacyEngine {
  /**
   * Base transition probability matrix
   * Defines baseline probabilities for state transitions without context
   *
   * Matrix structure: transitionMatrix[fromState][toState] = baseline probability
   *
   * Key principles:
   * - Diagonal (staying in same state) has highest probability
   * - Adjacent states more likely than distant jumps
   * - Negative transitions slightly easier than positive (relationships deteriorate faster)
   * - Hostile->Allied direct jumps extremely rare (requires intermediate steps)
   */
  private static readonly BASE_TRANSITION_MATRIX: Record<
    RelationshipState,
    Record<RelationshipState, number>
  > = {
    hostile: {
      hostile: 0.7, // Strong tendency to remain hostile
      tense: 0.2, // Can improve to tense with effort
      neutral: 0.08, // Rare direct jump
      friendly: 0.02, // Nearly impossible
      allied: 0.0, // Impossible without intermediate steps
    },
    tense: {
      hostile: 0.15, // Can deteriorate
      tense: 0.6, // Stable but uncomfortable
      neutral: 0.2, // Natural improvement path
      friendly: 0.04, // Possible with strong actions
      allied: 0.01, // Extremely rare
    },
    neutral: {
      hostile: 0.05, // Unlikely deterioration
      tense: 0.15, // Moderate deterioration
      neutral: 0.5, // Default stable state
      friendly: 0.25, // Natural improvement path
      allied: 0.05, // Requires strong cooperation
    },
    friendly: {
      hostile: 0.02, // Rare major deterioration
      tense: 0.08, // Possible deterioration
      neutral: 0.15, // Can cool off
      friendly: 0.65, // Stable positive relationship
      allied: 0.1, // Natural progression
    },
    allied: {
      hostile: 0.0, // Impossible direct jump
      tense: 0.02, // Severe crisis required
      neutral: 0.05, // Major breach of trust
      friendly: 0.18, // Can downgrade
      allied: 0.75, // Most stable state
    },
  };

  /**
   * Calculate transition probabilities from one state to another
   * Adjusts base matrix using weighted context factors
   *
   * @param fromState Current relationship state
   * @param toState Target relationship state
   * @param context Context factors influencing the transition
   * @returns Probability (0-1) of this transition occurring
   */
  static calculateTransitionProbabilities(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): number {
    // Start with base probability
    const baseProbability = this.BASE_TRANSITION_MATRIX[fromState][toState];

    // Calculate weighted context factors
    const actionWeight = this.calculateActionWeight(fromState, toState, context);
    const economicWeight = this.calculateEconomicWeight(fromState, toState, context);
    const culturalWeight = this.calculateCulturalWeight(fromState, toState, context);
    const geographicWeight = this.calculateGeographicWeight(fromState, toState, context);
    const allianceWeight = this.calculateAllianceWeight(fromState, toState, context);

    // Weighted combination (total = 1.0)
    // Action weight: 0.4 (player actions most important)
    // Economic weight: 0.25 (trade and economic ties significant)
    // Cultural weight: 0.15 (cultural affinity matters)
    // Geographic weight: 0.1 (proximity influences)
    // Alliance weight: 0.1 (network effects)
    const contextualModifier =
      actionWeight * 0.4 +
      economicWeight * 0.25 +
      culturalWeight * 0.15 +
      geographicWeight * 0.1 +
      allianceWeight * 0.1;

    // Apply contextual modifier to base probability
    // Modifier ranges from -1.0 (strong negative influence) to +1.0 (strong positive influence)
    // Clamp final probability to valid range [0, 1]
    const adjustedProbability = baseProbability * (1 + contextualModifier);

    return Math.max(0, Math.min(1, adjustedProbability));
  }

  // PRIVATE HELPER METHODS

  /**
   * Calculate action weight based on recent diplomatic actions
   * Returns modifier from -1.0 to +1.0
   */
  private static calculateActionWeight(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): number {
    const { actionHistory } = context;
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];

    // Positive state change (improvement)
    if (stateChange > 0) {
      // Cooperative actions support positive transitions
      const cooperativeBonus = (actionHistory.cooperativeActions / 100) * 0.8;
      // Aggressive actions penalize positive transitions
      const aggressivePenalty = (actionHistory.aggressiveActions / 100) * 0.6;
      return cooperativeBonus - aggressivePenalty;
    }
    // Negative state change (deterioration)
    else if (stateChange < 0) {
      // Aggressive actions support negative transitions
      const aggressiveBonus = (actionHistory.aggressiveActions / 100) * 0.8;
      // Cooperative actions penalize negative transitions
      const cooperativePenalty = (actionHistory.cooperativeActions / 100) * 0.6;
      return aggressiveBonus - cooperativePenalty;
    }
    // No state change (stability)
    else {
      // Consistency supports maintaining current state
      return (actionHistory.consistencyScore / 100) * 0.5;
    }
  }

  /**
   * Calculate economic weight based on trade and economic ties
   * Returns modifier from -1.0 to +1.0
   */
  private static calculateEconomicWeight(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): number {
    const { economic } = context;
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];

    // Normalize trade volume to 0-1 scale (assuming $10M is high trade)
    const tradeIntensity = Math.min(1, economic.tradeVolume / 10000000);

    // Trade growth impact
    const growthImpact = Math.max(-0.5, Math.min(0.5, economic.tradeGrowth / 20));

    // Treaty bonus
    const treatyBonus = economic.hasTradeTreaty ? 0.3 : 0;

    // Economic tier similarity (similar economies cooperate better)
    const similarityBonus = (economic.economicTierSimilarity / 100) * 0.2;

    const totalEconomicFactor = tradeIntensity + growthImpact + treatyBonus + similarityBonus;

    // Strong economic ties support positive transitions and prevent negative ones
    if (stateChange > 0) {
      return totalEconomicFactor * 0.8;
    } else if (stateChange < 0) {
      return -totalEconomicFactor * 0.6; // Economic ties resist deterioration
    } else {
      return totalEconomicFactor * 0.4; // Support stability
    }
  }

  /**
   * Calculate cultural weight based on cultural exchanges and affinity
   * Returns modifier from -1.0 to +1.0
   */
  private static calculateCulturalWeight(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): number {
    const { cultural } = context;
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];

    // Exchange level impact
    const exchangeLevelValues = { none: 0, low: 0.2, medium: 0.5, high: 0.8 };
    const exchangeImpact = exchangeLevelValues[cultural.culturalExchangeLevel];

    // Cultural affinity normalized to 0-1
    const affinityImpact = cultural.culturalAffinityScore / 100;

    // Language and historical bonuses
    const languageBonus = cultural.sharedLanguage ? 0.2 : 0;
    const historicalBonus = cultural.historicalTies ? 0.15 : 0;

    const totalCulturalFactor = exchangeImpact + affinityImpact + languageBonus + historicalBonus;

    // Cultural ties support gradual positive development
    if (stateChange > 0) {
      return totalCulturalFactor * 0.6;
    } else if (stateChange < 0) {
      return -totalCulturalFactor * 0.5; // Cultural ties resist deterioration
    } else {
      return totalCulturalFactor * 0.3;
    }
  }

  /**
   * Calculate geographic weight based on proximity
   * Returns modifier from -1.0 to +1.0
   */
  private static calculateGeographicWeight(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): number {
    const { geographic } = context;
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];

    // Proximity scoring
    let proximityScore = 0;
    if (geographic.adjacency) proximityScore += 0.8;
    else if (geographic.sameRegion) proximityScore += 0.5;
    else if (geographic.sameContinent) proximityScore += 0.2;

    // Distance penalty (inverse relationship)
    const distancePenalty = (geographic.distance / 100) * 0.3;
    proximityScore = Math.max(0, proximityScore - distancePenalty);

    // Geographic proximity slightly favors cooperation (but also conflict)
    // Adjacent nations can be best friends or worst enemies
    if (stateChange > 0) {
      return proximityScore * 0.4; // Moderate support for positive transitions
    } else if (stateChange < 0) {
      return proximityScore * 0.3; // Can also support conflict
    } else {
      return proximityScore * 0.2;
    }
  }

  /**
   * Calculate alliance weight based on network effects
   * Returns modifier from -1.0 to +1.0
   */
  private static calculateAllianceWeight(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): number {
    const { alliances } = context;
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];

    // Mutual allies support cooperation
    const mutualAllyBonus = Math.min(0.6, alliances.mutualAllies * 0.15);

    // Mutual rivals create complex dynamics
    const mutualRivalImpact = Math.min(0.4, alliances.mutualRivals * 0.1);

    // Competing blocs create tension
    const competingBlocPenalty = alliances.inCompetingBlocs ? -0.5 : 0;

    // Third-party mediation helps
    const mediationBonus = alliances.thirdPartyMediation ? 0.3 : 0;

    if (stateChange > 0) {
      // Positive transitions supported by mutual allies and mediation
      return mutualAllyBonus + mediationBonus + mutualRivalImpact * 0.2 + competingBlocPenalty;
    } else if (stateChange < 0) {
      // Negative transitions resisted by mutual allies
      return -mutualAllyBonus + mutualRivalImpact * 0.3 - mediationBonus + competingBlocPenalty;
    } else {
      return (mutualAllyBonus + mediationBonus) * 0.3;
    }
  }
}
