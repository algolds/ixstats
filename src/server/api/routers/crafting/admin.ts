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
