import type { DiplomaticRelationDto } from "~/shared/types/diplomacy.dto";
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
import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";

import { normalizeFlagUrl } from "~/lib/unified-flag-service";

// Helper functions for cultural exchange <-> embassy mission integration

/**
 * Calculate cultural exchange bonus from completed embassy missions
 * Returns percentage boost based on number of completed missions
 * @param completedMissionCount - Number of completed cultural_outreach missions
 * @returns Object with cultural impact and diplomatic value bonus percentages
 */
function _calculateMissionCulturalBonus(completedMissionCount: number) {
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
function _getCulturalExchangeBoostValues(culturalImpact = 15, diplomaticValue = 10) {
  return {
    culturalImpactBoost: culturalImpact,
    diplomaticValueBoost: diplomaticValue,
    reasoning: `Completed embassy mission boosts exchange by +${culturalImpact} cultural impact and +${diplomaticValue} diplomatic value`,
  };
}

export const diplomaticCoreRouter = createTRPCRouter({
  // Get diplomatic relationships for a country
  getRelationships: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }): Promise<DiplomaticRelationDto[]> => {
      try {
        // Get live diplomatic relations from database
        const relations = await ctx.db.diplomaticRelation.findMany({
          where: {
            OR: [{ country1: input.countryId }, { country2: input.countryId }],
          },
          orderBy: [{ strength: "desc" }, { lastContact: "desc" }],
        });

        // Batch-lookup country names and flags for all referenced countries
        const allCountryIds = [...new Set(relations.flatMap((r) => [r.country1, r.country2]))];
        const countries = await ctx.db.country.findMany({
          where: { id: { in: allCountryIds } },
          select: { id: true, name: true, flag: true },
        });
        const countryMap = new Map(countries.map((c) => [c.id, c]));

        // Transform relations to match expected format
        const transformedRelations = relations.map((relation) => {
          const targetId =
            relation.country1 === input.countryId ? relation.country2 : relation.country1;
          const targetInfo = countryMap.get(targetId);

          return {
            id: relation.id,
            targetCountry: targetInfo?.name ?? targetId,
            targetCountryId: targetId,
            targetCountryName: targetInfo?.name ?? targetId,
            targetCountryFlag: normalizeFlagUrl(targetInfo?.flag) ?? null,
            relationship: relation.relationship as any,
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
            activePolicies: [],
            recentIncidents: [],
            establishedAt: relation.establishedAt.toISOString(),
          };
        });

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

        // Run all 5 independent queries in parallel
        const [diplomaticEvents, recentEmbassies, recentMissions, recentExchanges, recentTreaties] =
          await Promise.all([
            ctx.db.diplomaticEvent.findMany({
              where: {
                OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
                createdAt: { gte: cutoffDate },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            }),
            ctx.db.embassy.findMany({
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
            }),
            ctx.db.embassyMission.findMany({
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
            }),
            ctx.db.culturalExchange.findMany({
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
            }),
            ctx.db.treaty.findMany({
              where: {
                parties: { contains: input.countryId },
                updatedAt: { gte: cutoffDate },
              },
              orderBy: { updatedAt: "desc" },
              take: 10,
            }),
          ]);

        // Fetch country names for diplomatic events
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
          const targetCountryId =
            event.country1Id === input.countryId ? event.country2Id : event.country1Id;

          changes.push({
            id: event.id,
            targetCountry: (targetCountryId && countryMap.get(targetCountryId)) || "Unknown",
            currentStatus: event.eventType,
            updatedAt: event.createdAt.toISOString(),
            changeType: event.eventType,
            description: event.description,
          });
        }

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

  // Diplomatic messaging has been unified into ThinkShare (/messages).
  // Use api.messages.getConversationsByFolder with folder="diplomatic" instead.
  // Use api.messages.sendMessage with conversationType="diplomatic" instead.

  // Cultural Exchanges

  // Link existing cultural exchange to an embassy mission

  // Embassy Game System Endpoints

  // Embassy Management

  // Embassy Upgrades

  // Embassy Missions

  // Embassy Economics

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

      const _updated = await ctx.db.diplomaticRelation.update({
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
      take: 250,
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
          select: { name: true, slug: true },
        });

        await notificationAPI.create({
          title: "👁️ New Country Following",
          message: `${followerCountry?.name || "A country"} is now following your country`,
          countryId: input.followedCountryId,
          category: "social",
          priority: "low",
          type: "info",
          href: followerCountry?.slug
            ? `/countries/${followerCountry.slug}`
            : `/countries/${input.followerCountryId}`,
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
          } catch (_error) {
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
          const _completedResearchCount = researchMissions.filter(
            (m) => m.status === "completed"
          ).length;
          const _activeResearchCount = researchMissions.filter((m) => m.status === "active").length;

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
    .mutation(async ({ ctx, input: _input }) => {
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

  // Get cultural compatibility scores for a country with all other countries

  // Get recommended diplomatic partners based on cultural compatibility

  // Update cultural exchange (only title and description)

  // Cancel cultural exchange (with diplomatic penalties)

  // Get NPC responses for cultural exchange using diplomatic AI

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

  // ============================================================
  // Foreign Policy Actions (Phase 2)
  // ============================================================

  // Get active foreign policies for a country (as initiator or target)

  // Get bilateral trade data between two countries

  // Preview the economic impact of a foreign policy action before confirming

  // Propose / enact a foreign policy action

  // Lift / end an active foreign policy action

  // ============================================================
  // Alliance / Bloc System (Phase 3)
  // ============================================================

  // Get alliances a country belongs to

  // Get a single alliance dashboard

  // Create a new alliance

  // Invite a country to join an alliance

  // Leave an alliance

  // Propose an alliance action (collective sanction, shared defense, etc.)

  // Vote on an alliance action

  // Create an alliance document

  // Get documents for an alliance

  // Get active embassy missions for a country
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

function getMissionData(type: string, embassyLevel: number, _priority: string) {
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
function _calculateInfluenceGain(
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
  const baseImpact = Math.floor(influenceChange / 10);

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
