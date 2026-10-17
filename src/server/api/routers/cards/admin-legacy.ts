// src/server/api/routers/cards/admin-legacy.ts
// Card admin procedures still used by the old admin components, until their tab is rebuilt.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { ArtworkSource, CardRarity, CardType, LoreCategory, type Prisma } from "@prisma/client";
import { recomputeAllCardValues } from "~/lib/cards/valuation";
import { cteFilterSchema, LIBRARY_ORDER, LIBRARY_SORTS, libraryWhere } from "./_library";

export const cardsLegacyAdminRouter = createTRPCRouter({
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

  /** Recompute every card's marketValue under the current config (no config change). */
  recomputeCardValues: adminProcedure.mutation(async ({ ctx }) => {
    return recomputeAllCardValues(ctx.db);
  }),
});
