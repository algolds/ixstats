// src/server/api/routers/cards.ts
// tRPC router for IxCards Phase 1

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { getUserCards, updateCardStats, transferCard } from "~/lib/card-service";
import { CardRarity } from "@prisma/client";
import { globalCache } from "~/lib/advanced-cache-system";
import {
  getValuationConfig,
  junkValue,
  recomputeAllCardValues,
  setValuationConfig,
  type CardValuationConfig,
} from "~/lib/card-valuation";
import { getBonusConfig, setBonusConfig, type VaultBonusConfig } from "~/lib/vault-bonus";
import { commonsFlagImporter } from "~/lib/commons-flag-importer";

/**
 * Cards router for IxCards system
 * Provides endpoints for card browsing, management, and market operations
 */
export const cardsInventoryRouter = createTRPCRouter({
  /**
   * Get authenticated user's card inventory
   * Admin-only endpoint
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

        // Validate and cast filterRarity enum if provided
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
   * Protected endpoint - requires authentication
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
        // Validate and cast filterRarity enum if provided
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

        // Resolve clerkUserId to database CUID if needed
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

        // Get user's cards (respecting limit & hiding retired cards)
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
   * Update card stats from nation data
   * Admin-only endpoint
   */
  updateCardStats: adminProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedCard = await updateCardStats(ctx.db, input.cardId);
        return updatedCard;
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in updateCardStats:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update card stats",
        });
      }
    }),

  /**
   * Admin inline edit card details (title, marketValue, isRetired, rarity)
   */
  updateCardDetails: adminProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        marketValue: z.number().int().min(0).optional(),
        isRetired: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updateData: Record<string, any> = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.marketValue !== undefined) updateData.marketValue = input.marketValue;
        if (input.isRetired !== undefined) updateData.isRetired = input.isRetired;

        const card = await ctx.db.card.update({
          where: { id: input.cardId },
          data: updateData,
        });

        return { success: true, card };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in updateCardDetails:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update card details",
        });
      }
    }),

  /**
   * Admin bulk update card visibility with granular filters
   */
  bulkToggleVisibility: adminProcedure
    .input(
      z.object({
        isRetired: z.boolean(),
        cardTypeFilter: z.enum(["all", "NS_IMPORT", "LORE", "USER_CUSTOM", "COMMONS_IMPORT"]).optional().default("all"),
        cteFilter: z.enum(["all", "active", "cte"]).optional().default("all"),
        season: z.enum(["all", "1", "2", "3"]).optional().default("all"),
        rarity: z.enum(["all", "COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"]).optional().default("all"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const where: Record<string, any> = {};

        // Card type filter
        if (input.cardTypeFilter === "NS_IMPORT") {
          where.OR = [{ cardType: "NS_IMPORT" }, { nsCardId: { not: null } }];
        } else if (input.cardTypeFilter === "LORE") {
          where.OR = [{ cardType: "LORE" }, { cardType: "LORE_BATCH" }];
        } else if (input.cardTypeFilter === "USER_CUSTOM") {
          where.nsCardId = null;
          where.cardType = { notIn: ["LORE", "LORE_BATCH", "COMMONS_IMPORT"] };
        } else if (input.cardTypeFilter === "COMMONS_IMPORT") {
          where.cardType = "COMMONS_IMPORT";
        }

        // Season filter
        if (input.season !== "all") {
          where.season = parseInt(input.season, 10);
        }

        // Rarity filter
        if (input.rarity !== "all") {
          where.rarity = input.rarity;
        }

        // CTE filter
        if (input.cteFilter === "cte") {
          where.metadata = { path: ["isCTE"], equals: true };
        } else if (input.cteFilter === "active") {
          where.metadata = { path: ["isCTE"], equals: false };
        }

        const result = await ctx.db.card.updateMany({
          where,
          data: {
            isRetired: input.isRetired,
            retiredAt: input.isRetired ? new Date() : null,
          },
        });

        return {
          success: true,
          count: result.count,
          message: `Successfully ${input.isRetired ? "hid" : "restored"} ${result.count} card(s).`,
        };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in bulkToggleVisibility:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to perform bulk visibility update",
        });
      }
    }),

  /**
   * Fetch category members from Wikimedia Commons API
   */
  fetchCommonsCategoryMembers: protectedProcedure
    .input(
      z.object({
        category: z.string().min(1),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const items = await commonsFlagImporter.fetchCategoryMembers(input.category, input.limit);
        if (items.length === 0) return { items: [] };

        // Fetch existing COMMONS_IMPORT cards matching cleanTitle or fileUrl
        const cleanTitles = items.map((i) => i.cleanTitle);
        const existingCards = await ctx.db.card.findMany({
          where: {
            cardType: "COMMONS_IMPORT",
            title: { in: cleanTitles },
          },
          select: { title: true },
        });

        const existingSet = new Set(existingCards.map((c) => c.title));

        const itemsWithStatus = items.map((item) => ({
          ...item,
          isAlreadyImported: existingSet.has(item.cleanTitle),
        }));

        return { items: itemsWithStatus };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in fetchCommonsCategoryMembers:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch Wikimedia Commons flags",
        });
      }
    }),

  /**
   * Import selected Wikimedia Commons flags as COMMONS_IMPORT cards
   */
  importCommonsFlags: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            cleanTitle: z.string().min(1),
            fileUrl: z.string().url(),
            category: z.string(),
            descriptionUrl: z.string().optional(),
          })
        ),
        defaultRarity: z.nativeEnum(CardRarity).optional().default(CardRarity.COMMON),
        season: z.number().int().min(1).optional().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        let imported = 0;
        let skipped = 0;

        for (const item of input.items) {
          // Check if card with same title and type exists
          let card = await ctx.db.card.findFirst({
            where: {
              title: item.cleanTitle,
              cardType: "COMMONS_IMPORT",
            },
          });

          if (!card) {
            card = await ctx.db.card.create({
              data: {
                title: item.cleanTitle,
                description: `Wikimedia Commons SVG Flag from ${item.category}`,
                artwork: item.fileUrl,
                cardType: "COMMONS_IMPORT",
                rarity: input.defaultRarity,
                season: input.season,
                metadata: {
                  commonsCategory: item.category,
                  descriptionUrl: item.descriptionUrl || item.fileUrl,
                  importedAt: new Date().toISOString(),
                  importedBy: ctx.user.id,
                },
                marketValue: 15,
              },
            });
            imported++;
          } else {
            skipped++;
          }

          // Create CardOwnership for admin importer so it appears in inventory & deck
          if (card && ctx.user?.id) {
            const existingOwnership = await ctx.db.cardOwnership.findFirst({
              where: {
                ownerId: ctx.user.id,
                cardId: card.id,
              },
            });

            if (!existingOwnership) {
              await ctx.db.cardOwnership.create({
                data: {
                  id: `card_own_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                  userId: ctx.user.id,
                  ownerId: ctx.user.id,
                  cardId: card.id,
                  serialNumber: 1,
                  quantity: 1,
                },
              });
            }
          }
        }

        return {
          success: true,
          imported,
          skipped,
          message: `Imported ${imported} Commons flag card(s) (${skipped} skipped as duplicates).`,
        };
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in importCommonsFlags:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to import Wikimedia Commons flags",
        });
      }
    }),

  /**
   * Transfer card to another user
   * Admin-only endpoint
   */
  transferCard: adminProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        toUserId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User ID not found",
          });
        }

        const result = await transferCard(ctx.db, ctx.user.id, input.toUserId, input.cardId);

        const targetUser = await ctx.db.user.findFirst({
          where: {
            OR: [{ id: input.toUserId }, { clerkUserId: input.toUserId }],
          },
          select: { id: true, clerkUserId: true },
        });
        const recipientDbId = targetUser?.id ?? input.toUserId;
        const recipientClerkId = targetUser?.clerkUserId;

        await Promise.all([
          globalCache.delete(`user_vault_stats:${ctx.user.id}`),
          globalCache.delete(`user_vault_stats:${recipientDbId}`),
          ...(ctx.auth?.userId
            ? [globalCache.delete(`user_vault_balance:${ctx.auth.userId}`)]
            : []),
          ...(recipientClerkId
            ? [globalCache.delete(`user_vault_balance:${recipientClerkId}`)]
            : []),
          globalCache.delete(`user_vault_balance:${recipientDbId}`),
        ]);

        return result;
      } catch (error) {
        console.error("[CARDS_ROUTER] Error in transferCard:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to transfer card",
        });
      }
    }),

  /**
   * Get NS Import cards for the NS Library tab
   * Accessible to all authenticated users
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
        cardTypeFilter: z.enum(["all", "NS_IMPORT", "USER_CUSTOM", "LORE_BATCH", "COMMONS_IMPORT"]).optional().default("all"),
        cteFilter: z.enum(["all", "cte_only", "active_only"]).optional().default("all"),
        isRetired: z.boolean().optional(),
        includeRetired: z.boolean().optional(),
        sortBy: z.enum(["marketValue", "marketValue_asc", "rarity", "recent", "name"]).optional().default("recent"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: Record<string, unknown> = {};

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
          } else if (input.cardTypeFilter === "LORE_BATCH") {
            where.cardType = { in: ["LORE_BATCH", "LORE"] };
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
          where.OR = [
            { title: { contains: input.search.trim(), mode: "insensitive" } },
            { name: { contains: input.search.trim(), mode: "insensitive" } },
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
   * Accessible to all authenticated users
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

  // ─── Valuation Admin ─────────────────────────────────────────────

  /** Read the current card-valuation config (defaults overlaid with SystemConfig). */
  getValuationConfig: adminProcedure.query(async ({ ctx }) => {
    return getValuationConfig(ctx.db);
  }),

  /** Update valuation config fields, then recompute every card's value. */
  setValuationConfig: adminProcedure
    .input(
      z
        .object({
          floorCommon: z.number().min(0),
          floorUncommon: z.number().min(0),
          floorRare: z.number().min(0),
          floorUltraRare: z.number().min(0),
          floorEpic: z.number().min(0),
          floorLegendary: z.number().min(0),
          nsPremium: z.number().min(0),
          multSpecial: z.number().min(0),
          multNation: z.number().min(0),
          junkRate: z.number().min(0),
        })
        .partial()
    )
    .mutation(async ({ ctx, input }) => {
      for (const [field, value] of Object.entries(input)) {
        if (value != null) {
          await setValuationConfig(ctx.db, field as keyof CardValuationConfig, value);
        }
      }
      const result = await recomputeAllCardValues(ctx.db);
      return { config: await getValuationConfig(ctx.db), ...result };
    }),

  /** Recompute every card's marketValue under the current config (no config change). */
  recomputeCardValues: adminProcedure.mutation(async ({ ctx }) => {
    return recomputeAllCardValues(ctx.db);
  }),

  // ─── Metagame Bonus Admin ────────────────────────────────────────

  /** Read the current vault-bonus config (defaults overlaid with SystemConfig). */
  getBonusConfig: adminProcedure.query(async ({ ctx }) => {
    return getBonusConfig(ctx.db);
  }),

  /** Update vault-bonus config fields (new player, imports, achievements, lorewards). */
  setBonusConfig: adminProcedure
    .input(
      z
        .object({
          enabled: z.number().min(0).max(1),
          newPlayer: z.number().min(0),
          wikiImport: z.number().min(0),
          nsPerCard: z.number().min(0),
          nsCap: z.number().min(0),
          achievementCommon: z.number().min(0),
          achievementUncommon: z.number().min(0),
          achievementRare: z.number().min(0),
          achievementEpic: z.number().min(0),
          achievementLegendary: z.number().min(0),
          loreward: z.number().min(0),
        })
        .partial()
    )
    .mutation(async ({ ctx, input }) => {
      for (const [field, value] of Object.entries(input)) {
        if (value != null) {
          await setBonusConfig(ctx.db, field as keyof VaultBonusConfig, value);
        }
      }
      return getBonusConfig(ctx.db);
    }),

  // ─── Collection CRUD ─────────────────────────────────────────────

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

        // Fetch ownership records along with card rarity
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

        // Check if any card is locked
        const lockedCards = ownerships.filter((o) => o.isLocked);
        if (lockedCards.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot junk locked cards: ${lockedCards.map((l) => l.cards.title).join(", ")}`,
          });
        }

        // Calculate total credits to pay out
        let totalCredits = 0;
        for (const ownership of ownerships) {
          const payoutPerCard = junkValue(valCfg, ownership.cards.rarity);
          const qty = ownership.quantity ?? 1;
          totalCredits += payoutPerCard * qty;
        }

        // Run db transaction to delete ownerships and payout credits
        const result = await ctx.db.$transaction(async (tx) => {
          // Delete CardOwnership records
          await tx.cardOwnership.deleteMany({
            where: {
              id: { in: ownerships.map((o) => o.id) },
            },
          });

          // Payout credits using vaultService
          const vault = await tx.myVault.findUnique({
            where: { userId },
          });

          if (!vault) {
            throw new Error("Vault not found. Please initialize your vault first.");
          }

          // Update vault balance
          const updatedVault = await tx.myVault.update({
            where: { id: vault.id },
            data: {
              credits: { increment: totalCredits },
              lifetimeEarned: { increment: totalCredits },
            },
          });

          // Create vault transaction log
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
