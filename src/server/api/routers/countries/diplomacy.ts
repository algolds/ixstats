import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";

export const diplomacyProcedures = {
  getDiplomaticRelations: publicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const whereClause = input.countryId
        ? {
            OR: [{ country1: input.countryId }, { country2: input.countryId }],
          }
        : {};

      const relations = await ctx.db.diplomaticRelation.findMany({
        where: whereClause,
        orderBy: { lastContact: "desc" },
        take: 200,
      });

      return relations.map((relation) => ({
        id: relation.id,
        country1: relation.country1,
        country2: relation.country2,
        relationship: relation.relationship,
        strength: relation.strength,
        treaties: relation.treaties ? JSON.parse(relation.treaties) : [],
        lastContact: relation.lastContact,
        status: relation.status,
        diplomaticChannels: relation.diplomaticChannels
          ? JSON.parse(relation.diplomaticChannels)
          : [],
      }));
    }),

  getEconomicMilestones: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
      });

      if (!country) return [];

      const milestones = [];

      if (country.adjustedGdpGrowth > 0.03) {
        milestones.push({
          id: `milestone_${country.id}_gdp_growth`,
          title: "Strong Economic Growth",
          description: `GDP growth of ${(country.adjustedGdpGrowth * 100).toFixed(1)}% achieved`,
          value: country.adjustedGdpGrowth,
          category: "economic_growth",
          achievedAt: new Date(
            Date.now() - (country.adjustedGdpGrowth > 0.05 ? 3 : 7) * 24 * 60 * 60 * 1000
          ).toISOString(),
        });
      }

      if (country.currentPopulation > country.baselinePopulation * 1.05) {
        milestones.push({
          id: `milestone_${country.id}_population`,
          title: "Population Growth",
          description: "Significant population increase recorded",
          value: country.currentPopulation,
          category: "population",
          achievedAt: new Date().toISOString(),
        });
      }

      return milestones.slice(0, input.limit);
    }),
};
