// src/server/api/routers/cards/inventory.ts
// Inventory & Library sub-router for IxCards

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { getUserCards } from "~/lib/cards/card-service";
import { CardRarity, CardType } from "@prisma/client";
import { cteFilterSchema, LIBRARY_ORDER, LIBRARY_SORTS, libraryWhere } from "./_library";

/**
 * Cards Inventory & Library router
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
        return ownerships;
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

  /**
   * The caller's most valuable cards (the Wallet showcase): one ownership per card, trophy cards
   * included, so the Vault page never loads the whole inventory for three of them.
   */
  getMyTopCards: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(12).default(3) }).default({ limit: 3 }))
    .query(({ ctx, input }) =>
      ctx.db.cardOwnership.findMany({
        where: { ownerId: ctx.user.id, cards: { isRetired: false } },
        include: { cards: true },
        orderBy: [{ cards: { marketValue: "desc" } }, { cardId: "asc" }],
        distinct: ["cardId"],
        take: input.limit,
      })
    ),

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

        let targetDbUserId = input.userId;
        if (input.userId.startsWith("user_")) {
          const targetUser = await ctx.db.user.findUnique({
            where: { clerkUserId: input.userId },
            select: { id: true },
          });
          if (targetUser) {
            targetDbUserId = targetUser.id;
          }
        }

        const ownerships = await ctx.db.cardOwnership.findMany({
          // A trade partner sees only the copies they could trade (cards refresh §3): unlocked and not bound.
          // Retired and taken-down copies stay tradeable (§3 UX details), so they are listed.
          where: {
            ownerId: targetDbUserId,
            isLocked: false,
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

        return ownerships;
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

  /** Admin: card counts by type and category, and pending requests. */
  getLoreStats: adminProcedure.query(async ({ ctx }) => {
    const live = { isRetired: false };
    const [totalCards, totalLoreCards, totalNSCards, pendingRequests, categoryGroups] =
      await Promise.all([
        ctx.db.card.count({ where: live }),
        ctx.db.card.count({ where: { ...live, cardType: CardType.LORE } }),
        ctx.db.card.count({ where: { ...live, cardType: CardType.NS } }),
        ctx.db.loreCardRequest.count({ where: { status: "PENDING" } }),
        ctx.db.card.groupBy({
          by: ["category"],
          where: { ...live, category: { not: null } },
          _count: { id: true },
        }),
      ]);
    const categoryBreakdown: Record<string, number> = {};
    for (const group of categoryGroups)
      if (group.category) categoryBreakdown[group.category] = group._count.id;
    return { totalCards, totalLoreCards, totalNSCards, pendingRequests, categoryBreakdown };
  }),

  /** The card library for signed-in players: every live card, filterable; never a retired one. */
  getNSCards: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
        search: z.string().max(100).optional(),
        season: z.number().int().min(1).optional(),
        rarity: z.nativeEnum(CardRarity).optional(),
        region: z.string().max(100).optional(),
        cteFilter: cteFilterSchema.optional().default("all"),
        sortBy: z.enum(LIBRARY_SORTS).optional().default("recent"),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = libraryWhere({ ...input, retired: false });
      const [total, cards] = await Promise.all([
        ctx.db.card.count({ where }),
        ctx.db.card.findMany({
          where,
          orderBy: LIBRARY_ORDER[input.sortBy],
          take: input.limit,
          skip: input.offset,
        }),
      ]);
      return { cards, total, hasMore: input.offset + input.limit < total };
    }),

  /**
   * Get NS Library statistics
   */
  getNSLibraryStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const [totalCards, cteCardsCount, retiredCardsCount, cardsByRegion, lastSync] =
        await Promise.all([
          ctx.db.card.count({
            where: {
              cardType: CardType.NS,
              isRetired: false,
            },
          }),
          ctx.db.card.count({
            where: {
              cardType: CardType.NS,
              isRetired: false,
              metadata: { path: ["isCTE"], equals: true },
            },
          }),
          ctx.db.card.count({
            where: {
              cardType: CardType.NS,
              isRetired: true,
            },
          }),
          ctx.db.$queryRaw<Array<{ region: string; count: number }>>`
            SELECT metadata->'nsData'->>'region' AS region, COUNT(*)::int AS count
            FROM cards
            WHERE "cardType" = 'NS' AND "isRetired" = false
              AND COALESCE(metadata->'nsData'->>'region', '') <> ''
            GROUP BY 1
            ORDER BY count DESC
            LIMIT 20
          `,
          ctx.db.syncLog.findFirst({
            where: { syncType: { startsWith: "NS_" } },
            orderBy: { startedAt: "desc" },
            select: { startedAt: true, status: true, syncType: true },
          }),
        ]);

      const activeCardsCount = Math.max(0, totalCards - cteCardsCount);

      return {
        totalCards,
        cteCardsCount,
        retiredCardsCount,
        activeCardsCount,
        cardsByRegion: cardsByRegion ?? [],
        lastSync: lastSync
          ? { at: lastSync.startedAt, status: lastSync.status, type: lastSync.syncType }
          : null,
      };
    } catch (error) {
      console.error("[CARDS_ROUTER] Error in getNSLibraryStats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch NS library stats",
      });
    }
  }),
});
