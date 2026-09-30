import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const diplomaticEmbassiesBudgetRouter = createTRPCRouter({
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
});
