// src/server/api/routers/card-packs.ts
// Card pack router for IxCards system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { purchasePack, openPack, getAvailablePacks, getUserPacks } from "~/lib/card-pack-service";
import { syncUserToForum } from "~/modules/forum";
import { notificationAPI } from "~/lib/notification-api";

/**
 * Card Packs Router
 * Handles pack creation, purchasing, and opening mechanics
 */
export const cardPacksRouter = createTRPCRouter({
  // ============================================================
  // PUBLIC ENDPOINTS
  // ============================================================

  /**
   * Get all available packs for purchase
   * Admin-only endpoint
   */
  getAvailablePacks: protectedProcedure.query(async ({ ctx }) => {
    try {
      const packs = await getAvailablePacks(ctx.db);

      return {
        success: true,
        packs,
      };
    } catch (error) {
      console.error("[CardPacks] Error fetching available packs:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch available packs",
      });
    }
  }),

  /**
   * Get pack details by ID
   * Admin-only endpoint
   */
  getPackById: protectedProcedure
    .input(
      z.object({
        packId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const pack = await ctx.db.cardPack.findUnique({
          where: { id: input.packId },
        });

        if (!pack) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pack not found",
          });
        }

        // Calculate availability status
        const canPurchase = pack.isActive;

        return {
          success: true,
          pack,
          status: {
            canPurchase,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[CardPacks] Error fetching pack:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch pack details",
        });
      }
    }),

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

  /**
   * Get all packs (including inactive) for admin management
   */
  getAllPacks: adminProcedure.query(async ({ ctx }) => {
    const packs = await ctx.db.cardPack.findMany({
      orderBy: [{ isActive: "desc" }, { packType: "asc" }, { priceCredits: "asc" }],
    });
    return { packs };
  }),

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
