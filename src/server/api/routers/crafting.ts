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
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { vaultService } from "~/lib/vault-service";
import { type CardRarity, type CardType } from "@prisma/client";

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

export const craftingRouter = createTRPCRouter({
  /**
   * Get all available recipes with unlock status
   */
  getRecipes: protectedProcedure
    .input(
      z.object({
        filter: z.enum(["ALL", "UNLOCKED", "LOCKED", "COMPLETED"]).optional().default("ALL"),
        recipeType: recipeTypeEnum.optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      // Fetch all recipes
      const recipes = await ctx.db.craftingRecipe.findMany({
        where: {
          isActive: true,
          ...(input.recipeType && { recipeType: input.recipeType }),
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        orderBy: [
          { resultRarity: "desc" },
          { name: "asc" },
        ],
      });

      // Check unlock status and completion for each recipe
      const recipesWithStatus = await Promise.all(
        recipes.map(async (recipe) => {
          // Check if user meets minimum level requirement
          const user = await ctx.db.user.findUnique({
            where: { id: userId },
            select: { collectorLevel: true },
          });
          const isUnlocked = user ? user.collectorLevel >= recipe.minLevel : false;

          const completedCount = await ctx.db.craftingHistory.count({
            where: {
              userId,
              recipeId: recipe.id,
              success: true,
            },
          });

          const isCompleted = completedCount > 0;

          return {
            ...recipe,
            isUnlocked,
            isCompleted,
            completedCount,
          };
        })
      );

      // Apply filter
      const filtered = recipesWithStatus.filter((recipe) => {
        if (input.filter === "UNLOCKED") return recipe.isUnlocked;
        if (input.filter === "LOCKED") return !recipe.isUnlocked;
        if (input.filter === "COMPLETED") return recipe.isCompleted;
        return true; // ALL
      });

      return {
        recipes: filtered,
        total: filtered.length,
      };
    }),

  /**
   * Get recipe by ID with detailed information
   */
  getRecipeById: protectedProcedure
    .input(z.object({ recipeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      const recipe = await ctx.db.craftingRecipe.findUnique({
        where: { id: input.recipeId },
      });

      if (!recipe) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipe not found",
        });
      }

      // Check if user meets minimum level requirement
      const userForCheck = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { collectorLevel: true },
      });
      const isUnlocked = userForCheck ? userForCheck.collectorLevel >= recipe.minLevel : false;

      const completedCount = await ctx.db.craftingHistory.count({
        where: {
          userId,
          recipeId: recipe.id,
          success: true,
        },
      });

      const recentCrafts = await ctx.db.craftingHistory.findMany({
        where: {
          userId,
          recipeId: recipe.id,
        },
        orderBy: { craftedAt: "desc" },
        take: 5,
      });

      return {
        ...recipe,
        isUnlocked,
        isCompleted: completedCount > 0,
        completedCount,
        recentCrafts,
      };
    }),

  /**
   * Execute crafting (fusion or evolution)
   */
  craftCard: protectedProcedure
    .input(
      z.object({
        recipeId: z.string(),
        materialCardIds: z.array(z.string()).min(1), // Card instance IDs to consume
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      // Fetch recipe
      const recipe = await ctx.db.craftingRecipe.findUnique({
        where: { id: input.recipeId },
      });

      if (!recipe || !recipe.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipe not found or inactive",
        });
      }

      // Check unlock requirements (minimum level)
      const userForUnlock = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { collectorLevel: true },
      });
      const isUnlocked = userForUnlock ? userForUnlock.collectorLevel >= recipe.minLevel : false;

      if (!isUnlocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Recipe not unlocked",
        });
      }

      // Check IxCredits balance
      const vault = await vaultService.getBalance(userId, ctx.db);
      if (vault.credits < recipe.ixCreditsCost) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient IxCredits. Need ${recipe.ixCreditsCost}, have ${vault.credits}`,
        });
      }

      // Verify user owns the material cards
      const ownedCards = await ctx.db.cardOwnership.findMany({
        where: {
          id: { in: input.materialCardIds },
          ownerId: userId,
        },
        include: {
          cards: true,
        },
      });

      if (ownedCards.length !== input.materialCardIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You don't own all the specified material cards",
        });
      }

      // Validate materials match recipe requirements
      const materialsRequired = recipe.requiredCardIds as any[];
      // TODO: Add validation logic for material requirements

      // Calculate success
      const roll = Math.random() * 100;
      const success = roll <= recipe.successRate;

      // Start transaction
      const result = await ctx.db.$transaction(async (tx) => {
        // Deduct IxCredits
        await vaultService.spendCredits(
          userId,
          recipe.ixCreditsCost,
          "SPEND_CRAFT",
          "Crafting Recipe",
          tx as any,
          { recipeId: recipe.id, recipeName: recipe.name }
        );

        // Delete consumed cards
        await tx.cardOwnership.deleteMany({
          where: {
            id: { in: input.materialCardIds },
          },
        });

        let resultCard = null;

        // If successful, create result card
        if (success) {
          // Create new card instance
          const baseCard = recipe.resultCardId
            ? await tx.card.findUnique({ where: { id: recipe.resultCardId } })
            : null;

          // Generate new card
          const newCard = await tx.card.create({
            data: {
              title: baseCard?.title ?? `${recipe.name} Result`,
              description: baseCard?.description ?? `Crafted via ${recipe.name}`,
              artwork: baseCard?.artwork ?? "",
              rarity: recipe.resultRarity ?? "COMMON",
              cardType: "NATION" as CardType, // Default card type
              season: 1, // TODO: Get current season
              stats: {},
              marketValue: 0,
              totalSupply: 1,
              level: 1,
            },
          });

          // Create ownership
          resultCard = await tx.cardOwnership.create({
            data: {
              id: `${userId}-${newCard.id}-${Date.now()}`,
              cardId: newCard.id,
              userId: userId,
              ownerId: userId,
              serialNumber: 1,
              acquiredAt: new Date(),
            },
            include: {
              cards: true,
            },
          });

          // Award XP
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { collectorXp: true, collectorLevel: true },
          });

          if (user) {
            const newXP = user.collectorXp + recipe.collectorXPGain;
            const newLevel = Math.floor(newXP / 1000) + 1; // 1000 XP per level

            await tx.user.update({
              where: { id: userId },
              data: {
                collectorXp: newXP,
                collectorLevel: newLevel,
              },
            });
          }
        }

        // Record crafting history
        const history = await tx.craftingHistory.create({
          data: {
            userId,
            recipeId: recipe.id,
            materialsUsed: input.materialCardIds,
            success,
            resultCardId: resultCard?.id ?? null,
            ixCreditsSpent: recipe.ixCreditsCost,
            collectorXPGain: success ? recipe.collectorXPGain : 0,
          },
        });

        return {
          success,
          resultCard,
          history,
          xpGained: success ? recipe.collectorXPGain : 0,
        };
      });

      return result;
    }),

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
