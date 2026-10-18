/**
 * Card Valuation — single source of truth for what a card and each of its copies are worth.
 *
 * Replaces previously-disconnected tables (raw NS passthrough in ns-import and the
 * rarity base table in card-service.getCardMarketValue). One formula, one tunable config
 * (SystemConfig-backed, DM-editable — same pattern as exchange-config.ts).
 *
 *   base  = max( rarityFloor[rarity] × typeMult × finishMult ,  market median at the finish ,  NS term )
 *   value = base × (1 + levelBonus)
 *
 * - rarity floor lifts the ~99% of NS cards stuck at NS bank value 1 onto a real curve
 * - the NS term (bank value × nsPremium) rewards importers until a copy of the card first sells here
 * - native cards (LORE/NATION/SPECIAL/TROPHY) ride the same curve, so everything is comparable
 * - NS bank values live in `metadata.nsData.market_value` (src/lib/cards/ns-facts.ts)
 * - a retired card's copies are worth 0 (hidden copies, cards refresh Phase 3)
 *
 * `Card.marketValue` is a Standard copy at level 1 (`referenceValue`); `valueOfCopy` values one copy.
 */

import type { CardFinish, CardRarity, CardType, Prisma, PrismaClient } from "@prisma/client";
import { clampLevel } from "./levels";

export interface CardValuationConfig {
  floorCommon: number;
  floorUncommon: number;
  floorRare: number;
  floorUltraRare: number;
  floorEpic: number;
  floorLegendary: number;
  /** NS bank value multiple, the third term of an NS card's value until it first sells here. */
  nsPremium: number;
  /** Type multiples on the rarity floor (LORE and NS are 1). */
  multSpecial: number;
  multNation: number;
  /** Display value of trophies; they stay out of the dividend. */
  multTrophy: number;
  /** Value multiples of Foil and Holo copies (Serialised is 1). */
  finishFoil: number;
  finishHolo: number;
  /** +levelBonusPerLevel per level above 1, at most levelBonusCap. */
  levelBonusPerLevel: number;
  levelBonusCap: number;
  /** The market median is over the last `medianSales` sales within `medianDays`. */
  medianSales: number;
  medianDays: number;
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
  multTrophy: 0.25,
  finishFoil: 3,
  finishHolo: 9,
  levelBonusPerLevel: 0.02,
  levelBonusCap: 0.2,
  medianSales: 5,
  medianDays: 30,
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
  multTrophy: "card_valuation_mult_trophy",
  finishFoil: "card_valuation_finish_foil",
  finishHolo: "card_valuation_finish_holo",
  levelBonusPerLevel: "card_valuation_level_bonus_per_level",
  levelBonusCap: "card_valuation_level_bonus_cap",
  medianSales: "card_valuation_median_sales",
  medianDays: "card_valuation_median_days",
} as const satisfies Record<keyof CardValuationConfig, string>;

let cache: { value: CardValuationConfig; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** Forget the cached config; a caller that writes it in a transaction calls this once the transaction commits. */
export function clearValuationCache(): void {
  cache = null;
}

/** Keeps stored numbers in range: nothing negative, whole sale counts and days, the level bonus at most 100%. */
export function clampValuationConfig(raw: CardValuationConfig): CardValuationConfig {
  const cfg = { ...raw };
  for (const key of Object.keys(cfg) as (keyof CardValuationConfig)[]) {
    cfg[key] = Math.max(0, cfg[key]);
  }
  cfg.medianSales = Math.min(50, Math.max(1, Math.round(cfg.medianSales)));
  cfg.medianDays = Math.min(365, Math.max(1, Math.round(cfg.medianDays)));
  cfg.levelBonusCap = Math.min(1, cfg.levelBonusCap);
  return cfg;
}

/** The stored config, defaults overlaid with any SystemConfig rows and clamped, read past the cache. */
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
      if (Number.isFinite(parsed)) merged[field] = parsed;
    }
  }
  return clampValuationConfig(merged);
}

/** Read the merged valuation config (defaults overlaid with any SystemConfig rows, clamped). */
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

/** What the value formula needs to know about a card. */
export interface ValueCard {
  rarity: CardRarity;
  cardType: CardType;
  /** The first sale of any copy here; it ends an NS card's bank-value term. */
  firstSoldAt: Date | null;
  /** The NS bank value (NS cards only). */
  nsBankValue: number | null;
  /** A retired card's copies are worth 0; its own value (`referenceValue`) is kept for a restore. */
  isRetired: boolean;
}

export function typeMultiplier(cardType: CardType, cfg: CardValuationConfig): number {
  switch (cardType) {
    case "SPECIAL":
      return cfg.multSpecial;
    case "NATION":
      return cfg.multNation;
    case "TROPHY":
      return cfg.multTrophy;
    default:
      return 1;
  }
}

export function finishMultiplier(finish: CardFinish, cfg: CardValuationConfig): number {
  if (finish === "FOIL") return cfg.finishFoil;
  if (finish === "HOLO") return cfg.finishHolo;
  return 1;
}

/** An NS card's bank value × the premium, until any copy first sells here; 0 for every other card. */
export function nsTerm(card: ValueCard, cfg: CardValuationConfig): number {
  if (card.cardType !== "NS" || card.firstSoldAt !== null) return 0;
  return Math.max(0, card.nsBankValue ?? 0) * cfg.nsPremium;
}

const toCents = (n: number) => Math.round(n * 100) / 100;

/**
 * A card's value at a finish, before a copy's level: the highest of floor × type × finish, that finish's market
 * median and the NS term. It ignores retirement, which only `valueOfCopy` applies.
 */
export function baseValue(
  card: ValueCard,
  finish: CardFinish,
  median: number | null,
  cfg: CardValuationConfig
): number {
  const formula =
    rarityFloor(cfg, card.rarity) *
    typeMultiplier(card.cardType, cfg) *
    finishMultiplier(finish, cfg);
  return toCents(Math.max(formula, median ?? 0, nsTerm(card, cfg)));
}

/** +levelBonusPerLevel per level above 1, at most levelBonusCap. */
export function levelBonus(level: number, cfg: CardValuationConfig): number {
  return Math.min(cfg.levelBonusCap, cfg.levelBonusPerLevel * (clampLevel(level) - 1));
}

export interface CopyValueInput {
  card: ValueCard;
  finish: CardFinish;
  level: number;
  /** The market median for this card at this copy's finish, if it sold recently. */
  median: number | null;
}

/**
 * One copy's value: the base value plus the level bonus, and 0 for a retired card's copy. The dividend, wallet,
 * Passport and achievements use it.
 */
export function valueOfCopy(input: CopyValueInput, cfg: CardValuationConfig): number {
  if (input.card.isRetired) return 0;
  return toCents(
    baseValue(input.card, input.finish, input.median, cfg) * (1 + levelBonus(input.level, cfg))
  );
}

/**
 * `Card.marketValue`: the value of a Standard copy at level 1. A retired card keeps it, so a restore needs no
 * revalue.
 */
export function referenceValue(
  card: ValueCard,
  standardMedian: number | null,
  cfg: CardValuationConfig
): number {
  return baseValue(card, "STANDARD", standardMedian, cfg);
}

/** The median price (the mean of the middle two for an even count); null when there are none. */
export function medianOf(prices: readonly number[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
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
    // All numbers below come from validated numeric config; rarity is from a fixed list. As in referenceValue, an NS
    // card's bank term lasts until a copy of it first sells here, then it takes the floor.
    const value = `CASE
        WHEN "cardType" = 'NS' AND "firstSoldAt" IS NULL
          THEN GREATEST(${floor}, COALESCE(NULLIF(metadata->'nsData'->>'market_value', '')::numeric, 0) * ${cfg.nsPremium})
        WHEN "cardType" = 'SPECIAL' THEN ${floor * cfg.multSpecial}
        WHEN "cardType" = 'NATION'  THEN ${floor * cfg.multNation}
        WHEN "cardType" = 'TROPHY'  THEN ${floor * cfg.multTrophy}
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
