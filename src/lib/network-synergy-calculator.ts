/**
 * Network Synergy Calculator
 *
 * Calculates how diplomatic relationships create multiplier effects across the entire nation.
 * Considers embassies, relationships, cultural exchanges, treaties, and shared intelligence.
 *
 * Design Philosophy:
 * - Realistic and balanced multipliers (1.0 - 2.5 range)
 * - Network effects compound but have diminishing returns
 * - Diversity in relationships provides bonuses
 * - Quality over quantity (deeper relationships > more shallow ones)
 */

// ==================== TYPES ====================

export interface NetworkSynergyData {
  // Core Metrics
  economicMultiplier: number; // 1.0 - 2.5 (from trade + embassies + exchanges)
  intelligenceBonus: number; // 0-100% (from shared data + secure channels)
  culturalInfluence: number; // 0-1000 points (from exchanges + relationships)
  diplomaticPower: number; // 0-10000 total network strength
  researchSpeedBonus: number; // 0-50% (from collaborative research)

  // Derived Metrics
  tradeRouteEfficiency: number; // 0-200% (optimal routing through network)
  culturalSoftPower: number; // 0-100 (global influence)
  allianceStrength: number; // 0-100 (military/security benefits)
  economicBloc: {
    members: string[];
    totalGdp: number;
    tradeVolume: number;
    powerRanking: number;
  };

  // Strategic Position
  strategicOpportunities: Opportunity[];
  vulnerabilities: Vulnerability[];
  competitiveAdvantages: string[];

  // Breakdown by Source
  breakdown: {
    fromEmbassies: number;
    fromRelationships: number;
    fromCulturalExchanges: number;
    fromTreaties: number;
    fromSharedIntelligence: number;
  };
}

export interface Opportunity {
  id: string;
  type:
    | "triangulation"
    | "economic_complementarity"
    | "cultural_affinity"
    | "strategic_position"
    | "emerging_power";
  targetCountry: string;
  targetCountryId: string;
  score: number; // 0-100
  reasoning: string;
  potentialBenefits: {
    economic?: number;
    intelligence?: number;
    cultural?: number;
    diplomatic?: number;
  };
  recommendedAction: string;
  priority: "high" | "medium" | "low";
}

export interface Vulnerability {
  id: string;
  type:
    | "single_point_of_failure"
    | "rivalry_exposure"
    | "over_dependency"
    | "weak_diversification"
    | "unstable_partner";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedCountries: string[];
  riskScore: number; // 0-100
  mitigation: string;
}

export interface EmbassyData {
  id: string;
  countryId: string;
  countryName?: string;
  level: number;
  influence: number;
  specialization?: string;
  status: string;
}

export interface RelationshipData {
  id: string;
  targetCountry: string;
  targetCountryId: string;
  relationship: string; // 'alliance', 'trade', 'neutral', 'tension'
  strength: number; // 0-100
  tradeVolume?: number;
  treaties?: string[];
}

export interface CulturalExchangeData {
  id: string;
  type: string;
  participatingCountries: Array<{ countryId: string; countryName: string }>;
  culturalImpact: number;
  diplomaticValue: number;
  status: string;
}

export interface TreatyData {
  id: string;
  name: string;
  type: string;
  parties: string[];
  status: string;
}

export interface SharedDataPoint {
  id: string;
  sourceCountryId: string;
  type: string;
  classification: string;
}

// ==================== CALCULATOR CLASS ====================

export class NetworkSynergyCalculator {
  /**
   * Main calculation function
   * Computes all network synergy metrics
   */
  static calculate(data: {
    countryId: string;
    embassies: EmbassyData[];
    relationships: RelationshipData[];
    culturalExchanges: CulturalExchangeData[];
    treaties: TreatyData[];
    sharedData: SharedDataPoint[];
    atomicComponents?: any[]; // For atomic synergies
  }): NetworkSynergyData {
    // Calculate individual components
    const economicMultiplier = this.calculateEconomicMultiplier(
      data.embassies,
      data.relationships,
      data.treaties
    );

    const intelligenceBonus = this.calculateIntelligenceBonus(
      data.sharedData,
      data.embassies,
      data.relationships
    );

    const culturalInfluence = this.calculateCulturalInfluence(
      data.culturalExchanges,
      data.relationships
    );

    const diplomaticPower = this.calculateDiplomaticPower(
      data.embassies,
      data.relationships,
      data.treaties
    );

    const researchSpeedBonus = this.calculateResearchBonus(data.embassies, data.treaties);

    const tradeRouteEfficiency = this.calculateTradeEfficiency(data.relationships, data.embassies);

    const culturalSoftPower = this.calculateSoftPower(data.culturalExchanges, culturalInfluence);

    const allianceStrength = this.calculateAllianceStrength(data.relationships, data.treaties);

    const economicBloc = this.identifyEconomicBloc(data.relationships, data.treaties);

    const strategicOpportunities = this.findOpportunities(data);
    const vulnerabilities = this.identifyVulnerabilities(data);
    const competitiveAdvantages = this.identifyCompetitiveAdvantages(data);

    const breakdown = {
      fromEmbassies: this.calculateEmbassyContribution(data.embassies),
      fromRelationships: this.calculateRelationshipContribution(data.relationships),
      fromCulturalExchanges: this.calculateCulturalContribution(data.culturalExchanges),
      fromTreaties: this.calculateTreatyContribution(data.treaties),
      fromSharedIntelligence: this.calculateIntelligenceContribution(data.sharedData),
    };

    return {
      economicMultiplier,
      intelligenceBonus,
      culturalInfluence,
      diplomaticPower,
      researchSpeedBonus,
      tradeRouteEfficiency,
      culturalSoftPower,
      allianceStrength,
      economicBloc,
      strategicOpportunities,
      vulnerabilities,
      competitiveAdvantages,
      breakdown,
    };
  }

  /**
   * Calculate economic multiplier (1.0 - 2.5)
   * Based on trade agreements, embassy levels, relationship strengths
   */
  static calculateEconomicMultiplier(
    embassies: EmbassyData[],
    relationships: RelationshipData[],
    treaties: TreatyData[]
  ): number {
    let baseMultiplier = 1.0;

    // Embassy contribution (max +0.4)
    const activeEmbassies = embassies.filter((e) => e.status === "ACTIVE" || e.status === "active");
    const embassyBonus = Math.min(
      activeEmbassies.reduce((sum, e) => {
        const levelBonus = e.level * 0.02; // 2% per level
        const influenceBonus = (e.influence || 0) * 0.001; // 0.1% per influence point
        return sum + levelBonus + influenceBonus;
      }, 0),
      0.4 // Cap at +40%
    );

    // Trade relationship contribution (max +0.5)
    const tradeRelationships = relationships.filter(
      (r) => r.relationship === "alliance" || r.relationship === "trade"
    );
    const tradeBonus = Math.min(
      tradeRelationships.reduce((sum, r) => {
        const strengthBonus = (r.strength / 100) * 0.05; // 5% per strong relationship
        const volumeBonus = r.tradeVolume ? Math.log10(r.tradeVolume + 1) * 0.01 : 0;
        return sum + strengthBonus + volumeBonus;
      }, 0),
      0.5 // Cap at +50%
    );

    // Treaty contribution (max +0.3)
    const economicTreaties = treaties.filter((t) => t.type === "trade" || t.type === "economic");
    const treatyBonus = Math.min(economicTreaties.length * 0.05, 0.3); // 5% per treaty, cap at +30%

    // Diversity bonus (max +0.2)
    const uniquePartners = new Set([
      ...embassies.map((e) => e.countryId),
      ...relationships.map((r) => r.targetCountryId),
    ]).size;
    const diversityBonus = Math.min(uniquePartners * 0.01, 0.2); // 1% per unique partner

    // Network effect (max +0.1)
    // Bonus for having multiple strong connections
    const strongConnections = relationships.filter((r) => r.strength >= 70).length;
    const networkBonus = Math.min(strongConnections * 0.02, 0.1);

    baseMultiplier += embassyBonus + tradeBonus + treatyBonus + diversityBonus + networkBonus;

    return Math.min(Math.max(baseMultiplier, 1.0), 2.5);
  }

  /**
   * Calculate intelligence gathering bonus (0-100%)
   * From shared data, secure channels, embassy intelligence
   */
  static calculateIntelligenceBonus(
    sharedData: SharedDataPoint[],
    embassies: EmbassyData[],
    relationships: RelationshipData[]
  ): number {
    let bonus = 0;

    // Shared intelligence contribution (max +40%)
    const highValueData = sharedData.filter(
      (d) => d.classification === "CONFIDENTIAL" || d.classification === "RESTRICTED"
    );
    bonus += Math.min(highValueData.length * 2, 40); // 2% per high-value data point

    // Intelligence-focused embassies (max +30%)
    const intelligenceEmbassies = embassies.filter((e) => e.specialization === "intelligence");
    bonus += Math.min(
      intelligenceEmbassies.reduce((sum, e) => sum + e.level * 3, 0),
      30
    );

    // Strong alliance intelligence sharing (max +20%)
    const allianceRelationships = relationships.filter(
      (r) => r.relationship === "alliance" && r.strength >= 80
    );
    bonus += Math.min(allianceRelationships.length * 5, 20);

    // Network breadth bonus (max +10%)
    const intelligenceSources = new Set(sharedData.map((d) => d.sourceCountryId)).size;
    bonus += Math.min(intelligenceSources * 1, 10);

    return Math.min(bonus, 100);
  }

  /**
   * Calculate cultural influence (0-1000 points)
   * From exchanges and relationships
   */
  static calculateCulturalInfluence(
    culturalExchanges: CulturalExchangeData[],
    relationships: RelationshipData[]
  ): number {
    let influence = 0;

    // Active cultural exchanges
    const activeExchanges = culturalExchanges.filter((e) => e.status === "active");
    influence += activeExchanges.reduce((sum, e) => {
      const impactScore = e.culturalImpact || 0;
      const diplomaticScore = e.diplomaticValue || 0;
      const participantBonus = e.participatingCountries.length * 10;
      return sum + impactScore + diplomaticScore + participantBonus;
    }, 0);

    // Completed exchanges (legacy influence)
    const completedExchanges = culturalExchanges.filter((e) => e.status === "completed");
    influence += completedExchanges.length * 20; // 20 points per completed exchange

    // Relationship cultural affinity
    const culturalRelationships = relationships.filter((r) => r.strength >= 60);
    influence += culturalRelationships.length * 15;

    return Math.min(Math.max(influence, 0), 1000);
  }

  /**
   * Calculate total diplomatic power (0-10000)
   * Combined network strength
   */
  static calculateDiplomaticPower(
    embassies: EmbassyData[],
    relationships: RelationshipData[],
    treaties: TreatyData[]
  ): number {
    let power = 0;

    // Embassy power
    power += embassies.reduce((sum, e) => {
      return sum + e.level * 100 + (e.influence || 0);
    }, 0);

    // Relationship power
    power += relationships.reduce((sum, r) => {
      const baseValue = r.strength * 2; // Max 200 per relationship
      const typeMultiplier =
        r.relationship === "alliance" ? 1.5 : r.relationship === "trade" ? 1.2 : 1.0;
      return sum + baseValue * typeMultiplier;
    }, 0);

    // Treaty power
    power += treaties.filter((t) => t.status === "active").length * 150;

    return Math.min(Math.max(power, 0), 10000);
  }

  /**
   * Calculate research speed bonus (0-50%)
   * From collaborative research
   */
  static calculateResearchBonus(embassies: EmbassyData[], treaties: TreatyData[]): number {
    let bonus = 0;

    // Research-focused embassies
    const researchEmbassies = embassies.filter((e) => e.specialization === "research");
    bonus += researchEmbassies.reduce((sum, e) => sum + e.level * 3, 0);

    // Research treaties
    const researchTreaties = treaties.filter(
      (t) => t.type === "research" || t.type === "technology"
    );
    bonus += researchTreaties.length * 8;

    return Math.min(bonus, 50);
  }

  /**
   * Calculate trade route efficiency (0-200%)
   * Optimal routing through network
   */
  static calculateTradeEfficiency(
    relationships: RelationshipData[],
    embassies: EmbassyData[]
  ): number {
    let efficiency = 100; // Base 100%

    // Strong trade relationships
    const tradeRelationships = relationships.filter(
      (r) => (r.relationship === "trade" || r.relationship === "alliance") && r.strength >= 50
    );
    efficiency += tradeRelationships.length * 5; // +5% per strong trade relationship

    // Trade-focused embassies
    const tradeEmbassies = embassies.filter((e) => e.specialization === "trade");
    efficiency += tradeEmbassies.reduce((sum, e) => sum + e.level * 2, 0);

    // Network redundancy bonus (multiple routes)
    if (tradeRelationships.length >= 5) efficiency += 10;
    if (tradeRelationships.length >= 10) efficiency += 15;

    return Math.min(efficiency, 200);
  }

  /**
   * Calculate cultural soft power (0-100)
   * Global influence score
   */
  static calculateSoftPower(
    culturalExchanges: CulturalExchangeData[],
    culturalInfluence: number
  ): number {
    let softPower = 0;

    // Base from cultural influence
    softPower += culturalInfluence / 10; // Max 100 from 1000 influence

    // Diversity of cultural programs
    const uniqueTypes = new Set(culturalExchanges.map((e) => e.type)).size;
    softPower += uniqueTypes * 3;

    // International reach
    const uniqueCountries = new Set(
      culturalExchanges.flatMap((e) => e.participatingCountries.map((p) => p.countryId))
    ).size;
    softPower += uniqueCountries * 2;

    return Math.min(Math.max(softPower, 0), 100);
  }

  /**
   * Calculate alliance strength (0-100)
   * Military/security benefits
   */
  static calculateAllianceStrength(
    relationships: RelationshipData[],
    treaties: TreatyData[]
  ): number {
    let strength = 0;

    // Alliance relationships
    const alliances = relationships.filter((r) => r.relationship === "alliance");
    strength += alliances.reduce((sum, r) => sum + r.strength / 2, 0); // Max 50 per alliance

    // Security treaties
    const securityTreaties = treaties.filter(
      (t) => t.type === "defense" || t.type === "security" || t.type === "military"
    );
    strength += securityTreaties.length * 15;

    // Network strength (mutual allies)
    if (alliances.length >= 3) strength += 10;
    if (alliances.length >= 5) strength += 15;

    return Math.min(Math.max(strength, 0), 100);
  }

  /**
   * Identify economic bloc membership
   */
  static identifyEconomicBloc(
    relationships: RelationshipData[],
    treaties: TreatyData[]
  ): NetworkSynergyData["economicBloc"] {
    const members: string[] = [];
    let totalGdp = 0;
    let tradeVolume = 0;

    // Find strong economic partners
    const economicPartners = relationships.filter(
      (r) => (r.relationship === "alliance" || r.relationship === "trade") && r.strength >= 60
    );

    economicPartners.forEach((r) => {
      members.push(r.targetCountryId);
      tradeVolume += r.tradeVolume || 0;
    });

    // Calculate power ranking (simplified)
    const powerRanking = Math.min(Math.floor(members.length * 10 + tradeVolume / 1000000), 100);

    return {
      members,
      totalGdp,
      tradeVolume,
      powerRanking,
    };
  }

  /**
   * Find strategic opportunities
   */
  static findOpportunities(data: {
    countryId: string;
    embassies: EmbassyData[];
    relationships: RelationshipData[];
    culturalExchanges: CulturalExchangeData[];
    treaties: TreatyData[];
  }): Opportunity[] {
    const opportunities: Opportunity[] = [];

    // Triangulation opportunities (partners' partners)
    const partnerIds = new Set(data.relationships.map((r) => r.targetCountryId));
    // In real implementation, would query for partners' relationships

    // Economic complementarity (missing trade relationships)
    const hasTradeWith = new Set(
      data.relationships
        .filter((r) => r.relationship === "trade" || r.relationship === "alliance")
        .map((r) => r.targetCountryId)
    );

    // Cultural affinity (shared cultural exchanges)
    const culturalPartners = new Set(
      data.culturalExchanges.flatMap((e) => e.participatingCountries.map((p) => p.countryId))
    );

    // Example opportunity (in real implementation, would be data-driven)
    if (data.relationships.length < 5) {
      opportunities.push({
        id: "expand_network",
        type: "economic_complementarity",
        targetCountry: "Potential Partners",
        targetCountryId: "various",
        score: 75,
        reasoning:
          "Your diplomatic network is still developing. Expanding to 5+ strong relationships would unlock network effects.",
        potentialBenefits: {
          economic: 15,
          diplomatic: 20,
        },
        recommendedAction: "Establish embassies in complementary economies",
        priority: "high",
      });
    }

    return opportunities;
  }

  /**
   * Identify network vulnerabilities
   */
  static identifyVulnerabilities(data: {
    countryId: string;
    embassies: EmbassyData[];
    relationships: RelationshipData[];
    treaties: TreatyData[];
  }): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    // Over-dependency check (single dominant relationship)
    const totalRelationshipStrength = data.relationships.reduce((sum, r) => sum + r.strength, 0);
    const strongestRelationship = Math.max(...data.relationships.map((r) => r.strength), 0);

    if (totalRelationshipStrength > 0 && strongestRelationship / totalRelationshipStrength > 0.5) {
      vulnerabilities.push({
        id: "over_dependency",
        type: "over_dependency",
        severity: "high",
        description: "Your diplomatic network is heavily dependent on a single relationship",
        affectedCountries: [
          data.relationships.find((r) => r.strength === strongestRelationship)?.targetCountryId ||
            "unknown",
        ],
        riskScore: 75,
        mitigation:
          "Diversify your diplomatic portfolio by strengthening relationships with additional partners",
      });
    }

    // Weak diversification (too few partners)
    if (data.relationships.length < 3) {
      vulnerabilities.push({
        id: "weak_diversification",
        type: "weak_diversification",
        severity: "medium",
        description: "Limited diplomatic network provides fewer opportunities and increased risk",
        affectedCountries: [],
        riskScore: 60,
        mitigation: "Establish relationships with at least 5 countries for network resilience",
      });
    }

    // Tension exposure
    const tensionRelationships = data.relationships.filter((r) => r.relationship === "tension");
    if (tensionRelationships.length > 0) {
      vulnerabilities.push({
        id: "rivalry_exposure",
        type: "rivalry_exposure",
        severity: "medium",
        description: `You have ${tensionRelationships.length} tense relationship(s) that may create complications`,
        affectedCountries: tensionRelationships.map((r) => r.targetCountryId),
        riskScore: 50 + tensionRelationships.length * 10,
        mitigation:
          "Consider diplomatic initiatives to resolve tensions or strengthen alliances for balance",
      });
    }

    return vulnerabilities;
  }

  /**
   * Identify competitive advantages
   */
  static identifyCompetitiveAdvantages(data: {
    embassies: EmbassyData[];
    relationships: RelationshipData[];
    culturalExchanges: CulturalExchangeData[];
    treaties: TreatyData[];
  }): string[] {
    const advantages: string[] = [];

    // Strong alliance network
    const alliances = data.relationships.filter((r) => r.relationship === "alliance");
    if (alliances.length >= 3) {
      advantages.push(
        `Strong Alliance Network: ${alliances.length} formal alliances provide security and trade benefits`
      );
    }

    // Cultural dominance
    if (data.culturalExchanges.length >= 5) {
      advantages.push(
        `Cultural Influence: ${data.culturalExchanges.length} cultural programs enhance soft power globally`
      );
    }

    // Embassy excellence
    const highLevelEmbassies = data.embassies.filter((e) => e.level >= 3);
    if (highLevelEmbassies.length >= 3) {
      advantages.push(
        `Diplomatic Excellence: ${highLevelEmbassies.length} high-level embassies provide enhanced capabilities`
      );
    }

    // Treaty framework
    const activeTreaties = data.treaties.filter((t) => t.status === "active");
    if (activeTreaties.length >= 5) {
      advantages.push(
        `Legal Framework: ${activeTreaties.length} active treaties provide stable international framework`
      );
    }

    // Diverse specializations
    const specializations = new Set(
      data.embassies.filter((e) => e.specialization).map((e) => e.specialization)
    );
    if (specializations.size >= 3) {
      advantages.push(
        `Specialized Capabilities: ${specializations.size} different embassy specializations provide diverse strengths`
      );
    }

    return advantages;
  }

  /**
   * Calculate choice simulation
   * Simulate different diplomatic decisions
   */
  static simulateChoice(
    currentNetwork: NetworkSynergyData,
    choice: {
      type: "establish_embassy" | "cultural_exchange" | "treaty" | "break_ties";
      targetCountry: string;
      parameters: Record<string, any>;
    }
  ): {
    newNetwork: NetworkSynergyData;
    delta: Partial<NetworkSynergyData>;
    recommendation:
      | "highly_recommended"
      | "recommended"
      | "neutral"
      | "not_recommended"
      | "strongly_discouraged";
    reasoning: string;
  } {
    // Create a copy of current network for simulation
    const newNetwork = { ...currentNetwork };
    const delta: Partial<NetworkSynergyData> = {};

    let economicDelta = 0;
    let intelligenceDelta = 0;
    let culturalDelta = 0;
    let diplomaticDelta = 0;

    switch (choice.type) {
      case "establish_embassy":
        economicDelta = 0.05; // +5% economic multiplier
        intelligenceDelta = 5; // +5% intelligence bonus
        diplomaticDelta = 200; // +200 diplomatic power
        newNetwork.economicMultiplier = Math.min(
          currentNetwork.economicMultiplier + economicDelta,
          2.5
        );
        newNetwork.intelligenceBonus = Math.min(
          currentNetwork.intelligenceBonus + intelligenceDelta,
          100
        );
        newNetwork.diplomaticPower = Math.min(
          currentNetwork.diplomaticPower + diplomaticDelta,
          10000
        );
        break;

      case "cultural_exchange":
        culturalDelta = 50; // +50 cultural influence
        economicDelta = 0.02; // +2% economic multiplier (soft power benefits)
        newNetwork.culturalInfluence = Math.min(
          currentNetwork.culturalInfluence + culturalDelta,
          1000
        );
        newNetwork.culturalSoftPower = Math.min(currentNetwork.culturalSoftPower + 5, 100);
        newNetwork.economicMultiplier = Math.min(
          currentNetwork.economicMultiplier + economicDelta,
          2.5
        );
        break;

      case "treaty":
        economicDelta = 0.08; // +8% economic multiplier (treaties are significant)
        diplomaticDelta = 300; // +300 diplomatic power
        newNetwork.economicMultiplier = Math.min(
          currentNetwork.economicMultiplier + economicDelta,
          2.5
        );
        newNetwork.diplomaticPower = Math.min(
          currentNetwork.diplomaticPower + diplomaticDelta,
          10000
        );
        break;

      case "break_ties":
        economicDelta = -0.1; // -10% economic multiplier (breaking ties hurts)
        diplomaticDelta = -500; // -500 diplomatic power
        intelligenceDelta = -10; // -10% intelligence bonus
        newNetwork.economicMultiplier = Math.max(
          currentNetwork.economicMultiplier + economicDelta,
          1.0
        );
        newNetwork.diplomaticPower = Math.max(currentNetwork.diplomaticPower + diplomaticDelta, 0);
        newNetwork.intelligenceBonus = Math.max(
          currentNetwork.intelligenceBonus + intelligenceDelta,
          0
        );
        break;
    }

    delta.economicMultiplier = economicDelta;
    delta.intelligenceBonus = intelligenceDelta;
    delta.culturalInfluence = culturalDelta;
    delta.diplomaticPower = diplomaticDelta;

    // Determine recommendation
    const totalImpact =
      economicDelta * 100 + intelligenceDelta + culturalDelta / 10 + diplomaticDelta / 100;

    let recommendation:
      | "highly_recommended"
      | "recommended"
      | "neutral"
      | "not_recommended"
      | "strongly_discouraged";
    let reasoning: string;

    if (totalImpact >= 50) {
      recommendation = "highly_recommended";
      reasoning =
        "This action provides significant benefits across multiple dimensions of your diplomatic network";
    } else if (totalImpact >= 20) {
      recommendation = "recommended";
      reasoning = "This action provides solid benefits and strengthens your network position";
    } else if (totalImpact >= -10) {
      recommendation = "neutral";
      reasoning = "This action has minimal impact on your overall network strength";
    } else if (totalImpact >= -30) {
      recommendation = "not_recommended";
      reasoning = "This action may weaken your network position without clear benefits";
    } else {
      recommendation = "strongly_discouraged";
      reasoning =
        "This action would significantly harm your diplomatic network and should be avoided unless absolutely necessary";
    }

    return {
      newNetwork,
      delta,
      recommendation,
      reasoning,
    };
  }

  // ==================== BREAKDOWN CALCULATIONS ====================

  private static calculateEmbassyContribution(embassies: EmbassyData[]): number {
    return embassies.reduce((sum, e) => {
      return sum + e.level * 10 + (e.influence || 0) / 10;
    }, 0);
  }

  private static calculateRelationshipContribution(relationships: RelationshipData[]): number {
    return relationships.reduce((sum, r) => {
      const typeMultiplier =
        r.relationship === "alliance" ? 1.5 : r.relationship === "trade" ? 1.2 : 1.0;
      return sum + r.strength * typeMultiplier;
    }, 0);
  }

  private static calculateCulturalContribution(culturalExchanges: CulturalExchangeData[]): number {
    return culturalExchanges.reduce((sum, e) => {
      return sum + (e.culturalImpact || 0) + (e.diplomaticValue || 0);
    }, 0);
  }

  private static calculateTreatyContribution(treaties: TreatyData[]): number {
    return treaties.filter((t) => t.status === "active").length * 50;
  }

  private static calculateIntelligenceContribution(sharedData: SharedDataPoint[]): number {
    return sharedData.reduce((sum, d) => {
      const classificationMultiplier =
        d.classification === "CONFIDENTIAL" ? 3 : d.classification === "RESTRICTED" ? 2 : 1;
      return sum + 10 * classificationMultiplier;
    }, 0);
  }
}
