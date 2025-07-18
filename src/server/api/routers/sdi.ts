// src/server/api/routers/sdi.ts
// Sovereign Digital Interface tRPC Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { type IntelligenceItem, type CrisisEvent, type DiplomaticRelation, type Treaty } from "~/types/sdi";

export const sdiRouter = createTRPCRouter({
  // Intelligence Feed
  getIntelligenceFeed: publicProcedure
    .input(z.object({
      category: z.enum(['all', 'economic', 'crisis', 'diplomatic', 'security', 'technology', 'environment']).optional(),
      priority: z.enum(['all', 'low', 'medium', 'high', 'critical']).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.category && input.category !== 'all') where.category = input.category;
      if (input.priority && input.priority !== 'all') where.priority = input.priority;

      const [data, total] = await Promise.all([
        ctx.db.intelligenceItem.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip: input.offset,
          take: input.limit,
        }),
        ctx.db.intelligenceItem.count({ where }),
      ]);

      return {
        data,
        total,
        page: Math.floor(input.offset / input.limit) + 1,
        pageSize: input.limit,
        hasNext: input.offset + input.limit < total,
        hasPrevious: input.offset > 0,
      };
    }),

  // Crisis Management
  getActiveCrises: publicProcedure.query(async ({ ctx }) => {
    const crises = await ctx.db.crisisEvent.findMany({
      where: {},
      orderBy: { timestamp: 'desc' },
    });
    // Parse affectedCountries from JSON string to array for each crisis
    return crises.map((crisis: any) => ({
      ...crisis,
      affectedCountries: crisis.affectedCountries ? JSON.parse(crisis.affectedCountries) : [],
    }));
  }),

  getResponseTeams: publicProcedure.query(async ({ ctx }) => {
    // Mock data - replace with real database queries
    return [
      { id: '1', name: 'International Aid Coordination', status: 'deployed', location: 'Sarpedon' },
      { id: '2', name: 'Economic Stabilization Unit', status: 'standby', location: 'Global' },
      { id: '3', name: 'Diplomatic Crisis Team', status: 'monitoring', location: 'Multiple' }
    ];
  }),

  // Economic Intelligence
  getEconomicIndicators: publicProcedure.query(async ({ ctx }) => {
    // Mock data - replace with real database queries
    return {
      globalGDP: 125700000000000,
      globalGrowth: 3.2,
      inflationRate: 2.8,
      unemploymentRate: 5.2,
      tradeVolume: 28500000000000,
      currencyVolatility: 12.5,
      timestamp: new Date()
    };
  }),

  getCommodityPrices: publicProcedure.query(async ({ ctx }) => {
    // Mock data - replace with real database queries
    return [
      { name: 'Oil (Brent)', price: 85.20, change: 2.3, trend: 'up' as const },
      { name: 'Gold', price: 1950.50, change: -0.8, trend: 'down' as const },
      { name: 'Copper', price: 3.85, change: 1.2, trend: 'up' as const },
      { name: 'Wheat', price: 5.20, change: -1.5, trend: 'down' as const },
      { name: 'Natural Gas', price: 2.85, change: 3.1, trend: 'up' as const }
    ];
  }),

  getEconomicAlerts: publicProcedure.query(async ({ ctx }) => {
    // Mock data - replace with real database queries
    return [
      {
        id: '1',
        type: 'market_volatility',
        title: 'Currency Markets Volatile',
        severity: 'high',
        description: 'Major currency pairs showing increased volatility due to central bank policy shifts.',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000)
      },
      {
        id: '2',
        type: 'trade_disruption',
        title: 'Supply Chain Disruption',
        severity: 'medium',
        description: 'Shipping routes affected by geopolitical tensions in key regions.',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000)
      }
    ];
  }),

  // Diplomatic Relations
  getDiplomaticRelations: publicProcedure.query(async ({ ctx }) => {
    // Mock data - replace with real database queries
    const mockRelations: DiplomaticRelation[] = [
      {
        id: '1',
        country1: 'Latium',
        country2: 'Sarpedon',
        relationship: 'alliance',
        strength: 85,
        treaties: ['Trade Agreement', 'Defense Pact'],
        lastContact: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'active',
        diplomaticChannels: ['Embassy', 'Trade Mission', 'Cultural Exchange']
      },
      {
        id: '2',
        country1: 'Urcea',
        country2: 'Burgundie',
        relationship: 'neutral',
        strength: 45,
        treaties: ['Basic Trade'],
        lastContact: new Date(Date.now() - 6 * 60 * 60 * 1000),
        status: 'active',
        diplomaticChannels: ['Embassy']
      },
      {
        id: '3',
        country1: 'Caphiria',
        country2: 'United Republics',
        relationship: 'tension',
        strength: 25,
        treaties: [],
        lastContact: new Date(Date.now() - 12 * 60 * 60 * 1000),
        status: 'monitoring',
        diplomaticChannels: ['Limited Contact']
      }
    ];

    return mockRelations;
  }),

  getActiveTreaties: publicProcedure.query(async ({ ctx }) => {
    // Mock data - replace with real database queries
    const mockTreaties: Treaty[] = [
      {
        id: '1',
        name: 'Global Trade Agreement',
        parties: ['Latium', 'Sarpedon', 'Burgundie'],
        type: 'economic',
        status: 'active',
        signedDate: new Date('2024-01-15'),
        expiryDate: new Date('2029-01-15'),
        description: 'Comprehensive trade agreement between major nations',
        complianceRate: 95
      },
      {
        id: '2',
        name: 'Defense Cooperation Pact',
        parties: ['Latium', 'Sarpedon'],
        type: 'military',
        status: 'active',
        signedDate: new Date('2023-06-20'),
        expiryDate: new Date('2028-06-20'),
        description: 'Mutual defense agreement between allied nations',
        complianceRate: 100
      }
    ];

    return mockTreaties;
  }),

  getDiplomaticEvents: publicProcedure.query(async ({ ctx }) => {
    // Mock data - replace with real database queries
    return [
      {
        id: '1',
        type: 'summit',
        title: 'Regional Economic Summit',
        participants: ['Latium', 'Sarpedon', 'Burgundie'],
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'scheduled',
        location: 'Latium Capital'
      },
      {
        id: '2',
        type: 'negotiation',
        title: 'Trade Dispute Resolution',
        participants: ['Caphiria', 'United Republics'],
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        status: 'preparing',
        location: 'Neutral Territory'
      }
    ];
  }),

  // System Status
  getSystemStatus: publicProcedure.query(async ({ ctx }) => {
    // Mock data - replace with real system monitoring
    return {
      timestamp: new Date(),
      activeUsers: 23,
      activeCrises: 2,
      intelligenceItems: 6,
      diplomaticEvents: 2,
      systemHealth: 'operational' as const,
      uptime: 99.8,
      lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
    };
  }),

  // Protected routes for authenticated users
  createIntelligenceItem: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      category: z.enum(['economic', 'crisis', 'diplomatic', 'security', 'technology', 'environment']),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      source: z.string().min(1),
      region: z.string().optional(),
      affectedCountries: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const newItem = await ctx.db.intelligenceItem.create({
        data: {
          title: input.title,
          content: input.content,
          category: input.category,
          priority: input.priority,
          source: input.source,
          region: input.region,
          affectedCountries: input.affectedCountries ? JSON.stringify(input.affectedCountries) : undefined,
          timestamp: new Date(),
          isActive: true,
        },
      });
      return {
        success: true,
        data: newItem,
        message: 'Intelligence item created successfully',
      };
    }),

  updateCrisisStatus: protectedProcedure
    .input(z.object({
      crisisId: z.string(),
      responseStatus: z.enum(['coordinating', 'monitoring', 'deployed', 'standby', 'resolved']),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.crisisEvent.update({
        where: { id: input.crisisId },
        data: { responseStatus: input.responseStatus },
      });
      return {
        success: true,
        message: 'Crisis status updated successfully',
      };
    }),

  // --- ADMIN CRUD ENDPOINTS FOR SDI DATA MANAGEMENT ---

  // Create Crisis Event
  createCrisisEvent: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      type: z.enum(['natural_disaster', 'economic_crisis', 'political_crisis', 'security_threat', 'pandemic', 'environmental']),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      affectedCountries: z.array(z.string()),
      casualties: z.number().default(0),
      economicImpact: z.number().default(0),
      responseStatus: z.enum(['coordinating', 'monitoring', 'deployed', 'standby', 'resolved']),
      description: z.string().min(1),
      location: z.string().optional(),
      coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const newCrisis = await ctx.db.crisisEvent.create({
        data: {
          ...input,
          affectedCountries: JSON.stringify(input.affectedCountries),
          timestamp: new Date(),
        },
      });
      return { success: true, data: newCrisis };
    }),

  // Update Crisis Event
  updateCrisisEvent: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      responseStatus: z.enum(['coordinating', 'monitoring', 'deployed', 'standby', 'resolved']).optional(),
      description: z.string().optional(),
      casualties: z.number().optional(),
      economicImpact: z.number().optional(),
      location: z.string().optional(),
      coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.db.crisisEvent.update({
        where: { id },
        data,
      });
      return { success: true, data: updated };
    }),

  // Delete Crisis Event
  deleteCrisisEvent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.crisisEvent.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Create Economic Indicator
  createEconomicIndicator: protectedProcedure
    .input(z.object({
      globalGDP: z.number(),
      globalGrowth: z.number(),
      inflationRate: z.number(),
      unemploymentRate: z.number(),
      tradeVolume: z.number(),
      currencyVolatility: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const newIndicator = await ctx.db.economicIndicator.create({
        data: { ...input, timestamp: new Date() },
      });
      return { success: true, data: newIndicator };
    }),

  // Update Economic Indicator
  updateEconomicIndicator: protectedProcedure
    .input(z.object({
      id: z.string(),
      globalGDP: z.number().optional(),
      globalGrowth: z.number().optional(),
      inflationRate: z.number().optional(),
      unemploymentRate: z.number().optional(),
      tradeVolume: z.number().optional(),
      currencyVolatility: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.db.economicIndicator.update({
        where: { id },
        data,
      });
      return { success: true, data: updated };
    }),

  // Delete Economic Indicator
  deleteEconomicIndicator: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.economicIndicator.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Create Diplomatic Relation
  createDiplomaticRelation: protectedProcedure
    .input(z.object({
      country1: z.string(),
      country2: z.string(),
      relationship: z.enum(['alliance', 'neutral', 'tension', 'conflict', 'partnership']),
      strength: z.number(),
      treaties: z.array(z.string()),
      status: z.enum(['active', 'monitoring', 'dormant', 'hostile']),
      diplomaticChannels: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const newRelation = await ctx.db.diplomaticRelation.create({
        data: {
          ...input,
          treaties: JSON.stringify(input.treaties),
          diplomaticChannels: JSON.stringify(input.diplomaticChannels),
          lastContact: new Date(),
        },
      });
      return { success: true, data: newRelation };
    }),

  // Update Diplomatic Relation
  updateDiplomaticRelation: protectedProcedure
    .input(z.object({
      id: z.string(),
      relationship: z.enum(['alliance', 'neutral', 'tension', 'conflict', 'partnership']).optional(),
      strength: z.number().optional(),
      treaties: z.array(z.string()).optional(),
      status: z.enum(['active', 'monitoring', 'dormant', 'hostile']).optional(),
      diplomaticChannels: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, treaties, diplomaticChannels, ...data } = input;
      const updated = await ctx.db.diplomaticRelation.update({
        where: { id },
        data: {
          ...data,
          ...(treaties ? { treaties: JSON.stringify(treaties) } : {}),
          ...(diplomaticChannels ? { diplomaticChannels: JSON.stringify(diplomaticChannels) } : {}),
        },
      });
      return { success: true, data: updated };
    }),

  // Delete Diplomatic Relation
  deleteDiplomaticRelation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.diplomaticRelation.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Create Treaty
  createTreaty: protectedProcedure
    .input(z.object({
      name: z.string(),
      parties: z.array(z.string()),
      type: z.enum(['economic', 'military', 'cultural', 'environmental', 'scientific', 'security']),
      status: z.enum(['active', 'pending', 'expired', 'suspended']),
      signedDate: z.date(),
      expiryDate: z.date(),
      description: z.string().optional(),
      complianceRate: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const newTreaty = await ctx.db.treaty.create({
        data: {
          ...input,
          parties: JSON.stringify(input.parties),
        },
      });
      return { success: true, data: newTreaty };
    }),

  // Update Treaty
  updateTreaty: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['active', 'pending', 'expired', 'suspended']).optional(),
      description: z.string().optional(),
      complianceRate: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.db.treaty.update({
        where: { id },
        data: {
          ...data,
        },
      });
      return { success: true, data: updated };
    }),

  // Delete Treaty
  deleteTreaty: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.treaty.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Search functionality
  searchSDI: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      categories: z.array(z.string()).optional(),
      dateRange: z.object({
        start: z.date(),
        end: z.date()
      }).optional()
    }))
    .query(async ({ ctx, input }) => {
      // Mock search implementation - replace with real search logic
      const mockResults = [
        {
          type: 'intelligence',
          id: '1',
          title: 'Major Trade Agreement Signed',
          content: 'Comprehensive trade deal between Latium and Sarpedon...',
          relevance: 0.95
        },
        {
          type: 'crisis',
          id: '2',
          title: 'Severe Flooding in Sarpedon Region',
          content: 'Catastrophic flooding affects three nations...',
          relevance: 0.87
        }
      ];

      return {
        results: mockResults,
        total: mockResults.length,
        query: input.query
      };
    })
}); 