/**
 * Social Profile Data Transformer
 * Converts existing country data to enhanced social profile format
 * Integrates with existing APIs while providing enhanced social features
 */

import type { 
  EnhancedCountryProfileData,
  SocialMetrics,
  NationalMilestone,
  DiplomaticRelation,
  SocialActivity,
  AchievementConstellation,
  RegionalContext,
  GrowthStreak,
  UniqueAchievement,
  MilestoneTarget
} from "~/types/social-profile";
import type { CountryCardData } from "~/components/countries/CountryFocusCard";
import { IxTime } from "~/lib/ixtime";

// Updated to match tRPC country data structure
interface CountryDataInput {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea?: number;
  populationDensity?: number;
  gdpDensity?: number;
  adjustedGdpGrowth?: number;
  populationGrowthRate?: number;
  lastCalculated?: Date | number;
  createdAt?: Date | number;
  updatedAt?: Date | number;
  // Additional fields from tRPC response
  continent?: string;
  region?: string;
  governmentType?: string;
  leader?: string;
  religion?: string;
  analytics?: {
    visits?: number;
    riskFlags?: string[];
  };
  baselineDate?: Date | number;
}

export class SocialProfileTransformer {
  /**
   * Transform basic country data into enhanced social profile
   */
  static transformCountryData(
    countryData: CountryDataInput,
    flagUrl?: string,
    unsplashImageUrl?: string,
    additionalSocialData?: Partial<EnhancedCountryProfileData>
  ): EnhancedCountryProfileData {
    
    const socialMetrics = this.generateSocialMetrics(countryData);
    const achievementConstellation = this.generateAchievementConstellation(countryData);
    const diplomaticRelations = this.generateDiplomaticRelations(countryData);
    const recentActivities = this.generateRecentActivities(countryData, achievementConstellation.recentMilestones);
    const regionalContext = this.generateRegionalContext(countryData);

    return {
      // Basic country data
      ...countryData,
      flagUrl,
      unsplashImageUrl,
      
      // Enhanced social features
      socialMetrics,
      achievementConstellation,
      diplomaticRelations,
      recentActivities,
      
      // Social interactions (empty for now, would be populated by real API)
      followers: [],
      recentVisitors: [],
      publicMessages: [],
      collaborationRequests: [],
      
      // Context and rankings
      regionalContext,
      globalRanking: this.calculateGlobalRanking(countryData),
      regionalRanking: this.calculateRegionalRanking(countryData),
      growthStreak: this.calculateGrowthStreak(countryData),
      influenceLevel: this.determineInfluenceLevel(countryData),
      
      // Temporal context
      lastUpdated: IxTime.getCurrentIxTime().toFixed(2),
      profileCreated: countryData.createdAt
        ? (typeof countryData.createdAt === 'number' ? IxTime.getCurrentIxTime().toFixed(2) : IxTime.getCurrentIxTime().toFixed(2))
        : "IxTime 2028.1",
      nextMilestoneCheck: (IxTime.getCurrentIxTime() + 0.1).toFixed(2),
      
      // Override with any additional social data
      ...additionalSocialData
    };
  }

  /**
   * Generate realistic social metrics based on country performance
   */
  private static generateSocialMetrics(country: CountryDataInput): SocialMetrics {
    // Base metrics on economic performance and tier
    const economicWeight = this.getEconomicTierWeight(country.economicTier);
    const gdpWeight = Math.log10(country.currentTotalGdp || 1e9) / 15; // Normalized log scale
    const popWeight = Math.log10(country.currentPopulation || 1e6) / 10; // Normalized log scale
    
    const baseInfluence = (economicWeight * 0.4) + (gdpWeight * 0.4) + (popWeight * 0.2);
    
    // Use deterministic values based on country ID to avoid hydration mismatches
    const deterministicSeed = this.getDeterministicSeed(country.id);
    
    return {
      followers: Math.max(3, Math.floor(baseInfluence * 25 + deterministicSeed * 15)),
      recentVisitors: Math.max(1, Math.floor(baseInfluence * 8 + deterministicSeed * 5)),
      diplomaticRelationships: Math.max(2, Math.floor(baseInfluence * 15 + deterministicSeed * 8)),
      achievementPoints: Math.floor(baseInfluence * 400 + deterministicSeed * 200 + 100),
      influenceScore: Math.min(100, baseInfluence * 100 + deterministicSeed * 20),
      engagementRate: Math.min(0.25, baseInfluence * 0.15 + deterministicSeed * 0.1)
    };
  }

  /**
   * Generate achievement constellation based on country performance
   */
  private static generateAchievementConstellation(country: CountryDataInput): AchievementConstellation {
    const recentMilestones = this.generateRecentMilestones(country);
    const activeStreaks = this.generateActiveStreaks(country);
    const rareAccomplishments = this.generateRareAccomplishments(country);
    const upcomingTargets = this.generateUpcomingTargets(country);

    const totalScore = recentMilestones.length * 100 + 
                     activeStreaks.reduce((sum, streak) => sum + streak.currentStreak * 10, 0) +
                     rareAccomplishments.length * 200;

    return {
      recentMilestones,
      activeStreaks,
      rareAccomplishments,
      upcomingTargets,
      totalAchievementScore: totalScore,
      achievementRanking: {
        global: this.calculateAchievementRanking(totalScore, 'global'),
        regional: this.calculateAchievementRanking(totalScore, 'regional'),
        tierBased: this.calculateAchievementRanking(totalScore, 'tier')
      }
    };
  }

  /**
   * Generate realistic milestones based on country data
   */
  private static generateRecentMilestones(country: CountryDataInput): NationalMilestone[] {
    const milestones: NationalMilestone[] = [];
    const currentTime = IxTime.getCurrentIxTime();

    // Economic tier milestone
    if (["Very Strong", "Extravagant"].includes(country.economicTier)) {
      milestones.push({
        id: `milestone-economic-${country.id}`,
        title: `${country.economicTier} Economic Status`,
        description: `Achieved ${country.economicTier} economic tier with GDP per capita of ${this.formatCurrency(country.currentGdpPerCapita)}`,
        category: 'economic',
        tier: country.economicTier === "Extravagant" ? "platinum" : "gold",
        achievedAt: `IxTime ${(currentTime - 0.1).toFixed(2)}`,
        ixTimeEpoch: currentTime - 0.1,
        celebrationState: "acknowledged",
        socialReactions: [],
        rarity: country.economicTier === "Extravagant" ? 95 : 80,
        icon: "trophy"
      });
    }

    // Growth milestone
    if (country.adjustedGdpGrowth && country.adjustedGdpGrowth > 0.02) {
      milestones.push({
        id: `milestone-growth-${country.id}`,
        title: "Economic Growth Excellence",
        description: `Maintained exceptional ${(country.adjustedGdpGrowth * 100).toFixed(1)}% GDP growth rate`,
        category: 'economic',
        tier: country.adjustedGdpGrowth > 0.05 ? "gold" : "silver",
        achievedAt: `IxTime ${(currentTime - 0.05).toFixed(2)}`,
        ixTimeEpoch: currentTime - 0.05,
        celebrationState: country.adjustedGdpGrowth > 0.05 ? "new" : "acknowledged",
        socialReactions: [],
        rarity: Math.min(90, 50 + (country.adjustedGdpGrowth * 1000)),
        icon: "trending-up"
      });
    }

    // Population milestone
    if (country.currentPopulation > 100_000_000) {
      milestones.push({
        id: `milestone-population-${country.id}`,
        title: "Population Milestone",
        description: `Reached ${this.formatPopulation(country.currentPopulation)} citizens`,
        category: 'social',
        tier: country.currentPopulation > 500_000_000 ? "gold" : "silver",
        achievedAt: `IxTime ${(currentTime - 0.2).toFixed(2)}`,
        ixTimeEpoch: currentTime - 0.2,
        celebrationState: "acknowledged",
        socialReactions: [],
        rarity: 70,
        icon: "users"
      });
    }

    return milestones;
  }

  /**
   * Generate diplomatic relations based on country characteristics
   */
  private static generateDiplomaticRelations(country: CountryDataInput): DiplomaticRelation[] {
    const sampleCountries = [
      "Lysandria", "Valorheim", "Crystalia", "Shadowmere", "Goldshore",
      "Ironhold", "Starfall", "Moonhaven", "Dragonspire", "Frostpeak",
      "Silvermere", "Stormwatch", "Brightshore", "Darkwood", "Sunspear"
    ];

    const relationCount = Math.min(12, Math.max(3, 
      Math.floor(this.getEconomicTierWeight(country.economicTier) * 10)
    ));

    const selectedCountries = sampleCountries
      .map((name, idx) => ({ name, sort: this.getDeterministicRandom(country.id, idx + 100) }))
      .sort((a, b) => a.sort - b.sort)
      .slice(0, relationCount)
      .map(item => item.name);

    return selectedCountries.map((countryName, index) => {
      const relationTypes: DiplomaticRelation['relationType'][] = [
        'alliance', 'trade', 'neutral', 'tension'
      ];
      
      // Higher tier countries more likely to have positive relations
      const tierWeight = this.getEconomicTierWeight(country.economicTier);
      const positiveRelationChance = tierWeight * 0.8 + 0.2; // 20-100% chance
      
      const relationRand = this.getDeterministicRandom(country.id, index + 200);
      const typeRand = this.getDeterministicRandom(country.id, index + 300);
      const conflictRand = this.getDeterministicRandom(country.id, index + 400);
      
      const relationType: DiplomaticRelation['relationType'] = relationRand < positiveRelationChance 
        ? (relationTypes[Math.floor(typeRand * relationTypes.length)] || 'neutral') // Positive relations
        : conflictRand < 0.1 ? 'tension' : 'neutral'; // Small chance of tension instead of rivalry
      
      const strengthRand = this.getDeterministicRandom(country.id, index + 500);
      const strength = Math.floor(strengthRand * 40) + 60; // 60-100%

      return {
        id: `diplomatic-${country.id}-${index}`,
        countryId: `country-${countryName.toLowerCase()}`,
        countryName,
        flagUrl: undefined,
        relationType,
        relationshipStrength: strength,
        establishedDate: `IxTime ${(2028 + this.getDeterministicRandom(country.id, index + 600) * 2).toFixed(2)}`,
        lastInteraction: `IxTime ${(IxTime.getCurrentIxTime() - this.getDeterministicRandom(country.id, index + 700) * 0.5).toFixed(2)}`,
        recentActivity: [{
          id: `activity-diplomatic-${index}`,
          type: relationType === 'trade' ? 'trade_agreement' : 'diplomatic_visit',
          title: relationType === 'trade' ? 'Trade Agreement Renewed' : 'Diplomatic Summit',
          description: `Recent ${relationType} activities with ${countryName}`,
          timestamp: `IxTime ${(IxTime.getCurrentIxTime() - this.getDeterministicRandom(country.id, index + 800) * 0.3).toFixed(2)}`,
          impact: 'positive',
          participants: [country.name, countryName]
        }],
        treatiesActive: [],
        tradeValue: relationType === 'trade' ? Math.floor(this.getDeterministicRandom(country.id, index + 900) * 50e9) + 10e9 : undefined,
        mutualBenefits: this.generateMutualBenefits(relationType)
      };
    });
  }

  /**
   * Generate recent activities based on country data and achievements
   */
  private static generateRecentActivities(
    country: CountryDataInput,
    achievements: NationalMilestone[]
  ): SocialActivity[] {
    const activities: SocialActivity[] = [];
    const currentTime = IxTime.getCurrentIxTime();

    // Achievement-based activities
    achievements.forEach((achievement, index) => {
      if (achievement.celebrationState === 'new') {
        activities.push({
          id: `activity-achievement-${achievement.id}`,
          type: 'achievement_earned',
          title: 'New Achievement Unlocked!',
          description: `${country.name} earned the "${achievement.title}" achievement`,
          timestamp: achievement.achievedAt,
          importance: achievement.tier === 'platinum' ? 'critical' : 
                     achievement.tier === 'gold' ? 'high' : 'medium',
          category: 'achievement',
          visibilityLevel: 'public',
          engagementMetrics: {
            views: Math.floor(this.getDeterministicRandom(country.id, index + 1000) * 200) + 50,
            reactions: Math.floor(this.getDeterministicRandom(country.id, index + 1100) * 40) + 10,
            shares: Math.floor(this.getDeterministicRandom(country.id, index + 1200) * 15) + 2,
            comments: Math.floor(this.getDeterministicRandom(country.id, index + 1300) * 10) + 1
          }
        });
      }
    });

    // Growth-based activities
    if (country.adjustedGdpGrowth && country.adjustedGdpGrowth > 0.01) {
      activities.push({
        id: `activity-growth-${country.id}`,
        type: 'growth_streak',
        title: 'Economic Growth Maintained',
        description: `Continued positive economic trajectory with ${(country.adjustedGdpGrowth * 100).toFixed(1)}% growth`,
        timestamp: `IxTime ${(currentTime - 0.08).toFixed(2)}`,
        importance: country.adjustedGdpGrowth > 0.03 ? 'high' : 'medium',
        category: 'economy',
        visibilityLevel: 'public',
        engagementMetrics: {
          views: Math.floor(this.getDeterministicRandom(country.id, 2000) * 150) + 30,
          reactions: Math.floor(this.getDeterministicRandom(country.id, 2100) * 25) + 8,
          shares: Math.floor(this.getDeterministicRandom(country.id, 2200) * 10) + 3,
          comments: Math.floor(this.getDeterministicRandom(country.id, 2300) * 8) + 2
        }
      });
    }

    // Diplomatic activities
    activities.push({
      id: `activity-diplomatic-${country.id}`,
      type: 'diplomatic_event',
      title: 'International Relations Update',
      description: `Strengthened diplomatic ties and expanded international cooperation`,
      timestamp: `IxTime ${(currentTime - 0.15).toFixed(2)}`,
      importance: 'medium',
      category: 'diplomacy',
      visibilityLevel: 'public',
      engagementMetrics: {
        views: Math.floor(this.getDeterministicRandom(country.id, 3000) * 100) + 25,
        reactions: Math.floor(this.getDeterministicRandom(country.id, 3100) * 20) + 5,
        shares: Math.floor(this.getDeterministicRandom(country.id, 3200) * 8) + 1,
        comments: Math.floor(this.getDeterministicRandom(country.id, 3300) * 6) + 1
      }
    });

    return activities.sort((a, b) => 
      parseFloat(b.timestamp.replace('IxTime ', '')) - parseFloat(a.timestamp.replace('IxTime ', ''))
    );
  }

  /**
   * Generate regional context based on country characteristics
   */
  private static generateRegionalContext(country: CountryDataInput): RegionalContext {
    // Use actual country data if available, fallback to generated data
    const actualRegion = country.region;
    const actualContinent = country.continent;
    
    const fallbackRegions = ["Northern Kingdoms", "Southern Republics", "Eastern Empires", "Western Federation"];
    const fallbackContinents = ["Aethermoor", "Valdris", "Nethys", "Zorrath"];
    
    const regionIndex = Math.floor(this.getDeterministicRandom(country.id, 1000) * fallbackRegions.length);
    const continentIndex = Math.floor(this.getDeterministicRandom(country.id, 1100) * fallbackContinents.length);

    const regionName = actualRegion || fallbackRegions[regionIndex];
    const continentName = actualContinent || fallbackContinents[continentIndex];

    return {
      regionName: regionName || "Unknown Region",
      continent: continentName || "Unknown Continent", 
      neighboringCountries: ["Lysandria", "Valorheim", "Crystalia"].slice(0, Math.floor(this.getDeterministicRandom(country.id, 1200) * 3) + 1),
      regionalRanking: {
        economic: Math.floor(this.getDeterministicRandom(country.id, 1300) * 20) + 1,
        population: Math.floor(this.getDeterministicRandom(country.id, 1400) * 25) + 1,
        influence: Math.floor(this.getDeterministicRandom(country.id, 1500) * 15) + 1,
        development: Math.floor(this.getDeterministicRandom(country.id, 1600) * 18) + 1
      },
      regionalEvents: [],
      tradingBlocs: [`${regionName} Trade Alliance`, `${continentName} Economic Zone`],
      culturalConnections: ["Ancient Kingdoms Heritage", `${regionName} Cultural Circle`]
    };
  }

  // Helper methods

  private static getDeterministicSeed(countryId: string, variant = 0): number {
    // Create deterministic seed from country ID to avoid hydration mismatches
    let hash = variant;
    for (let i = 0; i < countryId.length; i++) {
      const char = countryId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Normalize to 0-1 range
    return Math.abs(hash) / 2147483647;
  }

  private static getDeterministicRandom(countryId: string, seed: number): number {
    return this.getDeterministicSeed(countryId, seed);
  }

  private static getEconomicTierWeight(tier: string): number {
    const weights: Record<string, number> = {
      'Extravagant': 1.0,
      'Very Strong': 0.85,
      'Strong': 0.70,
      'Healthy': 0.55,
      'Developed': 0.40,
      'Developing': 0.25,
      'Impoverished': 0.10
    };
    return weights[tier] || 0.30;
  }

  private static calculateGlobalRanking(country: CountryDataInput): number {
    // Simplified ranking calculation based on GDP per capita and total GDP
    const economicScore = (Math.log10(country.currentGdpPerCapita || 1000) * 0.6) + 
                         (Math.log10(country.currentTotalGdp || 1e9) * 0.4);
    
    // Convert to ranking (lower scores = higher rankings)
    return Math.max(1, Math.floor((20 - economicScore) * 12) + Math.floor(this.getDeterministicRandom(country.id, 4000) * 10));
  }

  private static calculateRegionalRanking(country: CountryDataInput): number {
    // Use deterministic ranking based on country characteristics
    const economicWeight = this.getEconomicTierWeight(country.economicTier);
    const deterministicSeed = this.getDeterministicSeed(country.id, 2000);
    const baseRanking = Math.floor((1 - economicWeight) * 20) + Math.floor(deterministicSeed * 10) + 1;
    return Math.max(1, Math.min(25, baseRanking));
  }

  private static calculateGrowthStreak(country: CountryDataInput): number {
    if (!country.adjustedGdpGrowth || country.adjustedGdpGrowth <= 0) return 0;
    
    // Simulate streak based on growth rate
    const baseStreak = Math.floor(country.adjustedGdpGrowth * 200); // Higher growth = longer streaks
    return Math.max(0, baseStreak + Math.floor(this.getDeterministicRandom(country.id, 5000) * 3));
  }

  private static determineInfluenceLevel(country: CountryDataInput): 'emerging' | 'regional' | 'major' | 'global' | 'superpower' {
    const totalGdp = country.currentTotalGdp || 0;
    
    if (totalGdp > 10e12) return 'superpower';
    if (totalGdp > 3e12) return 'global';
    if (totalGdp > 800e9) return 'major';
    if (totalGdp > 200e9) return 'regional';
    return 'emerging';
  }

  private static generateActiveStreaks(country: CountryDataInput): GrowthStreak[] {
    const streaks: GrowthStreak[] = [];
    
    if (country.adjustedGdpGrowth && country.adjustedGdpGrowth > 0) {
      streaks.push({
        id: `streak-economic-${country.id}`,
        type: 'economic',
        currentStreak: this.calculateGrowthStreak(country),
        bestStreak: Math.floor(this.getDeterministicRandom(country.id, 6000) * 8) + this.calculateGrowthStreak(country),
        lastUpdate: `IxTime ${IxTime.getCurrentIxTime().toFixed(2)}`,
        isActive: true,
        milestones: [
          { quarters: 4, title: "Steady Growth", unlocked: true, unlockedAt: "IxTime 2029.8" },
          { quarters: 8, title: "Growth Master", unlocked: false },
          { quarters: 12, title: "Growth Legend", unlocked: false }
        ]
      });
    }

    return streaks;
  }

  private static generateRareAccomplishments(country: CountryDataInput): UniqueAchievement[] {
    const accomplishments: UniqueAchievement[] = [];
    
    if (country.economicTier === "Extravagant") {
      accomplishments.push({
        id: `rare-extravagant-${country.id}`,
        title: "Elite Economic Circle",
        description: "Member of the exclusive Extravagant economic tier",
        uniqueCategory: 'highest_tier',
        globalRarity: 5, // Only 5 countries worldwide
        specialBadge: "crown",
        historicalSignificance: "Achieved the highest possible economic development status"
      });
    }

    return accomplishments;
  }

  private static generateUpcomingTargets(country: CountryDataInput): MilestoneTarget[] {
    const targets: MilestoneTarget[] = [];
    const currentTime = IxTime.getCurrentIxTime();
    
    // Next economic tier target
    const nextTier = this.getNextEconomicTier(country.economicTier);
    if (nextTier && nextTier !== null) {
      const targetGdp = this.getMinGdpForTier(nextTier);
      const progress = (country.currentGdpPerCapita / targetGdp) * 100;
      
      targets.push({
        id: `target-tier-${country.id}`,
        title: `Achieve ${nextTier} Status`,
        description: `Reach ${nextTier} economic tier`,
        category: 'economic',
        targetValue: targetGdp,
        currentValue: country.currentGdpPerCapita,
        progressPercentage: Math.min(99, progress),
        estimatedCompletion: progress > 80 ? `IxTime ${(currentTime + 0.5).toFixed(2)}` : undefined,
        difficulty: progress > 50 ? 'medium' : 'hard',
        rewards: [`${nextTier} tier status`, "Increased diplomatic influence", "Economic achievement unlock"]
      });
    }

    return targets;
  }

  private static getNextEconomicTier(currentTier: string): string | undefined {
    const tiers = ['Impoverished', 'Developing', 'Developed', 'Healthy', 'Strong', 'Very Strong', 'Extravagant'];
    const currentIndex = tiers.indexOf(currentTier);
    return currentIndex >= 0 && currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : undefined;
  }

  private static getMinGdpForTier(tier: string): number {
    const thresholds: Record<string, number> = {
      'Developing': 10000,
      'Developed': 25000,
      'Healthy': 35000,
      'Strong': 45000,
      'Very Strong': 55000,
      'Extravagant': 65000
    };
    return thresholds[tier] || 100000;
  }

  private static calculateAchievementRanking(score: number, type: 'global' | 'regional' | 'tier'): number {
    const multiplier = type === 'global' ? 200 : type === 'regional' ? 30 : 15;
    const baseRanking = Math.max(1, multiplier - Math.floor(score / 50));
    return baseRanking + Math.floor(this.getDeterministicRandom(country.id + type, 7000) * 10);
  }

  private static generateMutualBenefits(relationType: DiplomaticRelation['relationType']): string[] {
    const benefitMap: Record<string, string[]> = {
      alliance: ['Military cooperation', 'Shared intelligence', 'Diplomatic support'],
      trade: ['Economic cooperation', 'Market access', 'Resource sharing'],
      defense_pact: ['Military alliance', 'Security cooperation', 'Joint defense'],
      neutral: ['Cultural exchange', 'Limited cooperation', 'Peaceful coexistence'],
      tension: ['Careful diplomacy', 'Conflict prevention'],
      rivalry: ['Competitive relations', 'Strategic opposition']
    };
    return benefitMap[relationType] || ['Diplomatic relations'];
  }

  private static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private static formatPopulation(population: number): string {
    if (population >= 1e9) {
      return `${(population / 1e9).toFixed(1)}B`;
    } else if (population >= 1e6) {
      return `${(population / 1e6).toFixed(1)}M`;
    } else if (population >= 1e3) {
      return `${(population / 1e3).toFixed(1)}K`;
    }
    return population.toLocaleString();
  }
}

export default SocialProfileTransformer;