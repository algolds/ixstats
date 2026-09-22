import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { validateArchetypeSelection } from "~/lib/archetypes/catalog";

// Input validation schemas
const archetypeSelectionSchema = z.object({
  archetypeIds: z.array(z.string()).max(5, "Maximum 5 archetypes can be selected"),
});
export const archetypesSelectionsRouter = createTRPCRouter({
  // Get all archetype categories

  // Get all selectable archetypes

  // Admin: Get all archetypes (for management)

  // Admin: Get archetype usage statistics

  // Get archetypes by category

  // Get user's selected archetypes

  // Update user's archetype selections
  updateUserArchetypeSelections: protectedProcedure
    .input(archetypeSelectionSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate selection
      if (!validateArchetypeSelection(input.archetypeIds)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid archetype selection. Check category limits.",
        });
      }

      try {
        // Remove existing selections
        await ctx.db.userArchetypeSelection.deleteMany({
          where: { userId: ctx.user.id },
        });

        // Add new selections
        if (input.archetypeIds.length > 0) {
          await ctx.db.userArchetypeSelection.createMany({
            data: input.archetypeIds.map((archetypeId) => ({
              userId: ctx.user.id,
              archetypeId,
            })),
          });
        }

        // Return updated selections
        const updatedSelections = await ctx.db.userArchetypeSelection.findMany({
          where: { userId: ctx.user.id },
          include: {
            archetype: {
              include: {
                category: { select: { id: true, name: true, priority: true } },
              },
            },
          },
          orderBy: { selectedAt: "desc" },
        });

        return updatedSelections;
      } catch (error) {
        console.error("Error updating user archetype selections:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update archetype selections",
        });
      }
    }),

  // Get countries matching selected archetypes

  // Recalculate archetype matches for all countries

  // Admin: Create new archetype

  // Admin: Update archetype

  // Admin: Delete/deactivate archetype

  // Admin: Initialize archetype system with default data
});
