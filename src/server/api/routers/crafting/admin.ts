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
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

/**
 * Recipe type enum
 */
const recipeTypeEnum = z.enum(["FUSION", "EVOLUTION"]);

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

export const craftingAdminRouter = createTRPCRouter({
  /**
   * Admin: Create new recipe
   */
  createRecipe: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        recipeType: recipeTypeEnum,
        resultCardId: z.string().optional(),
        resultRarity: z.string(),
        requiredCardIds: z.array(z.any()),
        requiredCount: z.number().int().min(1).default(1),
        minLevel: z.number().int().min(1).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ixCreditsCost = calculateCraftingCost(input.resultRarity);
      const successRate = calculateSuccessRate(input.resultRarity);
      const collectorXPGain = calculateXPReward(input.resultRarity);

      const recipe = await ctx.db.craftingRecipe.create({
        data: {
          name: input.name,
          description: input.description,
          recipeType: input.recipeType,
          resultCardId: input.resultCardId,
          resultRarity: input.resultRarity,
          requiredCardIds: input.requiredCardIds,
          requiredCount: input.requiredCount,
          minLevel: input.minLevel,
          ixCreditsCost,
          successRate,
          collectorXPGain,
        },
      });

      return recipe;
    }),

  /**
   * Admin: Update recipe
   */
  updateRecipe: adminProcedure
    .input(
      z.object({
        recipeId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        successRate: z.number().optional(),
        ixCreditsCost: z.number().optional(),
        requiredCardIds: z.array(z.any()).optional(),
        requiredCount: z.number().int().min(1).optional(),
        minLevel: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { recipeId, ...data } = input;

      const recipe = await ctx.db.craftingRecipe.update({
        where: { id: recipeId },
        data,
      });

      return recipe;
    }),

  /**
   * Admin: Get all recipes (including inactive)
   */
  adminGetAllRecipes: adminProcedure.query(async ({ ctx }) => {
    const recipes = await ctx.db.craftingRecipe.findMany({
      orderBy: [{ isActive: "desc" }, { resultRarity: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { craftingHistory: true },
        },
      },
    });

    return recipes;
  }),
});
