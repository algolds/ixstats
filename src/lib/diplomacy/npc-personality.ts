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

import type { DiplomaticChoice, CumulativeEffects } from "./choice-tracker";
import type { RelationshipState as MarkovRelationshipState } from "./markov-engine";

// ==================== PERSONALITY TRAITS ====================

/**
 * 8 core personality traits that define NPC country behavior
 * All traits are measured on a 0-100 scale
 */
interface PersonalityTraits {
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
type PersonalityArchetype =
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
type DiplomaticScenario =
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
interface BehavioralResponse {
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
    const secureData = (observableData || {}) as ObservableData;
    const traits = this.calculateTraits(secureData);
    const archetype = this.determineArchetype(traits);
    const { confidence, dataQuality } = this.assessDataQuality(secureData);

    const relationships = secureData.relationships || { total: 0 };
    const embassies = secureData.embassies || { total: 0 };
    const treaties = secureData.treaties || { total: 0 };
    const historical = secureData.historical || { totalActions: 0 };

    return {
      countryId,
      countryName,
      archetype,
      traits,
      confidence,
      dataQuality,
      lastCalculated: new Date().toISOString(),
      calculationBasis: {
        relationshipCount: relationships.total || 0,
        embassyCount: embassies.total || 0,
        treatyCount: treaties.total || 0,
        historicalActionCount: historical.totalActions || 0,
      },
    };
  }

  /**
   * Calculate all 8 personality traits from observable data
   */
  private static calculateTraits(data: ObservableData): PersonalityTraits {
    // Fallback/resiliency guards for all nested objects to prevent TypeError: Cannot read properties of undefined
    const relationships = data.relationships || {
      hostile: 0,
      tense: 0,
      deterioratingCount: 0,
      friendly: 0,
      allied: 0,
      averageStrength: 50,
      total: 0,
    };
    const historical = data.historical || {
      aggressiveActions: 0,
      totalActions: 0,
      cooperativeActions: 0,
      policyVolatility: 0,
      consistencyScore: 50,
    };
    const economic = data.economic || {
      highValuePartners: 0,
      tradeTreatyCount: 0,
      totalTradeVolume: 0,
      tradeGrowthTrend: 0,
    };
    const embassies = data.embassies || {
      securitySpecialized: 0,
      economicSpecialized: 0,
      culturalSpecialized: 0,
      total: 0,
    };
    const cultural = data.cultural || {
      highExchangeCount: 0,
      mediumExchangeCount: 0,
      culturalTreatyCount: 0,
    };
    const treaties = data.treaties || { multilateral: 0, defensive: 0, total: 0 };

    // ASSERTIVENESS: Hostile relationships + weak relationships + aggressive actions
    const assertiveness = Math.min(
      100,
      (relationships.hostile || 0) * 25 + // Hostile relationships strongly indicate assertiveness
        (relationships.tense || 0) * 12 + // Tense relationships moderately indicate
        (relationships.deterioratingCount || 0) * 8 + // Deteriorating relations show pushback
        ((historical.aggressiveActions || 0) / Math.max(1, historical.totalActions || 0)) * 30 + // % of aggressive actions
        25 // Base assertiveness
    );

    // COOPERATIVENESS: Alliances + friendly relations + treaties + cooperative actions
    const cooperativeness = Math.min(
      100,
      (relationships.allied || 0) * 18 + // Each alliance shows high cooperation
        (relationships.friendly || 0) * 10 + // Friendly relations indicate cooperation
        (treaties.multilateral || 0) * 8 + // Multilateral treaties show cooperation preference
        ((historical.cooperativeActions || 0) / Math.max(1, historical.totalActions || 0)) * 35 + // % cooperative actions
        (relationships.averageStrength || 50) / 2 // Strong relationships = cooperation
    );

    // ECONOMIC FOCUS: Trade volume + trade treaties + economic embassies
    const economicFocus = Math.min(
      100,
      (economic.highValuePartners || 0) * 12 + // Each major trade partner
        (economic.tradeTreatyCount || 0) * 15 + // Trade treaties prioritized
        (embassies.economicSpecialized || 0) * 10 + // Economic embassy specializations
        ((economic.tradeGrowthTrend || 0) > 0 ? 20 : 0) + // Growing trade focus
        ((economic.totalTradeVolume || 0) > 10000000
          ? 25
          : (economic.totalTradeVolume || 0) > 5000000
            ? 15
            : 5) // Absolute trade volume
    );

    // CULTURAL OPENNESS: Cultural exchanges + cultural embassies + cultural treaties
    const culturalOpenness = Math.min(
      100,
      (cultural.highExchangeCount || 0) * 20 + // High-level exchanges
        (cultural.mediumExchangeCount || 0) * 10 + // Medium-level exchanges
        (embassies.culturalSpecialized || 0) * 15 + // Cultural embassy focus
        (cultural.culturalTreatyCount || 0) * 12 + // Cultural treaties
        30 // Base openness
    );

    // RISK TOLERANCE: Hostile relations + deteriorating relations + policy volatility
    const riskTolerance = Math.min(
      100,
      (relationships.hostile || 0) * 20 + // Hostility = risk-taking
        (relationships.deterioratingCount || 0) * 12 + // Letting relations deteriorate = risk
        (historical.policyVolatility || 0) / 2 + // Policy changes = risk tolerance
        ((relationships.averageStrength || 50) < 50 ? 20 : 0) + // Weak relations = risk
        40 // Base risk tolerance
    );

    // IDEOLOGICAL RIGIDITY: Policy consistency - policy volatility
    const ideologicalRigidity = Math.min(
      100,
      (historical.consistencyScore || 50) * 0.7 + // High consistency = rigid
        (100 - (historical.policyVolatility || 0)) * 0.3 + // Low volatility = rigid
        ((relationships.deterioratingCount || 0) > 3 ? 15 : 0) // Willing to lose relations = principled
    );

    // MILITARISM: Security embassies + defensive treaties + tense/hostile relations
    const militarism = Math.min(
      100,
      (embassies.securitySpecialized || 0) * 20 + // Security embassy focus
        (treaties.defensive || 0) * 18 + // Defense pacts
        (relationships.hostile || 0) * 15 + // Hostile relations
        (relationships.tense || 0) * 8 + // Tense relations
        20 // Base militarism
    );

    // ISOLATIONISM: Inverse of engagement (few relationships, embassies, treaties)
    const engagementScore =
      Math.min(100, (relationships.total || 0) * 8) +
      Math.min(100, (embassies.total || 0) * 10) +
      Math.min(100, (treaties.total || 0) * 12);

    const isolationism = Math.min(
      100,
      Math.max(
        0,
        100 -
          engagementScore / 3 + // Inverse of engagement
          ((relationships.total || 0) < 3 ? 30 : 0) + // Very few relationships
          ((embassies.total || 0) < 2 ? 25 : 0) // Very few embassies
      )
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

  private static assessDataQuality(data: ObservableData): {
    confidence: number;
    dataQuality: number;
  } {
    const relationships = data.relationships || { total: 0 };
    const embassies = data.embassies || { total: 0 };
    const historical = data.historical || { totalActions: 0, consistencyScore: 50 };
    const treaties = data.treaties || { total: 0 };

    // Data quality factors
    const relationshipQuality = Math.min(100, (relationships.total || 0) * 15); // Max at ~7 relationships
    const embassyQuality = Math.min(100, (embassies.total || 0) * 20); // Max at 5 embassies
    const historyQuality = Math.min(100, (historical.totalActions || 0) * 5); // Max at 20 actions
    const treatyQuality = Math.min(100, (treaties.total || 0) * 25); // Max at 4 treaties

    const dataQuality = Math.round(
      relationshipQuality * 0.35 + // Relationships most important
        embassyQuality * 0.25 + // Embassies important
        historyQuality * 0.25 + // Historical actions important
        treatyQuality * 0.15 // Treaties moderately important
    );

    // Confidence based on data quality and consistency
    const consistency = historical.consistencyScore || 50;
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
  // ==================== EVENT MODIFIERS ====================
  // ==================== PROPOSAL DECISION-MAKING ====================
  // ==================== PERSONALITY DRIFT ====================
}
