// src/server/api/routers/card-packs.ts
// Card pack router for IxCards system

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { getAvailablePacks } from "~/lib/cards/pack-service";

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
