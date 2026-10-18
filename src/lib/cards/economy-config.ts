/**
 * The card economy's tunable numbers: the finish roll, the daily card's odds, dust, fusion, crafting, listing fees,
 * the sale-fee threshold, the nation royalty and card XP. SystemConfig rows under `card_economy_*`, edited in the
 * admin Economy tab and read through a 60-second cache. Card value numbers live in `valuation.ts`.
 */
import type { CardRarity, PrismaClient } from "@prisma/client";

export interface CardEconomyConfig {
  /** Finish odds at mint, in percent; the rest is Standard. */
  finishFoilPct: number;
  finishHoloPct: number;
  /** The daily card's rarity odds in percent, like a pack's (whatever is left over is Common). */
  dailyCommonPct: number;
  dailyUncommonPct: number;
  dailyRarePct: number;
  dailyUltraRarePct: number;
  dailyEpicPct: number;
  dailyLegendaryPct: number;
  /** Dust from a Standard copy, by rarity. */
  dustCommon: number;
  dustUncommon: number;
  dustRare: number;
  dustUltraRare: number;
  dustEpic: number;
  dustLegendary: number;
  /** Whole multiples of the Standard yield for Foil and Holo copies. */
  dustFoilMult: number;
  dustHoloMult: number;
  /** Share of the Standard yield an imported NS copy breaks down for. */
  dustImportMult: number;
  /** Copies of one card at one finish that fuse into one copy at the next finish. */
  fusionCopies: number;
  /** A craft costs this many times the card's Standard dust yield, plus its rarity floor in IxC. */
  craftDustMult: number;
  listingFee: number;
  listingFeeFeatured: number;
  /** Share of the listing fee refunded on cancel or expiry, in percent. */
  listingRefundPct: number;
  listingDays: number;
  /** Sales and trade credit legs at or under this pay no market fee. */
  saleFeeThreshold: number;
  /** The nation card royalty in percent of the amount, paid out of the market fee. */
  royaltyPct: number;
  xpPack: number;
  xpDaily: number;
  xpTradePerCard: number;
  xpAuctionWin: number;
  /** XP a copy gains for each day it is held (the daily tick). */
  xpHoldingTick: number;
  /** XP a copy may gain in one UTC day, from every source together. */
  xpDailyCapPerCopy: number;
}

export const CARD_ECONOMY_DEFAULTS: CardEconomyConfig = {
  finishFoilPct: 8,
  finishHoloPct: 2,
  dailyCommonPct: 65,
  dailyUncommonPct: 25,
  dailyRarePct: 7,
  dailyUltraRarePct: 2,
  dailyEpicPct: 0.9,
  dailyLegendaryPct: 0.1,
  dustCommon: 5,
  dustUncommon: 15,
  dustRare: 50,
  dustUltraRare: 150,
  dustEpic: 500,
  dustLegendary: 1500,
  dustFoilMult: 3,
  dustHoloMult: 9,
  dustImportMult: 0.25,
  fusionCopies: 3,
  craftDustMult: 8,
  listingFee: 5,
  listingFeeFeatured: 10,
  listingRefundPct: 50,
  listingDays: 14,
  saleFeeThreshold: 100,
  royaltyPct: 2,
  xpPack: 10,
  xpDaily: 10,
  xpTradePerCard: 25,
  xpAuctionWin: 50,
  xpHoldingTick: 5,
  xpDailyCapPerCopy: 100,
};

export const ECONOMY_CONFIG_KEYS = {
  finishFoilPct: "card_economy_finish_foil_pct",
  finishHoloPct: "card_economy_finish_holo_pct",
  dailyCommonPct: "card_economy_daily_common_pct",
  dailyUncommonPct: "card_economy_daily_uncommon_pct",
  dailyRarePct: "card_economy_daily_rare_pct",
  dailyUltraRarePct: "card_economy_daily_ultra_rare_pct",
  dailyEpicPct: "card_economy_daily_epic_pct",
  dailyLegendaryPct: "card_economy_daily_legendary_pct",
  dustCommon: "card_economy_dust_common",
  dustUncommon: "card_economy_dust_uncommon",
  dustRare: "card_economy_dust_rare",
  dustUltraRare: "card_economy_dust_ultra_rare",
  dustEpic: "card_economy_dust_epic",
  dustLegendary: "card_economy_dust_legendary",
  dustFoilMult: "card_economy_dust_foil_mult",
  dustHoloMult: "card_economy_dust_holo_mult",
  dustImportMult: "card_economy_dust_import_mult",
  fusionCopies: "card_economy_fusion_copies",
  craftDustMult: "card_economy_craft_dust_mult",
  listingFee: "card_economy_listing_fee",
  listingFeeFeatured: "card_economy_listing_fee_featured",
  listingRefundPct: "card_economy_listing_refund_pct",
  listingDays: "card_economy_listing_days",
  saleFeeThreshold: "card_economy_sale_fee_threshold",
  royaltyPct: "card_economy_royalty_pct",
  xpPack: "card_economy_xp_pack",
  xpDaily: "card_economy_xp_daily",
  xpTradePerCard: "card_economy_xp_trade_per_card",
  xpAuctionWin: "card_economy_xp_auction_win",
  xpHoldingTick: "card_economy_xp_holding_tick",
  xpDailyCapPerCopy: "card_economy_xp_daily_cap_per_copy",
} as const satisfies Record<keyof CardEconomyConfig, string>;

const FIELDS = Object.keys(ECONOMY_CONFIG_KEYS) as (keyof CardEconomyConfig)[];

/** Stored as whole numbers. */
const WHOLE: readonly (keyof CardEconomyConfig)[] = [
  "dustCommon",
  "dustUncommon",
  "dustRare",
  "dustUltraRare",
  "dustEpic",
  "dustLegendary",
  "dustFoilMult",
  "dustHoloMult",
  "fusionCopies",
  "listingFee",
  "listingFeeFeatured",
  "listingDays",
  "xpPack",
  "xpDaily",
  "xpTradePerCard",
  "xpAuctionWin",
  "xpHoldingTick",
  "xpDailyCapPerCopy",
];

/** The daily odds that keep their share first, rarest first; Common takes what they leave. */
const DAILY_RAREST_FIRST = [
  "dailyLegendaryPct",
  "dailyEpicPct",
  "dailyUltraRarePct",
  "dailyRarePct",
  "dailyUncommonPct",
] as const satisfies readonly (keyof CardEconomyConfig)[];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A percentage to the hundredth, so the leftover share reads as entered (63.9, not 63.900000000000006). */
const toHundredths = (pct: number) => Math.round(pct * 100) / 100;

/** Each daily odd within what the rarer ones leave of 100%; Common gets the rest (a hand-edited row may not add up). */
function closeDailyOdds(cfg: CardEconomyConfig): void {
  let taken = 0;
  for (const key of DAILY_RAREST_FIRST) {
    cfg[key] = Math.min(cfg[key], 100 - taken);
    taken += cfg[key];
  }
  cfg.dailyCommonPct = toHundredths(100 - taken);
}

/**
 * Keeps stored numbers in range and the dust loop closed: a fused copy never breaks down for more than the copies it
 * took (Foil at most `fusionCopies` × Standard, Holo at most `fusionCopies` × Foil, both whole multiples so rounding
 * cannot add dust), and a craft always costs at least what its Standard copy breaks down for. A number that is not
 * finite falls back to its default.
 */
export function clampEconomyConfig(raw: CardEconomyConfig): CardEconomyConfig {
  const cfg = { ...raw };
  for (const key of FIELDS) {
    cfg[key] = Number.isFinite(cfg[key]) ? Math.max(0, cfg[key]) : CARD_ECONOMY_DEFAULTS[key];
  }
  for (const key of WHOLE) cfg[key] = Math.round(cfg[key]);
  cfg.finishHoloPct = Math.min(cfg.finishHoloPct, 100);
  cfg.finishFoilPct = Math.min(cfg.finishFoilPct, 100 - cfg.finishHoloPct);
  closeDailyOdds(cfg);
  cfg.fusionCopies = clamp(cfg.fusionCopies, 2, 10);
  cfg.dustFoilMult = clamp(cfg.dustFoilMult, 1, cfg.fusionCopies);
  cfg.dustHoloMult = clamp(cfg.dustHoloMult, cfg.dustFoilMult, cfg.fusionCopies * cfg.dustFoilMult);
  cfg.dustImportMult = Math.min(cfg.dustImportMult, 1);
  cfg.craftDustMult = Math.max(1, cfg.craftDustMult);
  cfg.listingRefundPct = Math.min(cfg.listingRefundPct, 100);
  cfg.listingDays = clamp(cfg.listingDays, 1, 60);
  cfg.royaltyPct = Math.min(cfg.royaltyPct, 50);
  return cfg;
}

type ConfigDb = Pick<PrismaClient, "systemConfig">;

let cache: { value: CardEconomyConfig; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** A stored value as a number; NaN for a blank or unreadable one, which keeps the default. */
function storedNumber(raw: string | undefined): number {
  return raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
}

/** The merged economy config: defaults overlaid with any SystemConfig rows, then clamped. */
export async function getEconomyConfig(db: ConfigDb): Promise<CardEconomyConfig> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;

  const rows = await db.systemConfig.findMany({
    where: { key: { startsWith: "card_economy_" } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const merged = { ...CARD_ECONOMY_DEFAULTS };
  for (const field of FIELDS) {
    const parsed = storedNumber(byKey.get(ECONOMY_CONFIG_KEYS[field]));
    if (Number.isFinite(parsed)) merged[field] = parsed;
  }
  const value = clampEconomyConfig(merged);
  cache = { value, expires: now + CACHE_TTL_MS };
  return value;
}

/** Forget the cached config; a caller that writes it in a transaction calls this once the transaction commits. */
export function clearEconomyConfigCache(): void {
  cache = null;
}

/**
 * Stores one number (admin Economy tab). The app client's write is visible at once, so it clears the cache here; a
 * transaction's caller clears it after the commit, as a read before then would cache the old value again.
 */
export async function setEconomyConfig(
  db: ConfigDb,
  field: keyof CardEconomyConfig,
  value: number
): Promise<void> {
  const key = ECONOMY_CONFIG_KEYS[field];
  await db.systemConfig.upsert({
    where: { key },
    create: { key, value: String(value), description: `Card economy: ${field}` },
    update: { value: String(value) },
  });
  if ("$transaction" in db) clearEconomyConfigCache();
}

/** The daily card's odds by rarity. */
export function dailyRarityOdds(cfg: CardEconomyConfig): Record<CardRarity, number> {
  return {
    COMMON: cfg.dailyCommonPct,
    UNCOMMON: cfg.dailyUncommonPct,
    RARE: cfg.dailyRarePct,
    ULTRA_RARE: cfg.dailyUltraRarePct,
    EPIC: cfg.dailyEpicPct,
    LEGENDARY: cfg.dailyLegendaryPct,
  };
}
