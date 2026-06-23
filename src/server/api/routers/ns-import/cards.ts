/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/ns-api-client";
import { nsImportService } from "~/lib/ns-import-service";
import { type PrismaClient } from "@prisma/client";
import { computeCardValue, getValuationConfig } from "~/lib/card-valuation";

const SYNC_TYPE = "NS_CARD_SYNC";
const activeRunningJobs = new Set<string>();

// ─── Background Processing Functions ──────────────────────────────

/**
 * Process a single nation's deck: fetch cards, deduplicate, upsert into DB.
 * Returns counts of created/updated cards and any errors.
 */
async function processNationDeck(
  db: PrismaClient,
  nationName: string,
  regionName: string
): Promise<{ cardsCreated: number; cardsUpdated: number; errors: string[] }> {
  let cardsCreated = 0;
  let cardsUpdated = 0;
  const errors: string[] = [];

  const deckData = await nsApiClient.fetchDeck(nationName);
  if (!deckData || deckData.cards.length === 0) {
    return { cardsCreated, cardsUpdated, errors };
  }

  const valCfg = await getValuationConfig(db);

  // Deduplicate cards in the deck
  const uniqueCards = new Map<string, (typeof deckData.cards)[0]>();
  for (const card of deckData.cards) {
    const key = `${card.id}-${card.season}`;
    if (!uniqueCards.has(key)) uniqueCards.set(key, card);
  }

  for (const [, nsCard] of uniqueCards) {
    try {
      const nsCardId = parseInt(nsCard.id);
      const nsSeason = parseInt(nsCard.season);
      if (isNaN(nsCardId) || isNaN(nsSeason)) continue;

      const existing = await db.card.findFirst({
        where: { nsCardId, nsSeason },
      });

      if (existing) {
        const newMarketValue = computeCardValue(
          {
            rarity: nsCard.rarity || existing.rarity,
            cardType: "NS_IMPORT",
            nsMarketValue: parseFloat(nsCard.market_value || "0"),
          },
          valCfg
        );
        if (Math.abs(existing.marketValue - newMarketValue) > 0.01) {
          await db.card.update({
            where: { id: existing.id },
            data: {
              marketValue: newMarketValue,
              stats: {
                ...((existing.stats as Record<string, unknown>) || {}),
                region: nsCard.region || (existing.stats as any)?.region,
                marketValue: nsCard.market_value,
              },
            },
          });
          cardsUpdated++;
        }
        continue;
      }

      // Fetch detailed info for new cards missing a name
      if (!nsCard.name) {
        const info = await nsApiClient.fetchCardInfo(nsCard.id, nsCard.season);
        if (info) Object.assign(nsCard, info);
      }

      const name = nsCard.name;
      if (!name) continue;

      const description =
        nsCard.description ||
        nsCard.slogan ||
        nsCard.motto ||
        `${nsCard.category || "Unknown"} from ${nsCard.region || "Unknown"}`;
      const artwork = nsCard.flag || "/images/cards/placeholder-nation.png";

      await db.card.create({
        data: {
          id: `card_ns_${nsCard.id}_s${nsCard.season}`,
          title: name,
          description,
          artwork,
          artworkVariants: nsCard.flag
            ? {
                original: nsCard.flag,
                thumbnail: nsCard.flag,
                large: nsCard.flag,
                flagUrl: nsCard.flag,
              }
            : undefined,
          cardType: "NS_IMPORT",
          rarity: nsCard.rarity || "COMMON",
          season: nsSeason,
          nsCardId,
          nsSeason,
          stats: {
            region: nsCard.region,
            category: nsCard.category,
            govt: nsCard.govt,
            cardcategory: nsCard.cardcategory,
            marketValue: nsCard.market_value,
            badge: nsCard.badge,
            trophies: nsCard.trophies,
          },
          metadata: {
            nsData: { ...nsCard },
            importedFrom: `region:${regionName}`,
            importedAt: new Date().toISOString(),
          },
          marketValue: computeCardValue(
            {
              rarity: nsCard.rarity || "COMMON",
              cardType: "NS_IMPORT",
              nsMarketValue: parseFloat(nsCard.market_value || "0"),
            },
            valCfg
          ),
          totalSupply: 1,
          level: 1,
        },
      });
      cardsCreated++;
    } catch (cardError) {
      const msg = cardError instanceof Error ? cardError.message : String(cardError);
      if (!msg.includes("Unique constraint")) {
        errors.push(`Card ${nsCard.id}: ${msg}`);
      }
    }
  }

  return { cardsCreated, cardsUpdated, errors };
}

/**
 * Process nations in a region in the background.
 * Saves progress to SyncLog after every nation so it can be resumed
 * if the server restarts. The full nation list is stored in metadata.
 *
 * @param startFromIndex - Index into the nations array to resume from (0 = start)
 * @param initialCounts  - Accumulated counts to resume from
 */
async function processRegionNationsInBackground(
  db: PrismaClient,
  syncLogId: string,
  nations: string[],
  regionName: string,
  startFromIndex = 0,
  initialCounts = { cardsCreated: 0, cardsUpdated: 0, errors: [] as string[] }
) {
  activeRunningJobs.add(syncLogId);
  try {
    let nationsProcessed = startFromIndex;
    let cardsCreated = initialCounts.cardsCreated;
    let cardsUpdated = initialCounts.cardsUpdated;
    const errors: string[] = [...initialCounts.errors];

    if (startFromIndex > 0) {
      console.log(
        `[NS Import] Resuming region ${regionName} from nation ${startFromIndex}/${nations.length} (${cardsCreated} cards already created)`
      );
    }

    for (let i = startFromIndex; i < nations.length; i++) {
      // Check if the job was paused or stopped/cancelled in the DB
      const currentJob = await db.syncLog.findUnique({
        where: { id: syncLogId },
        select: { status: true },
      });
      if (currentJob?.status === "PAUSED") {
        console.log(
          `[NS Import] Region ${regionName} fetch paused at nation index ${i}/${nations.length}`
        );
        return; // Exit graceful pause
      }
      if (currentJob?.status === "FAILED") {
        console.log(
          `[NS Import] Region ${regionName} fetch stopped at nation index ${i}/${nations.length}`
        );
        return; // Exit stopped job
      }

      const nationName = nations[i]!;
      try {
        const result = await processNationDeck(db, nationName, regionName);
        cardsCreated += result.cardsCreated;
        cardsUpdated += result.cardsUpdated;
        errors.push(...result.errors);
      } catch (nationError) {
        const msg = nationError instanceof Error ? nationError.message : String(nationError);
        errors.push(`Nation ${nationName}: ${msg}`);
      }

      nationsProcessed = i + 1;

      // Save progress after EVERY nation so we can resume precisely
      await db.syncLog.update({
        where: { id: syncLogId },
        data: {
          itemsProcessed: nationsProcessed,
          cardsProcessed: cardsCreated + cardsUpdated,
          cardsCreated,
          cardsUpdated,
          metadata: {
            regionName,
            totalNations: nations.length,
            nations, // Full nation list stored for resume
            nationsProcessed,
            cardsCreated,
            cardsUpdated,
            errorCount: errors.length,
            lastProcessedIndex: i,
          },
        },
      });
    }

    // Final update — mark complete
    await db.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: errors.length > nations.length / 2 ? "FAILED" : "SUCCESS",
        itemsProcessed: nationsProcessed,
        itemsFailed: errors.length,
        cardsProcessed: cardsCreated + cardsUpdated,
        cardsCreated,
        cardsUpdated,
        errorMessage: errors.length > 0 ? errors.slice(0, 20).join("; ") : null,
        completedAt: new Date(),
        metadata: {
          regionName,
          totalNations: nations.length,
          nations, // Keep for reference
          nationsProcessed,
          cardsCreated,
          cardsUpdated,
          errorCount: errors.length,
        },
      },
    });

    console.log(
      `[NS Import] Region ${regionName} complete: ${nationsProcessed} nations, ${cardsCreated} created, ${cardsUpdated} updated, ${errors.length} errors`
    );
  } finally {
    activeRunningJobs.delete(syncLogId);
  }
}

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
          },
        },
      },
    });

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
          const newValue = Math.max(1, parseFloat(info.market_value));
          if (newValue > 0) {
            await ctx.db.card.update({
              where: { id: ownership.cards.id },
              data: {
                marketValue: newValue,
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
