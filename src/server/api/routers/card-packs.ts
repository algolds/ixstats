// src/server/api/routers/card-packs.ts
// Card pack router for IxCards system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { PackType, CardType } from "@prisma/client";
import {
  createPack,
  purchasePack,
  openPack,
  getAvailablePacks,
  getUserPacks,
  validatePackOdds,
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
   */
  getAvailablePacks: publicProcedure.query(async ({ ctx }) => {
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
   */
  getPackById: publicProcedure
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
        const now = new Date();
        const isExpired = pack.expiresAt ? pack.expiresAt < now : false;
        const isSoldOut = pack.limitedQuantity
          ? await ctx.db.userPack
              .count({ where: { packId: pack.id } })
              .then((count) => count >= (pack.limitedQuantity ?? 0))
          : false;

        return {
          success: true,
          pack,
          status: {
            isExpired,
            isSoldOut,
            canPurchase: pack.isAvailable && !isExpired && !isSoldOut,
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
   */
  purchasePack: protectedProcedure
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

        const cards = await openPack(ctx.db, ctx.user.id, input.userPackId);

        // Format cards with rarity reveal data
        const revealData = cards.map((card) => ({
          id: card.id,
          name: card.name,
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
   * Create new pack configuration (admin only)
   */
  createPack: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        artwork: z.string().url(),
        cardCount: z.number().int().min(1).max(20).default(5),
        packType: z.nativeEnum(PackType),
        priceCredits: z.number().positive(),
        // Rarity odds (must sum to 100)
        commonOdds: z.number().min(0).max(100).default(65),
        uncommonOdds: z.number().min(0).max(100).default(25),
        rareOdds: z.number().min(0).max(100).default(7),
        ultraRareOdds: z.number().min(0).max(100).default(2),
        epicOdds: z.number().min(0).max(100).default(0.9),
        legendaryOdds: z.number().min(0).max(100).default(0.1),
        // Optional filters
        season: z.number().int().positive().optional(),
        cardType: z.nativeEnum(CardType).optional(),
        themeFilter: z
          .object({
            region: z.string().optional(),
            era: z.string().optional(),
          })
          .optional(),
        // Availability settings
        isAvailable: z.boolean().default(true),
        limitedQuantity: z.number().int().positive().optional(),
        purchaseLimit: z.number().int().positive().optional(),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check admin role
        if (!ctx.user || ctx.user.role?.name !== "ADMIN") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Unauthorized: Admin access required",
          });
        }

        // Validate odds before creating
        const odds = {
          commonOdds: input.commonOdds,
          uncommonOdds: input.uncommonOdds,
          rareOdds: input.rareOdds,
          ultraRareOdds: input.ultraRareOdds,
          epicOdds: input.epicOdds,
          legendaryOdds: input.legendaryOdds,
        };

        if (!validatePackOdds(odds)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Pack odds validation failed: odds must sum to 100%. Current sum: ${Object.values(odds).reduce((a, b) => a + b, 0).toFixed(2)}%`,
          });
        }

        const pack = await createPack(ctx.db, input);

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
   * Update pack configuration (admin only)
   */
  updatePack: protectedProcedure
    .input(
      z.object({
        packId: z.string().cuid(),
        updates: z.object({
          name: z.string().min(1).max(100).optional(),
          description: z.string().optional(),
          artwork: z.string().url().optional(),
          cardCount: z.number().int().min(1).max(20).optional(),
          packType: z.nativeEnum(PackType).optional(),
          priceCredits: z.number().positive().optional(),
          commonOdds: z.number().min(0).max(100).optional(),
          uncommonOdds: z.number().min(0).max(100).optional(),
          rareOdds: z.number().min(0).max(100).optional(),
          ultraRareOdds: z.number().min(0).max(100).optional(),
          epicOdds: z.number().min(0).max(100).optional(),
          legendaryOdds: z.number().min(0).max(100).optional(),
          season: z.number().int().positive().optional(),
          cardType: z.nativeEnum(CardType).optional(),
          themeFilter: z
            .object({
              region: z.string().optional(),
              era: z.string().optional(),
            })
            .optional(),
          isAvailable: z.boolean().optional(),
          limitedQuantity: z.number().int().positive().optional(),
          purchaseLimit: z.number().int().positive().optional(),
          expiresAt: z.date().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check admin role
        if (!ctx.user || ctx.user.role?.name !== "ADMIN") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Unauthorized: Admin access required",
          });
        }

        // If updating odds, validate the final sum
        if (
          input.updates.commonOdds !== undefined ||
          input.updates.uncommonOdds !== undefined ||
          input.updates.rareOdds !== undefined ||
          input.updates.ultraRareOdds !== undefined ||
          input.updates.epicOdds !== undefined ||
          input.updates.legendaryOdds !== undefined
        ) {
          // Get current pack to merge odds
          const currentPack = await ctx.db.cardPack.findUnique({
            where: { id: input.packId },
          });

          if (!currentPack) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Pack not found",
            });
          }

          const finalOdds = {
            commonOdds: input.updates.commonOdds ?? currentPack.commonOdds,
            uncommonOdds:
              input.updates.uncommonOdds ?? currentPack.uncommonOdds,
            rareOdds: input.updates.rareOdds ?? currentPack.rareOdds,
            ultraRareOdds:
              input.updates.ultraRareOdds ?? currentPack.ultraRareOdds,
            epicOdds: input.updates.epicOdds ?? currentPack.epicOdds,
            legendaryOdds:
              input.updates.legendaryOdds ?? currentPack.legendaryOdds,
          };

          if (!validatePackOdds(finalOdds)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Pack odds validation failed: odds must sum to 100%. New sum: ${Object.values(finalOdds).reduce((a, b) => a + b, 0).toFixed(2)}%`,
            });
          }
        }

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
   * Deactivate pack (admin only)
   */
  deactivatePack: protectedProcedure
    .input(
      z.object({
        packId: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check admin role
        if (!ctx.user || ctx.user.role?.name !== "ADMIN") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Unauthorized: Admin access required",
          });
        }

        const pack = await ctx.db.cardPack.update({
          where: { id: input.packId },
          data: {
            isAvailable: false,
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
