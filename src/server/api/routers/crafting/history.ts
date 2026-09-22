/**
 * Crafting Router
 *
 * tRPC router for IxCards crafting system
 * Provides endpoints for:
 * - Recipe browsing and filtering
 * - Card fusion and evolution
 * - Crafting history tracking
 * - Success rate calculations
 * - XP rewards and progression
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
export const craftingHistoryRouter = createTRPCRouter({
  /**
   * Get crafting history for current user
   */
  getCraftingHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
        successOnly: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      const history = await ctx.db.craftingHistory.findMany({
        where: {
          userId,
          ...(input.successOnly !== undefined && { success: input.successOnly }),
        },
        include: {
          recipe: true,
        },
        orderBy: { craftedAt: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      const total = await ctx.db.craftingHistory.count({
        where: {
          userId,
          ...(input.successOnly !== undefined && { success: input.successOnly }),
        },
      });

      return {
        history,
        total,
        hasMore: total > input.offset + input.limit,
      };
    }),

  /**
   * Get crafting statistics for current user
   */
  getCraftingStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;

    const totalCrafts = await ctx.db.craftingHistory.count({
      where: { userId },
    });

    const successfulCrafts = await ctx.db.craftingHistory.count({
      where: { userId, success: true },
    });

    const totalXPGained = await ctx.db.craftingHistory.aggregate({
      where: { userId },
      _sum: { collectorXPGain: true },
    });

    const totalCreditsSpent = await ctx.db.craftingHistory.aggregate({
      where: { userId },
      _sum: { ixCreditsSpent: true },
    });

    const uniqueRecipesCrafted = await ctx.db.craftingHistory.findMany({
      where: { userId, success: true },
      select: { recipeId: true },
      distinct: ["recipeId"],
    });

    return {
      totalCrafts,
      successfulCrafts,
      failedCrafts: totalCrafts - successfulCrafts,
      successRate: totalCrafts > 0 ? (successfulCrafts / totalCrafts) * 100 : 0,
      totalXPGained: totalXPGained._sum.collectorXPGain ?? 0,
      totalCreditsSpent: totalCreditsSpent._sum.ixCreditsSpent ?? 0,
      uniqueRecipesCrafted: uniqueRecipesCrafted.length,
    };
  }),
});
