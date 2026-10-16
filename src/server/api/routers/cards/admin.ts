// src/server/api/routers/cards/admin.ts
// Admin operations & batch tools sub-router for IxCards

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { ArtworkSource, CardRarity, CardType, LoreCategory, type Prisma } from "@prisma/client";
import { recomputeAllCardValues } from "~/lib/cards/valuation";
import { commonsFlagImporter } from "~/lib/flags/commons-flag-importer";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { cteFilterSchema, LIBRARY_ORDER, LIBRARY_SORTS, libraryWhere } from "./_library";

export const cardsAdminRouter = createTRPCRouter({
  /** Admin: the full library read for the cards explorer (retired cards, CTE, category and type filters). */
  adminCardExplorer: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
        search: z.string().max(100).optional(),
        season: z.number().int().min(1).optional(),
        rarity: z.nativeEnum(CardRarity).optional(),
        region: z.string().max(100).optional(),
        categoryFilter: z.nativeEnum(LoreCategory).optional(),
        cardTypeFilter: z
          .union([z.literal("all"), z.nativeEnum(CardType)])
          .optional()
          .default("all"),
        cteFilter: cteFilterSchema.optional().default("all"),
        isRetired: z.boolean().optional(),
        includeRetired: z.boolean().optional(),
        sortBy: z.enum(LIBRARY_SORTS).optional().default("recent"),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = libraryWhere({
        ...input,
        category: input.categoryFilter,
        cardType: input.cardTypeFilter === "all" ? undefined : input.cardTypeFilter,
        retired: input.isRetired ?? (input.includeRetired ? undefined : false),
      });
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
        cardType: z.nativeEnum(CardType).optional(),
        rarity: z.nativeEnum(CardRarity).optional(),
        artwork: z.string().optional().nullable(),
        artworkSource: z.nativeEnum(ArtworkSource).optional(),
        description: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updateData: Prisma.CardUpdateInput = {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.marketValue !== undefined && { marketValue: input.marketValue }),
          ...(input.isRetired !== undefined && { isRetired: input.isRetired }),
          ...(input.category !== undefined && { category: input.category }),
          ...(input.cardType !== undefined && { cardType: input.cardType }),
          ...(input.rarity !== undefined && { rarity: input.rarity }),
          ...(input.artwork !== undefined && { artwork: input.artwork }),
          ...(input.artworkSource !== undefined && { artworkSource: input.artworkSource }),
          ...(input.description !== undefined && { description: input.description }),
        };

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
        cardTypeFilter: z
          .union([z.literal("all"), z.nativeEnum(CardType)])
          .optional()
          .default("all"),
        cteFilter: z.enum(["all", "active", "cte"]).optional().default("all"),
        categoryFilter: z
          .union([z.literal("all"), z.nativeEnum(LoreCategory)])
          .optional()
          .default("all"),
        season: z.enum(["all", "1", "2", "3"]).optional().default("all"),
        rarity: z
          .enum(["all", "COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"])
          .optional()
          .default("all"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const where: Prisma.CardWhereInput = {
          ...(input.cardTypeFilter !== "all" && { cardType: input.cardTypeFilter }),
          ...(input.categoryFilter !== "all" && { category: input.categoryFilter }),
          ...(input.season !== "all" && { season: parseInt(input.season, 10) }),
          ...(input.rarity !== "all" && { rarity: input.rarity }),
          ...(input.cteFilter !== "all" && {
            metadata: { path: ["isCTE"], equals: input.cteFilter === "cte" },
          }),
        };

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
  fetchCommonsCategoryMembers: adminProcedure
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

        // Commons flag cards already imported from this category, by title
        const cleanTitles = items.map((i) => i.cleanTitle);
        const existingCards = await ctx.db.card.findMany({
          where: {
            cardType: CardType.LORE,
            title: { in: cleanTitles },
            metadata: { path: ["commonsCategory"], equals: input.category },
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
   * Import selected Wikimedia Commons flags as Lore cards in Ixnay, marked `metadata.commonsCategory`;
   * the importing admin gets no copy.
   */
  importCommonsFlags: adminProcedure
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
          // Check if this category's flag card with the same title exists
          const card = await ctx.db.card.findFirst({
            where: {
              title: item.cleanTitle,
              cardType: CardType.LORE,
              metadata: { path: ["commonsCategory"], equals: item.category },
            },
          });

          if (!card) {
            await ctx.db.card.create({
              data: {
                title: item.cleanTitle,
                description: `Wikimedia Commons SVG Flag from ${item.category}`,
                artwork: item.fileUrl,
                cardType: CardType.LORE,
                realmId: DEFAULT_REALM_ID,
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

  /** Recompute every card's marketValue under the current config (no config change). */
  recomputeCardValues: adminProcedure.mutation(async ({ ctx }) => {
    return recomputeAllCardValues(ctx.db);
  }),
});
