/**
 * Diplomatic Scenario Generator
 *
 * Creates rich, narrative diplomatic scenarios that emerge from world state.
 * Provides meaningful player choices with predicted consequences.
 *
 * Design Philosophy:
 * - Scenarios emerge naturally from world conditions
 * - Every choice matters (no throwaway options)
 * - Narrative quality > mechanical complexity
 * - Historical context enriches player decisions
 * - Risk/reward balance creates tension
 */

import {
  DiplomaticChoiceTracker,
  type DiplomaticChoice,
  type CumulativeEffects,
} from "./diplomatic-choice-tracker";

// ==================== TYPES ====================

export type ScenarioType =
  | "border_dispute"
  | "trade_renegotiation"
  | "cultural_misunderstanding"
  | "intelligence_breach"
  | "humanitarian_crisis"
  | "alliance_pressure"
  | "economic_sanctions_debate"
  | "technology_transfer_request"
  | "diplomatic_incident"
  | "mediation_opportunity"
  | "embassy_security_threat"
  | "treaty_renewal";

export type DiplomaticSkill =
  | "negotiation"
  | "intimidation"
  | "persuasion"
  | "compromise"
  | "firmness"
  | "empathy";

export type TimeFrame = "urgent" | "time_sensitive" | "strategic" | "long_term";

export type DifficultyLevel = "trivial" | "moderate" | "challenging" | "critical" | "legendary";

export interface ScenarioChoice {
  id: string;
  label: string;
  description: string;
  skillRequired: DiplomaticSkill;
  skillLevel: number; // 1-10 difficulty
  riskLevel: "low" | "medium" | "high" | "extreme";
  predictedOutcomes: {
    shortTerm: string; // Immediate consequences (1-7 days)
    mediumTerm: string; // Mid-range effects (1-3 months)
    longTerm: string; // Lasting impact (6+ months)
  };
  effects: {
    relationshipChange: number; // -100 to +100
    economicImpact: number; // -100 to +100
    reputationChange: number; // -50 to +50
    securityImpact: number; // -100 to +100
  };
  requirements?: {
    minimumEmbassyLevel?: number;
    minimumBudget?: number;
    requiredRelationshipLevel?: number;
  };
}

export interface DiplomaticScenario {
  id: string;
  type: ScenarioType;
  title: string;
  narrative: {
    introduction: string;
    context: string;
    situation: string;
    implications: string;
    urgency?: string;
  };
  involvedCountries: {
    primary: string; // Main country involved
    secondary?: string[]; // Other affected countries
  };
  historicalContext: string[];
  timeFrame: TimeFrame;
  expiresAt?: Date; // When decision must be made
  difficulty: DifficultyLevel;
  recommendedEmbassyLevel: number;
  choices: ScenarioChoice[];
  metadata: {
    triggeredBy: string; // What world condition triggered this
    relevanceScore: number; // 0-100 how relevant to player
    playerReputation?: CumulativeEffects;
    recentPlayerActions?: Array<
      Pick<
        DiplomaticChoice,
        "id" | "type" | "targetCountry" | "targetCountryId" | "timestamp" | "ixTimeTimestamp"
      >
    >;
    lastFetched?: number;
  };
}

export interface WorldContext {
  playerCountryId: string;
  playerCountryName: string;
  embassies: Array<{
    id: string;
    hostCountryId: string;
    guestCountryId: string;
    level: number;
    status: string;
    influence: number;
    reputation: number;
    specialization?: string;
  }>;
  relationships: Array<{
    country1: string;
    country2: string;
    relationship: string;
    strength: number;
    status: string;
  }>;
  treaties: Array<{
    id: string;
    name: string;
    parties: string;
    type: string;
    status: string;
    expiryDate: Date;
  }>;
  recentMissions: Array<{
    embassyId: string;
    type: string;
    success: boolean;
    completedAt: Date;
  }>;
  diplomaticHistory: DiplomaticChoice[];
  economicData?: {
    playerGDP: number;
    playerTier: string;
  };
}

export interface CountryData {
  id: string;
  name: string;
  flag?: string;
  economicTier: string;
  region?: string;
  governmentType?: string;
}

// ==================== SCENARIO TEMPLATES ====================

interface ScenarioTemplate {
  type: ScenarioType;
  weight: number; // Probability weight
  triggerConditions: (context: WorldContext) => boolean;
  generate: (context: WorldContext, targetCountry: CountryData) => DiplomaticScenario;
}

// ==================== GENERATOR CLASS ====================

export class DiplomaticScenarioGenerator {
  private templates: ScenarioTemplate[] = [];

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate scenarios based on current world state
   * Returns prioritized list of available scenarios
   */
  generateScenarios(
    context: WorldContext,
    countries: CountryData[],
    maxScenarios: number = 3
  ): DiplomaticScenario[] {
    const scenarios: DiplomaticScenario[] = [];

    // Calculate player's diplomatic profile
    const playerProfile = DiplomaticChoiceTracker.getCumulativeEffects(
      context.playerCountryId,
      context.diplomaticHistory
    );

    // Evaluate each template
    for (const template of this.templates) {
      // Check if conditions are met
      if (!template.triggerConditions(context)) {
        continue;
      }

      // Find suitable target countries
      const eligibleCountries = this.findEligibleCountries(context, countries, template.type);

      // Generate scenario for most relevant country
      if (eligibleCountries.length > 0) {
        const targetCountry = eligibleCountries[0];
        const scenario = template.generate(context, targetCountry);

        // Enrich with player reputation
        scenario.metadata.playerReputation = playerProfile;
        scenario.metadata.recentPlayerActions = context.diplomaticHistory
          .slice(-5)
          .map((action) => ({
            id: action.id,
            type: action.type,
            targetCountry: action.targetCountry,
            targetCountryId: action.targetCountryId,
            timestamp: action.timestamp,
            ixTimeTimestamp: action.ixTimeTimestamp,
          }));
        scenario.metadata.lastFetched = Date.now();

        // Calculate relevance score
        scenario.metadata.relevanceScore = this.calculateRelevance(
          scenario,
          context,
          playerProfile
        );

        scenarios.push(scenario);
      }
    }

    // Sort by relevance and return top scenarios
    return scenarios
      .sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore)
      .slice(0, maxScenarios);
  }

  /**
   * Generate a specific scenario type
   */
  generateSpecificScenario(
    type: ScenarioType,
    context: WorldContext,
    targetCountry: CountryData
  ): DiplomaticScenario | null {
    const template = this.templates.find((t) => t.type === type);
    if (!template) return null;

    if (!template.triggerConditions(context)) {
      return null;
    }

    return template.generate(context, targetCountry);
  }

  // ==================== PRIVATE METHODS ====================

  private initializeTemplates(): void {
    this.templates = [
      this.createBorderDisputeTemplate(),
      this.createTradeRenegotiationTemplate(),
      this.createCulturalMisunderstandingTemplate(),
      this.createIntelligenceBreachTemplate(),
      this.createHumanitarianCrisisTemplate(),
      this.createAlliancePressureTemplate(),
      this.createEconomicSanctionsDebateTemplate(),
      this.createTechnologyTransferTemplate(),
      this.createDiplomaticIncidentTemplate(),
      this.createMediationOpportunityTemplate(),
      this.createEmbassySecurityThreatTemplate(),
      this.createTreatyRenewalTemplate(),
    ];
  }

  // ==================== SCENARIO TEMPLATES ====================

  private createBorderDisputeTemplate(): ScenarioTemplate {
    return {
      type: "border_dispute",
      weight: 1.0,
      triggerConditions: (context) => {
        // Trigger if we have tense relations with neighbors
        return context.relationships.some(
          (r) => (r.relationship === "tension" || r.relationship === "hostile") && r.strength < 30
        );
      },
      generate: (context, target) => {
        const relationship = context.relationships.find(
          (r) => r.country1 === target.id || r.country2 === target.id
        );

        const embassy = context.embassies.find(
          (e) => e.hostCountryId === target.id || e.guestCountryId === target.id
        );

        return {
          id: `scenario_border_${Date.now()}`,
          type: "border_dispute",
          title: `Border Tensions Escalate with ${target.name}`,
          narrative: {
            introduction: `Intelligence reports indicate increased military activity along the border region shared with ${target.name}. Local commanders report unauthorized incursions and disputed territorial claims over a resource-rich valley.`,
            context: `Historical tensions between our nations have long centered on this contested border region. ${target.name}'s recent ${target.economicTier} economic expansion has increased their interest in the area's natural resources.`,
            situation: `${target.name}'s foreign ministry has issued a formal statement claiming historical rights to the disputed territory, citing maps from their colonial period. Meanwhile, our border patrols report three incidents of unauthorized crossings in the past week. Local populations on both sides are growing increasingly anxious, and nationalist sentiment is rising.`,
            implications: `How we respond will set the tone for our relationship with ${target.name} for years to come. Military posturing could escalate into conflict, while appearing weak might embolden further territorial claims. The international community is watching closely.`,
            urgency: `Border commanders are requesting clear rules of engagement. A decision is needed within 48 hours.`,
          },
          involvedCountries: {
            primary: target.id,
            secondary: relationship
              ? [relationship.country1, relationship.country2].filter((c) => c !== target.id)
              : [],
          },
          historicalContext: [
            `Border demarcation has been disputed since colonial withdrawal`,
            `Previous skirmishes in the region occurred during economic downturns`,
            `International arbitration was attempted in the past but failed to produce lasting agreement`,
            embassy
              ? `Our embassy in ${target.name} has ${embassy.level >= 3 ? "strong" : "limited"} influence to facilitate dialogue`
              : `We lack diplomatic presence in ${target.name}, limiting our negotiation channels`,
          ],
          timeFrame: "urgent",
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
          difficulty: "critical",
          recommendedEmbassyLevel: 3,
          choices: [
            {
              id: "border_military_show",
              label: "Military Deterrence",
              description:
                "Deploy additional forces to the border as a show of strength and resolve",
              skillRequired: "firmness",
              skillLevel: 7,
              riskLevel: "extreme",
              predictedOutcomes: {
                shortTerm: `${target.name} will view this as provocation. Regional tensions escalate immediately. International observers express concern.`,
                mediumTerm: `Arms race may develop. Economic cooperation freezes. Risk of accidental escalation remains high for months.`,
                longTerm: `If successful deterrence, establishes credible defense posture. If fails, could trigger actual conflict with lasting consequences.`,
              },
              effects: {
                relationshipChange: -40,
                economicImpact: -25,
                reputationChange: 15, // Seen as strong
                securityImpact: 30, // Improves security posture
              },
            },
            {
              id: "border_negotiate",
              label: "Diplomatic Negotiation",
              description: "Propose immediate bilateral talks with international mediation",
              skillRequired: "negotiation",
              skillLevel: 6,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `${target.name} agrees to talks, de-escalating immediate crisis. Both sides pull back from border.`,
                mediumTerm: `Negotiations prove difficult but prevent escalation. Compromise solution may emerge over resource sharing.`,
                longTerm: `Could establish framework for permanent border settlement and improved relations, or negotiations could stall indefinitely.`,
              },
              effects: {
                relationshipChange: 20,
                economicImpact: 10,
                reputationChange: 10, // Seen as diplomatic
                securityImpact: -10, // Short-term security concerns
              },
              requirements: {
                minimumEmbassyLevel: 2,
              },
            },
            {
              id: "border_international",
              label: "International Arbitration",
              description: "Escalate to international courts and multilateral organizations",
              skillRequired: "persuasion",
              skillLevel: 8,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Issue moves to international stage. ${target.name} forced to defend claims publicly. Immediate tensions pause.`,
                mediumTerm: `Legal proceedings take months. International pressure builds on both sides to maintain peace during arbitration.`,
                longTerm: `Court ruling provides legitimate settlement, though losing party may refuse to comply. Creates precedent for future disputes.`,
              },
              effects: {
                relationshipChange: -15,
                economicImpact: -5,
                reputationChange: 25, // Seen as principled
                securityImpact: 15,
              },
              requirements: {
                minimumEmbassyLevel: 3,
                requiredRelationshipLevel: 20,
              },
            },
            {
              id: "border_joint_development",
              label: "Joint Development Zone",
              description: "Propose shared sovereignty and joint resource exploitation",
              skillRequired: "compromise",
              skillLevel: 9,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Creative solution surprises ${target.name}. Nationalist hardliners on both sides object, but pragmatists see economic benefits.`,
                mediumTerm: `Joint administration established. Revenue sharing begins. Sets precedent for cooperative approach to disputes.`,
                longTerm: `Could transform contentious border into zone of cooperation. Economic benefits cement peace. Model for other disputed regions.`,
              },
              effects: {
                relationshipChange: 35,
                economicImpact: 40,
                reputationChange: 30, // Seen as innovative
                securityImpact: 25,
              },
              requirements: {
                minimumEmbassyLevel: 4,
                minimumBudget: 500000,
              },
            },
          ],
          metadata: {
            triggeredBy: "Tense relationship with neighboring country",
            relevanceScore: 85,
          },
        };
      },
    };
  }

  private createTradeRenegotiationTemplate(): ScenarioTemplate {
    return {
      type: "trade_renegotiation",
      weight: 1.2,
      triggerConditions: (context) => {
        // Trigger if we have active trade relationships
        return context.relationships.some((r) => r.relationship === "trade" && r.strength > 40);
      },
      generate: (context, target) => {
        const relationship = context.relationships.find(
          (r) =>
            (r.country1 === target.id || r.country2 === target.id) && r.relationship === "trade"
        );

        const tradeVolume = 500000000; // Default trade volume

        return {
          id: `scenario_trade_${Date.now()}`,
          type: "trade_renegotiation",
          title: `${target.name} Seeks Trade Agreement Revision`,
          narrative: {
            introduction: `${target.name}'s Ministry of Commerce has formally requested renegotiation of our bilateral trade agreement, which currently governs $${(tradeVolume / 1000000).toFixed(0)}M in annual commerce.`,
            context: `As a ${target.economicTier} economy, ${target.name} has experienced significant economic shifts since our original agreement was signed. Their domestic industries now face different competitive pressures, and they seek updated terms to reflect current realities.`,
            situation: `Specifically, ${target.name} is requesting: (1) reduced tariffs on their agricultural exports, (2) increased quotas for manufactured goods, and (3) new provisions for digital services. In exchange, they offer improved market access for our technology sector and financial services. However, these changes would impact approximately 50,000 jobs in our agricultural regions.`,
            implications: `Our response will affect not just this trade relationship, but signal our broader approach to economic diplomacy. Domestic agricultural lobbies are already mobilizing opposition, while our tech sector sees opportunities for expansion.`,
          },
          involvedCountries: {
            primary: target.id,
          },
          historicalContext: [
            `Current trade agreement has been in force for 7 years`,
            `Original negotiations took 14 months and were contentious`,
            `Trade volume has grown 35% since agreement signed`,
            `Both economies have evolved significantly in intervening period`,
          ],
          timeFrame: "time_sensitive",
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
          difficulty: "challenging",
          recommendedEmbassyLevel: 3,
          choices: [
            {
              id: "trade_accept_terms",
              label: "Accept Proposed Terms",
              description: "Agree to their requests with minimal modifications",
              skillRequired: "compromise",
              skillLevel: 4,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `${target.name} celebrates diplomatic success. Our agricultural sector protests. Tech companies begin planning expansion.`,
                mediumTerm: `Trade volume increases 20%. Job losses in agriculture offset by gains in tech sector. Domestic political pressure builds.`,
                longTerm: `Stronger economic ties with ${target.name}. Economic restructuring pain subsides. Sets precedent for future negotiations.`,
              },
              effects: {
                relationshipChange: 35,
                economicImpact: 15,
                reputationChange: -10, // Seen as capitulating
                securityImpact: 0,
              },
            },
            {
              id: "trade_counter_offer",
              label: "Strategic Counter-Proposal",
              description: "Accept some requests but negotiate hard on key sectors",
              skillRequired: "negotiation",
              skillLevel: 7,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Extended negotiations begin. Both sides stake out positions. Minor concessions exchanged to build goodwill.`,
                mediumTerm: `Balanced agreement emerges protecting key domestic interests while expanding opportunities. Both sides claim victory.`,
                longTerm: `Demonstrates sophisticated negotiation capacity. Strengthens relationship while protecting vital interests.`,
              },
              effects: {
                relationshipChange: 20,
                economicImpact: 25,
                reputationChange: 20, // Seen as skilled negotiator
                securityImpact: 5,
              },
              requirements: {
                minimumEmbassyLevel: 3,
              },
            },
            {
              id: "trade_reject",
              label: "Reject Renegotiation",
              description: "Insist current agreement remains fair and balanced",
              skillRequired: "firmness",
              skillLevel: 5,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `${target.name} expresses disappointment. Trade relations cool. They begin exploring alternative markets.`,
                mediumTerm: `Trade volume stagnates or declines. ${target.name} shifts focus to other partners. Domestic industries protected but opportunities lost.`,
                longTerm: `Relationship weakens. May miss window for mutually beneficial cooperation. Other trading partners gain ground.`,
              },
              effects: {
                relationshipChange: -25,
                economicImpact: -15,
                reputationChange: 5, // Seen as protecting interests
                securityImpact: -5,
              },
            },
            {
              id: "trade_expand_scope",
              label: "Propose Comprehensive Partnership",
              description: "Suggest broader economic integration beyond just trade",
              skillRequired: "persuasion",
              skillLevel: 8,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Ambitious proposal catches ${target.name} by surprise. Requires extensive study and domestic consultation on both sides.`,
                mediumTerm: `If accepted, establishes framework for deep economic integration. Investment flows increase. Regulatory harmonization begins.`,
                longTerm: `Could create powerful economic bloc. Transforms relationship from transactional to strategic. Significant domestic restructuring required.`,
              },
              effects: {
                relationshipChange: 40,
                economicImpact: 45,
                reputationChange: 30, // Seen as visionary
                securityImpact: 15,
              },
              requirements: {
                minimumEmbassyLevel: 4,
                minimumBudget: 750000,
              },
            },
          ],
          metadata: {
            triggeredBy: "Active trade relationship with shifting economic conditions",
            relevanceScore: 70,
          },
        };
      },
    };
  }

  private createCulturalMisunderstandingTemplate(): ScenarioTemplate {
    return {
      type: "cultural_misunderstanding",
      weight: 0.8,
      triggerConditions: (context) => {
        // Trigger if we have cultural exchange programs
        return context.recentMissions.some((m) => m.type === "cultural_exchange");
      },
      generate: (context, target) => {
        return {
          id: `scenario_cultural_${Date.now()}`,
          type: "cultural_misunderstanding",
          title: `Cultural Incident Strains Relations with ${target.name}`,
          narrative: {
            introduction: `A cultural exhibition from our national museum, currently on tour in ${target.name}, has sparked unexpected controversy and diplomatic complications.`,
            context: `The exhibition, "Crossroads of Civilizations," was intended to celebrate shared historical ties and promote cultural understanding. However, certain artifacts and their contextual descriptions have been interpreted by ${target.name}'s public as culturally insensitive and historically inaccurate.`,
            situation: `Social media in ${target.name} has erupted with criticism. Several prominent historians and cultural figures have called for the exhibition to be closed. The government of ${target.name} has requested we either modify the exhibition or withdraw it entirely. Our cultural ministry insists the exhibition is historically accurate and academically sound. Meanwhile, our embassy staff are facing protests outside the exhibition venue.`,
            implications: `Cultural diplomacy is a cornerstone of soft power. How we handle this situation will affect not just our relationship with ${target.name}, but our broader reputation for cultural sensitivity and respect.`,
          },
          involvedCountries: {
            primary: target.id,
          },
          historicalContext: [
            `Our nations have complex shared history dating back centuries`,
            `Cultural exchange programs have generally been positive`,
            `Previous exhibitions have been well-received in both countries`,
            `Social media has amplified cultural controversies in recent years`,
          ],
          timeFrame: "urgent",
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          difficulty: "moderate",
          recommendedEmbassyLevel: 2,
          choices: [
            {
              id: "cultural_apologize",
              label: "Issue Formal Apology",
              description: "Apologize for offense and modify exhibition content",
              skillRequired: "empathy",
              skillLevel: 5,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Controversy subsides. ${target.name} appreciates responsiveness. Domestic critics accuse us of capitulating to political pressure.`,
                mediumTerm: `Modified exhibition continues with reduced controversy. Cultural ties resume positive trajectory. Sets precedent for handling future incidents.`,
                longTerm: `Relationship strengthened by demonstrated cultural sensitivity. May limit future cultural programming to avoid controversy.`,
              },
              effects: {
                relationshipChange: 25,
                economicImpact: 0,
                reputationChange: -5, // Domestic critics
                securityImpact: 0,
              },
            },
            {
              id: "cultural_dialogue",
              label: "Organize Academic Dialogue",
              description: "Host joint academic forum to discuss historical interpretations",
              skillRequired: "persuasion",
              skillLevel: 6,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Announcement of dialogue reduces immediate pressure. Scholars from both countries agree to participate. Exhibition continues during discussions.`,
                mediumTerm: `Dialogue produces nuanced understanding of different historical perspectives. Joint statement acknowledges complexity of shared history.`,
                longTerm: `Creates model for addressing cultural differences through scholarly exchange. Strengthens academic ties. Exhibition becomes case study in cultural diplomacy.`,
              },
              effects: {
                relationshipChange: 30,
                economicImpact: 5,
                reputationChange: 20, // Seen as thoughtful
                securityImpact: 0,
              },
              requirements: {
                minimumEmbassyLevel: 2,
              },
            },
            {
              id: "cultural_defend",
              label: "Defend Academic Freedom",
              description: "Refuse modifications, citing historical accuracy and free expression",
              skillRequired: "firmness",
              skillLevel: 7,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `Controversy intensifies. ${target.name} government faces domestic pressure. Exhibition may be forced to close anyway.`,
                mediumTerm: `Cultural relations damaged. Future exchange programs face additional scrutiny. Domestic audiences appreciate principled stance.`,
                longTerm: `May establish important precedent for cultural independence, but at cost of near-term relationship damage.`,
              },
              effects: {
                relationshipChange: -30,
                economicImpact: -10,
                reputationChange: 15, // Seen as principled domestically
                securityImpact: 0,
              },
            },
            {
              id: "cultural_collaborative",
              label: "Joint Curation Initiative",
              description:
                "Propose collaboration with local scholars to recontextualize exhibition",
              skillRequired: "compromise",
              skillLevel: 8,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Creative solution welcomed. Scholars from ${target.name} join curatorial team. Exhibition temporarily paused for revision.`,
                mediumTerm: `Revised exhibition presents multiple perspectives. Becomes model of collaborative cultural diplomacy. Both countries claim success.`,
                longTerm: `Establishes framework for future cultural collaborations. Strengthens people-to-people ties. Demonstrates soft power sophistication.`,
              },
              effects: {
                relationshipChange: 40,
                economicImpact: 10,
                reputationChange: 25, // Seen as innovative
                securityImpact: 5,
              },
              requirements: {
                minimumEmbassyLevel: 3,
                minimumBudget: 100000,
              },
            },
          ],
          metadata: {
            triggeredBy: "Active cultural exchange program",
            relevanceScore: 60,
          },
        };
      },
    };
  }

  private createIntelligenceBreachTemplate(): ScenarioTemplate {
    return {
      type: "intelligence_breach",
      weight: 0.6,
      triggerConditions: (context) => {
        // Trigger if we have intelligence operations
        return context.embassies.some((e) => e.specialization === "intelligence" && e.level >= 3);
      },
      generate: (context, target) => {
        const embassy = context.embassies.find(
          (e) =>
            (e.hostCountryId === target.id || e.guestCountryId === target.id) &&
            e.specialization === "intelligence"
        );

        return {
          id: `scenario_intel_${Date.now()}`,
          type: "intelligence_breach",
          title: `Intelligence Operation Exposed in ${target.name}`,
          narrative: {
            introduction: `Classified diplomatic cables have been leaked to ${target.name}'s media, revealing details of our intelligence-gathering operations conducted through our embassy.`,
            context: `The leaked documents describe routine intelligence activities that most nations conduct through diplomatic channels. However, the public disclosure has created a political firestorm in ${target.name}, where opposition parties are demanding government response.`,
            situation: `${target.name}'s Foreign Ministry has summoned our ambassador for an explanation. Their security services have increased surveillance of our embassy staff. Three of our diplomatic personnel have been declared "persona non grata" and must leave within 48 hours. The leak appears to have come from a source within their own government, possibly as a political maneuver, but our operations are nonetheless exposed.`,
            implications: `How we respond will affect our intelligence capabilities throughout the region. Other countries are watching to see if we admit to intelligence activities or maintain deniability. Our relationship with ${target.name} hangs in the balance.`,
            urgency: `We must respond before the 48-hour deadline for diplomatic expulsions.`,
          },
          involvedCountries: {
            primary: target.id,
          },
          historicalContext: [
            `Our embassy has maintained ${embassy?.level || 3}-level presence for years`,
            `Intelligence cooperation has been standard practice between nations`,
            `${target.name} conducts similar activities in our country`,
            `Leak timing suggests internal political motivations`,
          ],
          timeFrame: "urgent",
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
          difficulty: "critical",
          recommendedEmbassyLevel: 4,
          choices: [
            {
              id: "intel_deny",
              label: "Categorical Denial",
              description: "Deny all allegations and claim documents are fabricated",
              skillRequired: "firmness",
              skillLevel: 6,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `${target.name} unconvinced. Expulsions proceed. Media skeptical of denial. Domestic audience divided.`,
                mediumTerm: `Intelligence operations severely curtailed. Trust damaged. However, official deniability maintained for future operations.`,
                longTerm: `Relationship recovers slowly. Intelligence capabilities take years to rebuild. Precedent set for plausible deniability.`,
              },
              effects: {
                relationshipChange: -35,
                economicImpact: -15,
                reputationChange: -10,
                securityImpact: -30,
              },
            },
            {
              id: "intel_acknowledge",
              label: "Limited Acknowledgment",
              description: "Acknowledge routine diplomatic information gathering, not espionage",
              skillRequired: "negotiation",
              skillLevel: 8,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Honesty surprises ${target.name}. Reduces political pressure as we admit what everyone does. Expulsions may be reduced.`,
                mediumTerm: `Relationship enters period of recalibration. New protocols established for intelligence cooperation. Sets realistic expectations.`,
                longTerm: `Could lead to formalized intelligence-sharing agreement. Transparency builds unexpected trust. Both sides benefit.`,
              },
              effects: {
                relationshipChange: 10,
                economicImpact: -5,
                reputationChange: 15, // Seen as honest
                securityImpact: -15,
              },
              requirements: {
                minimumEmbassyLevel: 3,
              },
            },
            {
              id: "intel_counter",
              label: "Reciprocal Exposures",
              description: "Threaten to expose their intelligence activities in our country",
              skillRequired: "intimidation",
              skillLevel: 7,
              riskLevel: "extreme",
              predictedOutcomes: {
                shortTerm: `Tit-for-tat escalation. Both countries begin expelling diplomats. Intelligence war threatens broader relationship.`,
                mediumTerm: `Mutual recriminations damage relationship severely. Intelligence operations on both sides disrupted. Other countries avoid getting involved.`,
                longTerm: `Extended period of hostile relations. Intelligence capabilities degraded on both sides. May take years to normalize.`,
              },
              effects: {
                relationshipChange: -60,
                economicImpact: -30,
                reputationChange: -20,
                securityImpact: -40,
              },
            },
            {
              id: "intel_cooperative",
              label: "Propose Intelligence Partnership",
              description:
                "Turn crisis into opportunity by proposing formal intelligence cooperation",
              skillRequired: "persuasion",
              skillLevel: 10,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Bold proposal stuns ${target.name}. Requires high-level consultations. Expulsions paused pending discussions.`,
                mediumTerm: `If successful, establishes unprecedented intelligence-sharing framework. Transforms competitive intelligence gathering into cooperation.`,
                longTerm: `Could create powerful intelligence alliance. Requires significant trust-building. Sets new paradigm for intelligence diplomacy.`,
              },
              effects: {
                relationshipChange: 45,
                economicImpact: 10,
                reputationChange: 35, // Seen as innovative
                securityImpact: 50,
              },
              requirements: {
                minimumEmbassyLevel: 4,
                requiredRelationshipLevel: 40,
              },
            },
          ],
          metadata: {
            triggeredBy: "High-level intelligence operations exposed",
            relevanceScore: 80,
          },
        };
      },
    };
  }

  private createHumanitarianCrisisTemplate(): ScenarioTemplate {
    return {
      type: "humanitarian_crisis",
      weight: 0.7,
      triggerConditions: (context) => {
        // Can trigger at any time (natural disasters are unpredictable)
        return context.embassies.length > 0;
      },
      generate: (context, target) => {
        return {
          id: `scenario_humanitarian_${Date.now()}`,
          type: "humanitarian_crisis",
          title: `Natural Disaster Strikes ${target.name}`,
          narrative: {
            introduction: `A devastating earthquake measuring 7.8 on the Richter scale has struck ${target.name}, causing widespread destruction in their capital city and surrounding regions.`,
            context: `Early reports indicate thousands of casualties, with many more trapped under collapsed buildings. ${target.name}'s emergency services are overwhelmed. The disaster has knocked out power, water, and communications infrastructure across affected areas.`,
            situation: `${target.name}'s government has issued an international appeal for assistance. Search and rescue teams, medical supplies, temporary shelter, and financial aid are urgently needed. Several nations have already pledged support. Our diplomatic relations with ${target.name} have been ${this.describeRelationship(context, target.id)}, and how we respond will be noted both by them and the international community.`,
            implications: `Humanitarian assistance transcends normal diplomatic calculations, but also creates opportunities for building goodwill. The scale and speed of our response will be remembered long after the immediate crisis passes.`,
            urgency: `The first 72 hours are critical for search and rescue operations.`,
          },
          involvedCountries: {
            primary: target.id,
            secondary: context.embassies.map((e) => e.hostCountryId),
          },
          historicalContext: [
            `${target.name} is located in a seismically active region`,
            `Previous disasters have tested international cooperation`,
            `Our nation has capabilities in disaster response and medical aid`,
            `Other nations are also mobilizing assistance`,
          ],
          timeFrame: "urgent",
          expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
          difficulty: "moderate",
          recommendedEmbassyLevel: 1,
          choices: [
            {
              id: "humanitarian_limited",
              label: "Token Assistance",
              description: "Send symbolic aid and offer condolences",
              skillRequired: "empathy",
              skillLevel: 3,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `${target.name} acknowledges assistance. Fulfills minimum international obligation. Other nations provide more substantial aid.`,
                mediumTerm: `Minimal impact on ground. ${target.name} remembers our limited response. Other donors gain diplomatic advantage.`,
                longTerm: `Missed opportunity for building goodwill. Relationship remains transactional rather than transforming.`,
              },
              effects: {
                relationshipChange: 5,
                economicImpact: -2,
                reputationChange: -5,
                securityImpact: 0,
              },
            },
            {
              id: "humanitarian_substantial",
              label: "Comprehensive Relief Package",
              description:
                "Deploy search and rescue teams, medical aid, and significant financial assistance",
              skillRequired: "empathy",
              skillLevel: 6,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Our rescue teams save lives in critical first hours. Medical supplies reach hospitals. ${target.name} expresses deep gratitude.`,
                mediumTerm: `Sustained assistance aids recovery. Our flag visible on relief supplies throughout affected areas. Builds genuine goodwill.`,
                longTerm: `Humanitarian response remembered as defining moment in bilateral relations. Creates emotional bond beyond political calculations.`,
              },
              effects: {
                relationshipChange: 40,
                economicImpact: -20,
                reputationChange: 30,
                securityImpact: 10,
              },
              requirements: {
                minimumBudget: 500000,
              },
            },
            {
              id: "humanitarian_coordinate",
              label: "Lead International Coordination",
              description: "Organize and coordinate multilateral relief effort",
              skillRequired: "persuasion",
              skillLevel: 8,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Assume leadership role in coordinating international response. Multiple nations contribute under our coordination framework.`,
                mediumTerm: `Effective coordination maximizes impact of all aid. Demonstrates organizational capability and humanitarian leadership.`,
                longTerm: `Enhances international reputation significantly. Creates network of grateful nations. Sets precedent for future crisis response.`,
              },
              effects: {
                relationshipChange: 50,
                economicImpact: -15,
                reputationChange: 45,
                securityImpact: 20,
              },
              requirements: {
                minimumEmbassyLevel: 3,
                minimumBudget: 750000,
              },
            },
            {
              id: "humanitarian_conditional",
              label: "Aid with Conditions",
              description: "Offer assistance tied to specific diplomatic concessions",
              skillRequired: "negotiation",
              skillLevel: 5,
              riskLevel: "extreme",
              predictedOutcomes: {
                shortTerm: `${target.name} outraged at conditional aid during crisis. International condemnation. Severe reputational damage.`,
                mediumTerm: `Relationship poisoned for years. Even if conditions accepted, resentment festers. Other nations distance themselves.`,
                longTerm: `Permanent damage to humanitarian reputation. Used as example of exploitative diplomacy. Strategic loss far exceeds any tactical gains.`,
              },
              effects: {
                relationshipChange: -70,
                economicImpact: 10,
                reputationChange: -60,
                securityImpact: -30,
              },
            },
          ],
          metadata: {
            triggeredBy: "Natural disaster in partner country",
            relevanceScore: 75,
          },
        };
      },
    };
  }

  private createAlliancePressureTemplate(): ScenarioTemplate {
    return {
      type: "alliance_pressure",
      weight: 0.9,
      triggerConditions: (context) => {
        // Trigger if we have multiple alliance relationships
        const alliances = context.relationships.filter((r) => r.relationship === "alliance");
        return alliances.length >= 2;
      },
      generate: (context, target) => {
        const alliances = context.relationships.filter((r) => r.relationship === "alliance");
        const rival = alliances.find((a) => a.country1 !== target.id && a.country2 !== target.id);

        return {
          id: `scenario_alliance_${Date.now()}`,
          type: "alliance_pressure",
          title: `Competing Alliance Obligations Create Dilemma`,
          narrative: {
            introduction: `Our alliance partner ${target.name} has requested our support in a diplomatic dispute with another country. However, we also maintain close relations with their opponent, creating conflicting obligations.`,
            context: `${target.name} and ${rival?.country1 || "a regional power"} have been locked in an escalating trade dispute that threatens to spill over into broader confrontation. Both are calling on their respective partners to demonstrate solidarity.`,
            situation: `${target.name} specifically requests we: (1) issue a joint statement supporting their position, (2) coordinate economic pressure on their opponent, and (3) reduce our own diplomatic engagement with the rival power. They frame this as a test of our alliance commitment. Meanwhile, our relationship with the other side represents significant economic interests and regional stability concerns.`,
            implications: `We cannot satisfy both parties. Our choice will define which relationship we prioritize and may force us to reconsider our network of alliances. Third parties are watching to see if our commitments are reliable.`,
          },
          involvedCountries: {
            primary: target.id,
            secondary: [rival?.country1 || "", rival?.country2 || ""].filter(Boolean),
          },
          historicalContext: [
            `Our alliance with ${target.name} has been cornerstone of foreign policy`,
            `Relations with both parties have been cultivated over years`,
            `Previous attempts to remain neutral in regional disputes have failed`,
            `The dispute between them has historical roots`,
          ],
          timeFrame: "time_sensitive",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
          difficulty: "critical",
          recommendedEmbassyLevel: 4,
          choices: [
            {
              id: "alliance_support",
              label: "Stand with Alliance Partner",
              description: "Fully support our alliance partner as requested",
              skillRequired: "firmness",
              skillLevel: 6,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `${target.name} celebrates our loyalty. Other relationship deteriorates rapidly. Regional tensions escalate.`,
                mediumTerm: `Alliance strengthened significantly. Economic losses from damaged relationship. Region becomes more polarized.`,
                longTerm: `Establishes reputation for keeping alliance commitments. However, strategic flexibility reduced. May be called on for further support.`,
              },
              effects: {
                relationshipChange: 50,
                economicImpact: -30,
                reputationChange: 25,
                securityImpact: 20,
              },
            },
            {
              id: "alliance_neutral",
              label: "Maintain Neutrality",
              description: "Refuse to take sides, attempt to preserve both relationships",
              skillRequired: "compromise",
              skillLevel: 8,
              riskLevel: "extreme",
              predictedOutcomes: {
                shortTerm: `Both sides express disappointment. ${target.name} questions our alliance value. Trust damaged with both parties.`,
                mediumTerm: `Relationships with both weaken. Alliance partner may seek more reliable partners. Isolation risk increases.`,
                longTerm: `Reputation for unreliability. May be excluded from future coalitions. Strategic independence but potential isolation.`,
              },
              effects: {
                relationshipChange: -25,
                economicImpact: -10,
                reputationChange: -30,
                securityImpact: -25,
              },
            },
            {
              id: "alliance_mediate",
              label: "Active Mediation",
              description: "Use our unique position to mediate the underlying dispute",
              skillRequired: "persuasion",
              skillLevel: 10,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Both sides skeptical but agree to talks. We facilitate direct dialogue. Immediate crisis de-escalates.`,
                mediumTerm: `If successful, mediation resolves dispute and strengthens both relationships. If fails, may damage both relationships.`,
                longTerm: `Success establishes us as credible mediator and regional stabilizer. Failure leaves us isolated and distrusted.`,
              },
              effects: {
                relationshipChange: 35,
                economicImpact: 15,
                reputationChange: 40,
                securityImpact: 30,
              },
              requirements: {
                minimumEmbassyLevel: 4,
                requiredRelationshipLevel: 50,
              },
            },
            {
              id: "alliance_restructure",
              label: "Propose Alliance Restructuring",
              description: "Suggest all parties join broader multilateral framework",
              skillRequired: "negotiation",
              skillLevel: 9,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Ambitious proposal requires extensive consultations. Immediate pressure relieved while framework debated.`,
                mediumTerm: `If adopted, transforms bilateral tensions into multilateral cooperation. All parties gain face-saving solution.`,
                longTerm: `Could create new regional security architecture. Demonstrates diplomatic innovation. May take years to fully implement.`,
              },
              effects: {
                relationshipChange: 30,
                economicImpact: 20,
                reputationChange: 35,
                securityImpact: 40,
              },
              requirements: {
                minimumEmbassyLevel: 5,
                minimumBudget: 1000000,
              },
            },
          ],
          metadata: {
            triggeredBy: "Conflicting alliance obligations",
            relevanceScore: 90,
          },
        };
      },
    };
  }

  private createEconomicSanctionsDebateTemplate(): ScenarioTemplate {
    return {
      type: "economic_sanctions_debate",
      weight: 0.8,
      triggerConditions: (context) => {
        // Trigger if we have relationships with both friendly and tense countries
        const friendly = context.relationships.filter((r) => r.strength > 60).length;
        const tense = context.relationships.filter((r) => r.strength < 40).length;
        return friendly > 0 && tense > 0;
      },
      generate: (context, target) => {
        const hostileRelation = context.relationships.find(
          (r) => r.relationship === "hostile" || r.relationship === "tension"
        );

        return {
          id: `scenario_sanctions_${Date.now()}`,
          type: "economic_sanctions_debate",
          title: `${target.name} Proposes Joint Sanctions Against Third Country`,
          narrative: {
            introduction: `${target.name} is organizing an international coalition to impose economic sanctions on ${hostileRelation?.country1 || "a regional power"} and has requested our participation.`,
            context: `The targeted country has recently engaged in actions that ${target.name} and several other nations deem violations of international norms. The proposed sanctions would restrict trade, freeze assets, and limit financial transactions.`,
            situation: `${target.name} argues the sanctions are necessary to uphold international law and deter further violations. They've mobilized significant international support. However, we maintain $${Math.floor(Math.random() * 500 + 100)}M in annual trade with the sanctioned country, and joining sanctions would cost thousands of jobs in our export sector. Additionally, the targeted country has threatened counter-sanctions against any participants.`,
            implications: `This is fundamentally a choice between economic interests and international solidarity. Our decision will signal our foreign policy priorities and affect our standing with multiple countries.`,
          },
          involvedCountries: {
            primary: target.id,
            secondary: hostileRelation ? [hostileRelation.country1, hostileRelation.country2] : [],
          },
          historicalContext: [
            `Sanctions have mixed record of achieving stated objectives`,
            `Economic costs typically fall on civilian populations`,
            `International coalitions require broad participation to be effective`,
            `Counter-sanctions can escalate economic warfare`,
          ],
          timeFrame: "time_sensitive",
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
          difficulty: "challenging",
          recommendedEmbassyLevel: 3,
          choices: [
            {
              id: "sanctions_join",
              label: "Join Sanctions Coalition",
              description: "Participate fully in the proposed sanctions regime",
              skillRequired: "firmness",
              skillLevel: 6,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `${target.name} welcomes our participation. Trade with sanctioned country halts. Counter-sanctions imposed on us.`,
                mediumTerm: `Economic pain from lost trade and counter-sanctions. Domestic criticism from affected industries. International reputation for principled stance.`,
                longTerm: `If sanctions succeed, validates our choice. If they fail, economic costs without strategic gains. Relationship with sanctioned country severely damaged.`,
              },
              effects: {
                relationshipChange: 40,
                economicImpact: -35,
                reputationChange: 20,
                securityImpact: 10,
              },
            },
            {
              id: "sanctions_symbolic",
              label: "Symbolic Participation",
              description: "Join coalition but implement only limited sanctions",
              skillRequired: "negotiation",
              skillLevel: 7,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `${target.name} disappointed but accepts our limited participation. Sanctioned country moderately annoyed but grateful for restraint.`,
                mediumTerm: `Balancing act maintains relationships with both sides. Neither fully satisfied. Economic impact minimized.`,
                longTerm: `Seen as pragmatic but uncommitted. May be excluded from future coalitions. Maintains strategic flexibility.`,
              },
              effects: {
                relationshipChange: 15,
                economicImpact: -10,
                reputationChange: 5,
                securityImpact: 0,
              },
            },
            {
              id: "sanctions_refuse",
              label: "Refuse Participation",
              description: "Decline to join sanctions, prioritize economic interests",
              skillRequired: "firmness",
              skillLevel: 5,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `${target.name} expresses strong disappointment. Coalition members question our commitment to shared values. Sanctioned country grateful.`,
                mediumTerm: `Trade continues uninterrupted. Relationship with ${target.name} cools significantly. May benefit from others' sanctions as trade diverted to us.`,
                longTerm: `Reputation for prioritizing commerce over principles. Isolated from Western bloc but maintains diverse partnerships.`,
              },
              effects: {
                relationshipChange: -35,
                economicImpact: 20,
                reputationChange: -15,
                securityImpact: -10,
              },
            },
            {
              id: "sanctions_alternative",
              label: "Propose Diplomatic Alternative",
              description:
                "Suggest targeted diplomatic pressure instead of broad economic sanctions",
              skillRequired: "persuasion",
              skillLevel: 9,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `${target.name} and coalition skeptical but willing to consider alternative approach. Buys time for diplomatic solution.`,
                mediumTerm: `If diplomacy succeeds, avoids economic damage while achieving goals. If fails, we may be forced to join sanctions anyway.`,
                longTerm: `Success establishes reputation for effective diplomacy. Failure may damage credibility and force belated sanctions participation.`,
              },
              effects: {
                relationshipChange: 20,
                economicImpact: 10,
                reputationChange: 25,
                securityImpact: 15,
              },
              requirements: {
                minimumEmbassyLevel: 4,
                requiredRelationshipLevel: 50,
              },
            },
          ],
          metadata: {
            triggeredBy: "International sanctions coalition formation",
            relevanceScore: 75,
          },
        };
      },
    };
  }

  private createTechnologyTransferTemplate(): ScenarioTemplate {
    return {
      type: "technology_transfer_request",
      weight: 0.7,
      triggerConditions: (context) => {
        // Trigger if we have higher-tier economy or research specialization
        return (
          context.economicData?.playerTier === "developed" ||
          context.embassies.some((e) => e.specialization === "research")
        );
      },
      generate: (context, target) => {
        return {
          id: `scenario_tech_${Date.now()}`,
          type: "technology_transfer_request",
          title: `${target.name} Requests Advanced Technology Transfer`,
          narrative: {
            introduction: `${target.name} has formally requested access to our advanced ${this.randomTechnology()} technology through a collaborative development agreement.`,
            context: `As a ${target.economicTier} economy, ${target.name} seeks to accelerate their technological capabilities. They propose a partnership where we transfer key technologies in exchange for market access, shared research facilities, and co-development rights.`,
            situation: `Specifically, they want: (1) licensing of our core patents, (2) training programs for their engineers, and (3) joint manufacturing facilities. In return, they offer: (1) preferential market access for our products, (2) cost-sharing on future R&D, and (3) access to their specialized research capabilities. Our defense and technology sectors are concerned about intellectual property protection and potential strategic implications of technology transfer.`,
            implications: `This represents a fundamental choice about our approach to technology leadership: maintain competitive advantages through exclusivity, or accelerate global development through sharing. The decision will affect our economic competitiveness and strategic position.`,
          },
          involvedCountries: {
            primary: target.id,
          },
          historicalContext: [
            `Technology transfer has historically accelerated development but raised security concerns`,
            `Previous agreements have sometimes resulted in intellectual property disputes`,
            `${target.name} has invested heavily in research infrastructure`,
            `Our technology sector leads globally in this field`,
          ],
          timeFrame: "strategic",
          difficulty: "challenging",
          recommendedEmbassyLevel: 4,
          choices: [
            {
              id: "tech_full_transfer",
              label: "Comprehensive Partnership",
              description: "Agree to full technology transfer with extensive collaboration",
              skillRequired: "compromise",
              skillLevel: 7,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `${target.name} celebrates breakthrough agreement. Technology sector protests potential competitive disadvantage. Joint facilities established.`,
                mediumTerm: `${target.name}'s capabilities improve rapidly. Shared R&D produces innovations. Some domestic jobs move to joint facilities.`,
                longTerm: `Creates powerful technology partnership. ${target.name} becomes peer competitor in some areas. Economic integration deepens significantly.`,
              },
              effects: {
                relationshipChange: 50,
                economicImpact: 30,
                reputationChange: 20,
                securityImpact: -15,
              },
              requirements: {
                minimumEmbassyLevel: 4,
                minimumBudget: 1000000,
              },
            },
            {
              id: "tech_limited",
              label: "Conditional Licensing",
              description: "License technology with strict controls and oversight",
              skillRequired: "negotiation",
              skillLevel: 8,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `${target.name} accepts conditional terms. Detailed legal framework negotiated. Technology sector cautiously supportive.`,
                mediumTerm: `Controlled technology transfer proceeds. Robust IP protections maintained. Market access benefits realized.`,
                longTerm: `Balances economic opportunity with security concerns. Sets precedent for managed technology cooperation.`,
              },
              effects: {
                relationshipChange: 30,
                economicImpact: 20,
                reputationChange: 15,
                securityImpact: 0,
              },
              requirements: {
                minimumEmbassyLevel: 3,
              },
            },
            {
              id: "tech_refuse",
              label: "Decline Transfer",
              description: "Refuse technology transfer to maintain competitive advantage",
              skillRequired: "firmness",
              skillLevel: 6,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `${target.name} disappointed. Seeks technology from other sources. Domestic technology sector relieved.`,
                mediumTerm: `${target.name} develops alternative partnerships. We maintain technology lead but miss market opportunities.`,
                longTerm: `Competitive advantage preserved short-term. However, ${target.name} may leapfrog with alternative technologies.`,
              },
              effects: {
                relationshipChange: -25,
                economicImpact: -10,
                reputationChange: 5,
                securityImpact: 10,
              },
            },
            {
              id: "tech_multilateral",
              label: "Multilateral Research Consortium",
              description: "Propose broader international research collaboration",
              skillRequired: "persuasion",
              skillLevel: 9,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Ambitious proposal to include multiple nations. ${target.name} interested but wants guarantees of access. Requires extensive negotiation.`,
                mediumTerm: `If successful, creates international research consortium. Spreads costs and benefits across multiple nations.`,
                longTerm: `Could accelerate global innovation while protecting individual interests. Establishes new model for technology cooperation.`,
              },
              effects: {
                relationshipChange: 35,
                economicImpact: 35,
                reputationChange: 40,
                securityImpact: 15,
              },
              requirements: {
                minimumEmbassyLevel: 5,
                minimumBudget: 1500000,
              },
            },
          ],
          metadata: {
            triggeredBy: "Advanced technology capabilities",
            relevanceScore: 70,
          },
        };
      },
    };
  }

  private createDiplomaticIncidentTemplate(): ScenarioTemplate {
    return {
      type: "diplomatic_incident",
      weight: 0.6,
      triggerConditions: (context) => {
        // Can happen with any embassy relationship
        return context.embassies.length > 0;
      },
      generate: (context, target) => {
        return {
          id: `scenario_incident_${Date.now()}`,
          type: "diplomatic_incident",
          title: `Embassy Staff Arrested in ${target.name}`,
          narrative: {
            introduction: `Two members of our embassy staff in ${target.name} have been detained by local authorities on allegations of "activities incompatible with diplomatic status."`,
            context: `The detained staff members were reportedly conducting routine consular services when they were apprehended. ${target.name}'s security services claim they were gathering sensitive information without authorization.`,
            situation: `Our ambassador has been denied consular access to the detained staff for 72 hours, violating Vienna Convention protocols. ${target.name}'s government has issued a 48-hour deadline for us to "acknowledge the misconduct" or face further diplomatic consequences. The incident coincides with a broader political crackdown in ${target.name}, suggesting our staff may be pawns in an internal power struggle.`,
            implications: `Diplomatic immunity and staff safety are fundamental principles. How we respond will affect not only this situation but the safety of our diplomatic personnel worldwide. However, escalation could endanger the detained staff.`,
            urgency: `Deadline for response expires in 48 hours. Detained staff welfare is at risk.`,
          },
          involvedCountries: {
            primary: target.id,
          },
          historicalContext: [
            `Vienna Convention protects diplomatic personnel worldwide`,
            `${target.name} has history of using foreign diplomats as political leverage`,
            `Previous incidents resolved through quiet diplomacy`,
            `Domestic politics in ${target.name} currently unstable`,
          ],
          timeFrame: "urgent",
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
          difficulty: "critical",
          recommendedEmbassyLevel: 3,
          choices: [
            {
              id: "incident_strong",
              label: "Demand Immediate Release",
              description: "Issue ultimatum threatening severe consequences",
              skillRequired: "intimidation",
              skillLevel: 8,
              riskLevel: "extreme",
              predictedOutcomes: {
                shortTerm: `${target.name} hardens position. Detained staff face formal charges. Diplomatic crisis escalates rapidly.`,
                mediumTerm: `Extended detention possible. May require months of negotiation. Bilateral relations severely damaged.`,
                longTerm: `If successful through pressure, establishes we protect our people. If fails, staff remain detained and relationship destroyed.`,
              },
              effects: {
                relationshipChange: -50,
                economicImpact: -20,
                reputationChange: 20, // Seen as protecting citizens
                securityImpact: -15,
              },
            },
            {
              id: "incident_negotiate",
              label: "Quiet Diplomacy",
              description: "Engage in confidential negotiations for staff release",
              skillRequired: "negotiation",
              skillLevel: 7,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Back-channel communications initiated. ${target.name} signals willingness to resolve quietly if given face-saving exit.`,
                mediumTerm: `Staff released after "investigation concludes no wrongdoing." Both sides avoid public confrontation.`,
                longTerm: `Pragmatic resolution preserves relationship. However, may encourage future incidents if seen as weakness.`,
              },
              effects: {
                relationshipChange: -10,
                economicImpact: -5,
                reputationChange: 5,
                securityImpact: 10,
              },
              requirements: {
                minimumEmbassyLevel: 2,
              },
            },
            {
              id: "incident_reciprocal",
              label: "Reciprocal Detention",
              description: "Detain their diplomatic staff in our country as leverage",
              skillRequired: "intimidation",
              skillLevel: 6,
              riskLevel: "extreme",
              predictedOutcomes: {
                shortTerm: `Tit-for-tat escalation. Both countries detain each other's diplomats. International condemnation of both sides.`,
                mediumTerm: `Hostage diplomacy ensues. Extended negotiations to exchange detained personnel. Relationships poisoned.`,
                longTerm: `Even after resolution, trust destroyed. May take years to normalize. Sets dangerous precedent.`,
              },
              effects: {
                relationshipChange: -60,
                economicImpact: -30,
                reputationChange: -25,
                securityImpact: -20,
              },
            },
            {
              id: "incident_international",
              label: "International Legal Action",
              description: "File formal complaint with international courts",
              skillRequired: "persuasion",
              skillLevel: 7,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Issue internationalized. ${target.name} faces diplomatic pressure from multiple countries. Staff situation stabilizes.`,
                mediumTerm: `International scrutiny forces ${target.name} to improve treatment of detained staff. Legal proceedings advance slowly.`,
                longTerm: `Court ruling upholds diplomatic immunity principles. Staff eventually released. Sets important legal precedent.`,
              },
              effects: {
                relationshipChange: -20,
                economicImpact: -10,
                reputationChange: 30,
                securityImpact: 15,
              },
              requirements: {
                minimumEmbassyLevel: 3,
                minimumBudget: 250000,
              },
            },
          ],
          metadata: {
            triggeredBy: "Embassy personnel detention",
            relevanceScore: 85,
          },
        };
      },
    };
  }

  private createMediationOpportunityTemplate(): ScenarioTemplate {
    return {
      type: "mediation_opportunity",
      weight: 0.8,
      triggerConditions: (context) => {
        // Trigger if we have good relationships with multiple countries
        const goodRelations = context.relationships.filter((r) => r.strength > 60);
        return goodRelations.length >= 3;
      },
      generate: (context, target) => {
        // Find two countries in conflict that we both have relationships with
        const conflicts = context.relationships.filter(
          (r) => r.relationship === "tension" || r.relationship === "hostile"
        );

        const conflict = conflicts[0] || { country1: "Country A", country2: "Country B" };

        return {
          id: `scenario_mediation_${Date.now()}`,
          type: "mediation_opportunity",
          title: `Opportunity to Mediate Regional Dispute`,
          narrative: {
            introduction: `${conflict.country1} and ${conflict.country2} have been locked in an escalating dispute that threatens regional stability. Both parties have privately approached us about serving as a neutral mediator.`,
            context: `The conflict centers on overlapping territorial claims and economic competition. Previous mediation attempts by regional organizations have failed. Both sides trust us due to our balanced diplomatic approach and lack of direct stakes in the outcome.`,
            situation: `${conflict.country1} controls the disputed territory but faces international criticism for their heavy-handed approach. ${conflict.country2} has mobilized international sympathy but lacks military capability to change facts on the ground. Both are spending unsustainable amounts on military buildup. Successful mediation could save thousands of lives and prevent regional economic disruption affecting our interests.`,
            implications: `Mediation is high-risk, high-reward diplomacy. Success would establish us as a regional power broker and peacemaker. Failure could damage relationships with both parties and our broader diplomatic credibility.`,
          },
          involvedCountries: {
            primary: target.id,
            secondary: [conflict.country1, conflict.country2],
          },
          historicalContext: [
            `The territorial dispute dates back decades`,
            `Previous conflicts between them have drawn in regional powers`,
            `We maintain balanced relations with both parties`,
            `Economic costs of continued tension affect multiple countries`,
          ],
          timeFrame: "strategic",
          difficulty: "legendary",
          recommendedEmbassyLevel: 5,
          choices: [
            {
              id: "mediation_accept",
              label: "Accept Mediation Role",
              description: "Commit to facilitating comprehensive peace negotiations",
              skillRequired: "persuasion",
              skillLevel: 10,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `We host high-level peace talks. International attention focused on mediation efforts. Both sides make initial demands.`,
                mediumTerm: `Negotiations prove difficult. Small confidence-building measures achieved. Risk of breakdown constant. Regional tensions pause.`,
                longTerm: `If successful: Historic peace agreement. Regional stability. Enhanced international prestige. If failed: Blame from both sides. Damaged credibility.`,
              },
              effects: {
                relationshipChange: 30,
                economicImpact: 20,
                reputationChange: 45,
                securityImpact: 35,
              },
              requirements: {
                minimumEmbassyLevel: 4,
                minimumBudget: 2000000,
              },
            },
            {
              id: "mediation_facilitate",
              label: "Limited Facilitation",
              description: "Provide venue and support but let international organization lead",
              skillRequired: "negotiation",
              skillLevel: 7,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `We host talks but share responsibility with international body. Reduces our exposure to failure.`,
                mediumTerm: `Progress depends on international organization's effectiveness. We gain credit for facilitating without bearing full responsibility.`,
                longTerm: `Modest reputation boost regardless of outcome. Maintains relationships with both parties. Less transformative impact.`,
              },
              effects: {
                relationshipChange: 15,
                economicImpact: 10,
                reputationChange: 20,
                securityImpact: 15,
              },
              requirements: {
                minimumEmbassyLevel: 3,
                minimumBudget: 500000,
              },
            },
            {
              id: "mediation_decline",
              label: "Decline Mediation",
              description: "Politely refuse to avoid risk of mediation failure",
              skillRequired: "firmness",
              skillLevel: 5,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Both parties disappointed. Conflict continues without mediation. They seek other mediators.`,
                mediumTerm: `Missed opportunity for regional influence. Another country may successfully mediate and gain prestige.`,
                longTerm: `Avoided potential failure but also missed potential success. Seen as risk-averse rather than constructive.`,
              },
              effects: {
                relationshipChange: -10,
                economicImpact: 0,
                reputationChange: -15,
                securityImpact: -10,
              },
            },
            {
              id: "mediation_track2",
              label: "Track II Diplomacy",
              description: "Sponsor unofficial dialogue between civil society leaders",
              skillRequired: "compromise",
              skillLevel: 8,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `We organize meetings between academics, business leaders, and civil society from both sides. Lower stakes than official talks.`,
                mediumTerm: `Track II dialogue builds personal relationships and generates creative solutions. Gradual trust-building at grassroots level.`,
                longTerm: `If successful, grassroots support creates pressure for official peace process. Lower risk approach that may take longer but build stronger foundation.`,
              },
              effects: {
                relationshipChange: 25,
                economicImpact: 15,
                reputationChange: 30,
                securityImpact: 20,
              },
              requirements: {
                minimumEmbassyLevel: 3,
                minimumBudget: 750000,
              },
            },
          ],
          metadata: {
            triggeredBy: "Regional conflict between countries we have relationships with",
            relevanceScore: 80,
          },
        };
      },
    };
  }

  private createEmbassySecurityThreatTemplate(): ScenarioTemplate {
    return {
      type: "embassy_security_threat",
      weight: 0.5,
      triggerConditions: (context) => {
        // Can happen with any embassy
        return context.embassies.length > 0;
      },
      generate: (context, target) => {
        const embassy =
          context.embassies.find(
            (e) => e.hostCountryId === target.id || e.guestCountryId === target.id
          ) || context.embassies[0];

        return {
          id: `scenario_security_${Date.now()}`,
          type: "embassy_security_threat",
          title: `Security Threat Against Embassy in ${target.name}`,
          narrative: {
            introduction: `Intelligence reports indicate credible threats against our embassy in ${target.name}. A terrorist organization has specifically named our diplomatic facilities in their propaganda materials.`,
            context: `The threat level has been elevated following recent regional instability. ${target.name}'s security services have increased protective measures, but they have limited resources and capabilities.`,
            situation: `We must decide whether to: (1) evacuate non-essential personnel and reduce operations, (2) request enhanced security from ${target.name}'s government, (3) bring in our own security contractors, or (4) temporarily close the embassy entirely. Each option has different implications for our diplomatic presence, staff safety, and relationship with ${target.name}.`,
            implications: `Staff safety is paramount, but embassy closures signal weakness and disrupt critical diplomatic functions. Our decision will be noticed by both allies and adversaries.`,
            urgency: `Intelligence suggests threats may materialize within days.`,
          },
          involvedCountries: {
            primary: target.id,
          },
          historicalContext: [
            `Regional terrorist activity has increased in recent months`,
            `${target.name}'s security capabilities are limited`,
            `Previous embassy attacks in region have occurred`,
            `Our embassy serves as important diplomatic hub`,
          ],
          timeFrame: "urgent",
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          difficulty: "critical",
          recommendedEmbassyLevel: 2,
          choices: [
            {
              id: "security_evacuate",
              label: "Partial Evacuation",
              description: "Reduce staff to essential personnel only",
              skillRequired: "firmness",
              skillLevel: 5,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Non-essential staff safely evacuated. Embassy operations reduced. ${target.name} understands but concerned about appearance.`,
                mediumTerm: `Reduced operations limit diplomatic effectiveness. Security situation may stabilize allowing staff return.`,
                longTerm: `Prioritizes safety while maintaining presence. May embolden threats if seen as retreat. Staff morale affected.`,
              },
              effects: {
                relationshipChange: -10,
                economicImpact: -15,
                reputationChange: -5,
                securityImpact: 30,
              },
            },
            {
              id: "security_enhanced",
              label: "Request Enhanced Host Protection",
              description: "Work with host government to significantly upgrade security",
              skillRequired: "negotiation",
              skillLevel: 6,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `${target.name} commits additional security forces. Visible protection increased. Operations continue with enhanced vigilance.`,
                mediumTerm: `Collaborative security arrangement strengthens ties. Demonstrates trust in ${target.name}'s capabilities.`,
                longTerm: `If security holds, validates cooperative approach. If attack occurs, may damage ${target.name}'s reputation and our trust.`,
              },
              effects: {
                relationshipChange: 20,
                economicImpact: -5,
                reputationChange: 10,
                securityImpact: 20,
              },
              requirements: {
                minimumEmbassyLevel: 2,
              },
            },
            {
              id: "security_contractors",
              label: "Deploy Private Security",
              description: "Bring in our own security contractors for embassy protection",
              skillRequired: "firmness",
              skillLevel: 7,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Private contractors deployed. ${target.name} objects to armed foreign personnel but reluctantly accepts. Security significantly upgraded.`,
                mediumTerm: `Embassy operates as fortified compound. Effective security but signals lack of trust in host country.`,
                longTerm: `Establishes precedent of self-reliance. May strain relationship with ${target.name}. High ongoing costs.`,
              },
              effects: {
                relationshipChange: -15,
                economicImpact: -25,
                reputationChange: 5,
                securityImpact: 40,
              },
              requirements: {
                minimumBudget: 500000,
              },
            },
            {
              id: "security_close",
              label: "Temporary Closure",
              description: "Close embassy until security situation improves",
              skillRequired: "firmness",
              skillLevel: 4,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `Embassy closed. All staff evacuated. ${target.name} government embarrassed by closure. Diplomatic functions suspended.`,
                mediumTerm: `Critical diplomatic work halted. Other countries maintain presence, gaining advantage. Reopening timeline uncertain.`,
                longTerm: `Safety ensured but diplomatic influence severely compromised. May take years to rebuild presence and credibility.`,
              },
              effects: {
                relationshipChange: -35,
                economicImpact: -30,
                reputationChange: -20,
                securityImpact: 50,
              },
            },
          ],
          metadata: {
            triggeredBy: "Security threat intelligence",
            relevanceScore: 75,
          },
        };
      },
    };
  }

  private createTreatyRenewalTemplate(): ScenarioTemplate {
    return {
      type: "treaty_renewal",
      weight: 1.0,
      triggerConditions: (context) => {
        // Trigger if we have treaties expiring soon
        const expiringTreaties = context.treaties.filter((t) => {
          const daysUntilExpiry = (t.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return daysUntilExpiry > 0 && daysUntilExpiry < 90 && t.status === "active";
        });
        return expiringTreaties.length > 0;
      },
      generate: (context, target) => {
        const treaty = context.treaties.find((t) => {
          const daysUntilExpiry = (t.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return daysUntilExpiry > 0 && daysUntilExpiry < 90 && t.status === "active";
        });

        if (!treaty) {
          // Fallback
          return this.createBorderDisputeTemplate().generate(context, target);
        }

        const daysUntilExpiry = Math.floor(
          (treaty.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: `scenario_treaty_${Date.now()}`,
          type: "treaty_renewal",
          title: `${treaty.name} Nears Expiration`,
          narrative: {
            introduction: `The ${treaty.name} with ${target.name}, a cornerstone of our bilateral relationship, expires in ${daysUntilExpiry} days. Both parties must decide whether to renew, renegotiate, or allow it to lapse.`,
            context: `This ${treaty.type} treaty has governed our relationship for years. During that time, both our nations and the regional environment have evolved significantly. What made sense years ago may need updating for current realities.`,
            situation: `${target.name} has indicated interest in renewal but seeks modifications to reflect changed circumstances. They propose: (1) extending the treaty duration from 5 to 10 years, (2) updating specific provisions related to ${treaty.type === "trade" ? "tariff schedules and digital commerce" : treaty.type === "defense" ? "technology sharing and joint exercises" : "monitoring mechanisms"}, and (3) adding new clauses addressing issues that weren't relevant when originally signed. Our foreign ministry is divided on whether renewal serves our current interests.`,
            implications: `Treaty renewal signals continuity and reliability. Renegotiation allows updating terms but risks contentious negotiations. Allowing expiration opens new possibilities but creates uncertainty and potential vacuum.`,
          },
          involvedCountries: {
            primary: target.id,
          },
          historicalContext: [
            `Treaty has been in force and generally successful`,
            `Compliance rate has been 85%`,
            `Regional circumstances have evolved since original signing`,
            `Both parties have new leadership since treaty inception`,
          ],
          timeFrame: "time_sensitive",
          expiresAt: new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000),
          difficulty: "moderate",
          recommendedEmbassyLevel: 3,
          choices: [
            {
              id: "treaty_renew",
              label: "Straightforward Renewal",
              description: "Renew treaty with minimal modifications",
              skillRequired: "compromise",
              skillLevel: 5,
              riskLevel: "low",
              predictedOutcomes: {
                shortTerm: `Treaty renewed quickly and efficiently. ${target.name} satisfied. Continuity preserved.`,
                mediumTerm: `Relationship stability maintained. However, outdated provisions may cause friction as circumstances evolve.`,
                longTerm: `Predictability valued by both sides. May need to address emerging issues through supplementary agreements.`,
              },
              effects: {
                relationshipChange: 20,
                economicImpact: 10,
                reputationChange: 10,
                securityImpact: 10,
              },
            },
            {
              id: "treaty_modernize",
              label: "Comprehensive Modernization",
              description: "Renegotiate treaty with significant updates for current era",
              skillRequired: "negotiation",
              skillLevel: 8,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Extensive negotiations begin. Both sides present updated proposals. Risk of missing expiration deadline.`,
                mediumTerm: `If successful, produces treaty fit for current realities. If negotiations stall, may need interim extension or lapse.`,
                longTerm: `Modernized treaty serves both parties better. Demonstrates adaptability. May set precedent for other treaty updates.`,
              },
              effects: {
                relationshipChange: 30,
                economicImpact: 25,
                reputationChange: 20,
                securityImpact: 15,
              },
              requirements: {
                minimumEmbassyLevel: 3,
              },
            },
            {
              id: "treaty_expire",
              label: "Allow Expiration",
              description: "Let treaty lapse and pursue new framework",
              skillRequired: "firmness",
              skillLevel: 6,
              riskLevel: "high",
              predictedOutcomes: {
                shortTerm: `${target.name} surprised and disappointed. Treaty expires. Uncertainty about future framework.`,
                mediumTerm: `Period without formal agreement. Ad-hoc arrangements replace treaty structure. Relationship less predictable.`,
                longTerm: `Opens space for fundamentally new approach. However, may take years to establish new framework. Short-term instability risk.`,
              },
              effects: {
                relationshipChange: -25,
                economicImpact: -15,
                reputationChange: -10,
                securityImpact: -15,
              },
            },
            {
              id: "treaty_upgrade",
              label: "Upgrade to Comprehensive Partnership",
              description: "Propose replacing single treaty with broader partnership framework",
              skillRequired: "persuasion",
              skillLevel: 9,
              riskLevel: "medium",
              predictedOutcomes: {
                shortTerm: `Ambitious proposal requires careful consideration by ${target.name}. Current treaty extended while new framework negotiated.`,
                mediumTerm: `If accepted, transforms relationship from single-issue treaty to comprehensive partnership. Requires significant diplomatic investment.`,
                longTerm: `Could create much deeper relationship covering multiple domains. Demonstrates strategic vision. High reward if successful.`,
              },
              effects: {
                relationshipChange: 45,
                economicImpact: 35,
                reputationChange: 35,
                securityImpact: 30,
              },
              requirements: {
                minimumEmbassyLevel: 4,
                minimumBudget: 1000000,
              },
            },
          ],
          metadata: {
            triggeredBy: "Treaty expiration approaching",
            relevanceScore: 85,
          },
        };
      },
    };
  }

  // ==================== HELPER METHODS ====================

  private findEligibleCountries(
    context: WorldContext,
    countries: CountryData[],
    scenarioType: ScenarioType
  ): CountryData[] {
    // Filter countries based on scenario requirements
    const eligible = countries.filter((country) => {
      // Don't create scenarios about player's own country
      if (country.id === context.playerCountryId) return false;

      // Check if we have diplomatic relationship
      const hasRelationship = context.relationships.some(
        (r) => r.country1 === country.id || r.country2 === country.id
      );

      // Check if we have embassy
      const hasEmbassy = context.embassies.some(
        (e) => e.hostCountryId === country.id || e.guestCountryId === country.id
      );

      // Scenario-specific filters
      switch (scenarioType) {
        case "border_dispute":
          return (
            hasRelationship &&
            context.relationships.some(
              (r) =>
                (r.country1 === country.id || r.country2 === country.id) &&
                (r.relationship === "tension" || r.relationship === "hostile")
            )
          );

        case "trade_renegotiation":
          return (
            hasRelationship &&
            context.relationships.some(
              (r) =>
                (r.country1 === country.id || r.country2 === country.id) &&
                r.relationship === "trade"
            )
          );

        case "intelligence_breach":
          return (
            hasEmbassy &&
            context.embassies.some(
              (e) =>
                (e.hostCountryId === country.id || e.guestCountryId === country.id) && e.level >= 3
            )
          );

        default:
          return hasRelationship || hasEmbassy;
      }
    });

    // Sort by relevance (relationship strength, embassy level, etc.)
    return eligible.sort((a, b) => {
      const relA = context.relationships.find((r) => r.country1 === a.id || r.country2 === a.id);
      const relB = context.relationships.find((r) => r.country1 === b.id || r.country2 === b.id);
      return (relB?.strength || 0) - (relA?.strength || 0);
    });
  }

  private calculateRelevance(
    scenario: DiplomaticScenario,
    context: WorldContext,
    playerProfile: CumulativeEffects
  ): number {
    let relevance = 50; // Base relevance

    // Adjust based on relationship strength
    const relationship = context.relationships.find(
      (r) =>
        r.country1 === scenario.involvedCountries.primary ||
        r.country2 === scenario.involvedCountries.primary
    );
    if (relationship) {
      relevance += Math.min(relationship.strength / 2, 25);
    }

    // Adjust based on embassy presence
    const embassy = context.embassies.find(
      (e) =>
        e.hostCountryId === scenario.involvedCountries.primary ||
        e.guestCountryId === scenario.involvedCountries.primary
    );
    if (embassy) {
      relevance += embassy.level * 3;
      relevance += embassy.influence / 5;
    }

    // Adjust based on player's diplomatic history
    if (
      playerProfile.historicalPatterns.culturallyActive &&
      scenario.type === "cultural_misunderstanding"
    ) {
      relevance += 15;
    }
    if (
      playerProfile.historicalPatterns.interventionist &&
      scenario.type === "mediation_opportunity"
    ) {
      relevance += 20;
    }
    if (playerProfile.historicalPatterns.prefersTrade && scenario.type === "trade_renegotiation") {
      relevance += 15;
    }

    // Adjust based on difficulty vs embassy level
    if (embassy && embassy.level >= scenario.recommendedEmbassyLevel) {
      relevance += 10;
    } else if (embassy && embassy.level < scenario.recommendedEmbassyLevel - 1) {
      relevance -= 15;
    }

    // Time-sensitive scenarios get boost
    if (scenario.timeFrame === "urgent") {
      relevance += 10;
    }

    return Math.max(0, Math.min(100, relevance));
  }

  private describeRelationship(context: WorldContext, countryId: string): string {
    const relationship = context.relationships.find(
      (r) => r.country1 === countryId || r.country2 === countryId
    );

    if (!relationship) return "minimal";

    switch (relationship.relationship) {
      case "alliance":
        return "strong and allied";
      case "trade":
        return "economically cooperative";
      case "tension":
        return "tense";
      case "hostile":
        return "hostile";
      default:
        return relationship.strength > 60
          ? "positive"
          : relationship.strength > 30
            ? "neutral"
            : "strained";
    }
  }

  private randomTechnology(): string {
    const technologies = [
      "renewable energy",
      "advanced manufacturing",
      "artificial intelligence",
      "biotechnology",
      "quantum computing",
      "aerospace",
      "telecommunications",
      "semiconductor",
    ];
    return technologies[Math.floor(Math.random() * technologies.length)];
  }
}

// ==================== EXPORT ====================

export default DiplomaticScenarioGenerator;
