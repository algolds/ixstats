/**
 * The cards admin's SystemConfig settings that are not valuation or market numbers: the rarity table of each source
 * wiki (and the daily import of each source). Read once per import run, so there is no cache.
 */
import type { PrismaClient } from "@prisma/client";
import type { z } from "zod";
import { readConfigKeys, writeConfigKeys } from "~/server/shared/config-kv";
import { CARD_WIKI_SOURCES, type CardWikiSource } from "~/lib/cards/card-sources";
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
