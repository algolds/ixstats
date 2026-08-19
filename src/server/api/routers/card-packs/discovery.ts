// src/server/api/routers/card-packs.ts
// Card pack router for IxCards system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { getAvailablePacks } from "~/lib/cards";

/**
 * Card Packs Router
 * Handles pack creation, purchasing, and opening mechanics
 */
export const cardPacksDiscoveryRouter = createTRPCRouter({
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
});
