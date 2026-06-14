/**
 * Lore Cards tRPC Router
 *
 * Handles user-requested lore card generation from wiki articles
 * - Users pay 50 IxC to request specific wiki articles become lore cards
 * - Admins review and approve/reject requests
 * - System generates approved cards using wiki-lore-card-generator
 *
 * Features:
 * - User request submission with IxCredits payment
 * - Admin approval queue and review
 * - Automatic card generation on approval
 * - Request history and status tracking
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, rateLimitedPublicProcedure } from "~/server/api/trpc";

const _LORE_CARD_REQUEST_COST = 50; // IxCredits

/**
 * Lore Cards Router
 */
export const loreCardsGalleryRouter = createTRPCRouter({
  /**
   * Get all lore cards for public gallery (public endpoint)
   */
  getAllLoreCards: rateLimitedPublicProcedure
    .input(
      z.object({
        wikiSource: z.enum(["ixwiki", "iiwiki", "all"]).optional().default("all"),
        rarity: z
          .enum(["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY", "all"])
          .optional()
          .default("all"),
        category: z.string().optional(),
        season: z.number().int().min(1).optional(),
        search: z.string().min(1).max(200).optional(),
        sortBy: z
          .enum(["rarity", "season", "dateAdded", "marketValue", "title"])
          .optional()
          .default("dateAdded"),
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Build where clause
        const where: any = {
          cardType: "LORE",
        };

        // Wiki source filter
        if (input.wikiSource !== "all") {
          where.wikiSource = input.wikiSource;
        }

        // Rarity filter
        if (input.rarity !== "all") {
          where.rarity = input.rarity;
        }

        // Season filter
        if (input.season) {
          where.season = input.season;
        }

        // Category filter (stored in metadata)
        if (input.category) {
          where.metadata = {
            path: ["category"],
            equals: input.category,
          };
        }

        // Search filter
        if (input.search) {
          where.OR = [
            { title: { contains: input.search, mode: "insensitive" } },
            { wikiArticleTitle: { contains: input.search, mode: "insensitive" } },
          ];
        }

        // Build orderBy
        let orderBy: any = { createdAt: "desc" }; // dateAdded
        if (input.sortBy === "rarity") {
          orderBy = { rarity: "desc" };
        } else if (input.sortBy === "season") {
          orderBy = { season: "desc" };
        } else if (input.sortBy === "marketValue") {
          orderBy = { marketValue: "desc" };
        } else if (input.sortBy === "title") {
          orderBy = { title: "asc" };
        }

        // Fetch cards
        const [cards, total] = await Promise.all([
          ctx.db.card.findMany({
            where,
            orderBy,
            take: input.limit,
            skip: input.offset,
            select: {
              id: true,
              title: true,
              description: true,
              artwork: true,
              artworkVariants: true,
              rarity: true,
              season: true,
              cardType: true,
              wikiSource: true,
              wikiArticleTitle: true,
              stats: true,
              marketValue: true,
              totalSupply: true,
              level: true,
              metadata: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          ctx.db.card.count({ where }),
        ]);

        return {
          cards,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in getAllLoreCards:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch lore cards",
        });
      }
    }),
});
