// src/lib/onoma/ipa-overrides.ts
// Onoma Lab — Client-side IPA & per-name voice customization (localStorage).
//
// Two stores, both device-local (no DB):
//   onoma-name-overrides  : { [name]: { ipa?, voice? } }  — per-name fixes
//   onoma-phonology-rules : { [culture]: [grapheme, ipa][] } — culture-wide rule overrides
//
// ponytail: localStorage, not synced across devices. Promote to a DB model only if
// cross-device sync of conlang rules is ever needed.

import { translateToIPA } from "./phonology";

export const NAME_OVERRIDES_KEY = "onoma-name-overrides";
export const PHONOLOGY_RULES_KEY = "onoma-phonology-rules";
export const OVERRIDES_UPDATED_EVENT = "onoma-overrides-updated";

export interface NameOverride {
  ipa?: string;
  voice?: string;
}

type NameOverrideMap = Record<string, NameOverride>;
type PhonologyRuleMap = Record<string, [string, string][]>;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(OVERRIDES_UPDATED_EVENT));
}

// --- Per-name overrides (ipa + voice) ---

export function getNameOverrides(): NameOverrideMap {
  return readJson<NameOverrideMap>(NAME_OVERRIDES_KEY, {});
}

export function getNameOverride(name: string): NameOverride | undefined {
  return getNameOverrides()[name];
}

/** Merge a partial override for a name. Passing `undefined`/empty values clears that field. */
export function setNameOverride(name: string, patch: NameOverride): void {
  const all = getNameOverrides();
  const next: NameOverride = { ...all[name], ...patch };
  if (!next.ipa) delete next.ipa;
  if (!next.voice) delete next.voice;
  if (Object.keys(next).length === 0) {
    delete all[name];
  } else {
    all[name] = next;
  }
  writeJson(NAME_OVERRIDES_KEY, all);
}

// --- Per-culture rule overrides ---

export function getCultureRuleOverrides(culture: string | null): [string, string][] {
  if (!culture) return [];
  const primary = culture.split("+")[0].toLowerCase().trim();
  return readJson<PhonologyRuleMap>(PHONOLOGY_RULES_KEY, {})[primary] ?? [];
}

export function setCultureRuleOverrides(culture: string, rules: [string, string][]): void {
  const primary = culture.split("+")[0].toLowerCase().trim();
  const all = readJson<PhonologyRuleMap>(PHONOLOGY_RULES_KEY, {});
  // Drop blank grapheme rows; an empty IPA value is valid (silent mapping).
  const cleaned = rules.filter(([g]) => g.trim().length > 0);
  if (cleaned.length === 0) {
    delete all[primary];
  } else {
    all[primary] = cleaned;
  }
  writeJson(PHONOLOGY_RULES_KEY, all);
}

// --- Resolution ---

/** Resolve the effective IPA for a name: per-name override wins, else culture rules + overrides. */
export function resolveIpa(name: string, culture: string | null): string {
  const override = getNameOverride(name)?.ipa;
  if (override) return override;
  return translateToIPA(name, culture, getCultureRuleOverrides(culture));
}
