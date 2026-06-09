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

export const diplomaticEmbassiesRouter = createTRPCRouter({
  // Get diplomatic relationships for a country

  // Get recent diplomatic changes

  // Update diplomatic relationship

  // Create a new diplomatic relationship

  // Delete/terminate a diplomatic relationship

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
          hostCountryFlag: normalizeFlagUrl(embassy.hostCountry?.flag) ?? null,
          hostCountrySlug: embassy.hostCountry?.slug ?? null,
          guestCountry: embassy.guestCountry?.name ?? "Unknown",
          guestCountryFlag: normalizeFlagUrl(embassy.guestCountry?.flag) ?? null,
          guestCountrySlug: embassy.guestCountry?.slug ?? null,
          countryId: partnerCountry?.id ?? null,
          country: partnerCountry?.name ?? "Unknown",
          countryFlag: normalizeFlagUrl(partnerCountry?.flag) ?? null,
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

  // Diplomatic messaging has been unified into ThinkShare (/messages).
  // Use api.messages.getConversationsByFolder with folder="diplomatic" instead.
  // Use api.messages.sendMessage with conversationType="diplomatic" instead.

  // Cultural Exchanges

  // Link existing cultural exchange to an embassy mission

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
          hostCountry: { select: { name: true } },
          guestCountry: { select: { name: true } },
        },
      });

      if (!embassy) throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });

      return {
        ...embassy,
        hostCountryName: embassy.hostCountry?.name,
        guestCountryName: embassy.guestCountry?.name,
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
      const baseCost = 100000;

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
          console.warn(
            `[Diplomatic] Failed to award credits for mission ${mission.id}:`,
            creditResult.message
          );
        } else {
          console.log(
            `[Diplomatic] Awarded ${creditsEarned} IxC to user ${ctx.user.id} for completing mission ${mission.id}`
          );
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

  // Follow/Unfollow system for countries

  // Embassy Shared Data System

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

  reopenEmbassy: protectedProcedure
    .input(
      z.object({
        embassyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to reopen embassies.",
        });
      }

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
          message: "You can only reopen your own embassies.",
        });
      }

      if (embassy.status !== "closed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Embassy is not closed.",
        });
      }

      const reopenedEmbassy = await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          status: "active",
        },
      });

      // Create diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: embassy.guestCountryId,
          country2Id: embassy.hostCountryId,
          eventType: "embassy_reopened",
          title: "Embassy Reopened",
          description: `${embassy.name} has been reopened.`,
          embassyId: embassy.id,
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
          relationshipImpact: 5,
          severity: "positive",
        },
      });

      // Notify host country
      try {
        await notificationAPI.create({
          title: "🏛️ Embassy Reopened",
          message: `${embassy.guestCountry?.name || "A country"} has reopened ${embassy.name}`,
          countryId: embassy.hostCountryId,
          category: "diplomatic",
          priority: "medium",
          href: "/diplomatic",
          source: "diplomatic-system",
          actionable: true,
          metadata: { embassyId: embassy.id, guestCountryId: embassy.guestCountryId },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send embassy reopen notification:", error);
      }

      return {
        success: true,
        embassy: reopenedEmbassy,
      };
    }),

  deleteEmbassy: protectedProcedure
    .input(
      z.object({
        embassyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to sever relations.",
        });
      }

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

      if (
        embassy.guestCountryId !== ctx.user.countryId &&
        embassy.hostCountryId !== ctx.user.countryId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only sever relations for your own embassies.",
        });
      }

      // Delete the embassy
      await ctx.db.embassy.delete({
        where: { id: input.embassyId },
      });

      // Create diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: embassy.guestCountryId,
          country2Id: embassy.hostCountryId,
          eventType: "embassy_severed",
          title: "Diplomatic Relations Severed",
          description: `${embassy.name} has been permanently dismantled and diplomatic relations severed.`,
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
          relationshipImpact: -30,
          severity: "critical",
        },
      });

      // Notify the other country
      const otherCountryId =
        embassy.guestCountryId === ctx.user.countryId
          ? embassy.hostCountryId
          : embassy.guestCountryId;
      const myCountryName =
        embassy.guestCountryId === ctx.user.countryId
          ? embassy.guestCountry?.name
          : embassy.hostCountry?.name;

      try {
        await notificationAPI.create({
          title: "❌ Diplomatic Relations Severed",
          message: `${myCountryName || "A country"} has permanently dismantled the embassy and severed relations.`,
          countryId: otherCountryId,
          category: "diplomatic",
          priority: "high",
          href: "/diplomatic",
          source: "diplomatic-system",
          actionable: false,
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send embassy sever notification:", error);
      }

      return {
        success: true,
      };
    }),

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
  getActiveMissions: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const missions = await ctx.db.embassyMission.findMany({
        where: {
          embassy: {
            OR: [{ hostCountryId: input.countryId }, { guestCountryId: input.countryId }],
          },
          status: { in: ["active", "pending", "in_progress"] },
        },
        include: {
          embassy: {
            select: {
              id: true,
              name: true,
              hostCountryId: true,
              guestCountryId: true,
              hostCountry: { select: { id: true, name: true, flag: true } },
              guestCountry: { select: { id: true, name: true, flag: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return missions;
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
