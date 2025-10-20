import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
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
    .query(async ({ ctx, input }) => {
      const { countryId, clearanceLevel, briefingType } = input;
      const { db } = ctx;

      const countryRaw = await db.country.findUnique({
        where: { id: countryId },
      });

      if (!countryRaw) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Country not found' });
      }

      const country = countryRaw as any;

      const [relations, activePolicies, embassies, missions, recentEvents, recentNotifications] = await Promise.all([
        db.diplomaticRelation.findMany({
          where: {
            OR: [
              { country1: countryId },
              { country2: countryId },
            ],
          },
          orderBy: { updatedAt: 'desc' },
        }),
        db.policy.findMany({
          where: {
            countryId,
            status: { in: ['active', 'proposed'] },
          },
          orderBy: { priority: 'asc' },
        }),
        db.embassy.findMany({
          where: {
            OR: [
              { hostCountryId: countryId },
              { guestCountryId: countryId },
            ],
          },
        }),
        db.embassyMission.findMany({
          where: {
            embassy: {
              OR: [
                { hostCountryId: countryId },
                { guestCountryId: countryId },
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
          include: { embassy: true },
        }),
        db.diplomaticEvent.findMany({
          where: {
            OR: [
              { country1Id: countryId },
              { country2Id: countryId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        db.notification.findMany({
          where: {
            OR: [
              { countryId },
              { category: { in: ['diplomatic', 'policy', 'intelligence'] } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      const diplomaticRelations = relations.map(relation => ({
        id: relation.id,
        countryId: relation.country1,
        relatedCountryId: relation.country1 === countryId ? relation.country2 : relation.country1,
        relationType: (relation.relationship as any) ?? 'neutral',
        strength: relation.strength,
        recentActivity: relation.recentActivity ?? undefined,
        establishedAt: relation.establishedAt,
        updatedAt: relation.updatedAt,
      }));

      const embassyCount = embassies.length;
      const activeMissionCount = missions.filter(mission => mission.status === 'active').length;

      const economicStrength = Math.min(100, ((country.currentGdpPerCapita || 25000) / 65000) * 100);
      const diplomaticReach = Math.min(100, (diplomaticRelations.length + embassyCount) * 6);
      const culturalInfluence = Math.min(100, missions.length * 8 + embassyCount * 5);

      const securityIndex = clearanceLevel !== 'PUBLIC'
        ? Math.min(100, 60 + (activeMissionCount * 5))
        : undefined;

      const tierScores: Record<string, number> = {
        'Extravagant': 95,
        'Very Strong': 85,
        'Strong': 75,
        'Healthy': 65,
        'Developed': 50,
        'Developing': 35,
      };
      const stabilityRating = tierScores[country.economicTier] ?? 25;

      const recentActivities = [
        ...recentEvents.map(event => ({
          id: event.id,
          type: 'diplomatic-event',
          title: event.title,
          description: event.description,
          timestamp: event.createdAt,
          metadata: event.metadata ? JSON.parse(event.metadata) : undefined,
        })),
        ...missions.slice(0, 5).map(mission => ({
          id: mission.id,
          type: 'embassy-mission',
          title: mission.name,
          description: mission.description,
          timestamp: mission.updatedAt,
          metadata: {
            status: mission.status,
            difficulty: mission.difficulty,
          },
        })),
        ...recentNotifications.map(notification => ({
          id: notification.id,
          type: 'notification',
          title: notification.title,
          description: notification.message ?? notification.description ?? undefined,
          timestamp: notification.createdAt,
          metadata: notification.metadata ? JSON.parse(notification.metadata) : undefined,
        })),
      ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 15);

      const keyDevelopments = [
        {
          type: 'economic' as const,
          title: `Economic Performance: ${country.economicTier}`,
          description: `Current GDP per capita: ${new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
          }).format(country.currentGdpPerCapita)}`,
          priority: economicStrength > 70 ? 'high' as const : 'medium' as const,
          timestamp: new Date(),
        },
        {
          type: 'diplomatic' as const,
          title: 'Diplomatic Network Status',
          description: `${diplomaticRelations.length} relations • ${embassyCount} embassies • ${activeMissionCount} active missions`,
          priority: diplomaticReach > 50 ? 'medium' as const : 'low' as const,
          timestamp: new Date(),
        },
        ...(activePolicies.length > 0
          ? [{
              type: 'policy' as const,
              title: `${activePolicies[0]!.name} (${activePolicies[0]!.status})`,
              description: activePolicies[0]!.description,
              priority: activePolicies[0]!.priority === 'critical' ? 'high' as const : 'medium' as const,
              timestamp: activePolicies[0]!.updatedAt ?? activePolicies[0]!.createdAt ?? new Date(),
            }]
          : []),
      ];

      const threatAssessments = [
        {
          category: 'Economic Stability',
          level: economicStrength > 70 ? 'low' as const : 'moderate' as const,
          description: `Economic strength index: ${Math.round(economicStrength)}%`,
        },
        {
          category: 'Diplomatic Relations',
          level: diplomaticReach > 60 ? 'low' as const : 'moderate' as const,
          description: `Diplomatic coverage: ${Math.round(diplomaticReach)}%`,
        },
        ...(clearanceLevel !== 'PUBLIC'
          ? [{
              category: 'Mission Readiness',
              level: activeMissionCount > 0 ? 'low' as const : 'moderate' as const,
              description: `${activeMissionCount} active missions, ${missions.length} total missions`,
            }]
          : []),
      ];

      const recommendedActions = [
        'Continue monitoring diplomatic activities',
        ...(economicStrength < 50 ? ['Consider economic cooperation initiatives'] : []),
        ...(diplomaticReach < 40 ? ['Expand diplomatic network presence'] : []),
        ...(activeMissionCount === 0 ? ['Deploy embassy missions to strategic partners'] : []),
        ...(clearanceLevel === 'CONFIDENTIAL'
          ? ['Review strategic alliance potential', 'Evaluate intelligence-sharing agreements']
          : []),
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
          activePolicyCount: activePolicies.length,
          embassyCount,
        },
        recentActivities,
      };
    }),

  // Get diplomatic network analysis
  getDiplomaticNetwork: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
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
        updatedAt: r.updatedAt,
      }));
    }),

  // Get activity intelligence feed
  getActivityIntelligence: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      clearanceLevel: classificationSchema.default('RESTRICTED'),
      limit: z.number().min(1).max(50).default(20)
    }))
    .query(async ({ ctx, input }) => {
      if (input.clearanceLevel === 'PUBLIC') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient clearance level' });
      }

      const { db } = ctx;

      const [notifications, diplomaticEvents, embassyMissions] = await Promise.all([
        db.notification.findMany({
          where: {
            OR: [
              { countryId: input.countryId },
              { category: { in: ['diplomatic', 'economic', 'security', 'policy', 'intelligence'] } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
        }),
        db.diplomaticEvent.findMany({
          where: {
            OR: [
              { country1Id: input.countryId },
              { country2Id: input.countryId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
        }),
        db.embassyMission.findMany({
          where: {
            embassy: {
              OR: [
                { hostCountryId: input.countryId },
                { guestCountryId: input.countryId },
              ],
            },
          },
          include: {
            embassy: true,
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
        }),
      ]);

      const nowIxTime = IxTime.getCurrentIxTime();

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
          ixTimeTimestamp: nowIxTime,
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
            importance: e.severity === 'critical' ? ('high' as const) : ('medium' as const),
            classification: 'RESTRICTED' as const,
            timestamp: e.createdAt,
            ixTimeTimestamp: nowIxTime,
          };
        }),
        ...embassyMissions.map(mission => ({
          id: mission.id,
          countryId: input.countryId,
          activityType: 'intelligence' as const,
          description: mission.name,
          relatedCountries: mission.embassy
            ? [mission.embassy.hostCountryId === input.countryId ? mission.embassy.guestCountryId : mission.embassy.hostCountryId].filter(Boolean) as string[]
            : [],
          importance: mission.difficulty === 'hard' || mission.difficulty === 'expert'
            ? 'high' as const
            : mission.difficulty === 'easy'
              ? 'low' as const
              : 'medium' as const,
          classification: input.clearanceLevel,
          timestamp: mission.updatedAt,
          ixTimeTimestamp: nowIxTime,
        })),
      ];

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
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      }

      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Country context required' });
      }

      const action = await ctx.db.diplomaticAction.create({
        data: {
          fromCountryId: ctx.user.countryId,
          toCountryId: input.targetCountryId,
          actionType: input.actionType,
          description: input.message,
          status: 'pending',
        },
      });

      return {
        ...action,
        timestamp: action.createdAt,
      };
    }),

  // Get strategic assessment (CONFIDENTIAL clearance only)
  getStrategicAssessment: protectedProcedure
    .input(z.object({ 
      countryId: z.string(),
      clearanceLevel: classificationSchema
    }))
    .query(async ({ ctx, input }) => {
      if (input.clearanceLevel !== 'CONFIDENTIAL') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'CONFIDENTIAL clearance required' });
      }

      const { db } = ctx;

      const countryRaw = await db.country.findUnique({
        where: { id: input.countryId },
      });

      if (!countryRaw) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Country not found' });
      }

      const country = countryRaw as any;

      const [embassyCount, activePolicies, pendingActions] = await Promise.all([
        db.embassy.count({
          where: {
            OR: [
              { hostCountryId: input.countryId },
              { guestCountryId: input.countryId },
            ],
          },
        }),
        db.policy.count({
          where: {
            countryId: input.countryId,
            status: 'active',
          },
        }),
        db.diplomaticAction.count({
          where: {
            fromCountryId: input.countryId,
            status: { in: ['pending', 'in_progress'] },
          },
        }),
      ]);

      const economicThreatLevel = (country.currentGdpPerCapita || 25000) > 50000
        ? 'low'
        : (country.currentGdpPerCapita || 25000) > 25000
          ? 'moderate'
          : 'high';

      const diplomaticStance = embassyCount > 5 ? 'expansive' : embassyCount > 2 ? 'stable' : 'limited';

      const tierScores: Record<string, 'low' | 'moderate' | 'high'> = {
        'Extravagant': 'high',
        'Very Strong': 'high',
        'Strong': 'moderate',
        'Healthy': 'moderate',
        'Developed': 'moderate',
        'Developing': 'low',
      };
      const regionalInfluence = tierScores[country.economicTier] ?? 'low';

      return {
        classification: 'CONFIDENTIAL' as const,
        countryId: input.countryId,
        threatAnalysis: [
          {
            category: 'Economic Stability',
            level: economicThreatLevel,
            assessment: `Economic threat assessment: ${economicThreatLevel.toUpperCase()}`,
          },
          {
            category: 'Diplomatic Tensions',
            level: pendingActions > 3 ? 'high' as const : 'moderate' as const,
            assessment: `${pendingActions} pending diplomatic actions requiring attention`,
          },
          {
            category: 'Regional Influence',
            level: regionalInfluence,
            assessment: `Regional influence sustained through ${embassyCount} embassies and ${activePolicies} active policies`,
          },
        ],
        recommendations: [
          'Maintain diplomatic monitoring protocols',
          'Consider economic cooperation opportunities',
          'Monitor regional alliance activities',
          'Assess cultural influence expansion potential',
          ...(pendingActions > 0 ? ['Resolve pending diplomatic actions to avoid backlog'] : []),
        ],
        generatedAt: new Date(),
        ixTimeContext: IxTime.getCurrentIxTime(),
      };
    }),
});