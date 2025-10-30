/**
 * Cultural Impact Calculator
 *
 * Calculates how cultural exchanges affect diplomatic relationships using the Markov engine.
 * Integrates cultural exchange outcomes with relationship state transitions and diplomatic bonuses.
 *
 * Features:
 * - Calculate relationship state changes from cultural exchanges
 * - Determine diplomatic bonuses based on exchange success
 * - Track cultural exchange patterns and their long-term effects
 * - Integration with Markov diplomacy engine for state transitions
 * - Integration with DiplomaticChoiceTracker for player reputation and patterns
 */

import {
  MarkovDiplomacyEngine,
  type RelationshipState,
  type TransitionContext
} from './diplomatic-markov-engine';
import type { CulturalScenarioType } from './cultural-scenario-generator';
import { DiplomaticChoiceTracker, type DiplomaticChoice, type CumulativeEffects } from './diplomatic-choice-tracker';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CulturalExchangeData {
  id: string;
  type: string; // festival, exhibition, education, etc.
  scenarioType?: CulturalScenarioType;
  hostCountryId: string;
  participantCountryIds: string[];
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  culturalImpact: number; // 0-100
  diplomaticValue: number; // 0-100
  participants: number;
  startDate: Date;
  endDate: Date;
}

export interface CulturalExchangeOutcome {
  exchangeId: string;
  responseChoice: string;
  culturalImpactChange: number; // -100 to +100
  diplomaticChange: number; // -100 to +100
  economicCost: number;
  participantSatisfaction: number; // 0-100
  publicPerception: number; // 0-100
}

export interface RelationshipImpactResult {
  currentState: RelationshipState;
  newState: RelationshipState;
  stateChanged: boolean;
  transitionProbability: number;
  relationshipStrengthDelta: number; // -100 to +100
  culturalBonusDelta: number; // Change in cultural bonuses
  diplomaticBonusDelta: number; // Change in diplomatic bonuses
  longTermEffects: {
    culturalTiesStrength: number; // 0-100
    softPowerGain: number; // 0-100
    peopleTopeopleBonds: number; // 0-100
  };
  reasoning: string[];
}

export interface CulturalExchangeHistory {
  totalExchanges: number;
  successfulExchanges: number;
  failedExchanges: number;
  averageCulturalImpact: number;
  averageDiplomaticValue: number;
  exchangeTypeDistribution: Record<string, number>;
  scenarioOutcomes: Record<string, { successes: number; failures: number }>;
}

// ============================================================================
// CULTURAL IMPACT CALCULATOR CLASS
// ============================================================================

export class CulturalImpactCalculator {
  /**
   * Calculate the impact of a cultural exchange on diplomatic relationship
   */
  static calculateRelationshipImpact(
    exchange: CulturalExchangeData,
    outcome: CulturalExchangeOutcome,
    currentRelationship: {
      state: RelationshipState;
      strength: number; // 0-100
      tradeVolume: number;
      existingCulturalTies: number; // 0-100
    },
    history: CulturalExchangeHistory
  ): RelationshipImpactResult {
    const reasoning: string[] = [];

    // Base cultural impact from exchange
    const baseCulturalImpact = exchange.culturalImpact;
    const baseDiplomaticValue = exchange.diplomaticValue;

    // Outcome modifiers
    const outcomeMultiplier = this.calculateOutcomeMultiplier(outcome, reasoning);
    const historyBonus = this.calculateHistoryBonus(history, reasoning);
    const synergylier = this.calculateSynergyMultiplier(
      exchange.type,
      currentRelationship.existingCulturalTies,
      reasoning
    );

    // Calculate total impact
    const totalCulturalImpact = Math.min(100,
      baseCulturalImpact * outcomeMultiplier * synergylier + historyBonus
    );
    const totalDiplomaticValue = Math.min(100,
      baseDiplomaticValue * outcomeMultiplier * historyBonus / 100
    );

    // Calculate relationship strength delta
    const relationshipStrengthDelta = this.calculateStrengthDelta(
      totalCulturalImpact,
      totalDiplomaticValue,
      outcome.publicPerception,
      reasoning
    );

    // Build transition context for Markov engine
    const transitionContext: TransitionContext = {
      recentActions: [{
        id: `cultural_exchange_${Date.now()}`,
        countryId: exchange.hostCountryId,
        type: 'cultural_exchange',
        targetCountry: exchange.participantCountryIds[0] || '',
        targetCountryId: exchange.participantCountryIds[0] || '',
        details: { culturalImpact: outcome.culturalImpactChange },
        timestamp: new Date().toISOString(),
        ixTimeTimestamp: Date.now(),
      }],
      actionHistory: {
        cooperativeActions: 50,
        aggressiveActions: 0,
        consistencyScore: 50
      },
      economic: {
        tradeVolume: currentRelationship.tradeVolume,
        tradeGrowth: 0, // Cultural exchanges don't directly affect trade growth
        hasTradeTreaty: false,
        economicTierSimilarity: 50
      },
      cultural: {
        culturalExchangeLevel: history.totalExchanges > 10 ? 'high' : history.totalExchanges > 5 ? 'medium' : history.totalExchanges > 0 ? 'low' : 'none',
        culturalAffinityScore: currentRelationship.existingCulturalTies,
        sharedLanguage: false,
        historicalTies: history.totalExchanges > 0
      },
      geographic: {
        adjacency: false,
        sameRegion: false,
        sameContinent: false,
        distance: 50
      },
      alliances: {
        mutualAllies: 0,
        mutualRivals: 0,
        inCompetingBlocs: false,
        thirdPartyMediation: false
      }
    };

    // Determine potential state transitions
    const potentialNewStates = this.determineNewState(
      currentRelationship.state,
      relationshipStrengthDelta,
      totalCulturalImpact,
      reasoning
    );

    let newState = currentRelationship.state;
    let maxProbability = 0;

    // Calculate transition probabilities for potential states
    for (const candidateState of potentialNewStates) {
      const probability = MarkovDiplomacyEngine.calculateTransitionProbabilities(
        currentRelationship.state,
        candidateState,
        transitionContext
      );

      if (probability > maxProbability) {
        maxProbability = probability;
        newState = candidateState;
      }
    }

    // Calculate bonus deltas
    const culturalBonusDelta = this.calculateCulturalBonusDelta(
      totalCulturalImpact,
      outcome.participantSatisfaction
    );
    const diplomaticBonusDelta = this.calculateDiplomaticBonusDelta(
      totalDiplomaticValue,
      outcome.publicPerception
    );

    // Calculate long-term effects
    const longTermEffects = this.calculateLongTermEffects(
      exchange,
      outcome,
      history,
      totalCulturalImpact
    );

    return {
      currentState: currentRelationship.state,
      newState,
      stateChanged: newState !== currentRelationship.state,
      transitionProbability: maxProbability,
      relationshipStrengthDelta,
      culturalBonusDelta,
      diplomaticBonusDelta,
      longTermEffects,
      reasoning
    };
  }

  /**
   * Calculate outcome multiplier based on exchange outcome quality
   */
  private static calculateOutcomeMultiplier(
    outcome: CulturalExchangeOutcome,
    reasoning: string[]
  ): number {
    let multiplier = 1.0;

    // Participant satisfaction impact
    if (outcome.participantSatisfaction > 80) {
      multiplier *= 1.3;
      reasoning.push('Exceptional participant satisfaction (+30%)');
    } else if (outcome.participantSatisfaction > 60) {
      multiplier *= 1.1;
      reasoning.push('Good participant satisfaction (+10%)');
    } else if (outcome.participantSatisfaction < 40) {
      multiplier *= 0.7;
      reasoning.push('Poor participant satisfaction (-30%)');
    }

    // Public perception impact
    if (outcome.publicPerception > 80) {
      multiplier *= 1.25;
      reasoning.push('Excellent public perception (+25%)');
    } else if (outcome.publicPerception < 40) {
      multiplier *= 0.75;
      reasoning.push('Negative public perception (-25%)');
    }

    // Cultural impact change
    if (outcome.culturalImpactChange > 50) {
      multiplier *= 1.2;
      reasoning.push('Major positive cultural impact (+20%)');
    } else if (outcome.culturalImpactChange < -30) {
      multiplier *= 0.6;
      reasoning.push('Significant negative cultural impact (-40%)');
    }

    return multiplier;
  }

  /**
   * Calculate bonus from exchange history (repeated successful exchanges compound)
   */
  private static calculateHistoryBonus(
    history: CulturalExchangeHistory,
    reasoning: string[]
  ): number {
    if (history.totalExchanges === 0) return 0;

    const successRate = history.successfulExchanges / history.totalExchanges;
    const volumeBonus = Math.min(15, history.totalExchanges * 0.5);
    const qualityBonus = successRate > 0.7 ? 10 : 0;

    const totalBonus = volumeBonus + qualityBonus;

    if (totalBonus > 15) {
      reasoning.push(`Strong exchange history (+${Math.floor(totalBonus)} points)`);
    } else if (totalBonus > 5) {
      reasoning.push(`Positive exchange track record (+${Math.floor(totalBonus)} points)`);
    }

    return totalBonus;
  }

  /**
   * Calculate synergy multiplier (related exchanges amplify each other)
   */
  private static calculateSynergyMultiplier(
    exchangeType: string,
    existingCulturalTies: number,
    reasoning: string[]
  ): number {
    let multiplier = 1.0;

    // Strong existing ties amplify new exchanges
    if (existingCulturalTies > 70) {
      multiplier *= 1.25;
      reasoning.push('Strong existing cultural ties amplify impact (+25%)');
    } else if (existingCulturalTies > 40) {
      multiplier *= 1.1;
      reasoning.push('Moderate cultural ties provide synergy (+10%)');
    }

    // Certain exchange types have inherent multipliers
    const typeMultipliers: Record<string, number> = {
      'education': 1.2, // Long-term people-to-people impact
      'festival': 1.15, // High public visibility
      'diplomacy': 1.25, // Direct diplomatic engagement
      'exhibition': 1.1, // Cultural showcase
      'arts': 1.1, // Creative collaboration
      'technology': 1.15, // Innovation partnership
      'cuisine': 1.05, // Accessible cultural exchange
      'sports': 1.1 // Popular engagement
    };

    if (typeMultipliers[exchangeType]) {
      multiplier *= typeMultipliers[exchangeType]!;
      reasoning.push(`${exchangeType.charAt(0).toUpperCase() + exchangeType.slice(1)} exchange type bonus (+${Math.round((typeMultipliers[exchangeType]! - 1) * 100)}%)`);
    }

    return multiplier;
  }

  /**
   * Calculate relationship strength delta
   */
  private static calculateStrengthDelta(
    culturalImpact: number,
    diplomaticValue: number,
    publicPerception: number,
    reasoning: string[]
  ): number {
    // Base delta from cultural and diplomatic value
    const baseDelta = (culturalImpact * 0.4 + diplomaticValue * 0.6) / 5;

    // Public perception modifier
    const perceptionModifier = (publicPerception - 50) / 10;

    const totalDelta = Math.max(-20, Math.min(20, baseDelta + perceptionModifier));

    if (totalDelta > 10) {
      reasoning.push(`Significant relationship strength gain (+${Math.floor(totalDelta)} points)`);
    } else if (totalDelta > 5) {
      reasoning.push(`Moderate relationship improvement (+${Math.floor(totalDelta)} points)`);
    } else if (totalDelta < -5) {
      reasoning.push(`Relationship strain (${Math.floor(totalDelta)} points)`);
    }

    return totalDelta;
  }

  /**
   * Determine potential new relationship states based on impact
   */
  private static determineNewState(
    currentState: RelationshipState,
    strengthDelta: number,
    culturalImpact: number,
    reasoning: string[]
  ): RelationshipState[] {
    const stateOrder: RelationshipState[] = ['hostile', 'tense', 'neutral', 'friendly', 'allied'];
    const currentIndex = stateOrder.indexOf(currentState);
    const potentialStates: RelationshipState[] = [currentState];

    // Very positive outcome - potential for state improvement
    if (strengthDelta > 12 && culturalImpact > 70) {
      if (currentIndex < stateOrder.length - 1) {
        potentialStates.push(stateOrder[currentIndex + 1]!);
        reasoning.push('Exceptional cultural exchange enables relationship advancement');
      }
    }
    // Positive outcome - slight chance of improvement
    else if (strengthDelta > 8 && culturalImpact > 55) {
      if (currentIndex < stateOrder.length - 1) {
        potentialStates.push(stateOrder[currentIndex + 1]!);
        reasoning.push('Strong cultural ties may advance relationship');
      }
    }
    // Negative outcome - risk of deterioration
    else if (strengthDelta < -8 && culturalImpact < 30) {
      if (currentIndex > 0) {
        potentialStates.push(stateOrder[currentIndex - 1]!);
        reasoning.push('Failed cultural exchange risks relationship damage');
      }
    }

    return potentialStates;
  }

  /**
   * Calculate cultural bonus delta
   */
  private static calculateCulturalBonusDelta(
    culturalImpact: number,
    participantSatisfaction: number
  ): number {
    return Math.floor((culturalImpact / 10) * (participantSatisfaction / 100));
  }

  /**
   * Calculate diplomatic bonus delta
   */
  private static calculateDiplomaticBonusDelta(
    diplomaticValue: number,
    publicPerception: number
  ): number {
    return Math.floor((diplomaticValue / 10) * (publicPerception / 100));
  }

  /**
   * Calculate long-term effects of cultural exchange
   */
  private static calculateLongTermEffects(
    exchange: CulturalExchangeData,
    outcome: CulturalExchangeOutcome,
    history: CulturalExchangeHistory,
    culturalImpact: number
  ): RelationshipImpactResult['longTermEffects'] {
    // Cultural ties strength builds over time
    const baseStrength = culturalImpact / 2;
    const historyMultiplier = 1 + (history.successfulExchanges * 0.05);
    const culturalTiesStrength = Math.min(100, baseStrength * historyMultiplier);

    // Soft power gain depends on public perception and participant count
    const participantFactor = Math.min(1.5, exchange.participants / 100);
    const perceptionFactor = outcome.publicPerception / 100;
    const softPowerGain = Math.min(100, culturalImpact * participantFactor * perceptionFactor);

    // People-to-people bonds strongest for education/exchange types
    const bondMultipliers: Record<string, number> = {
      'education': 1.4,
      'festival': 1.2,
      'arts': 1.15,
      'sports': 1.2,
      'cuisine': 1.1,
      'exhibition': 1.05,
      'technology': 1.1,
      'diplomacy': 1.0
    };

    const bondMultiplier = bondMultipliers[exchange.type] || 1.0;
    const peopleTopeopleBonds = Math.min(100,
      (culturalImpact * 0.6 + outcome.participantSatisfaction * 0.4) * bondMultiplier
    );

    return {
      culturalTiesStrength,
      softPowerGain,
      peopleTopeopleBonds
    };
  }

  /**
   * Calculate scenario-specific impact adjustments
   */
  static calculateScenarioImpact(
    scenarioType: CulturalScenarioType,
    responseChoice: string,
    relationshipStrength: number
  ): {
    culturalImpactModifier: number;
    diplomaticImpactModifier: number;
    riskFactor: number;
  } {
    // Different scenarios have different risk/reward profiles
    const scenarioProfiles: Record<CulturalScenarioType, {
      baseRisk: number;
      culturalWeight: number;
      diplomaticWeight: number;
    }> = {
      'festival_collaboration': { baseRisk: 0.3, culturalWeight: 1.2, diplomaticWeight: 0.9 },
      'artifact_repatriation': { baseRisk: 0.7, culturalWeight: 1.5, diplomaticWeight: 1.4 },
      'cultural_appropriation': { baseRisk: 0.6, culturalWeight: 1.3, diplomaticWeight: 1.1 },
      'exhibition_censorship': { baseRisk: 0.55, culturalWeight: 1.1, diplomaticWeight: 1.2 },
      'student_visa_crisis': { baseRisk: 0.5, culturalWeight: 1.0, diplomaticWeight: 1.3 },
      'heritage_restoration': { baseRisk: 0.35, culturalWeight: 1.4, diplomaticWeight: 1.1 },
      'language_preservation': { baseRisk: 0.25, culturalWeight: 1.3, diplomaticWeight: 0.8 },
      'knowledge_sharing': { baseRisk: 0.4, culturalWeight: 1.2, diplomaticWeight: 1.0 },
      'festival_security': { baseRisk: 0.65, culturalWeight: 0.8, diplomaticWeight: 1.2 },
      'artistic_freedom': { baseRisk: 0.75, culturalWeight: 1.1, diplomaticWeight: 1.3 }
    };

    const profile = scenarioProfiles[scenarioType] || {
      baseRisk: 0.5,
      culturalWeight: 1.0,
      diplomaticWeight: 1.0
    };

    // Response choice affects risk
    const responseRiskModifiers: Record<string, number> = {
      // Cooperative/diplomatic responses
      'mediation': 0.7,
      'negotiate': 0.8,
      'compromise': 0.75,
      'collaborative_redesign': 0.7,
      'cooperative': 0.75,
      'full_repatriation': 0.6,
      'joint_custody': 0.7,

      // Assertive responses
      'assert_dominance': 1.3,
      'stand_firm': 1.4,
      'counter_tariffs': 1.5,
      'assertive': 1.2,
      'demand_withdrawal': 1.3,

      // Cautious responses
      'postpone': 0.9,
      'conditional_return': 1.0,
      'cautious': 0.85,
      'maintain_status': 1.2,

      // Neutral/default
      'pilot_program': 0.9,
      'educational_campaign': 0.8,
      'limited_involvement': 0.85
    };

    const responseModifier = responseRiskModifiers[responseChoice] || 1.0;
    const finalRiskFactor = profile.baseRisk * responseModifier;

    // Relationship strength affects outcome reliability
    const strengthFactor = 0.5 + (relationshipStrength / 100) * 0.5;

    return {
      culturalImpactModifier: profile.culturalWeight * strengthFactor,
      diplomaticImpactModifier: profile.diplomaticWeight * strengthFactor,
      riskFactor: finalRiskFactor
    };
  }

  /**
   * Predict exchange success probability based on context
   * Now integrates player's cultural diplomacy patterns from DiplomaticChoiceTracker
   */
  static predictSuccessProbability(
    exchange: CulturalExchangeData,
    relationshipStrength: number,
    history: CulturalExchangeHistory,
    resourceCommitment: number, // 0-100
    playerChoiceHistory?: DiplomaticChoice[] // Optional: player's diplomatic history
  ): {
    successProbability: number;
    confidenceLevel: 'low' | 'medium' | 'high';
    keyFactors: string[];
  } {
    const factors: string[] = [];
    let baseProbability = 0.5; // 50% baseline

    // Apply player reputation and patterns if available
    if (playerChoiceHistory && playerChoiceHistory.length > 0) {
      const cumulativeEffects = DiplomaticChoiceTracker.getCumulativeEffects(
        exchange.hostCountryId,
        playerChoiceHistory
      );

      // 'culturallyActive' pattern increases success probability
      if (cumulativeEffects.historicalPatterns.culturallyActive) {
        baseProbability += 0.15;
        factors.push('Culturally active reputation (+15%)');
      }

      // High cooperativeness improves outcomes
      if (cumulativeEffects.cooperativeness > 70) {
        baseProbability += 0.10;
        factors.push('High cooperativeness score (+10%)');
      }

      // High trust level reduces risk
      if (cumulativeEffects.trustLevel > 70) {
        baseProbability += 0.10;
        factors.push('Strong trust level (+10%)');
      }

      // Exchange success rate from player's history
      if (cumulativeEffects.exchangeSuccessRate > 70) {
        baseProbability += 0.12;
        factors.push(`Proven exchange track record: ${Math.round(cumulativeEffects.exchangeSuccessRate)}% (+12%)`);
      } else if (cumulativeEffects.exchangeSuccessRate < 40) {
        baseProbability -= 0.10;
        factors.push(`Troubled exchange history: ${Math.round(cumulativeEffects.exchangeSuccessRate)}% (-10%)`);
      }

      // Cultural diplomacy score bonus
      if (cumulativeEffects.culturalDiplomacyScore > 75) {
        baseProbability += 0.08;
        factors.push('Exceptional cultural diplomacy skill (+8%)');
      }
    }

    // Relationship strength impact
    if (relationshipStrength > 70) {
      baseProbability += 0.25;
      factors.push('Strong bilateral relationship (+25%)');
    } else if (relationshipStrength > 50) {
      baseProbability += 0.15;
      factors.push('Solid relationship (+15%)');
    } else if (relationshipStrength < 30) {
      baseProbability -= 0.15;
      factors.push('Weak relationship (-15%)');
    }

    // Historical track record
    if (history.totalExchanges > 0) {
      const successRate = history.successfulExchanges / history.totalExchanges;
      const historyImpact = (successRate - 0.5) * 0.2;
      baseProbability += historyImpact;

      if (historyImpact > 0.1) {
        factors.push(`Proven track record (+${Math.round(historyImpact * 100)}%)`);
      } else if (historyImpact < -0.1) {
        factors.push(`Troubled history (${Math.round(historyImpact * 100)}%)`);
      }
    }

    // Resource commitment impact
    if (resourceCommitment > 80) {
      baseProbability += 0.15;
      factors.push('Exceptional resource commitment (+15%)');
    } else if (resourceCommitment > 60) {
      baseProbability += 0.08;
      factors.push('Strong resource support (+8%)');
    } else if (resourceCommitment < 40) {
      baseProbability -= 0.10;
      factors.push('Insufficient resources (-10%)');
    }

    // Exchange complexity impact
    const complexityFactors = {
      'diplomacy': -0.05,
      'exhibition': -0.02,
      'technology': -0.08,
      'education': 0.05,
      'festival': 0.03,
      'cuisine': 0.08,
      'arts': 0.0,
      'sports': 0.05
    };

    const complexityImpact = complexityFactors[exchange.type as keyof typeof complexityFactors] || 0;
    if (Math.abs(complexityImpact) > 0.03) {
      baseProbability += complexityImpact;
      factors.push(`Exchange type complexity (${complexityImpact > 0 ? '+' : ''}${Math.round(complexityImpact * 100)}%)`);
    }

    const finalProbability = Math.max(0.1, Math.min(0.95, baseProbability));

    // Determine confidence level based on data quality
    let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
    if (history.totalExchanges >= 5 && resourceCommitment > 60) {
      confidenceLevel = 'high';
    } else if (history.totalExchanges < 2 || resourceCommitment < 40) {
      confidenceLevel = 'low';
    }

    return {
      successProbability: finalProbability,
      confidenceLevel,
      keyFactors: factors
    };
  }
}
