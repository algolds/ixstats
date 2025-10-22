import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";
import { notificationHooks } from "~/lib/notification-hooks";

export const diplomaticRouter = createTRPCRouter({
  // Get diplomatic relationships for a country
  getRelationships: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Get live diplomatic relations from database
        const relations = await ctx.db.diplomaticRelation.findMany({
          where: {
            OR: [
              { country1: input.countryId },
              { country2: input.countryId }
            ]
          },
          orderBy: [
            { strength: 'desc' },
            { lastContact: 'desc' }
          ]
        });

        // Transform relations to match expected format
        const transformedRelations = relations.map(relation => ({
          id: relation.id,
          targetCountry: relation.country1 === input.countryId ? relation.country2 : relation.country1,
          targetCountryId: relation.country1 === input.countryId ? relation.country2 : relation.country1,
          relationship: relation.relationship,
          strength: relation.strength,
          treaties: relation.treaties ? JSON.parse(relation.treaties) : [],
          lastContact: relation.lastContact.toISOString(),
          status: relation.status,
          diplomaticChannels: relation.diplomaticChannels ? JSON.parse(relation.diplomaticChannels) : [],
          tradeVolume: relation.tradeVolume || 0,
          culturalExchange: relation.culturalExchange || 'Medium',
          recentActivity: relation.recentActivity,
          economicTier: relation.economicTier,
          flagUrl: relation.flagUrl,
          establishedAt: relation.establishedAt.toISOString()
        }));

        return transformedRelations;
      } catch (error) {
        console.error('Error fetching diplomatic relations:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch diplomatic relations',
          cause: error,
        });
      }
    }),

  // Get recent diplomatic changes
  getRecentChanges: publicProcedure
    .input(z.object({
      countryId: z.string(),
      hours: z.number().optional().default(24)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const cutoffDate = new Date(Date.now() - input.hours * 60 * 60 * 1000);
        const changes: Array<{
          id: string;
          targetCountry: string;
          currentStatus: string;
          previousStatus?: string;
          updatedAt: string;
          changeType: string;
          description?: string;
        }> = [];

        // 1. Recent diplomatic events (relationship changes, embassy events, mission completions)
        const diplomaticEvents = await ctx.db.diplomaticEvent.findMany({
          where: {
            OR: [
              { country1Id: input.countryId },
              { country2Id: input.countryId }
            ],
            createdAt: { gte: cutoffDate }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        });

        for (const event of diplomaticEvents) {
          const targetCountryId = event.country1Id === input.countryId ? event.country2Id : event.country1Id;

          // Get target country name
          let targetCountryName = 'Unknown';
          if (targetCountryId) {
            const targetCountry = await ctx.db.country.findUnique({
              where: { id: targetCountryId },
              select: { name: true }
            });
            targetCountryName = targetCountry?.name || 'Unknown';
          }

          changes.push({
            id: event.id,
            targetCountry: targetCountryName,
            currentStatus: event.eventType,
            updatedAt: event.createdAt.toISOString(),
            changeType: event.eventType,
            description: event.description
          });
        }

        // 2. Recent embassy status changes
        const recentEmbassies = await ctx.db.embassy.findMany({
          where: {
            OR: [
              { hostCountryId: input.countryId },
              { guestCountryId: input.countryId }
            ],
            updatedAt: { gte: cutoffDate }
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          include: {
            hostCountry: { select: { name: true } },
            guestCountry: { select: { name: true } }
          }
        });

        for (const embassy of recentEmbassies) {
          const isHost = embassy.hostCountryId === input.countryId;
          const partnerCountry = isHost ? embassy.guestCountry : embassy.hostCountry;

          changes.push({
            id: embassy.id,
            targetCountry: partnerCountry?.name || 'Unknown',
            currentStatus: embassy.status,
            updatedAt: embassy.updatedAt.toISOString(),
            changeType: 'embassy_update',
            description: `Embassy ${embassy.status === 'ACTIVE' ? 'operational' : embassy.status}`
          });
        }

        // 3. Recent missions completed/failed
        const recentMissions = await ctx.db.embassyMission.findMany({
          where: {
            embassy: {
              OR: [
                { hostCountryId: input.countryId },
                { guestCountryId: input.countryId }
              ]
            },
            status: { in: ['completed', 'failed'] },
            updatedAt: { gte: cutoffDate }
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          include: {
            embassy: {
              include: {
                hostCountry: { select: { name: true } },
                guestCountry: { select: { name: true } }
              }
            }
          }
        });

        for (const mission of recentMissions) {
          const isGuest = mission.embassy.guestCountryId === input.countryId;
          const partnerCountry = isGuest ? mission.embassy.hostCountry : mission.embassy.guestCountry;

          changes.push({
            id: mission.id,
            targetCountry: partnerCountry?.name || 'Unknown',
            currentStatus: mission.status,
            updatedAt: mission.updatedAt.toISOString(),
            changeType: 'mission_' + mission.status,
            description: `${mission.name} ${mission.status}`
          });
        }

        // 4. Recent cultural exchanges
        const recentExchanges = await ctx.db.culturalExchange.findMany({
          where: {
            OR: [
              { hostCountryId: input.countryId },
              {
                participatingCountries: {
                  some: { countryId: input.countryId }
                }
              }
            ],
            updatedAt: { gte: cutoffDate }
          },
          orderBy: { updatedAt: 'desc' },
          take: 10
        });

        for (const exchange of recentExchanges) {
          changes.push({
            id: exchange.id,
            targetCountry: exchange.hostCountryName,
            currentStatus: exchange.status,
            updatedAt: exchange.updatedAt.toISOString(),
            changeType: 'cultural_exchange',
            description: `${exchange.title} - ${exchange.type}`
          });
        }

        // 5. Recent treaties signed
        const recentTreaties = await ctx.db.treaty.findMany({
          where: {
            parties: { contains: input.countryId },
            updatedAt: { gte: cutoffDate }
          },
          orderBy: { updatedAt: 'desc' },
          take: 10
        });

        for (const treaty of recentTreaties) {
          changes.push({
            id: treaty.id,
            targetCountry: treaty.name,
            currentStatus: treaty.status,
            updatedAt: treaty.updatedAt.toISOString(),
            changeType: 'treaty_' + treaty.status.toLowerCase(),
            description: treaty.description || treaty.name
          });
        }

        // Sort all changes by date descending and limit to 20 most recent
        const sortedChanges = changes
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 20);

        return sortedChanges;
      } catch (error) {
        console.error('Error fetching recent diplomatic changes:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recent diplomatic changes',
          cause: error,
        });
      }
    }),

  // Update diplomatic relationship
  updateRelationship: protectedProcedure
    .input(z.object({
      relationId: z.string(),
      relationship: z.string().optional(),
      strength: z.number().optional(),
      status: z.string().optional(),
      treaties: z.array(z.string()).optional(),
      diplomaticChannels: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new Error('You must be associated with a country to update diplomatic relationships.');
      }

      // Verify user owns one of the countries in this relation
      const relation = await ctx.db.diplomaticRelation.findUnique({
        where: { id: input.relationId }
      });

      if (!relation || (relation.country1 !== ctx.user.countryId && relation.country2 !== ctx.user.countryId)) {
        throw new Error('You do not have permission to update this relationship.');
      }

      const updateData: any = {};

      if (input.relationship) updateData.relationship = input.relationship;
      if (input.strength !== undefined) updateData.strength = input.strength;
      if (input.status) updateData.status = input.status;
      if (input.treaties) updateData.treaties = JSON.stringify(input.treaties);
      if (input.diplomaticChannels) updateData.diplomaticChannels = JSON.stringify(input.diplomaticChannels);

      return await ctx.db.diplomaticRelation.update({
        where: { id: input.relationId },
        data: updateData
      });
    }),

  // Embassy Network Operations
  getEmbassies: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const embassies = await ctx.db.embassy.findMany({
        where: {
          OR: [
            { hostCountryId: input.countryId },
            { guestCountryId: input.countryId }
          ]
        },
        orderBy: { establishedAt: 'desc' },
        include: {
          hostCountry: { select: { id: true, name: true, flag: true } },
          guestCountry: { select: { id: true, name: true, flag: true } }
        }
      });

      return embassies.map(embassy => {
        const isHost = embassy.hostCountryId === input.countryId;
        const partnerCountry = isHost ? embassy.guestCountry : embassy.hostCountry;

        return {
          id: embassy.id,
          hostCountryId: embassy.hostCountryId,
          guestCountryId: embassy.guestCountryId,
          countryId: partnerCountry?.id ?? null,
          country: partnerCountry?.name ?? 'Unknown',
          countryFlag: partnerCountry?.flag ?? null,
          status: embassy.status,
          strength: Math.floor((embassy.staffCount || 5) * 8 + (embassy.services ? JSON.parse(embassy.services).length * 10 : 30)),
          role: isHost ? 'host' as const : 'guest' as const,
          ambassadorName: embassy.ambassadorName,
          location: embassy.location,
          staffCount: embassy.staffCount,
          services: embassy.services ? JSON.parse(embassy.services) : [],
          establishedAt: embassy.establishedAt.toISOString(),
          level: embassy.level,
          experience: embassy.experience,
          influence: embassy.influence,
          budget: embassy.budget,
          maintenanceCost: embassy.maintenanceCost,
          securityLevel: embassy.securityLevel,
          specialization: embassy.specialization,
          specializationLevel: embassy.specializationLevel,
          lastMaintenance: embassy.lastMaintenancePaid?.toISOString() ?? null,
          updatedAt: embassy.updatedAt.toISOString(),
        };
      });
    }),

  establishEmbassy: protectedProcedure
    .input(z.object({
      hostCountryId: z.string(),
      guestCountryId: z.string(),
      name: z.string(),
      location: z.string().optional(),
      ambassadorName: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new Error('You must be associated with a country to establish embassies.');
      }

      // Verify user owns the guest country (the one establishing the embassy)
      if (ctx.user.countryId !== input.guestCountryId) {
        throw new Error('You can only establish embassies for your own country.');
      }

      const embassy = await ctx.db.embassy.create({
        data: {
          hostCountryId: input.hostCountryId,
          guestCountryId: input.guestCountryId,
          name: input.name,
          location: input.location,
          ambassadorName: input.ambassadorName,
          status: 'active'
        }
      });

      let hostCountryName: string | null = null;
      let guestCountryName: string | null = null;

      // 🔔 Notify both countries about embassy establishment
      try {
        // Get country names for better messaging
        const [hostCountry, guestCountry] = await Promise.all([
          ctx.db.country.findUnique({ where: { id: input.hostCountryId }, select: { name: true } }),
          ctx.db.country.findUnique({ where: { id: input.guestCountryId }, select: { name: true } })
        ]);

        hostCountryName = hostCountry?.name ?? null;
        guestCountryName = guestCountry?.name ?? null;

        // Notify host country
        await notificationAPI.create({
          title: '🏛️ New Embassy Established',
          message: `${guestCountryName || 'A country'} has established ${input.name} in your nation`,
          countryId: input.hostCountryId,
          category: 'diplomatic',
          priority: 'medium',
          href: '/diplomatic',
          source: 'diplomatic-system',
          actionable: true,
          metadata: { embassyId: embassy.id, guestCountryId: input.guestCountryId },
        });

        // Notify guest country (confirmation)
        await notificationAPI.create({
          title: '🏛️ Embassy Establishment Confirmed',
          message: `${input.name} has been successfully established in ${hostCountryName || 'the host nation'}`,
          countryId: input.guestCountryId,
          category: 'diplomatic',
          priority: 'low',
          type: 'success',
          href: '/diplomatic',
          source: 'diplomatic-system',
          actionable: false,
          metadata: { embassyId: embassy.id, hostCountryId: input.hostCountryId },
        });
      } catch (error) {
        console.error('[Diplomatic] Failed to send embassy notifications:', error);
        // Don't fail the embassy creation if notifications fail
      }

      return {
        ...embassy,
        hostCountryName,
        guestCountryName,
      };
    }),

  // Diplomatic Channels
  getChannels: publicProcedure
    .input(z.object({
      countryId: z.string(),
      clearanceLevel: z.enum(['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL']).optional().default('PUBLIC')
    }))
    .query(async ({ ctx, input }) => {
      try {
        const channels = await ctx.db.diplomaticChannel.findMany({
          where: {
            participants: {
              some: {
                countryId: input.countryId
              }
            },
            // Filter by clearance level
            classification: input.clearanceLevel === 'CONFIDENTIAL' 
              ? undefined 
              : input.clearanceLevel === 'RESTRICTED' 
                ? { in: ['PUBLIC', 'RESTRICTED'] }
                : 'PUBLIC'
          },
          include: {
            participants: true,
            _count: {
              select: {
                messages: {
                  where: {
                    status: { notIn: ['READ'] },
                    fromCountryId: { not: input.countryId }
                  }
                }
              }
            }
          },
          orderBy: { lastActivity: 'desc' }
        });

        return channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          classification: channel.classification,
          encrypted: channel.encrypted,
          lastActivity: channel.lastActivity.toISOString(),
          unreadCount: channel._count.messages,
          participants: channel.participants.map(p => ({
            countryId: p.countryId,
            countryName: p.countryName,
            flagUrl: p.flagUrl,
            role: p.role
          }))
        }));
      } catch (error) {
        return [];
      }
    }),

  getChannelMessages: publicProcedure
    .input(z.object({
      channelId: z.string(),
      countryId: z.string(),
      clearanceLevel: z.enum(['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL']).optional().default('PUBLIC'),
      limit: z.number().optional().default(50)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const messages = await ctx.db.diplomaticMessage.findMany({
          where: {
            channelId: input.channelId,
            classification: input.clearanceLevel === 'CONFIDENTIAL' 
              ? undefined 
              : input.clearanceLevel === 'RESTRICTED' 
                ? { in: ['PUBLIC', 'RESTRICTED'] }
                : 'PUBLIC'
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit
        });

        return messages.map(msg => ({
          id: msg.id,
          from: {
            countryId: msg.fromCountryId,
            countryName: msg.fromCountryName
          },
          to: msg.toCountryId ? {
            countryId: msg.toCountryId,
            countryName: msg.toCountryName
          } : null,
          subject: msg.subject,
          content: msg.content,
          classification: msg.classification,
          priority: msg.priority,
          status: msg.status,
          encrypted: msg.encrypted,
          ixTimeTimestamp: msg.ixTimeTimestamp,
          timestamp: msg.createdAt.toISOString()
        }));
      } catch (error) {
        return [];
      }
    }),

  sendMessage: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      fromCountryId: z.string(),
      fromCountryName: z.string(),
      toCountryId: z.string().optional(),
      toCountryName: z.string().optional(),
      subject: z.string().optional(),
      content: z.string(),
      classification: z.enum(['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL']).default('PUBLIC'),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
      encrypted: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new Error('You must be associated with a country to send diplomatic messages.');
      }

      // Verify user owns the country sending the message
      if (ctx.user.countryId !== input.fromCountryId) {
        throw new Error('You can only send messages from your own country.');
      }

      const message = await ctx.db.diplomaticMessage.create({
        data: {
          channelId: input.channelId,
          fromCountryId: input.fromCountryId,
          fromCountryName: input.fromCountryName,
          toCountryId: input.toCountryId,
          toCountryName: input.toCountryName,
          subject: input.subject,
          content: input.content,
          classification: input.classification,
          priority: input.priority,
          encrypted: input.encrypted,
          ixTimeTimestamp: IxTime.getCurrentIxTime()
        }
      });

      // Update channel last activity
      await ctx.db.diplomaticChannel.update({
        where: { id: input.channelId },
        data: { lastActivity: new Date() }
      });

      return message;
    }),

  // Cultural Exchanges
  getCulturalExchanges: publicProcedure
    .input(z.object({
      countryId: z.string(),
      status: z.enum(['planning', 'active', 'completed', 'cancelled']).optional(),
      type: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const exchanges = await ctx.db.culturalExchange.findMany({
          where: {
            OR: [
              { hostCountryId: input.countryId },
              {
                participatingCountries: {
                  some: {
                    countryId: input.countryId
                  }
                }
              }
            ],
            ...(input.status && { status: input.status }),
            ...(input.type && { type: input.type })
          },
          include: {
            participatingCountries: true,
            culturalArtifacts: true
          },
          orderBy: [
            { status: 'asc' }, // Active first
            { startDate: 'desc' }
          ]
        });

        return exchanges.map(exchange => ({
          id: exchange.id,
          title: exchange.title,
          type: exchange.type,
          description: exchange.description,
          hostCountry: {
            id: exchange.hostCountryId,
            name: exchange.hostCountryName,
            flagUrl: exchange.hostCountryFlag
          },
          participatingCountries: exchange.participatingCountries.map(p => ({
            id: p.countryId,
            name: p.countryName,
            flagUrl: p.flagUrl,
            role: p.role
          })),
          status: exchange.status,
          startDate: exchange.startDate.toISOString(),
          endDate: exchange.endDate.toISOString(),
          ixTimeContext: exchange.ixTimeContext,
          metrics: {
            participants: exchange.participants,
            culturalImpact: exchange.culturalImpact,
            diplomaticValue: exchange.diplomaticValue,
            socialEngagement: exchange.socialEngagement
          },
          achievements: exchange.achievements ? JSON.parse(exchange.achievements) : [],
          culturalArtifacts: exchange.culturalArtifacts.map(artifact => ({
            id: artifact.id,
            type: artifact.type,
            title: artifact.title,
            thumbnailUrl: artifact.thumbnailUrl,
            contributor: artifact.contributor,
            countryId: artifact.countryId
          }))
        }));
      } catch (error) {
        return [];
      }
    }),

  createCulturalExchange: protectedProcedure
    .input(z.object({
      title: z.string(),
      type: z.enum(['festival', 'exhibition', 'education', 'cuisine', 'arts', 'sports', 'technology', 'diplomacy']),
      description: z.string(),
      hostCountryId: z.string(),
      hostCountryName: z.string(),
      hostCountryFlag: z.string().optional(),
      startDate: z.string(),
      endDate: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId || ctx.user.countryId !== input.hostCountryId) {
        throw new Error('You can only create cultural exchanges for your own country.');
      }

      return await ctx.db.culturalExchange.create({
        data: {
          title: input.title,
          type: input.type,
          description: input.description,
          hostCountryId: input.hostCountryId,
          hostCountryName: input.hostCountryName,
          hostCountryFlag: input.hostCountryFlag,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          ixTimeContext: IxTime.getCurrentIxTime(),
          status: 'planning'
        }
      });
    }),

  joinCulturalExchange: protectedProcedure
    .input(z.object({
      exchangeId: z.string(),
      countryId: z.string(),
      countryName: z.string(),
      flagUrl: z.string().optional(),
      role: z.enum(['co-host', 'participant', 'observer']).default('participant')
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId || ctx.user.countryId !== input.countryId) {
        throw new Error('You can only join cultural exchanges with your own country.');
      }

      const participant = await ctx.db.culturalExchangeParticipant.create({
        data: {
          exchangeId: input.exchangeId,
          countryId: input.countryId,
          countryName: input.countryName,
          flagUrl: input.flagUrl,
          role: input.role
        }
      });

      // Update participant count
      await ctx.db.culturalExchange.update({
        where: { id: input.exchangeId },
        data: {
          participants: {
            increment: 1
          }
        }
      });

      return participant;
    }),

  // Embassy Game System Endpoints

  // Embassy Management
  getEmbassyDetails: publicProcedure
    .input(z.object({ embassyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
        include: {
          missions: {
            where: { status: { in: ['active', 'completed'] } },
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          upgrades: {
            where: { status: { in: ['available', 'in_progress', 'completed'] } },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!embassy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Embassy not found' });

      return {
        ...embassy,
        missions: embassy.missions,
        upgrades: embassy.upgrades,
        nextLevelRequirement: embassy.level * 1000 + 500, // Experience needed for next level
        maintenanceDue: embassy.lastMaintenancePaid < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        canUpgrade: embassy.experience >= (embassy.level * 1000 + 500),
        availableMissions: embassy.currentMissions < embassy.maxMissions
      };
    }),

  calculateEstablishmentCost: publicProcedure
    .input(z.object({
      hostCountryId: z.string(),
      guestCountryId: z.string(),
      targetLocation: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      // Get relationship strength to determine cost multiplier
      const relation = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: input.hostCountryId, country2: input.guestCountryId },
            { country1: input.guestCountryId, country2: input.hostCountryId }
          ]
        }
      });

      // Base cost
      let baseCost = 100000;
      
      // Relationship strength modifier
      const relationshipStrength = relation?.strength || 25;
      const relationshipMultiplier = relationshipStrength < 25 ? 2.0 : 
                                   relationshipStrength < 50 ? 1.5 :
                                   relationshipStrength < 75 ? 1.2 : 1.0;

      // Economic tier modifier (mock - would be based on actual country data)
      const economicTierMultiplier = 1.0; // Would vary by target country's economic tier

      const totalCost = baseCost * relationshipMultiplier * economicTierMultiplier;
      const approvalTime = relationshipStrength < 25 ? 45 : 
                          relationshipStrength < 50 ? 30 : 
                          relationshipStrength < 75 ? 21 : 14; // Days

      return {
        baseCost,
        relationshipMultiplier,
        economicTierMultiplier,
        totalCost: Math.round(totalCost),
        approvalTime,
        requirements: {
          minimumRelationship: 'neutral',
          minimumStrength: 25,
          requiredDocuments: ['Diplomatic Note', 'Country Agreement', 'Security Clearance'],
          specialRequirements: relationshipStrength < 50 ? ['Security Review', 'Extended Approval Process'] : []
        }
      };
    }),


  upgradeEmbassy: protectedProcedure
    .input(z.object({
      embassyId: z.string(),
      upgradeType: z.enum(['staff_expansion', 'security_enhancement', 'tech_upgrade', 'facility_expansion', 'specialization_improvement']),
      level: z.number().min(1).max(3)
    }))
    .mutation(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId }
      });

      if (!embassy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Embassy not found' });

      if (!ctx.user?.countryId || ctx.user.countryId !== embassy.guestCountryId) {
        throw new Error('You can only upgrade your own embassies.');
      }

      const upgradeCosts = {
        staff_expansion: [10000, 25000, 50000],
        security_enhancement: [15000, 35000, 70000],
        tech_upgrade: [20000, 45000, 90000],
        facility_expansion: [30000, 65000, 120000],
        specialization_improvement: [25000, 55000, 100000]
      };

      const upgradeCostArray = upgradeCosts[input.upgradeType];
      if (!upgradeCostArray || !upgradeCostArray[input.level - 1]) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid upgrade type or level' });
      }
      
      const cost = upgradeCostArray[input.level - 1];
      const duration = input.level * 7; // Days

      if (embassy.budget < (cost || 0)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient embassy budget' });
      }

      // Create upgrade record
      const upgrade = await ctx.db.embassyUpgrade.create({
        data: {
          embassyId: input.embassyId,
          upgradeType: input.upgradeType,
          name: `${input.upgradeType.replace('_', ' ')} Level ${input.level}`,
          description: `Upgrade ${input.upgradeType.replace('_', ' ')} to level ${input.level}`,
          level: input.level,
          cost: cost || 0,
          duration,
          requiredLevel: Math.ceil(input.level / 2),
          status: 'in_progress',
          startedAt: new Date(),
          completesAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
          effects: JSON.stringify(getUpgradeEffects(input.upgradeType, input.level))
        }
      });

      // Deduct cost from embassy budget
      await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          budget: { decrement: cost },
          upgradeProgress: 0
        }
      });

      return upgrade;
    }),

  // Embassy Upgrades
  getAvailableUpgrades: publicProcedure
    .input(z.object({ embassyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
        include: {
          upgrades: {
            where: { status: { in: ['available', 'in_progress', 'completed'] } }
          }
        }
      });

      if (!embassy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Embassy not found' });

      const upgradeTypes = [
        'staff_expansion',
        'security_enhancement', 
        'tech_upgrade',
        'facility_expansion',
        'specialization_improvement'
      ];

      const availableUpgrades = upgradeTypes.map(upgradeType => {
        const existingUpgrade = embassy.upgrades?.find(u => u.upgradeType === upgradeType);
        const currentLevel = existingUpgrade?.level || 0;
        const nextLevel = Math.min(currentLevel + 1, 3);

        if (nextLevel > 3) return null;

        const costs = {
          staff_expansion: [10000, 25000, 50000],
          security_enhancement: [15000, 35000, 70000],
          tech_upgrade: [20000, 45000, 90000],
          facility_expansion: [30000, 65000, 120000],
          specialization_improvement: [25000, 55000, 100000]
        };

        return {
          upgradeType,
          currentLevel,
          nextLevel,
          cost: costs[upgradeType as keyof typeof costs][nextLevel - 1],
          duration: nextLevel * 7,
          effects: getUpgradeEffects(upgradeType, nextLevel),
          requirements: {
            embassyLevel: Math.ceil(nextLevel / 2),
            budget: costs[upgradeType as keyof typeof costs][nextLevel - 1]
          },
          canAfford: embassy.budget >= costs[upgradeType as keyof typeof costs][nextLevel - 1],
          meetsLevelReq: embassy.level >= Math.ceil(nextLevel / 2)
        };
      }).filter(Boolean);

      return availableUpgrades;
    }),

  // Embassy Missions
  getAvailableMissions: publicProcedure
    .input(z.object({ embassyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId }
      });

      if (!embassy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Embassy not found' });

      // Generate available missions based on embassy level, specialization, and location
      const missions = generateAvailableMissions(embassy);
      return missions;
    }),

  startMission: protectedProcedure
    .input(z.object({
      embassyId: z.string(),
      missionType: z.enum(['trade_negotiation', 'intelligence_gathering', 'cultural_outreach', 'security_cooperation', 'research_collaboration']),
      staffAssigned: z.number().min(1).max(5),
      priorityLevel: z.enum(['low', 'normal', 'high']).default('normal')
    }))
    .mutation(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId }
      });

      if (!embassy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Embassy not found' });

      if (!ctx.user?.countryId || ctx.user.countryId !== embassy.guestCountryId) {
        throw new Error('You can only start missions for your own embassies.');
      }
      if (embassy.currentMissions >= embassy.maxMissions) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Embassy has reached maximum mission capacity' });
      }
      if (input.staffAssigned > embassy.staffCount) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not enough staff available' });
      }

      const missionData = getMissionData(input.missionType, embassy.level, input.priorityLevel);
      const duration = missionData.baseDuration * (input.priorityLevel === 'high' ? 0.8 : input.priorityLevel === 'low' ? 1.2 : 1.0);

      const mission = await ctx.db.embassyMission.create({
        data: {
          embassyId: input.embassyId,
          name: missionData.name,
          type: input.missionType,
          description: missionData.description,
          difficulty: missionData.difficulty,
          requiredStaff: input.staffAssigned,
          cost: missionData.cost,
          duration: Math.round(duration),
          completesAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
          experienceReward: missionData.experienceReward,
          influenceReward: missionData.influenceReward,
          reputationReward: missionData.reputationReward,
          economicReward: missionData.economicReward,
          successChance: calculateSuccessChance(embassy, missionData.difficulty, input.staffAssigned),
          ixTimeStarted: IxTime.getCurrentIxTime(),
          ixTimeCompletes: IxTime.getCurrentIxTime() + (duration * 24)
        }
      });

      // Update embassy mission count and budget
      await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          currentMissions: { increment: 1 },
          budget: { decrement: missionData.cost }
        }
      });

      // 🔔 Notify country about mission start
      try {
        await notificationAPI.create({
          title: '🎯 Diplomatic Mission Started',
          message: `${missionData.name} has been initiated at ${embassy.name} (${Math.round(duration)} days)`,
          countryId: embassy.guestCountryId,
          category: 'diplomatic',
          priority: 'low',
          type: 'info',
          href: '/diplomatic',
          source: 'diplomatic-system',
          actionable: false,
          metadata: { missionId: mission.id, embassyId: input.embassyId, missionType: input.missionType },
        });
      } catch (error) {
        console.error('[Diplomatic] Failed to send mission start notification:', error);
      }

      return mission;
    }),

  completeMission: protectedProcedure
    .input(z.object({ missionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mission = await ctx.db.embassyMission.findUnique({
        where: { id: input.missionId },
        include: { embassy: true }
      });

      if (!mission) throw new TRPCError({ code: 'NOT_FOUND', message: 'Mission not found' });

      if (!ctx.user?.countryId || ctx.user.countryId !== mission.embassy.guestCountryId) {
        throw new Error('You can only complete missions for your own embassies.');
      }
      if (mission.completesAt > new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Mission not yet completed' });
      }

      // Deterministic success based on successChance (no random)
      // Success if successChance >= 50%, otherwise failure
      const success = mission.successChance >= 50;
      const finalStatus = success ? 'completed' : 'failed';
      const rewardMultiplier = success ? 1.0 : 0.3;

      // Update mission status
      await ctx.db.embassyMission.update({
        where: { id: input.missionId },
        data: {
          status: finalStatus,
          progress: 100
        }
      });

      // Apply rewards to embassy
      const experienceGained = Math.floor(mission.experienceReward * rewardMultiplier);
      const influenceGained = mission.influenceReward * rewardMultiplier;
      const reputationGained = mission.reputationReward * rewardMultiplier;
      const economicGained = mission.economicReward * rewardMultiplier;

      await ctx.db.embassy.update({
        where: { id: mission.embassyId },
        data: {
          experience: { increment: experienceGained },
          influence: { increment: Math.min(influenceGained, 100 - mission.embassy.influence) },
          reputation: { increment: Math.min(reputationGained, 100 - mission.embassy.reputation) },
          budget: { increment: economicGained },
          currentMissions: { decrement: 1 },
          effectiveness: { 
            increment: success ? 1 : -0.5 
          }
        }
      });

      // Create diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: mission.embassy.guestCountryId,
          country2Id: mission.embassy.hostCountryId,
          eventType: 'mission_completed',
          title: `Mission ${success ? 'Successful' : 'Failed'}`,
          description: `${mission.name} at ${mission.embassy.name} has been ${success ? 'completed successfully' : 'failed'}`,
          embassyId: mission.embassyId,
          missionId: mission.id,
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
          relationshipImpact: success ? 2 : -1,
          reputationImpact: reputationGained,
          economicImpact: economicGained,
          severity: success ? 'positive' : 'warning'
        }
      });

      // 🔔 Notify country about mission completion
      try {
        await notificationAPI.create({
          title: success ? '✅ Mission Successful!' : '❌ Mission Failed',
          message: `${mission.name} at ${mission.embassy.name} has ${success ? 'completed successfully' : 'failed'}. ${success ? `Rewards: +${experienceGained} XP, +${influenceGained.toFixed(0)} influence` : 'Better luck next time!'}`,
          countryId: mission.embassy.guestCountryId,
          category: 'diplomatic',
          priority: success ? 'medium' : 'low',
          type: success ? 'success' : 'warning',
          href: '/diplomatic',
          source: 'diplomatic-system',
          actionable: false,
          metadata: { missionId: mission.id, embassyId: mission.embassyId, success, rewards: { experience: experienceGained, influence: influenceGained } },
        });
      } catch (error) {
        console.error('[Diplomatic] Failed to send mission completion notification:', error);
      }

      return {
        success,
        mission,
        rewards: {
          experience: experienceGained,
          influence: influenceGained,
          reputation: reputationGained,
          economic: economicGained
        }
      };
    }),

  // Embassy Economics
  payMaintenance: protectedProcedure
    .input(z.object({ embassyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId }
      });

      if (!embassy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Embassy not found' });

      if (!ctx.user?.countryId || ctx.user.countryId !== embassy.guestCountryId) {
        throw new Error('You can only pay maintenance for your own embassies.');
      }
      if (embassy.budget < embassy.maintenanceCost) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient funds for maintenance' });
      }

      await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          budget: { decrement: embassy.maintenanceCost },
          lastMaintenancePaid: new Date(),
          effectiveness: { increment: 2 } // Reward for timely maintenance
        }
      });

      return { success: true, amountPaid: embassy.maintenanceCost };
    }),

  allocateBudget: protectedProcedure
    .input(z.object({
      embassyId: z.string(),
      additionalBudget: z.number().min(1000).max(1000000)
    }))
    .mutation(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId }
      });

      if (!embassy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Embassy not found' });

      if (!ctx.user?.countryId || ctx.user.countryId !== embassy.guestCountryId) {
        throw new Error('You can only allocate budget to your own embassies.');
      }

      const updatedEmbassy = await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          budget: { increment: input.additionalBudget }
        }
      });

      return updatedEmbassy;
    }),

  // Influence and Relationship Management Procedures
  getInfluenceBreakdown: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const embassies = await ctx.db.embassy.findMany({
        where: { hostCountryId: input.countryId },
        include: {
          missions: {
            where: { status: 'COMPLETED' }
          }
        }
      });

      const breakdown = embassies.map(embassy => {
        const totalInfluence = embassy.influence || 0;
        const effects = getInfluenceEffects(totalInfluence);
        const completedMissions = embassy.missions?.length || 0;
        
        return {
          embassyId: embassy.id,
          targetCountryId: (embassy as any).guestCountryId || embassy.id,
          targetCountryName: (embassy as any).targetCountry || 'Unknown',
          currentInfluence: totalInfluence,
          level: embassy.level || 1,
          completedMissions,
          effects,
          influenceRank: totalInfluence >= 1000 ? 'Elite' : 
                        totalInfluence >= 500 ? 'High' :
                        totalInfluence >= 200 ? 'Medium' :
                        totalInfluence >= 100 ? 'Basic' : 'Minimal'
        };
      });

      const totalInfluence = breakdown.reduce((sum, b) => sum + b.currentInfluence, 0);
      
      return {
        breakdown,
        totalInfluence,
        globalEffects: getInfluenceEffects(totalInfluence),
        averageInfluence: breakdown.length > 0 ? Math.floor(totalInfluence / breakdown.length) : 0
      };
    }),

  updateRelationshipStrength: protectedProcedure
    .input(z.object({
      relationshipId: z.string(),
      influenceChange: z.number(),
      reason: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const relationship = await ctx.db.diplomaticRelation.findUnique({
        where: { id: input.relationshipId }
      });

      if (!relationship) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Diplomatic relationship not found' });
      }

      // Verify user owns one of the countries in this relationship
      if (!ctx.user?.countryId || (relationship.country1 !== ctx.user.countryId && relationship.country2 !== ctx.user.countryId)) {
        throw new Error('You can only update relationships for your own country.');
      }

      const relationshipImpact = calculateRelationshipImpact(
        input.influenceChange, 
        relationship.relationship
      );

      const newStrength = Math.max(0, Math.min(100, 
        (relationship.strength || 50) + relationshipImpact
      ));

      // Determine if relationship type should change
      let newRelationshipType = relationship.relationship;
      if (newStrength >= 80 && relationship.relationship !== 'alliance') {
        newRelationshipType = 'alliance';
      } else if (newStrength >= 60 && newStrength < 80 && relationship.relationship === 'neutral') {
        newRelationshipType = 'trade';
      } else if (newStrength < 30 && relationship.relationship !== 'tension') {
        newRelationshipType = 'tension';
      } else if (newStrength >= 30 && newStrength < 60 && relationship.relationship === 'tension') {
        newRelationshipType = 'neutral';
      }

      const updated = await ctx.db.diplomaticRelation.update({
        where: { id: input.relationshipId },
        data: {
          strength: newStrength,
          relationship: newRelationshipType
          // lastActivity: new Date()
        }
      });

      // Create diplomatic event for significant changes
      if (newRelationshipType !== relationship.relationship) {
        await ctx.db.diplomaticEvent.create({
          data: {
            country1Id: relationship.country1,
            country2Id: relationship.country2,
            eventType: 'relationship_change',
            title: `Relationship Status Changed`,
            description: `Diplomatic relationship evolved from ${relationship.relationship} to ${newRelationshipType} due to ${input.reason}`,
            ixTimeTimestamp: IxTime.getCurrentIxTime(),
            relationshipImpact: relationshipImpact,
            severity: relationshipImpact > 0 ? 'positive' : 'negative'
          }
        });

        // 🔔 Notify both countries about relationship change
        try {
          const priority = relationshipImpact < 0 ? 'high' : 'medium';
          const type = relationshipImpact > 0 ? 'success' : 'warning';
          
          // Notify both countries
          await Promise.all([
            notificationAPI.create({
              title: '🤝 Diplomatic Relationship Changed',
              message: `Relationship evolved to ${newRelationshipType} (${input.reason})`,
              countryId: relationship.country1,
              category: 'diplomatic',
              priority,
              type,
              href: '/diplomatic',
              source: 'diplomatic-system',
              actionable: true,
            }),
            notificationAPI.create({
              title: '🤝 Diplomatic Relationship Changed',
              message: `Relationship evolved to ${newRelationshipType} (${input.reason})`,
              countryId: relationship.country2,
              category: 'diplomatic',
              priority,
              type,
              href: '/diplomatic',
              source: 'diplomatic-system',
              actionable: true,
            })
          ]);
        } catch (error) {
          console.error('[Diplomatic] Failed to send relationship change notifications:', error);
        }
      }

      return {
        previousStrength: relationship.strength,
        newStrength,
        strengthChange: relationshipImpact,
        previousType: relationship.relationship,
        newType: newRelationshipType,
        typeChanged: newRelationshipType !== relationship.relationship
      };
    }),

  getInfluenceLeaderboard: rateLimitedPublicProcedure
    .query(async ({ ctx }) => {
      const countries = await ctx.db.country.findMany({
        include: {
          embassies: {
            select: {
              influence: true,
              level: true,
              status: true
            }
          }
        }
      });

      const leaderboard = countries.map(country => {
        const activeEmbassies = country.embassies.filter(e => e.status === 'ACTIVE');
        const totalInfluence = activeEmbassies.reduce((sum, e) => sum + (e.influence || 0), 0);
        const averageLevel = activeEmbassies.length > 0 ?
          activeEmbassies.reduce((sum, e) => sum + (e.level || 1), 0) / activeEmbassies.length : 0;

        return {
          countryId: country.id,
          countryName: country.name,
          totalInfluence,
          averageLevel: Math.round(averageLevel * 10) / 10,
          activeEmbassies: activeEmbassies.length,
          globalEffects: getInfluenceEffects(totalInfluence)
        };
      })
      .sort((a, b) => b.totalInfluence - a.totalInfluence)
      .slice(0, 20); // Top 20

      return leaderboard;
    }),

  // Follow/Unfollow system for countries
  getFollowStatus: publicProcedure
    .input(z.object({
      viewerCountryId: z.string(),
      targetCountryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const follow = await ctx.db.countryFollow.findUnique({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.viewerCountryId,
            followedCountryId: input.targetCountryId
          }
        }
      });

      return {
        isFollowing: !!follow,
        followedAt: follow?.createdAt || null
      };
    }),

  followCountry: protectedProcedure
    .input(z.object({
      followerCountryId: z.string(),
      followedCountryId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      if (!ctx.user?.countryId || ctx.user.countryId !== input.followerCountryId) {
        throw new Error('You can only follow countries with your own country.');
      }

      // Create follow relationship
      const follow = await ctx.db.countryFollow.create({
        data: {
          followerCountryId: input.followerCountryId,
          followedCountryId: input.followedCountryId
        }
      });

      // 🔔 Notify followed country about new follower
      try {
        const followerCountry = await ctx.db.country.findUnique({
          where: { id: input.followerCountryId },
          select: { name: true }
        });

        await notificationAPI.create({
          title: '👁️ New Country Following',
          message: `${followerCountry?.name || 'A country'} is now following your country`,
          countryId: input.followedCountryId,
          category: 'social',
          priority: 'low',
          type: 'info',
          href: '/diplomatic',
          source: 'diplomatic-system',
          actionable: false,
          metadata: { followerCountryId: input.followerCountryId },
        });
      } catch (error) {
        console.error('[Diplomatic] Failed to send follow notification:', error);
      }

      return { success: true, follow };
    }),

  unfollowCountry: protectedProcedure
    .input(z.object({
      followerCountryId: z.string(),
      followedCountryId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      if (!ctx.user?.countryId || ctx.user.countryId !== input.followerCountryId) {
        throw new Error('You can only unfollow countries with your own country.');
      }

      // Delete follow relationship
      await ctx.db.countryFollow.delete({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.followerCountryId,
            followedCountryId: input.followedCountryId
          }
        }
      });

      return { success: true };
    })
});

// Helper functions for embassy game mechanics
function getUpgradeEffects(upgradeType: string, level: number) {
  const effects: Record<string, any> = {};
  
  switch (upgradeType) {
    case 'staff_expansion':
      effects.maxStaff = level * 2;
      effects.maxMissions = Math.ceil(level / 2);
      break;
    case 'security_enhancement':
      effects.securityLevel = level;
      effects.missionSuccessBonus = level * 5;
      break;
    case 'tech_upgrade':
      effects.efficiencyBonus = level * 10;
      effects.informationGatheringBonus = level * 15;
      break;
    case 'facility_expansion':
      effects.capacityBonus = level * 20;
      effects.reputationBonus = level * 5;
      break;
    case 'specialization_improvement':
      effects.specializationBonus = level * 25;
      effects.specializedMissionBonus = level * 20;
      break;
  }
  
  return effects;
}

function generateAvailableMissions(embassy: any) {
  const missions = [
    {
      id: 'trade_negotiation_1',
      type: 'trade_negotiation',
      name: 'Local Trade Agreement',
      description: 'Negotiate trade partnerships with local businesses',
      difficulty: 'easy',
      duration: 5,
      cost: 2000,
      rewards: { experience: 100, influence: 5, economic: 15000 },
      requirements: { level: 1, staff: 1 }
    },
    {
      id: 'cultural_outreach_1',
      type: 'cultural_outreach',
      name: 'Cultural Festival Participation',
      description: 'Organize embassy participation in local cultural events',
      difficulty: 'easy',
      duration: 3,
      cost: 1500,
      rewards: { experience: 75, reputation: 8, influence: 3 },
      requirements: { level: 1, staff: 2 }
    },
    {
      id: 'intelligence_gathering_1',
      type: 'intelligence_gathering',
      name: 'Economic Intelligence Report',
      description: 'Gather intelligence on local economic conditions',
      difficulty: 'medium',
      duration: 7,
      cost: 3000,
      rewards: { experience: 150, influence: 8, economic: 5000 },
      requirements: { level: 2, staff: 2, specialization: 'intelligence' }
    }
  ];

  return missions.filter(mission => 
    embassy.level >= mission.requirements.level &&
    embassy.staffCount >= mission.requirements.staff &&
    (!mission.requirements.specialization || embassy.specialization === mission.requirements.specialization)
  );
}

function getMissionData(type: string, embassyLevel: number, priority: string) {
  const baseData = {
    trade_negotiation: {
      name: 'Trade Negotiation Mission',
      description: 'Negotiate beneficial trade agreements',
      difficulty: 'medium',
      baseDuration: 7,
      cost: 2500,
      experienceReward: 120,
      influenceReward: 6,
      reputationReward: 4,
      economicReward: 18000
    },
    intelligence_gathering: {
      name: 'Intelligence Gathering Operation',
      description: 'Collect strategic intelligence information',
      difficulty: 'hard',
      baseDuration: 10,
      cost: 4000,
      experienceReward: 200,
      influenceReward: 10,
      reputationReward: 2,
      economicReward: 8000
    },
    cultural_outreach: {
      name: 'Cultural Outreach Program',
      description: 'Strengthen cultural ties with local community',
      difficulty: 'easy',
      baseDuration: 5,
      cost: 1800,
      experienceReward: 80,
      influenceReward: 4,
      reputationReward: 12,
      economicReward: 3000
    },
    security_cooperation: {
      name: 'Security Cooperation Initiative',
      description: 'Collaborate on security matters',
      difficulty: 'hard',
      baseDuration: 12,
      cost: 5000,
      experienceReward: 250,
      influenceReward: 15,
      reputationReward: 8,
      economicReward: 12000
    },
    research_collaboration: {
      name: 'Research Collaboration Project',
      description: 'Joint research initiative with local institutions',
      difficulty: 'expert',
      baseDuration: 14,
      cost: 6000,
      experienceReward: 300,
      influenceReward: 12,
      reputationReward: 15,
      economicReward: 25000
    }
  };

  const data = baseData[type as keyof typeof baseData];
  const levelMultiplier = 1 + (embassyLevel - 1) * 0.2;

  return {
    ...data,
    cost: Math.round(data.cost * levelMultiplier),
    experienceReward: Math.round(data.experienceReward * levelMultiplier),
    economicReward: Math.round(data.economicReward * levelMultiplier)
  };
}

function calculateSuccessChance(embassy: any, difficulty: string, staffAssigned: number) {
  let baseChance = 60;
  
  // Difficulty modifier
  const difficultyModifiers = { easy: 20, medium: 0, hard: -15, expert: -25 };
  baseChance += difficultyModifiers[difficulty as keyof typeof difficultyModifiers];
  
  // Embassy level bonus
  baseChance += (embassy.level - 1) * 8;
  
  // Staff bonus
  baseChance += (staffAssigned - 1) * 5;
  
  // Effectiveness bonus
  baseChance += (embassy.effectiveness - 50) * 0.3;
  
  // Specialization bonus (if applicable)
  if (embassy.specialization && embassy.specializationLevel > 0) {
    baseChance += embassy.specializationLevel * 10;
  }

  return Math.min(Math.max(baseChance, 10), 95); // Cap between 10-95%
};

// Influence and Relationship Mechanics
function calculateInfluenceGain(missionType: string, success: boolean, embassyLevel: number): number {
  const baseInfluence = {
    'TRADE_NEGOTIATION': 50,
    'CULTURAL_EXCHANGE': 30,
    'INTELLIGENCE_GATHERING': 20,
    'CRISIS_MANAGEMENT': 80,
    'ECONOMIC_COOPERATION': 60
  }[missionType] || 25;

  let multiplier = success ? 1.0 : 0.3; // Reduced gain on failure
  multiplier *= (1 + (embassyLevel - 1) * 0.2); // 20% bonus per level above 1

  return Math.floor(baseInfluence * multiplier);
}

function calculateRelationshipImpact(influenceChange: number, currentRelationship: string): number {
  // Relationship impact based on influence gain
  let baseImpact = Math.floor(influenceChange / 10);
  
  // Diminishing returns for already strong relationships
  const relationshipMultiplier = {
    'alliance': 0.5,
    'trade': 0.7,
    'neutral': 1.0,
    'tension': 1.5 // Easier to improve from tension
  }[currentRelationship] || 1.0;

  return Math.floor(baseImpact * relationshipMultiplier);
}

function getInfluenceEffects(totalInfluence: number): Record<string, number> {
  const effects: Record<string, number> = {};
  
  // Trade bonuses
  if (totalInfluence >= 100) effects.tradeBonus = Math.floor(totalInfluence / 100) * 5;
  
  // Mission success bonuses
  if (totalInfluence >= 200) effects.missionSuccessBonus = Math.floor(totalInfluence / 200) * 3;
  
  // Diplomatic immunity level
  if (totalInfluence >= 300) effects.diplomaticImmunity = Math.floor(totalInfluence / 300);
  
  // Intelligence gathering bonus
  if (totalInfluence >= 500) effects.intelligenceBonus = Math.floor(totalInfluence / 500) * 10;
  
  // Crisis response bonus
  if (totalInfluence >= 750) effects.crisisResponseBonus = Math.floor(totalInfluence / 750) * 15;
  
  return effects;
}
