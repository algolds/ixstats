/**
 * Exchange Config
 *
 * SystemConfig-backed, admin-tunable settings for the Exchange (Sovereign, ₷) economy.
 * All keys are prefixed `exchange_` and read through a short in-memory cache. Values
 * read from the database are clamped to EXCHANGE_CONFIG_BOUNDS, so a bad row can never
 * set, say, a conversion rate of a million. The on/off switch is not here: it is the
 * vault flag `vault_isExchangeEnabled` (see vault-perks.ts), next to the other vault
 * feature flags. Spec: docs/specs/2026-10-06-exchange-economy-design.md.
 *
 * Usage:
 *   import { getExchangeConfig } from '~/lib/vault/exchange-config';
 *   const cfg = await getExchangeConfig(db);
 */

export interface ExchangeConfig {
  /** Sovereign cost to charter a new company (burned: a currency sink). */
  charterFee: number;
  /** Cap on simultaneous ACTIVE companies per player. */
  activeCompanyCap: number;
  /** Sovereigns received per 1 IxCredit on CONVERT_IN (before fee); CONVERT_OUT uses 1 / rate. */
  convertRate: number;
  /** Fractional fee applied on every conversion, either direction (0.05 = 5%). */
  convertFee: number;
  /** Max Sovereigns a user may move through the bridge per UTC day, both directions summed. */
  convertDailyLimit: number;
  /** Sovereigns granted to a wallet on first creation. Existing wallets keep their balance. */
  seedSovereigns: number;
  /**
   * Share (0 to 1) of verified contract revenue that becomes convertible back to IxCredits
   * once it has aged `revenueHoldDays` (spec §8, relaxed out allowance). 0 turns it off.
   */
  revenueConvertibleShare: number;
  /** Real days a completed contract's payout waits before it counts toward the out allowance. */
  revenueHoldDays: number;
  /** Fair-value coefficients for the sector-index valuation (companies.ts computeFairValue). */
  valuationSectorWeight: number;
  valuationStandingWeight: number;
  valuationDecisionWeight: number;
}

export const EXCHANGE_CONFIG_DEFAULTS: ExchangeConfig = {
  charterFee: 1000,
  activeCompanyCap: 3,
  convertRate: 1.0,
  convertFee: 0.05,
  convertDailyLimit: 10000,
  // 2026-10-06: was 10,000. 1,000 covers a MyClub team claim, a league charter or a company
  // charter; more comes from converting IxCredits.
  seedSovereigns: 1000,
  revenueConvertibleShare: 0.5,
  revenueHoldDays: 7,
  valuationSectorWeight: 1.0,
  valuationStandingWeight: 0.5,
  valuationDecisionWeight: 1.0,
};

/** Inclusive [min, max] for every field; admin saves and database reads are both held to it. */
export const EXCHANGE_CONFIG_BOUNDS: Record<keyof ExchangeConfig, readonly [number, number]> = {
  charterFee: [0, 1_000_000],
  activeCompanyCap: [1, 20],
  convertRate: [0.1, 100],
  convertFee: [0, 0.5],
  convertDailyLimit: [0, 1_000_000],
  seedSovereigns: [0, 100_000],
  revenueConvertibleShare: [0, 1],
  revenueHoldDays: [1, 90],
  valuationSectorWeight: [0, 10],
  valuationStandingWeight: [0, 10],
  valuationDecisionWeight: [0, 10],
};

/** Maps a config field to its `exchange_*` SystemConfig key. */
export const EXCHANGE_CONFIG_KEYS = {
  charterFee: "exchange_charter_fee",
  activeCompanyCap: "exchange_active_company_cap",
  convertRate: "exchange_convert_rate",
  convertFee: "exchange_convert_fee",
  convertDailyLimit: "exchange_convert_daily_limit",
  seedSovereigns: "exchange_seed_sovereigns",
  revenueConvertibleShare: "exchange_revenue_convertible_share",
  revenueHoldDays: "exchange_revenue_hold_days",
  valuationSectorWeight: "exchange_valuation_sector_weight",
  valuationStandingWeight: "exchange_valuation_standing_weight",
  valuationDecisionWeight: "exchange_valuation_decision_weight",
} as const satisfies Record<keyof ExchangeConfig, string>;

/** Anything with a systemConfig delegate: a PrismaClient or an interactive transaction client. */
interface SystemConfigReader {
  systemConfig: {
    findMany: (args: {
      where: { key: { startsWith: string } };
      select: { key: true; value: true };
    }) => Promise<Array<{ key: string; value: string }>>;
  };
}

let cache: { value: ExchangeConfig; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

export function clampExchangeConfigValue(field: keyof ExchangeConfig, value: number): number {
  const [min, max] = EXCHANGE_CONFIG_BOUNDS[field];
  return Math.min(max, Math.max(min, value));
}

/** Drop the cached config so the next read sees an admin save at once. */
export function invalidateExchangeConfigCache(): void {
  cache = null;
}

/** Read the merged Exchange config (defaults overlaid with any SystemConfig rows, clamped). */
export async function getExchangeConfig(db: SystemConfigReader): Promise<ExchangeConfig> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;

  const rows = await db.systemConfig.findMany({
    where: { key: { startsWith: "exchange_" } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const merged = { ...EXCHANGE_CONFIG_DEFAULTS };
  for (const field of Object.keys(EXCHANGE_CONFIG_KEYS) as (keyof ExchangeConfig)[]) {
    const raw = byKey.get(EXCHANGE_CONFIG_KEYS[field]);
    if (raw != null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) merged[field] = clampExchangeConfigValue(field, parsed);
    }
  }

  cache = { value: merged, expires: now + CACHE_TTL_MS };
  return merged;
}
