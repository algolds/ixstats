/**
 * Card General System Settings
 *
 * SystemConfig-backed card settings the game reads: the marketplace rake (`marketplaceFee`) and the base card
 * capacity (`baseCardCapacity`). The five keys nothing read are gone, and so is junk's batch limit.
 */

import { type PrismaClient } from "@prisma/client";

export interface CardGeneralSettings {
  /** Marketplace transaction / auction rake percentage (0-50%). */
  auctionHouseRakePct: number;
  /** Copies a player can hold before any Vault capacity upgrades. */
  maxInventoryCards: number;
}

const CARD_GENERAL_DEFAULTS: CardGeneralSettings = {
  auctionHouseRakePct: 10,
  maxInventoryCards: 150,
};

const KEY = {
  auctionHouseRakePct: "card_system_auction_rake_pct",
  maxInventoryCards: "card_system_max_inventory_cards",
} as const satisfies Record<keyof CardGeneralSettings, string>;

let cache: { value: CardGeneralSettings; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getGeneralCardSettings(
  db: Pick<PrismaClient, "systemConfig">
): Promise<CardGeneralSettings> {
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

/**
 * Marketplace fee on card sales over 100 IxC, at the admin "house rake" rate
 * (10% unless configured, clamped to 0-50%).
 */
export async function marketplaceFee(
  db: Pick<PrismaClient, "systemConfig">,
  price: number
): Promise<number> {
  if (price <= 100) return 0;
  const { auctionHouseRakePct } = await getGeneralCardSettings(db);
  const rate = Math.min(Math.max(auctionHouseRakePct, 0), 50) / 100;
  return Math.floor(price * rate);
}

/** Cards a player may hold before any Vault capacity upgrades. */
export async function baseCardCapacity(db: Pick<PrismaClient, "systemConfig">): Promise<number> {
  return (await getGeneralCardSettings(db)).maxInventoryCards;
}
