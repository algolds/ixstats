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
import { notificationAPI } from "~/lib/notifications/api";
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

export const vaultDailyClaimsRouter = createTRPCRouter({
  /**
   * Get vault balance and stats for a user
   */
  claimDailyBonus: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const result = await vaultService.claimDailyBonus(ctx.auth.userId, ctx.db as any);

      if (!result.success) {
        throw new Error(result.message || "Failed to claim daily bonus");
      }

      await globalCache.delete(`user_vault_balance:${ctx.auth.userId}`);

      // Notification: daily bonus claimed (fire-and-forget)
      try {
        await notificationAPI.create({
          userId: ctx.auth.userId,
          title: "Daily Bonus Claimed",
          message: `+${result.bonus} IxCredits! ${result.streak}-day streak`,
          type: "info",
          category: "achievement",
          priority: "low",
          metadata: { bonus: result.bonus, streak: result.streak },
        });
      } catch {}

      return {
        success: true,
        bonus: result.bonus,
        streak: result.streak,
        message: `Claimed ${result.bonus} IxCredits! Streak: ${result.streak} days`,
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
   * Claim combined daily claim (credits jackpot OR random card)
   */
  claimCombinedDailyClaim: protectedProcedure
    .input(z.object({ choice: z.enum(["CREDITS", "CARD"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        const result = await vaultService.claimCombinedDailyClaim(
          ctx.auth.userId,
          input.choice,
          ctx.db as any
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to claim daily reward");
        }

        await Promise.all([
          globalCache.delete(`user_vault_balance:${ctx.auth.userId}`),
          globalCache.delete(`user_vault_stats:${ctx.user.id}`),
        ]);

        // Send notification
        try {
          const rewardMessage =
            result.rewardType === "credits"
              ? `+${result.creditsAwarded} IxCredits! ${result.streak}-day streak`
              : `Pulled daily card: ${result.cardAwarded?.title}! ${result.streak}-day streak`;

          await notificationAPI.create({
            userId: ctx.auth.userId,
            title: "Daily Claim Successful",
            message: rewardMessage,
            type: "info",
            category: "achievement",
            priority: "low",
            metadata: {
              rewardType: result.rewardType,
              credits: result.creditsAwarded,
              card: result.cardAwarded,
              streak: result.streak,
            },
          });
        } catch {}

        return result;
      } catch (error) {
        console.error("[Vault Router] Error claiming combined daily reward:", error);
        if (error instanceof Error) throw error;
        throw new Error("Failed to claim combined daily reward");
      }
    }),

  /**
   * Claim streak bonus (updates login streak)
   */
  claimStreakBonus: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        throw new Error("User ID not found in authentication context");
      }

      const newStreak = await vaultService.updateLoginStreak(ctx.auth.userId, ctx.db as any);

      await globalCache.delete(`user_vault_balance:${ctx.auth.userId}`);

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
   */
  checkDailyCap: protectedProcedure
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
          ctx.db as any
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
  adminAdjustStreak: adminProcedure
    .input(
      z.object({
        targetUserId: z.string().min(1),
        delta: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Ensure target user exists (upsert vault if missing)
        let vault = await ctx.db.myVault.findUnique({ where: { userId: input.targetUserId } });
        if (!vault) {
          vault = await ctx.db.myVault.create({
            data: {
              userId: input.targetUserId,
              credits: 0,
              lifetimeEarned: 0,
              lifetimeSpent: 0,
              todayEarned: 0,
              lastDailyReset: new Date(),
              loginStreak: 0,
              vaultLevel: 1,
              vaultXp: 0,
            },
          });
        }

        const newStreak = Math.max(0, (vault.loginStreak ?? 0) + input.delta);

        await ctx.db.myVault.update({ where: { id: vault.id }, data: { loginStreak: newStreak } });

        const targetUser = await ctx.db.user.findUnique({
          where: { id: input.targetUserId },
          select: { clerkUserId: true },
        });
        if (targetUser?.clerkUserId) {
          await globalCache.delete(`user_vault_balance:${targetUser.clerkUserId}`);
        }
        await globalCache.delete(`user_vault_balance:${input.targetUserId}`);

        return { success: true, newStreak };
      } catch (error) {
        console.error("[Vault Router] Error adjusting streak:", error);
        throw new Error("Failed to adjust user streak");
      }
    }),

  /**
   * Admin: List user vault transactions
   */
});
