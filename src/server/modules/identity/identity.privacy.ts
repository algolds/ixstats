/**
 * Passport privacy: the owner's persisted display settings (`PassportPreference`) and the
 * server-side redaction that keeps hidden sections out of every public passport response.
 *
 * A hidden section is removed for every viewer, the owner included, so the passport the owner sees
 * is the one visitors see. The owner reads and edits the settings through `getPassportSettings`.
 */
import { db } from "~/server/db";
import type { PassportAchievementsShowcase } from "./identity.showcase";
import type { AwardHistoryItem, PassportForumStats, PassportLorewards } from "./identity.types";
import type { PassportVaultSummary } from "./identity.vault";

/** The toggleable passport sections, keyed as the passport UI names them. */
export interface PassportVisibility {
  /** Lorewards score, rank, laurels and award history. */
  accolades: boolean;
  /** Collection category breadth ("Focus"). */
  impact: boolean;
  /** Forum message, reaction and trophy counters. */
  forumStats: boolean;
  /** IxCredits balance and the Vault collection. */
  vaultCards: boolean;
  /** Cross-platform activity History stream. */
  historyStream: boolean;
  /** Unlocked achievements and the ribbons derived from them. */
  achievements: boolean;
  /** Rich link previews (page metadata and the OG card); off returns `{ preview: false }`. */
  linkPreview: boolean;
}

const PASSPORT_VISIBILITY_KEYS = [
  "accolades",
  "impact",
  "forumStats",
  "vaultCards",
  "historyStream",
  "achievements",
  "linkPreview",
] as const satisfies ReadonlyArray<keyof PassportVisibility>;

/** Every section is public until the owner hides it (the passport's behaviour before persistence). */
export const DEFAULT_PASSPORT_VISIBILITY: PassportVisibility = {
  accolades: true,
  impact: true,
  forumStats: true,
  vaultCards: true,
  historyStream: true,
  achievements: true,
  linkPreview: true,
};

export const MAX_PINNED_RIBBONS = 3;
export const MAX_SIGNATURE_LENGTH = 60;

interface PassportSettings {
  visibility: PassportVisibility;
  signature: string | null;
  pinnedRibbonKeys: string[];
}

/** Database column for each visibility key. */
const COLUMN_OF = {
  accolades: "showLorewards",
  impact: "showFocus",
  forumStats: "showForumStats",
  vaultCards: "showVault",
  historyStream: "showHistory",
  achievements: "showAchievements",
  linkPreview: "showLinkPreview",
} as const satisfies Record<keyof PassportVisibility, string>;

type PreferenceColumns = { [K in (typeof COLUMN_OF)[keyof typeof COLUMN_OF]]: boolean };

interface PreferenceRow extends PreferenceColumns {
  signature: string | null;
  pinnedRibbonKeys: string[];
}

const PREFERENCE_SELECT = {
  showLorewards: true,
  showFocus: true,
  showForumStats: true,
  showVault: true,
  showHistory: true,
  showAchievements: true,
  showLinkPreview: true,
  signature: true,
  pinnedRibbonKeys: true,
} as const;

export function toPassportSettings(row: PreferenceRow | null): PassportSettings {
  if (!row) {
    return {
      visibility: { ...DEFAULT_PASSPORT_VISIBILITY },
      signature: null,
      pinnedRibbonKeys: [],
    };
  }
  const visibility = { ...DEFAULT_PASSPORT_VISIBILITY };
  for (const key of PASSPORT_VISIBILITY_KEYS) visibility[key] = row[COLUMN_OF[key]];
  return {
    visibility,
    signature: row.signature?.trim() || null,
    pinnedRibbonKeys: row.pinnedRibbonKeys.slice(0, MAX_PINNED_RIBBONS),
  };
}

/**
 * The stored settings for a user, or the defaults. A read failure falls back to the defaults, which
 * match the passport's behaviour before settings were persisted.
 */
export async function loadPassportSettings(
  userId: string | null | undefined
): Promise<PassportSettings> {
  if (!userId) return toPassportSettings(null);
  const row = await db.passportPreference
    .findUnique({ where: { userId }, select: PREFERENCE_SELECT })
    .catch((err: unknown) => {
      console.warn("[PassportPrivacy] Failed to load settings for user", userId, err);
      return null;
    });
  return toPassportSettings(row);
}

export interface PassportSettingsUpdate {
  visibility?: Partial<PassportVisibility>;
  signature?: string | null;
  pinnedRibbonKeys?: string[];
}

/** Persist a partial settings update; `pinnedRibbonKeys` must already be validated by the caller. */
export async function savePassportSettings(
  userId: string,
  update: PassportSettingsUpdate
): Promise<PassportSettings> {
  const data: Partial<PreferenceColumns> & {
    signature?: string | null;
    pinnedRibbonKeys?: string[];
  } = {};
  for (const key of PASSPORT_VISIBILITY_KEYS) {
    const value = update.visibility?.[key];
    if (typeof value === "boolean") data[COLUMN_OF[key]] = value;
  }
  if (update.signature !== undefined) {
    data.signature = update.signature?.trim().slice(0, MAX_SIGNATURE_LENGTH) || null;
  }
  if (update.pinnedRibbonKeys !== undefined) {
    data.pinnedRibbonKeys = [...new Set(update.pinnedRibbonKeys)].slice(0, MAX_PINNED_RIBBONS);
  }
  const row = await db.passportPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: PREFERENCE_SELECT,
  });
  return toPassportSettings(row);
}

/** The passport sections privacy settings can strip. */
export interface PassportSections {
  lorewards: PassportLorewards | null;
  awardHistory: AwardHistoryItem[];
  forumStats: PassportForumStats | null;
  vault: PassportVaultSummary | null;
  achievements: PassportAchievementsShowcase | null;
}

/**
 * Remove every hidden section. Pure: returns a new object, so a hidden section's data never reaches
 * the response.
 */
export function redactPassportSections(
  sections: PassportSections,
  visibility: PassportVisibility
): PassportSections {
  const out = { ...sections };
  if (!visibility.accolades) {
    out.lorewards = null;
    out.awardHistory = [];
  }
  if (!visibility.forumStats) out.forumStats = null;
  if (!visibility.vaultCards) out.vault = null;
  else if (!visibility.impact && out.vault) out.vault = { ...out.vault, focus: null };
  if (!visibility.achievements) out.achievements = null;
  return out;
}
