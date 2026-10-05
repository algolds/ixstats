/**
 * Crafting Router
 *
 * Retired for now (2026-10-05): every procedure refuses through `assertCraftingEnabled`
 * (`./_retired`). The logic below is kept, and tested, for when crafting returns.
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
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { vaultService, getVaultConfig, LedgerError } from "~/lib/vault/vault-service";
import { getVaultLevel } from "~/lib/vault/vault-perks";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { getCurrentIxCardSeason } from "~/lib/cards/season";
import { newCardOwnershipId } from "~/lib/cards/ownership-id";
import {
  CRAFTED_CARD_MARKER,
  normalizeSuccessRate,
  validateMaterialCriteria,
  type MaterialCriterion,
} from "~/lib/cards/crafting-rules";
import { type CardType } from "@prisma/client";
import { assertCraftingEnabled } from "./_retired";

/**
 * Recipe type enum
 */
const recipeTypeEnum = z.enum(["FUSION", "EVOLUTION"]);
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
      assertCraftingEnabled();
      const userId = ctx.user.id;

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

      // Recipes unlock by Vault level (derived from Vault XP); read it once
      const vaultLevel = await getVaultLevel(userId, ctx.db);

      // Batch completion counts for all recipes
      const completionCountMap = new Map<string, number>();
      if (recipes.length > 0) {
        const historyGroups = await ctx.db.craftingHistory.groupBy({
          by: ["recipeId"],
          where: {
            userId,
            recipeId: { in: recipes.map((r) => r.id) },
            success: true,
          },
          _count: {
            _all: true,
          },
        });
        for (const g of historyGroups) {
          completionCountMap.set(g.recipeId, g._count._all);
        }
      }

      // Check unlock status and completion for each recipe synchronously
      const recipesWithStatus = recipes.map((recipe) => {
        const isUnlocked = vaultLevel >= recipe.minLevel;
        const completedCount = completionCountMap.get(recipe.id) ?? 0;
        const isCompleted = completedCount > 0;

        return {
          ...recipe,
          successRate: normalizeSuccessRate(recipe.successRate),
          isUnlocked,
          isCompleted,
          completedCount,
        };
      });

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
      assertCraftingEnabled();
      const userId = ctx.user.id;

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
      const isUnlocked = (await getVaultLevel(userId, ctx.db)) >= recipe.minLevel;

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
        successRate: normalizeSuccessRate(recipe.successRate),
        isUnlocked,
        isCompleted: completedCount > 0,
        completedCount,
        recentCrafts,
      };
    }),

  /**
   * Execute crafting (fusion or evolution)
   */
  craftCard: rateLimitedMutationProcedure
    .input(
      z.object({
        recipeId: z.string(),
        materialCardIds: z.array(z.string()).min(1), // Card instance IDs to consume
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertCraftingEnabled();
      const userId = ctx.user.id;

      // Check maintenance mode
      const config = await getVaultConfig(ctx.db);
      if (config.isMaintenanceMode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vault economy is currently in maintenance mode.",
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
      const isUnlocked = (await getVaultLevel(userId, ctx.db)) >= recipe.minLevel;

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

      const lockedMaterial = ownedCards.find((oc) => oc.isLocked);
      if (lockedMaterial) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot use locked cards as materials: ${lockedMaterial.cards.title}`,
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
          // Criteria-based validation: every material must fit a criterion (rarity / type /
          // card), each criterion gets its quantity, and nothing extra is consumed
          const criteriaError = validateMaterialCriteria(
            ownedCards,
            materialsRequired as MaterialCriterion[]
          );
          if (criteriaError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: criteriaError });
          }
        }
      }

      // A recipe with a fixed result grants that card, so it must still exist
      const resultBaseCard = recipe.resultCardId
        ? await ctx.db.card.findUnique({ where: { id: recipe.resultCardId } })
        : null;
      if (recipe.resultCardId && !resultBaseCard) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This recipe's result card is no longer available",
        });
      }

      // Get current IxCard season
      const currentSeason = await getCurrentIxCardSeason(ctx.db);

      // Calculate success (successRate is 0.0-1.0; legacy percentages are normalised)
      const success = Math.random() < normalizeSuccessRate(recipe.successRate);

      // Start transaction
      try {
        const result = await ctx.db.$transaction(async (tx) => {
          // Deduct IxCredits first — a LedgerError rolls the whole craft back
          if (recipe.ixCreditsCost > 0) {
            await vaultService.spendCreditsTx(tx, {
              userId,
              amount: recipe.ixCreditsCost,
              type: "SPEND_CRAFT",
              source: "Crafting Recipe",
              metadata: { recipeId: recipe.id, recipeName: recipe.name },
            });
          }

          // Delete consumed cards: only rows still owned and unlocked, so a concurrent
          // craft/junk/listing can't be double-spent (rolls back the whole craft)
          const consumed = await tx.cardOwnership.deleteMany({
            where: {
              id: { in: input.materialCardIds },
              ownerId: userId,
              isLocked: false,
            },
          });
          if (consumed.count !== input.materialCardIds.length) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Some materials were already used or locked. Refresh and try again.",
            });
          }

          let resultCard = null;

          // If successful, grant the result card
          if (success) {
            let resultCardId: string;
            let serialNumber = 1;

            if (resultBaseCard) {
              // Fixed-result recipe: grant a copy of the recipe's card, next serial in line
              resultCardId = resultBaseCard.id;
              const maxSerial = await tx.cardOwnership.findFirst({
                where: { cardId: resultCardId },
                orderBy: { serialNumber: "desc" },
                select: { serialNumber: true },
              });
              serialNumber = (maxSerial?.serialNumber ?? 0) + 1;
            } else {
              // Open-result recipe: mint a new card of the recipe's rarity, marked as crafted
              // so it never drops from packs
              const newCard = await tx.card.create({
                data: {
                  title: `${recipe.name} Result`,
                  description: `Crafted via ${recipe.name}`,
                  artwork: "",
                  rarity: recipe.resultRarity ?? "COMMON",
                  cardType: "NATION" as CardType, // Default card type
                  season: currentSeason,
                  stats: {},
                  marketValue: 0,
                  totalSupply: 1,
                  level: 1,
                  metadata: { ...CRAFTED_CARD_MARKER, recipeId: recipe.id },
                },
              });
              resultCardId = newCard.id;
            }

            // Create ownership
            resultCard = await tx.cardOwnership.create({
              data: {
                id: newCardOwnershipId(),
                cardId: resultCardId,
                userId: userId,
                ownerId: userId,
                serialNumber,
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
      } catch (error) {
        if (error instanceof LedgerError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),
});
