/**
 * Exchange Config
 *
 * SystemConfig-backed, DM-tunable settings for the Exchange (market & corporate)
 * system. All keys are prefixed `exchange_` and read through a short in-memory
 * cache. Defaults are sensible launch values; the DM admin surface (M4) edits them.
 *
 * Usage:
 *   import { getExchangeConfig, setExchangeConfig } from '~/lib/exchange-config';
 *   const cfg = await getExchangeConfig(db);
 */

import { type PrismaClient } from "@prisma/client";

export interface ExchangeConfig {
  /** Sovereign cost to charter a new company (currency sink). */
  charterFee: number;
  /** Soft cap on simultaneous ACTIVE companies per player. */
  activeCompanyCap: number;
  /** Sovereigns received per 1 IxCredit on CONVERT_IN (before fee). */
  convertRate: number;
  /** Fractional fee applied on every Convert (0.05 = 5%). */
  convertFee: number;
  /** Max Sovereign-equivalent a user may Convert per UTC day. */
  convertDailyLimit: number;
  /** Sovereigns granted to a wallet on first creation (bootstrap; 0 at launch). */
  seedSovereigns: number;
  /** Fair-value coefficients (see src/lib/exchange/valuation.ts). */
  valuationSectorWeight: number;
  valuationStandingWeight: number;
  valuationDecisionWeight: number;
}

export const EXCHANGE_CONFIG_DEFAULTS: ExchangeConfig = {
  charterFee: 5000,
  activeCompanyCap: 3,
  convertRate: 1.0,
  convertFee: 0.05,
  convertDailyLimit: 100000,
  seedSovereigns: 10000,
  valuationSectorWeight: 1.0,
  valuationStandingWeight: 0.5,
  valuationDecisionWeight: 1.0,
};

/** Maps a config field to its `exchange_*` SystemConfig key. */
const KEY = {
  charterFee: "exchange_charter_fee",
  activeCompanyCap: "exchange_active_company_cap",
  convertRate: "exchange_convert_rate",
  convertFee: "exchange_convert_fee",
  convertDailyLimit: "exchange_convert_daily_limit",
  seedSovereigns: "exchange_seed_sovereigns",
  valuationSectorWeight: "exchange_valuation_sector_weight",
  valuationStandingWeight: "exchange_valuation_standing_weight",
  valuationDecisionWeight: "exchange_valuation_decision_weight",
} as const satisfies Record<keyof ExchangeConfig, string>;

/** Non-config bookkeeping keys (cron last-run tracking — stored as IxTime ms). */
export const EXCHANGE_STATE_KEYS = {
  lastSectorTickIxTime: "exchange_last_sector_tick_ixtime",
  lastFairValueTickIxTime: "exchange_last_fairvalue_tick_ixtime",
} as const;

let cache: { value: ExchangeConfig; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** Read the merged Exchange config (defaults overlaid with any SystemConfig rows). */
export async function getExchangeConfig(db: PrismaClient): Promise<ExchangeConfig> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;

  const rows = await db.systemConfig.findMany({
    where: { key: { startsWith: "exchange_" } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const merged = { ...EXCHANGE_CONFIG_DEFAULTS };
  for (const field of Object.keys(KEY) as (keyof ExchangeConfig)[]) {
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
export async function setExchangeConfig(
  db: PrismaClient,
  field: keyof ExchangeConfig,
  value: number,
  description?: string
): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: KEY[field] },
    create: {
      key: KEY[field],
      value: String(value),
      description: description ?? `Exchange: ${field}`,
    },
    update: { value: String(value) },
  });
  cache = null;
}

/** Read a cron last-run IxTime (ms). Returns null if never run. */
export async function getExchangeState(
  db: PrismaClient,
  key: (typeof EXCHANGE_STATE_KEYS)[keyof typeof EXCHANGE_STATE_KEYS]
): Promise<number | null> {
  const row = await db.systemConfig.findUnique({ where: { key } });
  if (!row) return null;
  const n = Number(row.value);
  return Number.isNaN(n) ? null : n;
}

/** Persist a cron last-run IxTime (ms). */
export async function setExchangeState(
  db: PrismaClient,
  key: (typeof EXCHANGE_STATE_KEYS)[keyof typeof EXCHANGE_STATE_KEYS],
  ixTime: number
): Promise<void> {
  await db.systemConfig.upsert({
    where: { key },
    create: { key, value: String(ixTime), description: "Exchange cron last-run IxTime (ms)" },
    update: { value: String(ixTime) },
  });
}
