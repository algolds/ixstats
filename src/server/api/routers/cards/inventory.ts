// src/server/api/routers/cards/inventory.ts
// Inventory & Library sub-router for IxCards

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { getUserCards } from "~/lib/cards";
import { CardRarity } from "@prisma/client";
import { globalCache } from "~/lib/cache";
import { getValuationConfig, junkValue } from "~/lib/cards";
import { LoreCategory } from "~/lib/cards";

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
   * Get another user's card inventory (for trading/viewing collections)
   */
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
          where: {
            ownerId: targetDbUserId,
            cards: {
              isRetired: false,
              ...(filterRarity && { rarity: filterRarity }),
            },
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

  /**
   * Get Lore Cards overview statistics & category distribution breakdown
   */
  getLoreStats: publicProcedure.query(async ({ ctx }) => {
    try {
      const dbCard = ctx.db.card as any;
      const [
        totalCards,
        totalLoreCards,
        totalNSCards,
        totalCommonsCards,
        pendingRequests,
        categoryGroups,
      ] = await Promise.all([
        dbCard.count({ where: { isRetired: false } }),
        dbCard.count({
          where: {
            isRetired: false,
            OR: [{ cardType: { in: ["LORE", "LORE_BATCH"] } }, { category: { not: null } }],
          },
        }),
        dbCard.count({
          where: {
            isRetired: false,
            OR: [{ cardType: "NS_IMPORT" }, { nsCardId: { not: null } }],
          },
        }),
        dbCard.count({
          where: { isRetired: false, cardType: "COMMONS_IMPORT" },
        }),
        ctx.db.loreCardRequest.count({
          where: { status: "PENDING" },
        }),
        dbCard.groupBy({
          by: ["category"],
          where: { isRetired: false },
          _count: { id: true },
        }),
      ]);

      const categoryBreakdown: Record<string, number> = {};
      for (const g of (categoryGroups as { category: string | null; _count: { id: number } }[])) {
        if (g.category) {
          categoryBreakdown[g.category] = g._count.id;
        }
      }

      return {
        totalCards,
        totalLoreCards,
        totalNSCards,
        totalCommonsCards,
        pendingRequests,
        categoryBreakdown,
      };
    } catch (error) {
      console.error("[CARDS_ROUTER] Error in getLoreStats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch lore statistics",
      });
    }
  }),

  /**
   * Get NS Import cards for the NS Library tab
   */
  getNSCards: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
        search: z.string().max(100).optional(),
        season: z.number().int().min(1).optional(),
        rarity: z.string().optional(),
        region: z.string().max(100).optional(),
        categoryFilter: z.nativeEnum(LoreCategory).optional(),
        cardTypeFilter: z
          .enum(["all", "LORE", "NS_IMPORT", "USER_CUSTOM", "LORE_BATCH", "COMMONS_IMPORT"])
          .optional()
          .default("all"),
        cteFilter: z.enum(["all", "cte_only", "active_only"]).optional().default("all"),
        isRetired: z.boolean().optional(),
        includeRetired: z.boolean().optional(),
        sortBy: z
          .enum(["marketValue", "marketValue_asc", "rarity", "recent", "name"])
          .optional()
          .default("recent"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: Record<string, unknown> = {};

        if (input.categoryFilter) {
          where.category = input.categoryFilter;
        }

        if (input.cardTypeFilter && input.cardTypeFilter !== "all") {
          if (input.cardTypeFilter === "COMMONS_IMPORT") {
            where.cardType = "COMMONS_IMPORT";
          } else if (input.cardTypeFilter === "USER_CUSTOM") {
            where.AND = [
              {
                OR: [
                  { cardType: { notIn: ["NS_IMPORT", "LORE", "LORE_BATCH", "COMMONS_IMPORT"] } },
                  { nsCardId: null },
                ],
              },
              {
                cardType: { notIn: ["LORE", "LORE_BATCH", "COMMONS_IMPORT"] },
              },
            ];
          } else if (input.cardTypeFilter === "LORE" || input.cardTypeFilter === "LORE_BATCH") {
            where.OR = [
              { cardType: { in: ["LORE_BATCH", "LORE"] } },
              { category: { not: null } },
            ];
          } else if (input.cardTypeFilter === "NS_IMPORT") {
            where.OR = [{ cardType: "NS_IMPORT" }, { nsCardId: { not: null } }];
          } else {
            where.cardType = input.cardTypeFilter;
          }
        }

        if (input.season) {
          where.season = input.season;
        }

        if (input.rarity && Object.values(CardRarity).includes(input.rarity as CardRarity)) {
          where.rarity = input.rarity;
        }

        if (input.isRetired !== undefined) {
          where.isRetired = input.isRetired;
        } else if (!input.includeRetired) {
          where.isRetired = false;
        }

        if (input.cteFilter && input.cteFilter !== "all") {
          where.metadata = {
            path: ["isCTE"],
            equals: input.cteFilter === "cte_only",
          };
        }

        if (input.search) {
          const term = input.search.trim();
          where.OR = [
            { title: { contains: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } },
            { slug: { contains: term, mode: "insensitive" } },
            { wikiExcerpt: { contains: term, mode: "insensitive" } },
          ];
        }

        if (input.region) {
          where.stats = {
            path: ["region"],
            string_contains: input.region,
          };
        }

        let orderBy: Record<string, string>[];
        switch (input.sortBy) {
          case "marketValue":
            orderBy = [{ marketValue: "desc" }];
            break;
          case "marketValue_asc":
            orderBy = [{ marketValue: "asc" }];
            break;
          case "name":
            orderBy = [{ title: "asc" }];
            break;
          case "recent":
            orderBy = [{ createdAt: "desc" }];
            break;
          case "rarity":
          default:
            orderBy = [{ marketValue: "desc" }];
            break;
        }

        const [total, cards] = await Promise.all([
          ctx.db.card.count({ where: where as any }),
          ctx.db.card.findMany({
            where: where as any,
            orderBy,
            take: input.limit,
            skip: input.offset,
          }),
        ]);

        return {
          cards,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in getNSCards:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch NS cards",
        });
      }
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
              OR: [{ cardType: "NS_IMPORT" }, { nsCardId: { not: null } }],
              isRetired: false,
            },
          }),
          ctx.db.card.count({
            where: {
              OR: [{ cardType: "NS_IMPORT" }, { nsCardId: { not: null } }],
              isRetired: false,
              metadata: { path: ["isCTE"], equals: true },
            },
          }),
          ctx.db.card.count({
            where: {
              OR: [{ cardType: "NS_IMPORT" }, { nsCardId: { not: null } }],
              isRetired: true,
            },
          }),
          ctx.db.$queryRaw`
            SELECT stats->>'region' as region, COUNT(*)::int as count
            FROM cards
            WHERE ("cardType" = 'NS_IMPORT' OR "nsCardId" IS NOT NULL)
              AND ("isRetired" IS FALSE OR "isRetired" IS NULL)
              AND stats->>'region' IS NOT NULL
              AND stats->>'region' != ''
            GROUP BY stats->>'region'
            ORDER BY count DESC
            LIMIT 20
          ` as Promise<Array<{ region: string; count: number }>>,
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

  /**
   * Junk cards for credits payout based on rarity
   */
  junkCards: protectedProcedure
    .input(
      z.object({
        ownershipIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.user?.id;
        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID not found",
          });
        }

        const valCfg = await getValuationConfig(ctx.db);

        const ownerships = await ctx.db.cardOwnership.findMany({
          where: {
            id: { in: input.ownershipIds },
            ownerId: userId,
          },
          include: {
            cards: true,
          },
        });

        if (ownerships.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No owned cards found for the provided IDs",
          });
        }

        const lockedCards = ownerships.filter((o) => o.isLocked);
        if (lockedCards.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot junk locked cards: ${lockedCards.map((l) => l.cards.title).join(", ")}`,
          });
        }

        let totalCredits = 0;
        for (const ownership of ownerships) {
          const payoutPerCard = junkValue(valCfg, ownership.cards.rarity);
          const qty = ownership.quantity ?? 1;
          totalCredits += payoutPerCard * qty;
        }

        const result = await ctx.db.$transaction(async (tx) => {
          await tx.cardOwnership.deleteMany({
            where: {
              id: { in: ownerships.map((o) => o.id) },
            },
          });

          const vault = await tx.myVault.findUnique({
            where: { userId },
          });

          if (!vault) {
            throw new Error("Vault not found. Please initialize your vault first.");
          }

          const updatedVault = await tx.myVault.update({
            where: { id: vault.id },
            data: {
              credits: { increment: totalCredits },
              lifetimeEarned: { increment: totalCredits },
            },
          });

          await tx.vaultTransaction.create({
            data: {
              vaultId: vault.id,
              credits: totalCredits,
              balanceAfter: updatedVault.credits,
              type: "EARN_CARDS",
              source: `JUNK_CARDS`,
              metadata: {
                cardNames: ownerships.map((o) => o.cards.title),
                ownershipIds: ownerships.map((o) => o.id),
              },
            },
          });

          return {
            success: true,
            newBalance: updatedVault.credits,
          };
        });

        await Promise.all([
          globalCache.delete(`user_vault_stats:${userId}`),
          ...(ctx.auth?.userId
            ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)]
            : []),
          globalCache.delete(`user_vault_balance:${userId}`),
        ]);

        return {
          success: true,
          payout: totalCredits,
          newBalance: result.newBalance,
          message: `Successfully junked ${ownerships.length} card(s) and received ${totalCredits} IxC!`,
        };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in junkCards:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to junk cards",
        });
      }
    }),
});
