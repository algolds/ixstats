import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { clockTimeAt } from "~/lib/realms/realm-time-convert";
import { clockForCountry } from "~/server/shared/realm-time";
import { DiplomaticChoiceTracker } from "~/lib/diplomacy/choice-tracker";

import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { assertSameRealm } from "~/server/shared/same-realm-guard";

/** Joining needs a running public exchange the nation is not hosting or in already, with room left. */
function assertJoinable(
  exchange: {
    status: string;
    isPublic: boolean;
    maxParticipants: number | null;
    hostCountryId: string;
    participatingCountries: Array<{ countryId: string }>;
  } | null,
  countryId: string
): asserts exchange {
  if (!exchange) throw new TRPCError({ code: "NOT_FOUND", message: "Cultural exchange not found" });
  const refusal =
    exchange.status !== "active"
      ? "This exchange is not running."
      : !exchange.isPublic
        ? "This exchange is invitation only."
        : exchange.hostCountryId === countryId
          ? "You are hosting this exchange."
          : exchange.participatingCountries.some((p) => p.countryId === countryId)
            ? "Your nation is already taking part."
            : exchange.maxParticipants !== null &&
                exchange.participatingCountries.length >= exchange.maxParticipants
              ? "This exchange is full."
              : null;
  if (refusal) throw new TRPCError({ code: "BAD_REQUEST", message: refusal });
}

export const diplomaticCulturalExchangesCoreMutationsRouter = createTRPCRouter({
  createCulturalExchange: rateLimitedMutationProcedure
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
        /** Several specific nations to take part (with or alongside `participantCountryId`). */
        participantCountryIds: z.array(z.string()).max(50).optional(),
        startDate: z.string(),
        endDate: z.string(),
        autoCreateMissions: z.boolean().optional().default(true),
        embassyMissionId: z.string().optional(), // Link to existing embassy mission
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.hostCountryId);
      // Every named participant, once, never the host.
      const participantIds = [
        ...new Set([
          ...(input.participantCountryId ? [input.participantCountryId] : []),
          ...(input.participantCountryIds ?? []),
        ]),
      ].filter((id) => id !== input.hostCountryId);
      if (input.maxParticipants != null && participantIds.length > input.maxParticipants) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You invited ${participantIds.length} nations; the exchange allows ${input.maxParticipants}.`,
        });
      }
      for (const id of participantIds) {
        await assertSameRealm(ctx.db, input.hostCountryId, id);
      }

      // Validate embassy mission if provided
      if (input.embassyMissionId) {
        const mission = await ctx.db.embassyMission.findUnique({
          where: { id: input.embassyMissionId },
          include: {
            embassy: {
              select: {
                id: true,
                hostCountryId: true,
                guestCountryId: true,
                name: true,
                influence: true,
                status: true,
              },
            },
          },
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

      // The host nation's clock; every nation in the exchange shares its realm.
      const hostClock = await clockForCountry(ctx.db, input.hostCountryId);
      const hostNow = hostClock.now();

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
          ixTimeContext: hostNow,
          status: "planning",
        },
      });

      // A participant record for each named participant country that exists
      let participantCount = 0;
      for (const participantId of participantIds) {
        const participantCountry = await ctx.db.country.findUnique({
          where: { id: participantId },
          select: { name: true, flag: true },
        });
        if (!participantCountry) continue;

        await ctx.db.culturalExchangeParticipant.create({
          data: {
            exchangeId: exchange.id,
            countryId: participantId,
            countryName: participantCountry.name,
            flagUrl: normalizeFlagUrl(participantCountry.flag),
            role: "participant",
          },
        });
        participantCount++;
      }
      if (participantCount > 0) {
        await ctx.db.culturalExchange.update({
          where: { id: exchange.id },
          data: { participants: participantCount },
        });
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
        ixTimeTimestamp: hostNow,
      });

      // Auto-create cultural_outreach embassy missions if enabled
      if (input.autoCreateMissions) {
        try {
          // The host's active embassies in nations of its own realm (one from before the realm rule gets no mission)
          const embassies = await ctx.db.embassy.findMany({
            where: {
              guestCountryId: input.hostCountryId,
              status: "active",
              hostCountry: { realmId: hostClock.realmId },
            },
          });

          // Shared mission parameters — identical for every embassy, so compute once
          // and batch-insert with createMany instead of N individual create() calls. (audit B3)
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

          await ctx.db.embassyMission.createMany({
            data: embassies.map((embassy) => ({
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
              ixTimeStarted: hostNow,
              // When the mission completes in real time, read on the host nation's clock (its own speed).
              ixTimeCompletes: clockTimeAt(hostClock, completesAt.getTime()),
              culturalExchangeId: exchange.id,
            })),
          });
        } catch (error) {
          console.error(
            "[Diplomatic] Failed to auto-create embassy missions for cultural exchange:",
            error
          );
          // Don't fail the whole operation if mission creation fails
        }
      }

      return exchange;
    }),

  joinCulturalExchange: rateLimitedMutationProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        countryId: z.string(),
        countryName: z.string(),
        flagUrl: z.string().optional(),
        // Co-hosts are the host's to name; a joiner takes part or observes
        role: z.enum(["participant", "observer"]).default("participant"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
        select: {
          title: true,
          type: true,
          status: true,
          isPublic: true,
          maxParticipants: true,
          hostCountryId: true,
          hostCountryName: true,
          participatingCountries: { select: { countryId: true } },
        },
      });
      assertJoinable(exchange, input.countryId);
      await assertSameRealm(ctx.db, input.countryId, exchange.hostCountryId);

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
        ixTimeTimestamp: (await clockForCountry(ctx.db, input.countryId)).now(),
      });

      return participant;
    }),
});
