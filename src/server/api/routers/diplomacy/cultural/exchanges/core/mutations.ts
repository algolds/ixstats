import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { DiplomaticChoiceTracker } from "~/lib/diplomatic-choice-tracker";

import { vaultService } from "~/lib/vault-service";

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

export const diplomaticCulturalExchangesCoreMutationsRouter = createTRPCRouter({
  // Get diplomatic relationships for a country

  // Get recent diplomatic changes

  // Update diplomatic relationship

  // Create a new diplomatic relationship

  // Delete/terminate a diplomatic relationship

  // Embassy Network Operations

  // Diplomatic messaging has been unified into ThinkShare (/messages).
  // Use api.messages.getConversationsByFolder with folder="diplomatic" instead.
  // Use api.messages.sendMessage with conversationType="diplomatic" instead.

  // Cultural Exchanges

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
              flagUrl: normalizeFlagUrl(participantCountry.flag),
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

          // Shared mission parameters — identical for every embassy, so compute once
          // and batch-insert with createMany instead of N individual create() calls. (audit B3)
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
              ixTimeStarted: ixTimeNow,
              ixTimeCompletes: ixTimeNow + duration * 2, // IxTime runs 2x faster
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

  // Embassy Game System Endpoints

  // Embassy Management

  // Embassy Upgrades

  // Embassy Missions

  // Embassy Economics

  // Influence and Relationship Management Procedures

  // Follow/Unfollow system for countries

  // Embassy Shared Data System

  // Embassy Profile Management

  // Get cultural compatibility scores for a country with all other countries

  // Get recommended diplomatic partners based on cultural compatibility

  // Update cultural exchange (only title and description)

  // Cancel cultural exchange (with diplomatic penalties)

  // Get NPC responses for cultural exchange using diplomatic AI

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
// Helper functions for embassy game mechanics
// Influence and Relationship Mechanics
