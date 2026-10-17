/**
 * Card Valuation — single source of truth for what a card is worth.
 *
 * Replaces previously-disconnected tables (raw NS passthrough in ns-import and the
 * rarity base table in card-service.getCardMarketValue). One formula, one tunable config
 * (SystemConfig-backed, DM-editable — same pattern as exchange-config.ts).
 *
 *   value = max( rarityFloor[rarity] × typeMult ,  nsMarketValue × nsPremium )
 *
 * - rarity floor lifts the ~99% of NS cards stuck at NS bank value 1 onto a real curve
 * - nsPremium rewards importers; on genuinely-valuable NS cards it floats them above floor
 * - native cards (LORE/NATION/SPECIAL) ride the same curve, so everything is comparable
 * - NS bank values live in `metadata.nsData.market_value` (src/lib/cards/ns-facts.ts)
 *
 * ponytail: no supply/demand multiplier baked into the stored value — base value is
 * predictable and admin-tunable; let auctions/trades discover live prices. Add a demand
 * coefficient here only if catalog value needs to move with float.
 */

import { type Prisma, type PrismaClient } from "@prisma/client";

export interface CardValuationConfig {
  floorCommon: number;
  floorUncommon: number;
  floorRare: number;
  floorUltraRare: number;
  floorEpic: number;
  floorLegendary: number;
  /** Multiplier applied to a card's NS bank value (retain + premium). */
  nsPremium: number;
  /** Type multipliers on the rarity floor (LORE/NS/TROPHY = 1.0). */
  multSpecial: number;
  multNation: number;
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
} as const satisfies Record<keyof CardValuationConfig, string>;

let cache: { value: CardValuationConfig; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** Forget the cached config; a caller that writes it in a transaction calls this once the transaction commits. */
export function clearValuationCache(): void {
  cache = null;
}

/** The stored config, defaults overlaid with any SystemConfig rows, read past the cache. */
export async function readValuationConfig(
  db: Pick<PrismaClient, "systemConfig">
): Promise<CardValuationConfig> {
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
  return merged;
}

/** Read the merged valuation config (defaults overlaid with any SystemConfig rows). */
export async function getValuationConfig(db: PrismaClient): Promise<CardValuationConfig> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;
  const merged = await readValuationConfig(db);
  cache = { value: merged, expires: now + CACHE_TTL_MS };
  return merged;
}

/**
 * Update a single config value (DM admin). The app client's write is visible at once, so it clears the cache here; a
 * transaction's caller clears it after the commit, as a read before then would cache the old value again.
 */
export async function setValuationConfig(
  db: Pick<PrismaClient, "systemConfig">,
  field: keyof CardValuationConfig,
  value: number
): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: KEY[field] },
    create: { key: KEY[field], value: String(value), description: `Card valuation: ${field}` },
    update: { value: String(value) },
  });
  if ("$transaction" in db) clearValuationCache();
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

/**
 * The canonical value of a card. `nsMarketValue` is the NS bank value
 * (`metadata.nsData.market_value`); null or 0 for other cards.
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

/** Arbitrary constant; identifies the revalue lock in pg_locks. */
const REVALUE_LOCK_NAMESPACE = 7336;
/** Six set-based updates over every card take seconds, well past the interactive transaction's default 5 s. */
const REVALUE_TIMEOUT_MS = 60_000;

/**
 * Recompute marketValue for every card under the current config. Set-based UPDATEs
 * grouped by rarity (handles 56k+ NS cards in 6 statements, not 56k round-trips).
 * NS source value is read from metadata.nsData so re-running is idempotent.
 * One revalue runs at a time, in one transaction under its lock, and reads the config
 * after taking it, past the cache: two interleaved revalues could otherwise leave a
 * rarity valued under the older config. Only cards whose value changes are written.
 */
export async function recomputeAllCardValues(db: PrismaClient): Promise<{ updated: number }> {
  return db.$transaction(
    async (tx) => {
      // $executeRaw, not $queryRaw: Prisma cannot deserialize the void pg_advisory_xact_lock returns.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REVALUE_LOCK_NAMESPACE}::int, 0)`;
      return revalueCards(tx, await readValuationConfig(tx));
    },
    { timeout: REVALUE_TIMEOUT_MS }
  );
}

async function revalueCards(
  tx: Prisma.TransactionClient,
  cfg: CardValuationConfig
): Promise<{ updated: number }> {
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
    const value = `CASE
        WHEN "cardType" = 'NS'
          THEN GREATEST(${floor}, COALESCE(NULLIF(metadata->'nsData'->>'market_value', '')::numeric, 0) * ${cfg.nsPremium})
        WHEN "cardType" = 'SPECIAL' THEN ${floor * cfg.multSpecial}
        WHEN "cardType" = 'NATION'  THEN ${floor * cfg.multNation}
        ELSE ${floor}
      END`;
    const sql = `
      UPDATE cards SET "marketValue" = ${value},
      "updatedAt" = now()
      WHERE rarity = '${rarity}' AND "marketValue" IS DISTINCT FROM ${value}`;
    updated += await tx.$executeRawUnsafe(sql);
  }
  return { updated };
}
