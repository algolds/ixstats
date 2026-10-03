import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const diplomaticEmbassiesQueriesEmbassyCalculatorsRouter = createTRPCRouter({
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

      const totalCost = baseCost * relationshipMultiplier;
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
});
