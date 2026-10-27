// src/lib/onoma/types.ts
// Onoma Lab — Shared TypeScript Types

import { z } from "zod";

export type Brand<T, B extends string> = T & { readonly __brand: B };
export type IPAString = Brand<string, "IPAString">;
// Strict Conlang Marketplace & Syntax Schemas
const LexiconDefinitionSchema = z.object({
  partOfSpeech: z.string().default("Noun"),
  root: z.string().default(""),
  meaning: z.string().default(""),
  origin: z.string().default(""),
});
export const StashNoteMetadataSchema = z.object({
  category: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  setName: z.string().nullable().optional(),
  values: z.array(z.string()).default([]),
  lexiconDefinition: LexiconDefinitionSchema.optional(),
  phonology: z
    .object({
      culture: z.string().optional(),
      customRules: z.array(z.tuple([z.string(), z.string()])).optional(),
      voiceTag: z.string().optional(),
      kokoroVoice: z.string().optional(),
    })
    .optional(),
});

export interface LinguisticProfile {
  id: string;
  name: string;
  category: "culture" | "template" | "custom";
  description: string;
  rules: [string, string][];
  stressRule: "initial" | "penultimate" | "ultimate" | "vowel-weight" | "none";
  bcp47VoiceTag: string;
  kokoroVoicePersona?: string;
}

export interface ResolvedNamePhonetics {
  ipa: IPAString;
  bcp47VoiceTag: string;
  kokoroVoicePersona?: string;
  source: "override" | "dictionary" | "template" | "culture" | "default";
}

/**
 * All IxStates-specific name categories supported by the generators.
 */
export type NameCategory =
  | "country"
  | "city"
  | "province"
  | "geography"
  | "person"
  | "dynasty"
  | "military"
  | "organization"
  | "culture"
  | "ship";

/**
 * Cultural/linguistic profiles that shape Markov training data.
 */
export type CulturalProfile =
  | "latin"
  | "germanic"
  | "celtic"
  | "slavic"
  | "arabic"
  | "east-asian"
  | "austronesian"
  | "persian"
  | "turkic"
  | "african"
  | "indic"
  | "uralic"
  | "constructed";

/**
 * Options for Markov chain name generation.
 */
export interface GenerateOptions {
  /** Minimum character length of generated name */
  minLength?: number;
  /** Maximum character length of generated name */
  maxLength?: number;
  /** Generated name must start with this string */
  startsWith?: string;
  /** Generated name must end with this string */
  endsWith?: string;
  /** Generated name must contain this substring */
  contains?: string;
  /** Generated name must NOT contain this substring */
  excludes?: string;
  /** Allow names that duplicate training data */
  allowDuplicates?: boolean;
  /** Maximum generation attempts before giving up */
  maxAttempts?: number;
  /** Vowel harmony constraint: none, front, or back */
  vowelHarmony?: "none" | "front" | "back";
  /** Maximum consecutive consonant cluster size allowed */
  maxConsonantCluster?: number;
  /** Maximum consecutive vowel cluster size allowed */
  maxVowelCluster?: number;
  /** Disallow consecutive identical letters (e.g., "aa", "ss") */
  allowDoubleLetters?: boolean;
  /** Minimum syllable count */
  minSyllables?: number;
  /** Maximum syllable count */
  maxSyllables?: number;
  /** Must end with vowel */
  mustEndWithVowel?: boolean;
  /** Must end with consonant */
  mustEndWithConsonant?: boolean;
  /** Strict CV template format, e.g. "CVCV" */
  cvTemplate?: string;
  /** Disallow word-initial consonant clusters */
  noInitialClusters?: boolean;
  /** Disallow word-final consonant clusters */
  noFinalClusters?: boolean;
}

/**
 * Gender option for species/character generators.
 */
export type Gender = "male" | "female" | "neutral";
/**
 * The three primary Product Model pillars defined in the Onoma Brand Guide:
 * - CREATE: Make language useful (Places, People, Organizations, Cultures, Names)
 * - STUDIO: Build the system (Workshop, Path Visualizer, Name Sets, Sound Shifts, Lexicon, Batch Synthesis)
 * - EXPLORE: Understand the language (Acoustics/IPA, Etymology, Syntax, Writing Systems, Loanwords, Comparator)
 */
export type OnomaProductPillar = "create" | "studio" | "explore";

/**
 * Top-level active sections in the Onoma Workspace.
 */
export type OnomaSection =
  | "overview"
  | "places"
  | "people"
  | "organizations"
  | "culture"
  | "marketplace"
  | "studio"
  | "explore"
  | "bank"
  | "settings";
/**
 * Studio workspace sub-tabs (System Construction Layer).
 */
export type StudioSubTab = "workshop" | "visualizer" | "namesets" | "shifts";

/**
 * Explore workspace sub-tabs (Language Analysis & Understanding Layer — Pure Reference).
 */
export type ExploreSubTab = "phonology" | "grammar" | "writing" | "packs";

/**
 * Mapping of section IDs to display metadata.
 */
interface OnomaNavItem {
  id: OnomaSection;
  label: string;
  icon: string;
  description: string;
  path: string;
  pillar: OnomaProductPillar | "utility";
}

/**
 * All available Onoma nav items for the CREATE pillar and primary utilities.
 */
const ONOMA_NAV_ITEMS: OnomaNavItem[] = [
  {
    id: "overview",
    label: "Sandbox",
    icon: "Sparkles",
    description: "Freeform Markov synthesis sandbox",
    path: "/labs/onoma",
    pillar: "create",
  },
  {
    id: "places",
    label: "Places",
    icon: "MapPin",
    description: "Countries, cities, provinces, geography",
    path: "/labs/onoma/places",
    pillar: "create",
  },
  {
    id: "people",
    label: "People",
    icon: "Users",
    description: "Characters, rulers, dynasties, surnames",
    path: "/labs/onoma/people",
    pillar: "create",
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: "Building2",
    description: "Orders, guilds, institutions, taverns",
    path: "/labs/onoma/organizations",
    pillar: "create",
  },
  {
    id: "culture",
    label: "Culture",
    icon: "Globe",
    description: "Ethnic groups, tribes, traditions, languages",
    path: "/labs/onoma/culture",
    pillar: "create",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: "ShoppingBag",
    description: "Discover, review, and fork community conlangs",
    path: "/labs/onoma/marketplace",
    pillar: "create",
  },
  {
    id: "studio",
    label: "Studio",
    icon: "Wrench",
    description: "Language construction environment",
    path: "/labs/onoma/studio",
    pillar: "studio",
  },
  {
    id: "explore",
    label: "Explore",
    icon: "Compass",
    description: "Acoustics, etymology, syntax, and linguistic analysis",
    path: "/labs/onoma/explore",
    pillar: "explore",
  },
  {
    id: "bank",
    label: "Stash",
    icon: "Bookmark",
    description: "Saved vocabulary & lexicon dictionary",
    path: "/labs/onoma/stash",
    pillar: "utility",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "SlidersHorizontal",
    description: "Voice preferences & sandbox",
    path: "/labs/onoma/settings",
    pillar: "utility",
  },
];

/**
 * Helper to get section from a pathname.
 */
export function getSectionFromPathname(pathname: string): OnomaSection {
  const segment = pathname.split("/labs/onoma")[1]?.replace(/^\//, "") || "";
  const baseSegment = segment.split("/")[0];

  if (baseSegment === "explore") {
    return "explore";
  }
  if (baseSegment === "studio") {
    return "studio";
  }
  if (
    [
      "grammar",
      "syntax",
      "etymology",
      "roots",
      "writing",
      "loanwords",
      "compare",
      "phonology",
    ].includes(baseSegment)
  ) {
    return "explore";
  }
  if (baseSegment === "history" || baseSegment === "stash" || baseSegment === "bank") {
    return "bank";
  }
  if (baseSegment === "batch") {
    return "studio";
  }

  const match = ONOMA_NAV_ITEMS.find(
    (item) => item.path === `/labs/onoma${baseSegment ? `/${baseSegment}` : ""}`
  );
  return match?.id ?? "overview";
}

const pick = <T>(table: Record<string, T>, key: string): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

const STUDIO_SUB_TABS: Record<string, StudioSubTab> = {
  visualizer: "visualizer",
  namesets: "namesets",
  shifts: "shifts",
  "sound-shifts": "shifts",
};

/**
 * Helper to get studio sub-tab from a pathname.
 */
export function getStudioSubTabFromPathname(pathname: string): StudioSubTab {
  const segment = pathname.split("/labs/onoma/studio")[1]?.replace(/^\//, "") || "";
  return pick(STUDIO_SUB_TABS, segment.split("/")[0]) ?? "workshop";
}

const EXPLORE_SUB_TABS: Record<string, ExploreSubTab> = {
  phonology: "phonology",
  acoustics: "phonology",
  compare: "phonology",
  comparator: "phonology",
  grammar: "grammar",
  syntax: "grammar",
  etymology: "grammar",
  roots: "grammar",
  writing: "writing",
  packs: "packs",
  marketplace: "packs",
  community: "packs",
};

/**
 * Helper to get explore sub-tab from a pathname.
 */
export function getExploreSubTabFromPathname(pathname: string): ExploreSubTab {
  const segment = pathname.split("/labs/onoma/explore")[1]?.replace(/^\//, "") || "";
  const nested = pick(EXPLORE_SUB_TABS, segment.split("/")[0]);
  if (nested) return nested;

  // Backward compatibility for root-level direct URLs (which never had a community alias)
  const rootSegment = pathname.split("/labs/onoma/")[1]?.split("/")[0] || "";
  return rootSegment === "community"
    ? "phonology"
    : (pick(EXPLORE_SUB_TABS, rootSegment) ?? "phonology");
}
