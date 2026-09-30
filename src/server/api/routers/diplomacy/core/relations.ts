import type { DiplomaticRelationDto } from "~/types/diplomacy.dto";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { groupIncidentsByCountry } from "~/lib/diplomacy/incidents";

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

        // Batch-fetch recent diplomatic events for the viewer (one query, not per relation)
        const events = await ctx.db.diplomaticEvent.findMany({
          where: { OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }] },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            country1Id: true,
            country2Id: true,
            eventType: true,
            title: true,
            severity: true,
          },
        });
        const incidentsByCountry = groupIncidentsByCountry(events, input.countryId);

        // Transform relations to match expected format
        const transformedRelations = relations.map((relation) => {
          const targetId =
            relation.country1 === input.countryId ? relation.country2 : relation.country1;
          const targetInfo = countryMap.get(targetId);

          const isCountry1 = relation.country1 === input.countryId;
          const goalSelf = isCountry1 ? relation.goalCountry1 : relation.goalCountry2;
          const goalTarget = isCountry1 ? relation.goalCountry2 : relation.goalCountry1;

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
            recentIncidents: incidentsByCountry.get(targetId) ?? [],
            establishedAt: relation.establishedAt.toISOString(),
            goalSelf,
            goalTarget,
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

  // Set diplomatic goal (Stance)
  setDiplomaticGoal: protectedProcedure
    .input(
      z.object({
        relationId: z.string(),
        goal: z.enum(["ALLY", "COEXIST", "HEGEMONY", "RIVAL"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to update diplomatic goals.",
        });
      }

      const relation = await ctx.db.diplomaticRelation.findUnique({
        where: { id: input.relationId },
      });

      if (!relation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Diplomatic relationship not found.",
        });
      }

      const isCountry1 = relation.country1 === ctx.user.countryId;
      const isCountry2 = relation.country2 === ctx.user.countryId;

      if (!isCountry1 && !isCountry2) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update this relationship's goals.",
        });
      }

      const updateData: any = {};
      if (isCountry1) {
        updateData.goalCountry1 = input.goal;
      } else {
        updateData.goalCountry2 = input.goal;
      }

      return await ctx.db.diplomaticRelation.update({
        where: { id: input.relationId },
        data: updateData,
      });
    }),
});
