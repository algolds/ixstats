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
import { TRPCError } from "@trpc/server";
import { vaultService, getVaultConfig } from "~/lib/vault";
import { grantCardXp } from "~/lib/card-xp-utils";
import { getCurrentIxCardSeason } from "~/lib/ixcard-season";
import { type CardType } from "@prisma/client";

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

export const craftingRecipesRouter = createTRPCRouter({
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
        orderBy: [{ resultRarity: "desc" }, { name: "asc" }],
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

      // Check crafting switch or maintenance mode
      const config = await getVaultConfig(ctx.db);
      if (config.isMaintenanceMode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vault economy is currently in maintenance mode.",
        });
      }
      if (!config.isCraftingEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Card crafting is currently disabled globally.",
        });
      }

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
      if (materialsRequired && materialsRequired.length > 0) {
        if (materialsRequired.every((m: any) => typeof m === "string")) {
          // Specific card IDs required — each material card must match a required card (by cardId)
          const materialBaseIds = ownedCards.map((oc) => oc.cardId);
          for (const requiredId of materialsRequired) {
            const idx = materialBaseIds.indexOf(requiredId);
            if (idx === -1) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Missing required card: ${requiredId}`,
              });
            }
            materialBaseIds.splice(idx, 1);
          }
        } else {
          // Criteria-based validation — check count only; criteria assumed to be pre-validated
          if (input.materialCardIds.length < recipe.requiredCount) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Need at least ${recipe.requiredCount} materials`,
            });
          }
        }
      }

      // Get current IxCard season
      const currentSeason = await getCurrentIxCardSeason(ctx.db);

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
              season: currentSeason,
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

          // Award XP to the crafted card
          if (resultCard) {
            await grantCardXp(
              tx as any,
              resultCard.id,
              recipe.collectorXPGain,
              "CRAFT",
              JSON.stringify({ recipeId: recipe.id, recipeName: recipe.name })
            );
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
});
