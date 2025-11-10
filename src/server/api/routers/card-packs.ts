// src/server/api/routers/card-packs.ts
// Card pack router for IxCards system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import {
  purchasePack,
  openPack,
  getAvailablePacks,
  getUserPacks,
} from "~/lib/card-pack-service";

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
  getAvailablePacks: adminProcedure.query(async ({ ctx }) => {
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
  getPackById: adminProcedure
    .input(
      z.object({
        packId: z.string().cuid(),
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
  getMyPacks: adminProcedure
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

        const packs = await getUserPacks(
          ctx.db,
          ctx.user.id,
          input?.isOpened
        );

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
  purchasePack: adminProcedure
    .input(
      z.object({
        packId: z.string().cuid(),
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
  openPack: adminProcedure
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

        const cards = await openPack(ctx.db, ctx.user.id, input.userPackId);

        // Format cards with rarity reveal data
        const revealData = cards.map((card) => ({
          id: card.id,
          name: card.title,
          rarity: card.rarity,
          cardType: card.cardType,
          artwork: card.artwork,
          season: card.season,
        }));

        return {
          success: true,
          message: `Opened pack and received ${cards.length} cards!`,
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
   * Create new pack configuration
   * Admin-only endpoint
   */
  createPack: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
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
            id: `pack_${Date.now()}`,
            name: input.name,
            description: input.description,
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
          message:
            error instanceof Error
              ? error.message
              : "Failed to create pack",
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
        packId: z.string().cuid(),
        updates: z.object({
          name: z.string().min(1).max(100).optional(),
          description: z.string().optional(),
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
        packId: z.string().cuid(),
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
});
