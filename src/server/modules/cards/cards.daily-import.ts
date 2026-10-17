/**
 * The daily lore import (cron `lore-card-generation`, 02:00 UTC). For each article wiki switched on in the Economy
 * tab, random image-bearing pages with no card yet are queued as one import job, which the card-import-jobs cron
 * works. Nothing goes live: the cards land PENDING and wait in Curation (cards refresh spec §2.1).
 */
import type { PrismaClient } from "@prisma/client";
import { db as appDb } from "~/server/db";
import { titleKey } from "~/lib/wiki-os/core/title";
import {
  CARD_ARTICLE_SOURCES,
  cardSourceLabel,
  type CardArticleSource,
} from "~/lib/cards/card-sources";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { getDailyImportConfig } from "./cards.config";
import { cardedTitleKeys } from "./cards.importer";
import { createImportJob } from "./cards.import-jobs";

type RandomTitles = (count: number, source: CardArticleSource) => Promise<string[]>;
const MAX_DRAWS = 5;
/** MediaWiki's most random pages in one request. */
const MAX_DRAW_SIZE = 50;

/** Up to `count` random image-bearing titles from `source` that have no card yet. */
async function freshTitles(
  db: PrismaClient,
  source: CardArticleSource,
  count: number,
  random: RandomTitles
): Promise<string[]> {
  const found = new Map<string, string>();
  for (let draw = 0; draw < MAX_DRAWS && found.size < count; draw++) {
    const titles = await random(Math.min(count * 3, MAX_DRAW_SIZE), source);
    if (titles.length === 0) break;
    const carded = await cardedTitleKeys(db, source, titles);
    for (const title of titles) {
      const key = titleKey(title, source);
      if (!carded.has(key) && !found.has(key)) found.set(key, title);
    }
  }
  return [...found.values()].slice(0, count);
}

export async function queueDailyImports(
  db: PrismaClient,
  random: RandomTitles
): Promise<Partial<Record<CardArticleSource, number>>> {
  const config = await getDailyImportConfig(db);
  const queued: Partial<Record<CardArticleSource, number>> = {};
  for (const source of CARD_ARTICLE_SOURCES) {
    const { enabled, count } = config[source];
    if (!enabled || count <= 0) continue;
    try {
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
      queued[source] = titles.length;
    } catch (error) {
      console.error(`[Daily card import] ${source} failed:`, error);
      queued[source] = 0;
    }
  }
  return queued;
}

/** The cron entry. The per-minute card-import-jobs run picks the jobs up. */
export async function queueDailyLoreImports(): Promise<Partial<Record<CardArticleSource, number>>> {
  return queueDailyImports(appDb, loreCardDiscovery.fetchRandomArticlesWithImages);
}
