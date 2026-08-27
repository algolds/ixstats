import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
// oxlint-disable-next-line typescript/no-unused-vars
import { NPCPersonalitySystem, type ObservableData } from "~/lib/diplomacy/npc-personality";
import { vaultService } from "~/lib/vault/vault-service";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { ActivityHooks } from "~/lib/activity";

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

export const diplomaticEmbassiesEstablishRouter = createTRPCRouter({
  // Embassy Network Operations

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

      // One embassy per guest↔host pair (enforced by a composite unique). Guard here
      // so a re-try / double-submit returns a clear message instead of a raw P2002.
      const existing = await ctx.db.embassy.findUnique({
        where: {
          hostCountryId_guestCountryId: {
            hostCountryId: input.hostCountryId,
            guestCountryId: input.guestCountryId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an embassy in this country.",
        });
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
          href: "/mycountry/diplomacy",
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
          href: "/mycountry/diplomacy",
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

      // 🤝 Ensure a DiplomaticRelation exists between the two countries.
      // Establishing an embassy is what opens formal relations — without this,
      // the Relations list and the Foreign Policy target dropdown stay empty.
      try {
        const existingRelation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: input.guestCountryId, country2: input.hostCountryId },
              { country1: input.hostCountryId, country2: input.guestCountryId },
            ],
          },
          select: { id: true },
        });

        if (!existingRelation) {
          await ctx.db.diplomaticRelation.create({
            data: {
              country1: input.guestCountryId,
              country2: input.hostCountryId,
              relationship: "neutral",
              strength: 25, // baseline goodwill from opening an embassy
              status: "active",
              lastContact: new Date(),
              diplomaticChannels: JSON.stringify(["embassy"]),
            },
          });
        } else {
          // Refresh contact + nudge strength up for re-engagement
          await ctx.db.diplomaticRelation.update({
            where: { id: existingRelation.id },
            data: { lastContact: new Date(), status: "active" },
          });
        }
      } catch (error) {
        console.error("[Diplomatic] Failed to upsert diplomatic relation:", error);
      }

      // 📰 In-world narrative: post the embassy news to ThinkPages + activity feed.
      void generateDiplomaticNews(ctx.db, input.guestCountryId, "embassy_established", {
        countryName: guestCountryName ?? "A nation",
        targetName: hostCountryName ?? "another nation",
      });
      void ActivityHooks.Diplomatic.onEmbassyEstablished(
        input.guestCountryId,
        input.hostCountryId,
        "basic",
        ctx.auth?.userId ?? undefined
      );

      return {
        ...embassy,
        hostCountryName,
        guestCountryName,
        creditsEarned,
      };
    }),

  // Embassy Management

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
// oxlint-disable-next-line typescript/no-unused-vars
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

// oxlint-disable-next-line typescript/no-unused-vars
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

// oxlint-disable-next-line typescript/no-unused-vars
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

// oxlint-disable-next-line typescript/no-unused-vars
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

// oxlint-disable-next-line typescript/no-unused-vars
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

// oxlint-disable-next-line typescript/no-unused-vars
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
