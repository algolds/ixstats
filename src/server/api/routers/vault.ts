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
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { vaultService } from "~/lib/vault-service";
import { type VaultTransactionType } from "@prisma/client";

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

export const vaultRouter = createTRPCRouter({
  /**
   * Get vault balance and stats for a user
   * Admin-only endpoint
   */
  getBalance: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const balance = await vaultService.getBalance(input.userId, ctx.db);
        return balance;
      } catch (error) {
        console.error("[Vault Router] Error getting balance:", error);
        throw new Error("Failed to retrieve vault balance");
      }
    }),

  /**
   * Get transaction history with pagination
   * Admin-only endpoint
   */
  getTransactions: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        type: vaultTransactionTypeEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        const transactions = await vaultService.getTransactionHistory(
          ctx.auth.userId,
          ctx.db,
          input.limit,
          input.offset,
          input.type as VaultTransactionType | undefined
        );

        return {
          transactions,
          count: transactions.length,
          hasMore: transactions.length === input.limit,
        };
      } catch (error) {
        console.error("[Vault Router] Error getting transactions:", error);
        throw new Error("Failed to retrieve transaction history");
      }
    }),

  /**
   * Claim daily login bonus
   * Admin-only endpoint
   */
  claimDailyBonus: adminProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const result = await vaultService.claimDailyBonus(ctx.auth.userId, ctx.db);

      if (!result.success) {
        throw new Error(result.message || "Failed to claim daily bonus");
      }

      return {
        success: true,
        bonus: result.bonus,
        streak: result.streak,
        message: `Claimed ${result.bonus} IxC! Streak: ${result.streak} days`,
      };
    } catch (error) {
      console.error("[Vault Router] Error claiming daily bonus:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to claim daily bonus");
    }
  }),

  /**
   * Claim streak bonus (updates login streak)
   * Admin-only endpoint
   */
  claimStreakBonus: adminProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const newStreak = await vaultService.updateLoginStreak(ctx.auth.userId, ctx.db);

      return {
        success: true,
        streak: newStreak,
        message: `Login streak updated: ${newStreak} days`,
      };
    } catch (error) {
      console.error("[Vault Router] Error claiming streak bonus:", error);
      throw new Error("Failed to update login streak");
    }
  }),

  /**
   * Spend IxCredits
   * Admin-only endpoint
   */
  spendCredits: adminProcedure
    .input(
      z.object({
        amount: z.number().min(0.01, "Amount must be positive"),
        type: vaultTransactionTypeEnum,
        source: z.string().min(1, "Source is required"),
        metadata: z.record(z.any()).optional(),
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
          ctx.db,
          input.metadata
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to spend credits");
        }

        return {
          success: true,
          newBalance: result.newBalance,
          amountSpent: input.amount,
          message: `Spent ${input.amount} IxC. New balance: ${result.newBalance} IxC`,
        };
      } catch (error) {
        console.error("[Vault Router] Error spending credits:", error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Failed to spend credits");
      }
    }),

  /**
   * Get vault level
   * Admin-only endpoint
   */
  getVaultLevel: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const balance = await vaultService.getBalance(input.userId, ctx.db);

        return {
          vaultLevel: balance.vaultLevel,
          vaultXp: balance.vaultXp,
          nextLevelXp: balance.vaultLevel * 1000,
          progress: (balance.vaultXp % 1000) / 1000,
        };
      } catch (error) {
        console.error("[Vault Router] Error getting vault level:", error);
        throw new Error("Failed to retrieve vault level");
      }
    }),

  /**
   * Get today's earnings summary
   * Admin-only endpoint
   */
  getEarningsSummary: adminProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const summary = await vaultService.getEarningsSummary(ctx.auth.userId, ctx.db);

      return summary;
    } catch (error) {
      console.error("[Vault Router] Error getting earnings summary:", error);
      throw new Error("Failed to retrieve earnings summary");
    }
  }),

  /**
   * Get today's earnings breakdown by source
   * Admin-only endpoint
   */
  getTodayEarnings: adminProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const summary = await vaultService.getEarningsSummary(ctx.auth.userId, ctx.db);

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
      throw new Error("Failed to retrieve today's earnings");
    }
  }),

  /**
   * Calculate passive income for a country
   * Admin-only endpoint
   */
  calculatePassiveIncome: adminProcedure
    .input(
      z.object({
        countryId: z.string().min(1, "Country ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const dailyDividend = await vaultService.calculatePassiveIncome(input.countryId, ctx.db);

        return {
          countryId: input.countryId,
          dailyDividend,
          weeklyDividend: dailyDividend * 7,
          monthlyDividend: dailyDividend * 30,
        };
      } catch (error) {
        console.error("[Vault Router] Error calculating passive income:", error);
        throw new Error("Failed to calculate passive income");
      }
    }),

  /**
   * Check daily earning cap
   * Admin-only endpoint
   */
  checkDailyCap: adminProcedure
    .input(
      z.object({
        earnType: z.enum(["EARN_ACTIVE", "EARN_SOCIAL"]),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        const capCheck = await vaultService.checkDailyCap(
          ctx.auth.userId,
          input.earnType,
          ctx.db
        );

        return capCheck;
      } catch (error) {
        console.error("[Vault Router] Error checking daily cap:", error);
        throw new Error("Failed to check daily earning cap");
      }
    }),

  /**
   * Earn IxCredits (internal use by other systems)
   * Admin-only endpoint
   */
  earnCredits: adminProcedure
    .input(
      z.object({
        amount: z.number().min(0.01, "Amount must be positive"),
        type: vaultTransactionTypeEnum,
        source: z.string().min(1, "Source is required"),
        metadata: z.record(z.any()).optional(),
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
          ctx.db,
          input.metadata
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to earn credits");
        }

        return {
          success: true,
          newBalance: result.newBalance,
          amountEarned: input.amount,
          message: `Earned ${input.amount} IxC. New balance: ${result.newBalance} IxC`,
        };
      } catch (error) {
        console.error("[Vault Router] Error earning credits:", error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Failed to earn credits");
      }
    }),

  /**
   * Get user stats (totalCards, deckValue)
   * Admin-only endpoint
   */
  getUserStats: adminProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.user?.id) {
        throw new Error("User not found in authentication context");
      }

      return {
        totalCards: ctx.user.totalCards ?? 0,
        deckValue: ctx.user.deckValue ?? 0,
        collectorLevel: ctx.user.collectorLevel ?? 1,
        collectorXp: ctx.user.collectorXp ?? 0,
      };
    } catch (error) {
      console.error("[Vault Router] Error getting user stats:", error);
      throw new Error("Failed to retrieve user stats");
    }
  }),
});
