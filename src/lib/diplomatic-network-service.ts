/**
 * Diplomatic Network Service
 *
 * Provides comprehensive analysis and calculations for diplomatic operations,
 * network power, synergy bonuses, and strategic opportunities.
 */

export interface NetworkPowerCalculation {
  totalPower: number;
  breakdown: {
    embassyContribution: number;
    relationshipContribution: number;
    missionContribution: number;
  };
  ranking: "Elite" | "Strong" | "Developing" | "Emerging";
}

export interface SharedIntelligence {
  economicIntel: Array<{
    source: string;
    type: "trade_data" | "market_trends" | "investment_opportunities";
    data: Record<string, any>;
    confidence: number;
    timestamp: Date;
  }>;
  securityIntel: Array<{
    source: string;
    type: "threat_assessment" | "stability_report" | "border_security";
    data: Record<string, any>;
    confidence: number;
    timestamp: Date;
  }>;
  culturalIntel: Array<{
    source: string;
    type: "public_sentiment" | "cultural_trends" | "social_movements";
    data: Record<string, any>;
    confidence: number;
    timestamp: Date;
  }>;
  policyIntel: Array<{
    source: string;
    type: "legislation" | "regulations" | "policy_changes";
    data: Record<string, any>;
    confidence: number;
    timestamp: Date;
  }>;
}

export interface SynergyBonuses {
  economicMultiplier: number; // 1.0 - 2.0
  researchSpeedBonus: number; // 0-50%
  culturalInfluenceBonus: number; // 0-100 points
  intelligenceGatheringBonus: number; // 0-30%
}

export interface StrategicOpportunity {
  id: string;
  type: "treaty" | "trade" | "alliance" | "cultural" | "expansion";
  title: string;
  description: string;
  expectedBenefit: string;
  difficulty: "easy" | "medium" | "hard";
  recommendedAction: string;
  targetCountry?: string;
  estimatedTimeframe: string;
  prerequisites: string[];
  risks: string[];
}

export class DiplomaticNetworkService {
  /**
   * Calculate overall diplomatic network power
   * Based on: # of embassies, embassy levels, relationship strengths, active missions
   */
  static calculateNetworkPower(data: {
    embassies: any[];
    relationships: any[];
    missions: any[];
  }): NetworkPowerCalculation {
    const { embassies, relationships, missions } = data;

    // Embassy Contribution Calculation
    // Formula: Sum of (embassy_level * influence_strength * 10) for all embassies
    const embassyContribution = embassies.reduce((sum, embassy) => {
      const level = embassy.level || 1;
      const strength = embassy.strength || 50; // 0-100 scale
      const baseContribution = level * (strength / 100) * 10;

      // Bonus for specializations
      const specializationBonus = embassy.specialization ? 1.2 : 1.0;

      // Bonus for active status
      const statusMultiplier = embassy.status === "active" ? 1.0 : 0.5;

      return sum + baseContribution * specializationBonus * statusMultiplier;
    }, 0);

    // Relationship Contribution Calculation
    // Formula: Sum of (relationship_strength * type_multiplier) for all relationships
    const relationshipMultipliers: Record<string, number> = {
      alliance: 2.5,
      friendly: 1.5,
      cooperative: 1.0,
      neutral: 0.3,
      cool: -0.2,
      strained: -0.5,
      hostile: -1.0,
    };

    const relationshipContribution = relationships.reduce((sum, rel) => {
      const strength = rel.strength || 50; // 0-100 scale
      const multiplier = relationshipMultipliers[rel.relationship] || 0.5;
      const baseContribution = (strength / 100) * multiplier * 10;

      // Bonus for active treaties
      const treatyBonus = rel.treaties && rel.treaties.length > 0 ? 1.3 : 1.0;

      // Bonus for active diplomatic channels
      const channelBonus = rel.diplomaticChannels && rel.diplomaticChannels.length > 2 ? 1.1 : 1.0;

      return sum + baseContribution * treatyBonus * channelBonus;
    }, 0);

    // Mission Contribution Calculation
    // Formula: (active_missions * avg_success_rate * difficulty_multiplier) / 10
    const activeMissions = missions.filter((m: any) => m.status === "active");
    const missionContribution = activeMissions.reduce((sum: number, mission: any) => {
      const successRate = mission.successChance || 70; // 0-100 scale

      const difficultyMultipliers: Record<string, number> = {
        easy: 0.5,
        medium: 1.0,
        hard: 1.5,
        expert: 2.0,
      };

      const difficultyMultiplier = difficultyMultipliers[mission.difficulty] || 1.0;

      return sum + (successRate / 100) * difficultyMultiplier * 5;
    }, 0);

    const totalPower = embassyContribution + relationshipContribution + missionContribution;

    // Determine ranking based on total power
    let ranking: NetworkPowerCalculation["ranking"] = "Emerging";
    if (totalPower >= 200) {
      ranking = "Elite";
    } else if (totalPower >= 120) {
      ranking = "Strong";
    } else if (totalPower >= 60) {
      ranking = "Developing";
    }

    return {
      totalPower: Math.round(totalPower),
      breakdown: {
        embassyContribution: Math.round(embassyContribution),
        relationshipContribution: Math.round(relationshipContribution),
        missionContribution: Math.round(missionContribution),
      },
      ranking,
    };
  }

  /**
   * Get shared intelligence from embassy partners
   * Aggregates data shared by partner countries based on relationship strength and treaties
   */
  static getSharedIntelligence(embassies: any[]): SharedIntelligence {
    const intel: SharedIntelligence = {
      economicIntel: [],
      securityIntel: [],
      culturalIntel: [],
      policyIntel: [],
    };

    embassies.forEach((embassy) => {
      const relationshipStrength = embassy.strength || 50;
      const confidence = Math.min(95, relationshipStrength + 10);

      // Generate intelligence based on embassy level and specialization
      if (embassy.level >= 2) {
        // Economic intelligence
        intel.economicIntel.push({
          source: embassy.country,
          type: "trade_data",
          data: {
            tradeVolume: embassy.tradeVolume || Math.random() * 1000000,
            growthRate: (Math.random() * 10 - 2).toFixed(2) + "%",
            topExports: ["goods", "services", "technology"],
          },
          confidence,
          timestamp: new Date(),
        });

        // Cultural intelligence
        if (embassy.specialization === "cultural" || Math.random() > 0.7) {
          intel.culturalIntel.push({
            source: embassy.country,
            type: "cultural_trends",
            data: {
              sentiment: relationshipStrength > 70 ? "positive" : "neutral",
              exchangeParticipation: Math.floor(Math.random() * 1000),
              culturalAffinity: relationshipStrength,
            },
            confidence,
            timestamp: new Date(),
          });
        }
      }

      if (embassy.level >= 3) {
        // Security intelligence (higher level embassies only)
        if (embassy.specialization === "security" || Math.random() > 0.8) {
          intel.securityIntel.push({
            source: embassy.country,
            type: "stability_report",
            data: {
              stabilityIndex: Math.floor(Math.random() * 100),
              threatLevel: relationshipStrength > 70 ? "low" : "medium",
              borderSecurity: "stable",
            },
            confidence: confidence - 10,
            timestamp: new Date(),
          });
        }

        // Policy intelligence
        intel.policyIntel.push({
          source: embassy.country,
          type: "policy_changes",
          data: {
            recentPolicies: Math.floor(Math.random() * 10),
            alignmentScore: relationshipStrength,
            cooperationOpportunities: relationshipStrength > 80 ? "high" : "medium",
          },
          confidence,
          timestamp: new Date(),
        });
      }
    });

    return intel;
  }

  /**
   * Calculate synergy bonuses from diplomatic network
   * Returns multipliers that affect other game systems
   */
  static getSynergyBonuses(networkData: {
    networkPower: number;
    embassies: any[];
    relationships: any[];
    exchanges: any[];
  }): SynergyBonuses {
    const { networkPower, embassies, relationships, exchanges } = networkData;

    // Economic Multiplier (1.0 - 2.0)
    // Based on trade relationships and embassy economic specializations
    const tradeRelationships = relationships.filter(
      (r: any) => r.treaties?.includes("Trade Agreement") || r.tradeVolume > 100000
    ).length;
    const economicEmbassies = embassies.filter(
      (e: any) => e.specialization === "economic" || e.specialization === "trade"
    ).length;

    const baseEconomicBonus = Math.min(0.5, tradeRelationships * 0.05 + economicEmbassies * 0.08);
    const networkPowerBonus = Math.min(0.5, networkPower / 400);
    const economicMultiplier = 1.0 + baseEconomicBonus + networkPowerBonus;

    // Research Speed Bonus (0-50%)
    // Based on research cooperation treaties and cultural exchanges
    const researchTreaties = relationships.filter((r: any) =>
      r.treaties?.includes("Research Cooperation")
    ).length;
    const culturalPrograms = exchanges.filter(
      (e: any) => e.type === "technology" || e.type === "education"
    ).length;

    const researchSpeedBonus = Math.min(
      50,
      researchTreaties * 5 + culturalPrograms * 3 + networkPower / 10
    );

    // Cultural Influence Bonus (0-100 points)
    // Based on cultural exchanges and embassy cultural specializations
    const culturalEmbassies = embassies.filter((e: any) => e.specialization === "cultural").length;
    const activeExchanges = exchanges.filter((e: any) => e.status === "active").length;
    const totalParticipants = exchanges.reduce(
      (sum: number, e: any) => sum + (e.metrics?.participants || 0),
      0
    );

    const culturalInfluenceBonus = Math.min(
      100,
      culturalEmbassies * 10 + activeExchanges * 5 + totalParticipants / 100 + networkPower / 5
    );

    // Intelligence Gathering Bonus (0-30%)
    // Based on embassy network coverage and security specializations
    const securityEmbassies = embassies.filter(
      (e: any) => e.specialization === "security" || e.level >= 3
    ).length;
    const allianceRelationships = relationships.filter(
      (r: any) => r.relationship === "alliance"
    ).length;

    const intelligenceGatheringBonus = Math.min(
      30,
      securityEmbassies * 4 + allianceRelationships * 5 + embassies.length * 1.5 + networkPower / 15
    );

    return {
      economicMultiplier: Math.round(economicMultiplier * 100) / 100,
      researchSpeedBonus: Math.round(researchSpeedBonus * 10) / 10,
      culturalInfluenceBonus: Math.round(culturalInfluenceBonus),
      intelligenceGatheringBonus: Math.round(intelligenceGatheringBonus * 10) / 10,
    };
  }

  /**
   * Generate strategic opportunities based on network state
   * AI-powered recommendations for diplomatic expansion and optimization
   */
  static getStrategicOpportunities(context: {
    myCountryId: string;
    embassies: any[];
    relationships: any[];
    goals?: string[];
  }): StrategicOpportunity[] {
    const { embassies, relationships, goals = [] } = context;
    const opportunities: StrategicOpportunity[] = [];

    // Opportunity 1: Expand Embassy Network
    if (embassies.length < 8) {
      // Find strong relationships without embassies
      const strongRelationsWithoutEmbassy = relationships.filter((rel: any) => {
        const hasEmbassy = embassies.some(
          (emb: any) => emb.country === rel.targetCountry || emb.country === rel.targetCountryId
        );
        return !hasEmbassy && rel.strength > 60;
      });

      if (strongRelationsWithoutEmbassy.length > 0) {
        const target = strongRelationsWithoutEmbassy[0];
        opportunities.push({
          id: "expand-embassy-network",
          type: "expansion",
          title: "Establish Strategic Embassy",
          description: `Strong relationship with ${target.targetCountry} (${target.strength}% strength) presents an opportunity to establish an embassy and unlock diplomatic benefits.`,
          expectedBenefit: "+15-25 network power, unlock missions, improve intelligence gathering",
          difficulty: "medium",
          recommendedAction: `Establish embassy in ${target.targetCountry}`,
          targetCountry: target.targetCountry,
          estimatedTimeframe: "2-4 weeks",
          prerequisites: [
            "Diplomatic approval",
            "Budget allocation ($50,000+)",
            "Ambassador appointment",
          ],
          risks: ["Initial maintenance costs", "Diplomatic protocol complexity"],
        });
      }
    }

    // Opportunity 2: Upgrade High-Performing Embassies
    const upgradeableEmbassies = embassies.filter((emb: any) => emb.strength > 75 && emb.level < 3);
    if (upgradeableEmbassies.length > 0) {
      const best = upgradeableEmbassies.sort((a: any, b: any) => b.strength - a.strength)[0];
      opportunities.push({
        id: "upgrade-embassy",
        type: "expansion",
        title: "Upgrade High-Performing Embassy",
        description: `Embassy in ${best.country} shows excellent performance (${best.strength}% influence). Upgrading to Level ${best.level + 1} unlocks advanced capabilities.`,
        expectedBenefit: "+10 network power, +1 mission capacity, unlock specialized missions",
        difficulty: "easy",
        recommendedAction: `Upgrade ${best.country} embassy to Level ${best.level + 1}`,
        targetCountry: best.country,
        estimatedTimeframe: "1-2 weeks",
        prerequisites: [
          `Embassy Level ${best.level}`,
          "Budget ($25,000+)",
          "Performance threshold met",
        ],
        risks: ["Temporary disruption during upgrade"],
      });
    }

    // Opportunity 3: Formalize Trade Treaties
    const strongRelationsWithoutTrade = relationships.filter((rel: any) => {
      const hasTradeTreaty = rel.treaties?.some((t: string) => t.toLowerCase().includes("trade"));
      return !hasTradeTreaty && rel.strength > 70 && rel.tradeVolume > 50000;
    });

    if (strongRelationsWithoutTrade.length > 0) {
      const target = strongRelationsWithoutTrade[0];
      opportunities.push({
        id: "trade-treaty",
        type: "trade",
        title: "Formalize Trade Agreement",
        description: `Significant trade activity with ${target.targetCountry} ($${(target.tradeVolume || 0).toLocaleString()}) without formal treaty. Formalization provides economic benefits.`,
        expectedBenefit: "+15% trade efficiency, +1.1x economic multiplier, reduced tariffs",
        difficulty: "medium",
        recommendedAction: `Negotiate trade treaty with ${target.targetCountry}`,
        targetCountry: target.targetCountry,
        estimatedTimeframe: "4-8 weeks",
        prerequisites: ["Strong relationship (70+)", "Active trade ($50k+)", "Economic analysis"],
        risks: ["Negotiation complexity", "Potential trade imbalances"],
      });
    }

    // Opportunity 4: Form Strategic Alliance
    const allianceCandidates = relationships.filter((rel: any) => {
      return rel.relationship === "friendly" && rel.strength > 85 && rel.treaties?.length >= 2;
    });

    if (
      allianceCandidates.length > 0 &&
      relationships.filter((r: any) => r.relationship === "alliance").length < 3
    ) {
      const target = allianceCandidates.sort((a: any, b: any) => b.strength - a.strength)[0];
      opportunities.push({
        id: "form-alliance",
        type: "alliance",
        title: "Elevate to Strategic Alliance",
        description: `Exceptional relationship with ${target.targetCountry} (${target.strength}% strength, ${target.treaties?.length} treaties). Ready for alliance formation.`,
        expectedBenefit:
          "+35 network power, mutual defense pact, shared intelligence, research cooperation",
        difficulty: "hard",
        recommendedAction: `Propose formal alliance with ${target.targetCountry}`,
        targetCountry: target.targetCountry,
        estimatedTimeframe: "8-12 weeks",
        prerequisites: [
          "Friendly status",
          "Strength 85+",
          "2+ existing treaties",
          "Political approval",
        ],
        risks: ["Regional perception shifts", "Potential rival concerns", "Long-term commitments"],
      });
    }

    // Opportunity 5: Launch Cultural Exchange Initiative
    const culturalCandidates = relationships.filter((rel: any) => {
      const hasEmbassy = embassies.some(
        (emb: any) => emb.country === rel.targetCountry || emb.country === rel.targetCountryId
      );
      return hasEmbassy && rel.strength > 60 && rel.culturalExchange !== "High";
    });

    if (culturalCandidates.length > 0) {
      const target = culturalCandidates[0];
      opportunities.push({
        id: "cultural-exchange",
        type: "cultural",
        title: "Expand Cultural Exchange Programs",
        description: `Embassy presence and positive relations with ${target.targetCountry} create opportunity for cultural program expansion.`,
        expectedBenefit: "+5-10 relationship strength, +cultural influence, +soft power",
        difficulty: "easy",
        recommendedAction: `Launch cultural exchange program with ${target.targetCountry}`,
        targetCountry: target.targetCountry,
        estimatedTimeframe: "2-6 weeks",
        prerequisites: ["Active embassy", "Relationship 60+", "Cultural budget allocation"],
        risks: ["Participant recruitment challenges", "Cross-cultural coordination"],
      });
    }

    // Opportunity 6: Strengthen Weak Relationships
    const weakRelationships = relationships.filter((rel: any) => {
      return rel.strength < 50 && rel.relationship !== "hostile";
    });

    if (weakRelationships.length > 2) {
      opportunities.push({
        id: "strengthen-relationships",
        type: "alliance",
        title: "Relationship Recovery Initiative",
        description: `${weakRelationships.length} relationships below 50% strength. Proactive engagement can prevent deterioration and unlock potential.`,
        expectedBenefit:
          "Prevent relationship decay, unlock future cooperation, improve network stability",
        difficulty: "medium",
        recommendedAction: "Launch diplomatic engagement missions to weak relationships",
        estimatedTimeframe: "4-8 weeks",
        prerequisites: ["Mission capacity", "Diplomatic staff availability", "Budget allocation"],
        risks: ["Mixed success rates", "Resource allocation from other priorities"],
      });
    }

    return opportunities.slice(0, 6); // Return top 6 opportunities
  }
}
