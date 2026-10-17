/**
 * The cards admin's SystemConfig settings that are not valuation or market numbers: the rarity table of each source
 * wiki, and the daily import of each article wiki. Read once per import run, so there is no cache.
 */
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { readConfigKeys, writeConfigKeys } from "~/server/shared/config-kv";
import {
  CARD_ARTICLE_SOURCES,
  CARD_WIKI_SOURCES,
  type CardArticleSource,
  type CardWikiSource,
} from "~/lib/cards/card-sources";
import {
  DEFAULT_RARITY_THRESHOLDS,
  RarityThresholdsSchema,
  type RarityThresholds,
} from "~/lib/cards/rarity-engine";

const thresholdsKey = (source: CardWikiSource) => `card_rarity_thresholds_${source}`;

/** A stored JSON value read by `schema`; null when it is missing, not JSON, or fails the schema. */
function parseStoredConfig<T>(raw: string | undefined, schema: z.ZodType<T>): T | null {
  if (raw === undefined) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getRarityThresholds(
  db: PrismaClient
): Promise<Record<CardWikiSource, RarityThresholds>> {
  const stored = await readConfigKeys(db, CARD_WIKI_SOURCES.map(thresholdsKey));
  const tables: Record<CardWikiSource, RarityThresholds> = { ...DEFAULT_RARITY_THRESHOLDS };
  for (const source of CARD_WIKI_SOURCES) {
    const parsed = parseStoredConfig(stored[thresholdsKey(source)], RarityThresholdsSchema);
    if (parsed) tables[source] = parsed;
  }
  return tables;
}

export async function setRarityThresholds(
  db: PrismaClient,
  source: CardWikiSource,
  thresholds: RarityThresholds
): Promise<void> {
  const valid = RarityThresholdsSchema.parse(thresholds);
  await writeConfigKeys(
    db,
    [{ key: thresholdsKey(source), value: JSON.stringify(valid) }],
    () => `Card rarity thresholds: ${source}`
  );
}

/** One article wiki's daily lore import (cards.daily-import.ts): whether it runs, and how many pages it queues. */
export interface DailyImportSetting {
  enabled: boolean;
  count: number;
}

export const MAX_DAILY_IMPORT = 100;

export const DailyImportSettingSchema = z.object({
  enabled: z.boolean(),
  count: z.number().int().min(0).max(MAX_DAILY_IMPORT),
});

/** Today's 20 a day from IxWiki and IIWiki; AltHistory stays off until its licences have been reviewed. */
export const DAILY_IMPORT_DEFAULTS: Readonly<
  Record<CardArticleSource, Readonly<DailyImportSetting>>
> = {
  ixwiki: Object.freeze({ enabled: true, count: 20 }),
  iiwiki: Object.freeze({ enabled: true, count: 20 }),
  althistory: Object.freeze({ enabled: false, count: 0 }),
};

const dailyKey = (source: CardArticleSource) => `card_daily_import_${source}`;

export async function getDailyImportConfig(
  db: PrismaClient
): Promise<Record<CardArticleSource, DailyImportSetting>> {
  const stored = await readConfigKeys(db, CARD_ARTICLE_SOURCES.map(dailyKey));
  const config: Record<CardArticleSource, DailyImportSetting> = { ...DAILY_IMPORT_DEFAULTS };
  for (const source of CARD_ARTICLE_SOURCES) {
    const parsed = parseStoredConfig(stored[dailyKey(source)], DailyImportSettingSchema);
    if (parsed) config[source] = parsed;
  }
  return config;
}

export async function setDailyImportSetting(
  db: PrismaClient,
  source: CardArticleSource,
  setting: DailyImportSetting
): Promise<void> {
  const valid = DailyImportSettingSchema.parse(setting);
  await writeConfigKeys(
    db,
    [{ key: dailyKey(source), value: JSON.stringify(valid) }],
    () => `Daily card import: ${source}`
  );
}
