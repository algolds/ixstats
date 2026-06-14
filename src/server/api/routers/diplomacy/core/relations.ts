import type { DiplomaticRelationDto } from "~/shared/types/diplomacy.dto";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { normalizeFlagUrl } from "~/lib/unified-flag-service";

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticCoreRelationsRouter = createTRPCRouter({
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
});
