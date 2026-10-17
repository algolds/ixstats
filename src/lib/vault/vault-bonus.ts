/**
 * Vault Bonus — credits granted for metagame / non-core-gameplay actions.
 *
 * One idempotent, admin-tunable entry point (grantBonus) for every "reward" path:
 * new-player onboarding, wiki country import, NS deck import, achievement unlocks,
 * Loreward wins and runner-up places, etc. Config is SystemConfig-backed (`vault_bonus_*`), same pattern as
 * exchange-config / card-valuation.
 *
 * All bonuses post as VaultTransactionType.EARN_BONUS — deliberately outside the
 * EARN_ACTIVE/EARN_SOCIAL daily caps, so big achievement rewards aren't silently truncated.
 * The global isEarningEnabled kill switch does stop them: the grant reports not granted
 * and records nothing, so its idempotency key stays free.
 */

import { type Prisma, type PrismaClient } from "@prisma/client";
import { earnCreditsOnce, earnCreditsOnceTx, vaultService } from "./vault-service";
import type { LedgerEarnInput } from "./vault-ledger";

export interface VaultBonusConfig {
  /** Master toggle (1 = on, 0 = off). */
  enabled: number;
  newPlayer: number;
  /** NS deck import: credits per card, capped at nsCap. */
  nsPerCard: number;
  nsCap: number;
  achievementCommon: number;
  achievementUncommon: number;
  achievementRare: number;
  achievementEpic: number;
  achievementLegendary: number;
}

export const VAULT_BONUS_DEFAULTS: VaultBonusConfig = {
  enabled: 1,
  newPlayer: 5000,
  nsPerCard: 50,
  nsCap: 5000,
  achievementCommon: 100,
  achievementUncommon: 250,
  achievementRare: 500,
  achievementEpic: 1000,
  achievementLegendary: 2500,
};

const KEY = {
  enabled: "vault_bonus_enabled",
  newPlayer: "vault_bonus_new_player",
  nsPerCard: "vault_bonus_ns_per_card",
  nsCap: "vault_bonus_ns_cap",
  achievementCommon: "vault_bonus_achievement_common",
  achievementUncommon: "vault_bonus_achievement_uncommon",
  achievementRare: "vault_bonus_achievement_rare",
  achievementEpic: "vault_bonus_achievement_epic",
  achievementLegendary: "vault_bonus_achievement_legendary",
} as const satisfies Record<keyof VaultBonusConfig, string>;

let cache: { value: VaultBonusConfig; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getBonusConfig(
  db: Pick<PrismaClient, "systemConfig">
): Promise<VaultBonusConfig> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;

  const rows = await db.systemConfig.findMany({
    where: { key: { startsWith: "vault_bonus_" } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const merged = { ...VAULT_BONUS_DEFAULTS };
  for (const field of Object.keys(KEY) as (keyof VaultBonusConfig)[]) {
    const raw = byKey.get(KEY[field]);
    if (raw != null) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) merged[field] = parsed;
    }
  }

  cache = { value: merged, expires: now + CACHE_TTL_MS };
  return merged;
}

export async function setBonusConfig(
  db: Pick<PrismaClient, "systemConfig">,
  field: keyof VaultBonusConfig,
  value: number
): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: KEY[field] },
    create: { key: KEY[field], value: String(value), description: `Vault bonus: ${field}` },
    update: { value: String(value) },
  });
  cache = null;
}

export type LorewardType = "daily" | "weekly" | "monthly";
export type LorewardPlace = "winner" | "runner-up";

/** Credits per contest and place. SystemConfig `vault_bonus_loreward_<type>_<place>` overrides a cell. */
export const LOREWARD_PAYOUTS: Record<LorewardType, Record<LorewardPlace, number>> = {
  daily: { winner: 500, "runner-up": 150 },
  weekly: { winner: 1500, "runner-up": 400 },
  monthly: { winner: 4000, "runner-up": 1000 },
};

/** First day paid by the table: a daily entry's `date`, a weekly or monthly entry's `dateEnd`, from here on. */
export const LOREWARD_PAYOUT_START = "2026-10-15";

/** The grant source and idempotency key of one place in one entry; the winner keeps its original key. */
export function lorewardBonusKey(entryId: string, place: LorewardPlace): string {
  return place === "winner" ? `bonus:loreward:${entryId}` : `bonus:loreward:${entryId}:runner-up`;
}

function lorewardPayoutConfigKey(type: LorewardType, place: LorewardPlace): string {
  return `vault_bonus_loreward_${type}_${place.replace("-", "_")}`;
}

/** The payout table with SystemConfig overrides applied (non-numeric or negative values are ignored). */
export async function getLorewardPayouts(
  db: Pick<PrismaClient, "systemConfig">
): Promise<typeof LOREWARD_PAYOUTS> {
  const rows = await db.systemConfig.findMany({
    where: { key: { startsWith: "vault_bonus_loreward_" } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const payouts = structuredClone(LOREWARD_PAYOUTS);
  for (const type of Object.keys(payouts) as LorewardType[]) {
    for (const place of Object.keys(payouts[type]) as LorewardPlace[]) {
      const parsed = Number(byKey.get(lorewardPayoutConfigKey(type, place)));
      if (byKey.has(lorewardPayoutConfigKey(type, place)) && parsed >= 0) {
        payouts[type][place] = parsed;
      }
    }
  }
  return payouts;
}

/** Credits for unlocking an achievement of the given rarity (case-insensitive). */
export function achievementBonus(cfg: VaultBonusConfig, rarity: string): number {
  switch (rarity.toUpperCase()) {
    case "LEGENDARY":
      return cfg.achievementLegendary;
    case "EPIC":
      return cfg.achievementEpic;
    case "RARE":
      return cfg.achievementRare;
    case "UNCOMMON":
      return cfg.achievementUncommon;
    default:
      return cfg.achievementCommon;
  }
}

/** Credits for importing an NS deck of `cardCount` cards (per-card, capped). */
export function nsImportBonus(cfg: VaultBonusConfig, cardCount: number): number {
  return Math.min(Math.max(0, cardCount) * cfg.nsPerCard, cfg.nsCap);
}

/**
 * Grant a bonus. `source` is the provenance string (e.g. "bonus:new_player",
 * "bonus:loreward:<id>"). When `oneTime` is set, a prior EARN_BONUS transaction with
 * the same source for this user short-circuits — the call becomes a no-op, so triggers
 * can fire freely without double-paying. The grant itself is idempotent on
 * `<source>:<userId>`, so concurrent calls can't both pay.
 *
 * `onceKey` instead makes the grant one-time per key across all users (e.g. once per
 * NationStates nation, whichever account imports it), so one user can still earn it
 * for several different keys.
 */
export async function grantBonus(
  db: PrismaClient,
  userIdOrClerkId: string,
  source: string,
  amount: number,
  opts: { oneTime?: boolean; onceKey?: string; metadata?: Record<string, any> } = {}
): Promise<{ granted: boolean; amount: number; newBalance?: number; reason?: string }> {
  const cfg = await getBonusConfig(db);
  if (!cfg.enabled) return { granted: false, amount: 0, reason: "bonuses_disabled" };
  if (amount <= 0) return { granted: false, amount: 0, reason: "zero_amount" };

  const user = await db.user.findFirst({
    where: { OR: [{ id: userIdOrClerkId }, { clerkUserId: userIdOrClerkId }] },
    select: { id: true },
  });
  if (!user) return { granted: false, amount: 0, reason: "user_not_found" };

  if (opts.oneTime || opts.onceKey) {
    if (opts.oneTime) {
      // Grants made before idempotency keys existed carry only the source
      const existing = await db.vaultTransaction.findFirst({
        where: { source, type: "EARN_BONUS", vault: { userId: user.id } },
        select: { id: true },
      });
      if (existing) return { granted: false, amount: 0, reason: "already_granted" };
    }

    const once = await earnCreditsOnce(db, {
      userId: user.id,
      amount,
      type: "EARN_BONUS",
      source,
      metadata: opts.metadata,
      idempotencyKey: opts.onceKey ?? `${source}:${user.id}`,
    });
    if (once.alreadyApplied) return { granted: false, amount: 0, reason: "already_granted" };
    return {
      granted: once.success,
      amount: once.success ? amount : 0,
      newBalance: once.newBalance,
      reason: once.message,
    };
  }

  const res = await vaultService.earnCredits(
    user.id,
    amount,
    "EARN_BONUS",
    source,
    db,
    opts.metadata
  );
  return {
    granted: res.success,
    amount: res.success ? amount : 0,
    newBalance: res.newBalance,
    reason: res.message,
  };
}

/**
 * A one-time bonus (`grantBonus` with `oneTime`) inside the caller's transaction, for a caller that holds a lock
 * across its own check and the grant: `grantBonus` runs its own transaction. The caller checks that bonuses are on
 * and that `amount` is positive. Returns whether it paid.
 */
export async function grantBonusTx(
  tx: Prisma.TransactionClient,
  userIdOrClerkId: string,
  source: string,
  amount: number,
  metadata?: LedgerEarnInput["metadata"]
): Promise<boolean> {
  const user = await tx.user.findFirst({
    where: { OR: [{ id: userIdOrClerkId }, { clerkUserId: userIdOrClerkId }] },
    select: { id: true },
  });
  if (!user) return false;
  // Grants made before idempotency keys existed carry only the source
  const existing = await tx.vaultTransaction.findFirst({
    where: { source, type: "EARN_BONUS", vault: { userId: user.id } },
    select: { id: true },
  });
  if (existing) return false;
  const once = await earnCreditsOnceTx(tx, {
    userId: user.id,
    amount,
    type: "EARN_BONUS",
    source,
    metadata,
    idempotencyKey: `${source}:${user.id}`,
  });
  return !once.alreadyApplied;
}

/**
 * Ledger source of the one-time new-player bonus. It fires on account creation and on the
 * first Vault open only (no country action pays it); both paths share the idempotency key
 * `bonus:new_player:<User.id>`, so whichever runs first pays and the other is a no-op.
 */
export const NEW_PLAYER_BONUS_SOURCE = "bonus:new_player";

/**
 * Also pay the bonus the first time an existing account opens its Vault, so accounts
 * created before the bonus moved to sign-up (and never took a country) are not left out.
 * Set to false to pay it only at account creation.
 */
export const NEW_PLAYER_BONUS_ON_VAULT_OPEN = true;

/** Users this process has already confirmed as paid (or tried), to skip repeat ledger reads. */
const newPlayerBonusChecked = new Set<string>();

/**
 * Pay the one-time new-player bonus to an IxnayID (internal or Clerk id). It does not need
 * a country. Safe to call any number of times: `oneTime` checks the ledger for an existing
 * `bonus:new_player` row and the grant itself is idempotent on `bonus:new_player:<User.id>`.
 * Never throws.
 */
export async function grantNewPlayerBonus(
  db: PrismaClient,
  userIdOrClerkId: string,
  trigger: "account_created" | "vault_opened"
): Promise<{ granted: boolean; amount: number; reason?: string }> {
  if (newPlayerBonusChecked.has(userIdOrClerkId)) {
    return { granted: false, amount: 0, reason: "already_checked" };
  }
  try {
    const cfg = await getBonusConfig(db);
    const res = await grantBonus(db, userIdOrClerkId, NEW_PLAYER_BONUS_SOURCE, cfg.newPlayer, {
      oneTime: true,
      metadata: { trigger },
    });
    // Remember only settled outcomes; a failed grant (e.g. maintenance) is retried next time
    if (res.granted || res.reason === "already_granted") newPlayerBonusChecked.add(userIdOrClerkId);
    return { granted: res.granted, amount: res.amount, reason: res.reason };
  } catch (error) {
    console.error(`[Vault Bonus] New-player bonus failed for ${userIdOrClerkId}:`, error);
    return { granted: false, amount: 0, reason: "error" };
  }
}

/** Test hook: forget which users this process has checked. */
export function resetNewPlayerBonusMemo(): void {
  newPlayerBonusChecked.clear();
}
