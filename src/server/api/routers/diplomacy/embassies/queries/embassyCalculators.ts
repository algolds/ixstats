import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

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

export const diplomaticEmbassiesQueriesEmbassyCalculatorsRouter = createTRPCRouter({
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

  // Link existing cultural exchange to an embassy mission

  // Embassy Game System Endpoints

  // Embassy Management

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
