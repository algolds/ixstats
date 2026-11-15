/**
 * Exchange Config
 *
 * SystemConfig-backed, admin-tunable settings for the Exchange (Sovereign, ₷) economy.
 * All keys are prefixed `exchange_` and read through a short in-memory cache. Values
 * read from the database are clamped to EXCHANGE_CONFIG_BOUNDS, so a bad row can never
 * set, say, a charter fee of a million. The on/off switch is not here: it is the
 * vault flag `vault_isExchangeEnabled` (see vault-perks.ts), next to the other vault
 * feature flags. Spec: docs/specs/2026-10-06-exchange-economy-design.md.
 *
 * Usage:
 *   import { getExchangeConfig } from '~/lib/vault/exchange-config';
 *   const cfg = await getExchangeConfig(db);
 */

import { fromCents, toCents } from "~/lib/exchange/amounts";

export interface ExchangeConfig {
  /** Sovereign cost to charter a new company (burned: a currency sink). */
  charterFee: number;
  /** Cap on simultaneous ACTIVE companies per player. */
  activeCompanyCap: number;
  /** Sovereigns granted to a wallet on first creation. Existing wallets keep their balance. */
  seedSovereigns: number;
  /** Fair-value coefficients for the sector-index valuation (companies.ts computeFairValue). */
  valuationSectorWeight: number;
  valuationStandingWeight: number;
  valuationDecisionWeight: number;
  /** Base ₷ a nation treasury receives per day, scaled by economic tier (treasury.ts stipendFor). */
  treasuryDailyStipend: number;
  /** Most ₷ a nation treasury may hold. A stipend that would exceed it is cut to the room left. */
  treasuryCap: number;
  /** Most ₷ a realm may mint through faucet tenders in a rolling seven days. */
  realmWeeklyFaucetCap: number;
  /** Most ₷ per market tick a realm may mint from operating revenue, shared pro rata by its companies. */
  realmOperatingBudget: number;
}

export interface ExchangeConfigWithCents extends ExchangeConfig {
  charterFeeCents: number;
  seedSovereignsCents: number;
  treasuryDailyStipendCents: number;
  treasuryCapCents: number;
  realmWeeklyFaucetCapCents: number;
  realmOperatingBudgetCents: number;
}

export const EXCHANGE_CONFIG_DEFAULTS: ExchangeConfig = {
  charterFee: 1000,
  activeCompanyCap: 3,
  // 2026-10-06: was 10,000. 1,000 covers a MyClub team claim, a league charter or a company
  // charter.
  seedSovereigns: 1000,
  valuationSectorWeight: 1.0,
  valuationStandingWeight: 0.5,
  valuationDecisionWeight: 1.0,
  treasuryDailyStipend: 250,
  treasuryCap: 25_000,
  realmWeeklyFaucetCap: 10_000,
  realmOperatingBudget: 500,
};

/** Inclusive [min, max] for every field; admin saves and database reads are both held to it. */
export const EXCHANGE_CONFIG_BOUNDS: Record<keyof ExchangeConfig, readonly [number, number]> = {
  charterFee: [0, 1_000_000],
  activeCompanyCap: [1, 20],
  seedSovereigns: [0, 100_000],
  valuationSectorWeight: [0, 10],
  valuationStandingWeight: [0, 10],
  valuationDecisionWeight: [0, 10],
  treasuryDailyStipend: [0, 50_000],
  treasuryCap: [1_000, 1_000_000],
  realmWeeklyFaucetCap: [0, 10_000_000],
  realmOperatingBudget: [0, 1_000_000],
};

/** Maps a config field to its `exchange_*` SystemConfig key. */
export const EXCHANGE_CONFIG_KEYS = {
  charterFee: "exchange_charter_fee",
  activeCompanyCap: "exchange_active_company_cap",
  seedSovereigns: "exchange_seed_sovereigns",
  valuationSectorWeight: "exchange_valuation_sector_weight",
  valuationStandingWeight: "exchange_valuation_standing_weight",
  valuationDecisionWeight: "exchange_valuation_decision_weight",
  treasuryDailyStipend: "exchange_treasury_daily_stipend",
  treasuryCap: "exchange_treasury_cap",
  realmWeeklyFaucetCap: "exchange_realm_weekly_faucet_cap",
  realmOperatingBudget: "exchange_realm_operating_budget",
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

const MONEY_CONFIG_FIELDS = new Set<keyof ExchangeConfig>([
  "charterFee",
  "seedSovereigns",
  "treasuryDailyStipend",
  "treasuryCap",
  "realmWeeklyFaucetCap",
  "realmOperatingBudget",
]);

let cache: { value: ExchangeConfigWithCents; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

export function clampExchangeConfigValue(field: keyof ExchangeConfig, value: number): number {
  const [min, max] = EXCHANGE_CONFIG_BOUNDS[field];
  const clamped = Math.min(max, Math.max(min, value));
  return MONEY_CONFIG_FIELDS.has(field) ? fromCents(toCents(clamped)) : clamped;
}

/** Convert all ₷ fields of an ExchangeConfig into integer cents once on read. */
export function toExchangeConfigCents(cfg: ExchangeConfig): ExchangeConfigWithCents {
  return {
    ...cfg,
    charterFeeCents: toCents(cfg.charterFee),
    seedSovereignsCents: toCents(cfg.seedSovereigns),
    treasuryDailyStipendCents: toCents(cfg.treasuryDailyStipend),
    treasuryCapCents: toCents(cfg.treasuryCap),
    realmWeeklyFaucetCapCents: toCents(cfg.realmWeeklyFaucetCap),
    realmOperatingBudgetCents: toCents(cfg.realmOperatingBudget),
  };
}

/** Drop the cached config so the next read sees an admin save at once. */
export function invalidateExchangeConfigCache(): void {
  cache = null;
}

/** Read the merged Exchange config (defaults overlaid with any SystemConfig rows, clamped). */
export async function getExchangeConfig(db: SystemConfigReader): Promise<ExchangeConfigWithCents> {
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

  const withCents = toExchangeConfigCents(merged);
  cache = { value: withCents, expires: now + CACHE_TTL_MS };
  return withCents;
}
