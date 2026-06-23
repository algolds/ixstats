/**
 * Vault Bonus — credits granted for metagame / non-core-gameplay actions.
 *
 * One idempotent, admin-tunable entry point (grantBonus) for every "reward" path:
 * new-player onboarding, wiki country import, NS deck import, achievement unlocks,
 * Loreward wins, etc. Config is SystemConfig-backed (`vault_bonus_*`), same pattern as
 * exchange-config / card-valuation.
 *
 * All bonuses post as VaultTransactionType.EARN_BONUS — deliberately outside the
 * EARN_ACTIVE/EARN_SOCIAL daily caps and the global isEarningEnabled gate, so an
 * onboarding bonus always lands and big achievement rewards aren't silently truncated.
 */

import { type PrismaClient } from "@prisma/client";
import { vaultService } from "~/lib/vault-service";

export interface VaultBonusConfig {
  /** Master toggle (1 = on, 0 = off). */
  enabled: number;
  newPlayer: number;
  wikiImport: number;
  /** NS deck import: credits per card, capped at nsCap. */
  nsPerCard: number;
  nsCap: number;
  achievementCommon: number;
  achievementUncommon: number;
  achievementRare: number;
  achievementEpic: number;
  achievementLegendary: number;
  loreward: number;
}

export const VAULT_BONUS_DEFAULTS: VaultBonusConfig = {
  enabled: 1,
  newPlayer: 5000,
  wikiImport: 2500,
  nsPerCard: 50,
  nsCap: 5000,
  achievementCommon: 100,
  achievementUncommon: 250,
  achievementRare: 500,
  achievementEpic: 1000,
  achievementLegendary: 2500,
  loreward: 2500,
};

const KEY = {
  enabled: "vault_bonus_enabled",
  newPlayer: "vault_bonus_new_player",
  wikiImport: "vault_bonus_wiki_import",
  nsPerCard: "vault_bonus_ns_per_card",
  nsCap: "vault_bonus_ns_cap",
  achievementCommon: "vault_bonus_achievement_common",
  achievementUncommon: "vault_bonus_achievement_uncommon",
  achievementRare: "vault_bonus_achievement_rare",
  achievementEpic: "vault_bonus_achievement_epic",
  achievementLegendary: "vault_bonus_achievement_legendary",
  loreward: "vault_bonus_loreward",
} as const satisfies Record<keyof VaultBonusConfig, string>;

let cache: { value: VaultBonusConfig; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getBonusConfig(db: PrismaClient): Promise<VaultBonusConfig> {
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
  db: PrismaClient,
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
 * can fire freely without double-paying.
 */
export async function grantBonus(
  db: PrismaClient,
  userIdOrClerkId: string,
  source: string,
  amount: number,
  opts: { oneTime?: boolean; metadata?: Record<string, any> } = {}
): Promise<{ granted: boolean; amount: number; newBalance?: number; reason?: string }> {
  const cfg = await getBonusConfig(db);
  if (!cfg.enabled) return { granted: false, amount: 0, reason: "bonuses_disabled" };
  if (amount <= 0) return { granted: false, amount: 0, reason: "zero_amount" };

  const user = await db.user.findFirst({
    where: { OR: [{ id: userIdOrClerkId }, { clerkUserId: userIdOrClerkId }] },
    select: { id: true },
  });
  if (!user) return { granted: false, amount: 0, reason: "user_not_found" };

  if (opts.oneTime) {
    const existing = await db.vaultTransaction.findFirst({
      where: { source, type: "EARN_BONUS", vault: { userId: user.id } },
      select: { id: true },
    });
    if (existing) return { granted: false, amount: 0, reason: "already_granted" };
  }

  const res = await vaultService.earnCredits(
    user.id,
    amount,
    "EARN_BONUS",
    source,
    db,
    opts.metadata
  );
  return { granted: res.success, amount: res.success ? amount : 0, newBalance: res.newBalance, reason: res.message };
}
