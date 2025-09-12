/**
 * MyCountry API Router - Dedicated endpoints for MyCountry system
 * 
 * This router provides specialized endpoints for the MyCountry interface including:
 * - Intelligence feed aggregation from multiple sources
 * - Achievement system with real-time calculations
 * - Executive dashboard data compilation  
 * - National vitality metrics computation
 * - Historical timeline and milestone tracking
 * - Real-time notification generation
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure, countryOwnerProcedure, executiveProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { db } from "~/server/db";
import { standardize } from "~/lib/interface-standardizer";
import { unifyIntelligenceItem, adaptExecutiveToQuick } from "~/lib/transformers/interface-adapters";
import type { 
  CountryWithEconomicData,
  IntelligenceItem,
  Achievement,
  Milestone,
  Ranking,
  VitalityScores,
  ExecutiveAction,
  NationalSummary
} from "~/types/mycountry";

// Cache for expensive operations
const myCountryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

/**
 * Cache helper functions for MyCountry-specific data
 */
function getMyCountryCache(key: string): any | null {
  const cached = myCountryCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  if (cached) {
    myCountryCache.delete(key);
  }
  return null;
}

function setMyCountryCache(key: string, data: any, ttl = 60000): void {
  myCountryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Calculate national vitality scores based on comprehensive country data
 */
function calculateVitalityScores(country: CountryWithEconomicData): VitalityScores {
  // Economic Vitality (0-100 scale)
  const economicVitality = Math.min(100, Math.max(0, 
    (country.adjustedGdpGrowth * 100 * 10) + 
    (country.currentGdpPerCapita / 2000) + 
    30
  ));
  
  // Population Wellbeing (0-100 scale)  
  const populationWellbeing = Math.min(100, Math.max(0,
    (country.populationGrowthRate * 100 * 20) + 
    (getTierScore(country.populationTier) * 10) + 
    25
  ));
  
  // Diplomatic Standing (calculated from relations and treaties)
  const diplomaticStanding = Math.min(100, Math.max(40, 
    ((country as any).globalDiplomaticInfluence || 50) + 
    ((country as any).tradeRelationshipStrength || 10) + 
    ((country as any).allianceStrength || 15) - 
    ((country as any).diplomaticTensions || 5)
  ));
  
  // Governmental Efficiency (based on economic performance and stability)
  const governmentalEfficiency = Math.min(100, Math.max(50,
    60 + (economicVitality * 0.3) + (diplomaticStanding * 0.2)
  ));
  
  return {
    economicVitality: Math.round(economicVitality),
    populationWellbeing: Math.round(populationWellbeing),
    diplomaticStanding: Math.round(diplomaticStanding),
    governmentalEfficiency: Math.round(governmentalEfficiency),
    overallScore: Math.round((economicVitality + populationWellbeing + diplomaticStanding + governmentalEfficiency) / 4),
  };
}

/**
 * Convert tier name to numerical score for calculations
 */
function getTierScore(tier: string): number {
  const tierScores: Record<string, number> = {
    'Impoverished': 1,
    'Developing': 2,
    'Emerging': 3,
    'Developed': 4,
    'Advanced': 5,
    'Elite': 6,
  };
  return tierScores[tier] || 1;
}

/**
 * Generate intelligence feed by aggregating data from multiple sources
 */
async function generateIntelligenceFeed(countryId: string): Promise<IntelligenceItem[]> {
  const cacheKey = `intelligence_${countryId}`;
  const cached = getMyCountryCache(cacheKey);
  if (cached) return cached;

  try {
    // Get country data for context
    const country = await db.country.findUnique({
      where: { id: countryId },
      include: {
        historicalData: {
          orderBy: { ixTimeTimestamp: 'desc' },
          take: 5
        }
      }
    });

    if (!country) return [];

    const intelligenceItems: IntelligenceItem[] = [];
    const currentTime = IxTime.getCurrentIxTime();

    // Economic Intelligence
    const recentHistory = country.historicalData[0];
    if (recentHistory && country.historicalData.length > 1) {
      const previousHistory = country.historicalData[1];
      if (previousHistory) {
        const gdpChange = ((recentHistory.gdpPerCapita - previousHistory.gdpPerCapita) / previousHistory.gdpPerCapita) * 100;
        
        if (Math.abs(gdpChange) > 2) {
          intelligenceItems.push({
            id: `econ_${Date.now()}`,
            createdAt: currentTime,
            type: gdpChange > 0 ? 'opportunity' : 'alert',
            severity: (Math.abs(gdpChange) > 5 ? 'HIGH' : 'MEDIUM') as any,
            title: `Economic ${gdpChange > 0 ? 'Growth' : 'Decline'} Detected`,
            description: `GDP per capita has ${gdpChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(gdpChange).toFixed(2)}% this period.`,
            category: 'ECONOMIC' as any,
            timestamp: currentTime,
            actionable: true,
            source: 'Economic Intelligence Unit',
            affectedRegions: [country.region].filter(Boolean) as string[],
            confidence: 0.95,
          });
        }
      }
    }

    // Population Intelligence
    if (country.populationGrowthRate > 0.05) {
      intelligenceItems.push({
        id: `pop_${Date.now()}`,
        createdAt: currentTime,
        type: 'update',
        severity: 'MEDIUM' as any,
        title: 'High Population Growth Detected',
        description: `Population growing at ${(country.populationGrowthRate * 100).toFixed(2)}% - infrastructure planning may be needed.`,
        category: 'SOCIAL' as any,
        timestamp: currentTime,
        actionable: true,
        source: 'Demographics Bureau',
        confidence: 0.90,
      });
    }

    // Get system-wide intelligence items
    const globalIntelligence = await db.intelligenceItem.findMany({
      where: {
        isActive: true,
        OR: [
          { affectedCountries: { contains: country.name } },
          { region: country.region },
          { affectedCountries: null } // Global items
        ]
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    // Convert database intelligence items
    globalIntelligence.forEach(item => {
      intelligenceItems.push({
        id: item.id,
        createdAt: item.timestamp.getTime(),
        type: item.category === 'SECURITY' ? 'alert' : 'update',
        severity: item.priority.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
        title: item.title,
        description: item.content,
        category: item.category.toLowerCase() as 'economic' | 'diplomatic' | 'social' | 'governance',
        timestamp: item.timestamp.getTime(),
        actionable: item.priority !== 'LOW',
        source: item.source,
        confidence: 0.85,
      });
    });

    // Sort by priority and timestamp
    intelligenceItems.sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const priorityDiff = priorityOrder[b.severity] - priorityOrder[a.severity];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp - a.timestamp;
    });

    const result = intelligenceItems.slice(0, 20); // Limit to 20 items
    setMyCountryCache(cacheKey, result, 120000); // Cache for 2 minutes
    return result;

  } catch (error) {
    console.error('[MyCountry Intelligence Feed] Error:', error);
    return [];
  }
}

/**
 * Calculate achievements based on country performance and milestones
 */
async function calculateAchievements(countryId: string): Promise<Achievement[]> {
  const cacheKey = `achievements_${countryId}`;
  const cached = getMyCountryCache(cacheKey);
  if (cached) return cached;

  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
      include: {
        historicalData: {
          orderBy: { ixTimeTimestamp: 'desc' },
          take: 50
        }
      }
    });

    if (!country) return [];

    const achievements: Achievement[] = [];

    // Economic achievements
    if (country.currentGdpPerCapita > 50000) {
      achievements.push({
        id: 'wealthy_nation',
        title: 'Wealthy Nation',
        description: 'Achieved GDP per capita above $50,000',
        category: 'economic',
        rarity: 'epic',
        achievedAt: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        points: 500,
        icon: 'TrendingUp',
        progress: 100,
      });
    }

    // Population achievements
    if (country.currentPopulation > 100000000) {
      achievements.push({
        id: 'population_giant',
        title: 'Population Giant',
        description: 'Reached over 100 million citizens', 
        category: 'social',
        rarity: 'rare',
        achievedAt: Date.now() - (60 * 24 * 60 * 60 * 1000), // 60 days ago
        points: 300,
        icon: 'Users',
        progress: 100,
      });
    }

    // Growth achievements
    if (country.adjustedGdpGrowth > 0.05) {
      achievements.push({
        id: 'rapid_growth',
        title: 'Rapid Economic Growth',
        description: 'Sustained GDP growth above 5% annually',
        category: 'economic',
        rarity: 'rare',
        achievedAt: Date.now() - (15 * 24 * 60 * 60 * 1000), // 15 days ago  
        points: 250,
        icon: 'TrendingUp',
        progress: 100,
      });
    }

    const result = achievements.slice(0, 10);
    setMyCountryCache(cacheKey, result, 300000); // Cache for 5 minutes
    return result;

  } catch (error) {
    console.error('[MyCountry Achievements] Error:', error);
    return [];
  }
}

/**
 * Generate international rankings for the country
 */
async function generateRankings(countryId: string): Promise<Ranking[]> {
  const cacheKey = `rankings_${countryId}`;
  const cached = getMyCountryCache(cacheKey);
  if (cached) return cached;

  try {
    const country = await db.country.findUnique({
      where: { id: countryId }
    });

    if (!country) return [];

    // Get all countries for comparative rankings
    const allCountries = await db.country.findMany({
      select: {
        id: true,
        name: true,
        currentGdpPerCapita: true,
        currentPopulation: true,
        currentTotalGdp: true,
        region: true,
        economicTier: true,
        populationTier: true,
      }
    });

    const rankings: Ranking[] = [];

    // Global GDP per capita ranking
    const gdpRanking = allCountries
      .sort((a, b) => b.currentGdpPerCapita - a.currentGdpPerCapita)
      .findIndex(c => c.id === countryId) + 1;

    rankings.push({
      category: 'GDP per Capita',
      global: { position: gdpRanking, total: allCountries.length },
      regional: {
        position: allCountries
          .filter(c => c.region === country.region)
          .sort((a, b) => b.currentGdpPerCapita - a.currentGdpPerCapita)
          .findIndex(c => c.id === countryId) + 1,
        total: allCountries.filter(c => c.region === country.region).length,
        region: country.region || 'Unknown'
      },
      tier: {
        position: allCountries
          .filter(c => c.economicTier === country.economicTier)
          .sort((a, b) => b.currentGdpPerCapita - a.currentGdpPerCapita)
          .findIndex(c => c.id === countryId) + 1,
        total: allCountries.filter(c => c.economicTier === country.economicTier).length,
        tier: country.economicTier
      },
      trend: country.adjustedGdpGrowth > 0.03 ? 'improving' : 
             country.adjustedGdpGrowth < -0.01 ? 'declining' : 'stable',
      percentile: Math.round((1 - (gdpRanking - 1) / allCountries.length) * 100)
    });

    // Global population ranking
    const popRanking = allCountries
      .sort((a, b) => b.currentPopulation - a.currentPopulation)
      .findIndex(c => c.id === countryId) + 1;

    rankings.push({
      category: 'Population',
      global: { position: popRanking, total: allCountries.length },
      regional: {
        position: allCountries
          .filter(c => c.region === country.region)
          .sort((a, b) => b.currentPopulation - a.currentPopulation)
          .findIndex(c => c.id === countryId) + 1,
        total: allCountries.filter(c => c.region === country.region).length,
        region: country.region || 'Unknown'
      },
      tier: {
        position: allCountries
          .filter(c => c.populationTier === country.populationTier)
          .sort((a, b) => b.currentPopulation - a.currentPopulation)
          .findIndex(c => c.id === countryId) + 1,
        total: allCountries.filter(c => c.populationTier === country.populationTier).length,
        tier: country.populationTier
      },
      trend: 'stable',
      percentile: Math.round((1 - (popRanking - 1) / allCountries.length) * 100)
    });

    const result = rankings;
    setMyCountryCache(cacheKey, result, 600000); // Cache for 10 minutes
    return result;

  } catch (error) {
    console.error('[MyCountry Rankings] Error:', error);
    return [];
  }
}

/**
 * Generate historical milestones for the country
 */
async function generateMilestones(countryId: string): Promise<Milestone[]> {
  const cacheKey = `milestones_${countryId}`;
  const cached = getMyCountryCache(cacheKey);
  if (cached) return cached;

  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
      include: {
        historicalData: {
          orderBy: { ixTimeTimestamp: 'asc' }
        }
      }
    });

    if (!country) return [];

    const milestones: Milestone[] = [];
    const history = country.historicalData;

    // Population milestones
    const populationMilestones = [1000000, 5000000, 10000000, 25000000, 50000000, 100000000];
    populationMilestones.forEach(milestone => {
      const record = history.find(h => h.population >= milestone);
      if (record && country.currentPopulation >= milestone) {
        milestones.push({
          id: `pop_${milestone}`,
          title: `${(milestone / 1000000).toFixed(0)}M Population Milestone`,
          description: `Successfully reached ${milestone.toLocaleString()} citizens`,
          achievedAt: record.ixTimeTimestamp.getTime(),
          impact: 'Expanded national capacity and influence',
          category: 'population',
          significance: 'major',
        });
      }
    });

    // Economic milestones
    const gdpMilestones = [10000, 25000, 50000, 75000, 100000];
    gdpMilestones.forEach(milestone => {
      const record = history.find(h => h.gdpPerCapita >= milestone);
      if (record && country.currentGdpPerCapita >= milestone) {
        milestones.push({
          id: `gdp_${milestone}`,
          title: `$${milestone.toLocaleString()} GDP per Capita`,
          description: `Achieved ${milestone >= 50000 ? 'high-income' : 'middle-income'} status`,
          achievedAt: record.ixTimeTimestamp.getTime(),
          impact: `Enhanced living standards and economic development`,
          category: 'economic',
          significance: milestone >= 50000 ? 'major' : 'moderate',
        });
      }
    });

    // Sort by achievement date
    milestones.sort((a, b) => b.achievedAt - a.achievedAt);

    const result = milestones.slice(0, 15);
    setMyCountryCache(cacheKey, result, 900000); // Cache for 15 minutes
    return result;

  } catch (error) {
    console.error('[MyCountry Milestones] Error:', error);
    return [];
  }
}

export const myCountryRouter = createTRPCRouter({
  /**
   * Get comprehensive country data with vitality scores for MyCountry dashboard
   */
  getCountryDashboard: publicProcedure
    .input(z.object({
      countryId: z.string(),
      includeHistory: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      try {
        const country = await db.country.findUnique({
          where: { id: input.countryId },
          include: {
            historicalData: input.includeHistory ? {
              orderBy: { ixTimeTimestamp: 'desc' },
              take: 30
            } : false,
            demographics: true,
            economicProfile: true,
            laborMarket: true,
            fiscalSystem: true,
            incomeDistribution: true,
            governmentBudget: true,
          }
        });

        if (!country) {
          throw new Error('Country not found');
        }

        // Calculate vitality scores
        const vitalityScores = calculateVitalityScores(country as any);

        return {
          ...country,
          ...vitalityScores,
          lastCalculated: country.lastCalculated.getTime(),
          baselineDate: country.baselineDate.getTime(),
        };

      } catch (error) {
        console.error('[MyCountry Dashboard] Error:', error);
        throw new Error('Failed to get country dashboard data');
      }
    }),

  /**
   * Get intelligence feed for executive dashboard - Requires country ownership
   */
  getIntelligenceFeed: countryOwnerProcedure
    .input(z.object({
      countryId: z.string(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      // Additional security: Verify the requested country matches user's country
      if (input.countryId !== ctx.user.countryId) {
        throw new Error('FORBIDDEN: Can only access intelligence for owned country');
      }
      
      return generateIntelligenceFeed(input.countryId);
    }),

  /**
   * Get achievements and recognition for the country
   */
  getAchievements: publicProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .query(async ({ input }) => {
      return calculateAchievements(input.countryId);
    }),

  /**
   * Get international rankings for the country
   */
  getRankings: publicProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .query(async ({ input }) => {
      return generateRankings(input.countryId);
    }),

  /**
   * Get historical milestones for the country
   */
  getMilestones: publicProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .query(async ({ input }) => {
      return generateMilestones(input.countryId);
    }),

  /**
   * Get executive actions available for the country - Requires country ownership
   */
  getExecutiveActions: countryOwnerProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      // Additional security: Verify the requested country matches user's country
      if (input.countryId !== ctx.user.countryId) {
        throw new Error('FORBIDDEN: Can only access actions for owned country');
      }

      const country = ctx.user.country;
      if (!country) {
        throw new Error('FORBIDDEN: Country data not available');
      }
      
      const actions: ExecutiveAction[] = [];

      // Economic actions based on country state
      if (country.adjustedGdpGrowth < 0.02) {
        actions.push({
          id: 'stimulus_package',
          title: 'Economic Stimulus Package',
          description: 'Deploy fiscal stimulus to boost economic growth',
          category: 'economic',
          urgency: 'high',
          estimatedImpact: {
            economic: '+2-4% GDP growth',
            timeframe: '6-12 months'
          },
          requirements: ['Budget approval', 'Parliamentary consent'],
          enabled: true,
        });
      }

      // Population actions
      if (country.populationGrowthRate < 0.01) {
        actions.push({
          id: 'population_incentives',
          title: 'Population Growth Incentives',
          description: 'Implement policies to encourage population growth',
          category: 'social',
          urgency: 'medium',
          estimatedImpact: {
            social: 'Increased birth rate',
            timeframe: '2-5 years'
          },
          requirements: ['Social ministry approval'],
          enabled: true,
        });
      }

      // Transform legacy actions to proper ExecutiveAction interfaces  
      return actions.map(action => ({
        ...action,
        type: 'executive' as const,
        priority: action.urgency as any,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));
    }),

  /**
   * Execute an executive action - Maximum security with audit logging
   */
  executeAction: executiveProcedure
    .input(z.object({
      countryId: z.string().min(1),
      actionId: z.string().min(1).max(50),
      parameters: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Additional security: Verify the requested country matches user's country
      if (input.countryId !== ctx.user.countryId) {
        throw new Error('FORBIDDEN: Can only execute actions for owned country');
      }

      // Validate action exists and is allowed with detailed action definitions
      const allowedActions = {
        'stimulus_package': { 
          name: 'Economic Stimulus Package',
          category: 'economic',
          requires: ['budget_approval'],
          impact: 'gdp_boost'
        },
        'population_incentives': { 
          name: 'Population Growth Incentives',
          category: 'social',
          requires: ['ministry_approval'],
          impact: 'population_growth'
        },
        'tax_policy': { 
          name: 'Tax Policy Reform',
          category: 'economic',
          requires: ['legislative_approval'],
          impact: 'economic_efficiency'
        },
        'diplomatic_mission': { 
          name: 'Diplomatic Mission',
          category: 'diplomatic',
          requires: ['foreign_ministry'],
          impact: 'international_relations'
        },
        'emergency_response': { 
          name: 'Emergency Response Protocol',
          category: 'governance',
          requires: ['executive_authority'],
          impact: 'crisis_management'
        },
        'budget_allocation': { 
          name: 'Budget Reallocation',
          category: 'economic',
          requires: ['treasury_approval'],
          impact: 'fiscal_optimization'
        }
      };

      if (!allowedActions[input.actionId as keyof typeof allowedActions]) {
        throw new Error('FORBIDDEN: Invalid or unauthorized action');
      }

      const action = allowedActions[input.actionId as keyof typeof allowedActions];

      // Validate and sanitize parameters if provided
      let sanitizedParameters: Record<string, any> = {};
      if (input.parameters) {
        // Only allow specific parameter types and sanitize values
        const allowedParams = ['amount', 'duration', 'target', 'scope', 'priority'];
        for (const [key, value] of Object.entries(input.parameters)) {
          if (allowedParams.includes(key) && value !== null && value !== undefined) {
            // Sanitize parameter values
            if (typeof value === 'string') {
              sanitizedParameters[key] = value.slice(0, 100); // Limit string length
            } else if (typeof value === 'number' && !isNaN(value)) {
              sanitizedParameters[key] = Math.max(0, Math.min(1000000, value)); // Clamp numbers
            }
          }
        }
      }

      try {
        // Log the action as a DM input with enhanced security information
        const dmInput = await db.dmInputs.create({
          data: {
            countryId: input.countryId,
            ixTimeTimestamp: new Date(IxTime.getCurrentIxTime() * 1000),
            inputType: 'executive_action',
            value: 1.0,
            description: `Executive Action: ${action.name} (${input.actionId}) - Category: ${action.category}`,
            createdBy: ctx.user?.id || 'system',
          }
        });

        // Clear relevant caches to force fresh data
        const cacheKeys = [
          `intelligence_${input.countryId}`,
          `achievements_${input.countryId}`,
          `rankings_${input.countryId}`,
          `summary_${input.countryId}`,
        ];
        cacheKeys.forEach(key => myCountryCache.delete(key));

        // Return success with action details
        return {
          success: true,
          message: `${action.name} executed successfully`,
          actionId: input.actionId,
          actionName: action.name,
          category: action.category,
          impact: action.impact,
          timestamp: Date.now(),
          dmInputId: dmInput.id,
          parameters: sanitizedParameters,
        };

      } catch (error) {
        console.error('[MyCountry Execute Action] Database error:', error);
        throw new Error('INTERNAL_ERROR: Failed to execute action - please try again');
      }
    }),

  /**
   * Get summary statistics for national overview
   */
  getNationalSummary: publicProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .query(async ({ input }) => {
      const cacheKey = `summary_${input.countryId}`;
      const cached = getMyCountryCache(cacheKey);
      if (cached) return cached;

      try {
        const country = await db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          throw new Error('Country not found');
        }

        const vitalityScores = calculateVitalityScores(country as any);

        const summary: NationalSummary = {
          countryId: country.id,
          countryName: country.name,
          overallHealth: vitalityScores.overallScore,
          keyMetrics: {
            population: country.currentPopulation,
            gdpPerCapita: country.currentGdpPerCapita,
            totalGdp: country.currentTotalGdp,
            economicTier: country.economicTier,
            populationTier: country.populationTier,
          },
          growthRates: {
            population: country.populationGrowthRate,
            economic: country.adjustedGdpGrowth,
          },
          vitalityScores,
          lastUpdated: country.lastCalculated.getTime(),
        };

        setMyCountryCache(cacheKey, summary, 180000); // Cache for 3 minutes
        return summary;

      } catch (error) {
        console.error('[MyCountry Summary] Error:', error);
        throw new Error('Failed to get national summary');
      }
    }),
});