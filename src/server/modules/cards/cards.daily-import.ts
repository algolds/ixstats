/**
 * The daily lore import (cron `lore-card-generation`, 02:00 UTC). For each article wiki switched on in the Economy
 * tab, random image-bearing pages with no card yet are queued as one import job, once a day, which the
 * card-import-jobs cron works. Nothing goes live: the cards land PENDING and wait in Curation (cards refresh spec
 * §2.1). A wiki whose draw fails queues nothing; the cron run then fails naming it, after the others are queued.
 */
import type { PrismaClient } from "@prisma/client";
import { db as appDb } from "~/server/db";
import { titleKey } from "~/lib/wiki-os/core/title";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import {
  CARD_ARTICLE_SOURCES,
  cardSourceLabel,
  type CardArticleSource,
} from "~/lib/cards/card-sources";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { stoppedWikiMessage } from "~/lib/cards/lore-card-mediawiki";
import { getDailyImportConfig } from "./cards.config";
import { cardedTitleKeys } from "./cards.importer";
import { createImportJob } from "./cards.import-jobs";

type RandomTitles = (count: number, source: CardArticleSource) => Promise<string[]>;
const MAX_DRAWS = 5;

export interface DailyImportRun {
  /** The pages queued for each wiki that drew. */
  queued: Partial<Record<CardArticleSource, number>>;
  /** Why each wiki whose draw failed queued nothing, in a sentence that names it. */
  failed: Partial<Record<CardArticleSource, string>>;
}

/** Up to `count` random image-bearing titles from `source` that have no card yet. */
async function freshTitles(
  db: PrismaClient,
  source: CardArticleSource,
  count: number,
  random: RandomTitles
): Promise<string[]> {
  const found = new Map<string, string>();
  for (let draw = 0; draw < MAX_DRAWS && found.size < count; draw++) {
    // Three times as many as it needs, since some already have a card.
    const titles = await random(count * 3, source);
    if (titles.length === 0) break;
    const carded = await cardedTitleKeys(db, source, titles);
    for (const title of titles) {
      const key = titleKey(title, source);
      if (!carded.has(key) && !found.has(key)) found.set(key, title);
    }
  }
  return [...found.values()].slice(0, count);
}

/** Whether `source` already has a daily job since UTC midnight of `now`. */
async function queuedToday(db: PrismaClient, source: CardArticleSource, now: Date) {
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const job = await db.cardImportJob.findFirst({
    where: { kind: "DAILY", source, createdAt: { gte: midnight } },
    select: { id: true },
  });
  return job !== null;
}

/** A failure's message, naming the wiki once. */
function namingWiki(source: CardArticleSource, message: string): string {
  const label = cardSourceLabel(source);
  return message.startsWith(label) ? message : `${label}: ${message}`;
}

export async function queueDailyImports(
  db: PrismaClient,
  random: RandomTitles,
  now: Date = new Date()
): Promise<DailyImportRun> {
  const config = await getDailyImportConfig(db);
  const run: DailyImportRun = { queued: {}, failed: {} };
  for (const source of CARD_ARTICLE_SOURCES) {
    const { enabled, count } = config[source];
    if (!enabled || count <= 0) continue;
    try {
      if (await queuedToday(db, source, now)) continue;
      const titles = await freshTitles(db, source, count, random);
      if (titles.length > 0) {
        await createImportJob(db, {
          source,
          kind: "DAILY",
          label: `Daily ${cardSourceLabel(source)} import`,
          titles,
          requestedBy: null,
          requireImage: true,
        });
      }
      run.queued[source] = titles.length;
    } catch (error) {
      console.error(`[Daily card import] ${source} failed:`, error);
      run.failed[source] =
        error instanceof DiscoveryStopped
          ? stoppedWikiMessage(source, error.stop)
          : namingWiki(source, error instanceof Error ? error.message : String(error));
    }
  }
  return run;
}

/**
 * The cron entry. The per-minute card-import-jobs run picks the jobs up. A failed wiki fails the run, so cron-runner
 * records it and alerts, once every other wiki is queued.
 */
export async function queueDailyLoreImports(): Promise<Partial<Record<CardArticleSource, number>>> {
  const { queued, failed } = await queueDailyImports(
    appDb,
    loreCardDiscovery.fetchRandomArticlesWithImages
  );
  const reasons = Object.values(failed);
  if (reasons.length > 0) throw new Error(`Daily card import failed: ${reasons.join(" ")}`);
  return queued;
}
