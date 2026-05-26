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

export const diplomaticCulturalRouter = createTRPCRouter({
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
      } catch (_error) {
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

  // Embassy Upgrades

  // Embassy Missions

  // Embassy Economics

  // Influence and Relationship Management Procedures

  // Follow/Unfollow system for countries

  // Embassy Shared Data System

  // Embassy Profile Management

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
      const { CulturalScenarioGenerator, CULTURAL_SCENARIO_TEMPLATES } =
        await import("~/lib/cultural-scenario-generator");

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
            flagUrl: normalizeFlagUrl(sourceCountry.flag),
          };

          const country2Info: CountryBasicInfo = {
            id: targetCountry.id,
            name: targetCountry.name,
            economicTier: targetCountry.economicTier,
            continent: targetCountry.continent || undefined,
            flagUrl: normalizeFlagUrl(targetCountry.flag),
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
            flagUrl: normalizeFlagUrl(targetCountry.flag) || "",
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
            flagUrl: normalizeFlagUrl(sourceCountry.flag),
          };

          const country2Info: CountryBasicInfo = {
            id: targetCountry.id,
            name: targetCountry.name,
            economicTier: targetCountry.economicTier,
            continent: targetCountry.continent || undefined,
            flagUrl: normalizeFlagUrl(targetCountry.flag),
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
            flagUrl: normalizeFlagUrl(targetCountry.flag) || "",
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
