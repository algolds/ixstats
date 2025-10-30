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

import type { DiplomaticChoice } from "./diplomatic-choice-tracker";

// ==================== RELATIONSHIP STATES ====================

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

/**
 * Reverse mapping for state lookup
 */
const RANK_TO_STATE: Record<number, RelationshipState> = {
  0: "hostile",
  1: "tense",
  2: "neutral",
  3: "friendly",
  4: "allied",
};

// ==================== CONTEXT FACTORS ====================

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

/**
 * Predicted relationship state with confidence metrics
 */
export interface RelationshipPrediction {
  currentState: RelationshipState;
  predictedState: RelationshipState;
  probability: number; // 0-1 (probability of this prediction)
  confidence: number; // 0-100 (confidence in prediction accuracy)
  timeHorizon: number; // Months into future
  alternativePaths: Array<{
    state: RelationshipState;
    probability: number;
    triggeringEvents: string[];
  }>;
  keyDrivers: string[]; // What's driving this prediction
  warnings: string[]; // Risk factors
}

/**
 * State transition event for diplomatic system
 */
export interface StateTransitionEvent {
  id: string;
  fromState: RelationshipState;
  toState: RelationshipState;
  country1: string;
  country2: string;
  probability: number;
  triggers: string[];
  timestamp: string;
  ixTimeTimestamp: number;
  effects: {
    economicImpact: number; // -100 to +100
    securityImpact: number; // -100 to +100
    culturalImpact: number; // -100 to +100
    reputationImpact: number; // -100 to +100
  };
  description: string;
}

// ==================== MARKOV DIPLOMACY ENGINE ====================

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

  /**
   * Predict relationship evolution over time horizon
   *
   * @param countryId Source country
   * @param targetCountryId Target country
   * @param currentState Current relationship state
   * @param context Context factors
   * @param timeHorizon Months into future to predict
   * @returns Relationship prediction with confidence interval
   */
  static predictRelationshipEvolution(
    countryId: string,
    targetCountryId: string,
    currentState: RelationshipState,
    context: TransitionContext,
    timeHorizon: number = 6
  ): RelationshipPrediction {
    // Calculate transition probabilities for all possible next states
    const transitionProbabilities: Array<{
      state: RelationshipState;
      probability: number;
    }> = [];

    let totalProbability = 0;
    for (const targetState of Object.keys(STATE_RANK) as RelationshipState[]) {
      const probability = this.calculateTransitionProbabilities(currentState, targetState, context);
      transitionProbabilities.push({ state: targetState, probability });
      totalProbability += probability;
    }

    // Normalize probabilities to sum to 1.0
    transitionProbabilities.forEach((tp) => {
      tp.probability = tp.probability / totalProbability;
    });

    // Find most likely state (highest probability)
    const mostLikely = transitionProbabilities.reduce((max, current) =>
      current.probability > max.probability ? current : max
    );

    // Calculate confidence based on:
    // 1. Historical data quality (more data = higher confidence)
    // 2. Prediction certainty (higher probability = higher confidence)
    // 3. Policy consistency (more consistent = more predictable = higher confidence)
    const dataQuality = Math.min(100, context.recentActions.length * 5); // Max at 20 actions
    const predictionCertainty = mostLikely.probability * 100;
    const policyConsistency = context.actionHistory.consistencyScore;

    const confidence = dataQuality * 0.3 + predictionCertainty * 0.5 + policyConsistency * 0.2;

    // Identify key drivers (top factors influencing prediction)
    const keyDrivers = this.identifyKeyDrivers(currentState, mostLikely.state, context);

    // Identify warnings (risk factors)
    const warnings = this.identifyWarnings(currentState, mostLikely.state, context);

    // Generate alternative paths (next 3 most likely outcomes)
    const alternativePaths = transitionProbabilities
      .filter((tp) => tp.state !== mostLikely.state)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3)
      .map((tp) => ({
        state: tp.state,
        probability: tp.probability,
        triggeringEvents: this.generateTriggeringEvents(currentState, tp.state, context),
      }));

    return {
      currentState,
      predictedState: mostLikely.state,
      probability: mostLikely.probability,
      confidence: Math.round(confidence),
      timeHorizon,
      alternativePaths,
      keyDrivers,
      warnings,
    };
  }

  /**
   * Get confidence interval for a prediction
   * Returns lower and upper bounds for confidence
   *
   * @param prediction Relationship prediction
   * @returns Confidence interval (0-100 range)
   */
  static getConfidenceInterval(prediction: RelationshipPrediction): {
    lower: number;
    upper: number;
    range: number;
  } {
    // Confidence interval width inversely proportional to confidence level
    // High confidence = narrow interval, low confidence = wide interval
    const intervalWidth = (100 - prediction.confidence) / 2;

    const lower = Math.max(0, prediction.confidence - intervalWidth);
    const upper = Math.min(100, prediction.confidence + intervalWidth);

    return {
      lower: Math.round(lower),
      upper: Math.round(upper),
      range: Math.round(upper - lower),
    };
  }

  /**
   * Generate state transition event
   * Creates diplomatic event when relationship state changes
   *
   * @param transition Transition details
   * @returns State transition event object
   */
  static generateStateTransitionEvent(transition: {
    fromState: RelationshipState;
    toState: RelationshipState;
    country1: string;
    country2: string;
    context: TransitionContext;
  }): StateTransitionEvent {
    const { fromState, toState, country1, country2, context } = transition;

    // Calculate transition probability for validation
    const probability = this.calculateTransitionProbabilities(fromState, toState, context);

    // Identify triggers (events that caused this transition)
    const triggers = this.generateTriggeringEvents(fromState, toState, context);

    // Calculate effects of transition
    const effects = this.calculateTransitionEffects(fromState, toState, context);

    // Generate human-readable description
    const description = this.generateTransitionDescription(fromState, toState, country1, country2);

    return {
      id: `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromState,
      toState,
      country1,
      country2,
      probability,
      triggers,
      timestamp: new Date().toISOString(),
      ixTimeTimestamp: Date.now(), // Would be replaced with actual IxTime
      effects,
      description,
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

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

  /**
   * Identify key drivers of predicted transition
   */
  private static identifyKeyDrivers(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): string[] {
    const drivers: string[] = [];
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];

    // Analyze each factor's contribution
    if (context.actionHistory.cooperativeActions > 60 && stateChange > 0) {
      drivers.push("Strong pattern of cooperative diplomatic actions");
    }
    if (context.actionHistory.aggressiveActions > 60 && stateChange < 0) {
      drivers.push("Increasing aggressive diplomatic posture");
    }
    if (context.economic.tradeVolume > 5000000) {
      drivers.push(
        "Significant economic interdependence ($" +
          (context.economic.tradeVolume / 1000000).toFixed(1) +
          "M trade)"
      );
    }
    if (context.economic.hasTradeTreaty) {
      drivers.push("Active trade treaty framework");
    }
    if (context.cultural.culturalExchangeLevel === "high") {
      drivers.push("High-level cultural exchange programs");
    }
    if (context.cultural.culturalAffinityScore > 70) {
      drivers.push("Strong cultural affinity and shared values");
    }
    if (context.geographic.adjacency) {
      drivers.push("Geographic adjacency and border dynamics");
    }
    if (context.alliances.mutualAllies > 2) {
      drivers.push(`${context.alliances.mutualAllies} shared allies supporting cooperation`);
    }
    if (context.alliances.inCompetingBlocs) {
      drivers.push("Competition within opposing alliance structures");
    }

    return drivers.slice(0, 5); // Top 5 drivers
  }

  /**
   * Identify warnings and risk factors
   */
  private static identifyWarnings(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): string[] {
    const warnings: string[] = [];
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];

    if (context.actionHistory.consistencyScore < 40) {
      warnings.push("Low policy consistency increases unpredictability");
    }
    if (context.economic.tradeGrowth < -10) {
      warnings.push("Declining trade volume may strain relations");
    }
    if (context.alliances.mutualRivals > context.alliances.mutualAllies) {
      warnings.push("More shared rivals than allies creates instability");
    }
    if (context.alliances.inCompetingBlocs && stateChange > 0) {
      warnings.push("Competing bloc membership may limit cooperation potential");
    }
    if (stateChange > 2) {
      warnings.push("Large state jump requires sustained effort and may face resistance");
    }
    if (fromState === "allied" && stateChange < 0) {
      warnings.push("Alliance degradation could trigger regional instability");
    }
    if (
      context.actionHistory.aggressiveActions > 40 &&
      context.actionHistory.cooperativeActions > 40
    ) {
      warnings.push("Mixed signals may confuse diplomatic partners");
    }

    return warnings.slice(0, 4); // Top 4 warnings
  }

  /**
   * Generate events that could trigger this transition
   */
  private static generateTriggeringEvents(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): string[] {
    const events: string[] = [];
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];

    if (stateChange > 0) {
      // Positive transitions
      if (stateChange >= 2) {
        events.push("Major diplomatic breakthrough");
        events.push("Resolution of long-standing dispute");
      }
      events.push("Signing of comprehensive cooperation treaty");
      events.push("High-level state visit");
      events.push("Joint economic initiative launch");
      if (context.cultural.culturalExchangeLevel !== "high") {
        events.push("Expanded cultural exchange program");
      }
    } else if (stateChange < 0) {
      // Negative transitions
      if (stateChange <= -2) {
        events.push("Major diplomatic crisis");
        events.push("Breach of treaty obligations");
      }
      events.push("Border incident or territorial dispute");
      events.push("Trade dispute escalation");
      events.push("Diplomatic expulsion or recall");
      events.push("Sanctions or economic restrictions");
    } else {
      // Maintaining state
      events.push("Continued engagement at current level");
      events.push("Routine diplomatic exchanges");
      events.push("Maintenance of existing agreements");
    }

    return events.slice(0, 4);
  }

  /**
   * Calculate effects of state transition
   */
  private static calculateTransitionEffects(
    fromState: RelationshipState,
    toState: RelationshipState,
    context: TransitionContext
  ): StateTransitionEvent["effects"] {
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];
    const magnitude = Math.abs(stateChange);

    // Base effects scale with magnitude of change
    const baseImpact = magnitude * 15;

    // Economic impact correlates with trade volume
    const tradeMultiplier = Math.min(2, context.economic.tradeVolume / 5000000);
    const economicImpact = baseImpact * tradeMultiplier * (stateChange > 0 ? 1 : -1);

    // Security impact higher for hostile/allied states
    const securitySensitive =
      fromState === "hostile" ||
      fromState === "allied" ||
      toState === "hostile" ||
      toState === "allied";
    const securityImpact = baseImpact * (securitySensitive ? 1.5 : 1) * (stateChange > 0 ? 1 : -1);

    // Cultural impact correlates with cultural programs
    const culturalMultiplier = { none: 0.5, low: 0.8, medium: 1.2, high: 1.5 }[
      context.cultural.culturalExchangeLevel
    ];
    const culturalImpact = baseImpact * culturalMultiplier * (stateChange > 0 ? 1 : -1);

    // Reputation impact based on consistency
    const consistencyMultiplier = context.actionHistory.consistencyScore / 50;
    const reputationImpact = baseImpact * consistencyMultiplier * (stateChange > 0 ? 1 : -1);

    return {
      economicImpact: Math.round(Math.max(-100, Math.min(100, economicImpact))),
      securityImpact: Math.round(Math.max(-100, Math.min(100, securityImpact))),
      culturalImpact: Math.round(Math.max(-100, Math.min(100, culturalImpact))),
      reputationImpact: Math.round(Math.max(-100, Math.min(100, reputationImpact))),
    };
  }

  /**
   * Generate human-readable transition description
   */
  private static generateTransitionDescription(
    fromState: RelationshipState,
    toState: RelationshipState,
    country1: string,
    country2: string
  ): string {
    const stateChange = STATE_RANK[toState] - STATE_RANK[fromState];

    if (stateChange > 0) {
      const improvements: Record<string, Record<string, string>> = {
        hostile: {
          tense: `Relations between ${country1} and ${country2} show signs of thawing from hostile to tense`,
          neutral: `Dramatic improvement: ${country1} and ${country2} move from hostility to neutral ground`,
        },
        tense: {
          neutral: `${country1} and ${country2} ease tensions, establishing neutral relations`,
          friendly: `Significant diplomatic progress: ${country1} and ${country2} forge friendly ties`,
        },
        neutral: {
          friendly: `${country1} and ${country2} strengthen cooperation, becoming friendly nations`,
          allied: `Extraordinary development: ${country1} and ${country2} leap to formal alliance`,
        },
        friendly: {
          allied: `${country1} and ${country2} formalize relationship with strategic alliance`,
        },
      };
      return (
        improvements[fromState]?.[toState] ||
        `Relations between ${country1} and ${country2} improve from ${fromState} to ${toState}`
      );
    } else if (stateChange < 0) {
      const deteriorations: Record<string, Record<string, string>> = {
        allied: {
          friendly: `Alliance between ${country1} and ${country2} downgrades to friendly relations`,
          neutral: `Serious breach: ${country1} and ${country2} alliance falls to neutral status`,
        },
        friendly: {
          neutral: `${country1} and ${country2} relations cool from friendly to neutral`,
          tense: `Relations between ${country1} and ${country2} deteriorate to tension`,
        },
        neutral: {
          tense: `${country1} and ${country2} slide into tense relations`,
          hostile: `Critical breakdown: ${country1} and ${country2} become hostile`,
        },
        tense: {
          hostile: `Tensions between ${country1} and ${country2} escalate to hostility`,
        },
      };
      return (
        deteriorations[fromState]?.[toState] ||
        `Relations between ${country1} and ${country2} deteriorate from ${fromState} to ${toState}`
      );
    } else {
      return `${country1} and ${country2} maintain ${fromState} relations`;
    }
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Create default transition context for testing or initial states
 */
export function createDefaultContext(): TransitionContext {
  return {
    recentActions: [],
    actionHistory: {
      cooperativeActions: 50,
      aggressiveActions: 50,
      consistencyScore: 50,
    },
    economic: {
      tradeVolume: 1000000,
      tradeGrowth: 3,
      hasTradeTreaty: false,
      economicTierSimilarity: 50,
    },
    cultural: {
      culturalExchangeLevel: "low",
      culturalAffinityScore: 50,
      sharedLanguage: false,
      historicalTies: false,
    },
    geographic: {
      adjacency: false,
      sameRegion: false,
      sameContinent: false,
      distance: 50,
    },
    alliances: {
      mutualAllies: 0,
      mutualRivals: 0,
      inCompetingBlocs: false,
      thirdPartyMediation: false,
    },
  };
}

/**
 * Map database relationship string to RelationshipState
 */
export function mapToRelationshipState(dbRelationship: string): RelationshipState {
  const mapping: Record<string, RelationshipState> = {
    hostile: "hostile",
    tension: "tense",
    strained: "tense",
    cool: "tense",
    neutral: "neutral",
    cooperative: "neutral",
    friendly: "friendly",
    alliance: "allied",
  };

  return mapping[dbRelationship.toLowerCase()] || "neutral";
}

/**
 * Get all possible relationship states
 */
export function getAllRelationshipStates(): RelationshipState[] {
  return ["hostile", "tense", "neutral", "friendly", "allied"];
}

/**
 * Calculate state distance (how many steps apart two states are)
 */
export function getStateDistance(state1: RelationshipState, state2: RelationshipState): number {
  return Math.abs(STATE_RANK[state1] - STATE_RANK[state2]);
}
