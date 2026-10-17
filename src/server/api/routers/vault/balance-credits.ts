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

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { vaultService } from "~/lib/vault/vault-service";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { grantNewPlayerBonus, NEW_PLAYER_BONUS_ON_VAULT_OPEN } from "~/lib/vault/vault-bonus";
import { deckValue } from "~/lib/cards/copy-value";
import { isTrophyCard } from "~/lib/lorewards/trophy-cards";
import { globalCache } from "~/lib/cache";
import { sentenceCase } from "~/lib/format/sentence-case";

interface VaultUserStats {
  totalCards: number;
  deckValue: number;
  deckValueExTrophy: number;
}

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
      // Same curve as the ledger: configured XP per level.
      const { xpPerLevel } = await getVaultConfig(ctx.db);
      const vaultLevel = Math.floor(balance.vaultXp / xpPerLevel) + 1;

      return {
        vaultLevel,
        vaultXp: balance.vaultXp,
        nextLevelXp: vaultLevel * xpPerLevel,
        progress: (balance.vaultXp % xpPerLevel) / xpPerLevel,
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
        return labels[source] || sentenceCase(source);
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
   * The caller's card figures: copies held and their value, with and without trophy cards (cached 30 s). Every copy
   * counts, a hidden (retired) card's too, as the inventory lists them; a retired card is not valued, as in the
   * dividend.
   */
  getUserStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const cacheKey = `user_vault_stats:${ctx.user.id}`;
      const cached = await globalCache.get<VaultUserStats>(cacheKey);
      if (cached) return cached;

      const copies = await ctx.db.cardOwnership.findMany({
        where: { ownerId: ctx.user.id },
        select: { cards: { select: { marketValue: true, cardType: true, isRetired: true } } },
      });
      const valued = copies.filter((copy) => !copy.cards.isRetired);
      const stats: VaultUserStats = {
        totalCards: copies.length,
        deckValue: deckValue(valued),
        // The figure the economy and the deck-value achievements read: trophy cards do not count.
        deckValueExTrophy: deckValue(valued.filter((copy) => !isTrophyCard(copy.cards))),
      };
      await globalCache.set(cacheKey, stats, { ttl: 30 });
      return stats;
    } catch (error) {
      console.error("[Vault Router] Error getting user stats:", error);
      throw new Error("Failed to retrieve user stats", { cause: error });
    }
  }),
});
