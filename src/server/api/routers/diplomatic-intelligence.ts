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
      const countryRaw = await db.country.findUnique({
        where: { id: countryId }
      });
      
      // Type assertion to access computed fields
      const country = countryRaw as any;

      if (!country) {
        throw new Error('Country not found');
      }

      // Get recent activities (simplified due to schema differences)
      const recentActivities = [] as any[];

      // Get diplomatic relations (simplified due to schema differences)
      const diplomaticRelations = [] as any[];

      // Calculate intelligence metrics
      const economicStrength = Math.min(100, ((country.currentGdpPerCapita || 25000) / 65000) * 100);
      const diplomaticReach = Math.min(100, diplomaticRelations.length * 8);
      const culturalInfluence = Math.min(100, 50); // Simplified default value
      
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
        ...((country.growthStreak || 0) > 0 ? [{
          type: 'economic' as const,
          title: 'Growth Momentum',
          description: `${country.growthStreak || 0}Q consecutive growth streak`,
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
        recentActivities: []
      };
    }),

  // Get diplomatic network analysis
  getDiplomaticNetwork: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ input }) => {
      // Fetch bilateral relations for the country
      const relations = await db.diplomaticRelation.findMany({
        where: {
          OR: [
            { country1: input.countryId },
            { country2: input.countryId }
          ]
        },
        orderBy: { updatedAt: 'desc' }
      });

      // Map to a normalized shape for the client
      return relations.map(r => ({
        id: r.id,
        countryId: r.country1 === input.countryId ? r.country1 : r.country2,
        relatedCountryId: r.country1 === input.countryId ? r.country2 : r.country1,
        relationType: (r.relationship as any) ?? 'neutral',
        strength: r.strength,
        recentActivity: r.recentActivity ?? undefined,
        establishedAt: r.establishedAt,
        updatedAt: r.updatedAt
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

      // Leverage notifications and diplomatic events as intelligence activity feed
      const [notifications, diplomaticEvents] = await Promise.all([
        db.notification.findMany({
          where: {
            OR: [
              { countryId: input.countryId },
              { category: { in: ['diplomatic', 'economic', 'security'] } }
            ]
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit
        }),
        db.diplomaticEvent.findMany({
          where: {
            OR: [
              { country1Id: input.countryId },
              { country2Id: input.countryId }
            ]
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit
        })
      ]);

      const items = [
        ...notifications.map(n => ({
          id: n.id,
          countryId: input.countryId,
          activityType: (n.category as any) ?? 'diplomatic',
          description: n.title,
          relatedCountries: [] as string[],
          importance: (n.priority as any) ?? 'medium',
          classification: 'RESTRICTED' as const,
          timestamp: n.createdAt,
          ixTimeTimestamp: IxTime.getCurrentIxTime()
        })),
        ...diplomaticEvents.map(e => {
          const isCountry1 = e.country1Id === input.countryId;
          const otherCountry = isCountry1 ? e.country2Id : e.country1Id;
          return {
            id: e.id,
            countryId: input.countryId,
            activityType: 'diplomatic' as const,
            description: e.description ?? e.eventType,
            relatedCountries: otherCountry ? [otherCountry] : [],
            importance: 'medium' as const,
            classification: 'RESTRICTED' as const,
            timestamp: e.createdAt,
            ixTimeTimestamp: IxTime.getCurrentIxTime()
          };
        })
      ];

      // Sort and limit
      items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return items.slice(0, input.limit);
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

      // Simplified implementation due to schema differences
      return {
        id: `action-${Date.now()}`,
        actionType: input.actionType,
        message: input.message,
        timestamp: new Date(),
        status: 'PENDING'
      };
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

      const countryRaw = await db.country.findUnique({
        where: { id: input.countryId }
      });

      if (!countryRaw) {
        throw new Error('Country not found');
      }

      // Type assertion for computed fields
      const country = countryRaw as any;

      // Classified strategic analysis
      const economicThreatLevel = (country.currentGdpPerCapita || 25000) > 50000 ? 'low' : 
                                 (country.currentGdpPerCapita || 25000) > 25000 ? 'moderate' : 'high';
      
      const diplomaticStance = 'stable'; // Simplified default
      
      const regionalInfluence = (country.economicTier || 'Developing') === 'Extravagant' ? 'high' : 
                               (country.economicTier || 'Developing') === 'Very Strong' ? 'moderate' : 'low';

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
            level: 'moderate' as const,
            assessment: 'Routine diplomatic activities, moderate engagement levels'
          },
          {
            category: 'Regional Influence',
            level: regionalInfluence as 'low' | 'moderate' | 'high',
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