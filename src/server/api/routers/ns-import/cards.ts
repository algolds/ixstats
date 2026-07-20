/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/ns-api-client";
import { nsImportService } from "~/lib/ns-import-service";
import { computeCardValue, getValuationConfig } from "~/lib/card-valuation";

// ─── Background Processing Functions ──────────────────────────────

export const nsImportCardsRouter = createTRPCRouter({
  /**
   * Get user's import history
   */
  getMyImportHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get user's vault transactions for NS imports
      const vault = await ctx.db.myVault.findUnique({
        where: { userId: ctx.user.id },
        include: {
          transactions: {
            where: {
              source: "ns_import_bonus",
            },
            orderBy: { createdAt: "desc" },
            take: input.limit,
          },
        },
      });

      const imports = vault?.transactions || [];

      return imports.map((tx) => ({
        id: tx.id,
        nationName: (tx.metadata as any)?.nationName || "Unknown",
        cardsImported: (tx.metadata as any)?.cardsImported || 0,
        totalValue: (tx.metadata as any)?.totalValue || 0,
        bonusCredits: tx.credits,
        importedAt: tx.createdAt,
      }));
    }),

  /**
   * Get import statistics
   */
  getImportStats: protectedProcedure.query(async ({ ctx }) => {
    // Count NS import transactions
    const vault = await ctx.db.myVault.findUnique({
      where: { userId: ctx.user.id },
      include: {
        transactions: {
          where: {
            source: "ns_import_bonus",
          },
        },
      },
    });

    const imports = vault?.transactions || [];
    const totalImports = imports.length;
    const lastImport = imports[0]?.createdAt || null;

    // Count imported cards
    const importedCards = await ctx.db.cardOwnership.findMany({
      where: {
        userId: ctx.user.id,
        cards: {
          cardType: "NS_IMPORT",
        },
      },
      include: {
        cards: true,
      },
    });

    const totalCards = importedCards.reduce((sum, ownership) => sum + ownership.quantity, 0);
    const totalValue = importedCards.reduce(
      (sum, ownership) => sum + (ownership.cards.marketValue || 0),
      0
    );

    return {
      totalImports,
      totalCards,
      totalValue,
      lastImport,
    };
  }),

  // ─── Bulk Import Endpoints ────────────────────────────────────────

  // ─── Pause / Play / Stop controls ───

  // ─── Region Discovery ────────────────────────────────────────────

  /**
   * Batch-update gameplay stats (economic/diplomatic/military/social)
   * for all NS_IMPORT cards that don't have them yet.
   */
  batchUpdateCardStats: adminProcedure
    .input(
      z
        .object({
          forceAll: z.boolean().optional().default(false),
        })
        .optional()
        .default({ forceAll: false })
    )
    .mutation(async ({ ctx, input }) => {
      const BATCH = 100;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      // Get all NS_IMPORT cards
      const cards = await ctx.db.card.findMany({
        where: { cardType: "NS_IMPORT" },
        select: { id: true, nsCardId: true, stats: true },
      });

      console.log(
        `[NS Import] Batch updating stats for ${cards.length} NS cards (forceAll=${input.forceAll})`
      );

      for (let i = 0; i < cards.length; i += BATCH) {
        const batch = cards.slice(i, i + BATCH);
        const updates = [];

        for (const card of batch) {
          const existingStats = card.stats as Record<string, unknown> | null;
          if (!existingStats) {
            skipped++;
            continue;
          }

          // Skip if already has gameplay stats (unless forceAll)
          if (!input.forceAll && typeof existingStats.economic === "number") {
            skipped++;
            continue;
          }

          const gameplayStats = nsImportService.generateCardStats(
            {
              govt: existingStats.govt as string | undefined,
              marketValue: existingStats.marketValue as string | undefined,
              badge: existingStats.badge as string | undefined,
              trophies: existingStats.trophies as string | undefined,
              region: existingStats.region as string | undefined,
              category: existingStats.category as string | undefined,
              cardcategory: existingStats.cardcategory as string | undefined,
            },
            card.nsCardId ?? undefined
          );

          updates.push(
            ctx.db.card.update({
              where: { id: card.id },
              data: {
                stats: { ...existingStats, ...gameplayStats },
              },
            })
          );
        }

        if (updates.length > 0) {
          try {
            await Promise.all(updates);
            updated += updates.length;
          } catch (err) {
            errors += updates.length;
            console.error(`[NS Import] Batch error at offset ${i}:`, err);
          }
        }

        if ((i + BATCH) % 1000 === 0 || i + BATCH >= cards.length) {
          console.log(
            `[NS Import] Progress: ${Math.min(i + BATCH, cards.length)}/${cards.length} (updated: ${updated}, skipped: ${skipped})`
          );
        }
      }

      console.log(
        `[NS Import] Batch stats complete: ${updated} updated, ${skipped} skipped, ${errors} errors`
      );
      return { updated, skipped, errors, total: cards.length };
    }),

  /**
   * Refresh market values for user's 0-value NS cards by re-fetching from NS API,
   * then recalculate deckValue from actual card values.
   */
  refreshCardValues: protectedProcedure.mutation(async ({ ctx }) => {
    // Find all NS_IMPORT cards owned by the current user with 0 market value
    const ownerships = await ctx.db.cardOwnership.findMany({
      where: { userId: ctx.user.id },
      select: {
        cardId: true,
        cards: {
          select: {
            id: true,
            nsCardId: true,
            nsSeason: true,
            marketValue: true,
            cardType: true,
            stats: true,
            rarity: true,
          },
        },
      },
    });

    const valCfg = await getValuationConfig(ctx.db);
    let refreshed = 0;
    let failed = 0;

    // Fix 0-value NS cards by re-fetching from NS API
    const zeroValueCards = ownerships.filter(
      (o) =>
        o.cards.cardType === "NS_IMPORT" &&
        o.cards.marketValue === 0 &&
        o.cards.nsCardId &&
        o.cards.nsSeason
    );

    for (const ownership of zeroValueCards) {
      try {
        const info = await nsApiClient.fetchCardInfo(
          String(ownership.cards.nsCardId),
          String(ownership.cards.nsSeason)
        );
        if (info?.market_value) {
          const recomputedValue = computeCardValue(
            {
              rarity: ownership.cards.rarity,
              cardType: ownership.cards.cardType,
              nsMarketValue: parseFloat(info.market_value || "0"),
            },
            valCfg
          );
          if (recomputedValue > 0) {
            await ctx.db.card.update({
              where: { id: ownership.cards.id },
              data: {
                marketValue: recomputedValue,
                stats: {
                  ...((ownership.cards.stats as Record<string, unknown>) || {}),
                  marketValue: info.market_value,
                },
              },
            });
            refreshed++;
          }
        }
      } catch {
        failed++;
      }
    }

    // Recalculate deck value from actual card values
    const allOwned = await ctx.db.cardOwnership.findMany({
      where: { userId: ctx.user.id },
      select: { cards: { select: { marketValue: true } } },
    });

    const totalDeckValue = allOwned.reduce((sum, o) => sum + Math.max(1, o.cards.marketValue), 0);
    const totalCards = allOwned.length;

    await ctx.db.user.update({
      where: { id: ctx.user.id },
      data: {
        deckValue: totalDeckValue,
        totalCards: totalCards,
      },
    });

    return {
      refreshed,
      failed,
      totalCards,
      deckValue: totalDeckValue,
      zeroValueChecked: zeroValueCards.length,
    };
  }),
});
