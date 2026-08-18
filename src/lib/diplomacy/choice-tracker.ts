/**
 * Diplomatic Choice Tracker
 *
 * Tracks player decisions and calculates ripple effects across the diplomatic network.
 * Analyzes historical patterns to predict outcomes and provide insights.
 *
 * Design Philosophy:
 * - All choices have consequences (immediate and long-term)
 * - Patterns emerge from consistent behavior
 * - Second-order effects matter (affects partners' partners)
 * - Reputation is built through actions, not words
 */

// ==================== TYPES ====================

export interface DiplomaticChoice {
  id: string;
  countryId: string;
  type:
    | "establish_embassy"
    | "upgrade_embassy"
    | "close_embassy"
    | "sign_treaty"
    | "break_treaty"
    | "cultural_exchange"
    | "diplomatic_message"
    | "share_intelligence"
    | "trade_agreement"
    | "alliance_formation"
    | "sanctions"
    | "mediation"
    | "cultural_exchange_initiated"
    | "cultural_exchange_joined"
    | "cultural_scenario_response"
    | "cultural_exchange_success"
    | "cultural_exchange_failure"
    | "create_cultural_exchange"
    | "join_cultural_exchange"
    | "complete_cultural_exchange"
    | "cancel_cultural_exchange"
    | "generate_cultural_scenario"
    | "respond_to_cultural_scenario"
    | "vote_on_cultural_exchange"
    | "upload_cultural_artifact";
  targetCountry: string;
  targetCountryId: string;
  details: Record<string, any>;
  timestamp: string;
  ixTimeTimestamp: number;
  actorType?: "player" | "npc" | "system";
  contextSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface Effect {
  type: "economic" | "diplomatic" | "security" | "cultural" | "reputation";
  magnitude: number; // -100 to +100
  duration: "instant" | "short" | "medium" | "long" | "permanent";
  description: string;
  affectedParties: string[];
}

export interface CumulativeEffects {
  reputationModifier: number; // -50 to +50
  trustLevel: number; // 0-100
  predictability: number; // 0-100 (consistent policy?)
  aggressiveness: number; // 0-100 (expansionist?)
  cooperativeness: number; // 0-100 (diplomatic?)
  culturalDiplomacyScore: number; // 0-100 (cultural engagement level)
  exchangeSuccessRate: number; // 0-100 (% of successful exchanges)
  historicalPatterns: {
    favorsAlliances: boolean;
    prefersTrade: boolean;
    culturallyActive: boolean;
    interventionist: boolean;
    isolationist: boolean;
    multilateral: boolean;
  };
}

export interface RippleEffectPreview {
  immediateEffects: Effect[];
  secondOrderEffects: Effect[]; // How it affects partners' partners
  longTermConsequences: Effect[]; // What might happen months later
  riskLevel: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
  opportunities: string[];
  confidence: number; // 0-100 (how confident we are in prediction)
}

// ==================== TRACKER CLASS ====================

export class DiplomaticChoiceTracker {
  /**
   * Record a diplomatic choice
   * Stores in database and triggers consequence calculations
   */
  static async recordChoice(choice: Omit<DiplomaticChoice, "id" | "timestamp">): Promise<void> {
    // In production, this would:
    // 1. Store in database (DiplomaticChoice table)
    // 2. Trigger async consequence calculations
    // 3. Update reputation metrics
    // 4. Notify affected parties
    // 5. Create diplomatic events

    const fullChoice: DiplomaticChoice = {
      ...choice,
      id: `choice_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString(),
    };

    // Store choice (would be database operation)
    console.log("Recording diplomatic choice:", fullChoice);

    // Calculate immediate effects
    const effects = this.calculateImmediateEffects(fullChoice);
    console.log("Immediate effects:", effects);

    // Update cumulative metrics
    // Would trigger database updates
  }

  /**
   * Calculate cumulative effects
   * How do all past choices affect current state?
   */
  static getCumulativeEffects(countryId: string, choices: DiplomaticChoice[]): CumulativeEffects {
    let reputationModifier = 0;
    let trustLevel = 50; // Start neutral
    let predictability = 50;
    let aggressiveness = 0;
    let cooperativeness = 0;

    // Analyze choice patterns
    const choicesByType = this.groupChoicesByType(choices);

    // Calculate reputation from consistency
    const consistencyScore = this.calculateConsistency(choices);
    reputationModifier += consistencyScore * 20; // Max ±20 from consistency

    // Trust level from relationship building
    const relationshipChoices = choices.filter((c) =>
      [
        "establish_embassy",
        "sign_treaty",
        "cultural_exchange",
        "alliance_formation",
        "create_cultural_exchange",
        "join_cultural_exchange",
        "complete_cultural_exchange",
      ].includes(c.type)
    );
    trustLevel += Math.min(relationshipChoices.length * 2, 30); // Max +30

    // Successful cultural exchanges build significant trust
    const successfulCulturalExchanges = choices.filter((c) =>
      ["complete_cultural_exchange", "cultural_exchange_success"].includes(c.type)
    );
    trustLevel += Math.min(successfulCulturalExchanges.length * 3, 20); // Max +20 from cultural success

    const negativeChoices = choices.filter((c) =>
      ["close_embassy", "break_treaty", "sanctions", "cancel_cultural_exchange"].includes(c.type)
    );
    trustLevel -= Math.min(negativeChoices.length * 5, 40); // Max -40

    // Predictability from policy consistency
    predictability = this.calculatePredictability(choices);

    // Aggressiveness from assertive actions
    const assertiveChoices = choices.filter((c) =>
      ["sanctions", "break_treaty", "close_embassy"].includes(c.type)
    );
    aggressiveness = Math.min((assertiveChoices.length / Math.max(choices.length, 1)) * 100, 100);

    // Cooperativeness from collaborative actions
    const cooperativeChoices = choices.filter((c) =>
      [
        "cultural_exchange",
        "share_intelligence",
        "mediation",
        "trade_agreement",
        "create_cultural_exchange",
        "join_cultural_exchange",
        "complete_cultural_exchange",
        "generate_cultural_scenario",
        "respond_to_cultural_scenario",
        "vote_on_cultural_exchange",
        "upload_cultural_artifact",
      ].includes(c.type)
    );
    cooperativeness = Math.min(
      (cooperativeChoices.length / Math.max(choices.length, 1)) * 100,
      100
    );

    // Calculate cultural diplomacy metrics
    const culturalMetrics = this.calculateCulturalMetrics(choices, choicesByType);

    // Identify historical patterns
    const historicalPatterns = this.identifyPatterns(choices, choicesByType, culturalMetrics);

    // Clamp values
    reputationModifier = Math.max(-50, Math.min(50, reputationModifier));
    trustLevel = Math.max(0, Math.min(100, trustLevel));

    return {
      reputationModifier,
      trustLevel,
      predictability,
      aggressiveness,
      cooperativeness,
      culturalDiplomacyScore: culturalMetrics.culturalDiplomacyScore,
      exchangeSuccessRate: culturalMetrics.exchangeSuccessRate,
      historicalPatterns,
    };
  }

  /**
   * Preview ripple effects for a potential choice
   * Before player commits
   */
  static previewRippleEffects(
    choice: Omit<DiplomaticChoice, "id" | "timestamp">,
    currentNetwork: {
      embassies: any[];
      relationships: any[];
      treaties: any[];
    },
    historicalChoices: DiplomaticChoice[]
  ): RippleEffectPreview {
    const immediateEffects: Effect[] = [];
    const secondOrderEffects: Effect[] = [];
    const longTermConsequences: Effect[] = [];
    const riskFactors: string[] = [];
    const opportunities: string[] = [];

    // Calculate immediate effects based on choice type
    switch (choice.type) {
      case "establish_embassy":
        immediateEffects.push({
          type: "diplomatic",
          magnitude: 20,
          duration: "instant",
          description: `Diplomatic relations with ${choice.targetCountry} improve`,
          affectedParties: [choice.targetCountryId],
        });
        immediateEffects.push({
          type: "economic",
          magnitude: 10,
          duration: "medium",
          description: "Trade opportunities increase with new embassy",
          affectedParties: [choice.targetCountryId],
        });

        // Second-order: affects mutual partners
        const mutualPartners = this.findMutualPartners(
          choice.countryId,
          choice.targetCountryId,
          currentNetwork.relationships
        );
        if (mutualPartners.length > 0) {
          secondOrderEffects.push({
            type: "diplomatic",
            magnitude: 5,
            duration: "short",
            description: `Triangular cooperation strengthens with ${mutualPartners.length} mutual partner(s)`,
            affectedParties: mutualPartners,
          });
          opportunities.push(`Triangular diplomacy with ${mutualPartners.length} shared partners`);
        }

        // Long-term: embassy grows over time
        longTermConsequences.push({
          type: "cultural",
          magnitude: 15,
          duration: "long",
          description: "Cultural ties deepen through sustained embassy presence",
          affectedParties: [choice.targetCountryId],
        });
        break;

      case "close_embassy":
        immediateEffects.push({
          type: "diplomatic",
          magnitude: -30,
          duration: "instant",
          description: `Relations with ${choice.targetCountry} deteriorate`,
          affectedParties: [choice.targetCountryId],
        });

        riskFactors.push("Closing embassy signals retreat and may damage broader reputation");
        riskFactors.push("Intelligence gathering capability reduced");

        // Second-order: affects allies of target
        const targetAllies = currentNetwork.relationships.filter(
          (r) => r.targetCountryId === choice.targetCountryId && r.relationship === "alliance"
        );
        if (targetAllies.length > 0) {
          secondOrderEffects.push({
            type: "diplomatic",
            magnitude: -10,
            duration: "medium",
            description: `Allies of ${choice.targetCountry} view this negatively`,
            affectedParties: targetAllies.map((a) => a.targetCountryId),
          });
          riskFactors.push(`May strain relations with ${targetAllies.length} allied countries`);
        }

        longTermConsequences.push({
          type: "reputation",
          magnitude: -15,
          duration: "permanent",
          description: "Reputation for commitment questioned",
          affectedParties: [],
        });
        break;

      case "sign_treaty":
        immediateEffects.push({
          type: "diplomatic",
          magnitude: 35,
          duration: "instant",
          description: `Formal treaty with ${choice.targetCountry} strengthens ties`,
          affectedParties: [choice.targetCountryId],
        });

        // Treaty type specific effects
        const treatyType = choice.details.treatyType || "general";
        if (treatyType === "trade") {
          immediateEffects.push({
            type: "economic",
            magnitude: 25,
            duration: "long",
            description: "Trade volume expected to increase significantly",
            affectedParties: [choice.targetCountryId],
          });
        } else if (treatyType === "defense") {
          immediateEffects.push({
            type: "security",
            magnitude: 30,
            duration: "long",
            description: "Mutual defense commitment enhances security",
            affectedParties: [choice.targetCountryId],
          });

          // Second-order: affects rivals
          const rivals = currentNetwork.relationships.filter((r) => r.relationship === "tension");
          if (rivals.length > 0) {
            secondOrderEffects.push({
              type: "security",
              magnitude: -15,
              duration: "medium",
              description: "Rivals may view defense treaty as threatening",
              affectedParties: rivals.map((r) => r.targetCountryId),
            });
            riskFactors.push("Defense treaty may escalate tensions with rivals");
          }
        }

        longTermConsequences.push({
          type: "reputation",
          magnitude: 20,
          duration: "permanent",
          description: "Reputation as reliable treaty partner enhanced",
          affectedParties: [],
        });
        opportunities.push("Treaty framework enables deeper cooperation");
        break;

      case "break_treaty":
        immediateEffects.push({
          type: "diplomatic",
          magnitude: -50,
          duration: "instant",
          description: `Breaking treaty severely damages relations with ${choice.targetCountry}`,
          affectedParties: [choice.targetCountryId],
        });

        riskFactors.push("Treaty violation damages international reputation");
        riskFactors.push("Other treaty partners may question reliability");

        // Second-order: all treaty partners watch
        const allTreaties = currentNetwork.treaties.filter((t) => t.status === "active");
        secondOrderEffects.push({
          type: "reputation",
          magnitude: -25,
          duration: "long",
          description: "All treaty partners question your commitment",
          affectedParties: allTreaties.flatMap((t) => JSON.parse(t.parties || "[]")),
        });

        longTermConsequences.push({
          type: "reputation",
          magnitude: -40,
          duration: "permanent",
          description: "Long-lasting reputation damage for treaty violations",
          affectedParties: [],
        });
        break;

      case "cultural_exchange":
        immediateEffects.push({
          type: "cultural",
          magnitude: 20,
          duration: "short",
          description: `Cultural ties with ${choice.targetCountry} strengthen`,
          affectedParties: [choice.targetCountryId],
        });
        immediateEffects.push({
          type: "diplomatic",
          magnitude: 10,
          duration: "medium",
          description: "Soft power increases through cultural engagement",
          affectedParties: [choice.targetCountryId],
        });

        opportunities.push("Cultural exchanges build grassroots support");
        opportunities.push("May lead to broader cooperation opportunities");
        break;

      case "sanctions":
        immediateEffects.push({
          type: "diplomatic",
          magnitude: -40,
          duration: "instant",
          description: `Sanctions severely damage relations with ${choice.targetCountry}`,
          affectedParties: [choice.targetCountryId],
        });
        immediateEffects.push({
          type: "economic",
          magnitude: -15,
          duration: "medium",
          description: "Economic costs from lost trade",
          affectedParties: [choice.countryId],
        });

        riskFactors.push("Sanctions are difficult to reverse");
        riskFactors.push("May trigger counter-sanctions");
        riskFactors.push("Allies may be forced to choose sides");

        // Second-order: affects trading partners
        const tradingPartners = currentNetwork.relationships.filter(
          (r) => r.relationship === "trade"
        );
        secondOrderEffects.push({
          type: "economic",
          magnitude: -10,
          duration: "medium",
          description: "Trade disruption affects regional partners",
          affectedParties: tradingPartners.map((t) => t.targetCountryId),
        });
        break;

      case "mediation":
        immediateEffects.push({
          type: "reputation",
          magnitude: 25,
          duration: "medium",
          description: "Mediation enhances reputation as neutral arbiter",
          affectedParties: [],
        });

        opportunities.push("Successful mediation builds diplomatic capital");
        opportunities.push("Mediator role increases regional influence");

        riskFactors.push("Failed mediation may damage credibility");
        break;
    }

    // Calculate risk level
    const totalNegativeImpact = [
      ...immediateEffects,
      ...secondOrderEffects,
      ...longTermConsequences,
    ]
      .filter((e) => e.magnitude < 0)
      .reduce((sum, e) => sum + Math.abs(e.magnitude), 0);

    const riskLevel: RippleEffectPreview["riskLevel"] =
      totalNegativeImpact > 100
        ? "critical"
        : totalNegativeImpact > 60
          ? "high"
          : totalNegativeImpact > 30
            ? "medium"
            : "low";

    // Calculate confidence based on historical data
    const similarChoices = historicalChoices.filter((c) => c.type === choice.type);
    const confidence = Math.min(40 + similarChoices.length * 10, 95);

    return {
      immediateEffects,
      secondOrderEffects,
      longTermConsequences,
      riskLevel,
      riskFactors,
      opportunities,
      confidence,
    };
  }

  // ==================== HELPER METHODS ====================

  private static calculateImmediateEffects(choice: DiplomaticChoice): Effect[] {
    // Simplified version - full implementation would be more comprehensive
    const effects: Effect[] = [];

    switch (choice.type) {
      case "establish_embassy":
        effects.push({
          type: "diplomatic",
          magnitude: 20,
          duration: "instant",
          description: "Diplomatic relations improve",
          affectedParties: [choice.targetCountryId],
        });
        break;
      // Add other choice types...
    }

    return effects;
  }

  private static groupChoicesByType(
    choices: DiplomaticChoice[]
  ): Record<string, DiplomaticChoice[]> {
    return choices.reduce(
      (acc, choice) => {
        if (!acc[choice.type]) {
          acc[choice.type] = [];
        }
        acc[choice.type].push(choice);
        return acc;
      },
      {} as Record<string, DiplomaticChoice[]>
    );
  }

  private static calculateConsistency(choices: DiplomaticChoice[]): number {
    if (choices.length < 2) return 0;

    // Calculate how consistent choices are
    // More of the same type = higher consistency
    const typeDistribution = this.groupChoicesByType(choices);
    const entropy = Object.values(typeDistribution).reduce((sum, group) => {
      const p = group.length / choices.length;
      return sum - p * Math.log2(p);
    }, 0);

    // Lower entropy = higher consistency
    const maxEntropy = Math.log2(Object.keys(typeDistribution).length);
    return 1 - entropy / maxEntropy;
  }

  private static calculatePredictability(choices: DiplomaticChoice[]): number {
    if (choices.length < 3) return 50; // Default neutral

    // Look for patterns in choice sequences
    // Similar choices in sequence = more predictable
    let consistentSequences = 0;
    for (let i = 1; i < choices.length; i++) {
      if (choices[i].type === choices[i - 1].type) {
        consistentSequences++;
      }
    }

    return Math.min((consistentSequences / (choices.length - 1)) * 100, 100);
  }

  /**
   * Calculate cultural diplomacy metrics
   * Tracks cultural exchange engagement and success
   */
  private static calculateCulturalMetrics(
    choices: DiplomaticChoice[],
    choicesByType: Record<string, DiplomaticChoice[]>
  ): {
    culturalDiplomacyScore: number;
    exchangeSuccessRate: number;
  } {
    // Count all cultural-related actions (expanded to include new choice types)
    const culturalActions = [
      ...(choicesByType["cultural_exchange"] || []),
      ...(choicesByType["cultural_exchange_initiated"] || []),
      ...(choicesByType["cultural_exchange_joined"] || []),
      ...(choicesByType["cultural_scenario_response"] || []),
      ...(choicesByType["cultural_exchange_success"] || []),
      ...(choicesByType["cultural_exchange_failure"] || []),
      ...(choicesByType["create_cultural_exchange"] || []),
      ...(choicesByType["join_cultural_exchange"] || []),
      ...(choicesByType["complete_cultural_exchange"] || []),
      ...(choicesByType["cancel_cultural_exchange"] || []),
      ...(choicesByType["generate_cultural_scenario"] || []),
      ...(choicesByType["respond_to_cultural_scenario"] || []),
      ...(choicesByType["vote_on_cultural_exchange"] || []),
      ...(choicesByType["upload_cultural_artifact"] || []),
    ];

    const totalCulturalActions = culturalActions.length;
    const totalChoices = Math.max(choices.length, 1);

    // Calculate cultural diplomacy score (0-100)
    // Based on frequency and variety of cultural engagement
    const culturalFrequency = Math.min((totalCulturalActions / totalChoices) * 100, 60); // Max 60 from frequency
    const varietyBonus =
      Object.keys(choicesByType).filter((type) => type.includes("cultural")).length * 8; // +8 per different cultural action type

    const culturalDiplomacyScore = Math.min(culturalFrequency + varietyBonus, 100);

    // Calculate exchange success rate (0-100)
    const successfulExchanges =
      (choicesByType["cultural_exchange_success"] || []).length +
      (choicesByType["complete_cultural_exchange"] || []).length;
    const failedExchanges =
      (choicesByType["cultural_exchange_failure"] || []).length +
      (choicesByType["cancel_cultural_exchange"] || []).length;
    const totalCompleted = successfulExchanges + failedExchanges;

    const exchangeSuccessRate =
      totalCompleted > 0 ? (successfulExchanges / totalCompleted) * 100 : 50; // Default neutral if no completed exchanges

    return {
      culturalDiplomacyScore,
      exchangeSuccessRate,
    };
  }

  private static identifyPatterns(
    choices: DiplomaticChoice[],
    choicesByType: Record<string, DiplomaticChoice[]>,
    culturalMetrics: { culturalDiplomacyScore: number; exchangeSuccessRate: number }
  ): CumulativeEffects["historicalPatterns"] {
    const total = choices.length || 1;

    // Count all cultural-related actions for culturallyActive detection
    const allCulturalActions = [
      ...(choicesByType["cultural_exchange"] || []),
      ...(choicesByType["cultural_exchange_initiated"] || []),
      ...(choicesByType["cultural_exchange_joined"] || []),
      ...(choicesByType["cultural_scenario_response"] || []),
      ...(choicesByType["cultural_exchange_success"] || []),
      ...(choicesByType["cultural_exchange_failure"] || []),
      ...(choicesByType["create_cultural_exchange"] || []),
      ...(choicesByType["join_cultural_exchange"] || []),
      ...(choicesByType["complete_cultural_exchange"] || []),
      ...(choicesByType["generate_cultural_scenario"] || []),
      ...(choicesByType["respond_to_cultural_scenario"] || []),
    ];

    const createdExchanges =
      (choicesByType["create_cultural_exchange"] || []).length +
      (choicesByType["cultural_exchange_initiated"] || []).length;
    const generatedScenarios = (choicesByType["generate_cultural_scenario"] || []).length;

    // Cultural activity determined by:
    // 1. Created 3+ cultural exchanges, OR
    // 2. Has 70%+ completion rate on exchanges AND at least 2 exchanges, OR
    // 3. Generated 2+ cultural scenarios
    const culturallyActive =
      createdExchanges >= 3 ||
      (culturalMetrics.exchangeSuccessRate >= 70 && createdExchanges >= 2) ||
      generatedScenarios >= 2 ||
      culturalMetrics.culturalDiplomacyScore >= 60;

    return {
      favorsAlliances: (choicesByType["alliance_formation"]?.length || 0) / total > 0.2,
      prefersTrade: (choicesByType["trade_agreement"]?.length || 0) / total > 0.25,
      culturallyActive,
      interventionist: (choicesByType["mediation"]?.length || 0) / total > 0.15,
      isolationist: (choicesByType["close_embassy"]?.length || 0) / total > 0.2,
      multilateral:
        choices.filter((c) => c.details.participantCount && c.details.participantCount > 2).length /
          total >
        0.15,
    };
  }

  private static findMutualPartners(
    country1: string,
    country2: string,
    relationships: any[]
  ): string[] {
    const country1Partners = new Set(
      relationships
        .filter((r) => r.country1 === country1 || r.country2 === country1)
        .map((r) => (r.country1 === country1 ? r.country2 : r.country1))
    );

    const country2Partners = new Set(
      relationships
        .filter((r) => r.country1 === country2 || r.country2 === country2)
        .map((r) => (r.country1 === country2 ? r.country2 : r.country1))
    );

    return Array.from(country1Partners).filter((p) => country2Partners.has(p));
  }
}
