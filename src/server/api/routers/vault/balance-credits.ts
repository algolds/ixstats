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
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { vaultService } from "~/lib/vault/vault-service";
import { budgetVaultCalculator } from "~/lib/economy/budget-vault-calculator";
import { type VaultTransactionType } from "@prisma/client";
import { globalCache } from "~/lib/cache";

/**
 * Vault transaction type enum for validation
 */
const vaultTransactionTypeEnum = z.enum([
  "EARN_PASSIVE",
  "EARN_ACTIVE",
  "EARN_CARDS",
  "EARN_SOCIAL",
  "SPEND_PACKS",
  "SPEND_MARKET",
  "SPEND_CRAFT",
  "SPEND_BOOST",
  "SPEND_COSMETIC",
  "ADMIN_ADJUSTMENT",
]);

export const vaultBalanceCreditsRouter = createTRPCRouter({
  /**
   * Get vault balance and stats for a user
   */
  getBalance: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const cacheKey = `user_vault_balance:${input.userId}`;
        const cached = await globalCache.get<any>(cacheKey);
        if (cached) return cached;

        const balance = await vaultService.getBalance(input.userId, ctx.db as any);
        await globalCache.set(cacheKey, balance, { ttl: 30 });
        return balance;
      } catch (error) {
        console.error("[Vault Router] Error getting balance:", error);
        throw new Error("Failed to retrieve vault balance", { cause: error });
      }
    }),

  /**
   * Get transaction history with pagination
   */
  spendCredits: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(0.01, "Amount must be positive"),
        type: vaultTransactionTypeEnum,
        source: z.string().min(1, "Source is required"),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        // Validate spending type
        if (!input.type.startsWith("SPEND_") && input.type !== "ADMIN_ADJUSTMENT") {
          throw new Error("Invalid transaction type for spending");
        }

        const result = await vaultService.spendCredits(
          ctx.auth.userId,
          input.amount,
          input.type as VaultTransactionType,
          input.source,
          ctx.db as any,
          input.metadata
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to spend credits");
        }

        await globalCache.delete(`user_vault_balance:${ctx.auth.userId}`);

        return {
          success: true,
          newBalance: result.newBalance,
          amountSpent: input.amount,
          message: `Spent ${input.amount} IxCredits. New balance: ${result.newBalance} IxCredits`,
        };
      } catch (error) {
        console.error("[Vault Router] Error spending credits:", error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Failed to spend credits", { cause: error });
      }
    }),

  /**
   * Get vault level
   */
  getVaultLevel: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const balance = await vaultService.getBalance(input.userId, ctx.db as any);

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
   * Get today's earnings summary
   */
  getEarningsSummary: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const summary = await vaultService.getEarningsSummary(ctx.auth.userId, ctx.db as any);

      return summary;
    } catch (error) {
      console.error("[Vault Router] Error getting earnings summary:", error);
      throw new Error("Failed to retrieve earnings summary", { cause: error });
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
          DAILY_LOGIN: "Daily Bonus",
        };
        return labels[source] || source.replace(/_/g, " ");
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
   * Check daily earning cap
   */
  earnCredits: adminProcedure
    .input(
      z.object({
        amount: z.number().min(0.01, "Amount must be positive"),
        type: vaultTransactionTypeEnum,
        source: z.string().min(1, "Source is required"),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        // Validate earning type
        if (!input.type.startsWith("EARN_") && input.type !== "ADMIN_ADJUSTMENT") {
          throw new Error("Invalid transaction type for earning");
        }

        const result = await vaultService.earnCredits(
          ctx.auth.userId,
          input.amount,
          input.type as VaultTransactionType,
          input.source,
          ctx.db as any,
          input.metadata
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to earn credits");
        }

        await globalCache.delete(`user_vault_balance:${ctx.auth.userId}`);

        return {
          success: true,
          newBalance: result.newBalance,
          amountEarned: input.amount,
          message: `Earned ${input.amount} IxCredits. New balance: ${result.newBalance} IxCredits`,
        };
      } catch (error) {
        console.error("[Vault Router] Error earning credits:", error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Failed to earn credits", { cause: error });
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

  /**
   * Get detailed budget multiplier breakdown by department
   */
  getBudgetMultiplierBreakdown: protectedProcedure
    .input(
      z.object({
        countryId: z.string().min(1, "Country ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const breakdown = await budgetVaultCalculator.getBudgetBreakdown(
          input.countryId,
          ctx.db as any
        );
        const totalMultiplier = await budgetVaultCalculator.calculateBudgetMultiplier(
          input.countryId,
          ctx.db as any
        );

        return {
          countryId: input.countryId,
          totalMultiplier,
          breakdown,
          totalCategories: breakdown.length,
        };
      } catch (error) {
        console.error("[Vault Router] Error getting budget breakdown:", error);
        throw new Error("Failed to retrieve budget multiplier breakdown", { cause: error });
      }
    }),

  // ============================================
  // COLLECTION CRUD
  // ============================================

  /**
   * Get current user's collections
   */
});
