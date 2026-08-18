/**
 * Card General System Settings
 *
 * SystemConfig-backed global settings for card trading, marketplace tax,
 * pack claims, inventory limits, and minting permissions.
 */

import { type PrismaClient } from "@prisma/client";

export interface CardGeneralSettings {
  /** Master card trading & auction house toggle (1 = enabled, 0 = disabled). */
  tradingEnabled: number;
  /** Marketplace transaction / auction rake percentage (0-50%). */
  auctionHouseRakePct: number;
  /** Number of free daily packs grantable to players. */
  dailyFreePacks: number;
  /** Cooldown in hours between daily free pack claims. */
  dailyPackCooldownHours: number;
  /** Allow players to submit/mint custom lore cards (1 = on, 0 = admin-only). */
  allowPlayerMinting: number;
  /** Maximum number of cards a player can hold in their collection/binder. */
  maxInventoryCards: number;
  /** Maximum cards allowed in a single junk/recycle batch. */
  maxJunkBatchSize: number;
  /** Automatically fetch and attach wiki artwork during lore imports (1 = on, 0 = off). */
  autoGenerateLoreThumbnails: number;
}

export const CARD_GENERAL_DEFAULTS: CardGeneralSettings = {
  tradingEnabled: 1,
  auctionHouseRakePct: 5,
  dailyFreePacks: 1,
  dailyPackCooldownHours: 24,
  allowPlayerMinting: 0,
  maxInventoryCards: 2500,
  maxJunkBatchSize: 100,
  autoGenerateLoreThumbnails: 1,
};

const KEY = {
  tradingEnabled: "card_system_trading_enabled",
  auctionHouseRakePct: "card_system_auction_rake_pct",
  dailyFreePacks: "card_system_daily_free_packs",
  dailyPackCooldownHours: "card_system_daily_pack_cooldown_hours",
  allowPlayerMinting: "card_system_allow_player_minting",
  maxInventoryCards: "card_system_max_inventory_cards",
  maxJunkBatchSize: "card_system_max_junk_batch_size",
  autoGenerateLoreThumbnails: "card_system_auto_lore_thumbnails",
} as const satisfies Record<keyof CardGeneralSettings, string>;

let cache: { value: CardGeneralSettings; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getGeneralCardSettings(db: PrismaClient): Promise<CardGeneralSettings> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;

  const rows = await db.systemConfig.findMany({
    where: { key: { startsWith: "card_system_" } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const merged = { ...CARD_GENERAL_DEFAULTS };
  for (const field of Object.keys(KEY) as (keyof CardGeneralSettings)[]) {
    const raw = byKey.get(KEY[field]);
    if (raw != null) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) merged[field] = parsed;
    }
  }

  cache = { value: merged, expires: now + CACHE_TTL_MS };
  return merged;
}

export async function setGeneralCardSetting(
  db: PrismaClient,
  field: keyof CardGeneralSettings,
  value: number
): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: KEY[field] },
    create: { key: KEY[field], value: String(value), description: `Card system setting: ${field}` },
    update: { value: String(value) },
  });
  cache = null;
}
