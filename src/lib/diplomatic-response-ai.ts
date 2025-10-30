/**
 * Diplomatic Response AI System
 *
 * Intelligent AI system that generates contextual diplomatic events and NPC country responses
 * based on current geopolitical state, player actions, and world dynamics.
 *
 * Design Philosophy:
 * - Events emerge naturally from world state
 * - AI responds to patterns in player behavior
 * - Country personalities influence event types
 * - Geopolitical context drives event generation
 * - Probability-based generation creates organic world feel
 */

import {
  DiplomaticChoiceTracker,
  type DiplomaticChoice,
  type CumulativeEffects,
} from "./diplomatic-choice-tracker";
import { IxTime } from "./ixtime";
import {
  CulturalScenarioGenerator,
  CULTURAL_SCENARIO_TEMPLATES,
  type CulturalScenarioType,
  type ScenarioContext,
} from "./cultural-scenario-generator";
import {
  MarkovDiplomacyEngine,
  type RelationshipState as MarkovRelationshipState,
} from "./diplomatic-markov-engine";

// ==================== TYPES ====================

export interface WorldState {
  countryId: string;
  countryName: string;
  embassies: EmbassyState[];
  relationships: RelationshipState[];
  recentActions: DiplomaticChoice[];
  economicData: EconomicState;
  diplomaticReputation: string;
  activeTreaties: TreatyState[];
}

export interface EmbassyState {
  id: string;
  country: string;
  countryId: string;
  level: number;
  strength: number;
  status: string;
  specialization?: string;
  establishedAt: string;
}

export interface RelationshipState {
  targetCountry: string;
  targetCountryId: string;
  relationship:
    | "alliance"
    | "friendly"
    | "cooperative"
    | "neutral"
    | "cool"
    | "strained"
    | "hostile";
  strength: number; // 0-100
  treaties: string[];
  tradeVolume?: number;
  culturalExchange?: string;
  recentActivity?: string;
}

export interface EconomicState {
  currentGdp: number;
  gdpGrowth: number;
  economicTier: string;
  tradeBalance: number;
  totalTradeVolume: number;
}

export interface TreatyState {
  id: string;
  name: string;
  type: string;
  parties: string[];
  status: string;
  terms?: string;
}

export interface CountryPersonality {
  archetype:
    | "aggressive"
    | "defensive"
    | "mercantile"
    | "diplomatic"
    | "isolationist"
    | "expansionist";
  traits: {
    assertiveness: number; // 0-100
    cooperativeness: number; // 0-100
    economicFocus: number; // 0-100
    culturalOpenness: number; // 0-100
    riskTolerance: number; // 0-100
  };
  historicalBehavior: CumulativeEffects;
}

export interface DiplomaticEvent {
  id: string;
  type:
    | "trade_dispute"
    | "alliance_offer"
    | "cultural_exchange_offer"
    | "cultural_exchange_proposal"
    | "sanction_threat"
    | "crisis_mediation"
    | "treaty_proposal"
    | "economic_cooperation"
    | "security_pact"
    | "border_tension"
    | "intelligence_sharing"
    | "joint_venture"
    | "resource_conflict";
  severity: "info" | "warning" | "critical" | "positive";
  priority: "low" | "medium" | "high" | "urgent";

  fromCountry: string;
  fromCountryId: string;
  toCountryId: string;

  title: string;
  description: string;
  longDescription: string;

  // Event context
  triggers: string[]; // What caused this event
  relatedActions: string[]; // Related player action IDs

  // Player response options
  responseOptions: EventResponseOption[];

  // Consequences preview
  potentialConsequences: {
    accept: string[];
    reject: string[];
    negotiate: string[];
  };

  // Timing
  expiresAt?: string;
  urgency: number; // 0-100

  // Metadata
  aiConfidence: number; // 0-100 - How confident AI is this event fits
  contextualRelevance: number; // 0-100 - How relevant to current situation
  generatedAt: string;
  metadata?: DiplomaticEventMetadata;
}

export interface EventResponseOption {
  id: string;
  label: string;
  description: string;
  expectedOutcome: string;
  risks: string[];
  benefits: string[];
  relationshipImpact: number; // -100 to +100
  economicImpact: number;
  reputationImpact: number;
}

export interface EventGenerationContext {
  worldState: WorldState;
  playerReputation: CumulativeEffects;
  recentPlayerActions: DiplomaticChoice[];
  globalTensions: number; // 0-100
  economicCompetition: number; // 0-100
  allianceNetworks: Map<string, string[]>; // countryId -> allied countries
}

export interface EventProbability {
  eventType: DiplomaticEvent["type"];
  probability: number; // 0-1
  reasoning: string;
  contextFactors: string[];
}

export interface DiplomaticEventMetadata {
  lastFetched: string;
  ixTimeMonth: number;
  recentPlayerActions: Array<{
    id: string;
    type: DiplomaticChoice["type"];
    targetCountry: string;
    targetCountryId: string;
    timestamp: string;
    ixTimeTimestamp: number;
  }>;
}

// ==================== DIPLOMATIC RESPONSE AI ====================

export class DiplomaticResponseAI {
  /**
   * Main method: Analyze world state and generate contextual events
   * Returns events that should be presented to the player
   */
  static analyzeWorldState(worldState: WorldState): DiplomaticEvent[] {
    const context = this.buildEventContext(worldState);
    const playerReputation = DiplomaticChoiceTracker.getCumulativeEffects(
      worldState.countryId,
      worldState.recentActions
    );

    // Calculate event probabilities based on current context
    const eventProbabilities = this.calculateEventProbabilities(context, playerReputation);

    // Generate events based on probabilities
    const potentialEvents: DiplomaticEvent[] = [];

    for (const prob of eventProbabilities) {
      if (this.shouldGenerateEvent(prob.probability, context)) {
        const event = this.generateContextualEvent(prob.eventType, context, playerReputation);
        if (event) {
          potentialEvents.push(event);
        }
      }
    }

    // Prioritize and filter events
    const finalEvents = this.prioritizeEvents(potentialEvents, context);

    return finalEvents.slice(0, 3); // Return top 3 most important events
  }

  /**
   * Calculate probability of each event type occurring
   * Based on world state, player actions, and relationships
   */
  static calculateEventProbabilities(
    context: EventGenerationContext,
    playerReputation: CumulativeEffects
  ): EventProbability[] {
    const probabilities: EventProbability[] = [];
    const { worldState } = context;

    // TRADE DISPUTE - Higher when economic competition exists
    const highTradeRelations = worldState.relationships.filter(
      (r) => r.tradeVolume && r.tradeVolume > 500000
    );
    if (highTradeRelations.length > 0) {
      const tradeDisputeProbability = Math.min(
        0.4,
        (context.economicCompetition / 100) * 0.3 +
          highTradeRelations.length * 0.05 +
          (worldState.economicData.tradeBalance < 0 ? 0.1 : 0)
      );

      probabilities.push({
        eventType: "trade_dispute",
        probability: tradeDisputeProbability,
        reasoning: "High trade volume and economic competition present",
        contextFactors: [
          `${highTradeRelations.length} high-value trade partners`,
          `Trade balance: ${worldState.economicData.tradeBalance}`,
          `Economic competition: ${context.economicCompetition}/100`,
        ],
      });
    }

    // ALLIANCE OFFER - Higher when mutual threats exist or strong relationships present
    const strongRelations = worldState.relationships.filter(
      (r) => r.strength > 75 && r.relationship === "friendly"
    );
    const existingAlliances = worldState.relationships.filter(
      (r) => r.relationship === "alliance"
    ).length;

    if (strongRelations.length > 0 && existingAlliances < 3) {
      const allianceOfferProbability = Math.min(
        0.35,
        strongRelations.length * 0.08 +
          (context.globalTensions / 100) * 0.15 +
          (playerReputation.cooperativeness / 100) * 0.12
      );

      probabilities.push({
        eventType: "alliance_offer",
        probability: allianceOfferProbability,
        reasoning: "Strong relationships and geopolitical tensions create alliance opportunities",
        contextFactors: [
          `${strongRelations.length} friendly relationships above 75% strength`,
          `Global tensions: ${context.globalTensions}/100`,
          `Player cooperativeness: ${playerReputation.cooperativeness}/100`,
        ],
      });
    }

    // CULTURAL EXCHANGE OFFER - Higher with culturally active players
    const embassiesWithoutExchanges = worldState.embassies.filter(
      (e) =>
        e.level >= 2 &&
        !worldState.relationships.find(
          (r) => r.targetCountry === e.country && r.culturalExchange === "High"
        )
    );

    if (embassiesWithoutExchanges.length > 0) {
      const culturalExchangeProbability = Math.min(
        0.45,
        embassiesWithoutExchanges.length * 0.1 +
          (playerReputation.historicalPatterns.culturallyActive ? 0.2 : 0.05) +
          worldState.embassies.filter((e) => e.specialization === "cultural").length * 0.08
      );

      probabilities.push({
        eventType: "cultural_exchange_offer",
        probability: culturalExchangeProbability,
        reasoning: "Embassy presence and cultural openness create opportunities",
        contextFactors: [
          `${embassiesWithoutExchanges.length} embassies without cultural exchanges`,
          `Culturally active player: ${playerReputation.historicalPatterns.culturallyActive}`,
          `Cultural embassies: ${worldState.embassies.filter((e) => e.specialization === "cultural").length}`,
        ],
      });
    }

    // CULTURAL EXCHANGE PROPOSAL - Scenario-based cultural exchange opportunities
    // Higher probability for countries with existing cultural exchanges and good relations
    const culturalExchangePartners = worldState.relationships.filter(
      (r) => r.culturalExchange === "High" && r.strength > 50
    );
    const activeCulturalEmbassies = worldState.embassies.filter(
      (e) => e.specialization === "cultural" && e.level >= 2
    );

    if (culturalExchangePartners.length > 0 || activeCulturalEmbassies.length > 0) {
      const culturalProposalProbability = Math.min(
        0.5,
        culturalExchangePartners.length * 0.12 +
          activeCulturalEmbassies.length * 0.1 +
          (playerReputation.historicalPatterns.culturallyActive ? 0.25 : 0.08) +
          worldState.relationships.filter((r) => r.strength > 70).length * 0.05
      );

      probabilities.push({
        eventType: "cultural_exchange_proposal",
        probability: culturalProposalProbability,
        reasoning:
          "Active cultural programs and strong relationships enable rich scenario-based exchanges",
        contextFactors: [
          `${culturalExchangePartners.length} partners with high cultural exchange`,
          `${activeCulturalEmbassies.length} active cultural embassies`,
          `Culturally active player: ${playerReputation.historicalPatterns.culturallyActive}`,
          `Strong relationships: ${worldState.relationships.filter((r) => r.strength > 70).length}`,
        ],
      });
    }

    // SANCTION THREAT - Higher when relationships deteriorate
    const deterioratingRelations = worldState.relationships.filter(
      (r) => r.strength < 30 && (r.relationship === "strained" || r.relationship === "hostile")
    );

    if (deterioratingRelations.length > 0) {
      const sanctionThreatProbability = Math.min(
        0.3,
        deterioratingRelations.length * 0.12 +
          (playerReputation.aggressiveness / 100) * 0.15 +
          (context.globalTensions / 100) * 0.08
      );

      probabilities.push({
        eventType: "sanction_threat",
        probability: sanctionThreatProbability,
        reasoning: "Deteriorating relationships create sanction risks",
        contextFactors: [
          `${deterioratingRelations.length} strained/hostile relationships`,
          `Player aggressiveness: ${playerReputation.aggressiveness}/100`,
          `Recent embassy closures: ${context.recentPlayerActions.filter((a) => a.type === "close_embassy").length}`,
        ],
      });
    }

    // CRISIS MEDIATION - Higher for interventionist players
    if (playerReputation.historicalPatterns.interventionist && context.globalTensions > 50) {
      const mediationProbability = Math.min(
        0.4,
        (context.globalTensions / 100) * 0.25 +
          (playerReputation.trustLevel / 100) * 0.15 +
          worldState.relationships.filter((r) => r.relationship === "alliance").length * 0.05
      );

      probabilities.push({
        eventType: "crisis_mediation",
        probability: mediationProbability,
        reasoning: "Interventionist reputation and global tensions create mediation opportunities",
        contextFactors: [
          `Global tensions: ${context.globalTensions}/100`,
          `Trust level: ${playerReputation.trustLevel}/100`,
          `Interventionist pattern: ${playerReputation.historicalPatterns.interventionist}`,
        ],
      });
    }

    // TREATY PROPOSAL - Higher for multilateral players
    const potentialTreatyPartners = worldState.relationships.filter(
      (r) => r.strength > 60 && r.treaties.length < 2
    );

    if (potentialTreatyPartners.length > 0) {
      const treatyProbability = Math.min(
        0.38,
        potentialTreatyPartners.length * 0.08 +
          (playerReputation.historicalPatterns.multilateral ? 0.15 : 0.05) +
          (playerReputation.trustLevel / 100) * 0.12
      );

      probabilities.push({
        eventType: "treaty_proposal",
        probability: treatyProbability,
        reasoning: "Strong relationships and trust enable treaty proposals",
        contextFactors: [
          `${potentialTreatyPartners.length} potential treaty partners`,
          `Multilateral player: ${playerReputation.historicalPatterns.multilateral}`,
          `Trust level: ${playerReputation.trustLevel}/100`,
        ],
      });
    }

    // ECONOMIC COOPERATION - Higher for trade-focused players
    if (playerReputation.historicalPatterns.prefersTrade) {
      const cooperationProbability = Math.min(
        0.42,
        (worldState.economicData.gdpGrowth / 10) * 0.15 +
          worldState.relationships.filter((r) => r.tradeVolume && r.tradeVolume > 100000).length *
            0.08 +
          0.12 // Base probability for trade-focused players
      );

      probabilities.push({
        eventType: "economic_cooperation",
        probability: cooperationProbability,
        reasoning: "Trade focus and economic performance attract cooperation proposals",
        contextFactors: [
          `GDP growth: ${worldState.economicData.gdpGrowth}%`,
          `Trade-focused player pattern`,
          `High-value trade relationships: ${worldState.relationships.filter((r) => r.tradeVolume && r.tradeVolume > 100000).length}`,
        ],
      });
    }

    // SECURITY PACT - Higher when alliances exist
    const alliancePartners = worldState.relationships.filter(
      (r) => r.relationship === "alliance" && !r.treaties.includes("Defense Pact")
    );

    if (alliancePartners.length > 0 && context.globalTensions > 40) {
      const securityPactProbability = Math.min(
        0.36,
        alliancePartners.length * 0.12 +
          (context.globalTensions / 100) * 0.18 +
          worldState.embassies.filter((e) => e.specialization === "security").length * 0.06
      );

      probabilities.push({
        eventType: "security_pact",
        probability: securityPactProbability,
        reasoning: "Alliance relationships and security concerns drive pact proposals",
        contextFactors: [
          `${alliancePartners.length} alliances without defense pacts`,
          `Global tensions: ${context.globalTensions}/100`,
          `Security embassies: ${worldState.embassies.filter((e) => e.specialization === "security").length}`,
        ],
      });
    }

    // INTELLIGENCE SHARING - Higher with high-level embassies
    const intelligenceCapableEmbassies = worldState.embassies.filter(
      (e) => e.level >= 3 && e.strength > 65
    );

    if (intelligenceCapableEmbassies.length > 0) {
      const intelligenceProbability = Math.min(
        0.33,
        intelligenceCapableEmbassies.length * 0.11 +
          worldState.relationships.filter((r) => r.relationship === "alliance").length * 0.07 +
          (context.globalTensions / 100) * 0.1
      );

      probabilities.push({
        eventType: "intelligence_sharing",
        probability: intelligenceProbability,
        reasoning: "High-level embassies and alliances enable intelligence cooperation",
        contextFactors: [
          `${intelligenceCapableEmbassies.length} level 3+ embassies`,
          `Alliance count: ${worldState.relationships.filter((r) => r.relationship === "alliance").length}`,
          `Security focus: ${worldState.embassies.filter((e) => e.specialization === "security").length > 0}`,
        ],
      });
    }

    return probabilities.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Generate a contextual diplomatic event
   * Creates realistic event with response options and consequences
   */
  static generateContextualEvent(
    eventType: DiplomaticEvent["type"],
    context: EventGenerationContext,
    playerReputation: CumulativeEffects
  ): DiplomaticEvent | null {
    const { worldState } = context;

    // Select appropriate country to initiate event
    const sourceCountry = this.selectSourceCountry(eventType, worldState);
    if (!sourceCountry) return null;

    // Generate event based on type
    let event: Partial<DiplomaticEvent> = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      fromCountry: sourceCountry.targetCountry,
      fromCountryId: sourceCountry.targetCountryId,
      toCountryId: worldState.countryId,
      generatedAt: new Date().toISOString(),
    };

    // Generate event content based on type
    switch (eventType) {
      case "trade_dispute":
        event = {
          ...event,
          severity: "warning",
          priority: "high",
          title: `Trade Dispute with ${sourceCountry.targetCountry}`,
          description: `${sourceCountry.targetCountry} has raised concerns about trade imbalances and is threatening tariff increases.`,
          longDescription: `Recent trade data shows a significant imbalance in trade flows between our nations. ${sourceCountry.targetCountry} claims unfair competition in key sectors and is considering protective tariffs unless negotiations begin. The dispute affects $${(sourceCountry.tradeVolume || 0).toLocaleString()} in annual trade.`,
          triggers: ["High trade volume", "Economic competition", "Trade imbalance"],
          urgency: 75,
          responseOptions: [
            {
              id: "negotiate",
              label: "Open Negotiations",
              description: "Propose trade talks to address concerns",
              expectedOutcome: "May preserve relationship and trade volume",
              risks: ["Requires concessions", "Time-consuming process"],
              benefits: ["Preserves trade relationship", "Shows good faith"],
              relationshipImpact: 10,
              economicImpact: -50000,
              reputationImpact: 5,
            },
            {
              id: "counter_tariffs",
              label: "Impose Counter-Tariffs",
              description: "Respond with protective measures of your own",
              expectedOutcome: "Trade war escalation likely",
              risks: ["Significant economic damage", "Relationship deterioration"],
              benefits: ["Protects domestic industries", "Shows strength"],
              relationshipImpact: -25,
              economicImpact: -150000,
              reputationImpact: -10,
            },
            {
              id: "make_concessions",
              label: "Make Trade Concessions",
              description: "Accept demands to preserve relationship",
              expectedOutcome: "Dispute resolves quickly",
              risks: ["Economic disadvantage", "Appears weak"],
              benefits: ["Quick resolution", "Relationship improves"],
              relationshipImpact: 20,
              economicImpact: -100000,
              reputationImpact: -5,
            },
          ],
          potentialConsequences: {
            accept: ["Trade relationship preserved", "Economic concessions required"],
            reject: ["Trade war likely", "Relationship severely damaged"],
            negotiate: ["Prolonged negotiations", "Compromise outcome likely"],
          },
        };
        break;

      case "alliance_offer":
        event = {
          ...event,
          severity: "positive",
          priority: "high",
          title: `Alliance Proposal from ${sourceCountry.targetCountry}`,
          description: `${sourceCountry.targetCountry} proposes a formal alliance based on shared interests and mutual cooperation.`,
          longDescription: `After years of positive relations (${sourceCountry.strength}% strength), ${sourceCountry.targetCountry} seeks to formalize our partnership through a strategic alliance. This would include mutual defense commitments, intelligence sharing, and coordinated diplomatic action. The proposal cites shared values and complementary strategic interests.`,
          triggers: ["Strong relationship", "Shared interests", "Geopolitical alignment"],
          urgency: 60,
          responseOptions: [
            {
              id: "accept",
              label: "Accept Alliance",
              description: "Form strategic alliance with full commitments",
              expectedOutcome: "Major diplomatic coup, enhanced security",
              risks: ["Defense obligations", "May antagonize rivals"],
              benefits: ["Mutual defense", "Intelligence sharing", "Diplomatic support"],
              relationshipImpact: 40,
              economicImpact: 50000,
              reputationImpact: 20,
            },
            {
              id: "negotiate",
              label: "Negotiate Terms",
              description: "Discuss limited alliance with specific terms",
              expectedOutcome: "Customized alliance agreement",
              risks: ["May offend if too restrictive", "Prolonged negotiations"],
              benefits: ["Tailored commitments", "Maintains flexibility"],
              relationshipImpact: 20,
              economicImpact: 25000,
              reputationImpact: 10,
            },
            {
              id: "decline",
              label: "Politely Decline",
              description: "Maintain current friendly relationship without alliance",
              expectedOutcome: "Status quo preserved",
              risks: ["Missed opportunity", "Slight relationship damage"],
              benefits: ["Preserves independence", "Avoids obligations"],
              relationshipImpact: -10,
              economicImpact: 0,
              reputationImpact: -5,
            },
          ],
          potentialConsequences: {
            accept: [
              "Strategic alliance formed",
              "Defense obligations incurred",
              "Regional power balance shifts",
            ],
            reject: [
              "Opportunity lost",
              "Relationship cooling possible",
              "Independence maintained",
            ],
            negotiate: [
              "Custom alliance terms",
              "Extended negotiation period",
              "Flexible commitment level",
            ],
          },
        };
        break;

      case "cultural_exchange_offer":
        event = {
          ...event,
          severity: "positive",
          priority: "medium",
          title: `Cultural Exchange Program with ${sourceCountry.targetCountry}`,
          description: `${sourceCountry.targetCountry} proposes an expanded cultural exchange initiative.`,
          longDescription: `Building on our embassy relationship, ${sourceCountry.targetCountry} proposes a comprehensive cultural exchange program including student exchanges, artistic collaborations, and academic partnerships. The program would enhance cultural understanding and strengthen people-to-people ties.`,
          triggers: ["Embassy presence", "Cultural openness", "Positive relations"],
          urgency: 40,
          responseOptions: [
            {
              id: "full_program",
              label: "Launch Full Program",
              description: "Commit to comprehensive cultural exchange",
              expectedOutcome: "Deep cultural ties developed",
              risks: ["Resource allocation", "Administrative complexity"],
              benefits: ["Cultural influence +15", "Relationship strengthens", "Soft power gains"],
              relationshipImpact: 15,
              economicImpact: -25000,
              reputationImpact: 10,
            },
            {
              id: "pilot_program",
              label: "Start Pilot Program",
              description: "Begin with limited exchange initiative",
              expectedOutcome: "Test cultural exchange effectiveness",
              risks: ["Limited impact", "May not meet expectations"],
              benefits: ["Lower cost", "Flexible expansion", "Risk mitigation"],
              relationshipImpact: 8,
              economicImpact: -10000,
              reputationImpact: 5,
            },
            {
              id: "decline",
              label: "Decline Proposal",
              description: "Focus resources elsewhere",
              expectedOutcome: "Resources preserved for other priorities",
              risks: ["Missed cultural opportunity", "Slight disappointment"],
              benefits: ["Resource conservation", "Maintains focus"],
              relationshipImpact: -5,
              economicImpact: 0,
              reputationImpact: 0,
            },
          ],
          potentialConsequences: {
            accept: [
              "Cultural ties deepen",
              "Soft power increases",
              "Long-term relationship benefits",
            ],
            reject: ["Opportunity lost", "Minimal relationship impact", "Resources saved"],
            negotiate: [
              "Balanced program",
              "Moderate resource commitment",
              "Steady cultural gains",
            ],
          },
        };
        break;

      case "cultural_exchange_proposal":
        // Generate rich scenario-based cultural exchange using CulturalScenarioGenerator
        const scenarioContext: ScenarioContext = {
          exchangeId: `exchange_${Date.now()}`,
          exchangeType: "festival", // Default, will be determined by scenario template
          country1: {
            id: worldState.countryId,
            name: worldState.countryName,
            culturalOpenness: playerReputation.historicalPatterns.culturallyActive ? 75 : 50,
            economicStrength: Math.min(100, worldState.economicData.currentGdp / 1000000),
          },
          country2: {
            id: sourceCountry.targetCountryId,
            name: sourceCountry.targetCountry,
            culturalOpenness: 60, // Estimated
            economicStrength: 55, // Estimated
          },
          relationshipState: this.mapToMarkovState(sourceCountry.relationship),
          relationshipStrength: sourceCountry.strength,
          existingExchanges: worldState.relationships.filter((r) => r.culturalExchange === "High")
            .length,
          historicalTensions: sourceCountry.strength < 40,
          economicTies: Math.min(100, (sourceCountry.tradeVolume || 0) / 10000),
        };

        // Select appropriate scenario template based on context
        const template = CulturalScenarioGenerator.selectScenarioTemplate(scenarioContext);
        const culturalScenario = CulturalScenarioGenerator.generateScenario(
          template,
          scenarioContext,
          {
            playerReputation,
            recentPlayerActions: context.recentPlayerActions,
          }
        );

        // Convert scenario response options to event response options
        const scenarioResponseOptions: EventResponseOption[] = culturalScenario.responseOptions.map(
          (option) => ({
            id: option.id,
            label: option.label,
            description: option.description,
            expectedOutcome: option.predictedOutcomes.shortTerm.description,
            risks: option.requirements.map(
              (req) => `Requires ${req.skill} skill level ${req.level}`
            ),
            benefits: [
              `Cultural impact: ${option.predictedOutcomes.immediate.culturalImpact > 0 ? "+" : ""}${option.predictedOutcomes.immediate.culturalImpact}`,
              `Diplomatic change: ${option.predictedOutcomes.immediate.diplomaticChange > 0 ? "+" : ""}${option.predictedOutcomes.immediate.diplomaticChange}`,
            ],
            relationshipImpact: option.predictedOutcomes.immediate.diplomaticChange,
            economicImpact: -option.predictedOutcomes.immediate.economicCost * 1000,
            reputationImpact: Math.floor(option.predictedOutcomes.immediate.culturalImpact / 5),
          })
        );

        event = {
          ...event,
          severity: template.diplomaticRisk > 60 ? "warning" : "positive",
          priority: template.diplomaticRisk > 60 ? "high" : "medium",
          title: culturalScenario.title,
          description: culturalScenario.narrative.substring(0, 200) + "...",
          longDescription: culturalScenario.narrative,
          triggers: [
            "Active cultural exchange programs",
            `Strong relationship (${sourceCountry.strength}%)`,
            template.name,
          ],
          urgency: template.diplomaticRisk,
          responseOptions: scenarioResponseOptions,
          potentialConsequences: {
            accept: [
              culturalScenario.responseOptions[0]?.predictedOutcomes.longTerm.description ||
                "Positive cultural outcome",
              `Cultural benefit: ${culturalScenario.responseOptions[0]?.predictedOutcomes.longTerm.culturalBenefit || 50}%`,
              `Diplomatic benefit: ${culturalScenario.responseOptions[0]?.predictedOutcomes.longTerm.diplomaticBenefit || 50}%`,
            ],
            reject: [
              "Cultural exchange opportunity lost",
              "Relationship may cool slightly",
              "Resources preserved",
            ],
            negotiate: [
              "Compromise outcome based on scenario complexity",
              "Moderate cultural and diplomatic gains",
              "Balanced resource commitment",
            ],
          },
          aiConfidence: 85,
          contextualRelevance: 80 + (playerReputation.historicalPatterns.culturallyActive ? 15 : 0),
        };
        break;

      case "sanction_threat":
        event = {
          ...event,
          severity: "critical",
          priority: "urgent",
          title: `Sanction Threat from ${sourceCountry.targetCountry}`,
          description: `${sourceCountry.targetCountry} threatens economic sanctions unless diplomatic grievances are addressed.`,
          longDescription: `Citing deteriorating relations (${sourceCountry.strength}% strength) and recent diplomatic tensions, ${sourceCountry.targetCountry} has issued a formal warning of impending economic sanctions. They demand immediate diplomatic engagement to address their concerns or face coordinated punitive measures.`,
          triggers: ["Deteriorating relationship", "Recent tensions", "Diplomatic grievances"],
          urgency: 90,
          responseOptions: [
            {
              id: "diplomatic_engagement",
              label: "Immediate Diplomatic Engagement",
              description: "Send high-level delegation to address concerns",
              expectedOutcome: "De-escalation likely if concessions made",
              risks: ["May require significant concessions", "Shows vulnerability"],
              benefits: ["Avoids sanctions", "Preserves economic ties"],
              relationshipImpact: 15,
              economicImpact: -50000,
              reputationImpact: -5,
            },
            {
              id: "stand_firm",
              label: "Stand Firm",
              description: "Refuse to negotiate under threat",
              expectedOutcome: "Sanctions likely implemented",
              risks: ["Economic damage", "Relationship collapse"],
              benefits: ["Maintains principled stance", "No concessions"],
              relationshipImpact: -30,
              economicImpact: -200000,
              reputationImpact: 10,
            },
            {
              id: "counter_coalition",
              label: "Build Counter-Coalition",
              description: "Rally allies against sanction threat",
              expectedOutcome: "Regional conflict possible",
              risks: ["Escalation", "Polarizes regional relations"],
              benefits: ["Shows strength", "Allies demonstrate support"],
              relationshipImpact: -20,
              economicImpact: -75000,
              reputationImpact: 15,
            },
          ],
          potentialConsequences: {
            accept: ["Sanctions avoided", "Concessions required", "Crisis resolved"],
            reject: ["Sanctions implemented", "Economic damage", "Relationship collapse"],
            negotiate: ["Partial sanctions possible", "Regional tensions rise", "Allies engaged"],
          },
        };
        break;

      case "crisis_mediation":
        event = {
          ...event,
          severity: "warning",
          priority: "high",
          title: `Mediation Request: Regional Crisis`,
          description: `Multiple countries request your mediation in an escalating regional dispute.`,
          longDescription: `Given your reputation as a trusted diplomatic partner (${playerReputation.trustLevel}/100 trust), you have been asked to mediate a growing crisis between regional powers. Your involvement could prevent escalation, but failure would damage your diplomatic standing.`,
          triggers: ["Interventionist reputation", "High trust level", "Regional tensions"],
          urgency: 80,
          responseOptions: [
            {
              id: "accept_mediation",
              label: "Accept Mediation Role",
              description: "Lead diplomatic efforts to resolve crisis",
              expectedOutcome: "Regional leadership opportunity",
              risks: ["Mediation failure damages reputation", "Resource intensive"],
              benefits: ["Enhanced regional influence", "Reputation boost if successful"],
              relationshipImpact: 25,
              economicImpact: -30000,
              reputationImpact: 30,
            },
            {
              id: "limited_involvement",
              label: "Limited Support Role",
              description: "Provide assistance without leading mediation",
              expectedOutcome: "Moderate engagement",
              risks: ["Limited influence on outcome", "Half measures may fail"],
              benefits: ["Lower risk", "Some diplomatic credit"],
              relationshipImpact: 10,
              economicImpact: -10000,
              reputationImpact: 10,
            },
            {
              id: "decline",
              label: "Decline Involvement",
              description: "Focus on national priorities",
              expectedOutcome: "Neutrality preserved",
              risks: ["Reputation as mediator damaged", "Regional influence reduced"],
              benefits: ["Resources preserved", "No mediation risks"],
              relationshipImpact: -10,
              economicImpact: 0,
              reputationImpact: -15,
            },
          ],
          potentialConsequences: {
            accept: [
              "Regional leadership gained",
              "Success enhances influence dramatically",
              "Failure damages reputation",
            ],
            reject: ["Mediator reputation lost", "Crisis continues", "Resources saved"],
            negotiate: [
              "Moderate engagement",
              "Shared mediation responsibility",
              "Limited risk and reward",
            ],
          },
        };
        break;

      default:
        return null;
    }

    // Calculate AI confidence and contextual relevance
    event.aiConfidence = this.calculateAIConfidence(eventType, context);
    event.contextualRelevance = this.calculateContextualRelevance(
      eventType,
      context,
      playerReputation
    );
    event.metadata = {
      lastFetched: new Date().toISOString(),
      ixTimeMonth: IxTime.getMonthFromTimestamp(IxTime.getCurrentIxTime()),
      recentPlayerActions: context.recentPlayerActions.slice(-5).map((action) => ({
        id: action.id,
        type: action.type,
        targetCountry: action.targetCountry,
        targetCountryId: action.targetCountryId,
        timestamp: action.timestamp,
        ixTimeTimestamp: action.ixTimeTimestamp,
      })),
    };

    return event as DiplomaticEvent;
  }

  /**
   * Decide if event should be generated based on probability and context
   */
  static shouldGenerateEvent(probability: number, context: EventGenerationContext): boolean {
    // Random roll weighted by probability
    const roll = Math.random();

    // Reduce probability if too many recent events
    const recentEventCount = context.recentPlayerActions.length;
    const eventFatigue = Math.max(0, (recentEventCount - 10) * 0.05);
    const adjustedProbability = Math.max(0, probability - eventFatigue);

    // Generate if roll is below adjusted probability
    return roll < adjustedProbability;
  }

  /**
   * Prioritize events by importance and urgency
   */
  static prioritizeEvents(
    events: DiplomaticEvent[],
    context: EventGenerationContext
  ): DiplomaticEvent[] {
    return events.sort((a, b) => {
      // Priority weights
      const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
      const severityWeight = { critical: 4, warning: 3, positive: 2, info: 1 };

      const scoreA =
        priorityWeight[a.priority] * 2 +
        severityWeight[a.severity] * 1.5 +
        a.urgency / 100 +
        a.contextualRelevance / 100 +
        a.aiConfidence / 100;

      const scoreB =
        priorityWeight[b.priority] * 2 +
        severityWeight[b.severity] * 1.5 +
        b.urgency / 100 +
        b.contextualRelevance / 100 +
        b.aiConfidence / 100;

      return scoreB - scoreA;
    });
  }

  // ==================== HELPER METHODS ====================

  /**
   * Build comprehensive event generation context
   */
  private static buildEventContext(worldState: WorldState): EventGenerationContext {
    // Calculate global tensions based on relationship quality
    const hostileRelations = worldState.relationships.filter(
      (r) => r.relationship === "hostile" || r.relationship === "strained"
    ).length;
    const globalTensions = Math.min(
      100,
      hostileRelations * 20 + worldState.relationships.filter((r) => r.strength < 30).length * 10
    );

    // Calculate economic competition
    const highTradeCompetitors = worldState.relationships.filter(
      (r) => r.tradeVolume && r.tradeVolume > 300000 && r.strength < 60
    ).length;
    const economicCompetition = Math.min(
      100,
      highTradeCompetitors * 25 + (worldState.economicData.tradeBalance < 0 ? 20 : 0)
    );

    // Build alliance networks
    const allianceNetworks = new Map<string, string[]>();
    worldState.relationships
      .filter((r) => r.relationship === "alliance")
      .forEach((r) => {
        if (!allianceNetworks.has(worldState.countryId)) {
          allianceNetworks.set(worldState.countryId, []);
        }
        allianceNetworks.get(worldState.countryId)!.push(r.targetCountryId);
      });

    return {
      worldState,
      playerReputation: DiplomaticChoiceTracker.getCumulativeEffects(
        worldState.countryId,
        worldState.recentActions
      ),
      recentPlayerActions: worldState.recentActions.slice(-20), // Last 20 actions
      globalTensions,
      economicCompetition,
      allianceNetworks,
    };
  }

  /**
   * Select appropriate source country for event type
   */
  private static selectSourceCountry(
    eventType: DiplomaticEvent["type"],
    worldState: WorldState
  ): RelationshipState | null {
    let candidates: RelationshipState[] = [];

    switch (eventType) {
      case "trade_dispute":
        candidates = worldState.relationships.filter(
          (r) => r.tradeVolume && r.tradeVolume > 500000
        );
        break;

      case "alliance_offer":
        candidates = worldState.relationships.filter(
          (r) => r.strength > 75 && r.relationship === "friendly"
        );
        break;

      case "cultural_exchange_offer":
        candidates = worldState.relationships.filter(
          (r) => r.strength > 60 && worldState.embassies.some((e) => e.country === r.targetCountry)
        );
        break;

      case "sanction_threat":
        candidates = worldState.relationships.filter(
          (r) => r.strength < 30 && (r.relationship === "strained" || r.relationship === "hostile")
        );
        break;

      case "crisis_mediation":
        // For mediation, select a neutral/positive relationship
        candidates = worldState.relationships.filter((r) => r.strength > 50);
        break;

      default:
        candidates = worldState.relationships.filter((r) => r.strength > 40);
    }

    // Return random candidate from filtered list
    return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  }

  /**
   * Calculate AI confidence in event appropriateness
   */
  private static calculateAIConfidence(
    eventType: DiplomaticEvent["type"],
    context: EventGenerationContext
  ): number {
    // Base confidence on available data
    const dataQuality =
      (context.worldState.embassies.length > 0 ? 20 : 0) +
      (context.worldState.relationships.length > 3 ? 20 : 0) +
      (context.recentPlayerActions.length > 5 ? 20 : 0) +
      (context.worldState.activeTreaties.length > 0 ? 20 : 0);

    // Add event-specific confidence
    let eventSpecificConfidence = 50;

    switch (eventType) {
      case "trade_dispute":
        eventSpecificConfidence = context.worldState.economicData.tradeBalance !== 0 ? 80 : 50;
        break;
      case "alliance_offer":
        eventSpecificConfidence = context.globalTensions > 30 ? 85 : 60;
        break;
      case "cultural_exchange_offer":
        eventSpecificConfidence = context.worldState.embassies.length > 2 ? 90 : 70;
        break;
    }

    return Math.min(95, (dataQuality + eventSpecificConfidence) / 2);
  }

  /**
   * Calculate how relevant event is to current context
   */
  private static calculateContextualRelevance(
    eventType: DiplomaticEvent["type"],
    context: EventGenerationContext,
    playerReputation: CumulativeEffects
  ): number {
    let relevance = 50; // Base relevance

    // Increase relevance based on player behavior patterns
    switch (eventType) {
      case "trade_dispute":
        relevance += playerReputation.historicalPatterns.prefersTrade ? 25 : 0;
        relevance += context.economicCompetition > 50 ? 20 : 0;
        break;

      case "alliance_offer":
        relevance += playerReputation.historicalPatterns.favorsAlliances ? 30 : 0;
        relevance += context.globalTensions > 60 ? 25 : 0;
        break;

      case "cultural_exchange_offer":
        relevance += playerReputation.historicalPatterns.culturallyActive ? 35 : 0;
        break;

      case "cultural_exchange_proposal":
        relevance += playerReputation.historicalPatterns.culturallyActive ? 40 : 0;
        relevance +=
          context.worldState.relationships.filter((r) => r.culturalExchange === "High").length > 2
            ? 25
            : 0;
        break;

      case "crisis_mediation":
        relevance += playerReputation.historicalPatterns.interventionist ? 40 : 0;
        break;
    }

    return Math.min(100, relevance);
  }

  /**
   * Infer country personality from relationship data and behavior
   * Used for more sophisticated event generation
   */
  static inferCountryPersonality(
    countryId: string,
    relationships: RelationshipState[],
    historicalActions: DiplomaticChoice[]
  ): CountryPersonality {
    // Analyze relationship patterns
    const avgStrength =
      relationships.reduce((sum, r) => sum + r.strength, 0) / Math.max(relationships.length, 1);
    const allianceCount = relationships.filter((r) => r.relationship === "alliance").length;
    const hostileCount = relationships.filter(
      (r) => r.relationship === "hostile" || r.relationship === "strained"
    ).length;
    const tradeRelations = relationships.filter(
      (r) => r.tradeVolume && r.tradeVolume > 100000
    ).length;

    // Calculate personality traits
    const assertiveness = Math.min(
      100,
      hostileCount * 20 + relationships.filter((r) => r.strength < 40).length * 10 + 30 // Base assertiveness
    );

    const cooperativeness = Math.min(
      100,
      allianceCount * 15 +
        avgStrength / 2 +
        relationships.filter(
          (r) => r.relationship === "friendly" || r.relationship === "cooperative"
        ).length *
          8
    );

    const economicFocus = Math.min(
      100,
      tradeRelations * 15 +
        relationships.filter((r) => r.treaties?.includes("Trade Agreement")).length * 12 +
        20 // Base economic focus
    );

    const culturalOpenness = Math.min(
      100,
      relationships.filter((r) => r.culturalExchange === "High").length * 20 + 40 // Base openness
    );

    const riskTolerance = Math.min(
      100,
      hostileCount * 15 + relationships.filter((r) => r.strength < 30).length * 10 + 50 // Base tolerance
    );

    // Determine archetype
    let archetype: CountryPersonality["archetype"] = "diplomatic";

    if (assertiveness > 70 && riskTolerance > 70) {
      archetype = "aggressive";
    } else if (cooperativeness < 40 && relationships.length < 3) {
      archetype = "isolationist";
    } else if (economicFocus > 75) {
      archetype = "mercantile";
    } else if (cooperativeness > 80) {
      archetype = "diplomatic";
    } else if (allianceCount > 3 && assertiveness > 60) {
      archetype = "expansionist";
    } else if (assertiveness < 40 && cooperativeness > 60) {
      archetype = "defensive";
    }

    return {
      archetype,
      traits: {
        assertiveness,
        cooperativeness,
        economicFocus,
        culturalOpenness,
        riskTolerance,
      },
      historicalBehavior: DiplomaticChoiceTracker.getCumulativeEffects(
        countryId,
        historicalActions
      ),
    };
  }

  /**
   * Map relationship states to Markov relationship states
   */
  private static mapToMarkovState(
    relationship: RelationshipState["relationship"]
  ): MarkovRelationshipState {
    const stateMap: Record<RelationshipState["relationship"], MarkovRelationshipState> = {
      hostile: "hostile",
      strained: "tense",
      cool: "tense",
      neutral: "neutral",
      cooperative: "friendly",
      friendly: "friendly",
      alliance: "allied",
    };

    return stateMap[relationship] || "neutral";
  }
}
