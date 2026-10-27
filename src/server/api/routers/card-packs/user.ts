// src/server/api/routers/card-packs.ts
// Card pack router for IxCards system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  purchasePack,
  openPack,
  getUserPacks,
  bestPulledRarity,
  PackError,
} from "~/lib/cards/pack-service";
import { CardRarity } from "~/lib/cards/enums";
import { RARITY_LABEL, rarityRank } from "~/lib/cards/face/labels";
import { cardCount } from "~/lib/cards/curation-limits";
import { LedgerError } from "~/lib/vault/vault-ledger";
import { notifyCard } from "~/lib/cards/card-notify";
import { globalCache } from "~/lib/cache";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { facesAfterCommit } from "~/lib/cards/hub/committed-faces";

/**
 * Card Packs Router
 * Handles pack creation, purchasing, and opening mechanics
 */
export const cardPacksUserRouter = createTRPCRouter({
  // ============================================================
  // PROTECTED ENDPOINTS (Authenticated Users)
  // ============================================================

  /**
   * Get user's packs (unopened by default)
   * Admin-only endpoint
   */
  getMyPacks: protectedProcedure
    .input(
      z
        .object({
          isOpened: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          });
        }

        const packs = await getUserPacks(ctx.db, ctx.user.id, input?.isOpened);

        return {
          success: true,
          packs,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[CardPacks] Error fetching user packs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user packs",
        });
      }
    }),

  /**
   * Purchase pack with IxCredits
   * Admin-only endpoint
   */
  purchasePack: rateLimitedMutationProcedure
    .input(
      z.object({
        packId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          });
        }

        const userPack = await purchasePack(ctx.db, ctx.user.id, input.packId);

        await notifyCard(ctx.db, {
          userId: ctx.user.id,
          title: "Pack bought",
          message: "Your card pack is ready to open.",
          category: "packs",
          metadata: { packId: input.packId },
        });

        await Promise.all([
          ...(ctx.auth?.userId
            ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)]
            : []),
          globalCache.delete(`user_vault_balance:${ctx.user.id}`),
        ]);

        return {
          success: true,
          message: "Pack purchased successfully",
          userPack,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof LedgerError) {
          throw new TRPCError({
            code: error.code === "INSUFFICIENT_CREDITS" ? "FORBIDDEN" : "PRECONDITION_FAILED",
            message: error.message,
          });
        }
        if (error instanceof PackError) {
          throw new TRPCError({ code: error.code, message: error.message });
        }

        console.error("[CardPacks] Error purchasing pack:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to purchase pack",
        });
      }
    }),

  /**
   * Opens one of the caller's packs and returns the faces of the copies it minted, in pull order
   */
  openPack: rateLimitedMutationProcedure
    .input(
      z.object({
        userPackId: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          });
        }

        const results = await openPack(ctx.db, ctx.user.id, input.userPackId);
        queueAchievementCheck(ctx.user.id);

        const bestRarity = bestPulledRarity(results.map((r) => r.card));
        await notifyCard(ctx.db, {
          userId: ctx.user.id,
          title: "Cards revealed",
          message: `${cardCount(results.length)}. Best: ${RARITY_LABEL[bestRarity]}.`,
          category: "packs",
          // Epic and up, in schema order (Epic ranks above Ultra Rare).
          priority: rarityRank(bestRarity) >= rarityRank(CardRarity.EPIC) ? "high" : "medium",
          metadata: { cardCount: results.length, bestRarity },
        });

        await globalCache.delete(`user_vault_stats:${ctx.user.id}`);

        // Read after the side effects above: the pack is open whether or not this read succeeds.
        const faces = await facesAfterCommit(
          ctx.db,
          results.map((r) => r.ownershipId),
          "A pack open"
        );
        return {
          success: true,
          message: `Opened pack and received ${results.length} cards!`,
          faces,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof PackError) {
          throw new TRPCError({ code: error.code, message: error.message });
        }

        console.error("[CardPacks] Error opening pack:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to open pack",
        });
      }
    }),
});
