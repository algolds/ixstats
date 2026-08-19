// src/server/api/routers/card-packs.ts
// Card pack router for IxCards system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { purchasePack, openPack, getUserPacks } from "~/lib/cards";
import { syncUserToForum } from "~/server/modules/forum";
import { notificationAPI } from "~/lib/notifications/api";
import { globalCache } from "~/lib/cache";

/**
 * Card Packs Router
 * Handles pack creation, purchasing, and opening mechanics
 */
export const cardPacksUserRouter = createTRPCRouter({
  // ============================================================
  // PUBLIC ENDPOINTS
  // ============================================================

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
  purchasePack: protectedProcedure
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

        // Sync to forum profile (fire-and-forget)
        syncUserToForum(ctx.user.id).catch((err: unknown) => {
          console.error("[CardPacks] Background op failed:", (err as Error).message);
        });

        // Notification: pack purchased (fire-and-forget)
        try {
          await notificationAPI.create({
            userId: ctx.user.id,
            title: "Pack Purchased",
            message: "Your card pack is ready to open!",
            type: "info",
            category: "achievement",
            priority: "medium",
            metadata: { packId: input.packId },
          });
        } catch {}

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
        // Handle specific error messages from service
        if (error instanceof Error) {
          if (
            error.message.includes("not found") ||
            error.message.includes("not available") ||
            error.message.includes("expired") ||
            error.message.includes("sold out") ||
            error.message.includes("limit reached")
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }

          if (error.message.includes("Insufficient credits")) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: error.message,
            });
          }
        }

        console.error("[CardPacks] Error purchasing pack:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to purchase pack",
        });
      }
    }),

  /**
   * Open pack and reveal cards
   * Admin-only endpoint
   */
  openPack: protectedProcedure
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

        // Sync to forum profile (fire-and-forget)
        syncUserToForum(ctx.user.id).catch((err: unknown) => {
          console.error("[CardPacks] Background op failed:", (err as Error).message);
        });

        // Format cards with rarity reveal data
        const revealData = results.map(({ card, ownershipId }) => ({
          id: card.id,
          ownershipId,
          name: card.title,
          rarity: card.rarity,
          cardType: card.cardType,
          artwork: card.artwork,
          season: card.season,
        }));

        // Notification: cards revealed (fire-and-forget)
        try {
          const bestRarity = results.reduce((best, r) => {
            const order = ["COMMON", "UNCOMMON", "RARE", "EPIC", "ULTRA_RARE", "LEGENDARY"];
            return order.indexOf(r.card.rarity) > order.indexOf(best) ? r.card.rarity : best;
          }, "COMMON");
          await notificationAPI.create({
            userId: ctx.user.id,
            title: "Cards Revealed!",
            message: `${results.length} cards obtained! Best: ${bestRarity.replace("_", " ")}`,
            type: "info",
            category: "achievement",
            priority: bestRarity === "LEGENDARY" || bestRarity === "ULTRA_RARE" ? "high" : "medium",
            metadata: { cardCount: results.length, bestRarity },
          });
        } catch {}

        await globalCache.delete(`user_vault_stats:${ctx.user.id}`);

        return {
          success: true,
          message: `Opened pack and received ${results.length} cards!`,
          cards: revealData,
        };
      } catch (error) {
        // Handle specific error messages from service
        if (error instanceof Error) {
          if (
            error.message.includes("not found") ||
            error.message.includes("Unauthorized") ||
            error.message.includes("already been opened")
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
        }

        console.error("[CardPacks] Error opening pack:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to open pack",
        });
      }
    }),

  // ============================================================
  // ADMIN ENDPOINTS
  // ============================================================
});
