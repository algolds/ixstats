/**
 * MyVault Router
 *
 * tRPC router for IxCredits economy operations
 * Provides endpoints for:
 * - Balance queries
 * - Transaction history
 * - The daily reward and streaks
 * - Credit spending
 * - Vault level and earnings summaries
 */

import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, adminProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { vaultService } from "~/lib/vault/vault-service";
import { ownedFaces } from "~/lib/cards/hub/faces";
import { notificationAPI } from "~/lib/notifications/api";
import { globalCache } from "~/lib/cache";
import type { CardFaceData } from "~/lib/cards/face/types";

/**
 * The face of the copy a daily card claim minted. The claimer holds it, so its art shows (a retired card keeps the
 * placeholder face). The claim has already committed, so a failed read drops the face instead of failing the claim.
 */
async function claimedFace(
  db: PrismaClient,
  ownershipId: string | undefined
): Promise<CardFaceData | null> {
  if (!ownershipId) return null;
  try {
    const [face] = await ownedFaces(db, [ownershipId]);
    return face ?? null;
  } catch (error) {
    console.error("[Vault Router] Daily card face read failed:", error);
    return null;
  }
}

export const vaultDailyClaimsRouter = createTRPCRouter({
  /**
   * Claim combined daily claim (credits jackpot OR random card)
   */
  claimCombinedDailyClaim: rateLimitedMutationProcedure
    .input(z.object({ choice: z.enum(["CREDITS", "CARD"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        const result = await vaultService.claimCombinedDailyClaim(
          ctx.auth.userId,
          input.choice,
          ctx.db
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
        } catch (err) {
          console.warn("[Vault Router] Daily claim notification failed:", err);
        }

        return { ...result, cardFace: await claimedFace(ctx.db, result.cardAwarded?.ownershipId) };
      } catch (error) {
        console.error("[Vault Router] Error claiming combined daily reward:", error);
        if (error instanceof Error) throw error;
        throw new Error("Failed to claim combined daily reward", { cause: error });
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
        throw new Error("Failed to adjust user streak", { cause: error });
      }
    }),
});
