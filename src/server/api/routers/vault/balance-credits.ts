/**
 * MyVault Router
 *
 * tRPC router for IxCredits economy operations
 * Provides endpoints for:
 * - Balance queries
 * - Transaction history
 * - Daily bonuses and streaks
 * - Credit spending
 * - Vault level and earnings summaries
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { vaultService } from "~/lib/vault/vault-service";
import { grantNewPlayerBonus, NEW_PLAYER_BONUS_ON_VAULT_OPEN } from "~/lib/vault/vault-bonus";
import { budgetVaultCalculator } from "~/lib/economy/budget-vault-calculator";
import { globalCache } from "~/lib/cache";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

export const vaultBalanceCreditsRouter = createTRPCRouter({
  /**
   * Get vault balance and stats for a user
   */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Guaranteed non-null by protectedProcedure's authMiddleware.
      const userId = ctx.auth.userId;
      const cacheKey = `user_vault_balance:${userId}`;
      const cached = await globalCache.get<any>(cacheKey);
      if (cached) return cached;

      // Accounts that predate the sign-up bonus get it on first Vault open (no-op once paid)
      if (NEW_PLAYER_BONUS_ON_VAULT_OPEN) {
        await grantNewPlayerBonus(ctx.db as any, userId, "vault_opened");
      }

      const balance = await vaultService.getBalance(userId, ctx.db as any);
      await globalCache.set(cacheKey, balance, { ttl: 30 });
      return balance;
    } catch (error) {
      console.error("[Vault Router] Error getting balance:", error);
      throw new Error("Failed to retrieve vault balance", { cause: error });
    }
  }),

  /**
   * Get vault level
   */
  getVaultLevel: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Guaranteed non-null by protectedProcedure's authMiddleware.
      const userId = ctx.auth.userId;
      const balance = await vaultService.getBalance(userId, ctx.db as any);

      return {
        vaultLevel: balance.vaultLevel,
        vaultXp: balance.vaultXp,
        nextLevelXp: balance.vaultLevel * 1000,
        progress: (balance.vaultXp % 1000) / 1000,
      };
    } catch (error) {
      console.error("[Vault Router] Error getting vault level:", error);
      throw new Error("Failed to retrieve vault level", { cause: error });
    }
  }),

  /**
   * Get today's earnings breakdown by source
   */
  getTodayEarnings: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const summary = await vaultService.getEarningsSummary(ctx.auth.userId, ctx.db as any);

      // Format source labels for display
      const formatSourceLabel = (source: string): string => {
        const labels: Record<string, string> = {
          EARN_PASSIVE: "Passive Income",
          EARN_ACTIVE: "Active Gameplay",
          EARN_CARDS: "Card Activities",
          EARN_SOCIAL: "Social Engagement",
          EARN_BONUS: "Bonuses",
          DAILY_LOGIN: "Daily Bonus",
        };
        const plain = source.replace(/_/g, " ").toLowerCase();
        return labels[source] || plain.charAt(0).toUpperCase() + plain.slice(1);
      };

      const sources = Object.entries(summary.breakdown).map(([type, amount]) => ({
        type,
        label: formatSourceLabel(type),
        amount,
      }));

      return {
        total: summary.total,
        sources,
        transactionCount: summary.transactionCount,
      };
    } catch (error) {
      console.error("[Vault Router] Error getting today's earnings:", error);
      throw new Error("Failed to retrieve today's earnings", { cause: error });
    }
  }),

  /**
   * Calculate passive income for a country
   */
  calculatePassiveIncome: protectedProcedure
    .input(
      z.object({
        countryId: z.string().min(1, "Country ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Derived from the nation's budget (the budget multiplier): owner/privileged only.
      await assertCountryWriteAccess(ctx, input.countryId);
      try {
        const dailyDividend = await vaultService.calculatePassiveIncome(
          input.countryId,
          ctx.db as any
        );

        return {
          countryId: input.countryId,
          dailyDividend,
          weeklyDividend: dailyDividend * 7,
          monthlyDividend: dailyDividend * 30,
        };
      } catch (error) {
        console.error("[Vault Router] Error calculating passive income:", error);
        throw new Error("Failed to calculate passive income", { cause: error });
      }
    }),

  /**
   * Admin: Adjust a user's login streak (absolute delta applied)
   */
  getUserStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.user?.id) {
        throw new Error("User not found in authentication context");
      }

      const cacheKey = `user_vault_stats:${ctx.user.id}`;
      const cached = await globalCache.get<any>(cacheKey);
      if (cached) return cached;

      // Count owned card instances live (excluding retired cards)
      const totalCards = await ctx.db.cardOwnership.count({
        where: {
          ownerId: ctx.user.id,
          cards: { isRetired: false },
        },
      });

      // Sum of market values for all owned card instances live (excluding retired cards)
      const ownerships = await ctx.db.cardOwnership.findMany({
        where: {
          ownerId: ctx.user.id,
          cards: { isRetired: false },
        },
        include: {
          cards: {
            select: {
              marketValue: true,
            },
          },
        },
      });

      const deckValue = ownerships.reduce((sum, own) => {
        return sum + (own.cards?.marketValue ?? 0) * own.quantity;
      }, 0);

      const capacityBoost = await vaultService.getCardCapacityBoost(ctx.user.id, ctx.db as any);

      const stats = {
        totalCards,
        deckValue,
        collectorLevel: ctx.user.collectorLevel ?? 1,
        collectorXp: ctx.user.collectorXp ?? 0,
        capacityBoost,
      };

      await globalCache.set(cacheKey, stats, { ttl: 30 });

      return stats;
    } catch (error) {
      console.error("[Vault Router] Error getting user stats:", error);
      throw new Error("Failed to retrieve user stats", { cause: error });
    }
  }),

  /**
   * Get budget multiplier for passive income
   */
  getBudgetMultiplier: protectedProcedure
    .input(
      z.object({
        countryId: z.string().min(1, "Country ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Read off the nation's budget allocations: owner/privileged only.
      await assertCountryWriteAccess(ctx, input.countryId);
      try {
        const multiplier = await budgetVaultCalculator.calculateBudgetMultiplier(
          input.countryId,
          ctx.db as any
        );
        const description = budgetVaultCalculator.getMultiplierDescription(multiplier);

        return {
          countryId: input.countryId,
          multiplier,
          description,
          percentChange: Math.round((multiplier - 1.0) * 100),
        };
      } catch (error) {
        console.error("[Vault Router] Error getting budget multiplier:", error);
        throw new Error("Failed to retrieve budget multiplier", { cause: error });
      }
    }),
});
