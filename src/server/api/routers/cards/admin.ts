// src/server/api/routers/cards/admin.ts
// Admin operations & batch tools sub-router for IxCards

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { updateCardStats, transferCard } from "~/lib/cards";
import { CardRarity } from "@prisma/client";
import { globalCache } from "~/lib/cache";
import { recomputeAllCardValues } from "~/lib/cards";
import { commonsFlagImporter } from "~/lib/flags/commons-flag-importer";
import { LoreCategory, ArtworkSource } from "~/lib/cards";

export const cardsAdminRouter = createTRPCRouter({
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
   * Admin inline edit card details (title, marketValue, isRetired, rarity, category, artwork)
   */
  updateCardDetails: adminProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        marketValue: z.number().int().min(0).optional(),
        isRetired: z.boolean().optional(),
        category: z.nativeEnum(LoreCategory).optional(),
        cardType: z.string().optional(),
        rarity: z.nativeEnum(CardRarity).optional(),
        artworkUrl: z.string().optional().nullable(),
        artworkSource: z.nativeEnum(ArtworkSource).optional(),
        description: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updateData: Record<string, any> = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.marketValue !== undefined) updateData.marketValue = input.marketValue;
        if (input.isRetired !== undefined) updateData.isRetired = input.isRetired;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.cardType !== undefined) updateData.cardType = input.cardType;
        if (input.rarity !== undefined) updateData.rarity = input.rarity;
        if (input.artworkUrl !== undefined) updateData.artworkUrl = input.artworkUrl;
        if (input.artworkSource !== undefined) updateData.artworkSource = input.artworkSource;
        if (input.description !== undefined) updateData.description = input.description;

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
        categoryFilter: z.string().optional().default("all"),
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

        // Category filter
        if (input.categoryFilter && input.categoryFilter !== "all") {
          where.category = input.categoryFilter;
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

  /** Recompute every card's marketValue under the current config (no config change). */
  recomputeCardValues: adminProcedure.mutation(async ({ ctx }) => {
    return recomputeAllCardValues(ctx.db);
  }),
});
