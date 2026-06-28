// src/lib/onoma/types.ts
// Onoma Lab — Shared TypeScript Types
// Pure type definitions with zero runtime dependencies.

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
  | "religious-order"
  | "military-unit"
  | "covert-organization"
  | "academic-institution"
  | "guild";

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

/**
 * Configuration for the Onoma sidebar sections.
 */
export type OnomaSection =
  | "overview"
  | "places"
  | "people"
  | "military"
  | "organizations"
  | "culture"
  | "studio"
  | "bank"
  | "settings";

/**
 * Mapping of section IDs to display metadata.
 */
export interface OnomaNavItem {
  id: OnomaSection;
  label: string;
  icon: string;
  description: string;
  path: string;
}

/**
 * All available Onoma nav items, ordered as they appear in the sidebar.
 */
export const ONOMA_NAV_ITEMS: OnomaNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "Sparkles",
    description: "Dashboard & recent generations",
    path: "/labs/onoma",
  },
  {
    id: "places",
    label: "Places",
    icon: "MapPin",
    description: "Countries, cities, provinces, geography",
    path: "/labs/onoma/places",
  },
  {
    id: "people",
    label: "People",
    icon: "Users",
    description: "Characters, rulers, dynasties",
    path: "/labs/onoma/people",
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: "Building2",
    description: "Orders, guilds, institutions, taverns",
    path: "/labs/onoma/organizations",
  },
  {
    id: "culture",
    label: "Culture",
    icon: "Globe",
    description: "Ethnic groups, tribes, languages",
    path: "/labs/onoma/culture",
  },
  {
    id: "studio",
    label: "Studio",
    icon: "Wrench",
    description: "Markov chain workshop",
    path: "/labs/onoma/studio",
  },
  {
    id: "bank",
    label: "Name Bank",
    icon: "Bookmark",
    description: "Saved names & dictionaries",
    path: "/labs/onoma/bank",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "SlidersHorizontal",
    description: "Voice preferences & sandbox",
    path: "/labs/onoma/settings",
  },
];

/**
 * Helper to get section from a pathname.
 */
export function getSectionFromPathname(pathname: string): OnomaSection {
  const segment = pathname.split("/labs/onoma")[1]?.replace(/^\//, "") || "";
  const baseSegment = segment.split("/")[0];
  const match = ONOMA_NAV_ITEMS.find(
    (item) => item.path === `/labs/onoma${baseSegment ? `/${baseSegment}` : ""}`
  );
  return match?.id ?? "overview";
}

/** Studio workspace sub-tabs. */
export type StudioSubTab = "workshop" | "namesets" | "lexicon" | "phonology";

/**
 * Helper to get studio sub-tab from a pathname.
 */
export function getStudioSubTabFromPathname(pathname: string): StudioSubTab {
  const segment = pathname.split("/labs/onoma/studio")[1]?.replace(/^\//, "") || "";
  const subsegment = segment.split("/")[0];
  if (subsegment === "namesets") return "namesets";
  if (subsegment === "lexicon") return "lexicon";
  if (subsegment === "phonology") return "phonology";
  return "workshop";
}
