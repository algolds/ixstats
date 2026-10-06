import { z } from "zod";
import type { Prisma } from "@prisma/client";
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

/**
 * Rows that hang off a card ownership (auctions reference the ownership, not the card): moved to `toId` before a
 * merged-away ownership is deleted, so the delete can't cascade them away. A collection already holding the
 * surviving ownership keeps that entry.
 */
async function moveOwnershipChildren(db: Prisma.TransactionClient, fromId: string, toId: string) {
  await db.cardAuction.updateMany({
    where: { cardInstanceId: fromId },
    data: { cardInstanceId: toId },
  });
  const inBoth = await db.cardCollectionItem.findMany({
    where: { cardOwnershipId: toId },
    select: { collectionId: true },
  });
  await db.cardCollectionItem.deleteMany({
    where: { cardOwnershipId: fromId, collectionId: { in: inBoth.map((i) => i.collectionId) } },
  });
  await db.cardCollectionItem.updateMany({
    where: { cardOwnershipId: fromId },
    data: { cardOwnershipId: toId },
  });
  await db.cardExperienceEvent.updateMany({
    where: { ownershipId: fromId },
    data: { ownershipId: toId },
  });
  await db.cardTransferEvent.updateMany({
    where: { ownershipId: fromId },
    data: { ownershipId: toId },
  });
}

/**
 * Moves ownerships (with their auctions and history), watchlist and value history of a duplicate card onto the keeper.
 *
 * Quantities are merged into the owner's keeper ownership only when neither row is committed elsewhere: a locked row
 * (listed at auction, offered in a pending trade, achievement-locked) or one with an ACTIVE auction. An auction sale
 * hands the buyer the whole ownership row, and trades and auctions hold ownership ids, so a committed row is instead
 * repointed to the keeper card intact, keeping its id, lock, auction and escrowed bid.
 */
async function mergeIntoKeeper(
  tx: Prisma.TransactionClient,
  keeperId: string,
  duplicateId: string
) {
  const ownerships = await tx.cardOwnership.findMany({ where: { cardId: duplicateId } });
  const listed = await tx.cardAuction.findMany({
    where: { cardInstanceId: { in: ownerships.map((o) => o.id) }, status: "ACTIVE" },
    select: { cardInstanceId: true },
  });
  const committed = new Set(listed.map((a) => a.cardInstanceId));

  for (const own of ownerships) {
    const mergeTarget =
      own.isLocked || committed.has(own.id)
        ? null
        : await tx.cardOwnership.findFirst({
            where: {
              cardId: keeperId,
              ownerId: own.ownerId,
              isLocked: false,
              CardAuction: { none: { status: "ACTIVE" } },
            },
          });
    if (mergeTarget) {
      // The user already holds the keeper: merge quantities, keeping the duplicate's past auctions and history
      await tx.cardOwnership.update({
        where: { id: mergeTarget.id },
        data: { quantity: mergeTarget.quantity + own.quantity },
      });
      await moveOwnershipChildren(tx, own.id, mergeTarget.id);
      await tx.cardOwnership.delete({ where: { id: own.id } });
    } else {
      // Auctions and history follow the ownership row itself
      await tx.cardOwnership.update({ where: { id: own.id }, data: { cardId: keeperId } });
    }
  }

  await tx.cardWatchlist.updateMany({
    where: { cardId: duplicateId },
    data: { cardId: keeperId },
  });
  await tx.cardValueHistory.updateMany({
    where: { cardId: duplicateId },
    data: { cardId: keeperId },
  });
}

const redundantCount = (count: bigint | number) => Number(count) - 1;

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

      const loreGroups = loreDuplicatesRaw.map((r) => ({
        title: r.wikiArticleTitle,
        wikiSource: r.wikiSource,
        count: Number(r.count),
        redundantCount: redundantCount(r.count),
        type: "wiki_lore" as const,
      }));
      const titleGroups = titleDuplicatesRaw.map((r) => ({
        title: r.title,
        cardType: r.cardType,
        season: r.season,
        count: Number(r.count),
        redundantCount: redundantCount(r.count),
        type: "title_season" as const,
      }));
      const totalDuplicates = loreGroups.reduce((sum, g) => sum + g.redundantCount, 0);

      return {
        totalDuplicates,
        totalGroups: loreGroups.length + titleGroups.length,
        loreGroups,
        titleGroups,
      };
    }),

  /**
   * Purge duplicate cards, safely consolidating CardOwnership, auctions, and history to keeper cards
   */
  // `mode` is accepted for API compatibility; both modes purge duplicate wiki lore cards.
  purgeDuplicateCards: adminProcedure
    .input(z.object({ mode: z.enum(["wiki_lore", "all"]).default("wiki_lore") }))
    .mutation(async ({ ctx }) => {
      let purgedCount = 0;
      let groupsResolved = 0;

      // Find all duplicate lore card groups
      const duplicateLoreGroups: Array<{ wikiArticleTitle: string; wikiSource: string }> = await ctx
        .db.$queryRawUnsafe(`
        SELECT "wikiArticleTitle", "wikiSource"
        FROM "cards"
        WHERE "wikiArticleTitle" IS NOT NULL AND "wikiArticleTitle" != ''
        GROUP BY "wikiArticleTitle", "wikiSource"
        HAVING COUNT(*) > 1;
      `);

      // Each group is merged and purged atomically, so a failure leaves no card half-merged
      for (const group of duplicateLoreGroups) {
        const purged = await ctx.db.$transaction(async (tx) => {
          const cards = await tx.card.findMany({
            where: { wikiArticleTitle: group.wikiArticleTitle, wikiSource: group.wikiSource },
            orderBy: [
              { CardOwnership: { _count: "desc" } },
              { level: "desc" },
              { marketValue: "desc" },
              { createdAt: "asc" },
            ],
          });
          const [keeper, ...duplicates] = cards;
          if (!keeper || duplicates.length === 0) return 0;

          for (const dup of duplicates) await mergeIntoKeeper(tx, keeper.id, dup.id);

          const deleteRes = await tx.card.deleteMany({
            where: { id: { in: duplicates.map((d) => d.id) } },
          });
          return deleteRes.count;
        });
        if (purged === 0) continue;
        purgedCount += purged;
        groupsResolved++;
      }

      return {
        success: true,
        purgedCount,
        groupsResolved,
        message: `Successfully purged ${purgedCount} duplicate card(s) across ${groupsResolved} unique group(s).`,
      };
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
      const whereClause: any = {
        OR: [{ cardType: "LORE" }, { cardType: "LORE_BATCH" }, { wikiArticleTitle: { not: null } }],
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
    }),
});
