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

import { type NPCPersonality } from "./npc-personality";

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

interface NPCParticipationDecision {
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

// NPC CULTURAL PARTICIPATION CLASS

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

  // PRIVATE HELPER METHODS

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
    // oxlint-disable-next-line typescript/no-unused-vars
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
}
