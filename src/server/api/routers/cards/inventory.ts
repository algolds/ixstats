// src/server/api/routers/cards/inventory.ts
// Inventory sub-router for IxCards

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getUserCards } from "~/lib/cards/card-service";
import { CardRarity } from "@prisma/client";
import { refusesTradeOffer } from "~/server/shared/privacy-permissions";
import { blankUnseenArt } from "~/lib/cards/hub/market-faces";

/**
 * Cards Inventory router
 */
export const cardsInventoryRouter = createTRPCRouter({
  /**
   * Get authenticated user's card inventory
   */
  getMyCards: protectedProcedure
    .input(
      z.object({
        sortBy: z.enum(["rarity", "acquired", "value"]).optional().default("acquired"),
        filterRarity: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID not found",
          });
        }

        let filterRarity: CardRarity | undefined;
        if (input.filterRarity) {
          if (Object.values(CardRarity).includes(input.filterRarity as CardRarity)) {
            filterRarity = input.filterRarity as CardRarity;
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid rarity filter: ${input.filterRarity}`,
            });
          }
        }

        const ownerships = await getUserCards(ctx.db, ctx.user.id, input.sortBy, filterRarity);
        // The raw card follows its face: a hidden (retired) card keeps its artwork in a Library hide, but shows none
        return blankUnseenArt(ctx.db, ctx.user.id, ownerships);
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getMyCards:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user cards",
        });
      }
    }),

  /** Another player's tradeable copies, for building a trade offer. */
  getUserCards: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        sortBy: z.enum(["rarity", "acquired", "value"]).optional().default("acquired"),
        filterRarity: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        let filterRarity: CardRarity | undefined;
        if (input.filterRarity) {
          if (Object.values(CardRarity).includes(input.filterRarity as CardRarity)) {
            filterRarity = input.filterRarity as CardRarity;
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid rarity filter: ${input.filterRarity}`,
            });
          }
        }

        const partner = await ctx.db.user.findUnique({
          where: input.userId.startsWith("user_")
            ? { clerkUserId: input.userId }
            : { id: input.userId },
          select: { id: true, clerkUserId: true },
        });
        if (!partner) return [];

        // Only a viewer who may send this partner a trade offer sees their copies: the partner's
        // trade-offer audience and block list (SL-4), as createtradeOffer checks them.
        if (await refusesTradeOffer(ctx.db, ctx.auth.userId, partner.clerkUserId)) return [];

        const ownerships = await ctx.db.cardOwnership.findMany({
          // A trade partner sees only the copies they could trade (cards refresh §3): unlocked, not
          // bound, not inscribed; Phase 4 lifts the inscription block. Retired and taken-down copies
          // stay tradeable (§3 UX details), so they are listed.
          where: {
            ownerId: partner.id,
            isLocked: false,
            inscription: null,
            cards: { isBound: false, ...(filterRarity && { rarity: filterRarity }) },
          },
          include: {
            cards: true,
          },
          orderBy:
            input.sortBy === "rarity"
              ? { cards: { rarity: "desc" } }
              : input.sortBy === "value"
                ? { cards: { marketValue: "desc" } }
                : { acquiredAt: "desc" },
          take: input.limit,
        });

        const rows = await blankUnseenArt(ctx.db, ctx.user.id, ownerships);
        // No client reads a partner's card metadata, and it holds admin-only fields (qualityScore)
        return rows.map((row) => ({ ...row, cards: { ...row.cards, metadata: null } }));
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getUserCards:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user cards",
        });
      }
    }),
});
