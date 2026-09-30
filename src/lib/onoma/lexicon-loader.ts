// src/lib/onoma/lexicon-loader.ts
// Centralized lexicon chunk loaders, category mappers, and phonotactic family presets for Onoma

import type { NameCategory, GenerateOptions } from "./types";

export type LexiconCat =
  | "country"
  | "city"
  | "province"
  | "person"
  | "organization"
  | "culture_generic"
  | "culture_sports"
  | "culture_cuisine"
  | "culture_architecture";

export const LEXICON_LOADERS: Record<
  LexiconCat,
  () => Promise<{ default: Record<string, string[]> }>
> = {
  country: () => import("./data/lexicon/country.json"),
  city: () => import("./data/lexicon/city.json"),
  province: () => import("./data/lexicon/province.json"),
  person: () => import("./data/lexicon/person.json"),
  organization: () => import("./data/lexicon/organization.json"),
  culture_generic: () => import("./data/lexicon/culture_generic.json"),
  culture_sports: () => import("./data/lexicon/culture_sports.json"),
  culture_cuisine: () => import("./data/lexicon/culture_cuisine.json"),
  culture_architecture: () => import("./data/lexicon/culture_architecture.json"),
};

/**
 * Maps NameCategory to training data types fetched from backend.
 */
export function mapCategoryForTraining(
  cat: NameCategory
): "country" | "city" | "province" | "person" {
  if (cat === "city" || cat === "geography") return "city";
  if (cat === "province") return "province";
  if (cat === "military" || cat === "organization" || cat === "person" || cat === "dynasty")
    return "person";
  return "country";
}

/**
 * Maps NameCategory and optional subtype to specific lexicon JSON file chunks.
 */
export function mapCategoryForLexicon(cat: NameCategory, subType?: string): LexiconCat {
  if (cat === "culture") {
    if (subType === "sports") return "culture_sports";
    if (subType === "cuisine") return "culture_cuisine";
    return "culture_generic";
  }
  // Architecture/buildings live under the Places > Landmarks tab
  if (cat === "geography" && subType === "architecture") return "culture_architecture";
  if (cat === "city" || cat === "geography") return "city";
  if (cat === "province") return "province";
  if (cat === "person" || cat === "dynasty") return "person";
  if (cat === "organization" || cat === "military") return "organization";
  return "country";
}

/**
 * Per-family phonotactic floor applied to generation so families differ by
 * structure, not just seed list. User advanced options override these.
 */
export const FAMILY_PHONOTACTICS: Record<string, Partial<GenerateOptions>> = {
  austronesian: { maxConsonantCluster: 1 },
  "east-asian": { maxConsonantCluster: 1 },
  arabic: { maxConsonantCluster: 2 },
  persian: { maxConsonantCluster: 2 },
  turkic: { maxConsonantCluster: 2 },
  indic: { maxConsonantCluster: 2 },
  african: { maxConsonantCluster: 2 },
  uralic: { maxConsonantCluster: 2 },
  germanic: { maxConsonantCluster: 3 },
  slavic: { maxConsonantCluster: 4 },
};
