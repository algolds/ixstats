/**
 * NationStates Sync Processor Service
 *
 * Core background processing logic for syncing NationStates trading-card
 * definitions into the IxCards trading cards database.
 *
 * Compliance: bulk/region syncs are sourced from the official Trading Cards
 * Daily Dump (`cardlist_S{season}.xml.gz`), NOT from per-nation API deck
 * calls. The NationStates API terms are explicit: "it is not feasible to use
 * the API to gather data on every nation in a region at once ... use Daily
 * Dumps rather than dozens/hundreds/thousands of real-time API requests."
 */

import { type PrismaClient } from "@prisma/client";
import { nsApiClient, type NSCard } from "./api-client";
import { computeCardValue, getValuationConfig } from "~/lib/card-valuation";
import { generateNSImportDescription } from "./import-service";

/**
 * Tracks currently active background sync jobs in memory to prevent parallel duplicates.
 */
export const activeRunningJobs = new Set<string>();

export interface SyncCounts {
  cardsCreated: number;
  cardsUpdated: number;
  errors: string[];
}

/**
 * Upsert a single NSCard definition into the DB.
 * Returns flags describing what happened.
 */
export async function upsertNSCardDefinition(
  db: PrismaClient,
  nsCard: NSCard,
  importedFrom: string,
  valCfg: Awaited<ReturnType<typeof getValuationConfig>>
): Promise<{ created: boolean; updated: boolean }> {
  const nsCardId = parseInt(nsCard.id);
  const nsSeason = parseInt(nsCard.season);
  if (isNaN(nsCardId) || isNaN(nsSeason)) return { created: false, updated: false };
  if (!nsCard.name) return { created: false, updated: false };

  const existing = await db.card.findFirst({
    where: { nsCardId, nsSeason },
  });

  const recomputedMarketValue = computeCardValue(
    {
      rarity: nsCard.rarity || existing?.rarity || "COMMON",
      cardType: "NS_IMPORT",
      nsMarketValue: parseFloat(nsCard.market_value || "0"),
    },
    valCfg
  );

  if (existing) {
    // A card hidden via takedown (flag-owner opt-out) must not have its
    // artwork or value silently restored by a re-sync.
    if (existing.isRetired) return { created: false, updated: false };
    if (Math.abs(existing.marketValue - recomputedMarketValue) > 0.01) {
      await db.card.update({
        where: { id: existing.id },
        data: {
          marketValue: recomputedMarketValue,
          stats: {
            ...((existing.stats as Record<string, unknown>) || {}),
            region: nsCard.region || (existing.stats as any)?.region,
            marketValue: nsCard.market_value,
          },
        },
      });
      return { created: false, updated: true };
    }
    return { created: false, updated: false };
  }

  await db.card.create({
    data: {
      id: `card_ns_${nsCard.id}_s${nsCard.season}`,
      title: nsCard.name,
      description: generateNSImportDescription(nsCard),
      artwork: nsCard.flag || "/images/cards/lore-placeholder.svg",
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
        importedFrom,
        importedAt: new Date().toISOString(),
      },
      marketValue: recomputedMarketValue,
      totalSupply: 1,
      level: 1,
    },
  });
  return { created: true, updated: false };
}

/**
 * Load every card in the requested seasons whose region matches any of the
 * given region names, sourced from the official season card dumps.
 */
async function loadRegionCardsFromDumps(
  regionNames: string[],
  seasons: number[]
): Promise<Array<{ id: number; season: number; card: NSCard }>> {
  const norm = (str: string) => str.trim().toLowerCase().replace(/[\s_]+/g, " ");
  const regionSet = new Set(regionNames.map(norm).filter(Boolean));
  const uniqueSeasons = Array.from(new Set(seasons)).sort((a, b) => a - b);
  const matches: Array<{ id: number; season: number; card: NSCard }> = [];

  if (regionSet.size === 0) return matches;

  for (const season of uniqueSeasons) {
    try {
      console.log(`[NS Import] Downloading card dump for season ${season}...`);
      const xml = await nsApiClient.fetchCardDump(season);
      const cards = await nsApiClient.parseNSDump(xml);

      let matched = 0;
      for (const card of cards) {
        if (card.region && regionSet.has(norm(card.region))) {
          const id = parseInt(card.id);
          const s = parseInt(card.season);
          if (!isNaN(id) && !isNaN(s)) {
            matches.push({ id, season: s, card });
            matched++;
          }
        }
      }
      console.log(
        `[NS Import] Season ${season}: ${matched}/${cards.length} cards match target region(s)`
      );
    } catch (err) {
      // A missing/older season dump must not abort the whole sync — log and continue.
      console.error(`[NS Import] Failed to process season ${season} dump:`, err);
    }
  }

  return matches;
}

/**
 * Process cards for one or more regions in the background, sourced from the
 * official Trading Cards Daily Dumps. Saves progress to SyncLog after every
 * card so it can be resumed if the server restarts. Seasons are processed and
 * filtered once up-front; the sync log stores the total card count so a
 * restart can resume from `lastProcessedIndex + 1`.
 */
export async function processRegionCardsFromDump(
  db: PrismaClient,
  syncLogId: string,
  regionNames: string[],
  seasons: number[],
  startFromIndex = 0,
  initialCounts: SyncCounts = { cardsCreated: 0, cardsUpdated: 0, errors: [] }
): Promise<void> {
  activeRunningJobs.add(syncLogId);
  try {
    const valCfg = await getValuationConfig(db);
    const matches = await loadRegionCardsFromDumps(regionNames, seasons);

    if (matches.length === 0) {
      console.warn(
        `[NS Import] No cards matched regions ${regionNames.join(", ")} in seasons ${seasons.join(",")}`
      );
      await db.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: "FAILED",
          errorMessage: "No cards matched the requested region(s) in the card dumps.",
          completedAt: new Date(),
        },
      });
      return;
    }

    let cardsCreated = initialCounts.cardsCreated;
    let cardsUpdated = initialCounts.cardsUpdated;
    const errors: string[] = [...initialCounts.errors];

    if (startFromIndex > 0) {
      console.log(
        `[NS Import] Resuming region sync from card ${startFromIndex}/${matches.length}`
      );
    }

    for (let i = startFromIndex; i < matches.length; i++) {
      // Check if the job was paused or stopped/cancelled in the DB
      const currentJob = await db.syncLog.findUnique({
        where: { id: syncLogId },
        select: { status: true },
      });
      if (currentJob?.status === "PAUSED") {
        console.log(`[NS Import] Region sync paused at card index ${i}/${matches.length}`);
        return; // Exit graceful pause
      }
      if (currentJob?.status === "FAILED") {
        console.log(`[NS Import] Region sync stopped at card index ${i}/${matches.length}`);
        return; // Exit stopped job
      }

      const { card: nsCard } = matches[i]!;
      try {
        const result = await upsertNSCardDefinition(
          db,
          nsCard,
          `region:${regionNames.join(",")}`,
          valCfg
        );
        if (result.created) cardsCreated++;
        else if (result.updated) cardsUpdated++;
      } catch (cardError) {
        const msg = cardError instanceof Error ? cardError.message : String(cardError);
        if (!msg.includes("Unique constraint")) {
          errors.push(`Card ${nsCard.id}: ${msg}`);
        }
      }

      const cardsProcessed = cardsCreated + cardsUpdated;

      // Save progress after EVERY card so we can resume precisely
      await db.syncLog.update({
        where: { id: syncLogId },
        data: {
          itemsProcessed: i + 1,
          cardsProcessed: cardsProcessed,
          cardsCreated,
          cardsUpdated,
          metadata: {
            regionNames,
            seasons,
            totalCards: matches.length,
            cardsProcessed,
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
        status: errors.length > matches.length / 2 ? "FAILED" : "SUCCESS",
        itemsProcessed: matches.length,
        itemsFailed: errors.length,
        cardsProcessed: cardsCreated + cardsUpdated,
        cardsCreated,
        cardsUpdated,
        errorMessage: errors.length > 0 ? errors.slice(0, 20).join("; ") : null,
        completedAt: new Date(),
        metadata: {
          regionNames,
          seasons,
          totalCards: matches.length,
          cardsCreated,
          cardsUpdated,
          errorCount: errors.length,
        },
      },
    });

    console.log(
      `[NS Import] Region sync complete: ${matches.length} cards, ${cardsCreated} created, ${cardsUpdated} updated, ${errors.length} errors`
    );
  } finally {
    activeRunningJobs.delete(syncLogId);
  }
}

/**
 * Filter imported NS cards by active vs. CTE'd nation status.
 * Ingests nations.xml.gz and tags all NS_IMPORT cards with metadata.isCTE.
 */
export async function processCTENationFilter(db: PrismaClient): Promise<{
  totalProcessed: number;
  cteCount: number;
  activeCount: number;
}> {
  console.log("[NS Import] Starting CTE nation status filter job...");
  const activeNations = await nsApiClient.fetchActiveNationsDump();

  const cards = await db.card.findMany({
    where: { cardType: "NS_IMPORT" },
    select: { id: true, title: true, metadata: true },
  });

  let cteCount = 0;
  let activeCount = 0;

  const BATCH_SIZE = 100;
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const chunk = cards.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (card) => {
        const meta = (card.metadata as Record<string, any>) || {};
        const nsName = (meta.nsData?.name || card.title || "").trim().toLowerCase();

        const isActive = activeNations.has(nsName);
        const isCTE = !isActive;

        if (isCTE) {
          cteCount++;
        } else {
          activeCount++;
        }

        await db.card.update({
          where: { id: card.id },
          data: {
            metadata: {
              ...meta,
              isCTE,
              cteCheckedAt: new Date().toISOString(),
            },
          },
        });
      })
    );
  }

  console.log(
    `[NS Import] CTE filter complete: ${cards.length} processed (${activeCount} active, ${cteCount} CTE'd)`
  );

  return {
    totalProcessed: cards.length,
    cteCount,
    activeCount,
  };
}
