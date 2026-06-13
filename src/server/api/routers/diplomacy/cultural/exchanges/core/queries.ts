import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";





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

export const diplomaticCulturalExchangesCoreQueriesRouter = createTRPCRouter({
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
