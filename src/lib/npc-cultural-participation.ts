/**
 * NPC Cultural Participation System
 *
 * Enables NPC countries to automatically participate in cultural exchanges based on their
 * personality traits, relationship status, and strategic interests. Integrates with the
 * NPC personality system to generate realistic, personality-driven cultural diplomacy.
 *
 * Features:
 * - Auto-generate NPC participation decisions based on personality
 * - Calculate participation enthusiasm and resource commitment
 * - Generate personality-driven responses to cultural exchange invitations
 * - Simulate NPC-initiated cultural exchange proposals
 */

import {
  NPCPersonalitySystem,
  type NPCPersonality,
  type ObservableData,
} from "./diplomatic-npc-personality";
import {
  CulturalScenarioGenerator,
  type CulturalScenarioType,
  type CulturalScenario,
} from "./cultural-scenario-generator";
import { CulturalImpactCalculator, type CulturalExchangeData } from "./cultural-impact-calculator";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface NPCParticipationContext {
  npcCountryId: string;
  npcCountryName: string;
  npcPersonality: NPCPersonality;
  hostCountryId: string;
  hostCountryName: string;
  relationshipStrength: number; // 0-100
  relationshipState: string;
  exchangeType: string;
  exchangeDetails: {
    title: string;
    description: string;
    culturalImpact: number;
    diplomaticValue: number;
    economicCost: number;
    duration: number; // days
  };
  existingExchanges: number;
  historicalSuccess: number; // 0-100
}

export interface NPCParticipationDecision {
  willParticipate: boolean;
  enthusiasmLevel: number; // 0-100
  resourceCommitment: number; // 0-100
  confidence: number; // 0-100 (how confident the NPC is in this decision)
  reasoning: string[];
  conditions?: string[]; // Conditions NPC wants met
  alternativeProposal?: {
    suggestedType: string;
    suggestedFormat: string;
    reasoning: string;
  };
  responseMessage: string;
  responseTimeline: "immediate" | "short_term" | "long_term"; // How quickly NPC responds
}

export interface NPCInitiatedProposal {
  npcCountryId: string;
  npcCountryName: string;
  targetCountryId: string;
  targetCountryName: string;
  proposalType: CulturalScenarioType | string;
  title: string;
  description: string;
  motivation: string[];
  expectedBenefits: {
    cultural: number;
    diplomatic: number;
    economic: number;
  };
  proposedTimeline: {
    planningPhase: number; // days
    executionPhase: number; // days
    followUpPhase: number; // days
  };
  resourceOffer: number; // 0-100 (percentage of costs NPC willing to cover)
  specialRequests: string[];
  urgency: "low" | "medium" | "high" | "critical";
}

export interface NPCScenarioResponse {
  npcCountryId: string;
  scenarioId: string;
  chosenOption: string;
  responseReasoning: string[];
  predictedOutcome: {
    culturalImpact: number;
    diplomaticImpact: number;
    publicReaction: string;
  };
  confidence: number;
  alternativeConsideration: string | null;
}

// ============================================================================
// NPC CULTURAL PARTICIPATION CLASS
// ============================================================================

export class NPCCulturalParticipation {
  /**
   * Evaluate whether NPC country will participate in cultural exchange
   */
  static evaluateParticipation(context: NPCParticipationContext): NPCParticipationDecision {
    const personality = context.npcPersonality;
    const reasoning: string[] = [];
    const conditions: string[] = [];

    // Base participation probability from cultural openness
    let participationScore = personality.traits.culturalOpenness;
    reasoning.push(`Cultural openness: ${personality.traits.culturalOpenness}/100`);

    // Relationship strength impact
    if (context.relationshipStrength > 70) {
      participationScore += 20;
      reasoning.push("Strong bilateral relationship encourages participation (+20)");
    } else if (context.relationshipStrength > 50) {
      participationScore += 10;
      reasoning.push("Positive relationship supports participation (+10)");
    } else if (context.relationshipStrength < 30) {
      participationScore -= 25;
      reasoning.push("Weak relationship discourages participation (-25)");
      conditions.push("Improve bilateral relations before proceeding");
    }

    // Personality archetype modifiers
    const archetypeModifiers = this.getArchetypeModifiers(
      personality.archetype,
      context.exchangeType,
      reasoning
    );
    participationScore += archetypeModifiers.participationBonus;

    // Historical success impact
    if (context.historicalSuccess > 70 && context.existingExchanges > 2) {
      participationScore += 15;
      reasoning.push("Strong track record of successful exchanges (+15)");
    } else if (context.historicalSuccess < 40 && context.existingExchanges > 1) {
      participationScore -= 20;
      reasoning.push("Past exchange difficulties create hesitation (-20)");
      conditions.push("Address issues from previous exchanges");
    }

    // Economic focus impact on cost tolerance
    const economicCostImpact = this.evaluateEconomicCost(
      personality.traits.economicFocus,
      context.exchangeDetails.economicCost,
      reasoning,
      conditions
    );
    participationScore += economicCostImpact;

    // Assertiveness affects negotiation style
    if (personality.traits.assertiveness > 70) {
      conditions.push("Equal partnership and shared decision-making authority");
      reasoning.push("High assertiveness demands equal status in partnership");
    }

    // Ideological rigidity affects content acceptance
    if (personality.traits.ideologicalRigidity > 70) {
      conditions.push("Content must align with national values and sensitivities");
      reasoning.push("Ideological concerns require content oversight");
    }

    // Calculate final decision
    const willParticipate = participationScore > 50;
    const enthusiasmLevel = Math.max(0, Math.min(100, participationScore));

    // Calculate resource commitment based on enthusiasm and economic focus
    const resourceCommitment = this.calculateResourceCommitment(
      enthusiasmLevel,
      personality.traits.economicFocus,
      personality.traits.riskTolerance,
      context.exchangeDetails.economicCost
    );

    // Generate response message
    const responseMessage = this.generateResponseMessage(
      context.npcCountryName,
      willParticipate,
      enthusiasmLevel,
      personality.archetype,
      conditions
    );

    // Determine response timeline based on personality
    const responseTimeline = this.determineResponseTimeline(
      personality.traits.assertiveness,
      personality.traits.riskTolerance,
      enthusiasmLevel
    );

    // Check for alternative proposal
    const alternativeProposal =
      !willParticipate && enthusiasmLevel > 35
        ? this.generateAlternativeProposal(context, personality, reasoning)
        : undefined;

    return {
      willParticipate,
      enthusiasmLevel,
      resourceCommitment,
      confidence: personality.confidence,
      reasoning,
      conditions: conditions.length > 0 ? conditions : undefined,
      alternativeProposal,
      responseMessage,
      responseTimeline,
    };
  }

  /**
   * Generate NPC-initiated cultural exchange proposal
   */
  static generateNPCProposal(
    npcCountryId: string,
    npcCountryName: string,
    targetCountryId: string,
    targetCountryName: string,
    npcPersonality: NPCPersonality,
    relationshipStrength: number,
    existingExchanges: number
  ): NPCInitiatedProposal | null {
    const motivation: string[] = [];

    // Determine if NPC is motivated to propose exchange
    const proposalProbability = this.calculateProposalProbability(
      npcPersonality,
      relationshipStrength,
      existingExchanges,
      motivation
    );

    if (Math.random() > proposalProbability) {
      return null; // NPC not motivated to propose at this time
    }

    // Select appropriate exchange type based on personality
    const proposalType = this.selectProposalType(npcPersonality, motivation);

    // Generate title and description
    const title = this.generateProposalTitle(npcCountryName, targetCountryName, proposalType);
    const description = this.generateProposalDescription(
      npcCountryName,
      targetCountryName,
      proposalType,
      npcPersonality,
      relationshipStrength
    );

    // Calculate expected benefits based on personality priorities
    const expectedBenefits = this.calculateExpectedBenefits(
      npcPersonality,
      proposalType,
      relationshipStrength
    );

    // Determine timeline based on risk tolerance and assertiveness
    const proposedTimeline = this.generateTimeline(
      npcPersonality.traits.riskTolerance,
      proposalType
    );

    // Calculate resource offer
    const resourceOffer = this.calculateResourceOffer(
      npcPersonality.traits.economicFocus,
      npcPersonality.traits.cooperativeness,
      relationshipStrength
    );

    // Generate special requests based on personality
    const specialRequests = this.generateSpecialRequests(npcPersonality, proposalType);

    // Determine urgency
    const urgency = this.determineProposalUrgency(
      npcPersonality.traits.assertiveness,
      relationshipStrength
    );

    return {
      npcCountryId,
      npcCountryName,
      targetCountryId,
      targetCountryName,
      proposalType,
      title,
      description,
      motivation,
      expectedBenefits,
      proposedTimeline,
      resourceOffer,
      specialRequests,
      urgency,
    };
  }

  /**
   * Generate NPC response to cultural exchange scenario
   */
  static generateScenarioResponse(
    npcCountryId: string,
    npcPersonality: NPCPersonality,
    scenario: CulturalScenario,
    relationshipStrength: number
  ): NPCScenarioResponse {
    const responseReasoning: string[] = [];

    // Use NPC personality system to predict response
    const npcResponse = NPCPersonalitySystem.predictResponse(
      npcPersonality,
      "cultural_exchange_offer",
      {
        currentRelationship:
          relationshipStrength > 60 ? "friendly" : relationshipStrength > 40 ? "neutral" : "tense",
        relationshipStrength,
        playerReputation: {
          reputationModifier: relationshipStrength - 50,
          trustLevel: relationshipStrength,
          predictability: 50,
          aggressiveness: 0,
          cooperativeness: relationshipStrength,
          culturalDiplomacyScore: 50,
          exchangeSuccessRate: 50,
          historicalPatterns: {
            favorsAlliances: false,
            prefersTrade: false,
            culturallyActive: true,
            interventionist: false,
            isolationist: false,
            multilateral: false,
          },
        },
        recentPlayerActions: [],
      }
    );

    // Map response action to scenario option
    const chosenOption = this.mapResponseToOption(
      npcResponse.predictedAction,
      scenario.responseOptions,
      npcPersonality,
      responseReasoning
    );

    // Calculate predicted outcome based on chosen option
    const selectedOption = scenario.responseOptions.find(
      (opt: { id: string }) => opt.id === chosenOption
    );
    const predictedOutcome = selectedOption
      ? {
          culturalImpact: selectedOption.predictedOutcomes.immediate.culturalImpact,
          diplomaticImpact: selectedOption.predictedOutcomes.immediate.diplomaticChange,
          publicReaction: this.predictPublicReaction(
            npcPersonality,
            selectedOption.predictedOutcomes.immediate.culturalImpact
          ),
        }
      : {
          culturalImpact: 0,
          diplomaticImpact: 0,
          publicReaction: "Neutral",
        };

    // Add NPC reasoning to response reasoning
    responseReasoning.push(...npcResponse.reasoning);

    return {
      npcCountryId,
      scenarioId: scenario.id,
      chosenOption,
      responseReasoning,
      predictedOutcome,
      confidence: npcResponse.confidence,
      alternativeConsideration:
        npcResponse.alternativeActions.length > 0
          ? `Alternative: ${npcResponse.alternativeActions[0]!.action} (${npcResponse.alternativeActions[0]!.probability}% likely)`
          : null,
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private static getArchetypeModifiers(
    archetype: string,
    exchangeType: string,
    reasoning: string[]
  ): { participationBonus: number } {
    const modifiers: Record<string, Record<string, number>> = {
      cultural_diplomat: {
        festival: 25,
        exhibition: 20,
        arts: 25,
        education: 20,
        cuisine: 15,
        sports: 10,
        technology: 10,
        diplomacy: 30,
      },
      "Peaceful Merchant": {
        exhibition: 15,
        technology: 20,
        education: 15,
        festival: 10,
        cuisine: 12,
        sports: 8,
        arts: 10,
        diplomacy: 12,
      },
      "Aggressive Expansionist": {
        diplomacy: 15,
        technology: 10,
        sports: 15,
        festival: 5,
        education: 5,
        arts: -5,
        cuisine: 0,
        exhibition: 5,
      },
      cautious_isolationist: {
        education: -10,
        festival: -15,
        exhibition: -10,
        arts: -5,
        cuisine: 5,
        sports: 0,
        technology: -10,
        diplomacy: -5,
      },
      "Pragmatic Realist": {
        education: 15,
        technology: 20,
        diplomacy: 15,
        exhibition: 10,
        festival: 10,
        arts: 8,
        cuisine: 8,
        sports: 10,
      },
      "Ideological Hardliner": {
        diplomacy: 10,
        arts: -10,
        exhibition: -5,
        festival: 0,
        education: 5,
        technology: 10,
        cuisine: 5,
        sports: 5,
      },
    };

    const archetypeModifiers = modifiers[archetype] || {};
    const bonus = archetypeModifiers[exchangeType] || 0;

    if (bonus !== 0) {
      reasoning.push(
        `${archetype} archetype: ${bonus > 0 ? "+" : ""}${bonus} for ${exchangeType} exchanges`
      );
    }

    return { participationBonus: bonus };
  }

  private static evaluateEconomicCost(
    economicFocus: number,
    cost: number,
    reasoning: string[],
    conditions: string[]
  ): number {
    let costImpact = 0;

    if (economicFocus > 70) {
      // High economic focus = cost-sensitive
      if (cost > 50000) {
        costImpact -= 20;
        reasoning.push("High economic cost discourages participation (-20)");
        conditions.push("Require cost-sharing arrangement");
      } else if (cost > 25000) {
        costImpact -= 10;
        reasoning.push("Moderate cost requires budget consideration (-10)");
      }
    } else if (economicFocus < 40) {
      // Low economic focus = less cost-sensitive
      if (cost < 30000) {
        costImpact += 5;
        reasoning.push("Reasonable cost presents no barrier (+5)");
      }
    }

    return costImpact;
  }

  private static calculateResourceCommitment(
    enthusiasmLevel: number,
    economicFocus: number,
    riskTolerance: number,
    cost: number
  ): number {
    // Base commitment from enthusiasm
    let commitment = enthusiasmLevel * 0.6;

    // Economic focus reduces commitment
    commitment -= (economicFocus / 100) * 15;

    // Risk tolerance increases commitment
    commitment += (riskTolerance / 100) * 20;

    // High cost reduces commitment
    if (cost > 50000) {
      commitment -= 15;
    }

    return Math.max(20, Math.min(95, commitment));
  }

  private static generateResponseMessage(
    countryName: string,
    willParticipate: boolean,
    enthusiasm: number,
    archetype: string,
    conditions?: string[]
  ): string {
    if (willParticipate) {
      if (enthusiasm > 80) {
        return `${countryName} enthusiastically accepts this cultural exchange opportunity and looks forward to deep collaboration.${conditions && conditions.length > 0 ? ` We have some conditions to ensure success: ${conditions.join("; ")}.` : ""}`;
      } else if (enthusiasm > 60) {
        return `${countryName} agrees to participate in this cultural exchange initiative.${conditions && conditions.length > 0 ? ` We request the following conditions be met: ${conditions.join("; ")}.` : ""}`;
      } else {
        return `${countryName} will participate, though with reservations.${conditions && conditions.length > 0 ? ` The following conditions are necessary: ${conditions.join("; ")}.` : ""}`;
      }
    } else {
      if (archetype === "cautious_isolationist") {
        return `${countryName} respectfully declines at this time, preferring to focus on domestic cultural initiatives.`;
      } else if (archetype === "aggressive_expansionist") {
        return `${countryName} does not see strategic value in this proposal and must decline.`;
      } else if (archetype === "ideological_hardliner") {
        return `${countryName} cannot participate due to concerns about ideological compatibility and content control.`;
      } else {
        return `${countryName} appreciates the invitation but must decline participation at this time due to resource constraints and other priorities.`;
      }
    }
  }

  private static determineResponseTimeline(
    assertiveness: number,
    riskTolerance: number,
    enthusiasm: number
  ): "immediate" | "short_term" | "long_term" {
    const decisionSpeed = (assertiveness + riskTolerance + enthusiasm) / 3;

    if (decisionSpeed > 70) {
      return "immediate"; // Responds within days
    } else if (decisionSpeed > 40) {
      return "short_term"; // Responds within weeks
    } else {
      return "long_term"; // Takes months to decide
    }
  }

  private static generateAlternativeProposal(
    context: NPCParticipationContext,
    personality: NPCPersonality,
    reasoning: string[]
  ): NPCParticipationDecision["alternativeProposal"] {
    // NPC suggests alternative that better fits their personality
    const preferredTypes = this.getPreferredExchangeTypes(personality.archetype);
    const suggestedType = preferredTypes[0] || "education";

    let suggestedFormat = "smaller-scale pilot program";
    if (personality.traits.riskTolerance < 40) {
      suggestedFormat = "low-risk, limited-scope initiative";
    } else if (personality.traits.cooperativeness > 70) {
      suggestedFormat = "collaborative partnership with equal input from both sides";
    }

    return {
      suggestedType,
      suggestedFormat,
      reasoning: `${context.npcCountryName} would prefer ${suggestedType} exchange in ${suggestedFormat} format, which better aligns with our national priorities and capabilities.`,
    };
  }

  private static getPreferredExchangeTypes(archetype: string): string[] {
    const preferences: Record<string, string[]> = {
      cultural_diplomat: ["arts", "exhibition", "festival", "education"],
      peaceful_merchant: ["technology", "education", "exhibition"],
      aggressive_expansionist: ["sports", "technology", "diplomacy"],
      cautious_isolationist: ["cuisine", "sports"],
      pragmatic_realist: ["education", "technology", "diplomacy"],
      ideological_hardliner: ["technology", "education", "diplomacy"],
    };

    return preferences[archetype] || ["education", "festival"];
  }

  private static calculateProposalProbability(
    personality: NPCPersonality,
    relationshipStrength: number,
    existingExchanges: number,
    motivation: string[]
  ): number {
    let probability = 0.15; // 15% base

    // Cultural openness drives proposals
    probability += (personality.traits.culturalOpenness / 100) * 0.3;
    if (personality.traits.culturalOpenness > 70) {
      motivation.push("Strong commitment to cultural diplomacy");
    }

    // Cooperativeness increases proposal likelihood
    probability += (personality.traits.cooperativeness / 100) * 0.2;

    // Strong relationships encourage proposals
    if (relationshipStrength > 70) {
      probability += 0.25;
      motivation.push("Excellent bilateral relationship creates opportunity");
    } else if (relationshipStrength < 40) {
      probability -= 0.15;
    }

    // Few existing exchanges = more likely to propose
    if (existingExchanges < 2) {
      probability += 0.15;
      motivation.push("Seeking to establish cultural ties");
    }

    // Archetype modifiers
    if (personality.archetype === "cultural_diplomat") {
      probability += 0.3;
      motivation.push("Cultural diplomacy is core national priority");
    } else if (personality.archetype === "cautious_isolationist") {
      probability -= 0.25;
    }

    return Math.max(0, Math.min(0.85, probability));
  }

  private static selectProposalType(personality: NPCPersonality, motivation: string[]): string {
    const preferences = this.getPreferredExchangeTypes(personality.archetype);
    const selected = preferences[Math.floor(Math.random() * Math.min(preferences.length, 2))]!;

    motivation.push(
      `${selected.charAt(0).toUpperCase() + selected.slice(1)} exchange aligns with national strengths`
    );

    return selected;
  }

  private static generateProposalTitle(
    npcCountry: string,
    targetCountry: string,
    proposalType: string
  ): string {
    const typeNames: Record<string, string> = {
      festival: "Cultural Festival Partnership",
      exhibition: "Joint Cultural Exhibition",
      education: "Educational Exchange Program",
      arts: "Artistic Collaboration Initiative",
      technology: "Technology & Innovation Partnership",
      cuisine: "Culinary Heritage Exchange",
      sports: "Sports & Athletic Cooperation",
      diplomacy: "Cultural Diplomacy Program",
    };

    const typeName = typeNames[proposalType] || "Cultural Exchange Program";
    return `${npcCountry}-${targetCountry} ${typeName}`;
  }

  private static generateProposalDescription(
    npcCountry: string,
    targetCountry: string,
    proposalType: string,
    personality: NPCPersonality,
    relationshipStrength: number
  ): string {
    const tone =
      personality.traits.cooperativeness > 70
        ? "collaborative"
        : personality.traits.assertiveness > 70
          ? "assertive"
          : "professional";

    const descriptions: Record<string, string> = {
      festival: `${npcCountry} proposes organizing a joint cultural festival celebrating the heritage and traditions of both nations. This ${tone} initiative would showcase music, dance, art, and cuisine from both cultures.`,
      exhibition: `${npcCountry} suggests a collaborative exhibition highlighting the cultural achievements and artistic traditions of ${npcCountry} and ${targetCountry}. The exhibition would tour major cities in both countries.`,
      education: `${npcCountry} proposes establishing a comprehensive educational exchange program, including student scholarships, faculty exchanges, and collaborative research initiatives between our nations.`,
      arts: `${npcCountry} invites ${targetCountry} to join an artistic collaboration bringing together painters, sculptors, musicians, and performers from both nations for creative partnerships.`,
      technology: `${npcCountry} proposes a technology and innovation partnership focused on cultural preservation, digital archives, and using modern technology to celebrate and protect our shared cultural heritage.`,
      cuisine: `${npcCountry} suggests a culinary exchange program featuring chef collaborations, food festivals, and cultural gastronomy initiatives that celebrate the rich culinary traditions of both nations.`,
      sports: `${npcCountry} proposes a sports diplomacy initiative including friendly competitions, coaching exchanges, and joint training programs to strengthen people-to-people bonds through athletics.`,
      diplomacy: `${npcCountry} invites ${targetCountry} to participate in a comprehensive cultural diplomacy program designed to deepen mutual understanding and strengthen bilateral relations through sustained cultural engagement.`,
    };

    return (
      descriptions[proposalType] ||
      `${npcCountry} proposes a cultural exchange program with ${targetCountry}.`
    );
  }

  private static calculateExpectedBenefits(
    personality: NPCPersonality,
    proposalType: string,
    relationshipStrength: number
  ): NPCInitiatedProposal["expectedBenefits"] {
    const baseBenefits: Record<string, { cultural: number; diplomatic: number; economic: number }> =
      {
        festival: { cultural: 70, diplomatic: 50, economic: 40 },
        exhibition: { cultural: 65, diplomatic: 45, economic: 35 },
        education: { cultural: 80, diplomatic: 60, economic: 50 },
        arts: { cultural: 75, diplomatic: 50, economic: 30 },
        technology: { cultural: 60, diplomatic: 55, economic: 65 },
        cuisine: { cultural: 60, diplomatic: 40, economic: 45 },
        sports: { cultural: 55, diplomatic: 50, economic: 40 },
        diplomacy: { cultural: 70, diplomatic: 80, economic: 45 },
      };

    const base = baseBenefits[proposalType] || { cultural: 60, diplomatic: 50, economic: 40 };

    // Personality affects benefit perception
    const culturalModifier = personality.traits.culturalOpenness / 100;
    const diplomaticModifier = personality.traits.cooperativeness / 100;
    const economicModifier = personality.traits.economicFocus / 100;

    return {
      cultural: Math.floor(base.cultural * (0.7 + culturalModifier * 0.6)),
      diplomatic: Math.floor(base.diplomatic * (0.7 + diplomaticModifier * 0.6)),
      economic: Math.floor(base.economic * (0.7 + economicModifier * 0.6)),
    };
  }

  private static generateTimeline(
    riskTolerance: number,
    proposalType: string
  ): NPCInitiatedProposal["proposedTimeline"] {
    const baseTimelines: Record<string, { planning: number; execution: number; followUp: number }> =
      {
        festival: { planning: 90, execution: 14, followUp: 30 },
        exhibition: { planning: 120, execution: 60, followUp: 30 },
        education: { planning: 180, execution: 365, followUp: 90 },
        arts: { planning: 90, execution: 180, followUp: 60 },
        technology: { planning: 60, execution: 180, followUp: 90 },
        cuisine: { planning: 60, execution: 30, followUp: 30 },
        sports: { planning: 90, execution: 21, followUp: 30 },
        diplomacy: { planning: 120, execution: 365, followUp: 90 },
      };

    const base = baseTimelines[proposalType] || { planning: 90, execution: 90, followUp: 30 };

    // High risk tolerance = shorter timelines
    const timelineModifier = riskTolerance > 70 ? 0.8 : riskTolerance < 40 ? 1.3 : 1.0;

    return {
      planningPhase: Math.floor(base.planning * timelineModifier),
      executionPhase: Math.floor(base.execution * timelineModifier),
      followUpPhase: Math.floor(base.followUp * timelineModifier),
    };
  }

  private static calculateResourceOffer(
    economicFocus: number,
    cooperativeness: number,
    relationshipStrength: number
  ): number {
    let offer = 50; // Start at 50/50 split

    // High cooperativeness = more generous
    if (cooperativeness > 70) {
      offer += 15;
    } else if (cooperativeness < 40) {
      offer -= 15;
    }

    // Strong relationship = more willing to invest
    if (relationshipStrength > 70) {
      offer += 10;
    } else if (relationshipStrength < 40) {
      offer -= 10;
    }

    // High economic focus = less generous
    if (economicFocus > 70) {
      offer -= 20;
    } else if (economicFocus < 40) {
      offer += 10;
    }

    return Math.max(20, Math.min(80, offer));
  }

  private static generateSpecialRequests(
    personality: NPCPersonality,
    proposalType: string
  ): string[] {
    const requests: string[] = [];

    if (personality.traits.assertiveness > 70) {
      requests.push("Equal representation in decision-making");
      requests.push("Co-leadership of organizing committee");
    }

    if (personality.traits.ideologicalRigidity > 70) {
      requests.push("Content review and approval process");
      requests.push("Respect for cultural and ideological sensitivities");
    }

    if (personality.traits.economicFocus > 70) {
      requests.push("Clear budget and cost-sharing agreement");
      requests.push("Opportunities for economic spin-offs and partnerships");
    }

    if (personality.traits.culturalOpenness > 80) {
      requests.push("Maximum public engagement and accessibility");
      requests.push("Documentation for cultural archives");
    }

    return requests;
  }

  private static determineProposalUrgency(
    assertiveness: number,
    relationshipStrength: number
  ): "low" | "medium" | "high" | "critical" {
    const urgencyScore = assertiveness / 2 + relationshipStrength / 4;

    if (urgencyScore > 70) return "high";
    if (urgencyScore > 50) return "medium";
    return "low";
  }

  private static mapResponseToOption(
    recommendedAction: string,
    options: any[],
    personality: NPCPersonality,
    reasoning: string[]
  ): string {
    // Map general actions to specific scenario options
    const actionMap: Record<string, string[]> = {
      accept: [
        "full_program",
        "full_repatriation",
        "accept",
        "mediation",
        "collaborative_redesign",
      ],
      negotiate: [
        "negotiate",
        "pilot_program",
        "joint_custody",
        "compromise",
        "conditional_return",
      ],
      defer: ["postpone", "limited_involvement", "cautious", "educational_campaign"],
      reject: ["decline", "stand_firm", "maintain_status", "non_intervention"],
      escalate: ["assert_dominance", "counter_tariffs", "demand_withdrawal"],
    };

    const preferredOptions = actionMap[recommendedAction] || [];

    // Find matching option
    for (const preferred of preferredOptions) {
      const match = options.find((opt: { id: string; label: string }) => opt.id === preferred);
      if (match) {
        reasoning.push(`Selected ${match.label} based on ${personality.archetype} personality`);
        return match.id;
      }
    }

    // Fallback: select based on personality traits
    if (personality.traits.cooperativeness > 70) {
      const cooperative = options.find(
        (opt: { id: string }) =>
          opt.id.includes("cooperat") || opt.id.includes("collab") || opt.id.includes("compromise")
      );
      if (cooperative) {
        reasoning.push("Selected cooperative option based on high cooperativeness trait");
        return cooperative.id;
      }
    }

    if (personality.traits.assertiveness > 70) {
      const assertive = options.find(
        (opt: { id: string }) =>
          opt.id.includes("assert") || opt.id.includes("demand") || opt.id.includes("firm")
      );
      if (assertive) {
        reasoning.push("Selected assertive option based on high assertiveness trait");
        return assertive.id;
      }
    }

    // Final fallback: first option
    reasoning.push("Selected default option");
    return options[0]?.id || "default";
  }

  private static predictPublicReaction(
    personality: NPCPersonality,
    culturalImpact: number
  ): string {
    if (culturalImpact > 70) {
      return personality.traits.culturalOpenness > 60
        ? "Enthusiastically positive"
        : "Cautiously optimistic";
    } else if (culturalImpact > 40) {
      return "Moderately positive";
    } else if (culturalImpact > 0) {
      return "Mixed";
    } else if (culturalImpact > -30) {
      return "Skeptical";
    } else {
      return "Negative";
    }
  }
}
