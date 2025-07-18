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
      orderBy: { timestamp: 'desc' },
    });
    return crises.map((crisis: any) => ({
      ...crisis,
      affectedCountries: crisis.affectedCountries ? JSON.parse(crisis.affectedCountries) : [],
    }));
  }),

  getCrisisEvents: publicProcedure.query(async ({ ctx }) => {
    const crises = await ctx.db.crisisEvent.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50
    });
    return crises.map((crisis: any) => ({
      ...crisis,
      status: crisis.responseStatus || 'monitoring', // Map responseStatus to status for compatibility
      affectedCountries: crisis.affectedCountries ? JSON.parse(crisis.affectedCountries) : [],
    }));
  }),

  getResponseTeams: publicProcedure.query(async ({ ctx }) => {
    // Generate response teams based on active crises
    const activeCrises = await ctx.db.crisisEvent.findMany({
      where: { responseStatus: { not: 'resolved' } },
      orderBy: { timestamp: 'desc' }
    });

    const responseTeams = [];
    
    // Generate teams based on crisis types
    const crisisTypes = new Set(activeCrises.map(c => c.type));
    
    if (crisisTypes.has('economic_crisis')) {
      responseTeams.push({
        id: 'economic-team',
        name: 'Economic Stabilization Unit',
        status: 'deployed',
        location: 'Global',
        assignedCrises: activeCrises.filter(c => c.type === 'economic_crisis').length
      });
    }
    
    if (crisisTypes.has('natural_disaster')) {
      const disasters = activeCrises.filter(c => c.type === 'natural_disaster');
      responseTeams.push({
        id: 'disaster-team',
        name: 'International Aid Coordination',
        status: disasters.length > 0 ? 'deployed' : 'standby',
        location: disasters.length > 0 ? JSON.parse(disasters[0]?.affectedCountries || '[]')[0] || 'Multiple' : 'Standby',
        assignedCrises: disasters.length
      });
    }
    
    if (crisisTypes.has('political_crisis')) {
      responseTeams.push({
        id: 'diplomatic-team',
        name: 'Diplomatic Crisis Team',
        status: 'monitoring',
        location: 'Multiple',
        assignedCrises: activeCrises.filter(c => c.type === 'political_crisis').length
      });
    }
    
    // Always have a general monitoring team
    responseTeams.push({
      id: 'general-team',
      name: 'Global Monitoring Center',
      status: activeCrises.length > 0 ? 'active' : 'standby',
      location: 'Global',
      assignedCrises: activeCrises.length
    });
    
    return responseTeams;
  }),

  // Economic Intelligence
  getEconomicIndicators: publicProcedure.query(async ({ ctx }) => {
    // Aggregate live data from all countries at current IxTime
    const targetTime = require("~/lib/ixtime").IxTime.getCurrentIxTime();
    const countries = await ctx.db.country.findMany({});

    let globalGDP = 0;
    let totalGrowth = 0;
    let totalInflation = 0;
    let totalUnemployment = 0;
    let count = 0;

    for (const c of countries) {
      globalGDP += c.currentTotalGdp || (c.baselinePopulation * c.baselineGdpPerCapita) || 0;
      totalGrowth += c.realGDPGrowthRate || c.adjustedGdpGrowth || 0.03;
      totalInflation += c.inflationRate || 0.02;
      totalUnemployment += c.unemploymentRate || 5.0;
      count++;
    }

    // Calculate averages
    const globalGrowth = count > 0 ? (totalGrowth / count) * 100 : 0;
    const inflationRate = count > 0 ? (totalInflation / count) * 100 : 0;
    const unemploymentRate = count > 0 ? (totalUnemployment / count) : 0;

    return {
      globalGDP,
      globalGrowth,
      inflationRate,
      unemploymentRate,
      timestamp: new Date(targetTime)
    };
  }),

  getCommodityPrices: publicProcedure.query(async ({ ctx }) => {
    // Calculate commodity prices based on economic indicators and crises
    const [recentIndicators, crises] = await Promise.all([
      ctx.db.economicIndicator.findMany({
        orderBy: { timestamp: 'desc' },
        take: 2
      }),
      ctx.db.crisisEvent.findMany({
        where: {
          type: { in: ['economic_crisis', 'natural_disaster', 'environmental'] },
          timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }
      })
    ]);
    
    // Base prices (can be adjusted based on real economic data)
    const basePrices = {
      oil: 85.20,
      gold: 1950.50,
      copper: 3.85,
      wheat: 5.20,
      gas: 2.85
    };
    
    // Calculate price changes based on economic indicators
    let inflationFactor = 1.0;
    let volatilityFactor = 1.0;
    
    if (recentIndicators.length >= 2) {
      const latest = recentIndicators[0]!;
      const previous = recentIndicators[1]!;
      
      inflationFactor = 1 + (latest.inflationRate - previous.inflationRate) / 100;
      volatilityFactor = 1 + (latest.currencyVolatility - previous.currencyVolatility) / 100;
    }
    
    // Crisis impact on commodities
    const crisisImpact = {
      oil: 0,
      gold: 0,
      copper: 0,
      wheat: 0,
      gas: 0
    };
    
    crises.forEach(crisis => {
      const severity = crisis.severity === 'critical' ? 0.15 : 
                     crisis.severity === 'high' ? 0.10 : 
                     crisis.severity === 'medium' ? 0.05 : 0.02;
      
      if (crisis.type === 'economic_crisis') {
        crisisImpact.gold += severity; // Safe haven demand
        crisisImpact.oil -= severity * 0.5; // Reduced demand
      } else if (crisis.type === 'natural_disaster') {
        crisisImpact.wheat += severity; // Food security
        crisisImpact.copper -= severity * 0.3; // Infrastructure damage
      } else if (crisis.type === 'environmental') {
        crisisImpact.gas += severity; // Energy transition
        crisisImpact.copper += severity * 0.2; // Green tech demand
      }
    });
    
    // Calculate final prices and trends
    const commodities = [
      {
        name: 'Oil (Brent)',
        price: Number((basePrices.oil * inflationFactor * (1 + crisisImpact.oil)).toFixed(2)),
        change: Number((crisisImpact.oil * 100).toFixed(1)),
        trend: crisisImpact.oil > 0.01 ? 'up' as const : crisisImpact.oil < -0.01 ? 'down' as const : 'stable' as const
      },
      {
        name: 'Gold',
        price: Number((basePrices.gold * inflationFactor * (1 + crisisImpact.gold)).toFixed(2)),
        change: Number((crisisImpact.gold * 100).toFixed(1)),
        trend: crisisImpact.gold > 0.01 ? 'up' as const : crisisImpact.gold < -0.01 ? 'down' as const : 'stable' as const
      },
      {
        name: 'Copper',
        price: Number((basePrices.copper * inflationFactor * (1 + crisisImpact.copper)).toFixed(2)),
        change: Number((crisisImpact.copper * 100).toFixed(1)),
        trend: crisisImpact.copper > 0.01 ? 'up' as const : crisisImpact.copper < -0.01 ? 'down' as const : 'stable' as const
      },
      {
        name: 'Wheat',
        price: Number((basePrices.wheat * inflationFactor * (1 + crisisImpact.wheat)).toFixed(2)),
        change: Number((crisisImpact.wheat * 100).toFixed(1)),
        trend: crisisImpact.wheat > 0.01 ? 'up' as const : crisisImpact.wheat < -0.01 ? 'down' as const : 'stable' as const
      },
      {
        name: 'Natural Gas',
        price: Number((basePrices.gas * inflationFactor * (1 + crisisImpact.gas)).toFixed(2)),
        change: Number((crisisImpact.gas * 100).toFixed(1)),
        trend: crisisImpact.gas > 0.01 ? 'up' as const : crisisImpact.gas < -0.01 ? 'down' as const : 'stable' as const
      }
    ];
    
    return commodities;
  }),

  getEconomicAlerts: publicProcedure.query(async ({ ctx }) => {
    // Generate alerts based on recent crisis events with economic impact
    const recentCrises = await ctx.db.crisisEvent.findMany({
      where: {
        type: { in: ['economic_crisis', 'natural_disaster'] } // Use actual field name from schema
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    return recentCrises.map(crisis => ({
      id: crisis.id,
      type: crisis.type,
      title: crisis.title,
      severity: crisis.severity,
      description: crisis.description || `${crisis.title} - Economic impact analysis ongoing`,
      timestamp: crisis.timestamp,
      affectedCountries: crisis.affectedCountries
    }));
  }),

  // Diplomatic Relations
  getDiplomaticRelations: publicProcedure.query(async ({ ctx }) => {
    const relations = await ctx.db.diplomaticRelation.findMany({
      orderBy: { lastContact: 'desc' },
    });
    return relations.map((relation: any) => ({
      ...relation,
      treaties: relation.treaties ? JSON.parse(relation.treaties) : [],
      diplomaticChannels: relation.diplomaticChannels ? JSON.parse(relation.diplomaticChannels) : [],
    }));
  }),

  getActiveTreaties: publicProcedure.query(async ({ ctx }) => {
    const treaties = await ctx.db.treaty.findMany({
      orderBy: { signedDate: 'desc' },
    });
    return treaties.map((treaty: any) => ({
      ...treaty,
      parties: treaty.parties ? JSON.parse(treaty.parties) : [],
    }));
  }),

  // TODO: Implement getDiplomaticEvents when diplomaticEvent table/model is available

  // System Status
  getSystemStatus: publicProcedure.query(async ({ ctx }) => {
    // Calculate real system metrics
    const [crisisCount, intelligenceCount, treatyCount, relationCount] = await Promise.all([
      ctx.db.crisisEvent.count({ where: { responseStatus: { not: 'resolved' } } }),
      ctx.db.intelligenceItem.count({ where: { timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      ctx.db.treaty.count({ where: { status: 'active' } }),
      ctx.db.diplomaticRelation.count({ where: { status: 'active' } })
    ]);
    
    // Calculate system health based on data freshness and crisis severity
    const recentCrises = await ctx.db.crisisEvent.findMany({
      where: { 
        responseStatus: { not: 'resolved' },
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }
    });
    
    const criticalCrises = recentCrises.filter(c => c.severity === 'critical').length;
    const highCrises = recentCrises.filter(c => c.severity === 'high').length;
    
    let systemHealth: 'operational' | 'warning' | 'critical' = 'operational';
    let uptime = 99.8;
    
    if (criticalCrises > 0) {
      systemHealth = 'critical';
      uptime = 95.0;
    } else if (highCrises > 2 || crisisCount > 10) {
      systemHealth = 'warning';
      uptime = 98.5;
    }
    
    return {
      timestamp: new Date(),
      activeUsers: Math.floor(Math.random() * 15) + 10, // Simulated user count
      activeCrises: crisisCount,
      intelligenceItems: intelligenceCount,
      diplomaticEvents: relationCount,
      systemHealth,
      uptime,
      lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      activeTreaties: treatyCount,
      criticalAlerts: criticalCrises
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
      const searchTerm = input.query.toLowerCase();
      const results: any[] = [];
      
      // Build date filter
      const dateFilter = input.dateRange ? {
        timestamp: {
          gte: input.dateRange.start,
          lte: input.dateRange.end
        }
      } : {};
      
      // Search intelligence items
      if (!input.categories || input.categories.includes('intelligence')) {
        const intelligenceItems = await ctx.db.intelligenceItem.findMany({
          where: {
            ...dateFilter,
            OR: [
              { title: { contains: searchTerm } },
              { content: { contains: searchTerm } },
              { source: { contains: searchTerm } }
            ]
          },
          take: 20
        });
        
        intelligenceItems.forEach(item => {
          const titleMatch = item.title.toLowerCase().includes(searchTerm);
          const contentMatch = item.content.toLowerCase().includes(searchTerm);
          const relevance = titleMatch ? 0.9 : contentMatch ? 0.7 : 0.5;
          
          results.push({
            type: 'intelligence',
            id: item.id,
            title: item.title,
            content: item.content.substring(0, 200) + '...',
            relevance,
            timestamp: item.timestamp,
            category: item.category
          });
        });
      }
      
      // Search crisis events
      if (!input.categories || input.categories.includes('crisis')) {
        const crisisEvents = await ctx.db.crisisEvent.findMany({
          where: {
            ...dateFilter,
            OR: [
              { title: { contains: searchTerm } },
              { description: { contains: searchTerm } },
              { location: { contains: searchTerm } }
            ]
          },
          take: 20
        });
        
        crisisEvents.forEach(crisis => {
          const titleMatch = crisis.title.toLowerCase().includes(searchTerm);
          const descMatch = crisis.description?.toLowerCase().includes(searchTerm);
          const locationMatch = crisis.location?.toLowerCase().includes(searchTerm);
          const relevance = titleMatch ? 0.9 : descMatch ? 0.8 : locationMatch ? 0.6 : 0.5;
          
          results.push({
            type: 'crisis',
            id: crisis.id,
            title: crisis.title,
            content: crisis.description || 'No description available',
            relevance,
            timestamp: crisis.timestamp,
            severity: crisis.severity,
            location: crisis.location
          });
        });
      }
      
      // Search treaties
      if (!input.categories || input.categories.includes('diplomatic')) {
        const treaties = await ctx.db.treaty.findMany({
          where: {
            OR: [
              { name: { contains: searchTerm } },
              { description: { contains: searchTerm } }
            ]
          },
          take: 20
        });
        
        treaties.forEach(treaty => {
          const nameMatch = treaty.name.toLowerCase().includes(searchTerm);
          const descMatch = treaty.description?.toLowerCase().includes(searchTerm);
          const relevance = nameMatch ? 0.9 : descMatch ? 0.7 : 0.5;
          
          results.push({
            type: 'treaty',
            id: treaty.id,
            title: treaty.name,
            content: treaty.description || 'No description available',
            relevance,
            timestamp: treaty.signedDate,
            status: treaty.status
          });
        });
      }
      
      // Sort by relevance and timestamp
      results.sort((a, b) => {
        if (a.relevance !== b.relevance) return b.relevance - a.relevance;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      return {
        results: results.slice(0, 50), // Limit to 50 results
        total: results.length,
        query: input.query
      };
    }),

  getNotifications: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Fetch notifications for the user or their country
      const user = await ctx.db.user.findUnique({ where: { clerkUserId: input.userId } });
      const countryId = user?.countryId;
      const notifications = await ctx.db.notification.findMany({
        where: {
          OR: [
            { userId: input.userId },
            { countryId: countryId }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      return notifications;
    }),
  getUnreadNotifications: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Count unread notifications for the user or their country
      const user = await ctx.db.user.findUnique({ where: { clerkUserId: input.userId } });
      const countryId = user?.countryId;
      const count = await ctx.db.notification.count({
        where: {
          read: false,
          OR: [
            { userId: input.userId },
            { countryId: countryId }
          ]
        }
      });
      return count;
    }),
  createNotification: publicProcedure
    .input(z.object({
      userId: z.string().optional(),
      countryId: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      href: z.string().optional(),
      type: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.db.notification.create({
        data: {
          userId: input.userId,
          countryId: input.countryId,
          title: input.title,
          description: input.description,
          href: input.href,
          type: input.type,
        }
      });
      return notification;
    }),
  // --- BEGIN: getAchievements mock implementation ---
  getAchievements: publicProcedure.query(async () => {
    // TODO: Replace with real achievement logic
    return [
      {
        id: '1',
        title: 'First Crisis Resolved',
        description: 'Successfully resolved your first crisis event.',
        badge: '🏅',
        time: new Date().toISOString(),
        unlocked: true
      },
      {
        id: '2',
        title: 'Economic Boom',
        description: 'Achieved 5%+ GDP growth in a single year.',
        badge: '📈',
        time: new Date(Date.now() - 86400000).toISOString(),
        unlocked: false
      },
      {
        id: '3',
        title: 'Diplomatic Master',
        description: 'Formed 3+ active alliances.',
        badge: '🤝',
        time: new Date(Date.now() - 2 * 86400000).toISOString(),
        unlocked: true
      }
    ];
  }),
  // --- END: getAchievements mock implementation ---
});

// Helper function to trigger a notification (for use in other routers)
export async function triggerNotification(ctx: any, {
  userId,
  countryId,
  title,
  description,
  href,
  type
}: {
  userId?: string,
  countryId?: string,
  title: string,
  description?: string,
  href?: string,
  type?: string
}) {
  return ctx.db.notification.create({
    data: {
      userId,
      countryId,
      title,
      description,
      href,
      type
    }
  });
} 