import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const diplomaticCulturalExchangesCoreQueriesRouter = createTRPCRouter({
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
});
