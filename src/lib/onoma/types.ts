// src/lib/onoma/types.ts
// Onoma Lab — Shared TypeScript Types

import { z } from "zod";

export type Brand<T, B extends string> = T & { readonly __brand: B };
export type IPAString = Brand<string, "IPAString">;
export type LanguagePackId = Brand<string, "LanguagePackId">;

export const toIPAString = (s: string): IPAString => s as IPAString;

// Strict Conlang Marketplace & Syntax Schemas
export const PhonologyRulesSchema = z.object({
  consonants: z.array(z.string()).default([]),
  vowels: z.array(z.string()).default([]),
  syllables: z.array(z.string()).default(["CV", "CVC"]),
  maxConsonantCluster: z.number().int().min(1).max(6).default(3),
  stressRule: z.enum(["initial", "penultimate", "ultimate", "none"]).default("penultimate"),
});

export const MorphologyRulesSchema = z.object({
  genderSystem: z
    .enum(["masculine-feminine-neuter", "animate-inanimate", "common-neuter", "none"])
    .default("none"),
  declensionPatterns: z.record(z.string(), z.record(z.string(), z.string())).default({}),
});

export const StashNoteMetadataSchema = z.object({
  category: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  setName: z.string().nullable().optional(),
  values: z.array(z.string()).default([]),
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

export type PhonologyRules = z.infer<typeof PhonologyRulesSchema>;
export type MorphologyRules = z.infer<typeof MorphologyRulesSchema>;
export type StashNoteMetadata = z.infer<typeof StashNoteMetadataSchema>;

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
 * Training mode for name generation.
 */
export type TrainingMode = "ixworld" | "preset" | "lexicon";

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
 * Species preset identifiers (rebranded from original Onoma).
 */
export type SpeciesPreset =
  | "fantasy-generic"
  | "monstrous" // Goblin, Orc, Ogre
  | "stout-folk" // Dwarf, Halfling, Gnome
  | "fey-elven" // Elf, Dark Elf, Faery
  | "mythic" // Dragon, Demon, Angel, Half-Demon
  | "primitive"; // Caveman, tribal

/**
 * Group/organization preset identifiers.
 */
export type GroupPreset =
  "religious-order" | "military-unit" | "covert-organization" | "academic-institution" | "guild";

/**
 * Descriptor for a generator preset shown in the UI.
 */
export interface GeneratorPreset {
  id: string;
  name: string;
  description: string;
  category: NameCategory;
  icon?: string;
}

/**
 * NameBank entry shape matching the Prisma model for client-side use.
 */
export interface NameBankEntry {
  id: string;
  userId: string;
  type: "dictionary" | "saved-name";
  title: string;
  values: string[];
  category: NameCategory | null;
  culturalProfile: CulturalProfile | null;
  isPublic: boolean;
  countryId: string | null;
  clonedFromId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of a name generation batch.
 */
export interface GenerationResult {
  names: string[];
  category: NameCategory;
  culturalProfile: CulturalProfile | null;
  trainingMode: TrainingMode;
  generatedAt: Date;
}

export type DictionaryId = Brand<string, "DictionaryId">;
export type StashEntryId = Brand<string, "StashEntryId">;

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
 * Sections belonging to the CREATE pillar.
 */
export type CreateSection =
  | "overview"
  | "places"
  | "people"
  | "organizations"
  | "culture";

/**
 * Studio workspace sub-tabs (System Construction Layer).
 */
export type StudioSubTab =
  | "workshop"
  | "visualizer"
  | "namesets"
  | "shifts"
  | "lexicon"
  | "batch";

/**
 * Explore workspace sub-tabs (Language Analysis & Understanding Layer).
 */
export type ExploreSubTab =
  | "phonology"
  | "etymology"
  | "syntax"
  | "writing"
  | "loanwords"
  | "compare"
  | "packs";

/**
 * Mapping of section IDs to display metadata.
 */
export interface OnomaNavItem {
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
export const ONOMA_NAV_ITEMS: OnomaNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "Sparkles",
    description: "Quick synthesis & language engine overview",
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
    description: "Saved vocabulary & dictionaries",
    path: "/labs/onoma/bank",
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
    ["etymology", "syntax", "writing", "loanwords", "compare", "phonology"].includes(baseSegment)
  ) {
    return "explore";
  }
  if (baseSegment === "history" || baseSegment === "stash") {
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

/**
 * Helper to get studio sub-tab from a pathname.
 */
export function getStudioSubTabFromPathname(pathname: string): StudioSubTab {
  const segment = pathname.split("/labs/onoma/studio")[1]?.replace(/^\//, "") || "";
  const subsegment = segment.split("/")[0];
  if (subsegment === "visualizer") return "visualizer";
  if (subsegment === "namesets") return "namesets";
  if (subsegment === "lexicon") return "lexicon";
  if (subsegment === "shifts" || subsegment === "sound-shifts") return "shifts";
  if (subsegment === "batch") return "batch";

  // Backward compatibility for /labs/onoma/batch URL
  if (pathname.includes("/labs/onoma/batch")) {
    return "batch";
  }

  return "workshop";
}

/**
 * Helper to get explore sub-tab from a pathname.
 */
export function getExploreSubTabFromPathname(pathname: string): ExploreSubTab {
  const segment = pathname.split("/labs/onoma/explore")[1]?.replace(/^\//, "") || "";
  const subsegment = segment.split("/")[0];
  if (subsegment === "phonology" || subsegment === "acoustics") return "phonology";
  if (subsegment === "syntax") return "syntax";
  if (subsegment === "writing") return "writing";
  if (subsegment === "loanwords") return "loanwords";
  if (subsegment === "compare") return "compare";
  if (subsegment === "etymology") return "etymology";
  if (subsegment === "packs" || subsegment === "marketplace" || subsegment === "community") return "packs";

  // Backward compatibility for root-level direct URLs
  const parts = pathname.split("/labs/onoma/")[1]?.split("/") || [];
  const rootSegment = parts[0] || "";
  if (rootSegment === "phonology" || rootSegment === "acoustics") return "phonology";
  if (rootSegment === "syntax") return "syntax";
  if (rootSegment === "writing") return "writing";
  if (rootSegment === "loanwords") return "loanwords";
  if (rootSegment === "compare") return "compare";
  if (rootSegment === "packs" || rootSegment === "marketplace") return "packs";

  return "phonology";
}
