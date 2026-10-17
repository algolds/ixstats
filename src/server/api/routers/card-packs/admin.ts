// src/server/api/routers/card-packs.ts
// Card pack router for IxCards system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { notificationAPI } from "~/lib/notifications/api";

/**
 * Card Packs Router (admin): awarding a pack to a player. The pack editor is `cards.admin.packs`.
 */
export const cardPacksAdminRouter = createTRPCRouter({
  // ============================================================
  // ADMIN ENDPOINTS
  // ============================================================

  /**
   * Award a pack directly to a user (admin only)
   */
  adminAwardPack: adminProcedure
    .input(
      z.object({
        targetUserId: z.string().min(1, "Target User ID is required"),
        packId: z.string().min(1, "Pack ID is required"),
        acquiredMethod: z.string().default("ADMIN_AWARD"),
        sendNotification: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const pack = await ctx.db.cardPack.findUnique({
          where: { id: input.packId },
        });

        if (!pack) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pack config not found",
          });
        }

        // Create UserPack record
        const userPack = await ctx.db.userPack.create({
          data: {
            userId: input.targetUserId,
            packId: input.packId,
            isOpened: false,
            acquiredMethod: input.acquiredMethod,
          },
          include: { pack: true },
        });

        // Trigger notification if requested
        if (input.sendNotification) {
          try {
            await notificationAPI.create({
              userId: input.targetUserId,
              title: "Pack Received!",
              message: `You have been awarded a ${userPack.pack.name} by an Administrator!`,
              type: "info",
              category: "achievement",
              priority: "high",
              metadata: { packId: input.packId, userPackId: userPack.id },
            });
          } catch (e) {
            console.error("[CardPacks] Failed to send pack award notification:", e);
          }
        }

        return {
          success: true,
          message: `Successfully awarded pack: ${userPack.pack.name} to user.`,
          userPack,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[CardPacks] Error awarding pack:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to award pack to user",
        });
      }
    }),
});
