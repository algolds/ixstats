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

import type { Card, Prisma, PrismaClient } from "@prisma/client";
import { nsApiClient, type NSCard } from "./api-client";
import { computeCardValue, getValuationConfig } from "~/lib/cards/valuation";
import { CardRarity, CardType, parseCardRarity } from "~/lib/cards/enums";
import {
  isJsonObject,
  nsFactsFromApi,
  nsFactsOf,
  pickNsFacts,
  withNsFacts,
} from "~/lib/cards/ns-facts";
import { NS_REALM_ID } from "~/lib/realms/realm-ids";
import { generateNSImportDescription } from "./import-service";

/**
 * Tracks currently active background sync jobs in memory to prevent parallel duplicates.
 */
export const activeRunningJobs = new Set<string>();

interface SyncCounts {
  cardsCreated: number;
  cardsUpdated: number;
  errors: string[];
}

/** The definition an NS card creates: it waits for review; a region sync's card names its sync. */
export function nsCardDefinitionData(
  nsCard: NSCard & { name: string },
  context: {
    importedFrom: string;
    rarity: CardRarity;
    marketValue: number;
    syncLogId: string | null;
  }
): Prisma.CardUncheckedCreateInput {
  const nsSeason = parseInt(nsCard.season, 10);
  return {
    id: `card_ns_${nsCard.id}_s${nsCard.season}`,
    title: nsCard.name,
    description: generateNSImportDescription(nsCard),
    artwork: nsCard.flag || "/images/cards/lore-placeholder.svg",
    cardType: CardType.NS,
    realmId: NS_REALM_ID,
    rarity: context.rarity,
    season: nsSeason,
    nsCardId: parseInt(nsCard.id, 10),
    nsSeason,
    totalSupply: 1,
    reviewState: "PENDING",
    marketValue: context.marketValue,
    metadata: {
      nsData: nsFactsFromApi(nsCard),
      importedFrom: context.importedFrom,
      importedAt: new Date().toISOString(),
      ...(context.syncLogId ? { syncLogId: context.syncLogId } : {}),
    },
  };
}

/**
 * The one NS card definition upsert (the region sync, which passes its SyncLog id, and the deck import, which passes
 * null): finds the card, refreshing its value and NS facts, or creates it waiting for review. A taken-down (retired)
 * card is returned untouched. Null for a card without a valid id or a name, which writes nothing. `db` may be a
 * transaction client.
 */
export async function upsertNSCardDefinition(
  db: Pick<Prisma.TransactionClient, "card">,
  nsCard: NSCard,
  importedFrom: string,
  valCfg: Awaited<ReturnType<typeof getValuationConfig>>,
  syncLogId: string | null
): Promise<{ card: Card; created: boolean; updated: boolean } | null> {
  const nsCardId = parseInt(nsCard.id);
  const nsSeason = parseInt(nsCard.season);
  if (isNaN(nsCardId) || isNaN(nsSeason)) return null;
  if (!nsCard.name) return null;

  const existing = await db.card.findFirst({
    where: { nsCardId, nsSeason },
  });

  const rarity = parseCardRarity(nsCard.rarity) ?? existing?.rarity ?? CardRarity.COMMON;
  const recomputedMarketValue = computeCardValue(
    { rarity, cardType: CardType.NS, nsMarketValue: parseFloat(nsCard.market_value || "0") },
    valCfg
  );

  if (existing) {
    // A card hidden via takedown (flag-owner opt-out) must not have its
    // artwork or value silently restored by a re-sync.
    if (existing.isRetired) return { card: existing, created: false, updated: false };
    if (Math.abs(existing.marketValue - recomputedMarketValue) > 0.01) {
      const fresh = nsFactsFromApi({ region: nsCard.region, market_value: nsCard.market_value });
      const card = await db.card.update({
        where: { id: existing.id },
        data: {
          marketValue: recomputedMarketValue,
          metadata: withNsFacts(
            existing.metadata,
            pickNsFacts(fresh, nsFactsOf(existing.metadata))
          ),
        },
      });
      return { card, created: false, updated: true };
    }
    return { card: existing, created: false, updated: false };
  }

  const card = await db.card.create({
    data: nsCardDefinitionData(
      { ...nsCard, name: nsCard.name },
      { importedFrom, rarity, marketValue: recomputedMarketValue, syncLogId }
    ),
  });
  return { card, created: true, updated: false };
}

/**
 * Load every card in the requested seasons whose region matches any of the
 * given region names, sourced from the official season card dumps.
 */
async function loadRegionCardsFromDumps(
  regionNames: string[],
  seasons: number[],
  onSeasonRead: () => Promise<void>
): Promise<Array<{ id: number; season: number; card: NSCard }>> {
  const norm = (str: string) =>
    str
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, " ");
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
    await onSeasonRead();
  }

  return matches;
}

/**
 * Marks a sync alive while it reads the season dumps, which can take minutes each. It merges into the stored
 * metadata, which still holds what a resume needs (the region list and the last card worked).
 */
/** Who started a sync, read once from its log, so the progress writes that replace its metadata keep it. */
async function startedByOf(db: PrismaClient, syncLogId: string): Promise<{ startedBy?: string }> {
  const log = await db.syncLog.findUnique({ where: { id: syncLogId }, select: { metadata: true } });
  const meta = log?.metadata;
  return isJsonObject(meta) && typeof meta.startedBy === "string"
    ? { startedBy: meta.startedBy }
    : {};
}

async function beatHeartbeat(db: PrismaClient, syncLogId: string): Promise<void> {
  const log = await db.syncLog.findUnique({ where: { id: syncLogId }, select: { metadata: true } });
  const metadata = log?.metadata;
  await db.syncLog.update({
    where: { id: syncLogId },
    data: {
      metadata: {
        ...(isJsonObject(metadata) ? metadata : {}),
        heartbeatAt: new Date().toISOString(),
      },
    },
  });
}

/**
 * A run's final status write lands only while its sync is still open (running or paused), so it never writes over a
 * stop an admin has already recorded.
 */
const STILL_OPEN = { in: ["IN_PROGRESS", "PAUSED"] } satisfies Prisma.StringFilter;

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
    const keep = await startedByOf(db, syncLogId);
    const matches = await loadRegionCardsFromDumps(regionNames, seasons, () =>
      beatHeartbeat(db, syncLogId)
    );

    if (matches.length === 0) {
      console.warn(
        `[NS Import] No cards matched regions ${regionNames.join(", ")} in seasons ${seasons.join(",")}`
      );
      await db.syncLog.updateMany({
        where: { id: syncLogId, status: STILL_OPEN },
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
      console.log(`[NS Import] Resuming region sync from card ${startFromIndex}/${matches.length}`);
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
          valCfg,
          syncLogId
        );
        if (result?.created) cardsCreated++;
        else if (result?.updated) cardsUpdated++;
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
            ...keep,
            regionNames,
            seasons,
            totalCards: matches.length,
            cardsProcessed,
            cardsCreated,
            cardsUpdated,
            errorCount: errors.length,
            lastProcessedIndex: i,
            heartbeatAt: new Date().toISOString(),
          },
        },
      });
    }

    // Final update — mark complete
    await db.syncLog.updateMany({
      where: { id: syncLogId, status: STILL_OPEN },
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
          ...keep,
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

const CTE_BATCH = 500;

/**
 * The fewest active nations a whole dump can hold: a floor, and a share of the nations the last successful run read.
 * A smaller set (an empty or cut-off read) would mark nearly every card ceased, so the filter refuses it.
 */
export const CTE_DUMP_SANITY = { minNations: 1_000, minShareOfLastRun: 0.5 } as const;

const count = (n: number) => n.toLocaleString("en-US");

/** Refuses an active-nations set too small to be the whole dump, before any card is read or written. */
async function assertWholeDump(db: PrismaClient, nations: number): Promise<void> {
  const last = await db.syncLog.findFirst({
    where: { syncType: "NS_CTE_FILTER", status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { metadata: true },
  });
  const meta = last?.metadata;
  const lastNations =
    isJsonObject(meta) && typeof meta.activeNations === "number" ? meta.activeNations : null;
  const needed = Math.ceil(
    Math.max(CTE_DUMP_SANITY.minNations, (lastNations ?? 0) * CTE_DUMP_SANITY.minShareOfLastRun)
  );
  if (nations >= needed) return;
  const lastRun = lastNations === null ? "" : `; the last run read ${count(lastNations)}`;
  throw new Error(
    `The active-nations dump listed ${count(nations)} nations, too few to be whole (at least ${count(needed)}${lastRun}). No card was changed.`
  );
}

export interface CteCounts {
  totalProcessed: number;
  cteCount: number;
  activeCount: number;
}

/**
 * Tags every NationStates card with `metadata.isCTE` (its nation has ceased to exist) against the daily
 * active-nations dump, a page of cards at a time, writing its progress to its SyncLog. Pages by `id > last`, so a
 * card deleted mid-run never ends the walk early. Throws, changing nothing, on a dump too small to be whole.
 */
export async function processCTENationFilter(
  db: PrismaClient,
  syncLogId: string
): Promise<CteCounts> {
  const activeNations = await nsApiClient.fetchActiveNationsDump();
  await assertWholeDump(db, activeNations.size);
  const keep = await startedByOf(db, syncLogId);
  const counts: CteCounts = { totalProcessed: 0, cteCount: 0, activeCount: 0 };
  let last: string | null = null;
  for (;;) {
    const cards: Array<Pick<Card, "id" | "title" | "metadata">> = await db.card.findMany({
      where: { cardType: CardType.NS, ...(last ? { id: { gt: last } } : {}) },
      select: { id: true, title: true, metadata: true },
      orderBy: { id: "asc" },
      take: CTE_BATCH,
    });
    if (cards.length === 0) break;
    await Promise.all(
      cards.map((card) => {
        const nation = (nsFactsOf(card.metadata).name ?? card.title).trim().toLowerCase();
        const isCTE = !activeNations.has(nation);
        counts[isCTE ? "cteCount" : "activeCount"]++;
        return db.card.update({
          where: { id: card.id },
          data: {
            metadata: {
              ...(isJsonObject(card.metadata) ? card.metadata : {}),
              isCTE,
              cteCheckedAt: new Date().toISOString(),
            },
          },
        });
      })
    );
    counts.totalProcessed += cards.length;
    last = cards[cards.length - 1]!.id;
    await db.syncLog.update({
      where: { id: syncLogId },
      data: { itemsProcessed: counts.totalProcessed },
    });
  }
  await db.syncLog.update({
    where: { id: syncLogId },
    data: {
      status: "SUCCESS",
      completedAt: new Date(),
      itemsProcessed: counts.totalProcessed,
      metadata: { ...keep, ...counts, activeNations: activeNations.size },
    },
  });
  console.log(
    `[NS Import] CTE filter complete: ${counts.totalProcessed} processed (${counts.activeCount} active, ${counts.cteCount} CTE'd)`
  );
  return counts;
}
