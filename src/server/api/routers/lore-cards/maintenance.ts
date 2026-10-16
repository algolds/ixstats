import { z } from "zod";
import { CardType, type Prisma } from "@prisma/client";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { classifyLoreArticle } from "~/lib/cards/category-classifier";

type WikiSrc = "ixwiki" | "iiwiki";

/** Groups cards by wiki, defaulting anything not IIWiki to IxWiki. */
function groupBySource<T extends { wikiSource: string | null }>(cards: T[]) {
  const bySource = new Map<WikiSrc, T[]>();
  for (const card of cards) {
    const src: WikiSrc = card.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki";
    bySource.set(src, [...(bySource.get(src) ?? []), card]);
  }
  return bySource;
}

/** Cards without usable author attribution (missing, or a community/import placeholder). */
function lacksAuthorInfo(metadata: unknown) {
  const meta = (metadata as Record<string, unknown>) || {};
  const info = meta.authorInfo as { creator?: string; displayAuthor?: string } | undefined;
  if (!info?.creator) return true;
  const name = (info.displayAuthor || info.creator).toLowerCase();
  return ["community", "imported>", "import>"].some((marker) => name.includes(marker));
}

export const loreCardsMaintenanceRouter = createTRPCRouter({
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

      const cardsToEnrich = cards.filter((c) => lacksAuthorInfo(c.metadata));

      if (cardsToEnrich.length === 0) {
        return {
          success: true,
          count: 0,
          message: "All eligible lore cards already have author metadata.",
        };
      }

      let updatedCount = 0;
      for (const [src, sourceCards] of groupBySource(cardsToEnrich)) {
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
      const whereClause: Prisma.CardWhereInput = {
        cardType: CardType.LORE,
        ...(input.wikiSource !== "all" && { wikiSource: input.wikiSource }),
        // Without a forced overwrite, only cards that have no category (the backfill cleared NS_IMPORT) are reclassified
        ...(!input.forceOverwrite && { category: null }),
      };

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

      let reclassifiedCount = 0;
      const categoryBreakdown: Record<string, number> = {};

      // Grouped by wikiSource to fetch batch metadata previews
      for (const [src, sourceCards] of groupBySource(cards)) {
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
                category: newCategory,
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
    }),
});
