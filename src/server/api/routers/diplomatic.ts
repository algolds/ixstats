import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";
import { notificationHooks } from "~/lib/notification-hooks";
import { DiplomaticChoiceTracker } from "~/lib/diplomatic-choice-tracker";
import {
  calculateCulturalCompatibility,
  type CountryBasicInfo,
  type DiplomaticRelationship,
  type EmbassyConnection,
} from "~/lib/cultural-compatibility";
import {
  NPCCulturalParticipation,
  type NPCParticipationContext,
} from "~/lib/npc-cultural-participation";
import { NPCPersonalitySystem, type ObservableData } from "~/lib/diplomatic-npc-personality";
import {
  STRATEGIC_PRIORITIES,
  PARTNERSHIP_GOALS,
  KEY_ACHIEVEMENTS,
} from "~/lib/diplomatic-profile-options";
import { vaultService } from "~/lib/vault-service";

// Helper functions for cultural exchange <-> embassy mission integration

/**
 * Calculate cultural exchange bonus from completed embassy missions
 * Returns percentage boost based on number of completed missions
 * @param completedMissionCount - Number of completed cultural_outreach missions
 * @returns Object with cultural impact and diplomatic value bonus percentages
 */
function calculateMissionCulturalBonus(completedMissionCount: number) {
  // 20% cultural impact bonus per mission (max 60%)
  const culturalImpactBonus = Math.min(completedMissionCount * 20, 60);

  // 15% diplomatic value bonus per mission (max 45%)
  const diplomaticValueBonus = Math.min(completedMissionCount * 15, 45);

  return {
    culturalImpactBonus,
    diplomaticValueBonus,
    reasoning:
      completedMissionCount > 0
        ? `Embassy mission support provides +${culturalImpactBonus}% cultural impact and +${diplomaticValueBonus}% diplomatic value`
        : "No embassy mission support",
  };
}

/**
 * Apply cultural exchange boost when completing a cultural_outreach mission
 * Increases cultural impact and diplomatic value of linked exchange
 * @param culturalImpact - Base cultural impact boost amount (default: 15)
 * @param diplomaticValue - Base diplomatic value boost amount (default: 10)
 */
function getCulturalExchangeBoostValues(culturalImpact = 15, diplomaticValue = 10) {
  return {
    culturalImpactBoost: culturalImpact,
    diplomaticValueBoost: diplomaticValue,
    reasoning: `Completed embassy mission boosts exchange by +${culturalImpact} cultural impact and +${diplomaticValue} diplomatic value`,
  };
}

export const diplomaticRouter = createTRPCRouter({
  // Get diplomatic relationships for a country
  getRelationships: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get live diplomatic relations from database
        const relations = await ctx.db.diplomaticRelation.findMany({
          where: {
            OR: [{ country1: input.countryId }, { country2: input.countryId }],
          },
          orderBy: [{ strength: "desc" }, { lastContact: "desc" }],
        });

        // Transform relations to match expected format
        const transformedRelations = relations.map((relation) => ({
          id: relation.id,
          targetCountry:
            relation.country1 === input.countryId ? relation.country2 : relation.country1,
          targetCountryId:
            relation.country1 === input.countryId ? relation.country2 : relation.country1,
          relationship: relation.relationship,
          strength: relation.strength,
          treaties: relation.treaties ? JSON.parse(relation.treaties) : [],
          lastContact: relation.lastContact.toISOString(),
          status: relation.status,
          diplomaticChannels: relation.diplomaticChannels
            ? JSON.parse(relation.diplomaticChannels)
            : [],
          tradeVolume: relation.tradeVolume || 0,
          culturalExchange: relation.culturalExchange || "Medium",
          recentActivity: relation.recentActivity,
          economicTier: relation.economicTier,
          flagUrl: relation.flagUrl,
          establishedAt: relation.establishedAt.toISOString(),
        }));

        return transformedRelations;
      } catch (error) {
        console.error("Error fetching diplomatic relations:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch diplomatic relations",
          cause: error,
        });
      }
    }),

  // Get recent diplomatic changes
  getRecentChanges: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        hours: z.number().optional().default(24),
      })
    )
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
            OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
            createdAt: { gte: cutoffDate },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        // Fetch country names for all events
        const countryIds = new Set<string>();
        diplomaticEvents.forEach((event) => {
          countryIds.add(event.country1Id);
          if (event.country2Id) countryIds.add(event.country2Id);
        });

        const countries = await ctx.db.country.findMany({
          where: { id: { in: Array.from(countryIds) } },
          select: { id: true, name: true },
        });

        const countryMap = new Map(countries.map((c) => [c.id, c.name]));

        for (const event of diplomaticEvents) {
          // Determine target country based on which country is the input
          const targetCountryId =
            event.country1Id === input.countryId
              ? event.country2Id
              : event.country1Id;

          changes.push({
            id: event.id,
            targetCountry: (targetCountryId && countryMap.get(targetCountryId)) || "Unknown",
            currentStatus: event.eventType,
            updatedAt: event.createdAt.toISOString(),
            changeType: event.eventType,
            description: event.description,
          });
        }

        // 2. Recent embassy status changes
        const recentEmbassies = await ctx.db.embassy.findMany({
          where: {
            OR: [{ hostCountryId: input.countryId }, { guestCountryId: input.countryId }],
            updatedAt: { gte: cutoffDate },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: {
            hostCountry: { select: { name: true } },
            guestCountry: { select: { name: true } },
          },
        });

        for (const embassy of recentEmbassies) {
          const isHost = embassy.hostCountryId === input.countryId;
          const partnerCountry = isHost ? embassy.guestCountry : embassy.hostCountry;

          changes.push({
            id: embassy.id,
            targetCountry: partnerCountry?.name || "Unknown",
            currentStatus: embassy.status,
            updatedAt: embassy.updatedAt.toISOString(),
            changeType: "embassy_update",
            description: `Embassy ${embassy.status === "ACTIVE" ? "operational" : embassy.status}`,
          });
        }

        // 3. Recent missions completed/failed
        const recentMissions = await ctx.db.embassyMission.findMany({
          where: {
            embassy: {
              OR: [{ hostCountryId: input.countryId }, { guestCountryId: input.countryId }],
            },
            status: { in: ["completed", "failed"] },
            updatedAt: { gte: cutoffDate },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: {
            embassy: {
              include: {
                hostCountry: { select: { name: true } },
                guestCountry: { select: { name: true } },
              },
            },
          },
        });

        for (const mission of recentMissions) {
          const isGuest = mission.embassy.guestCountryId === input.countryId;
          const partnerCountry = isGuest
            ? mission.embassy.hostCountry
            : mission.embassy.guestCountry;

          changes.push({
            id: mission.id,
            targetCountry: partnerCountry?.name || "Unknown",
            currentStatus: mission.status,
            updatedAt: mission.updatedAt.toISOString(),
            changeType: "mission_" + mission.status,
            description: `${mission.name} ${mission.status}`,
          });
        }

        // 4. Recent cultural exchanges
        const recentExchanges = await ctx.db.culturalExchange.findMany({
          where: {
            OR: [
              { hostCountryId: input.countryId },
              {
                participatingCountries: {
                  some: { countryId: input.countryId },
                },
              },
            ],
            updatedAt: { gte: cutoffDate },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });

        for (const exchange of recentExchanges) {
          changes.push({
            id: exchange.id,
            targetCountry: exchange.hostCountryName,
            currentStatus: exchange.status,
            updatedAt: exchange.updatedAt.toISOString(),
            changeType: "cultural_exchange",
            description: `${exchange.title} - ${exchange.type}`,
          });
        }

        // 5. Recent treaties signed
        const recentTreaties = await ctx.db.treaty.findMany({
          where: {
            parties: { contains: input.countryId },
            updatedAt: { gte: cutoffDate },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });

        for (const treaty of recentTreaties) {
          changes.push({
            id: treaty.id,
            targetCountry: treaty.name,
            currentStatus: treaty.status,
            updatedAt: treaty.updatedAt.toISOString(),
            changeType: "treaty_" + treaty.status.toLowerCase(),
            description: treaty.description || treaty.name,
          });
        }

        // Sort all changes by date descending and limit to 20 most recent
        const sortedChanges = changes
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 20);

        return sortedChanges;
      } catch (error) {
        console.error("Error fetching recent diplomatic changes:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recent diplomatic changes",
          cause: error,
        });
      }
    }),

  // Update diplomatic relationship
  updateRelationship: protectedProcedure
    .input(
      z.object({
        relationId: z.string(),
        relationship: z.string().optional(),
        strength: z.number().optional(),
        status: z.string().optional(),
        treaties: z.array(z.string()).optional(),
        diplomaticChannels: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new Error(
          "You must be associated with a country to update diplomatic relationships."
        );
      }

      // Verify user owns one of the countries in this relation
      const relation = await ctx.db.diplomaticRelation.findUnique({
        where: { id: input.relationId },
      });

      if (
        !relation ||
        (relation.country1 !== ctx.user.countryId && relation.country2 !== ctx.user.countryId)
      ) {
        throw new Error("You do not have permission to update this relationship.");
      }

      const updateData: any = {};

      if (input.relationship) updateData.relationship = input.relationship;
      if (input.strength !== undefined) updateData.strength = input.strength;
      if (input.status) updateData.status = input.status;
      if (input.treaties) updateData.treaties = JSON.stringify(input.treaties);
      if (input.diplomaticChannels)
        updateData.diplomaticChannels = JSON.stringify(input.diplomaticChannels);

      return await ctx.db.diplomaticRelation.update({
        where: { id: input.relationId },
        data: updateData,
      });
    }),

  // Create a new diplomatic relationship
  createRelationship: protectedProcedure
    .input(
      z.object({
        country1: z.string(),
        country2: z.string(),
        relationship: z.string().default("neutral"),
        strength: z.number().min(0).max(100).default(50),
        status: z.string().default("active"),
        treaties: z.array(z.string()).optional(),
        diplomaticChannels: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to create diplomatic relationships.",
        });
      }

      // Verify user owns one of the countries
      if (input.country1 !== ctx.user.countryId && input.country2 !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create relationships for your own country.",
        });
      }

      // Check if relationship already exists
      const existing = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: input.country1, country2: input.country2 },
            { country1: input.country2, country2: input.country1 },
          ],
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A diplomatic relationship already exists between these countries.",
        });
      }

      const relation = await ctx.db.diplomaticRelation.create({
        data: {
          country1: input.country1,
          country2: input.country2,
          relationship: input.relationship,
          strength: input.strength,
          status: input.status,
          treaties: input.treaties ? JSON.stringify(input.treaties) : null,
          diplomaticChannels: input.diplomaticChannels
            ? JSON.stringify(input.diplomaticChannels)
            : null,
          lastContact: new Date(),
        },
      });

      return relation;
    }),

  // Delete/terminate a diplomatic relationship
  deleteRelationship: protectedProcedure
    .input(
      z.object({
        relationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to delete diplomatic relationships.",
        });
      }

      // Verify user owns one of the countries in this relation
      const relation = await ctx.db.diplomaticRelation.findUnique({
        where: { id: input.relationId },
      });

      if (!relation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Diplomatic relationship not found.",
        });
      }

      if (relation.country1 !== ctx.user.countryId && relation.country2 !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to delete this relationship.",
        });
      }

      await ctx.db.diplomaticRelation.delete({
        where: { id: input.relationId },
      });

      return { success: true, id: input.relationId };
    }),

  // Embassy Network Operations
  getEmbassies: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const embassies = await ctx.db.embassy.findMany({
        where: {
          OR: [{ hostCountryId: input.countryId }, { guestCountryId: input.countryId }],
        },
        orderBy: { establishedAt: "desc" },
        include: {
          hostCountry: { select: { id: true, name: true, flag: true, slug: true } },
          guestCountry: { select: { id: true, name: true, flag: true, slug: true } },
        },
      });

      return embassies.map((embassy) => {
        const isHost = embassy.hostCountryId === input.countryId;
        const partnerCountry = isHost ? embassy.guestCountry : embassy.hostCountry;

        return {
          id: embassy.id,
          name: embassy.name, // Embassy name/title
          hostCountryId: embassy.hostCountryId,
          guestCountryId: embassy.guestCountryId,
          hostCountry: embassy.hostCountry?.name ?? "Unknown",
          hostCountryFlag: embassy.hostCountry?.flag ?? null,
          hostCountrySlug: embassy.hostCountry?.slug ?? null,
          guestCountry: embassy.guestCountry?.name ?? "Unknown",
          guestCountryFlag: embassy.guestCountry?.flag ?? null,
          guestCountrySlug: embassy.guestCountry?.slug ?? null,
          countryId: partnerCountry?.id ?? null,
          country: partnerCountry?.name ?? "Unknown",
          countryFlag: partnerCountry?.flag ?? null,
          countrySlug: partnerCountry?.slug ?? null,
          status: embassy.status,
          strength: Math.floor(
            (embassy.staffCount || 5) * 8 +
              (embassy.services ? JSON.parse(embassy.services).length * 10 : 30)
          ),
          role: isHost ? ("host" as const) : ("guest" as const),
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
    .input(
      z.object({
        hostCountryId: z.string(),
        guestCountryId: z.string(),
        name: z.string(),
        location: z.string().optional(),
        ambassadorName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new Error("You must be associated with a country to establish embassies.");
      }

      // Verify user owns the guest country (the one establishing the embassy)
      if (ctx.user.countryId !== input.guestCountryId) {
        throw new Error("You can only establish embassies for your own country.");
      }

      const embassy = await ctx.db.embassy.create({
        data: {
          hostCountryId: input.hostCountryId,
          guestCountryId: input.guestCountryId,
          name: input.name,
          location: input.location,
          ambassadorName: input.ambassadorName,
          status: "active",
        },
      });

      let hostCountryName: string | null = null;
      let guestCountryName: string | null = null;

      // 🔔 Notify both countries about embassy establishment
      try {
        // Get country names for better messaging
        const [hostCountry, guestCountry] = await Promise.all([
          ctx.db.country.findUnique({ where: { id: input.hostCountryId }, select: { name: true } }),
          ctx.db.country.findUnique({
            where: { id: input.guestCountryId },
            select: { name: true },
          }),
        ]);

        hostCountryName = hostCountry?.name ?? null;
        guestCountryName = guestCountry?.name ?? null;

        // Notify host country
        await notificationAPI.create({
          title: "🏛️ New Embassy Established",
          message: `${guestCountryName || "A country"} has established ${input.name} in your nation`,
          countryId: input.hostCountryId,
          category: "diplomatic",
          priority: "medium",
          href: "/diplomatic",
          source: "diplomatic-system",
          actionable: true,
          metadata: { embassyId: embassy.id, guestCountryId: input.guestCountryId },
        });

        // Notify guest country (confirmation)
        await notificationAPI.create({
          title: "🏛️ Embassy Establishment Confirmed",
          message: `${input.name} has been successfully established in ${hostCountryName || "the host nation"}`,
          countryId: input.guestCountryId,
          category: "diplomatic",
          priority: "low",
          type: "success",
          href: "/diplomatic",
          source: "diplomatic-system",
          actionable: false,
          metadata: { embassyId: embassy.id, hostCountryId: input.hostCountryId },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send embassy notifications:", error);
        // Don't fail the embassy creation if notifications fail
      }

      // 💰 Award IxCredits for embassy establishment
      let creditsEarned = 0;
      if (ctx.auth?.userId) {
        try {
          const creditReward = 15; // 15 IxC for establishing an embassy

          const earnResult = await vaultService.earnCredits(
            ctx.auth.userId,
            creditReward,
            "EARN_ACTIVE",
            "embassy_established",
            ctx.db,
            {
              embassyId: embassy.id,
              embassyName: input.name,
              hostCountryId: input.hostCountryId,
              guestCountryId: input.guestCountryId,
              hostCountryName,
              guestCountryName,
            }
          );

          if (earnResult.success) {
            creditsEarned = creditReward;
            console.log(
              `[Diplomatic] Awarded ${creditReward} IxC to ${ctx.auth.userId} for embassy establishment`
            );
          }
        } catch (error) {
          console.error("[Diplomatic] Failed to award embassy establishment credits:", error);
        }
      }

      return {
        ...embassy,
        hostCountryName,
        guestCountryName,
        creditsEarned,
      };
    }),

  // Diplomatic Channels
  /**
   * @deprecated Use api.thinkpages.getConversations with conversationType="diplomatic" filter instead
   * This endpoint will be removed in v2.0.0 (January 2026)
   * Migration guide: /docs/guides/DIPLOMATIC_MESSAGING_MIGRATION.md
   */
  getChannels: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        clearanceLevel: z
          .enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL"])
          .optional()
          .default("PUBLIC"),
      })
    )
    .query(async ({ ctx, input }) => {
      console.warn(
        "⚠️  DEPRECATED: api.diplomatic.getChannels is deprecated. Use api.thinkpages.getConversations instead."
      );
      try {
        const channels = await ctx.db.diplomaticChannel.findMany({
          where: {
            participants: {
              some: {
                countryId: input.countryId,
              },
            },
            // Filter by clearance level
            classification:
              input.clearanceLevel === "CONFIDENTIAL"
                ? undefined
                : input.clearanceLevel === "RESTRICTED"
                  ? { in: ["PUBLIC", "RESTRICTED"] }
                  : "PUBLIC",
          },
          include: {
            participants: true,
            _count: {
              select: {
                messages: {
                  where: {
                    status: { notIn: ["READ"] },
                    fromCountryId: { not: input.countryId },
                  },
                },
              },
            },
          },
          orderBy: { lastActivity: "desc" },
        });

        return channels.map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          classification: channel.classification,
          encrypted: channel.encrypted,
          lastActivity: channel.lastActivity.toISOString(),
          unreadCount: channel._count.messages,
          participants: channel.participants.map((p) => ({
            countryId: p.countryId,
            countryName: p.countryName,
            flagUrl: p.flagUrl,
            role: p.role,
          })),
        }));
      } catch (error) {
        return [];
      }
    }),

  /**
   * @deprecated Use api.thinkpages.getConversationMessages instead
   * This endpoint will be removed in v2.0.0 (January 2026)
   * Migration guide: /docs/guides/DIPLOMATIC_MESSAGING_MIGRATION.md
   */
  getChannelMessages: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        countryId: z.string(),
        clearanceLevel: z
          .enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL"])
          .optional()
          .default("PUBLIC"),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      console.warn(
        "⚠️  DEPRECATED: api.diplomatic.getChannelMessages is deprecated. Use api.thinkpages.getConversationMessages instead."
      );
      try {
        const messages = await ctx.db.diplomaticMessage.findMany({
          where: {
            channelId: input.channelId,
            classification:
              input.clearanceLevel === "CONFIDENTIAL"
                ? undefined
                : input.clearanceLevel === "RESTRICTED"
                  ? { in: ["PUBLIC", "RESTRICTED"] }
                  : "PUBLIC",
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });

        return messages.map((msg) => ({
          id: msg.id,
          from: {
            countryId: msg.fromCountryId,
            countryName: msg.fromCountryName,
          },
          to: msg.toCountryId
            ? {
                countryId: msg.toCountryId,
                countryName: msg.toCountryName,
              }
            : null,
          subject: msg.subject,
          content: msg.content,
          classification: msg.classification,
          priority: msg.priority,
          status: msg.status,
          encrypted: msg.encrypted,
          ixTimeTimestamp: msg.ixTimeTimestamp,
          timestamp: msg.createdAt.toISOString(),
        }));
      } catch (error) {
        return [];
      }
    }),

  /**
   * @deprecated Use api.thinkpages.sendMessage with diplomatic metadata instead
   * This endpoint will be removed in v2.0.0 (January 2026)
   * Migration guide: /docs/guides/DIPLOMATIC_MESSAGING_MIGRATION.md
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        fromCountryId: z.string(),
        fromCountryName: z.string(),
        toCountryId: z.string().optional(),
        toCountryName: z.string().optional(),
        subject: z.string().optional(),
        content: z.string(),
        classification: z.enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL"]).default("PUBLIC"),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
        encrypted: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.warn(
        "⚠️  DEPRECATED: api.diplomatic.sendMessage is deprecated. Use api.thinkpages.sendMessage instead."
      );

      if (!ctx.user?.countryId) {
        throw new Error("You must be associated with a country to send diplomatic messages.");
      }

      // Verify user owns the country sending the message
      if (ctx.user.countryId !== input.fromCountryId) {
        throw new Error("You can only send messages from your own country.");
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
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
        },
      });

      // Update channel last activity
      await ctx.db.diplomaticChannel.update({
        where: { id: input.channelId },
        data: { lastActivity: new Date() },
      });

      return message;
    }),

  // Cultural Exchanges
  getCulturalExchanges: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        status: z.enum(["planning", "active", "completed", "cancelled"]).optional(),
        type: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const exchanges = await ctx.db.culturalExchange.findMany({
          where: {
            OR: [
              { hostCountryId: input.countryId },
              {
                participatingCountries: {
                  some: {
                    countryId: input.countryId,
                  },
                },
              },
            ],
            ...(input.status && { status: input.status }),
            ...(input.type && { type: input.type }),
          },
          include: {
            participatingCountries: true,
            culturalArtifacts: true,
            embassyMissions: {
              where: {
                type: "cultural_outreach",
              },
              include: {
                embassy: true,
              },
            },
          },
          orderBy: [
            { status: "asc" }, // Active first
            { startDate: "desc" },
          ],
        });

        return exchanges.map((exchange) => {
          // Calculate mission-based bonuses
          const completedMissions = exchange.embassyMissions.filter(
            (m) => m.status === "completed"
          );
          const activeMissions = exchange.embassyMissions.filter((m) => m.status === "active");

          // 20% bonus to cultural impact per completed mission (max 60%)
          const missionBonus = Math.min(completedMissions.length * 20, 60);
          const baseCulturalImpact = exchange.culturalImpact;
          const boostedCulturalImpact =
            baseCulturalImpact + (baseCulturalImpact * missionBonus) / 100;

          // 15% bonus to diplomatic value per completed mission (max 45%)
          const diplomaticBonus = Math.min(completedMissions.length * 15, 45);
          const baseDiplomaticValue = exchange.diplomaticValue;
          const boostedDiplomaticValue =
            baseDiplomaticValue + (baseDiplomaticValue * diplomaticBonus) / 100;

          const bonusReasoning = [];
          if (completedMissions.length > 0) {
            bonusReasoning.push(
              `+${missionBonus}% cultural impact from ${completedMissions.length} completed embassy mission${completedMissions.length > 1 ? "s" : ""}`
            );
            bonusReasoning.push(
              `+${diplomaticBonus}% diplomatic value from embassy mission support`
            );
          }
          if (activeMissions.length > 0) {
            bonusReasoning.push(
              `${activeMissions.length} active embassy mission${activeMissions.length > 1 ? "s" : ""} providing coordination support`
            );
          }

          return {
            id: exchange.id,
            title: exchange.title,
            type: exchange.type,
            description: exchange.description,
            hostCountry: {
              id: exchange.hostCountryId,
              name: exchange.hostCountryName,
              flagUrl: exchange.hostCountryFlag,
            },
            participatingCountries: exchange.participatingCountries.map((p) => ({
              id: p.countryId,
              name: p.countryName,
              flagUrl: p.flagUrl,
              role: p.role,
            })),
            status: exchange.status,
            startDate: exchange.startDate.toISOString(),
            endDate: exchange.endDate.toISOString(),
            ixTimeContext: exchange.ixTimeContext,
            metrics: {
              participants: exchange.participants,
              culturalImpact: boostedCulturalImpact,
              diplomaticValue: boostedDiplomaticValue,
              socialEngagement: exchange.socialEngagement,
              baseCulturalImpact: baseCulturalImpact,
              baseDiplomaticValue: baseDiplomaticValue,
              missionBonus: missionBonus,
              diplomaticBonus: diplomaticBonus,
            },
            linkedMissions: {
              total: exchange.embassyMissions.length,
              completed: completedMissions.length,
              active: activeMissions.length,
            },
            bonusReasoning,
            achievements: exchange.achievements ? JSON.parse(exchange.achievements) : [],
            culturalArtifacts: exchange.culturalArtifacts.map((artifact) => ({
              id: artifact.id,
              type: artifact.type,
              title: artifact.title,
              thumbnailUrl: artifact.thumbnailUrl,
              contributor: artifact.contributor,
              countryId: artifact.countryId,
            })),
          };
        });
      } catch (error) {
        return [];
      }
    }),

  createCulturalExchange: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        type: z.enum([
          "festival",
          "exhibition",
          "education",
          "cuisine",
          "arts",
          "sports",
          "technology",
          "diplomacy",
          "music",
          "film",
          "environmental",
          "science",
          "trade",
          "humanitarian",
          "agriculture",
          "heritage",
          "youth",
        ]),
        description: z.string(),
        narrative: z.string().optional(),
        objectives: z.array(z.string()).optional(),
        isPublic: z.boolean().optional().default(true),
        maxParticipants: z.number().optional(),
        hostCountryId: z.string(),
        hostCountryName: z.string(),
        hostCountryFlag: z.string().optional(),
        participantCountryId: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        autoCreateMissions: z.boolean().optional().default(true),
        embassyMissionId: z.string().optional(), // Link to existing embassy mission
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId || ctx.user.countryId !== input.hostCountryId) {
        throw new Error("You can only create cultural exchanges for your own country.");
      }

      // Validate embassy mission if provided
      if (input.embassyMissionId) {
        const mission = await ctx.db.embassyMission.findUnique({
          where: { id: input.embassyMissionId },
          include: { embassy: true },
        });

        if (!mission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Embassy mission not found" });
        }

        if (mission.type !== "cultural_outreach") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only link to cultural_outreach missions",
          });
        }

        if (mission.embassy.guestCountryId !== input.hostCountryId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mission must belong to your country's embassy",
          });
        }

        if (mission.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Can only link to active missions" });
        }
      }

      // Create the cultural exchange
      const exchange = await ctx.db.culturalExchange.create({
        data: {
          title: input.title,
          type: input.type,
          description: input.description,
          narrative: input.narrative,
          objectives: input.objectives ? JSON.stringify(input.objectives) : null,
          isPublic: input.isPublic,
          maxParticipants: input.maxParticipants,
          hostCountryId: input.hostCountryId,
          hostCountryName: input.hostCountryName,
          hostCountryFlag: input.hostCountryFlag,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          ixTimeContext: IxTime.getCurrentIxTime(),
          status: "planning",
        },
      });

      // If a participant country was specified, create a participant record
      if (input.participantCountryId) {
        const participantCountry = await ctx.db.country.findUnique({
          where: { id: input.participantCountryId },
          select: { name: true, flag: true },
        });

        if (participantCountry) {
          await ctx.db.culturalExchangeParticipant.create({
            data: {
              exchangeId: exchange.id,
              countryId: input.participantCountryId,
              countryName: participantCountry.name,
              flagUrl: participantCountry.flag,
              role: "participant",
            },
          });

          // Update participant count
          await ctx.db.culturalExchange.update({
            where: { id: exchange.id },
            data: { participants: 1 },
          });
        }
      }

      // Track cultural exchange creation
      await DiplomaticChoiceTracker.recordChoice({
        countryId: input.hostCountryId,
        type: "create_cultural_exchange",
        targetCountry: "Multiple", // Cultural exchanges can involve multiple countries
        targetCountryId: "global",
        details: {
          exchangeId: exchange.id,
          exchangeType: input.type,
          title: input.title,
          startDate: input.startDate,
          endDate: input.endDate,
          description: input.description,
        },
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
      });

      // Auto-create cultural_outreach embassy missions if enabled
      if (input.autoCreateMissions) {
        try {
          // Find all embassies where this country is the guest (owns embassies in other countries)
          const embassies = await ctx.db.embassy.findMany({
            where: {
              guestCountryId: input.hostCountryId,
              status: "active",
            },
          });

          // Create a cultural_outreach mission for each active embassy
          const missionCreationPromises = embassies.map(async (embassy) => {
            const ixTimeNow = IxTime.getCurrentIxTime();
            const duration = Math.ceil(
              (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
                (1000 * 60 * 60 * 24)
            ); // Duration in days
            const completesAt = new Date(
              new Date(input.startDate).getTime() + duration * 24 * 60 * 60 * 1000
            );

            // Calculate mission rewards based on exchange potential
            const baseInfluence = 30; // Base for cultural exchanges
            const baseReputation = 20;
            const baseExperience = 100;

            return ctx.db.embassyMission.create({
              data: {
                embassyId: embassy.id,
                name: `Cultural Outreach: ${input.title}`,
                type: "cultural_outreach",
                description: `Promote ${input.title} (${input.type}) to strengthen cultural ties with ${embassy.hostCountryId}`,
                difficulty: "medium",
                status: "active",
                requiredStaff: 1,
                requiredLevel: 1,
                cost: 5000,
                duration: duration,
                startedAt: new Date(input.startDate),
                completesAt: completesAt,
                experienceReward: baseExperience,
                influenceReward: baseInfluence,
                reputationReward: baseReputation,
                economicReward: 0,
                progress: 0,
                successChance: 65, // Base success chance for cultural missions
                ixTimeStarted: ixTimeNow,
                ixTimeCompletes: ixTimeNow + duration * 2, // IxTime runs 2x faster
                culturalExchangeId: exchange.id,
              },
            });
          });

          await Promise.all(missionCreationPromises);
        } catch (error) {
          console.error(
            "[Diplomatic] Failed to auto-create embassy missions for cultural exchange:",
            error
          );
          // Don't fail the whole operation if mission creation fails
        }
      }

      // 💰 Award IxCredits for cultural exchange creation
      let creditsEarned = 0;
      if (ctx.auth?.userId) {
        try {
          const creditReward = 12; // 12 IxC for organizing cultural exchange

          const earnResult = await vaultService.earnCredits(
            ctx.auth.userId,
            creditReward,
            "EARN_ACTIVE",
            "cultural_exchange_created",
            ctx.db,
            {
              exchangeId: exchange.id,
              exchangeTitle: input.title,
              exchangeType: input.type,
              hostCountryId: input.hostCountryId,
              participantCountryId: input.participantCountryId,
            }
          );

          if (earnResult.success) {
            creditsEarned = creditReward;
            console.log(
              `[Diplomatic] Awarded ${creditReward} IxC to ${ctx.auth.userId} for cultural exchange creation`
            );
          }
        } catch (error) {
          console.error("[Diplomatic] Failed to award cultural exchange credits:", error);
        }
      }

      return { ...exchange, creditsEarned };
    }),

  joinCulturalExchange: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        countryId: z.string(),
        countryName: z.string(),
        flagUrl: z.string().optional(),
        role: z.enum(["co-host", "participant", "observer"]).default("participant"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId || ctx.user.countryId !== input.countryId) {
        throw new Error("You can only join cultural exchanges with your own country.");
      }

      // Get exchange details for tracking
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
        select: { title: true, type: true, hostCountryId: true, hostCountryName: true },
      });

      const participant = await ctx.db.culturalExchangeParticipant.create({
        data: {
          exchangeId: input.exchangeId,
          countryId: input.countryId,
          countryName: input.countryName,
          flagUrl: input.flagUrl,
          role: input.role,
        },
      });

      // Update participant count
      await ctx.db.culturalExchange.update({
        where: { id: input.exchangeId },
        data: {
          participants: {
            increment: 1,
          },
        },
      });

      // Track cultural exchange join
      if (exchange) {
        await DiplomaticChoiceTracker.recordChoice({
          countryId: input.countryId,
          type: "join_cultural_exchange",
          targetCountry: exchange.hostCountryName,
          targetCountryId: exchange.hostCountryId,
          details: {
            exchangeId: input.exchangeId,
            exchangeType: exchange.type,
            exchangeTitle: exchange.title,
            role: input.role,
          },
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
        });
      }

      return participant;
    }),

  // Link existing cultural exchange to an embassy mission
  linkExchangeToMission: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        missionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch exchange and mission with validation
      const [exchange, mission] = await Promise.all([
        ctx.db.culturalExchange.findUnique({
          where: { id: input.exchangeId },
          include: {
            embassyMissions: true,
          },
        }),
        ctx.db.embassyMission.findUnique({
          where: { id: input.missionId },
          include: {
            embassy: true,
            culturalExchange: true,
          },
        }),
      ]);

      // Validation checks
      if (!exchange) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cultural exchange not found" });
      }

      if (!mission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Embassy mission not found" });
      }

      // Auth check - user must own the exchange's host country
      if (!ctx.user?.countryId || ctx.user.countryId !== exchange.hostCountryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only link your own country's cultural exchanges",
        });
      }

      // Mission type must be cultural_outreach
      if (mission.type !== "cultural_outreach") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only link to cultural_outreach missions",
        });
      }

      // Mission must be active
      if (mission.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can only link to active missions" });
      }

      // Mission's embassy must belong to the exchange's host country
      if (mission.embassy.guestCountryId !== exchange.hostCountryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Mission must belong to an embassy owned by the cultural exchange host country",
        });
      }

      // Mission must not already be linked to another exchange
      if (mission.culturalExchange && mission.culturalExchange.id !== input.exchangeId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Mission is already linked to another cultural exchange",
        });
      }

      // Check if exchange dates align reasonably with mission dates
      const exchangeStart = new Date(exchange.startDate);
      const exchangeEnd = new Date(exchange.endDate);
      const missionStart = new Date(mission.startedAt);
      const missionEnd = new Date(mission.completesAt);

      // Mission should overlap with exchange period (allow some flexibility)
      const hasOverlap = missionStart <= exchangeEnd && missionEnd >= exchangeStart;

      if (!hasOverlap) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Mission timeline must overlap with cultural exchange period",
        });
      }

      // Link mission to exchange
      await ctx.db.embassyMission.update({
        where: { id: input.missionId },
        data: {
          culturalExchangeId: input.exchangeId,
        },
      });

      // Track the linking action
      await DiplomaticChoiceTracker.recordChoice({
        countryId: exchange.hostCountryId,
        type: "establish_embassy",
        targetCountry: mission.embassy.hostCountryId,
        targetCountryId: mission.embassy.hostCountryId,
        details: {
          exchangeId: input.exchangeId,
          exchangeTitle: exchange.title,
          missionId: input.missionId,
          missionName: mission.name,
          embassyId: mission.embassyId,
        },
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
      });

      return {
        success: true,
        exchange: {
          id: exchange.id,
          title: exchange.title,
          linkedMissionsCount: exchange.embassyMissions.length + 1,
        },
        mission: {
          id: mission.id,
          name: mission.name,
          embassy: mission.embassy.name,
        },
      };
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
            where: { status: { in: ["active", "completed"] } },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          upgrades: {
            where: { status: { in: ["available", "in_progress", "completed"] } },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!embassy) throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });

      return {
        ...embassy,
        missions: embassy.missions,
        upgrades: embassy.upgrades,
        nextLevelRequirement: embassy.level * 1000 + 500, // Experience needed for next level
        maintenanceDue:
          embassy.lastMaintenancePaid < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        canUpgrade: embassy.experience >= embassy.level * 1000 + 500,
        availableMissions: embassy.currentMissions < embassy.maxMissions,
        // Profile fields
        description: embassy.description ?? null,
        strategicPriorities: embassy.strategicPriorities ?? null,
        partnershipGoals: embassy.partnershipGoals ?? null,
        keyAchievements: embassy.keyAchievements ?? null,
      };
    }),

  calculateEstablishmentCost: publicProcedure
    .input(
      z.object({
        hostCountryId: z.string(),
        guestCountryId: z.string(),
        targetLocation: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get relationship strength to determine cost multiplier
      const relation = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: input.hostCountryId, country2: input.guestCountryId },
            { country1: input.guestCountryId, country2: input.hostCountryId },
          ],
        },
      });

      // Base cost
      let baseCost = 100000;

      // Relationship strength modifier
      const relationshipStrength = relation?.strength || 25;
      const relationshipMultiplier =
        relationshipStrength < 25
          ? 2.0
          : relationshipStrength < 50
            ? 1.5
            : relationshipStrength < 75
              ? 1.2
              : 1.0;

      // Economic tier modifier (mock - would be based on actual country data)
      const economicTierMultiplier = 1.0; // Would vary by target country's economic tier

      const totalCost = baseCost * relationshipMultiplier * economicTierMultiplier;
      const approvalTime =
        relationshipStrength < 25
          ? 45
          : relationshipStrength < 50
            ? 30
            : relationshipStrength < 75
              ? 21
              : 14; // Days

      return {
        baseCost,
        relationshipMultiplier,
        economicTierMultiplier,
        totalCost: Math.round(totalCost),
        approvalTime,
        requirements: {
          minimumRelationship: "neutral",
          minimumStrength: 25,
          requiredDocuments: ["Diplomatic Note", "Country Agreement", "Security Clearance"],
          specialRequirements:
            relationshipStrength < 50 ? ["Security Review", "Extended Approval Process"] : [],
        },
      };
    }),

  upgradeEmbassy: protectedProcedure
    .input(
      z.object({
        embassyId: z.string(),
        upgradeType: z.enum([
          "staff_expansion",
          "security_enhancement",
          "tech_upgrade",
          "facility_expansion",
          "specialization_improvement",
        ]),
        level: z.number().min(1).max(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
      });

      if (!embassy) throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });

      if (!ctx.user?.countryId || ctx.user.countryId !== embassy.guestCountryId) {
        throw new Error("You can only upgrade your own embassies.");
      }

      const upgradeCosts = {
        staff_expansion: [10000, 25000, 50000],
        security_enhancement: [15000, 35000, 70000],
        tech_upgrade: [20000, 45000, 90000],
        facility_expansion: [30000, 65000, 120000],
        specialization_improvement: [25000, 55000, 100000],
      };

      const upgradeCostArray = upgradeCosts[input.upgradeType];
      if (!upgradeCostArray || !upgradeCostArray[input.level - 1]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid upgrade type or level" });
      }

      const cost = upgradeCostArray[input.level - 1];
      const duration = input.level * 7; // Days

      if (embassy.budget < (cost || 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient embassy budget" });
      }

      // Create upgrade record
      const upgrade = await ctx.db.embassyUpgrade.create({
        data: {
          embassyId: input.embassyId,
          upgradeType: input.upgradeType,
          name: `${input.upgradeType.replace("_", " ")} Level ${input.level}`,
          description: `Upgrade ${input.upgradeType.replace("_", " ")} to level ${input.level}`,
          level: input.level,
          cost: cost || 0,
          duration,
          requiredLevel: Math.ceil(input.level / 2),
          status: "in_progress",
          startedAt: new Date(),
          completesAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
          effects: JSON.stringify(getUpgradeEffects(input.upgradeType, input.level)),
        },
      });

      // Deduct cost from embassy budget
      await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          budget: { decrement: cost },
          upgradeProgress: 0,
        },
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
            where: { status: { in: ["available", "in_progress", "completed"] } },
          },
        },
      });

      if (!embassy) throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });

      const upgradeTypes = [
        "staff_expansion",
        "security_enhancement",
        "tech_upgrade",
        "facility_expansion",
        "specialization_improvement",
      ];

      const availableUpgrades = upgradeTypes
        .map((upgradeType) => {
          const existingUpgrade = embassy.upgrades?.find((u) => u.upgradeType === upgradeType);
          const currentLevel = existingUpgrade?.level || 0;
          const nextLevel = Math.min(currentLevel + 1, 3);

          if (nextLevel > 3) return null;

          const costs = {
            staff_expansion: [10000, 25000, 50000],
            security_enhancement: [15000, 35000, 70000],
            tech_upgrade: [20000, 45000, 90000],
            facility_expansion: [30000, 65000, 120000],
            specialization_improvement: [25000, 55000, 100000],
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
              budget: costs[upgradeType as keyof typeof costs][nextLevel - 1],
            },
            canAfford: embassy.budget >= costs[upgradeType as keyof typeof costs][nextLevel - 1],
            meetsLevelReq: embassy.level >= Math.ceil(nextLevel / 2),
          };
        })
        .filter(Boolean);

      return availableUpgrades;
    }),

  // Embassy Missions
  getAvailableMissions: publicProcedure
    .input(z.object({ embassyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
      });

      if (!embassy) throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });

      // Generate available missions based on embassy level, specialization, and location
      const missions = generateAvailableMissions(embassy);
      return missions;
    }),

  startMission: protectedProcedure
    .input(
      z.object({
        embassyId: z.string(),
        missionType: z.enum([
          "trade_negotiation",
          "intelligence_gathering",
          "cultural_outreach",
          "security_cooperation",
          "research_collaboration",
        ]),
        staffAssigned: z.number().min(1).max(5),
        priorityLevel: z.enum(["low", "normal", "high"]).default("normal"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
      });

      if (!embassy) throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });

      if (!ctx.user?.countryId || ctx.user.countryId !== embassy.guestCountryId) {
        throw new Error("You can only start missions for your own embassies.");
      }
      if (embassy.currentMissions >= embassy.maxMissions) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Embassy has reached maximum mission capacity",
        });
      }
      if (input.staffAssigned > embassy.staffCount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough staff available" });
      }

      const missionData = getMissionData(input.missionType, embassy.level, input.priorityLevel);
      const duration =
        missionData.baseDuration *
        (input.priorityLevel === "high" ? 0.8 : input.priorityLevel === "low" ? 1.2 : 1.0);

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
          successChance: calculateSuccessChance(
            embassy,
            missionData.difficulty,
            input.staffAssigned
          ),
          ixTimeStarted: IxTime.getCurrentIxTime(),
          ixTimeCompletes: IxTime.getCurrentIxTime() + duration * 24,
        },
      });

      // Update embassy mission count and budget
      await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          currentMissions: { increment: 1 },
          budget: { decrement: missionData.cost },
        },
      });

      // 🔔 Notify country about mission start
      try {
        await notificationAPI.create({
          title: "🎯 Diplomatic Mission Started",
          message: `${missionData.name} has been initiated at ${embassy.name} (${Math.round(duration)} days)`,
          countryId: embassy.guestCountryId,
          category: "diplomatic",
          priority: "low",
          type: "info",
          href: "/diplomatic",
          source: "diplomatic-system",
          actionable: false,
          metadata: {
            missionId: mission.id,
            embassyId: input.embassyId,
            missionType: input.missionType,
          },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send mission start notification:", error);
      }

      return mission;
    }),

  completeMission: protectedProcedure
    .input(z.object({ missionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mission = await ctx.db.embassyMission.findUnique({
        where: { id: input.missionId },
        include: {
          embassy: true,
          culturalExchange: true, // Include linked cultural exchange
        },
      });

      if (!mission) throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });

      if (!ctx.user?.countryId || ctx.user.countryId !== mission.embassy.guestCountryId) {
        throw new Error("You can only complete missions for your own embassies.");
      }
      if (mission.completesAt > new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mission not yet completed" });
      }

      // Deterministic success based on successChance (no random)
      // Success if successChance >= 50%, otherwise failure
      const success = mission.successChance >= 50;
      const finalStatus = success ? "completed" : "failed";
      const rewardMultiplier = success ? 1.0 : 0.3;

      // Update mission status
      await ctx.db.embassyMission.update({
        where: { id: input.missionId },
        data: {
          status: finalStatus,
          progress: 100,
        },
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
            increment: success ? 1 : -0.5,
          },
        },
      });

      // Award IxCredits based on mission type (only if successful)
      let creditsEarned = 0;
      if (success && ctx.user?.id) {
        // Determine credits based on mission type
        const creditRewards: Record<string, number> = {
          cultural_outreach: 5,
          trade_negotiation: 8,
          security_cooperation: 10,
          intelligence_gathering: 10,
          research_collaboration: 15,
        };

        creditsEarned = creditRewards[mission.type] || 5;

        // Award credits to user
        const creditResult = await vaultService.earnCredits(
          ctx.user.id,
          creditsEarned,
          "EARN_ACTIVE",
          "diplomatic_mission",
          ctx.db,
          {
            missionId: mission.id,
            missionType: mission.type,
            missionName: mission.name,
            embassyId: mission.embassyId,
            partnerCountry: mission.embassy.hostCountryId,
            duration: mission.duration,
            difficulty: mission.difficulty,
          }
        );

        if (!creditResult.success) {
          console.warn(`[Diplomatic] Failed to award credits for mission ${mission.id}:`, creditResult.message);
        } else {
          console.log(`[Diplomatic] Awarded ${creditsEarned} IxC to user ${ctx.user.id} for completing mission ${mission.id}`);
        }
      }

      // Boost linked cultural exchange if mission successful and cultural_outreach type
      let culturalExchangeBoost = null;
      if (success && mission.type === "cultural_outreach" && mission.culturalExchange) {
        const culturalImpactBoost = 15; // +15 points to cultural impact
        const diplomaticValueBoost = 10; // +10 points to diplomatic value

        await ctx.db.culturalExchange.update({
          where: { id: mission.culturalExchange.id },
          data: {
            culturalImpact: { increment: culturalImpactBoost },
            diplomaticValue: { increment: diplomaticValueBoost },
          },
        });

        culturalExchangeBoost = {
          exchangeId: mission.culturalExchange.id,
          exchangeTitle: mission.culturalExchange.title,
          culturalImpactBoost,
          diplomaticValueBoost,
        };

        // Update embassy's cultural specialization strength if it has one
        if (mission.embassy.specialization === "cultural") {
          await ctx.db.embassy.update({
            where: { id: mission.embassyId },
            data: {
              level: { increment: 1 }, // Boost embassy level
            },
          });
        }
      }

      // Create diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: mission.embassy.guestCountryId,
          country2Id: mission.embassy.hostCountryId,
          eventType: "mission_completed",
          title: `Mission ${success ? "Successful" : "Failed"}`,
          description: `${mission.name} at ${mission.embassy.name} has been ${success ? "completed successfully" : "failed"}${culturalExchangeBoost ? `. Boosted ${culturalExchangeBoost.exchangeTitle} by +${culturalExchangeBoost.culturalImpactBoost} cultural impact!` : ""}`,
          embassyId: mission.embassyId,
          missionId: mission.id,
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
          relationshipImpact: success ? 2 : -1,
          reputationImpact: reputationGained,
          economicImpact: economicGained,
          severity: success ? "positive" : "warning",
        },
      });

      // 🔔 Notify country about mission completion
      try {
        const creditsMessage = creditsEarned > 0 ? `, +${creditsEarned} IxC` : "";
        const notificationMessage = success
          ? `${mission.name} at ${mission.embassy.name} has completed successfully. Rewards: +${experienceGained} XP, +${influenceGained.toFixed(0)} influence${creditsMessage}${culturalExchangeBoost ? `. Cultural exchange "${culturalExchangeBoost.exchangeTitle}" boosted by +${culturalExchangeBoost.culturalImpactBoost} cultural impact!` : ""}`
          : `${mission.name} at ${mission.embassy.name} has failed. Better luck next time!`;

        await notificationAPI.create({
          title: success ? "✅ Mission Successful!" : "❌ Mission Failed",
          message: notificationMessage,
          countryId: mission.embassy.guestCountryId,
          category: "diplomatic",
          priority: success ? "medium" : "low",
          type: success ? "success" : "warning",
          href: "/diplomatic",
          source: "diplomatic-system",
          actionable: false,
          metadata: {
            missionId: mission.id,
            embassyId: mission.embassyId,
            success,
            rewards: {
              experience: experienceGained,
              influence: influenceGained,
              credits: creditsEarned,
            },
            culturalExchangeBoost,
          },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send mission completion notification:", error);
      }

      return {
        success,
        mission,
        rewards: {
          experience: experienceGained,
          influence: influenceGained,
          reputation: reputationGained,
          economic: economicGained,
          credits: creditsEarned,
        },
        culturalExchangeBoost,
      };
    }),

  // Embassy Economics
  payMaintenance: protectedProcedure
    .input(z.object({ embassyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
      });

      if (!embassy) throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });

      if (!ctx.user?.countryId || ctx.user.countryId !== embassy.guestCountryId) {
        throw new Error("You can only pay maintenance for your own embassies.");
      }
      if (embassy.budget < embassy.maintenanceCost) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient funds for maintenance" });
      }

      await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          budget: { decrement: embassy.maintenanceCost },
          lastMaintenancePaid: new Date(),
          effectiveness: { increment: 2 }, // Reward for timely maintenance
        },
      });

      return { success: true, amountPaid: embassy.maintenanceCost };
    }),

  allocateBudget: protectedProcedure
    .input(
      z.object({
        embassyId: z.string(),
        additionalBudget: z.number().min(1000).max(1000000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
      });

      if (!embassy) throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });

      if (!ctx.user?.countryId || ctx.user.countryId !== embassy.guestCountryId) {
        throw new Error("You can only allocate budget to your own embassies.");
      }

      const updatedEmbassy = await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          budget: { increment: input.additionalBudget },
        },
      });

      return updatedEmbassy;
    }),

  // Influence and Relationship Management Procedures
  getInfluenceBreakdown: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const embassies = await ctx.db.embassy.findMany({
        where: { hostCountryId: input.countryId },
        include: {
          missions: {
            where: { status: "COMPLETED" },
          },
        },
      });

      const breakdown = embassies.map((embassy) => {
        const totalInfluence = embassy.influence || 0;
        const effects = getInfluenceEffects(totalInfluence);
        const completedMissions = embassy.missions?.length || 0;

        return {
          embassyId: embassy.id,
          targetCountryId: (embassy as any).guestCountryId || embassy.id,
          targetCountryName: (embassy as any).targetCountry || "Unknown",
          currentInfluence: totalInfluence,
          level: embassy.level || 1,
          completedMissions,
          effects,
          influenceRank:
            totalInfluence >= 1000
              ? "Elite"
              : totalInfluence >= 500
                ? "High"
                : totalInfluence >= 200
                  ? "Medium"
                  : totalInfluence >= 100
                    ? "Basic"
                    : "Minimal",
        };
      });

      const totalInfluence = breakdown.reduce((sum, b) => sum + b.currentInfluence, 0);

      return {
        breakdown,
        totalInfluence,
        globalEffects: getInfluenceEffects(totalInfluence),
        averageInfluence: breakdown.length > 0 ? Math.floor(totalInfluence / breakdown.length) : 0,
      };
    }),

  updateRelationshipStrength: protectedProcedure
    .input(
      z.object({
        relationshipId: z.string(),
        influenceChange: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const relationship = await ctx.db.diplomaticRelation.findUnique({
        where: { id: input.relationshipId },
      });

      if (!relationship) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Diplomatic relationship not found" });
      }

      // Verify user owns one of the countries in this relationship
      if (
        !ctx.user?.countryId ||
        (relationship.country1 !== ctx.user.countryId &&
          relationship.country2 !== ctx.user.countryId)
      ) {
        throw new Error("You can only update relationships for your own country.");
      }

      const relationshipImpact = calculateRelationshipImpact(
        input.influenceChange,
        relationship.relationship
      );

      const newStrength = Math.max(
        0,
        Math.min(100, (relationship.strength || 50) + relationshipImpact)
      );

      // Determine if relationship type should change
      let newRelationshipType = relationship.relationship;
      if (newStrength >= 80 && relationship.relationship !== "alliance") {
        newRelationshipType = "alliance";
      } else if (newStrength >= 60 && newStrength < 80 && relationship.relationship === "neutral") {
        newRelationshipType = "trade";
      } else if (newStrength < 30 && relationship.relationship !== "tension") {
        newRelationshipType = "tension";
      } else if (newStrength >= 30 && newStrength < 60 && relationship.relationship === "tension") {
        newRelationshipType = "neutral";
      }

      const updated = await ctx.db.diplomaticRelation.update({
        where: { id: input.relationshipId },
        data: {
          strength: newStrength,
          relationship: newRelationshipType,
          // lastActivity: new Date()
        },
      });

      // Create diplomatic event for significant changes
      if (newRelationshipType !== relationship.relationship) {
        await ctx.db.diplomaticEvent.create({
          data: {
            country1Id: relationship.country1,
            country2Id: relationship.country2,
            eventType: "relationship_change",
            title: `Relationship Status Changed`,
            description: `Diplomatic relationship evolved from ${relationship.relationship} to ${newRelationshipType} due to ${input.reason}`,
            ixTimeTimestamp: IxTime.getCurrentIxTime(),
            relationshipImpact: relationshipImpact,
            severity: relationshipImpact > 0 ? "positive" : "negative",
          },
        });

        // 🔔 Notify both countries about relationship change
        try {
          const priority = relationshipImpact < 0 ? "high" : "medium";
          const type = relationshipImpact > 0 ? "success" : "warning";

          // Notify both countries
          await Promise.all([
            notificationAPI.create({
              title: "🤝 Diplomatic Relationship Changed",
              message: `Relationship evolved to ${newRelationshipType} (${input.reason})`,
              countryId: relationship.country1,
              category: "diplomatic",
              priority,
              type,
              href: "/diplomatic",
              source: "diplomatic-system",
              actionable: true,
            }),
            notificationAPI.create({
              title: "🤝 Diplomatic Relationship Changed",
              message: `Relationship evolved to ${newRelationshipType} (${input.reason})`,
              countryId: relationship.country2,
              category: "diplomatic",
              priority,
              type,
              href: "/diplomatic",
              source: "diplomatic-system",
              actionable: true,
            }),
          ]);
        } catch (error) {
          console.error("[Diplomatic] Failed to send relationship change notifications:", error);
        }
      }

      return {
        previousStrength: relationship.strength,
        newStrength,
        strengthChange: relationshipImpact,
        previousType: relationship.relationship,
        newType: newRelationshipType,
        typeChanged: newRelationshipType !== relationship.relationship,
      };
    }),

  getInfluenceLeaderboard: rateLimitedPublicProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      include: {
        embassiesGuest: {
          select: {
            influence: true,
            level: true,
            status: true,
          },
        },
      },
    });

    const leaderboard = countries
      .map((country) => {
        const activeEmbassies = country.embassiesGuest.filter(
          (e: { status: string }) => e.status === "ACTIVE"
        );
        const totalInfluence = activeEmbassies.reduce(
          (sum: number, e: { influence: number | null }) => sum + (e.influence || 0),
          0
        );
        const averageLevel =
          activeEmbassies.length > 0
            ? activeEmbassies.reduce(
                (sum: number, e: { level: number | null }) => sum + (e.level || 1),
                0
              ) / activeEmbassies.length
            : 0;

        return {
          countryId: country.id,
          countryName: country.name,
          totalInfluence,
          averageLevel: Math.round(averageLevel * 10) / 10,
          activeEmbassies: activeEmbassies.length,
          globalEffects: getInfluenceEffects(totalInfluence),
        };
      })
      .sort((a, b) => b.totalInfluence - a.totalInfluence)
      .slice(0, 20); // Top 20

    return leaderboard;
  }),

  // Follow/Unfollow system for countries
  getFollowStatus: publicProcedure
    .input(
      z.object({
        viewerCountryId: z.string(),
        targetCountryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const follow = await ctx.db.countryFollow.findUnique({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.viewerCountryId,
            followedCountryId: input.targetCountryId,
          },
        },
      });

      return {
        isFollowing: !!follow,
        followedAt: follow?.createdAt || null,
      };
    }),

  followCountry: protectedProcedure
    .input(
      z.object({
        followerCountryId: z.string(),
        followedCountryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      if (!ctx.user?.countryId || ctx.user.countryId !== input.followerCountryId) {
        throw new Error("You can only follow countries with your own country.");
      }

      // Create follow relationship
      const follow = await ctx.db.countryFollow.create({
        data: {
          followerCountryId: input.followerCountryId,
          followedCountryId: input.followedCountryId,
        },
      });

      // 🔔 Notify followed country about new follower
      try {
        const followerCountry = await ctx.db.country.findUnique({
          where: { id: input.followerCountryId },
          select: { name: true },
        });

        await notificationAPI.create({
          title: "👁️ New Country Following",
          message: `${followerCountry?.name || "A country"} is now following your country`,
          countryId: input.followedCountryId,
          category: "social",
          priority: "low",
          type: "info",
          href: "/diplomatic",
          source: "diplomatic-system",
          actionable: false,
          metadata: { followerCountryId: input.followerCountryId },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send follow notification:", error);
      }

      return { success: true, follow };
    }),

  unfollowCountry: protectedProcedure
    .input(
      z.object({
        followerCountryId: z.string(),
        followedCountryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      if (!ctx.user?.countryId || ctx.user.countryId !== input.followerCountryId) {
        throw new Error("You can only unfollow countries with your own country.");
      }

      // Delete follow relationship
      await ctx.db.countryFollow.delete({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.followerCountryId,
            followedCountryId: input.followedCountryId,
          },
        },
      });

      return { success: true };
    }),

  // Embassy Shared Data System
  getSharedData: publicProcedure
    .input(
      z.object({
        embassyId: z.string(),
        dataType: z.enum(["economic", "intelligence", "research", "cultural", "policy"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Fetch embassy to verify it exists and get country IDs
        const embassy = await ctx.db.embassy.findUnique({
          where: { id: input.embassyId },
          include: {
            hostCountry: { select: { id: true, name: true } },
            guestCountry: { select: { id: true, name: true } },
          },
        });

        if (!embassy) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });
        }

        // Generate mock shared data based on embassy level and influence
        // In production, this would fetch from a SharedData table
        const embassyLevel = embassy.level || 1;
        const embassyInfluence = embassy.influence || 10;
        const embassyAge = Math.floor(
          (Date.now() - embassy.establishedAt.getTime()) / (1000 * 60 * 60 * 24)
        ); // Days since established

        const sharedData: any = {};

        // Economic Data
        if (!input.dataType || input.dataType === "economic") {
          // Query real diplomatic relation for trade volume
          const relation = await ctx.db.diplomaticRelation.findFirst({
            where: {
              OR: [
                { country1: embassy.hostCountryId, country2: embassy.guestCountryId },
                { country1: embassy.guestCountryId, country2: embassy.hostCountryId },
              ],
            },
          });

          // Get completed trade negotiation missions (joint ventures)
          const completedTradeMissions = await ctx.db.embassyMission.findMany({
            where: {
              embassyId: input.embassyId,
              type: "trade_negotiation",
              status: "completed",
            },
          });

          // Get active trade treaties between these countries
          const activeTradeTreaties = await ctx.db.treaty.findMany({
            where: {
              OR: [
                { parties: { contains: embassy.hostCountryId } },
                { parties: { contains: embassy.guestCountryId } },
              ],
              type: { contains: "trade" },
              status: "ratified",
            },
          });

          // Calculate real tradeVolume (from relation or calculate from embassy data)
          const baseTradeVolume = relation?.tradeVolume || 0;
          const missionTradeBonus = completedTradeMissions.reduce(
            (sum, mission) => sum + (mission.economicReward || 0),
            0
          );
          const tradeVolume = Math.floor(baseTradeVolume + missionTradeBonus);

          // Calculate tradeGrowth based on historical data if available
          let tradeGrowth = 0;
          try {
            // Get historical data for both countries to estimate trade growth
            const historicalData = await ctx.db.historicalDataPoint.findMany({
              where: {
                OR: [{ countryId: embassy.hostCountryId }, { countryId: embassy.guestCountryId }],
                ixTimeTimestamp: {
                  gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
                },
              },
              orderBy: { ixTimeTimestamp: "asc" },
              take: 20,
            });

            if (historicalData.length >= 2) {
              // Calculate average GDP growth between the two countries
              const avgGdpGrowth =
                historicalData.reduce((sum, point) => sum + point.gdpGrowthRate, 0) /
                historicalData.length;
              tradeGrowth = Math.floor(avgGdpGrowth * 0.5 + embassyLevel * 2.5); // Trade grows at ~50% of GDP growth + embassy bonus
            } else {
              // Fallback to embassy-based calculation
              tradeGrowth = Math.floor(embassyLevel * 2.5 + embassyInfluence * 0.3);
            }
          } catch (error) {
            // Fallback calculation if historical data query fails
            tradeGrowth = Math.floor(embassyLevel * 2.5 + embassyInfluence * 0.3);
          }

          // Real jointVentures count (completed trade negotiation missions)
          const jointVentures = completedTradeMissions.length;

          // Calculate investmentValue based on real embassy data
          const investmentValue = Math.floor(
            (embassy.budget || 0) * 0.1 + // 10% of embassy budget
              completedTradeMissions.reduce((sum, m) => sum + (m.economicReward || 0), 0) * 0.5 + // 50% of mission rewards
              embassyLevel * embassyInfluence * 3 // Base calculation from embassy stats
          );

          // Calculate tariffsReduced from active trade treaties and embassy level
          const treatyTariffReduction = activeTradeTreaties.reduce((sum, treaty) => {
            return sum + (treaty.complianceRate || 0) * 0.15; // Each treaty contributes up to 15% based on compliance
          }, 0);
          const embassyTariffReduction = Math.floor(embassyLevel * 15 + embassyInfluence / 2);
          const tariffsReduced = Math.min(100, treatyTariffReduction + embassyTariffReduction);

          // Calculate economicBenefit from real data
          const economicBenefit = Math.min(
            50,
            embassyLevel * 3.5 +
              embassyInfluence / 10 +
              (tradeVolume > 0 ? Math.log10(tradeVolume + 1) * 2 : 0) + // Logarithmic bonus from trade volume
              jointVentures * 0.5 // Bonus from joint ventures
          );

          sharedData.economic = {
            tradeVolume,
            tradeGrowth,
            jointVentures,
            investmentValue,
            tariffsReduced: Math.floor(tariffsReduced),
            economicBenefit: Math.floor(economicBenefit * 10) / 10, // Round to 1 decimal
          };
        }

        // Intelligence Data
        // Fetch templates from database and generate reports based on embassy level
        if (!input.dataType || input.dataType === "intelligence") {
          const intelligenceReports: Array<{
            reportType: string;
            classification: string;
            summary: string;
            keyFindings: string[];
            confidence: number;
            lastUpdated: string;
          }> = [];

          // Calculate deterministic lastUpdated date based on embassy age
          // Reports are "updated" every 7 days, with the most recent being within the last week
          const daysSinceEstablishment = embassyAge;
          const reportCycle = 7; // 7-day reporting cycle
          const daysUntilNextReport = daysSinceEstablishment % reportCycle;
          const lastReportDate = new Date(Date.now() - daysUntilNextReport * 24 * 60 * 60 * 1000);

          // Fetch active intelligence templates from database
          const templates = await ctx.db.intelligenceTemplate.findMany({
            where: {
              isActive: true,
              minimumLevel: {
                lte: embassyLevel, // Only templates for which embassy qualifies
              },
            },
            orderBy: {
              minimumLevel: "asc",
            },
          });

          // Generate reports from templates
          templates.forEach((template, index) => {
            // Parse findings from JSON
            const keyFindings = JSON.parse(template.findingsTemplate) as string[];

            // Calculate confidence based on template base + embassy level
            // Economic: base 70 + level*5 (range: 75-90)
            // Political: base 75 + level*4 (range: 83-95)
            // Security: base 80 + level*3 (range: 89-95)
            const confidenceMultiplier =
              template.reportType === "economic" ? 5 : template.reportType === "political" ? 4 : 3;
            const confidence = Math.floor(
              template.confidenceBase + embassyLevel * confidenceMultiplier
            );

            // Stagger report dates: economic is most recent, others are older
            const dayOffset = index; // 0 for first (economic), 1 for second (political), etc.
            const reportDate = new Date(lastReportDate.getTime() - dayOffset * 24 * 60 * 60 * 1000);

            intelligenceReports.push({
              reportType: template.reportType,
              classification: template.classification,
              summary: template.summaryTemplate,
              keyFindings,
              confidence,
              lastUpdated: reportDate.toISOString(),
            });
          });

          sharedData.intelligence = intelligenceReports;
        }

        // Research Data
        // Query real research collaboration missions from EmbassyMission table
        if (!input.dataType || input.dataType === "research") {
          // Fetch all research collaboration missions for this embassy
          const researchMissions = await ctx.db.embassyMission.findMany({
            where: {
              embassyId: input.embassyId,
              type: "research_collaboration",
            },
            orderBy: { startedAt: "desc" },
          });

          const researchProjects = [];

          // Map completed/active research missions to research projects
          const completedResearchCount = researchMissions.filter(
            (m) => m.status === "completed"
          ).length;
          const activeResearchCount = researchMissions.filter((m) => m.status === "active").length;

          // Calculate aggregated metrics from real mission data
          const totalPublications = researchMissions.reduce((sum, mission) => {
            // Completed missions contribute 2 publications each, active missions 1
            return sum + (mission.status === "completed" ? 2 : mission.status === "active" ? 1 : 0);
          }, 0);

          const totalPatents = researchMissions.reduce((sum, mission) => {
            // Only completed missions generate patents, 1 per mission
            return sum + (mission.status === "completed" ? 1 : 0);
          }, 0);

          // Create research projects based on embassy level and real mission data
          if (embassyLevel >= 2) {
            researchProjects.push({
              researchArea: "Clean Energy Technologies",
              collaborators: [embassy.hostCountry.name, embassy.guestCountry.name],
              progress: Math.min(100, Math.floor(embassyAge * 1.5 + embassyLevel * 10)), // Deterministic based on age/level
              breakthroughs: ["Solar panel efficiency improvement", "Battery storage optimization"],
              publications: Math.floor(
                totalPublications * 0.6 + (embassyLevel * 2 + embassyAge / 30)
              ), // 60% from missions, 40% from time
              patents: Math.floor(totalPatents * 0.5 + (embassyLevel + embassyAge / 60)), // 50% from missions, 50% from time
            });
          }

          if (embassyLevel >= 3) {
            researchProjects.push({
              researchArea: "Agricultural Innovation",
              collaborators: [embassy.hostCountry.name, embassy.guestCountry.name],
              progress: Math.min(100, Math.floor(embassyAge * 1.2 + embassyLevel * 8)), // Deterministic based on age/level
              breakthroughs: ["Drought-resistant crop varieties", "Precision farming techniques"],
              publications: Math.floor(
                totalPublications * 0.4 + (embassyLevel * 1.5 + embassyAge / 40)
              ), // 40% from missions, 60% from time
              patents: Math.floor(totalPatents * 0.5 + (embassyLevel * 0.5 + embassyAge / 80)), // 50% from missions, 50% from time
            });
          }

          sharedData.research = researchProjects;
        }

        // Cultural Data
        // Query real cultural exchanges and missions
        if (!input.dataType || input.dataType === "cultural") {
          // Fetch cultural exchange events involving either country
          const culturalExchanges = await ctx.db.culturalExchange.findMany({
            where: {
              OR: [
                { hostCountryId: embassy.hostCountryId },
                { hostCountryId: embassy.guestCountryId },
                {
                  participatingCountries: {
                    some: {
                      OR: [
                        { countryId: embassy.hostCountryId },
                        { countryId: embassy.guestCountryId },
                      ],
                    },
                  },
                },
              ],
            },
          });

          // Fetch cultural outreach missions for this embassy
          const culturalMissions = await ctx.db.embassyMission.findMany({
            where: {
              embassyId: input.embassyId,
              type: "cultural_outreach",
            },
          });

          // Calculate real metrics from database
          const completedExchanges = culturalExchanges.filter(
            (e) => e.status === "completed"
          ).length;
          const activeExchanges = culturalExchanges.filter((e) => e.status === "active").length;
          const completedCulturalMissions = culturalMissions.filter(
            (m) => m.status === "completed"
          ).length;

          // Calculate real cultural impact from exchanges
          const totalCulturalImpact = culturalExchanges.reduce((sum, exchange) => {
            return sum + (exchange.culturalImpact || 0);
          }, 0);
          const avgCulturalImpact =
            culturalExchanges.length > 0 ? totalCulturalImpact / culturalExchanges.length : 0;

          // Calculate real diplomatic value
          const totalDiplomaticValue = culturalExchanges.reduce((sum, exchange) => {
            return sum + (exchange.diplomaticValue || 0);
          }, 0);
          const avgDiplomaticValue =
            culturalExchanges.length > 0 ? totalDiplomaticValue / culturalExchanges.length : 0;

          sharedData.cultural = {
            exchangePrograms: completedExchanges + Math.floor(embassyLevel * 2 + embassyAge / 30), // Real + deterministic
            culturalEvents:
              activeExchanges +
              completedExchanges +
              completedCulturalMissions +
              Math.floor(embassyLevel * 3 + embassyAge / 15), // Real + deterministic
            artistsExchanged: Math.floor(
              completedExchanges * 3 + embassyLevel * 4 + embassyAge / 20
            ), // Based on real exchanges + deterministic
            studentsExchanged: Math.floor(
              completedExchanges * 8 + embassyLevel * 10 + embassyAge / 10
            ), // Based on real exchanges + deterministic
            culturalImpactScore: Math.min(
              100,
              Math.floor(avgCulturalImpact + embassyLevel * 12 + embassyInfluence + embassyAge / 5)
            ), // Real impact + deterministic
            diplomaticGoodwill: Math.min(
              100,
              Math.floor(avgDiplomaticValue + embassyLevel * 15 + embassyInfluence * 0.8)
            ), // Real value + deterministic
          };
        }

        // Policy Data
        // Query real treaties between the two countries
        if (!input.dataType || input.dataType === "policy") {
          // Fetch treaties where both countries are parties
          // Note: Treaty.parties is a nullable string field, likely JSON or comma-separated
          const allTreaties = await ctx.db.treaty.findMany({
            where: {
              OR: [
                {
                  AND: [
                    { parties: { contains: embassy.hostCountryId } },
                    { parties: { contains: embassy.guestCountryId } },
                  ],
                },
                {
                  AND: [
                    { parties: { contains: embassy.hostCountry.name } },
                    { parties: { contains: embassy.guestCountry.name } },
                  ],
                },
              ],
            },
          });

          // Filter to only ratified treaties (status should be 'ratified' or 'active')
          const activeTreaties = allTreaties.filter(
            (t) =>
              t.status === "ratified" ||
              t.status === "active" ||
              t.status === "RATIFIED" ||
              t.status === "ACTIVE"
          );

          const policyFrameworks = activeTreaties.map((treaty) => {
            // Determine agreement type from treaty type
            let agreementType = "bilateral";
            if (treaty.type.toLowerCase().includes("framework")) {
              agreementType = "framework";
            } else if (
              treaty.type.toLowerCase().includes("memorandum") ||
              treaty.type.toLowerCase().includes("mou")
            ) {
              agreementType = "memorandum";
            }

            // Parse key provisions if stored in description
            const keyProvisions: string[] = [];
            if (treaty.description) {
              // Try to extract bullet points or numbered items from description
              const lines = treaty.description.split(/\n|;|\./).filter((l) => l.trim().length > 10);
              keyProvisions.push(...lines.slice(0, 3)); // Take first 3 meaningful lines
            }

            // If no provisions found, generate deterministic ones based on treaty type
            if (keyProvisions.length === 0) {
              if (treaty.type.toLowerCase().includes("trade")) {
                keyProvisions.push(
                  "Reduced tariffs on key exports",
                  "Streamlined customs procedures",
                  "Investment protection guarantees"
                );
              } else if (treaty.type.toLowerCase().includes("cultural")) {
                keyProvisions.push(
                  "Annual cultural festivals",
                  "Student exchange programs",
                  "Artist residency initiatives"
                );
              } else if (
                treaty.type.toLowerCase().includes("science") ||
                treaty.type.toLowerCase().includes("research")
              ) {
                keyProvisions.push(
                  "Joint research initiatives",
                  "Technology transfer agreements",
                  "Shared research facilities"
                );
              } else {
                keyProvisions.push(
                  "Mutual cooperation",
                  "Regular consultations",
                  "Information sharing"
                );
              }
            }

            return {
              policyFramework: treaty.name,
              agreementType,
              status: treaty.status.toLowerCase(),
              effectiveDate: treaty.signedDate.toISOString(),
              keyProvisions,
              compliance: treaty.complianceRate || Math.min(100, Math.floor(85 + embassyLevel * 3)), // Use real compliance or deterministic
            };
          });

          // If no real treaties exist, generate deterministic fallback treaties based on embassy level
          if (policyFrameworks.length === 0) {
            if (embassyLevel >= 1) {
              policyFrameworks.push({
                policyFramework: "Bilateral Trade Agreement",
                agreementType: "bilateral",
                status: "ratified",
                effectiveDate: new Date(
                  embassy.establishedAt.getTime() + 30 * 24 * 60 * 60 * 1000
                ).toISOString(),
                keyProvisions: [
                  "Reduced tariffs on key exports",
                  "Streamlined customs procedures",
                  "Investment protection guarantees",
                ],
                compliance: Math.min(100, Math.floor(85 + embassyLevel * 3)),
              });
            }

            if (embassyLevel >= 2) {
              policyFrameworks.push({
                policyFramework: "Cultural Exchange Framework",
                agreementType: "framework",
                status: "ratified",
                effectiveDate: new Date(
                  embassy.establishedAt.getTime() + 60 * 24 * 60 * 60 * 1000
                ).toISOString(),
                keyProvisions: [
                  "Annual cultural festivals",
                  "Student exchange programs",
                  "Artist residency initiatives",
                ],
                compliance: Math.min(100, Math.floor(80 + embassyLevel * 2.5)),
              });
            }

            if (embassyLevel >= 3) {
              policyFrameworks.push({
                policyFramework: "Science and Technology Cooperation",
                agreementType: "memorandum",
                status: embassyAge > 90 ? "ratified" : "under_review",
                effectiveDate:
                  embassyAge > 90
                    ? new Date(
                        embassy.establishedAt.getTime() + 90 * 24 * 60 * 60 * 1000
                      ).toISOString()
                    : "pending",
                keyProvisions: [
                  "Joint research initiatives",
                  "Technology transfer agreements",
                  "Shared research facilities",
                ],
                compliance: embassyAge > 90 ? Math.min(100, Math.floor(75 + embassyLevel * 2)) : 0,
              });
            }
          }

          sharedData.policy = policyFrameworks;
        }

        return sharedData;
      } catch (error) {
        console.error("Error fetching shared data:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch shared data",
          cause: error,
        });
      }
    }),

  shareData: protectedProcedure
    .input(
      z.object({
        embassyId: z.string(),
        dataType: z.enum(["economic", "intelligence", "research", "cultural", "policy"]),
        dataContent: z.object({
          title: z.string(),
          content: z.string(),
          metadata: z.record(z.string(), z.any()).optional(),
          expiresAt: z.string().optional(),
        }),
        shareLevel: z.enum(["view", "collaborate"]).default("view"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new Error("You must be associated with a country to share data.");
      }

      // Verify user owns the embassy (guestCountryId)
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
      });

      if (!embassy || embassy.guestCountryId !== ctx.user.countryId) {
        throw new Error("You can only share data from your own embassies.");
      }

      // In production, this would create a SharedData record
      // For now, return success with mock data
      return {
        success: true,
        message: `${input.dataContent.title} has been shared with ${embassy.hostCountryId}`,
        dataType: input.dataType,
        shareLevel: input.shareLevel,
      };
    }),

  revokeSharedData: protectedProcedure
    .input(
      z.object({
        sharedDataId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new Error("You must be associated with a country to revoke shared data.");
      }

      // In production, this would delete from SharedData table after verifying ownership
      return {
        success: true,
        message: "Data sharing has been revoked",
      };
    }),

  // Embassy Profile Management
  updateEmbassyProfile: protectedProcedure
    .input(
      z.object({
        embassyId: z.string(),
        description: z.string().optional(),
        strategicPriorities: z.string().optional(),
        partnershipGoals: z.string().optional(),
        keyAchievements: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new Error("You must be associated with a country to update embassy profiles.");
      }

      // Verify user owns the embassy (guestCountryId)
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
        include: {
          optionUsage: {
            where: { removedAt: null },
          },
        },
      });

      if (!embassy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });
      }

      if (embassy.guestCountryId !== ctx.user.countryId) {
        throw new Error("You can only update your own embassy profiles.");
      }

      // Build update data object with only provided fields
      const updateData: {
        description?: string;
        strategicPriorities?: string;
        partnershipGoals?: string;
        keyAchievements?: string;
      } = {};

      if (input.description !== undefined) updateData.description = input.description;
      if (input.strategicPriorities !== undefined)
        updateData.strategicPriorities = input.strategicPriorities;
      if (input.partnershipGoals !== undefined)
        updateData.partnershipGoals = input.partnershipGoals;
      if (input.keyAchievements !== undefined) updateData.keyAchievements = input.keyAchievements;

      // Track option usage analytics
      const optionFields = ["strategicPriorities", "partnershipGoals", "keyAchievements"] as const;

      for (const field of optionFields) {
        if (input[field] !== undefined) {
          try {
            // Parse the JSON array of selected option IDs
            const newOptionIds = JSON.parse(input[field]!) as string[];
            const previousOptionIds = embassy[field]
              ? (JSON.parse(embassy[field]!) as string[])
              : [];

            // Find newly selected options
            const addedOptions = newOptionIds.filter((id) => !previousOptionIds.includes(id));

            // Find removed options
            const removedOptions = previousOptionIds.filter((id) => !newOptionIds.includes(id));

            // Create usage records for newly selected options
            if (addedOptions.length > 0) {
              await ctx.db.diplomaticOptionUsage.createMany({
                data: addedOptions.map((optionId) => ({
                  optionId,
                  embassyId: input.embassyId,
                  selectedAt: new Date(),
                })),
              });
            }

            // Mark removed options
            if (removedOptions.length > 0) {
              // Find existing usage records to mark as removed
              const usageRecords = embassy.optionUsage.filter((usage) =>
                removedOptions.includes(usage.optionId)
              );

              await Promise.all(
                usageRecords.map((usage) =>
                  ctx.db.diplomaticOptionUsage.update({
                    where: { id: usage.id },
                    data: { removedAt: new Date() },
                  })
                )
              );
            }
          } catch (error) {
            // If JSON parsing fails, skip analytics tracking for this field
            console.error(`Failed to parse ${field} for analytics:`, error);
          }
        }
      }

      // Update embassy with new profile data
      const updatedEmbassy = await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: updateData,
      });

      return updatedEmbassy;
    }),

  /**
   * Close an embassy (soft delete - sets status to 'closed')
   * Applies diplomatic penalties for closing active embassies
   */
  closeEmbassy: protectedProcedure
    .input(
      z.object({
        embassyId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to close embassies.",
        });
      }

      // Verify embassy exists and user owns it
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
        include: {
          hostCountry: { select: { name: true } },
          guestCountry: { select: { name: true } },
        },
      });

      if (!embassy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });
      }

      if (embassy.guestCountryId !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only close your own embassies.",
        });
      }

      // Calculate diplomatic penalties for closing active embassy
      const penalties = {
        relationshipPenalty: 0,
        reputationLoss: 0,
        influenceLoss: 0,
      };

      if (embassy.status === "active") {
        penalties.relationshipPenalty = -15; // -15% relationship strength
        penalties.reputationLoss = -10; // -10 reputation points
        penalties.influenceLoss = embassy.influence * 0.5; // Lose 50% of embassy influence
      }

      // Close the embassy
      const closedEmbassy = await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          status: "closed",
          influence: { decrement: penalties.influenceLoss },
          reputation: { decrement: penalties.reputationLoss },
        },
      });

      // Apply relationship penalty
      if (penalties.relationshipPenalty < 0) {
        const relation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: embassy.guestCountryId, country2: embassy.hostCountryId },
              { country1: embassy.hostCountryId, country2: embassy.guestCountryId },
            ],
          },
        });

        if (relation) {
          await ctx.db.diplomaticRelation.update({
            where: { id: relation.id },
            data: {
              strength: { increment: penalties.relationshipPenalty },
            },
          });
        }
      }

      // Record diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: embassy.guestCountryId,
          country2Id: embassy.hostCountryId,
          eventType: "embassy_closed",
          title: "Embassy Closed",
          description: input.reason || `${embassy.name} has been closed`,
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
        },
      });

      // Notify host country
      try {
        await notificationAPI.create({
          title: "🏛️ Embassy Closed",
          message: `${embassy.guestCountry?.name || "A country"} has closed ${embassy.name}${input.reason ? `: ${input.reason}` : ""}`,
          countryId: embassy.hostCountryId,
          category: "diplomatic",
          priority: "medium",
          href: "/diplomatic",
          source: "diplomatic-system",
          actionable: false,
          metadata: { embassyId: embassy.id, guestCountryId: embassy.guestCountryId },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send embassy closure notification:", error);
      }

      return {
        success: true,
        embassy: closedEmbassy,
        penalties,
        message:
          embassy.status === "active"
            ? "Embassy closed. Diplomatic penalties applied."
            : "Embassy closed successfully.",
      };
    }),

  /**
   * Vote on a cultural exchange proposal
   */
  voteOnExchange: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        vote: z.enum(["support", "oppose", "abstain"]),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to vote.",
        });
      }

      // Verify exchange exists
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cultural exchange not found",
        });
      }

      // Get country name for vote record
      const country = await ctx.db.country.findUnique({
        where: { id: ctx.user.countryId },
        select: { name: true },
      });

      // Create or update vote (upsert to handle vote changes)
      const vote = await ctx.db.culturalExchangeVote.upsert({
        where: {
          exchangeId_countryId: {
            exchangeId: input.exchangeId,
            countryId: ctx.user.countryId,
          },
        },
        create: {
          exchangeId: input.exchangeId,
          countryId: ctx.user.countryId,
          countryName: country?.name || "Unknown",
          vote: input.vote,
          comment: input.comment,
        },
        update: {
          vote: input.vote,
          comment: input.comment,
          votedAt: new Date(),
        },
      });

      // Track voting on cultural exchange (shows cultural engagement)
      await DiplomaticChoiceTracker.recordChoice({
        countryId: ctx.user.countryId,
        type: "vote_on_cultural_exchange",
        targetCountry: exchange.hostCountryName,
        targetCountryId: exchange.hostCountryId,
        details: {
          exchangeId: input.exchangeId,
          vote: input.vote,
          comment: input.comment,
          exchangeType: exchange.type,
          exchangeTitle: exchange.title,
        },
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
      });

      return {
        success: true,
        vote: vote,
        exchangeId: input.exchangeId,
      };
    }),

  /**
   * Upload cultural artifact to exchange
   */
  uploadCulturalArtifact: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        type: z.enum(["photo", "video", "document", "artwork", "recipe", "music"]),
        title: z.string(),
        description: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        fileUrl: z.string(),
        contributor: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user's country participates in this exchange
      const participation = await ctx.db.culturalExchangeParticipant.findFirst({
        where: {
          exchangeId: input.exchangeId,
          countryId: ctx.user?.countryId || "",
        },
      });

      if (!participation) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your country is not participating in this cultural exchange",
        });
      }

      // Create cultural artifact
      const artifact = await ctx.db.culturalArtifact.create({
        data: {
          exchangeId: input.exchangeId,
          type: input.type,
          title: input.title,
          description: input.description,
          thumbnailUrl: input.thumbnailUrl,
          fileUrl: input.fileUrl,
          contributor: input.contributor,
          countryId: ctx.user?.countryId || "",
        },
      });

      // Get exchange for tracking
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
        select: { hostCountryId: true, hostCountryName: true, type: true },
      });

      // Track artifact upload (cultural engagement)
      if (exchange) {
        await DiplomaticChoiceTracker.recordChoice({
          countryId: ctx.user?.countryId || "",
          type: "upload_cultural_artifact",
          targetCountry: exchange.hostCountryName,
          targetCountryId: exchange.hostCountryId,
          details: {
            exchangeId: input.exchangeId,
            artifactType: input.type,
            artifactTitle: input.title,
            exchangeType: exchange.type,
          },
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
        });
      }

      return artifact;
    }),

  /**
   * Generate cultural scenario for two countries
   */
  generateCulturalScenario: protectedProcedure
    .input(
      z.object({
        targetCountryId: z.string(),
        preferredScenarioType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get relationship data
      const relationship = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: ctx.user?.countryId || "", country2: input.targetCountryId },
            { country1: input.targetCountryId, country2: ctx.user?.countryId || "" },
          ],
        },
      });

      if (!relationship) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No diplomatic relationship exists with this country",
        });
      }

      // Get user's country
      const userCountry = await ctx.db.country.findUnique({
        where: { id: ctx.user?.countryId || "" },
      });

      const targetCountry = await ctx.db.country.findUnique({
        where: { id: input.targetCountryId },
      });

      if (!userCountry || !targetCountry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country not found",
        });
      }

      // Create scenario context
      const scenarioContext = {
        exchangeId: `exchange_${Date.now()}`,
        exchangeType: "festival",
        country1: {
          id: userCountry.id,
          name: userCountry.name,
          culturalOpenness: 60,
          economicStrength: 55,
        },
        country2: {
          id: targetCountry.id,
          name: targetCountry.name,
          culturalOpenness: 60,
          economicStrength: 55,
        },
        relationshipState:
          relationship.status === "alliance"
            ? ("allied" as const)
            : relationship.status === "tension"
              ? ("tense" as const)
              : ("neutral" as const),
        relationshipStrength: 50,
        existingExchanges: 0,
        historicalTensions: false,
        economicTies: Math.min(100, (relationship.tradeVolume || 0) / 10000),
      };

      // Generate scenario using the scenario generator
      // Import is done at the top of the file
      const { CulturalScenarioGenerator, CULTURAL_SCENARIO_TEMPLATES } = await import(
        "~/lib/cultural-scenario-generator"
      );

      const template =
        input.preferredScenarioType &&
        CULTURAL_SCENARIO_TEMPLATES[
          input.preferredScenarioType as keyof typeof CULTURAL_SCENARIO_TEMPLATES
        ]
          ? CULTURAL_SCENARIO_TEMPLATES[
              input.preferredScenarioType as keyof typeof CULTURAL_SCENARIO_TEMPLATES
            ]
          : CulturalScenarioGenerator.selectScenarioTemplate(scenarioContext);

      const scenario = CulturalScenarioGenerator.generateScenario(template, scenarioContext);

      // Save scenario to database
      const savedScenario = await ctx.db.culturalScenario.create({
        data: {
          type: scenario.type,
          title: scenario.title,
          narrative: scenario.narrative,
          country1Id: userCountry.id,
          country2Id: targetCountry.id,
          country1Name: userCountry.name,
          country2Name: targetCountry.name,
          relationshipState: scenarioContext.relationshipState,
          relationshipStrength: scenarioContext.relationshipStrength,
          responseOptions: JSON.stringify(scenario.responseOptions),
          tags: JSON.stringify(scenario.tags),
          culturalImpact: template.culturalImpact,
          diplomaticRisk: template.diplomaticRisk,
          economicCost: template.economicCost,
          expiresAt: new Date(scenario.expiresAt),
        },
      });

      // Track cultural scenario generation (this represents engagement with cultural diplomacy)
      await DiplomaticChoiceTracker.recordChoice({
        countryId: userCountry.id,
        type: "generate_cultural_scenario",
        targetCountry: targetCountry.name,
        targetCountryId: targetCountry.id,
        details: {
          scenarioId: savedScenario.id,
          scenarioType: scenario.type,
          scenarioTitle: scenario.title,
          culturalImpact: template.culturalImpact,
          diplomaticRisk: template.diplomaticRisk,
          economicCost: template.economicCost,
        },
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
      });

      return {
        scenario: savedScenario,
        responseOptions: scenario.responseOptions,
        metadata: scenario.metadata,
      };
    }),

  /**
   * Get NPC cultural response to exchange invitation
   */
  getNPCCulturalResponse: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        npcCountryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get exchange
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cultural exchange not found",
        });
      }

      // Get relationship
      const relationship = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: exchange.hostCountryId, country2: input.npcCountryId },
            { country1: input.npcCountryId, country2: exchange.hostCountryId },
          ],
        },
      });

      // Get NPC country
      const npcCountry = await ctx.db.country.findUnique({
        where: { id: input.npcCountryId },
      });

      if (!npcCountry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "NPC country not found",
        });
      }

      // Generate NPC personality based on observables
      const { NPCPersonalitySystem } = await import("~/lib/diplomatic-npc-personality");
      const { NPCCulturalParticipation } = await import("~/lib/npc-cultural-participation");

      const observableData = {
        relationships: relationship
          ? [
              {
                relationship: relationship.status || "neutral",
                strength: relationship.strength || 50,
                tradeVolume: relationship.tradeVolume ?? undefined,
                culturalExchange: undefined,
                treaties: undefined,
              },
            ]
          : [],
        embassies: [],
        treaties: [],
        historicalActions: [],
      };

      const { createObservableDataFromDatabase } = await import("~/lib/diplomatic-npc-personality");

      const personality = NPCPersonalitySystem.calculatePersonality(
        input.npcCountryId,
        npcCountry.name,
        createObservableDataFromDatabase(observableData)
      );

      // Evaluate participation
      const participationContext = {
        npcCountryId: input.npcCountryId,
        npcCountryName: npcCountry.name,
        npcPersonality: personality,
        hostCountryId: exchange.hostCountryId,
        hostCountryName: exchange.hostCountryName,
        relationshipStrength: relationship?.strength || 50,
        relationshipState: relationship?.status || "neutral",
        exchangeType: exchange.type,
        exchangeDetails: {
          title: exchange.title,
          description: exchange.description,
          culturalImpact: exchange.culturalImpact,
          diplomaticValue: exchange.diplomaticValue,
          economicCost: exchange.economicCost,
          duration: Math.ceil(
            (exchange.endDate.getTime() - exchange.startDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
        existingExchanges: 0,
        historicalSuccess: 50,
      };

      const decision = NPCCulturalParticipation.evaluateParticipation(participationContext);

      return decision;
    }),

  /**
   * Calculate exchange impact using Markov engine
   */
  calculateExchangeImpact: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        responseChoice: z.string(),
        participantSatisfaction: z.number().min(0).max(100),
        publicPerception: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get exchange
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
        include: {
          participatingCountries: true,
        },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cultural exchange not found",
        });
      }

      // Get relationship for main participant
      const mainParticipant = exchange.participatingCountries[0];
      if (!mainParticipant) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No participants in exchange",
        });
      }

      const relationship = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: exchange.hostCountryId, country2: mainParticipant.countryId },
            { country1: mainParticipant.countryId, country2: exchange.hostCountryId },
          ],
        },
      });

      // Calculate impact using CulturalImpactCalculator
      const { CulturalImpactCalculator } = await import("~/lib/cultural-impact-calculator");

      const exchangeData = {
        id: exchange.id,
        type: exchange.type,
        scenarioType: exchange.scenarioType as any,
        hostCountryId: exchange.hostCountryId,
        participantCountryIds: exchange.participatingCountries.map((p) => p.countryId),
        status: exchange.status as any,
        culturalImpact: exchange.culturalImpact,
        diplomaticValue: exchange.diplomaticValue,
        participants: exchange.participants,
        startDate: exchange.startDate,
        endDate: exchange.endDate,
      };

      const outcome = {
        exchangeId: exchange.id,
        responseChoice: input.responseChoice,
        culturalImpactChange: exchange.culturalImpact - 50,
        diplomaticChange: exchange.diplomaticValue - 50,
        economicCost: exchange.economicCost,
        participantSatisfaction: input.participantSatisfaction,
        publicPerception: input.publicPerception,
      };

      const currentRelationship = {
        state: (relationship?.status === "alliance"
          ? "allied"
          : relationship?.status === "tension"
            ? "tense"
            : "neutral") as any,
        strength: relationship?.strength || 50,
        tradeVolume: relationship?.tradeVolume || 0,
        existingCulturalTies: 50,
      };

      const history = {
        totalExchanges: 1,
        successfulExchanges: 1,
        failedExchanges: 0,
        averageCulturalImpact: exchange.culturalImpact,
        averageDiplomaticValue: exchange.diplomaticValue,
        exchangeTypeDistribution: { [exchange.type]: 1 },
        scenarioOutcomes: {},
      };

      const impact = CulturalImpactCalculator.calculateRelationshipImpact(
        exchangeData,
        outcome,
        currentRelationship,
        history
      );

      // Save outcome to database
      const savedOutcome = await ctx.db.culturalExchangeOutcome.create({
        data: {
          exchangeId: exchange.id,
          countryId: ctx.user?.countryId || "",
          responseChoice: input.responseChoice,
          culturalImpactChange: outcome.culturalImpactChange,
          diplomaticChange: outcome.diplomaticChange,
          economicCostActual: outcome.economicCost,
          participantSatisfaction: input.participantSatisfaction,
          publicPerception: input.publicPerception,
          relationshipStateBefore: impact.currentState,
          relationshipStateAfter: impact.newState,
          stateChanged: impact.stateChanged,
          transitionProbability: impact.transitionProbability,
          relationshipStrengthDelta: impact.relationshipStrengthDelta,
          culturalBonusDelta: impact.culturalBonusDelta,
          diplomaticBonusDelta: impact.diplomaticBonusDelta,
          culturalTiesStrength: impact.longTermEffects.culturalTiesStrength,
          softPowerGain: impact.longTermEffects.softPowerGain,
          peopleTopeopleBonds: impact.longTermEffects.peopleTopeopleBonds,
          impactReasoning: JSON.stringify(impact.reasoning),
        },
      });

      // Track cultural exchange outcome (success or failure)
      // Success: positive cultural impact, high satisfaction, positive diplomatic change
      // Failure: negative impact or low satisfaction
      const isSuccess =
        outcome.culturalImpactChange > 0 &&
        input.participantSatisfaction >= 60 &&
        outcome.diplomaticChange >= 0;

      await DiplomaticChoiceTracker.recordChoice({
        countryId: ctx.user?.countryId || "",
        type: isSuccess ? "cultural_exchange_success" : "cultural_exchange_failure",
        targetCountry: mainParticipant.countryName,
        targetCountryId: mainParticipant.countryId,
        details: {
          exchangeId: exchange.id,
          exchangeType: exchange.type,
          exchangeTitle: exchange.title,
          responseChoice: input.responseChoice,
          culturalImpactChange: outcome.culturalImpactChange,
          diplomaticChange: outcome.diplomaticChange,
          participantSatisfaction: input.participantSatisfaction,
          publicPerception: input.publicPerception,
          relationshipStateBefore: impact.currentState,
          relationshipStateAfter: impact.newState,
          stateChanged: impact.stateChanged,
        },
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
      });

      return {
        impact,
        outcome: savedOutcome,
      };
    }),

  // Get cultural compatibility scores for a country with all other countries
  getCulturalCompatibility: rateLimitedPublicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const sourceCountry = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: {
            id: true,
            name: true,
            economicTier: true,
            continent: true,
            flag: true,
          },
        });

        if (!sourceCountry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Source country not found",
          });
        }

        const allCountries = await ctx.db.country.findMany({
          where: { id: { not: input.countryId } },
          select: {
            id: true,
            name: true,
            economicTier: true,
            continent: true,
            flag: true,
          },
        });

        const diplomaticRelations = await ctx.db.diplomaticRelation.findMany({
          where: {
            OR: [{ country1: input.countryId }, { country2: input.countryId }],
          },
        });

        const embassies = await ctx.db.embassy.findMany({
          where: {
            OR: [{ guestCountryId: input.countryId }, { hostCountryId: input.countryId }],
            status: "active",
          },
        });

        const compatibilityResults = allCountries.map((targetCountry) => {
          const relation = diplomaticRelations.find(
            (r) => r.country1 === targetCountry.id || r.country2 === targetCountry.id
          );

          const hasEmbassy = embassies.some(
            (e) =>
              (e.guestCountryId === targetCountry.id && e.hostCountryId === input.countryId) ||
              (e.hostCountryId === targetCountry.id && e.guestCountryId === input.countryId)
          );

          const country1Info: CountryBasicInfo = {
            id: sourceCountry.id,
            name: sourceCountry.name,
            economicTier: sourceCountry.economicTier,
            continent: sourceCountry.continent || undefined,
            flagUrl: sourceCountry.flag || undefined,
          };

          const country2Info: CountryBasicInfo = {
            id: targetCountry.id,
            name: targetCountry.name,
            economicTier: targetCountry.economicTier,
            continent: targetCountry.continent || undefined,
            flagUrl: targetCountry.flag || undefined,
          };

          const diplomaticRel: DiplomaticRelationship | undefined = relation
            ? {
                relationship: relation.relationship,
                strength: relation.strength,
              }
            : undefined;

          const embassyConn: EmbassyConnection | undefined = hasEmbassy
            ? {
                id:
                  embassies.find(
                    (e) =>
                      e.guestCountryId === targetCountry.id || e.hostCountryId === targetCountry.id
                  )?.id || "",
                status: "active",
              }
            : undefined;

          const compatibility = calculateCulturalCompatibility(
            country1Info,
            country2Info,
            diplomaticRel,
            embassyConn
          );

          return {
            targetCountryId: targetCountry.id,
            targetCountryName: targetCountry.name,
            flagUrl: targetCountry.flag || "",
            compatibilityScore: compatibility.score,
            level: compatibility.level,
            diplomaticStatus: relation?.relationship || "none",
            hasEmbassy,
          };
        });

        return compatibilityResults.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
      } catch (error) {
        console.error("Error calculating cultural compatibility:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate cultural compatibility",
          cause: error,
        });
      }
    }),

  // Get recommended diplomatic partners based on cultural compatibility
  getRecommendedPartners: rateLimitedPublicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const sourceCountry = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: {
            id: true,
            name: true,
            economicTier: true,
            continent: true,
            flag: true,
          },
        });

        if (!sourceCountry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Source country not found",
          });
        }

        const allCountries = await ctx.db.country.findMany({
          where: { id: { not: input.countryId } },
          select: {
            id: true,
            name: true,
            economicTier: true,
            continent: true,
            flag: true,
          },
          take: 100, // Limit initial query for performance
        });

        const diplomaticRelations = await ctx.db.diplomaticRelation.findMany({
          where: {
            OR: [{ country1: input.countryId }, { country2: input.countryId }],
          },
        });

        const embassies = await ctx.db.embassy.findMany({
          where: {
            OR: [{ guestCountryId: input.countryId }, { hostCountryId: input.countryId }],
            status: "active",
          },
        });

        const compatibilityResults = allCountries.map((targetCountry) => {
          const relation = diplomaticRelations.find(
            (r) => r.country1 === targetCountry.id || r.country2 === targetCountry.id
          );

          const hasEmbassy = embassies.some(
            (e) =>
              (e.guestCountryId === targetCountry.id && e.hostCountryId === input.countryId) ||
              (e.hostCountryId === targetCountry.id && e.guestCountryId === input.countryId)
          );

          const country1Info: CountryBasicInfo = {
            id: sourceCountry.id,
            name: sourceCountry.name,
            economicTier: sourceCountry.economicTier,
            continent: sourceCountry.continent || undefined,
            flagUrl: sourceCountry.flag || undefined,
          };

          const country2Info: CountryBasicInfo = {
            id: targetCountry.id,
            name: targetCountry.name,
            economicTier: targetCountry.economicTier,
            continent: targetCountry.continent || undefined,
            flagUrl: targetCountry.flag || undefined,
          };

          const diplomaticRel: DiplomaticRelationship | undefined = relation
            ? {
                relationship: relation.relationship,
                strength: relation.strength,
              }
            : undefined;

          const embassyConn: EmbassyConnection | undefined = hasEmbassy
            ? {
                id:
                  embassies.find(
                    (e) =>
                      e.guestCountryId === targetCountry.id || e.hostCountryId === targetCountry.id
                  )?.id || "",
                status: "active",
              }
            : undefined;

          const compatibility = calculateCulturalCompatibility(
            country1Info,
            country2Info,
            diplomaticRel,
            embassyConn
          );

          return {
            targetCountryId: targetCountry.id,
            targetCountryName: targetCountry.name,
            flagUrl: targetCountry.flag || "",
            compatibilityScore: compatibility.score,
            level: compatibility.level,
            diplomaticStatus: relation?.relationship || "none",
            hasEmbassy,
          };
        });

        return compatibilityResults
          .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
          .slice(0, input.limit);
      } catch (error) {
        console.error("Error getting recommended partners:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get recommended diplomatic partners",
          cause: error,
        });
      }
    }),

  // Update cultural exchange (only title and description)
  updateCulturalExchange: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        title: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exchange not found",
        });
      }

      if (!ctx.user?.countryId || exchange.hostCountryId !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the host country can edit this exchange",
        });
      }

      // Update exchange
      const updated = await ctx.db.culturalExchange.update({
        where: { id: input.exchangeId },
        data: {
          title: input.title,
          description: input.description,
          updatedAt: new Date(),
        },
      });

      return updated;
    }),

  // Cancel cultural exchange (with diplomatic penalties)
  cancelCulturalExchange: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        hostCountryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
        include: {
          participatingCountries: true,
        },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exchange not found",
        });
      }

      if (!ctx.user?.countryId || exchange.hostCountryId !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the host country can cancel this exchange",
        });
      }

      if (exchange.status !== "planning") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only exchanges in planning status can be cancelled",
        });
      }

      // Calculate penalties based on participants and status
      const participantCount = exchange.participatingCountries.length;
      const baseReputationLoss = -10;
      const perParticipantPenalty = -5;
      const reputationLoss = baseReputationLoss + participantCount * perParticipantPenalty;

      // Relationship penalty for each participant
      const relationshipPenalty = Math.min(20, 5 + participantCount * 3);

      // Update exchange status to cancelled
      await ctx.db.culturalExchange.update({
        where: { id: input.exchangeId },
        data: {
          status: "cancelled",
          updatedAt: new Date(),
        },
      });

      // Apply relationship penalties to all participating countries
      for (const participant of exchange.participatingCountries) {
        try {
          // Find or create relationship
          const relationship = await ctx.db.diplomaticRelation.findFirst({
            where: {
              OR: [
                { country1: input.hostCountryId, country2: participant.countryId },
                { country1: participant.countryId, country2: input.hostCountryId },
              ],
            },
          });

          if (relationship) {
            // Apply penalty
            await ctx.db.diplomaticRelation.update({
              where: { id: relationship.id },
              data: {
                strength: Math.max(0, relationship.strength - relationshipPenalty),
                culturalExchange:
                  relationship.culturalExchange === "High"
                    ? "Medium"
                    : relationship.culturalExchange,
                updatedAt: new Date(),
              },
            });
          }
        } catch (error) {
          console.error(`Failed to apply penalty to ${participant.countryId}:`, error);
        }
      }

      // Send notifications to participants
      for (const participant of exchange.participatingCountries) {
        try {
          // Note: Notification system would go here
          console.log(`Should notify ${participant.countryId} about cancellation`);
        } catch (error) {
          console.error(`Failed to notify ${participant.countryId}:`, error);
        }
      }

      return {
        success: true,
        penalties: {
          reputationLoss,
          relationshipPenalty,
          affectedCountries: participantCount,
        },
      };
    }),

  // Get NPC responses for cultural exchange using diplomatic AI
  getNPCCulturalResponses: publicProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        hostCountryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get the cultural exchange with all participant countries
        const exchange = await ctx.db.culturalExchange.findUnique({
          where: { id: input.exchangeId },
          include: {
            participatingCountries: true,
          },
        });

        if (!exchange) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cultural exchange not found",
          });
        }

        // Get all participants (excluding the host)
        const participants = exchange.participatingCountries.filter(
          (p: { countryId: string }) => p.countryId !== input.hostCountryId
        );

        if (participants.length === 0) {
          return [];
        }

        // Generate NPC responses for each participant
        const responses = await Promise.all(
          participants.map(async (participant) => {
            try {
              // Get relationship data for NPC personality calculation
              const relationships = await ctx.db.diplomaticRelation.findMany({
                where: {
                  OR: [{ country1: participant.countryId }, { country2: participant.countryId }],
                },
              });

              const embassies = await ctx.db.embassy.findMany({
                where: {
                  OR: [
                    { guestCountryId: participant.countryId },
                    { hostCountryId: participant.countryId },
                  ],
                },
              });

              // Build observable data for personality calculation
              const observableData: ObservableData = {
                relationships: {
                  total: relationships.length,
                  allied: relationships.filter(
                    (r: { relationship: string }) => r.relationship === "alliance"
                  ).length,
                  friendly: relationships.filter(
                    (r: { relationship: string }) =>
                      r.relationship === "friendly" || r.relationship === "cooperative"
                  ).length,
                  tense: relationships.filter(
                    (r: { relationship: string }) =>
                      r.relationship === "cool" || r.relationship === "strained"
                  ).length,
                  hostile: relationships.filter(
                    (r: { relationship: string }) => r.relationship === "hostile"
                  ).length,
                  neutral: relationships.filter(
                    (r: { relationship: string }) => r.relationship === "neutral"
                  ).length,
                  averageStrength:
                    relationships.length > 0
                      ? relationships.reduce(
                          (sum: number, r: { strength: number }) => sum + r.strength,
                          0
                        ) / relationships.length
                      : 50,
                  deterioratingCount: 0, // Could track this in future
                },
                embassies: {
                  total: embassies.length,
                  culturalSpecialized: embassies.filter(
                    (e: { specialization: string | null }) => e.specialization === "cultural"
                  ).length,
                  economicSpecialized: embassies.filter(
                    (e: { specialization: string | null }) => e.specialization === "economic"
                  ).length,
                  securitySpecialized: embassies.filter(
                    (e: { specialization: string | null }) => e.specialization === "security"
                  ).length,
                  averageLevel:
                    embassies.length > 0
                      ? embassies.reduce((sum: number, e: { level: number }) => sum + e.level, 0) /
                        embassies.length
                      : 1,
                  averageInfluence:
                    embassies.length > 0
                      ? embassies.reduce(
                          (sum: number, e: { influence: number }) => sum + e.influence,
                          0
                        ) / embassies.length
                      : 50,
                },
                treaties: {
                  total: 0, // Would need treaty data
                  multilateral: 0,
                  defensive: 0,
                  trade: 0,
                  cultural: 0,
                },
                economic: {
                  totalTradeVolume: 0, // Would need trade data
                  highValuePartners: 0,
                  tradeTreatyCount: 0,
                  tradeGrowthTrend: 0,
                },
                cultural: {
                  highExchangeCount: relationships.filter(
                    (r: { culturalExchange: string | null }) => r.culturalExchange === "High"
                  ).length,
                  mediumExchangeCount: relationships.filter(
                    (r: { culturalExchange: string | null }) => r.culturalExchange === "Medium"
                  ).length,
                  culturalTreatyCount: 0,
                  totalExchangePrograms: 0, // Could calculate from cultural exchange data
                },
                historical: {
                  totalActions: Math.max(1, relationships.length + embassies.length),
                  cooperativeActions: relationships.filter(
                    (r: { relationship: string }) =>
                      r.relationship === "alliance" || r.relationship === "friendly"
                  ).length,
                  aggressiveActions: relationships.filter(
                    (r: { relationship: string }) =>
                      r.relationship === "hostile" || r.relationship === "strained"
                  ).length,
                  consistencyScore: 70, // Default moderate consistency
                  policyVolatility: 30, // Default moderate volatility
                },
              };

              // Calculate NPC personality
              const npcPersonality = NPCPersonalitySystem.calculatePersonality(
                participant.countryId,
                participant.countryName,
                observableData
              );

              // Get relationship with host country
              const relationshipWithHost = relationships.find(
                (r: any) =>
                  (r.country1 === participant.countryId && r.country2 === input.hostCountryId) ||
                  (r.country2 === participant.countryId && r.country1 === input.hostCountryId)
              );

              // Build participation context
              const participationContext: NPCParticipationContext = {
                npcCountryId: participant.countryId,
                npcCountryName: participant.countryName,
                npcPersonality,
                hostCountryId: input.hostCountryId,
                hostCountryName: exchange.hostCountryName,
                relationshipStrength: relationshipWithHost?.strength ?? 50,
                relationshipState: relationshipWithHost?.relationship ?? "neutral",
                exchangeType: exchange.type,
                exchangeDetails: {
                  title: exchange.title,
                  description: exchange.description || "",
                  culturalImpact: 50, // Default values - could calculate based on exchange type
                  diplomaticValue: 40,
                  economicCost: 25000,
                  duration: Math.ceil(
                    (new Date(exchange.endDate).getTime() -
                      new Date(exchange.startDate).getTime()) /
                      (1000 * 60 * 60 * 24)
                  ),
                },
                existingExchanges:
                  observableData.cultural.highExchangeCount +
                  observableData.cultural.mediumExchangeCount,
                historicalSuccess: 70, // Default - could track actual success rate
              };

              // Get AI-generated participation decision
              const decision = NPCCulturalParticipation.evaluateParticipation(participationContext);

              return {
                countryId: participant.countryId,
                countryName: participant.countryName,
                flagUrl: participant.flagUrl || "",
                role: participant.role,
                willParticipate: decision.willParticipate,
                enthusiasmLevel: decision.enthusiasmLevel,
                resourceCommitment: decision.resourceCommitment,
                confidence: decision.confidence,
                reasoning: decision.reasoning,
                conditions: decision.conditions,
                responseMessage: decision.responseMessage,
                responseTimeline: decision.responseTimeline,
                alternativeProposal: decision.alternativeProposal,
                personality: {
                  archetype: npcPersonality.archetype,
                  culturalOpenness: npcPersonality.traits.culturalOpenness,
                  cooperativeness: npcPersonality.traits.cooperativeness,
                  assertiveness: npcPersonality.traits.assertiveness,
                },
              };
            } catch (error) {
              console.error(`Error generating NPC response for ${participant.countryId}:`, error);
              // Return default response if AI generation fails
              return {
                countryId: participant.countryId,
                countryName: participant.countryName,
                flagUrl: participant.flagUrl || "",
                role: participant.role,
                willParticipate: true,
                enthusiasmLevel: 60,
                resourceCommitment: 50,
                confidence: 50,
                reasoning: ["Default response due to calculation error"],
                responseMessage: `${participant.countryName} is evaluating this cultural exchange opportunity.`,
                responseTimeline: "short_term" as const,
                personality: {
                  archetype: "Pragmatic Realist",
                  culturalOpenness: 60,
                  cooperativeness: 60,
                  assertiveness: 50,
                },
              };
            }
          })
        );

        return responses;
      } catch (error) {
        console.error("Error getting NPC cultural responses:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get NPC cultural responses",
          cause: error,
        });
      }
    }),

  /**
   * Get diplomatic options from database with fallback to hardcoded values
   * Supports filtering by type and category
   */
  getDiplomaticOptions: publicProcedure
    .input(
      z.object({
        type: z.enum(["strategic_priority", "partnership_goal", "key_achievement"]).optional(),
        category: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Build where clause for filtering
        const where: {
          type?: string;
          category?: string;
          isActive: boolean;
        } = {
          isActive: true,
        };

        if (input.type) {
          where.type = input.type;
        }

        if (input.category) {
          where.category = input.category;
        }

        // Fetch from database
        const dbOptions = await ctx.db.diplomaticOption.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
        });

        // If database has options, return them
        if (dbOptions.length > 0) {
          return dbOptions.map((opt) => ({
            id: opt.id,
            type: opt.type,
            value: opt.value,
            category: opt.category,
            description: opt.description,
            sortOrder: opt.sortOrder,
          }));
        }

        // Fallback to hardcoded values if database is empty
        const getFallbackOptions = () => {
          const allOptions: Array<{ type: string; value: string; category?: string }> = [];

          // Add strategic priorities
          if (!input.type || input.type === "strategic_priority") {
            STRATEGIC_PRIORITIES.forEach((priority) => {
              allOptions.push({
                type: "strategic_priority",
                value: priority,
                category: determineCategoryFromValue(priority),
              });
            });
          }

          // Add partnership goals
          if (!input.type || input.type === "partnership_goal") {
            PARTNERSHIP_GOALS.forEach((goal) => {
              allOptions.push({
                type: "partnership_goal",
                value: goal,
                category: determineCategoryFromValue(goal),
              });
            });
          }

          // Add key achievements
          if (!input.type || input.type === "key_achievement") {
            KEY_ACHIEVEMENTS.forEach((achievement) => {
              allOptions.push({
                type: "key_achievement",
                value: achievement,
                category: determineCategoryFromValue(achievement),
              });
            });
          }

          // Filter by category if specified
          if (input.category) {
            return allOptions.filter((opt) => opt.category === input.category);
          }

          return allOptions;
        };

        return getFallbackOptions();
      } catch (error) {
        console.error("Error fetching diplomatic options:", error);
        // On error, fall back to hardcoded values
        const fallbackOptions: Array<{ type: string; value: string; category?: string }> = [];

        if (!input.type || input.type === "strategic_priority") {
          STRATEGIC_PRIORITIES.forEach((priority) => {
            fallbackOptions.push({
              type: "strategic_priority",
              value: priority,
              category: determineCategoryFromValue(priority),
            });
          });
        }

        if (!input.type || input.type === "partnership_goal") {
          PARTNERSHIP_GOALS.forEach((goal) => {
            fallbackOptions.push({
              type: "partnership_goal",
              value: goal,
              category: determineCategoryFromValue(goal),
            });
          });
        }

        if (!input.type || input.type === "key_achievement") {
          KEY_ACHIEVEMENTS.forEach((achievement) => {
            fallbackOptions.push({
              type: "key_achievement",
              value: achievement,
              category: determineCategoryFromValue(achievement),
            });
          });
        }

        if (input.category) {
          return fallbackOptions.filter((opt) => opt.category === input.category);
        }

        return fallbackOptions;
      }
    }),

  /**
   * Get all active diplomatic options across all types
   * Useful for admin interfaces or bulk operations
   */
  getAllDiplomaticOptions: publicProcedure.query(async ({ ctx }) => {
    try {
      // Fetch all active options from database
      const dbOptions = await ctx.db.diplomaticOption.findMany({
        where: { isActive: true },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { value: "asc" }],
      });

      // If database has options, return them grouped by type
      if (dbOptions.length > 0) {
        const grouped = {
          strategic_priority: dbOptions.filter((opt) => opt.type === "strategic_priority"),
          partnership_goal: dbOptions.filter((opt) => opt.type === "partnership_goal"),
          key_achievement: dbOptions.filter((opt) => opt.type === "key_achievement"),
        };

        return {
          strategicPriorities: grouped.strategic_priority.map((opt) => opt.value),
          partnershipGoals: grouped.partnership_goal.map((opt) => opt.value),
          keyAchievements: grouped.key_achievement.map((opt) => opt.value),
          source: "database" as const,
        };
      }

      // Fallback to hardcoded values
      return {
        strategicPriorities: Array.from(STRATEGIC_PRIORITIES),
        partnershipGoals: Array.from(PARTNERSHIP_GOALS),
        keyAchievements: Array.from(KEY_ACHIEVEMENTS),
        source: "fallback" as const,
      };
    } catch (error) {
      console.error("Error fetching all diplomatic options:", error);
      // On error, return hardcoded values
      return {
        strategicPriorities: Array.from(STRATEGIC_PRIORITIES),
        partnershipGoals: Array.from(PARTNERSHIP_GOALS),
        keyAchievements: Array.from(KEY_ACHIEVEMENTS),
        source: "fallback" as const,
      };
    }
  }),

  /**
   * Get analytics on diplomatic option usage
   * Admin-only endpoint for understanding option popularity and usage patterns
   */
  getOptionUsageStats: adminProcedure.query(async ({ ctx }) => {
    try {
      // Get all options with usage counts
      const options = await ctx.db.diplomaticOption.findMany({
        include: {
          usage: {
            where: { removedAt: null },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Calculate usage counts
      const optionsWithStats = options.map((option) => ({
        id: option.id,
        type: option.type,
        value: option.value,
        category: option.category,
        isActive: option.isActive,
        currentUsageCount: option.usage.length,
        createdAt: option.createdAt,
      }));

      // Get top 10 most used options
      const topOptions = [...optionsWithStats]
        .sort((a, b) => b.currentUsageCount - a.currentUsageCount)
        .slice(0, 10);

      // Get least used options (candidates for deprecation)
      const leastUsedOptions = optionsWithStats
        .filter((opt) => opt.isActive)
        .sort((a, b) => a.currentUsageCount - b.currentUsageCount)
        .slice(0, 10);

      // Get usage by category
      const categoryStats = optionsWithStats.reduce(
        (acc, option) => {
          const cat = option.category || "Uncategorized";
          if (!acc[cat]) {
            acc[cat] = { count: 0, totalUsage: 0 };
          }
          acc[cat].count++;
          acc[cat].totalUsage += option.currentUsageCount;
          return acc;
        },
        {} as Record<string, { count: number; totalUsage: number }>
      );

      // Get usage by type
      const typeStats = optionsWithStats.reduce(
        (acc, option) => {
          if (!acc[option.type]) {
            acc[option.type] = { count: 0, totalUsage: 0 };
          }
          acc[option.type].count++;
          acc[option.type].totalUsage += option.currentUsageCount;
          return acc;
        },
        {} as Record<string, { count: number; totalUsage: number }>
      );

      // Get usage trends over last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUsage = await ctx.db.diplomaticOptionUsage.findMany({
        where: {
          selectedAt: {
            gte: thirtyDaysAgo,
          },
        },
        orderBy: { selectedAt: "asc" },
      });

      // Group by day
      const usageByDay = recentUsage.reduce(
        (acc, usage) => {
          const day = usage.selectedAt.toISOString().split("T")[0]!;
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Get total statistics
      const totalOptions = options.length;
      const activeOptions = options.filter((o) => o.isActive).length;
      const totalUsageRecords = await ctx.db.diplomaticOptionUsage.count({
        where: { removedAt: null },
      });

      return {
        summary: {
          totalOptions,
          activeOptions,
          inactiveOptions: totalOptions - activeOptions,
          totalCurrentUsage: totalUsageRecords,
        },
        topOptions,
        leastUsedOptions,
        categoryStats,
        typeStats,
        usageTrends: Object.entries(usageByDay).map(([date, count]) => ({
          date,
          count,
        })),
      };
    } catch (error) {
      console.error("Error fetching option usage stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch option usage statistics",
      });
    }
  }),
});

// Helper function to determine category from option value
function determineCategoryFromValue(value: string): string {
  const lowerValue = value.toLowerCase();

  // Economic & Trade keywords
  if (
    lowerValue.includes("economic") ||
    lowerValue.includes("trade") ||
    lowerValue.includes("investment") ||
    lowerValue.includes("market") ||
    lowerValue.includes("financial") ||
    lowerValue.includes("agricultural")
  ) {
    return "Economic";
  }

  // Military & Security keywords
  if (
    lowerValue.includes("military") ||
    lowerValue.includes("defense") ||
    lowerValue.includes("security") ||
    lowerValue.includes("intelligence") ||
    lowerValue.includes("counter-terrorism") ||
    lowerValue.includes("border") ||
    lowerValue.includes("maritime") ||
    lowerValue.includes("cybersecurity")
  ) {
    return "Military";
  }

  // Technology & Innovation keywords
  if (
    lowerValue.includes("technology") ||
    lowerValue.includes("research") ||
    lowerValue.includes("innovation") ||
    lowerValue.includes("digital") ||
    lowerValue.includes("space") ||
    lowerValue.includes("artificial intelligence") ||
    lowerValue.includes("telecommunications") ||
    lowerValue.includes("ai ")
  ) {
    return "Technology";
  }

  // Cultural & Social keywords
  if (
    lowerValue.includes("cultural") ||
    lowerValue.includes("educational") ||
    lowerValue.includes("scientific") ||
    lowerValue.includes("healthcare") ||
    lowerValue.includes("sports") ||
    lowerValue.includes("media") ||
    lowerValue.includes("student") ||
    lowerValue.includes("scholar") ||
    lowerValue.includes("artist") ||
    lowerValue.includes("festival") ||
    lowerValue.includes("language") ||
    lowerValue.includes("heritage")
  ) {
    return "Cultural";
  }

  // Environmental & Energy keywords
  if (
    lowerValue.includes("climate") ||
    lowerValue.includes("energy") ||
    lowerValue.includes("renewable") ||
    lowerValue.includes("environmental") ||
    lowerValue.includes("sustainable") ||
    lowerValue.includes("water") ||
    lowerValue.includes("conservation") ||
    lowerValue.includes("emission") ||
    lowerValue.includes("circular economy")
  ) {
    return "Environmental";
  }

  // Diplomatic & Political keywords
  if (
    lowerValue.includes("diplomatic") ||
    lowerValue.includes("regional") ||
    lowerValue.includes("humanitarian") ||
    lowerValue.includes("conflict") ||
    lowerValue.includes("democratic") ||
    lowerValue.includes("governance") ||
    lowerValue.includes("embassy") ||
    lowerValue.includes("consulate") ||
    lowerValue.includes("ambassadorial") ||
    lowerValue.includes("state visit") ||
    lowerValue.includes("summit") ||
    lowerValue.includes("partnership") ||
    lowerValue.includes("crisis") ||
    lowerValue.includes("mediation") ||
    lowerValue.includes("refugee")
  ) {
    return "Diplomatic";
  }

  // Default category
  return "General";
}

// Helper functions for embassy game mechanics
function getUpgradeEffects(upgradeType: string, level: number) {
  const effects: Record<string, any> = {};

  switch (upgradeType) {
    case "staff_expansion":
      effects.maxStaff = level * 2;
      effects.maxMissions = Math.ceil(level / 2);
      break;
    case "security_enhancement":
      effects.securityLevel = level;
      effects.missionSuccessBonus = level * 5;
      break;
    case "tech_upgrade":
      effects.efficiencyBonus = level * 10;
      effects.informationGatheringBonus = level * 15;
      break;
    case "facility_expansion":
      effects.capacityBonus = level * 20;
      effects.reputationBonus = level * 5;
      break;
    case "specialization_improvement":
      effects.specializationBonus = level * 25;
      effects.specializedMissionBonus = level * 20;
      break;
  }

  return effects;
}

function generateAvailableMissions(embassy: any) {
  const missions = [
    {
      id: "trade_negotiation_1",
      type: "trade_negotiation",
      name: "Local Trade Agreement",
      description: "Negotiate trade partnerships with local businesses",
      difficulty: "easy",
      duration: 5,
      cost: 2000,
      rewards: { experience: 100, influence: 5, economic: 15000 },
      requirements: { level: 1, staff: 1 },
    },
    {
      id: "cultural_outreach_1",
      type: "cultural_outreach",
      name: "Cultural Festival Participation",
      description: "Organize embassy participation in local cultural events",
      difficulty: "easy",
      duration: 3,
      cost: 1500,
      rewards: { experience: 75, reputation: 8, influence: 3 },
      requirements: { level: 1, staff: 2 },
    },
    {
      id: "intelligence_gathering_1",
      type: "intelligence_gathering",
      name: "Economic Intelligence Report",
      description: "Gather intelligence on local economic conditions",
      difficulty: "medium",
      duration: 7,
      cost: 3000,
      rewards: { experience: 150, influence: 8, economic: 5000 },
      requirements: { level: 2, staff: 2, specialization: "intelligence" },
    },
  ];

  return missions.filter(
    (mission) =>
      embassy.level >= mission.requirements.level &&
      embassy.staffCount >= mission.requirements.staff &&
      (!mission.requirements.specialization ||
        embassy.specialization === mission.requirements.specialization)
  );
}

function getMissionData(type: string, embassyLevel: number, priority: string) {
  const baseData = {
    trade_negotiation: {
      name: "Trade Negotiation Mission",
      description: "Negotiate beneficial trade agreements",
      difficulty: "medium",
      baseDuration: 7,
      cost: 2500,
      experienceReward: 120,
      influenceReward: 6,
      reputationReward: 4,
      economicReward: 18000,
    },
    intelligence_gathering: {
      name: "Intelligence Gathering Operation",
      description: "Collect strategic intelligence information",
      difficulty: "hard",
      baseDuration: 10,
      cost: 4000,
      experienceReward: 200,
      influenceReward: 10,
      reputationReward: 2,
      economicReward: 8000,
    },
    cultural_outreach: {
      name: "Cultural Outreach Program",
      description: "Strengthen cultural ties with local community",
      difficulty: "easy",
      baseDuration: 5,
      cost: 1800,
      experienceReward: 80,
      influenceReward: 4,
      reputationReward: 12,
      economicReward: 3000,
    },
    security_cooperation: {
      name: "Security Cooperation Initiative",
      description: "Collaborate on security matters",
      difficulty: "hard",
      baseDuration: 12,
      cost: 5000,
      experienceReward: 250,
      influenceReward: 15,
      reputationReward: 8,
      economicReward: 12000,
    },
    research_collaboration: {
      name: "Research Collaboration Project",
      description: "Joint research initiative with local institutions",
      difficulty: "expert",
      baseDuration: 14,
      cost: 6000,
      experienceReward: 300,
      influenceReward: 12,
      reputationReward: 15,
      economicReward: 25000,
    },
  };

  const data = baseData[type as keyof typeof baseData];
  const levelMultiplier = 1 + (embassyLevel - 1) * 0.2;

  return {
    ...data,
    cost: Math.round(data.cost * levelMultiplier),
    experienceReward: Math.round(data.experienceReward * levelMultiplier),
    economicReward: Math.round(data.economicReward * levelMultiplier),
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
}

// Influence and Relationship Mechanics
function calculateInfluenceGain(
  missionType: string,
  success: boolean,
  embassyLevel: number
): number {
  const baseInfluence =
    {
      TRADE_NEGOTIATION: 50,
      CULTURAL_EXCHANGE: 30,
      INTELLIGENCE_GATHERING: 20,
      CRISIS_MANAGEMENT: 80,
      ECONOMIC_COOPERATION: 60,
    }[missionType] || 25;

  let multiplier = success ? 1.0 : 0.3; // Reduced gain on failure
  multiplier *= 1 + (embassyLevel - 1) * 0.2; // 20% bonus per level above 1

  return Math.floor(baseInfluence * multiplier);
}

function calculateRelationshipImpact(influenceChange: number, currentRelationship: string): number {
  // Relationship impact based on influence gain
  let baseImpact = Math.floor(influenceChange / 10);

  // Diminishing returns for already strong relationships
  const relationshipMultiplier =
    {
      alliance: 0.5,
      trade: 0.7,
      neutral: 1.0,
      tension: 1.5, // Easier to improve from tension
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
