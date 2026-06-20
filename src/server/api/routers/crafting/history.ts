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

/**
 * Recipe type enum
 */
const recipeTypeEnum = z.enum(["FUSION", "EVOLUTION"]);

/**
 * Material requirement schema
 */
const materialRequirementSchema = z.object({
  cardId: z.string().optional(), // Specific card ID (for evolution)
  rarity: z.string().optional(), // Required rarity (for fusion)
  type: z.string().optional(), // Required card type
  quantity: z.number().int().min(1), // Number of cards needed
});

/**
 * Unlock requirement schema
 */
const unlockRequirementSchema = z.object({
  minLevel: z.number().int().optional(), // Minimum collector level
  achievements: z.array(z.string()).optional(), // Required achievements
  completedRecipes: z.array(z.string()).optional(), // Required completed recipes
});

/**
 * Calculate success rate based on card rarity
 */
function calculateSuccessRate(resultRarity: string): number {
  const rates: Record<string, number> = {
    COMMON: 100,
    UNCOMMON: 95,
    RARE: 85,
    ULTRA_RARE: 70,
    EPIC: 50,
    LEGENDARY: 30,
    MYTHIC: 15,
  };
  return rates[resultRarity] ?? 50;
}

/**
 * Calculate IxCredits cost based on rarity
 */
function calculateCraftingCost(resultRarity: string): number {
  const costs: Record<string, number> = {
    COMMON: 100,
    UNCOMMON: 250,
    RARE: 500,
    ULTRA_RARE: 1000,
    EPIC: 2500,
    LEGENDARY: 5000,
    MYTHIC: 10000,
  };
  return costs[resultRarity] ?? 500;
}

/**
 * Calculate XP reward based on rarity
 */
function calculateXPReward(resultRarity: string): number {
  const xp: Record<string, number> = {
    COMMON: 10,
    UNCOMMON: 25,
    RARE: 50,
    ULTRA_RARE: 100,
    EPIC: 250,
    LEGENDARY: 500,
    MYTHIC: 1000,
  };
  return xp[resultRarity] ?? 50;
}

/**
 * Check if user meets unlock requirements
 */
async function checkUnlockRequirements(
  userId: string,
  requirements: any,
  db: any
): Promise<boolean> {
  if (!requirements) return true;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { collectorLevel: true },
  });

  if (!user) return false;

  // Check collector level
  if (requirements.minLevel && user.collectorLevel < requirements.minLevel) {
    return false;
  }

  // Check achievements (placeholder - implement when achievement system is ready)
  if (requirements.achievements && requirements.achievements.length > 0) {
    // TODO: Check achievements
  }

  // Check completed recipes
  if (requirements.completedRecipes && requirements.completedRecipes.length > 0) {
    const completedRecipes = await db.craftingHistory.findMany({
      where: {
        userId,
        success: true,
        recipeId: { in: requirements.completedRecipes },
      },
      select: { recipeId: true },
      distinct: ["recipeId"],
    });

    if (completedRecipes.length < requirements.completedRecipes.length) {
      return false;
    }
  }

  return true;
}

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
