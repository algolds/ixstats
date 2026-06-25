/**
 * Card Valuation — single source of truth for what a card is worth.
 *
 * Replaces three previously-disconnected tables (raw NS passthrough in ns-import,
 * the rarity base table in card-service.getCardMarketValue, and JUNK_VALUES in
 * cards.junkCards). One formula, one tunable config (SystemConfig-backed, DM-editable
 * — same pattern as exchange-config.ts).
 *
 *   value = max( rarityFloor[rarity] × typeMult ,  nsMarketValue × nsPremium )
 *
 * - rarity floor lifts the ~99% of NS imports stuck at NS bank value 1 onto a real curve
 * - nsPremium rewards importers; on genuinely-valuable NS cards it floats them above floor
 * - native cards (LORE/NATION/SPECIAL) ride the same curve, so everything is comparable
 *
 * ponytail: no supply/demand multiplier baked into the stored value — base value is
 * predictable and admin-tunable; let auctions/trades discover live prices. Add a demand
 * coefficient here only if catalog value needs to move with float.
 */

import { type PrismaClient } from "@prisma/client";

export interface CardValuationConfig {
  floorCommon: number;
  floorUncommon: number;
  floorRare: number;
  floorUltraRare: number;
  floorEpic: number;
  floorLegendary: number;
  /** Multiplier applied to a card's NS bank value (retain + premium). */
  nsPremium: number;
  /** Type multipliers on the rarity floor (NS_IMPORT/LORE/COMMUNITY = 1.0). */
  multSpecial: number;
  multNation: number;
  /** Fraction of the rarity floor paid out when a card is junked. */
  junkRate: number;
}

export const CARD_VALUATION_DEFAULTS: CardValuationConfig = {
  floorCommon: 10,
  floorUncommon: 30,
  floorRare: 100,
  floorUltraRare: 300,
  floorEpic: 1000,
  floorLegendary: 3000,
  nsPremium: 1.5,
  multSpecial: 2.0,
  multNation: 1.5,
  junkRate: 1.0,
};

const KEY = {
  floorCommon: "card_valuation_floor_common",
  floorUncommon: "card_valuation_floor_uncommon",
  floorRare: "card_valuation_floor_rare",
  floorUltraRare: "card_valuation_floor_ultra_rare",
  floorEpic: "card_valuation_floor_epic",
  floorLegendary: "card_valuation_floor_legendary",
  nsPremium: "card_valuation_ns_premium",
  multSpecial: "card_valuation_mult_special",
  multNation: "card_valuation_mult_nation",
  junkRate: "card_valuation_junk_rate",
} as const satisfies Record<keyof CardValuationConfig, string>;

let cache: { value: CardValuationConfig; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** Read the merged valuation config (defaults overlaid with any SystemConfig rows). */
export async function getValuationConfig(db: PrismaClient): Promise<CardValuationConfig> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;

  const rows = await db.systemConfig.findMany({
    where: { key: { startsWith: "card_valuation_" } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const merged = { ...CARD_VALUATION_DEFAULTS };
  for (const field of Object.keys(KEY) as (keyof CardValuationConfig)[]) {
    const raw = byKey.get(KEY[field]);
    if (raw != null) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) merged[field] = parsed;
    }
  }

  cache = { value: merged, expires: now + CACHE_TTL_MS };
  return merged;
}

/** Update a single config value (DM admin). Invalidates the in-memory cache. */
export async function setValuationConfig(
  db: PrismaClient,
  field: keyof CardValuationConfig,
  value: number
): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: KEY[field] },
    create: { key: KEY[field], value: String(value), description: `Card valuation: ${field}` },
    update: { value: String(value) },
  });
  cache = null;
}

/** The configured rarity floor for a given rarity string. */
export function rarityFloor(cfg: CardValuationConfig, rarity: string): number {
  switch (rarity) {
    case "LEGENDARY":
      return cfg.floorLegendary;
    case "EPIC":
      return cfg.floorEpic;
    case "ULTRA_RARE":
      return cfg.floorUltraRare;
    case "RARE":
      return cfg.floorRare;
    case "UNCOMMON":
      return cfg.floorUncommon;
    default:
      return cfg.floorCommon;
  }
}

/** Credits paid out when junking a card of this rarity. */
export function junkValue(cfg: CardValuationConfig, rarity: string): number {
  return Math.round(rarityFloor(cfg, rarity) * cfg.junkRate);
}

/**
 * The canonical value of a card. `nsMarketValue` is the raw NS bank value (the source
 * of truth for imports, stored in card.stats.marketValue) — null/0 for native cards.
 */
export function computeCardValue(
  input: { rarity: string; cardType: string; nsMarketValue?: number | null },
  cfg: CardValuationConfig
): number {
  const floor = rarityFloor(cfg, input.rarity);
  const typeMult =
    input.cardType === "SPECIAL"
      ? cfg.multSpecial
      : input.cardType === "NATION"
        ? cfg.multNation
        : 1;
  const base = floor * typeMult;
  const ns = Math.max(0, input.nsMarketValue ?? 0) * cfg.nsPremium;
  return Math.round(Math.max(base, ns) * 100) / 100;
}

/**
 * Recompute marketValue for every card under the current config. Set-based UPDATEs
 * grouped by rarity (handles 56k+ NS cards in 6 statements, not 56k round-trips).
 * NS source value is read from stats->>'marketValue' so re-running is idempotent.
 */
export async function recomputeAllCardValues(db: PrismaClient): Promise<{ updated: number }> {
  const cfg = await getValuationConfig(db);
  const rarities: Array<[string, number]> = [
    ["COMMON", cfg.floorCommon],
    ["UNCOMMON", cfg.floorUncommon],
    ["RARE", cfg.floorRare],
    ["ULTRA_RARE", cfg.floorUltraRare],
    ["EPIC", cfg.floorEpic],
    ["LEGENDARY", cfg.floorLegendary],
  ];

  let updated = 0;
  for (const [rarity, floor] of rarities) {
    // All numbers below come from validated numeric config; rarity is from a fixed list.
    const sql = `
      UPDATE cards SET "marketValue" = CASE
        WHEN "cardType" = 'NS_IMPORT'
          THEN GREATEST(${floor}, COALESCE(NULLIF(stats->>'marketValue', '')::numeric, 0) * ${cfg.nsPremium})
        WHEN "cardType" = 'SPECIAL' THEN ${floor * cfg.multSpecial}
        WHEN "cardType" = 'NATION'  THEN ${floor * cfg.multNation}
        ELSE ${floor}
      END,
      "updatedAt" = now()
      WHERE rarity = '${rarity}'`;
    updated += await db.$executeRawUnsafe(sql);
  }
  return { updated };
}
