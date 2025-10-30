/**
 * NPC Country Personality and Behavior System
 *
 * Comprehensive system that creates distinct personalities for NPC countries based on observable
 * database data and drives their diplomatic behavior, event responses, and relationship evolution.
 *
 * Design Philosophy:
 * - Personalities emerge from observable actions and relationships (data-driven)
 * - Traits calculated from database metrics (embassies, relationships, trade, cultural exchanges)
 * - Behavior prediction based on personality archetypes and current context
 * - Personality drift over time based on experiences and player interactions
 * - Integration with Markov engine and Response AI for consistent world behavior
 *
 * Key Features:
 * - 8 core personality traits (0-100 scale)
 * - 6 distinct personality archetypes
 * - Behavioral response prediction system
 * - Event modifier calculation
 * - Personality drift algorithm (max ±2 points per IxTime year)
 * - Decision-making for player proposals
 */

import type { DiplomaticChoice, CumulativeEffects } from "./diplomatic-choice-tracker";
import type {
  RelationshipState as MarkovRelationshipState,
  TransitionContext,
} from "./diplomatic-markov-engine";

// ==================== PERSONALITY TRAITS ====================

/**
 * 8 core personality traits that define NPC country behavior
 * All traits are measured on a 0-100 scale
 */
export interface PersonalityTraits {
  /**
   * ASSERTIVENESS (0-100)
   * Willingness to take strong diplomatic stances and push for national interests
   * - High: Confrontational, demands concessions, issues ultimatums
   * - Low: Accommodating, prefers compromise, avoids confrontation
   * - Calculated from: Hostile relationships, low-strength relationships, conflict history
   */
  assertiveness: number;

  /**
   * COOPERATIVENESS (0-100)
   * Preference for multilateral solutions and working with partners
   * - High: Seeks alliances, proposes joint initiatives, values consensus
   * - Low: Unilateral action, go-it-alone approach, skeptical of partnerships
   * - Calculated from: Alliance count, friendly relationships, treaty participation
   */
  cooperativeness: number;

  /**
   * ECONOMIC FOCUS (0-100)
   * Prioritization of trade and economic concerns over other policy areas
   * - High: Trade deals prioritized, economic leverage used, merchant diplomacy
   * - Low: Economics subordinate to security/ideology, willing to sacrifice trade
   * - Calculated from: Trade volume, trade treaties, economic embassy specializations
   */
  economicFocus: number;

  /**
   * CULTURAL OPENNESS (0-100)
   * Receptiveness to cultural exchanges and soft power initiatives
   * - High: Embraces exchanges, promotes culture, values people-to-people ties
   * - Low: Protective of culture, limited exchanges, nationalist tendencies
   * - Calculated from: Cultural exchange participation, cultural embassies, exchange levels
   */
  culturalOpenness: number;

  /**
   * RISK TOLERANCE (0-100)
   * Willingness to engage in risky or unconventional diplomatic moves
   * - High: Bold initiatives, gambling on outcomes, crisis escalation willing
   * - Low: Cautious, incremental, status quo preservation
   * - Calculated from: Hostile relationships, deteriorating relations, policy volatility
   */
  riskTolerance: number;

  /**
   * IDEOLOGICAL RIGIDITY (0-100)
   * Adherence to principles vs pragmatic flexibility
   * - High: Principled stances, ideological consistency, hard to compromise
   * - Low: Pragmatic, flexible, willing to shift positions for gains
   * - Calculated from: Policy consistency, relationship volatility, alliance stability
   */
  ideologicalRigidity: number;

  /**
   * MILITARISM (0-100)
   * Preference for security and defense policies over other approaches
   * - High: Security-focused, defense alliances prioritized, threat perception high
   * - Low: Diplomacy-first, minimal defense posture, cooperative security
   * - Calculated from: Security embassies, defense treaties, tense/hostile relationships
   */
  militarism: number;

  /**
   * ISOLATIONISM (0-100)
   * Tendency to avoid foreign entanglements and maintain independence
   * - High: Few relationships, minimal embassies, non-alignment preference
   * - Low: Engaged globally, extensive networks, alliance-seeking
   * - Calculated from: Relationship count, embassy count, alliance participation
   */
  isolationism: number;
}

/**
 * Personality archetype defining overall strategic approach
 * Each archetype has characteristic trait ranges
 */
export type PersonalityArchetype =
  | "aggressive_expansionist"
  | "peaceful_merchant"
  | "cautious_isolationist"
  | "cultural_diplomat"
  | "pragmatic_realist"
  | "ideological_hardliner";

/**
 * Complete personality profile for an NPC country
 */
export interface NPCPersonality {
  countryId: string;
  countryName: string;
  archetype: PersonalityArchetype;
  traits: PersonalityTraits;
  confidence: number; // 0-100 - Confidence in personality assessment
  dataQuality: number; // 0-100 - Quality of underlying data
  lastCalculated: string; // ISO timestamp
  calculationBasis: {
    relationshipCount: number;
    embassyCount: number;
    treatyCount: number;
    historicalActionCount: number;
  };
}

/**
 * Personality drift tracking for gradual evolution
 * Max ±2 points per IxTime year across all traits
 */
export interface PersonalityDrift {
  countryId: string;
  ixTimeYear: number;
  traitChanges: Partial<PersonalityTraits>;
  triggeringEvents: string[];
  netChange: number; // Total absolute change across all traits
  timestamp: string;
}

// ==================== OBSERVABLE DATA TYPES ====================

/**
 * Observable data from database for personality calculation
 */
export interface ObservableData {
  // Relationship metrics
  relationships: {
    total: number;
    hostile: number;
    tense: number;
    neutral: number;
    friendly: number;
    allied: number;
    averageStrength: number;
    deterioratingCount: number; // Relationships with declining strength
  };

  // Embassy metrics
  embassies: {
    total: number;
    securitySpecialized: number;
    economicSpecialized: number;
    culturalSpecialized: number;
    averageLevel: number;
    averageInfluence: number;
  };

  // Economic metrics
  economic: {
    totalTradeVolume: number;
    highValuePartners: number; // Partners with >$500k trade
    tradeTreatyCount: number;
    tradeGrowthTrend: number; // Positive/negative/stable
  };

  // Cultural metrics
  cultural: {
    highExchangeCount: number; // Relationships with "High" cultural exchange
    mediumExchangeCount: number;
    culturalTreatyCount: number;
    totalExchangePrograms: number;
  };

  // Historical behavior
  historical: {
    totalActions: number;
    cooperativeActions: number;
    aggressiveActions: number;
    consistencyScore: number; // 0-100
    policyVolatility: number; // 0-100
  };

  // Treaty participation
  treaties: {
    total: number;
    defensive: number;
    trade: number;
    cultural: number;
    multilateral: number;
  };
}

// ==================== BEHAVIORAL RESPONSE TYPES ====================

/**
 * Scenario types for behavioral prediction
 */
export type DiplomaticScenario =
  | "alliance_proposal"
  | "trade_dispute"
  | "cultural_exchange_offer"
  | "sanction_threat"
  | "crisis_mediation"
  | "treaty_proposal"
  | "embassy_establishment"
  | "border_tension"
  | "economic_cooperation"
  | "security_pact";

/**
 * Predicted response to diplomatic scenario
 */
export interface BehavioralResponse {
  scenario: DiplomaticScenario;
  predictedAction: "accept" | "reject" | "negotiate" | "escalate" | "defer";
  confidence: number; // 0-100
  reasoning: string[];
  alternativeActions: Array<{
    action: BehavioralResponse["predictedAction"];
    probability: number;
    conditions: string[];
  }>;
  expectedDemands?: string[]; // What NPC might demand in negotiation
  redLines?: string[]; // Non-negotiable conditions
  timeframe?: "immediate" | "short_term" | "long_term";
  riskAssessment?: string[];
  opportunitySignals?: string[];
}

/**
 * Relationship preference direction
 */
export interface RelationshipPreference {
  targetCountryId: string;
  desiredState: MarkovRelationshipState;
  currentState: MarkovRelationshipState;
  urgency: number; // 0-100 - How important this change is
  reasoning: string[];
  strategicValue: number; // 0-100 - Strategic importance of relationship
  willingnessToConcede: number; // 0-100 - Flexibility in negotiations
}

/**
 * Event generation modifier based on personality
 */
export interface EventModifier {
  eventType: string;
  probabilityMultiplier: number; // 0-2 (0=never, 1=baseline, 2=twice as likely)
  severityAdjustment: number; // -2 to +2 (adjust event severity)
  urgencyAdjustment: number; // -20 to +20 (adjust urgency score)
  reasoning: string;
}

// ==================== NPC PERSONALITY SYSTEM ====================

export class NPCPersonalitySystem {
  /**
   * Calculate personality from observable database data
   * Uses sophisticated weighted formulas to derive traits from metrics
   */
  static calculatePersonality(
    countryId: string,
    countryName: string,
    observableData: ObservableData
  ): NPCPersonality {
    const traits = this.calculateTraits(observableData);
    const archetype = this.determineArchetype(traits);
    const { confidence, dataQuality } = this.assessDataQuality(observableData);

    return {
      countryId,
      countryName,
      archetype,
      traits,
      confidence,
      dataQuality,
      lastCalculated: new Date().toISOString(),
      calculationBasis: {
        relationshipCount: observableData.relationships.total,
        embassyCount: observableData.embassies.total,
        treatyCount: observableData.treaties.total,
        historicalActionCount: observableData.historical.totalActions,
      },
    };
  }

  /**
   * Calculate all 8 personality traits from observable data
   */
  private static calculateTraits(data: ObservableData): PersonalityTraits {
    // ASSERTIVENESS: Hostile relationships + weak relationships + aggressive actions
    const assertiveness = Math.min(
      100,
      data.relationships.hostile * 25 + // Hostile relationships strongly indicate assertiveness
        data.relationships.tense * 12 + // Tense relationships moderately indicate
        data.relationships.deterioratingCount * 8 + // Deteriorating relations show pushback
        (data.historical.aggressiveActions / Math.max(1, data.historical.totalActions)) * 30 + // % of aggressive actions
        25 // Base assertiveness
    );

    // COOPERATIVENESS: Alliances + friendly relations + treaties + cooperative actions
    const cooperativeness = Math.min(
      100,
      data.relationships.allied * 18 + // Each alliance shows high cooperation
        data.relationships.friendly * 10 + // Friendly relations indicate cooperation
        data.treaties.multilateral * 8 + // Multilateral treaties show cooperation preference
        (data.historical.cooperativeActions / Math.max(1, data.historical.totalActions)) * 35 + // % cooperative actions
        data.relationships.averageStrength / 2 // Strong relationships = cooperation
    );

    // ECONOMIC FOCUS: Trade volume + trade treaties + economic embassies
    const economicFocus = Math.min(
      100,
      data.economic.highValuePartners * 12 + // Each major trade partner
        data.economic.tradeTreatyCount * 15 + // Trade treaties prioritized
        data.embassies.economicSpecialized * 10 + // Economic embassy specializations
        (data.economic.tradeGrowthTrend > 0 ? 20 : 0) + // Growing trade focus
        (data.economic.totalTradeVolume > 10000000
          ? 25
          : data.economic.totalTradeVolume > 5000000
            ? 15
            : 5) // Absolute trade volume
    );

    // CULTURAL OPENNESS: Cultural exchanges + cultural embassies + cultural treaties
    const culturalOpenness = Math.min(
      100,
      data.cultural.highExchangeCount * 20 + // High-level exchanges
        data.cultural.mediumExchangeCount * 10 + // Medium-level exchanges
        data.embassies.culturalSpecialized * 15 + // Cultural embassy focus
        data.cultural.culturalTreatyCount * 12 + // Cultural treaties
        30 // Base openness
    );

    // RISK TOLERANCE: Hostile relations + deteriorating relations + policy volatility
    const riskTolerance = Math.min(
      100,
      data.relationships.hostile * 20 + // Hostility = risk-taking
        data.relationships.deterioratingCount * 12 + // Letting relations deteriorate = risk
        data.historical.policyVolatility / 2 + // Policy changes = risk tolerance
        (data.relationships.averageStrength < 50 ? 20 : 0) + // Weak relations = risk
        40 // Base risk tolerance
    );

    // IDEOLOGICAL RIGIDITY: Policy consistency - policy volatility
    const ideologicalRigidity = Math.min(
      100,
      data.historical.consistencyScore * 0.7 + // High consistency = rigid
        (100 - data.historical.policyVolatility) * 0.3 + // Low volatility = rigid
        (data.relationships.deterioratingCount > 3 ? 15 : 0) // Willing to lose relations = principled
    );

    // MILITARISM: Security embassies + defensive treaties + tense/hostile relations
    const militarism = Math.min(
      100,
      data.embassies.securitySpecialized * 20 + // Security embassy focus
        data.treaties.defensive * 18 + // Defense pacts
        data.relationships.hostile * 15 + // Hostile relations
        data.relationships.tense * 8 + // Tense relations
        20 // Base militarism
    );

    // ISOLATIONISM: Inverse of engagement (few relationships, embassies, treaties)
    const engagementScore =
      Math.min(100, data.relationships.total * 8) +
      Math.min(100, data.embassies.total * 10) +
      Math.min(100, data.treaties.total * 12);

    const isolationism = Math.max(
      0,
      100 -
        engagementScore / 3 + // Inverse of engagement
        (data.relationships.total < 3 ? 30 : 0) + // Very few relationships
        (data.embassies.total < 2 ? 25 : 0) // Very few embassies
    );

    return {
      assertiveness: Math.round(assertiveness),
      cooperativeness: Math.round(cooperativeness),
      economicFocus: Math.round(economicFocus),
      culturalOpenness: Math.round(culturalOpenness),
      riskTolerance: Math.round(riskTolerance),
      ideologicalRigidity: Math.round(ideologicalRigidity),
      militarism: Math.round(militarism),
      isolationism: Math.round(isolationism),
    };
  }

  /**
   * Determine personality archetype from trait profile
   * Each archetype has characteristic trait ranges
   */
  private static determineArchetype(traits: PersonalityTraits): PersonalityArchetype {
    // AGGRESSIVE EXPANSIONIST: High assertiveness, high militarism, low cooperativeness
    if (
      traits.assertiveness >= 70 &&
      traits.militarism >= 60 &&
      traits.cooperativeness <= 40 &&
      traits.riskTolerance >= 65
    ) {
      return "aggressive_expansionist";
    }

    // PEACEFUL MERCHANT: High economic focus, high cooperativeness, low militarism
    if (
      traits.economicFocus >= 70 &&
      traits.cooperativeness >= 60 &&
      traits.militarism <= 40 &&
      traits.isolationism <= 40
    ) {
      return "peaceful_merchant";
    }

    // CAUTIOUS ISOLATIONIST: High isolationism, low risk tolerance, moderate cooperativeness
    if (
      traits.isolationism >= 65 &&
      traits.riskTolerance <= 40 &&
      traits.cooperativeness >= 40 &&
      traits.cooperativeness <= 70
    ) {
      return "cautious_isolationist";
    }

    // CULTURAL DIPLOMAT: High cultural openness, high cooperativeness, low militarism
    if (
      traits.culturalOpenness >= 70 &&
      traits.cooperativeness >= 70 &&
      traits.militarism <= 45 &&
      traits.assertiveness <= 60
    ) {
      return "cultural_diplomat";
    }

    // IDEOLOGICAL HARDLINER: High rigidity, moderate assertiveness, low cooperativeness
    if (
      traits.ideologicalRigidity >= 70 &&
      traits.assertiveness >= 50 &&
      traits.cooperativeness <= 45 &&
      traits.riskTolerance >= 50
    ) {
      return "ideological_hardliner";
    }

    // PRAGMATIC REALIST: Balanced traits, no extremes, high adaptability (low rigidity)
    // Default archetype for balanced personalities
    return "pragmatic_realist";
  }

  /**
   * Assess data quality and confidence in personality assessment
   */
  private static assessDataQuality(data: ObservableData): {
    confidence: number;
    dataQuality: number;
  } {
    // Data quality factors
    const relationshipQuality = Math.min(100, data.relationships.total * 15); // Max at ~7 relationships
    const embassyQuality = Math.min(100, data.embassies.total * 20); // Max at 5 embassies
    const historyQuality = Math.min(100, data.historical.totalActions * 5); // Max at 20 actions
    const treatyQuality = Math.min(100, data.treaties.total * 25); // Max at 4 treaties

    const dataQuality = Math.round(
      relationshipQuality * 0.35 + // Relationships most important
        embassyQuality * 0.25 + // Embassies important
        historyQuality * 0.25 + // Historical actions important
        treatyQuality * 0.15 // Treaties moderately important
    );

    // Confidence based on data quality and consistency
    const consistency = data.historical.consistencyScore || 50;
    const confidence = Math.round(dataQuality * 0.7 + consistency * 0.3);

    return { confidence, dataQuality };
  }

  // ==================== BEHAVIORAL PREDICTION ====================

  /**
   * Predict how NPC will respond to a diplomatic scenario
   * Uses personality traits to determine likely action
   */
  static predictResponse(
    personality: NPCPersonality,
    scenario: DiplomaticScenario,
    context: {
      currentRelationship: MarkovRelationshipState;
      relationshipStrength: number;
      playerReputation: CumulativeEffects;
      recentPlayerActions: DiplomaticChoice[];
    }
  ): BehavioralResponse {
    const { traits, archetype } = personality;

    // Scenario-specific prediction logic
    switch (scenario) {
      case "alliance_proposal":
        return this.predictAllianceResponse(traits, archetype, context);

      case "trade_dispute":
        return this.predictTradeDisputeResponse(traits, archetype, context);

      case "cultural_exchange_offer":
        return this.predictCulturalExchangeResponse(traits, archetype, context);

      case "sanction_threat":
        return this.predictSanctionResponse(traits, archetype, context);

      case "crisis_mediation":
        return this.predictMediationResponse(traits, archetype, context);

      case "treaty_proposal":
        return this.predictTreatyResponse(traits, archetype, context);

      case "embassy_establishment":
        return this.predictEmbassyResponse(traits, archetype, context);

      case "security_pact":
        return this.predictSecurityPactResponse(traits, archetype, context);

      default:
        return this.predictGenericResponse(traits, archetype, context);
    }
  }

  /**
   * Predict alliance proposal response
   */
  private static predictAllianceResponse(
    traits: PersonalityTraits,
    archetype: PersonalityArchetype,
    context: any
  ): BehavioralResponse {
    // High cooperativeness and low isolationism favor acceptance
    const acceptScore =
      traits.cooperativeness * 0.4 +
      (100 - traits.isolationism) * 0.3 +
      context.relationshipStrength * 0.2 +
      (context.currentRelationship === "friendly" ? 20 : 0);

    // High assertiveness and ideological rigidity favor negotiation
    const negotiateScore =
      traits.assertiveness * 0.3 +
      traits.ideologicalRigidity * 0.25 +
      traits.cooperativeness * 0.2 +
      (context.currentRelationship === "neutral" ? 15 : 0);

    // High isolationism and low cooperativeness favor rejection
    const rejectScore =
      traits.isolationism * 0.5 +
      (100 - traits.cooperativeness) * 0.3 +
      (context.relationshipStrength < 40 ? 30 : 0);

    const maxScore = Math.max(acceptScore, negotiateScore, rejectScore);
    let predictedAction: BehavioralResponse["predictedAction"] = "negotiate";
    const reasoning: string[] = [];

    if (maxScore === acceptScore && acceptScore > 55) {
      predictedAction = "accept";
      reasoning.push(`High cooperativeness (${traits.cooperativeness}) favors alliance`);
      reasoning.push(`Low isolationism (${traits.isolationism}) supports engagement`);
      if (context.relationshipStrength > 60) {
        reasoning.push(`Strong existing relationship (${context.relationshipStrength}%)`);
      }
    } else if (maxScore === rejectScore && rejectScore > 60) {
      predictedAction = "reject";
      reasoning.push(`High isolationism (${traits.isolationism}) resists alliances`);
      reasoning.push(`Low cooperativeness (${traits.cooperativeness}) prefers independence`);
    } else {
      predictedAction = "negotiate";
      reasoning.push(`Assertiveness (${traits.assertiveness}) drives negotiation demands`);
      reasoning.push(
        `Ideological rigidity (${traits.ideologicalRigidity}) requires specific terms`
      );
    }

    // Archetype-specific adjustments
    if (archetype === "aggressive_expansionist" && context.relationshipStrength > 50) {
      predictedAction = "accept";
      reasoning.push("Expansionist archetype seeks strategic alliances");
    } else if (archetype === "cautious_isolationist") {
      predictedAction = rejectScore > 45 ? "reject" : "defer";
      reasoning.push("Isolationist archetype avoids commitments");
    }

    return {
      scenario: "alliance_proposal",
      predictedAction,
      confidence: Math.min(95, maxScore),
      reasoning,
      alternativeActions: [
        {
          action: "negotiate",
          probability: negotiateScore / 100,
          conditions: ["Player shows flexibility", "Alliance terms can be limited"],
        },
        {
          action: predictedAction === "accept" ? "defer" : "accept",
          probability: (predictedAction === "accept" ? rejectScore : acceptScore) / 100,
          conditions: ["Geopolitical situation changes", "Relationship strength shifts"],
        },
      ],
      expectedDemands:
        predictedAction === "negotiate"
          ? [
              "Limited defense obligations",
              "Economic cooperation clause",
              "Exit mechanism after 2 IxTime years",
            ]
          : undefined,
      redLines:
        predictedAction !== "reject"
          ? ["No offensive military commitments", "Sovereignty preservation"]
          : undefined,
    };
  }

  /**
   * Predict trade dispute response
   */
  private static predictTradeDisputeResponse(
    traits: PersonalityTraits,
    archetype: PersonalityArchetype,
    context: any
  ): BehavioralResponse {
    // Economic focus drives willingness to negotiate
    const negotiateScore =
      traits.economicFocus * 0.5 +
      traits.cooperativeness * 0.3 +
      (100 - traits.assertiveness) * 0.2;

    // Assertiveness + low economic focus drives escalation
    const escalateScore =
      traits.assertiveness * 0.4 +
      (100 - traits.economicFocus) * 0.3 +
      traits.riskTolerance * 0.2 +
      (context.playerReputation.aggressiveness > 60 ? 20 : 0);

    const maxScore = Math.max(negotiateScore, escalateScore);
    const predictedAction: BehavioralResponse["predictedAction"] =
      maxScore === negotiateScore ? "negotiate" : "escalate";

    const reasoning: string[] = [];
    if (predictedAction === "negotiate") {
      reasoning.push(
        `High economic focus (${traits.economicFocus}) prioritizes trade preservation`
      );
      reasoning.push(`Cooperativeness (${traits.cooperativeness}) supports negotiation`);
    } else {
      reasoning.push(`High assertiveness (${traits.assertiveness}) drives firm response`);
      reasoning.push(`Low economic focus (${traits.economicFocus}) permits trade sacrifice`);
    }

    // Archetype adjustments
    if (archetype === "peaceful_merchant") {
      return {
        scenario: "trade_dispute",
        predictedAction: "negotiate",
        confidence: 85,
        reasoning: [...reasoning, "Merchant archetype prioritizes economic relations"],
        alternativeActions: [
          {
            action: "accept",
            probability: 0.3,
            conditions: ["Concessions are minor", "Long-term trade benefits preserved"],
          },
        ],
        expectedDemands: [
          "Mutual tariff reductions",
          "Phased implementation timeline",
          "Dispute resolution mechanism",
        ],
      };
    }

    return {
      scenario: "trade_dispute",
      predictedAction,
      confidence: Math.min(90, maxScore),
      reasoning,
      alternativeActions: [
        {
          action: predictedAction === "negotiate" ? "escalate" : "negotiate",
          probability: (predictedAction === "negotiate" ? escalateScore : negotiateScore) / 100,
          conditions: ["Player response changes", "Economic situation worsens"],
        },
      ],
    };
  }

  /**
   * Predict cultural exchange response
   */
  private static predictCulturalExchangeResponse(
    traits: PersonalityTraits,
    archetype: PersonalityArchetype,
    context: any
  ): BehavioralResponse {
    const acceptScore =
      traits.culturalOpenness * 0.6 +
      traits.cooperativeness * 0.25 +
      context.relationshipStrength * 0.15;

    const predictedAction: BehavioralResponse["predictedAction"] =
      acceptScore > 55 ? "accept" : acceptScore > 35 ? "negotiate" : "defer";

    return {
      scenario: "cultural_exchange_offer",
      predictedAction,
      confidence: Math.min(85, acceptScore),
      reasoning: [
        `Cultural openness (${traits.culturalOpenness}) ${acceptScore > 55 ? "welcomes" : "limits"} exchanges`,
        `Cooperativeness (${traits.cooperativeness}) supports ${predictedAction === "accept" ? "full" : "limited"} program`,
      ],
      alternativeActions: [],
    };
  }

  /**
   * Predict sanction threat response
   */
  private static predictSanctionResponse(
    traits: PersonalityTraits,
    archetype: PersonalityArchetype,
    context: any
  ): BehavioralResponse {
    const escalateScore =
      traits.assertiveness * 0.4 +
      traits.ideologicalRigidity * 0.3 +
      traits.riskTolerance * 0.2 +
      (100 - traits.economicFocus) * 0.1;

    const negotiateScore =
      traits.cooperativeness * 0.35 +
      traits.economicFocus * 0.35 +
      (100 - traits.assertiveness) * 0.2 +
      (context.relationshipStrength > 40 ? 15 : 0);

    const predictedAction: BehavioralResponse["predictedAction"] =
      escalateScore > negotiateScore && escalateScore > 60 ? "escalate" : "negotiate";

    return {
      scenario: "sanction_threat",
      predictedAction,
      confidence: Math.max(escalateScore, negotiateScore),
      reasoning: [
        predictedAction === "escalate"
          ? `High assertiveness (${traits.assertiveness}) refuses intimidation`
          : `Economic focus (${traits.economicFocus}) prioritizes damage avoidance`,
        predictedAction === "escalate"
          ? `Ideological rigidity (${traits.ideologicalRigidity}) resists pressure`
          : `Cooperativeness (${traits.cooperativeness}) seeks de-escalation`,
      ],
      alternativeActions: [],
      redLines:
        predictedAction === "escalate"
          ? ["No concessions under threat", "Sovereignty non-negotiable"]
          : undefined,
    };
  }

  /**
   * Predict mediation response
   */
  private static predictMediationResponse(
    traits: PersonalityTraits,
    archetype: PersonalityArchetype,
    context: any
  ): BehavioralResponse {
    const acceptScore =
      traits.cooperativeness * 0.5 +
      (100 - traits.isolationism) * 0.3 +
      context.playerReputation.trustLevel * 0.2;

    const predictedAction: BehavioralResponse["predictedAction"] =
      acceptScore > 60 ? "accept" : acceptScore > 40 ? "negotiate" : "reject";

    return {
      scenario: "crisis_mediation",
      predictedAction,
      confidence: Math.min(80, acceptScore),
      reasoning: [
        `Cooperativeness (${traits.cooperativeness}) ${acceptScore > 60 ? "embraces" : "questions"} mediation role`,
        `Player trust level (${context.playerReputation.trustLevel}) ${acceptScore > 60 ? "enables" : "limits"} acceptance`,
      ],
      alternativeActions: [],
    };
  }

  /**
   * Predict treaty proposal response
   */
  private static predictTreatyResponse(
    traits: PersonalityTraits,
    archetype: PersonalityArchetype,
    context: any
  ): BehavioralResponse {
    const negotiateScore =
      traits.cooperativeness * 0.4 +
      (100 - traits.isolationism) * 0.3 +
      context.relationshipStrength * 0.2 +
      (100 - traits.ideologicalRigidity) * 0.1;

    return {
      scenario: "treaty_proposal",
      predictedAction: "negotiate",
      confidence: Math.min(85, negotiateScore),
      reasoning: [
        "Treaties require negotiation regardless of personality",
        `Cooperativeness (${traits.cooperativeness}) determines flexibility level`,
      ],
      alternativeActions: [],
    };
  }

  /**
   * Predict embassy establishment response
   */
  private static predictEmbassyResponse(
    traits: PersonalityTraits,
    archetype: PersonalityArchetype,
    context: any
  ): BehavioralResponse {
    const acceptScore =
      (100 - traits.isolationism) * 0.5 +
      traits.cooperativeness * 0.3 +
      context.relationshipStrength * 0.2;

    const predictedAction: BehavioralResponse["predictedAction"] =
      acceptScore > 50 ? "accept" : acceptScore > 30 ? "negotiate" : "defer";

    return {
      scenario: "embassy_establishment",
      predictedAction,
      confidence: Math.min(80, acceptScore),
      reasoning: [
        `Isolationism (${traits.isolationism}) ${acceptScore > 50 ? "permits" : "resists"} embassy`,
        `Relationship strength (${context.relationshipStrength}%) ${acceptScore > 50 ? "supports" : "limits"} approval`,
      ],
      alternativeActions: [],
    };
  }

  /**
   * Predict security pact response
   */
  private static predictSecurityPactResponse(
    traits: PersonalityTraits,
    archetype: PersonalityArchetype,
    context: any
  ): BehavioralResponse {
    const acceptScore =
      traits.militarism * 0.4 +
      traits.cooperativeness * 0.3 +
      context.relationshipStrength * 0.2 +
      (context.currentRelationship === "allied" ? 20 : 0);

    const predictedAction: BehavioralResponse["predictedAction"] =
      acceptScore > 60 ? "accept" : acceptScore > 40 ? "negotiate" : "reject";

    return {
      scenario: "security_pact",
      predictedAction,
      confidence: Math.min(85, acceptScore),
      reasoning: [
        `Militarism (${traits.militarism}) ${acceptScore > 60 ? "prioritizes" : "deemphasizes"} security cooperation`,
        `Existing relationship (${context.currentRelationship}) ${acceptScore > 60 ? "enables" : "limits"} pact`,
      ],
      alternativeActions: [],
    };
  }

  /**
   * Generic response prediction fallback
   */
  private static predictGenericResponse(
    traits: PersonalityTraits,
    archetype: PersonalityArchetype,
    context: any
  ): BehavioralResponse {
    const cooperationScore = (traits.cooperativeness + context.relationshipStrength) / 2;

    return {
      scenario: "treaty_proposal", // Generic scenario
      predictedAction: cooperationScore > 50 ? "negotiate" : "defer",
      confidence: 50,
      reasoning: ["Generic scenario uses cooperation baseline"],
      alternativeActions: [],
    };
  }

  // ==================== RELATIONSHIP PREFERENCES ====================

  /**
   * Determine desired relationship direction with target country
   */
  static getRelationshipPreference(
    personality: NPCPersonality,
    targetCountryId: string,
    currentState: MarkovRelationshipState,
    currentStrength: number,
    context: TransitionContext
  ): RelationshipPreference {
    const { traits } = personality;

    // Calculate strategic value based on context
    const strategicValue = this.calculateStrategicValue(traits, context);

    // Determine desired state based on personality
    let desiredState: MarkovRelationshipState = currentState;
    let urgency = 50;
    const reasoning: string[] = [];

    // High cooperativeness pushes toward friendly/allied
    if (traits.cooperativeness > 70 && currentState !== "allied" && strategicValue > 60) {
      desiredState = currentState === "friendly" ? "allied" : "friendly";
      urgency += 20;
      reasoning.push("High cooperativeness drives alliance-seeking");
    }

    // High assertiveness + low cooperativeness pushes toward tension
    if (traits.assertiveness > 70 && traits.cooperativeness < 40 && currentStrength < 50) {
      desiredState = currentState === "neutral" ? "tense" : "hostile";
      urgency += 15;
      reasoning.push("Assertive personality comfortable with tension");
    }

    // Economic focus preserves relationships with trade partners
    if (traits.economicFocus > 70 && context.economic.tradeVolume > 500000) {
      desiredState =
        currentState === "tense" || currentState === "hostile" ? "neutral" : "friendly";
      urgency += 25;
      reasoning.push("Economic focus prioritizes trade partner relations");
    }

    // Isolationism resists improvement beyond neutral
    if (traits.isolationism > 65) {
      if (currentState === "hostile" || currentState === "tense") {
        desiredState = "neutral";
      } else {
        desiredState = currentState; // Maintain current
      }
      reasoning.push("Isolationist tendency limits engagement");
    }

    // Calculate willingness to concede
    const willingnessToConcede = Math.round(
      traits.cooperativeness * 0.4 +
        (100 - traits.assertiveness) * 0.3 +
        (100 - traits.ideologicalRigidity) * 0.3
    );

    return {
      targetCountryId,
      desiredState,
      currentState,
      urgency: Math.min(100, urgency),
      reasoning,
      strategicValue,
      willingnessToConcede,
    };
  }

  /**
   * Calculate strategic value of relationship based on context
   */
  private static calculateStrategicValue(
    traits: PersonalityTraits,
    context: TransitionContext
  ): number {
    let value = 40; // Base value

    // Economic value
    if (context.economic.tradeVolume > 1000000) value += 20;
    if (context.economic.hasTradeTreaty) value += 15;

    // Security value
    if (context.alliances.mutualAllies > 2) value += 15;
    if (context.geographic.adjacency) value += 10;

    // Cultural value
    if (context.cultural.culturalExchangeLevel === "high") value += 10;

    // Personality modifiers
    if (traits.economicFocus > 70) value += (context.economic.tradeVolume / 1000000) * 2;
    if (traits.militarism > 70 && context.alliances.mutualAllies > 0) value += 10;
    if (traits.cooperativeness > 70) value += 10;

    return Math.min(100, Math.round(value));
  }

  // ==================== EVENT MODIFIERS ====================

  /**
   * Calculate how personality affects event generation probability
   */
  static calculateEventModifier(personality: NPCPersonality, eventType: string): EventModifier {
    const { traits, archetype } = personality;
    let multiplier = 1.0;
    let severityAdjustment = 0;
    let urgencyAdjustment = 0;
    let reasoning = "";

    switch (eventType) {
      case "trade_dispute":
        if (traits.economicFocus > 70) {
          multiplier = 1.5;
          urgencyAdjustment = 10;
          reasoning = "High economic focus increases trade dispute likelihood";
        } else if (traits.economicFocus < 30) {
          multiplier = 0.5;
          reasoning = "Low economic focus reduces trade dispute priority";
        }
        break;

      case "alliance_offer":
        if (traits.cooperativeness > 75 && traits.isolationism < 40) {
          multiplier = 1.8;
          urgencyAdjustment = 15;
          reasoning = "High cooperativeness + low isolationism drives alliance offers";
        } else if (traits.isolationism > 70) {
          multiplier = 0.2;
          reasoning = "Isolationism prevents alliance proposals";
        }
        break;

      case "cultural_exchange_offer":
        if (traits.culturalOpenness > 70) {
          multiplier = 1.6;
          reasoning = "High cultural openness promotes exchange initiatives";
        } else if (traits.culturalOpenness < 35) {
          multiplier = 0.4;
          reasoning = "Low cultural openness limits exchange interest";
        }
        break;

      case "sanction_threat":
        if (traits.assertiveness > 70 && traits.riskTolerance > 65) {
          multiplier = 1.7;
          severityAdjustment = 1;
          urgencyAdjustment = 15;
          reasoning = "High assertiveness + risk tolerance escalates to sanctions";
        }
        break;

      case "crisis_mediation":
        if (traits.cooperativeness > 75 && traits.isolationism < 40) {
          multiplier = 1.4;
          reasoning = "Cooperative non-isolationist countries offer mediation";
        }
        break;

      case "security_pact":
        if (traits.militarism > 70) {
          multiplier = 1.6;
          urgencyAdjustment = 10;
          reasoning = "High militarism prioritizes security cooperation";
        }
        break;

      case "border_tension":
        if (traits.assertiveness > 70 && traits.riskTolerance > 60) {
          multiplier = 1.5;
          severityAdjustment = 1;
          reasoning = "Assertive risk-taker creates border incidents";
        }
        break;

      case "economic_cooperation":
        if (traits.economicFocus > 70 && traits.cooperativeness > 60) {
          multiplier = 1.5;
          reasoning = "Economic-focused cooperator proposes joint initiatives";
        }
        break;

      default:
        reasoning = "Baseline personality impact";
    }

    // Archetype overrides
    if (archetype === "aggressive_expansionist" && eventType === "alliance_offer") {
      multiplier = 1.9;
      reasoning = "Aggressive expansionist actively seeks strategic alliances";
    } else if (archetype === "peaceful_merchant" && eventType === "trade_dispute") {
      multiplier = 0.5;
      reasoning = "Peaceful merchant avoids trade conflicts";
    } else if (archetype === "cautious_isolationist") {
      multiplier *= 0.6; // Reduce all event generation
      reasoning = "Cautious isolationist minimizes diplomatic initiatives";
    }

    return {
      eventType,
      probabilityMultiplier: multiplier,
      severityAdjustment,
      urgencyAdjustment,
      reasoning,
    };
  }

  // ==================== PROPOSAL DECISION-MAKING ====================

  /**
   * Decide if NPC should accept player proposal
   */
  static shouldAcceptProposal(
    personality: NPCPersonality,
    proposal: {
      type: DiplomaticScenario;
      terms?: string[];
      concessions?: string[];
      benefits?: string[];
    },
    context: {
      currentRelationship: MarkovRelationshipState;
      relationshipStrength: number;
      playerReputation: CumulativeEffects;
    }
  ): {
    decision: "accept" | "reject" | "counter_offer";
    confidence: number;
    reasoning: string[];
    counterTerms?: string[];
  } {
    const response = this.predictResponse(personality, proposal.type, {
      ...context,
      recentPlayerActions: [],
    });

    // Convert response to decision
    if (response.predictedAction === "accept") {
      return {
        decision: "accept",
        confidence: response.confidence,
        reasoning: response.reasoning,
      };
    } else if (response.predictedAction === "reject") {
      return {
        decision: "reject",
        confidence: response.confidence,
        reasoning: response.reasoning,
      };
    } else {
      return {
        decision: "counter_offer",
        confidence: response.confidence,
        reasoning: response.reasoning,
        counterTerms: response.expectedDemands || [
          "Modified terms required",
          "Additional guarantees needed",
        ],
      };
    }
  }

  // ==================== PERSONALITY DRIFT ====================

  /**
   * Apply personality drift based on experiences
   * Max ±2 points per IxTime year across all traits
   */
  static applyPersonalityDrift(
    personality: NPCPersonality,
    ixTimeYear: number,
    events: {
      successfulCooperation: number; // Count of successful cooperative actions
      militaryConflicts: number; // Count of hostile interactions
      economicGrowth: boolean; // GDP growth this year
      tradeExpansion: boolean; // Significant trade growth
      allianceFormed: boolean; // New alliance this year
      relationshipDeteriorated: boolean; // Major relationship loss
    }
  ): { updatedTraits: PersonalityTraits; drift: PersonalityDrift } {
    const traitChanges: Partial<PersonalityTraits> = {};
    const triggeringEvents: string[] = [];
    let totalAbsoluteChange = 0;
    const maxTotalDrift = 2; // Maximum ±2 points total per year

    // Calculate desired changes (before applying limits)
    const desiredChanges: Partial<PersonalityTraits> = {};

    // Successful cooperation increases cooperativeness (max +1 per year)
    if (events.successfulCooperation > 0) {
      const increase = Math.min(1, events.successfulCooperation * 0.3);
      desiredChanges.cooperativeness = increase;
      if (increase > 0) triggeringEvents.push("Successful cooperative actions");
    }

    // Military conflicts increase assertiveness and militarism (max +1 each)
    if (events.militaryConflicts > 0) {
      const increase = Math.min(1, events.militaryConflicts * 0.4);
      desiredChanges.assertiveness = increase;
      desiredChanges.militarism = increase;
      if (increase > 0) triggeringEvents.push("Military conflicts and tensions");
    }

    // Economic growth increases economic focus (max +1)
    if (events.economicGrowth) {
      desiredChanges.economicFocus = 0.8;
      triggeringEvents.push("Strong economic performance");
    }

    // Trade expansion increases economic focus and reduces isolationism
    if (events.tradeExpansion) {
      desiredChanges.economicFocus = (desiredChanges.economicFocus || 0) + 0.7;
      desiredChanges.isolationism = -0.8;
      triggeringEvents.push("Trade expansion");
    }

    // Alliance formed increases cooperativeness, reduces isolationism
    if (events.allianceFormed) {
      desiredChanges.cooperativeness = (desiredChanges.cooperativeness || 0) + 0.9;
      desiredChanges.isolationism = (desiredChanges.isolationism || 0) - 1.0;
      triggeringEvents.push("New alliance formed");
    }

    // Relationship deterioration increases assertiveness, risk tolerance
    if (events.relationshipDeteriorated) {
      desiredChanges.assertiveness = (desiredChanges.assertiveness || 0) + 0.8;
      desiredChanges.riskTolerance = 0.6;
      triggeringEvents.push("Major relationship deterioration");
    }

    // Apply changes with total drift limit
    const updatedTraits = { ...personality.traits };
    const traitKeys = Object.keys(desiredChanges) as Array<keyof PersonalityTraits>;

    // Calculate total desired change
    const totalDesired = traitKeys.reduce((sum, key) => sum + Math.abs(desiredChanges[key]!), 0);

    // Scale changes if they exceed max drift
    const scaleFactor = totalDesired > maxTotalDrift ? maxTotalDrift / totalDesired : 1.0;

    for (const key of traitKeys) {
      const rawChange = desiredChanges[key]!;
      const scaledChange = rawChange * scaleFactor;
      const newValue = Math.max(0, Math.min(100, updatedTraits[key] + scaledChange));
      const actualChange = newValue - updatedTraits[key];

      if (Math.abs(actualChange) > 0.1) {
        // Only record meaningful changes
        traitChanges[key] = Math.round(actualChange * 10) / 10; // Round to 1 decimal
        updatedTraits[key] = Math.round(newValue);
        totalAbsoluteChange += Math.abs(actualChange);
      }
    }

    const drift: PersonalityDrift = {
      countryId: personality.countryId,
      ixTimeYear,
      traitChanges,
      triggeringEvents,
      netChange: Math.round(totalAbsoluteChange * 10) / 10,
      timestamp: new Date().toISOString(),
    };

    return { updatedTraits, drift };
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Create observable data from database query results
 */
export function createObservableDataFromDatabase(dbData: {
  relationships: Array<{
    relationship: string;
    strength: number;
    tradeVolume?: number;
    culturalExchange?: string;
    treaties?: string[];
  }>;
  embassies: Array<{
    level: number;
    influence: number;
    specialization?: string;
  }>;
  treaties: Array<{
    type: string;
    parties?: string;
  }>;
  historicalActions?: DiplomaticChoice[];
}): ObservableData {
  const relationships = dbData.relationships;

  // Count relationships by type
  const hostile = relationships.filter(
    (r) => r.relationship === "hostile" || r.relationship === "Hostile"
  ).length;
  const tense = relationships.filter(
    (r) => r.relationship === "tense" || r.relationship === "strained" || r.relationship === "cool"
  ).length;
  const neutral = relationships.filter(
    (r) => r.relationship === "neutral" || r.relationship === "cooperative"
  ).length;
  const friendly = relationships.filter((r) => r.relationship === "friendly").length;
  const allied = relationships.filter((r) => r.relationship === "alliance").length;

  const avgStrength =
    relationships.reduce((sum, r) => sum + r.strength, 0) / Math.max(1, relationships.length);
  const deterioratingCount = relationships.filter((r) => r.strength < 30).length;

  // Embassy metrics
  const embassies = dbData.embassies;
  const securityEmbassies = embassies.filter((e) => e.specialization === "security").length;
  const economicEmbassies = embassies.filter((e) => e.specialization === "economic").length;
  const culturalEmbassies = embassies.filter((e) => e.specialization === "cultural").length;
  const avgLevel = embassies.reduce((sum, e) => sum + e.level, 0) / Math.max(1, embassies.length);
  const avgInfluence =
    embassies.reduce((sum, e) => sum + e.influence, 0) / Math.max(1, embassies.length);

  // Economic metrics
  const totalTradeVolume = relationships.reduce((sum, r) => sum + (r.tradeVolume || 0), 0);
  const highValuePartners = relationships.filter((r) => (r.tradeVolume || 0) > 500000).length;
  const tradeTreatyCount = relationships.filter((r) =>
    r.treaties?.some((t) => t.toLowerCase().includes("trade"))
  ).length;

  // Cultural metrics
  const highExchangeCount = relationships.filter(
    (r) => r.culturalExchange === "High" || r.culturalExchange === "high"
  ).length;
  const mediumExchangeCount = relationships.filter(
    (r) => r.culturalExchange === "Medium" || r.culturalExchange === "medium"
  ).length;

  // Treaty metrics
  const treaties = dbData.treaties;
  const defensiveTreaties = treaties.filter((t) => t.type.toLowerCase().includes("defense")).length;
  const tradeTreaties = treaties.filter((t) => t.type.toLowerCase().includes("trade")).length;
  const culturalTreaties = treaties.filter((t) => t.type.toLowerCase().includes("cultural")).length;
  const multilateralTreaties = treaties.filter(
    (t) => t.parties && t.parties.split(",").length > 2
  ).length;

  // Historical actions
  const actions = dbData.historicalActions || [];
  const cooperativeActions = actions.filter((a) =>
    ["propose_alliance", "trade_agreement", "cultural_exchange"].includes(a.type)
  ).length;
  const aggressiveActions = actions.filter((a) =>
    ["sanction", "close_embassy", "cancel_treaty"].includes(a.type)
  ).length;

  return {
    relationships: {
      total: relationships.length,
      hostile,
      tense,
      neutral,
      friendly,
      allied,
      averageStrength: Math.round(avgStrength),
      deterioratingCount,
    },
    embassies: {
      total: embassies.length,
      securitySpecialized: securityEmbassies,
      economicSpecialized: economicEmbassies,
      culturalSpecialized: culturalEmbassies,
      averageLevel: Math.round(avgLevel * 10) / 10,
      averageInfluence: Math.round(avgInfluence),
    },
    economic: {
      totalTradeVolume,
      highValuePartners,
      tradeTreatyCount,
      tradeGrowthTrend: 0, // Would be calculated from historical data
    },
    cultural: {
      highExchangeCount,
      mediumExchangeCount,
      culturalTreatyCount: culturalTreaties,
      totalExchangePrograms: highExchangeCount + mediumExchangeCount,
    },
    historical: {
      totalActions: actions.length,
      cooperativeActions,
      aggressiveActions,
      consistencyScore: 50, // Would be calculated from action patterns
      policyVolatility: 50, // Would be calculated from policy changes
    },
    treaties: {
      total: treaties.length,
      defensive: defensiveTreaties,
      trade: tradeTreaties,
      cultural: culturalTreaties,
      multilateral: multilateralTreaties,
    },
  };
}

/**
 * Get archetype description for UI display
 */
export function getArchetypeDescription(archetype: PersonalityArchetype): string {
  const descriptions: Record<PersonalityArchetype, string> = {
    aggressive_expansionist:
      "Assertive power-seeker with military focus, willing to take risks and confront rivals to expand influence.",
    peaceful_merchant:
      "Trade-focused cooperator that prioritizes economic partnerships over military power and seeks mutual prosperity.",
    cautious_isolationist:
      "Risk-averse nation that maintains minimal foreign entanglements, prefers neutrality and independence.",
    cultural_diplomat:
      "Soft power advocate that builds relationships through cultural exchanges and values people-to-people ties.",
    pragmatic_realist:
      "Balanced actor that adapts to circumstances, maintains flexibility, and pursues practical advantages.",
    ideological_hardliner:
      "Principled nation that adheres to core values, difficult to compromise with, willing to sacrifice for beliefs.",
  };

  return descriptions[archetype];
}

/**
 * Get trait interpretation for UI display
 */
export function interpretTrait(traitName: keyof PersonalityTraits, value: number): string {
  if (value >= 75) return "Very High";
  if (value >= 60) return "High";
  if (value >= 40) return "Moderate";
  if (value >= 25) return "Low";
  return "Very Low";
}
