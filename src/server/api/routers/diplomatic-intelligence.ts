import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { IxTime } from "~/lib/ixtime";

// Intelligence Classification Schema
const classificationSchema = z.enum(['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL']);

// Diplomatic Intelligence Types
const diplomaticRelationSchema = z.object({
  id: z.string(),
  countryId: z.string(),
  relatedCountryId: z.string(),
  relationType: z.enum(['alliance', 'trade', 'neutral', 'tension']),
  strength: z.number().min(0).max(100),
  recentActivity: z.string().optional(),
  establishedAt: z.date(),
  updatedAt: z.date(),
});

const intelligenceBriefingSchema = z.object({
  id: z.string(),
  countryId: z.string(),
  classification: classificationSchema,
  briefingType: z.enum(['daily', 'weekly', 'crisis', 'strategic']),
  executiveSummary: z.string(),
  keyDevelopments: z.array(z.object({
    type: z.enum(['economic', 'diplomatic', 'security', 'cultural']),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    timestamp: z.date(),
  })),
  threatAssessments: z.array(z.object({
    category: z.string(),
    level: z.enum(['low', 'moderate', 'high', 'critical']),
    description: z.string(),
  })),
  recommendedActions: z.array(z.string()),
  generatedAt: z.date(),
  ixTimeContext: z.number(),
});

const activityIntelligenceSchema = z.object({
  id: z.string(),
  countryId: z.string(),
  activityType: z.enum(['diplomatic', 'economic', 'cultural', 'security']),
  description: z.string(),
  relatedCountries: z.array(z.string()),
  importance: z.enum(['low', 'medium', 'high']),
  classification: classificationSchema,
  timestamp: z.date(),
  ixTimeTimestamp: z.number(),
});

export const diplomaticIntelligenceRouter = createTRPCRouter({
  // Get diplomatic intelligence briefing for a country
  getIntelligenceBriefing: publicProcedure
    .input(z.object({ 
      countryId: z.string(),
      clearanceLevel: classificationSchema.default('PUBLIC'),
      briefingType: z.enum(['daily', 'strategic']).default('daily')
    }))
    .query(async ({ input }) => {
      const { countryId, clearanceLevel, briefingType } = input;
      
      // Get country data for briefing
      const country = await db.country.findUnique({
        where: { id: countryId },
        include: {
          _count: {
            select: {
              followers: true,
            }
          }
        }
      });

      if (!country) {
        throw new Error('Country not found');
      }

      // Get recent activities (filtered by clearance level)
      const recentActivities = await db.countryActivity.findMany({
        where: { 
          countryId,
          // Filter by classification based on clearance
          ...(clearanceLevel === 'PUBLIC' && {
            classification: { not: { in: ['RESTRICTED', 'CONFIDENTIAL'] } }
          }),
          ...(clearanceLevel === 'RESTRICTED' && {
            classification: { not: 'CONFIDENTIAL' }
          })
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      // Get diplomatic relations
      const diplomaticRelations = await db.diplomaticRelation.findMany({
        where: {
          OR: [
            { countryId: countryId },
            { relatedCountryId: countryId }
          ]
        },
        include: {
          country: true,
          relatedCountry: true,
        },
        take: 20,
      });

      // Calculate intelligence metrics
      const economicStrength = Math.min(100, (country.currentGdpPerCapita / 65000) * 100);
      const diplomaticReach = Math.min(100, diplomaticRelations.length * 8);
      const culturalInfluence = Math.min(100, (country._count.followers / 50) + 20);
      
      // Security index only available to RESTRICTED+ clearance
      const securityIndex = clearanceLevel !== 'PUBLIC' ? 
        Math.min(100, 75 + ((country.growthStreak || 0) * 2)) : 
        undefined;

      const stabilityRating = (() => {
        const tierScores: Record<string, number> = {
          "Extravagant": 95, "Very Strong": 85, "Strong": 75, 
          "Healthy": 65, "Developed": 50, "Developing": 35
        };
        return tierScores[country.economicTier] || 25;
      })();

      // Generate key developments
      const keyDevelopments = [
        {
          type: 'economic' as const,
          title: `Economic Performance: ${country.economicTier}`,
          description: `Current GDP per capita: ${new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD', 
            minimumFractionDigits: 0 
          }).format(country.currentGdpPerCapita)}`,
          priority: economicStrength > 70 ? 'high' as const : 'medium' as const,
          timestamp: new Date(),
        },
        {
          type: 'diplomatic' as const,
          title: 'Diplomatic Network Status',
          description: `${diplomaticRelations.length} active diplomatic relationships`,
          priority: diplomaticReach > 50 ? 'medium' as const : 'low' as const,
          timestamp: new Date(),
        },
        ...(country.growthStreak && country.growthStreak > 0 ? [{
          type: 'economic' as const,
          title: 'Growth Momentum',
          description: `${country.growthStreak}Q consecutive growth streak`,
          priority: 'high' as const,
          timestamp: new Date(),
        }] : [])
      ];

      // Generate threat assessments (classification dependent)
      const threatAssessments = [
        {
          category: 'Economic Stability',
          level: economicStrength > 70 ? 'low' as const : 'moderate' as const,
          description: `Economic strength index: ${Math.round(economicStrength)}%`
        },
        {
          category: 'Diplomatic Relations',
          level: diplomaticReach > 60 ? 'low' as const : 'moderate' as const,
          description: `Diplomatic network coverage: ${Math.round(diplomaticReach)}%`
        },
        ...(clearanceLevel !== 'PUBLIC' ? [{
          category: 'Regional Security',
          level: 'low' as const,
          description: 'No immediate security threats detected'
        }] : [])
      ];

      // Generate recommendations
      const recommendedActions = [
        'Continue monitoring diplomatic activities',
        ...(economicStrength < 50 ? ['Consider economic cooperation initiatives'] : []),
        ...(diplomaticReach < 30 ? ['Expand diplomatic network presence'] : []),
        ...(clearanceLevel === 'CONFIDENTIAL' ? [
          'Assess cultural influence expansion opportunities',
          'Review strategic alliance potential'
        ] : [])
      ];

      return {
        id: `briefing-${countryId}-${Date.now()}`,
        countryId,
        classification: clearanceLevel,
        briefingType,
        executiveSummary: `Intelligence briefing for ${country.name} as of ${IxTime.formatIxTime(IxTime.getCurrentIxTime(), true)}`,
        keyDevelopments,
        threatAssessments,
        recommendedActions,
        generatedAt: new Date(),
        ixTimeContext: IxTime.getCurrentIxTime(),
        metrics: {
          economicStrength,
          diplomaticReach,
          culturalInfluence,
          securityIndex,
          stabilityRating,
        },
        recentActivities: recentActivities.map(activity => ({
          id: activity.id,
          description: activity.description,
          importance: activity.importance as 'low' | 'medium' | 'high',
          timestamp: activity.timestamp.toISOString(),
          relatedCountry: activity.relatedCountry,
          type: activity.activityType as 'diplomatic' | 'economic' | 'cultural' | 'security'
        }))
      };
    }),

  // Get diplomatic network analysis
  getDiplomaticNetwork: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ input }) => {
      const relations = await db.diplomaticRelation.findMany({
        where: {
          OR: [
            { countryId: input.countryId },
            { relatedCountryId: input.countryId }
          ]
        },
        include: {
          country: {
            select: {
              id: true,
              name: true,
              economicTier: true,
              flagUrl: true
            }
          },
          relatedCountry: {
            select: {
              id: true,
              name: true,
              economicTier: true,
              flagUrl: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return relations.map(relation => ({
        id: relation.id,
        countryName: relation.countryId === input.countryId ? 
          relation.relatedCountry.name : relation.country.name,
        countryId: relation.countryId === input.countryId ? 
          relation.relatedCountryId : relation.countryId,
        relationType: relation.relationType,
        strength: relation.strength,
        recentActivity: relation.recentActivity,
        establishedAt: relation.establishedAt.toISOString(),
        partner: relation.countryId === input.countryId ? 
          relation.relatedCountry : relation.country
      }));
    }),

  // Get activity intelligence feed
  getActivityIntelligence: protectedProcedure
    .input(z.object({ 
      countryId: z.string(),
      clearanceLevel: classificationSchema.default('RESTRICTED'),
      limit: z.number().min(1).max(50).default(20)
    }))
    .query(async ({ input }) => {
      if (input.clearanceLevel === 'PUBLIC') {
        throw new Error('Insufficient clearance level for activity intelligence');
      }

      const activities = await db.countryActivity.findMany({
        where: { 
          countryId: input.countryId,
          // Filter by classification
          ...(input.clearanceLevel === 'RESTRICTED' && {
            classification: { not: 'CONFIDENTIAL' }
          })
        },
        orderBy: { timestamp: 'desc' },
        take: input.limit,
      });

      return activities.map(activity => ({
        id: activity.id,
        countryId: activity.countryId,
        activityType: activity.activityType,
        description: activity.description,
        relatedCountries: activity.relatedCountries,
        importance: activity.importance,
        classification: activity.classification,
        timestamp: activity.timestamp.toISOString(),
        ixTimeTimestamp: activity.ixTimeTimestamp,
      }));
    }),

  // Create diplomatic action
  createDiplomaticAction: protectedProcedure
    .input(z.object({
      targetCountryId: z.string(),
      actionType: z.enum(['follow', 'message', 'propose', 'congratulate']),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error('Authentication required');

      // Get user's country
      const userCountry = await db.country.findFirst({
        where: { userId: userId }
      });

      if (!userCountry) {
        throw new Error('User country not found');
      }

      // Create diplomatic action record
      const action = await db.diplomaticAction.create({
        data: {
          fromCountryId: userCountry.id,
          toCountryId: input.targetCountryId,
          actionType: input.actionType,
          message: input.message,
          timestamp: new Date(),
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
          status: 'PENDING'
        }
      });

      // Create activity record
      await db.countryActivity.create({
        data: {
          countryId: userCountry.id,
          activityType: 'diplomatic',
          description: `Initiated ${input.actionType} action with target country`,
          importance: 'medium',
          classification: 'PUBLIC',
          timestamp: new Date(),
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
          relatedCountry: input.targetCountryId,
          relatedCountries: [input.targetCountryId]
        }
      });

      return action;
    }),

  // Get strategic assessment (CONFIDENTIAL clearance only)
  getStrategicAssessment: protectedProcedure
    .input(z.object({ 
      countryId: z.string(),
      clearanceLevel: classificationSchema
    }))
    .query(async ({ input }) => {
      if (input.clearanceLevel !== 'CONFIDENTIAL') {
        throw new Error('CONFIDENTIAL clearance required for strategic assessment');
      }

      const country = await db.country.findUnique({
        where: { id: input.countryId },
        include: {
          _count: {
            select: {
              followers: true,
            }
          }
        }
      });

      if (!country) {
        throw new Error('Country not found');
      }

      // Classified strategic analysis
      const economicThreatLevel = country.currentGdpPerCapita > 50000 ? 'low' : 
                                 country.currentGdpPerCapita > 25000 ? 'moderate' : 'high';
      
      const diplomaticStance = country._count.followers > 20 ? 'expanding' : 'stable';
      
      const regionalInfluence = country.economicTier === 'Extravagant' ? 'high' : 
                               country.economicTier === 'Very Strong' ? 'moderate' : 'low';

      return {
        classification: 'CONFIDENTIAL' as const,
        countryId: input.countryId,
        threatAnalysis: [
          {
            category: 'Economic Stability',
            level: economicThreatLevel,
            assessment: `Economic threat assessment: ${economicThreatLevel.toUpperCase()}`
          },
          {
            category: 'Diplomatic Tensions',
            level: 'moderate',
            assessment: 'Routine diplomatic activities, moderate engagement levels'
          },
          {
            category: 'Regional Influence',
            level: regionalInfluence,
            assessment: `Regional influence expanding through ${diplomaticStance} diplomatic posture`
          }
        ],
        recommendations: [
          'Maintain diplomatic monitoring protocols',
          'Consider economic cooperation opportunities',
          'Monitor regional alliance activities',
          'Assess cultural influence expansion potential'
        ],
        generatedAt: new Date(),
        ixTimeContext: IxTime.getCurrentIxTime()
      };
    }),
});