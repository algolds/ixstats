/**
 * Lore Cards Maintenance & Operations Router
 *
 * Handles:
 * - Duplicate cards statistics and safe consolidation purges
 * - Wiki author attribution backfills
 * - Lore card category re-classification and cataloging
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { classifyLoreArticle } from "~/lib/cards/category-classifier";

export const loreCardsMaintenanceRouter = createTRPCRouter({
  /**
   * Get duplicate cards statistics across the database
   */
  getDuplicateCardsStats: adminProcedure
    .input(
      z
        .object({
          cardType: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input: _input }) => {
      try {
        // 1. Lore Cards duplicates (matching wikiArticleTitle + wikiSource)
        const loreDuplicatesRaw: Array<{
          wikiArticleTitle: string;
          wikiSource: string;
          count: bigint | number;
        }> = await ctx.db.$queryRawUnsafe(`
          SELECT "wikiArticleTitle", "wikiSource", COUNT(*)::int as count
          FROM "cards"
          WHERE "wikiArticleTitle" IS NOT NULL AND "wikiArticleTitle" != ''
          GROUP BY "wikiArticleTitle", "wikiSource"
          HAVING COUNT(*) > 1
          ORDER BY count DESC
          LIMIT 100;
        `);

        // 2. Generic Card duplicates (matching title + cardType + season)
        const titleDuplicatesRaw: Array<{
          title: string;
          cardType: string;
          season: number;
          count: bigint | number;
        }> = await ctx.db.$queryRawUnsafe(`
          SELECT "title", "cardType", "season", COUNT(*)::int as count
          FROM "cards"
          WHERE "title" IS NOT NULL AND "title" != ''
          GROUP BY "title", "cardType", "season"
          HAVING COUNT(*) > 1
          ORDER BY count DESC
          LIMIT 100;
        `);

        let totalDuplicates = 0;
        const loreGroups = loreDuplicatesRaw.map((r) => {
          const count = Number(r.count);
          totalDuplicates += count - 1;
          return {
            title: r.wikiArticleTitle,
            wikiSource: r.wikiSource,
            count,
            redundantCount: count - 1,
            type: "wiki_lore" as const,
          };
        });

        const titleGroups = titleDuplicatesRaw.map((r) => {
          const count = Number(r.count);
          return {
            title: r.title,
            cardType: r.cardType,
            season: r.season,
            count,
            redundantCount: count - 1,
            type: "title_season" as const,
          };
        });

        return {
          totalDuplicates,
          totalGroups: loreGroups.length + titleGroups.length,
          loreGroups,
          titleGroups,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in getDuplicateCardsStats:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch duplicate cards statistics",
        });
      }
    }),

  /**
   * Purge duplicate cards, safely consolidating CardOwnership, auctions, and history to keeper cards
   */
  purgeDuplicateCards: adminProcedure
    .input(
      z.object({
        mode: z.enum(["wiki_lore", "all"]).default("wiki_lore"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        let purgedCount = 0;
        let groupsResolved = 0;

        if (input.mode === "wiki_lore" || input.mode === "all") {
          // Find all duplicate lore card groups
          const duplicateLoreGroups: Array<{
            wikiArticleTitle: string;
            wikiSource: string;
          }> = await ctx.db.$queryRawUnsafe(`
            SELECT "wikiArticleTitle", "wikiSource"
            FROM "cards"
            WHERE "wikiArticleTitle" IS NOT NULL AND "wikiArticleTitle" != ''
            GROUP BY "wikiArticleTitle", "wikiSource"
            HAVING COUNT(*) > 1;
          `);

          for (const group of duplicateLoreGroups) {
            const cards = await ctx.db.card.findMany({
              where: {
                wikiArticleTitle: group.wikiArticleTitle,
                wikiSource: group.wikiSource,
              },
              include: {
                _count: {
                  select: { CardOwnership: true, valueHistory: true, watchlist: true },
                },
              },
              orderBy: [
                { CardOwnership: { _count: "desc" } },
                { level: "desc" },
                { marketValue: "desc" },
                { createdAt: "asc" },
              ],
            });

            if (cards.length <= 1) continue;

            const keeper = cards[0];
            const duplicates = cards.slice(1);
            const duplicateIds = duplicates.map((d) => d.id);

            // Re-assign CardOwnerships to keeper card
            for (const dup of duplicates) {
              const ownerships = await ctx.db.cardOwnership.findMany({
                where: { cardId: dup.id },
              });

              for (const own of ownerships) {
                // Check if user already owns keeper card
                const existingOwner = await ctx.db.cardOwnership.findFirst({
                  where: { cardId: keeper.id, ownerId: own.ownerId },
                });

                if (existingOwner) {
                  // Merge quantity
                  await ctx.db.cardOwnership.update({
                    where: { id: existingOwner.id },
                    data: { quantity: existingOwner.quantity + own.quantity },
                  });
                  await ctx.db.cardOwnership.delete({
                    where: { id: own.id },
                  });
                } else {
                  // Re-point ownership to keeper
                  await ctx.db.cardOwnership.update({
                    where: { id: own.id },
                    data: { cardId: keeper.id },
                  });
                }
              }

              // Re-point card auctions, watchlist, value history
              await ctx.db.cardAuction.updateMany({
                where: { cardInstanceId: dup.id },
                data: { cardInstanceId: keeper.id },
              });

              await ctx.db.cardWatchlist.updateMany({
                where: { cardId: dup.id },
                data: { cardId: keeper.id },
              });

              await ctx.db.cardValueHistory.updateMany({
                where: { cardId: dup.id },
                data: { cardId: keeper.id },
              });
            }

            // Delete redundant cards
            const deleteRes = await ctx.db.card.deleteMany({
              where: { id: { in: duplicateIds } },
            });

            purgedCount += deleteRes.count;
            groupsResolved++;
          }
        }

        return {
          success: true,
          purgedCount,
          groupsResolved,
          message: `Successfully purged ${purgedCount} duplicate card(s) across ${groupsResolved} unique group(s).`,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in purgeDuplicateCards:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to purge duplicate cards",
        });
      }
    }),

  /**
   * Backfill wiki authors (Page Creator + Primary Contributor) for lore cards lacking author metadata
   */
  backfillWikiAuthors: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(100),
        wikiSource: z.enum(["ixwiki", "iiwiki", "all"]).default("all"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const whereClause: any = {
          wikiArticleTitle: { not: null },
          cardType: "LORE",
        };
        if (input.wikiSource !== "all") {
          whereClause.wikiSource = input.wikiSource;
        }

        const cards = await ctx.db.card.findMany({
          where: whereClause,
          select: { id: true, wikiArticleTitle: true, wikiSource: true, metadata: true },
          take: input.limit,
        });

        // Filter cards that don't have authorInfo or have fallback/imported> values
        const cardsToEnrich = cards.filter((c) => {
          const meta = (c.metadata as Record<string, unknown>) || {};
          const info = meta.authorInfo as { creator?: string; displayAuthor?: string } | undefined;
          if (!info || !info.creator) return true;
          const str = (info.displayAuthor || info.creator).toLowerCase();
          if (str.includes("community") || str.includes("imported>") || str.includes("import>"))
            return true;
          return false;
        });

        if (cardsToEnrich.length === 0) {
          return {
            success: true,
            count: 0,
            message: "All eligible lore cards already have author metadata.",
          };
        }

        // Group by wikiSource
        const bySource = new Map<"ixwiki" | "iiwiki", typeof cardsToEnrich>();
        for (const c of cardsToEnrich) {
          const src: "ixwiki" | "iiwiki" = c.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki";
          if (!bySource.has(src)) bySource.set(src, []);
          bySource.get(src)!.push(c);
        }

        let updatedCount = 0;
        for (const [src, sourceCards] of bySource.entries()) {
          const titles = sourceCards.map((c) => c.wikiArticleTitle!).filter(Boolean);
          const authorMap = await wikiLoreCardGenerator.fetchArticleAuthorInfoBatch(titles, src);

          for (const card of sourceCards) {
            const titleKey = card.wikiArticleTitle!.replace(/_/g, " ").trim().toLowerCase();
            const authorInfo = authorMap.get(titleKey) || {
              creator: "Unknown",
              displayAuthor: "Unknown",
            };
            const currentMeta = (card.metadata as Record<string, unknown>) || {};

            await ctx.db.card.update({
              where: { id: card.id },
              data: {
                metadata: {
                  ...currentMeta,
                  authorInfo: authorInfo as any,
                  author: authorInfo.displayAuthor,
                },
              },
            });
            updatedCount++;
          }
        }

        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth?.userId || "admin",
              action: "CARD_AUTHORS_BACKFILLED",
              entityType: "CARD",
              target: "batch",
              details: `Enriched ${updatedCount} lore card(s) with author attribution (requested limit: ${input.limit})`,
              success: true,
            },
          })
          .catch(() => null);

        return {
          success: true,
          count: updatedCount,
          message: `Enriched ${updatedCount} card(s) with accurate wiki creator & contributor attribution.`,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in backfillWikiAuthors:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to backfill wiki authors",
        });
      }
    }),

  /**
   * Re-classify and update categories for lore cards in the database
   */
  reclassifyLoreCards: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(100),
        wikiSource: z.enum(["ixwiki", "iiwiki", "all"]).default("all"),
        forceOverwrite: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const whereClause: any = {
          OR: [
            { cardType: "LORE" },
            { cardType: "LORE_BATCH" },
            { wikiArticleTitle: { not: null } },
          ],
        };
        if (input.wikiSource !== "all") {
          whereClause.wikiSource = input.wikiSource;
        }
        if (!input.forceOverwrite) {
          whereClause.AND = [
            {
              OR: [{ category: null }, { category: "NS_IMPORT" }, { category: "NATION" }],
            },
          ];
        }

        const cards = await ctx.db.card.findMany({
          where: whereClause,
          select: {
            id: true,
            title: true,
            description: true,
            wikiArticleTitle: true,
            wikiSource: true,
            category: true,
            metadata: true,
          },
          take: input.limit,
        });

        if (cards.length === 0) {
          return {
            success: true,
            processedCount: 0,
            reclassifiedCount: 0,
            categoryBreakdown: {},
            message: "No eligible lore cards found to re-classify.",
          };
        }

        // Group by wikiSource to fetch batch metadata previews
        const bySource = new Map<"ixwiki" | "iiwiki", typeof cards>();
        for (const c of cards) {
          const src: "ixwiki" | "iiwiki" = c.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki";
          if (!bySource.has(src)) bySource.set(src, []);
          bySource.get(src)!.push(c);
        }

        let reclassifiedCount = 0;
        const categoryBreakdown: Record<string, number> = {};

        for (const [src, sourceCards] of bySource.entries()) {
          const titles = sourceCards.map((c) => c.wikiArticleTitle || c.title).filter(Boolean);
          const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(titles, src);
          const previewMap = new Map(
            previews.map((p) => [p.title.toLowerCase().replace(/_/g, " "), p])
          );

          for (const card of sourceCards) {
            const titleKey = (card.wikiArticleTitle || card.title).toLowerCase().replace(/_/g, " ");
            const preview = previewMap.get(titleKey);
            const meta = (card.metadata as Record<string, unknown>) || {};
            const fullExcerpt = (meta.fullExcerpt as string) || card.description || "";

            const newCategory =
              preview?.category ||
              classifyLoreArticle({
                title: card.wikiArticleTitle || card.title,
                text: fullExcerpt,
              });

            categoryBreakdown[newCategory] = (categoryBreakdown[newCategory] || 0) + 1;

            if (card.category !== newCategory || meta.category !== newCategory) {
              await ctx.db.card.update({
                where: { id: card.id },
                data: {
                  category: newCategory as any,
                  metadata: {
                    ...meta,
                    category: newCategory,
                  },
                },
              });
              reclassifiedCount++;
            }
          }
        }

        await ctx.db.auditLog
          .create({
            data: {
              userId: ctx.auth?.userId || "admin",
              action: "LORE_CARDS_RECLASSIFIED",
              entityType: "CARD",
              target: "batch",
              details: `Re-cataloged ${cards.length} lore card(s), updated ${reclassifiedCount} with canonical categories.`,
              success: true,
            },
          })
          .catch(() => null);

        return {
          success: true,
          processedCount: cards.length,
          reclassifiedCount,
          categoryBreakdown,
          message: `Processed ${cards.length} card(s), updated ${reclassifiedCount} to accurate lore categories.`,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in reclassifyLoreCards:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to reclassify lore cards",
        });
      }
    }),
});
