// src/server/api/routers/card-packs.ts
// Card pack router for IxCards system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { notificationAPI } from "~/lib/notification-api";

/**
 * Card Packs Router
 * Handles pack creation, purchasing, and opening mechanics
 */
export const cardPacksAdminRouter = createTRPCRouter({
  // ============================================================
  // PUBLIC ENDPOINTS
  // ============================================================

  // ============================================================
  // PROTECTED ENDPOINTS (Authenticated Users)
  // ============================================================

  // ============================================================
  // ADMIN ENDPOINTS
  // ============================================================

  /**
   * Create new pack configuration
   * Admin-only endpoint
   */
  createPack: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        artwork: z.string().optional(),
        packType: z.string(),
        priceCredits: z.number().positive(),
        cardCount: z.number().int().min(1).max(20).default(5),
        guaranteedRarity: z.string().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const pack = await ctx.db.cardPack.create({
          data: {
            name: input.name,
            description: input.description,
            artwork: input.artwork,
            packType: input.packType,
            priceCredits: input.priceCredits,
            cardCount: input.cardCount,
            guaranteedRarity: input.guaranteedRarity,
            isActive: input.isActive,
          },
        });

        return {
          success: true,
          message: "Pack created successfully",
          pack,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[CardPacks] Error creating pack:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create pack",
        });
      }
    }),

  /**
   * Update pack configuration
   * Admin-only endpoint
   */
  updatePack: adminProcedure
    .input(
      z.object({
        packId: z.string().min(1),
        updates: z.object({
          name: z.string().min(1).max(100).optional(),
          description: z.string().optional(),
          artwork: z.string().optional().nullable(),
          cardCount: z.number().int().min(1).max(20).optional(),
          packType: z.string().optional(),
          priceCredits: z.number().positive().optional(),
          guaranteedRarity: z.string().optional(),
          isActive: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const pack = await ctx.db.cardPack.update({
          where: { id: input.packId },
          data: input.updates,
        });

        return {
          success: true,
          message: "Pack updated successfully",
          pack,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[CardPacks] Error updating pack:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update pack",
        });
      }
    }),

  /**
   * Deactivate pack
   * Admin-only endpoint
   */
  deactivatePack: adminProcedure
    .input(
      z.object({
        packId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const pack = await ctx.db.cardPack.update({
          where: { id: input.packId },
          data: {
            isActive: false,
          },
        });

        return {
          success: true,
          message: "Pack deactivated successfully",
          pack,
        };
      } catch (error) {
        console.error("[CardPacks] Error deactivating pack:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to deactivate pack",
        });
      }
    }),

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
