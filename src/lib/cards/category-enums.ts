/**
 * Lore Category Enums
 *
 * Client-safe runtime constants for the lore-first card system.
 * These match the Prisma schema enums.
 */

/**
 * Lore categories — the 13-value replacement for the legacy 5-value CardType.
 *
 * Organized into visual families:
 *   Heraldic:   MILITARY, GOVERNMENT, NATION
 *   Celestial:  RELIGION, SCIENCE, GEOGRAPHY
 *   Civic:      DIPLOMACY, ECONOMY
 *   Humanistic: PEOPLE, CULTURE, HISTORY
 *   Meta:       SPECIAL, NS_IMPORT
 */
export const LoreCategory = {
  MILITARY: "MILITARY",
  DIPLOMACY: "DIPLOMACY",
  GEOGRAPHY: "GEOGRAPHY",
  RELIGION: "RELIGION",
  CULTURE: "CULTURE",
  GOVERNMENT: "GOVERNMENT",
  PEOPLE: "PEOPLE",
  ECONOMY: "ECONOMY",
  SCIENCE: "SCIENCE",
  HISTORY: "HISTORY",
  NATION: "NATION",
  SPECIAL: "SPECIAL",
  NS_IMPORT: "NS_IMPORT",
} as const;

export type LoreCategory = (typeof LoreCategory)[keyof typeof LoreCategory];

/**
 * How a card's artwork was sourced.
 */
export const ArtworkSource = {
  /** No image — fully procedural rendering (Tier 1) */
  PROCEDURAL: "PROCEDURAL",
  /** Image pulled from wiki article via MediaWiki API (Tier 3) */
  WIKI_FETCHED: "WIKI_FETCHED",
  /** Admin-uploaded custom art (Tier 3) */
  UPLOADED: "UPLOADED",
  /** Country flag, auto-fetched (Tier 3) */
  FLAG: "FLAG",
} as const;

export type ArtworkSource = (typeof ArtworkSource)[keyof typeof ArtworkSource];

/**
 * All lore categories as an ordered array (useful for filters, navigation).
 * Excludes NS_IMPORT — that's a compatibility bucket, not a browsable category.
 */
export const BROWSABLE_CATEGORIES: LoreCategory[] = [
  LoreCategory.MILITARY,
  LoreCategory.DIPLOMACY,
  LoreCategory.GEOGRAPHY,
  LoreCategory.RELIGION,
  LoreCategory.CULTURE,
  LoreCategory.GOVERNMENT,
  LoreCategory.PEOPLE,
  LoreCategory.ECONOMY,
  LoreCategory.SCIENCE,
  LoreCategory.HISTORY,
  LoreCategory.NATION,
  LoreCategory.SPECIAL,
];

export function isValidLoreCategory(value: string): value is LoreCategory {
  return Object.values(LoreCategory).includes(value as LoreCategory);
}

export function isValidArtworkSource(value: string): value is ArtworkSource {
  return Object.values(ArtworkSource).includes(value as ArtworkSource);
}

/**
 * Core keyword roots per category. Plural and stem variations are dynamically expanded.
 */
const CATEGORY_ROOTS: Record<LoreCategory, readonly string[]> = {
  NATION: [
    "nation", "country", "state", "sovereignty", "sovereign state", "republic",
    "kingdom", "empire", "principality", "duchy", "grand duchy", "federation",
    "confederacy", "confederation", "commonwealth", "realm", "dominion",
    "homeland", "fatherland", "motherland", "polity",
  ],
  MILITARY: [
    "military", "war", "warfare", "battle", "conflict", "campaign", "siege",
    "army", "navy", "naval", "fleet", "air force", "regiment", "brigade",
    "division", "corps", "squadron", "battalion", "armed forces", "defense force",
    "invasion", "operation", "skirmish", "clash", "combat", "offensive",
    "insurgency", "garrison", "fortress", "armory", "weaponry", "weapon", "defense",
    "conquest",
  ],
  GEOGRAPHY: [
    "geography", "geographic", "geographical", "ocean", "sea", "mountain", "range",
    "river", "island", "archipelago", "continent", "strait", "bay", "gulf", "lake",
    "valley", "desert", "forest", "plain", "peninsula", "cape", "coast", "territory",
    "region", "province", "biome", "climate", "elevation", "volcano", "plateau",
  ],
  RELIGION: [
    "religion", "religious", "faith", "church", "temple", "shrine", "cult",
    "theology", "deity", "god", "goddess", "pantheon", "monastery", "abbey",
    "cathedral", "priest", "bishop", "clergy", "mythology", "sacred", "holy",
    "doctrine", "sect", "rite", "ritual", "spiritual",
  ],
  PEOPLE: [
    "people", "person", "biography", "leader", "monarch", "king", "queen",
    "emperor", "empress", "president", "prime minister", "statesman", "general",
    "admiral", "philosopher", "scientist", "author", "artist", "explorer",
    "founder", "dynasty", "ruler", "chancellor",
  ],
  DIPLOMACY: [
    "diplomacy", "diplomatic", "treaty", "accord", "alliance", "embassy",
    "ambassador", "summit", "pact", "convention", "coalition", "bilateral",
    "multilateral", "foreign policy", "sanction", "envoy", "protocol",
  ],
  CULTURE: [
    "culture", "cultural", "art", "music", "tradition", "language", "dialect",
    "literature", "custom", "heritage", "folklore", "cuisine", "sport",
    "festival", "ceremony", "architecture", "monument", "symbol", "anthem", "flag",
  ],
  GOVERNMENT: [
    "government", "governance", "politics", "political", "parliament", "congress",
    "senate", "legislature", "constitution", "cabinet", "ministry", "minister",
    "democracy", "monarchy", "autocracy", "election", "law", "judiciary", "court",
  ],
  ECONOMY: [
    "economy", "economic", "trade", "commerce", "market", "currency", "finance",
    "financial", "bank", "industry", "sector", "gdp", "tax", "tariff",
    "export", "import", "corporation", "enterprise", "resource", "agriculture",
  ],
  SCIENCE: [
    "science", "scientific", "technology", "tech", "innovation", "research",
    "discovery", "invention", "physics", "chemistry", "biology", "astronomy",
    "engineering", "laboratory", "patent", "space", "medicine",
  ],
  HISTORY: [
    "history", "historical", "era", "age", "period", "century", "epoch",
    "chronicle", "ancient", "medieval", "renaissance", "modern", "revolution",
    "rebellion", "crisis", "timeline", "origin", "event",
  ],
  SPECIAL: [
    "special", "commemorative", "event", "milestone", "anniversary", "award",
    "hall of fame", "legendary", "unique", "custom", "loreward", "founder",
  ],
  NS_IMPORT: [
    "nationstates", "ns", "ns card", "ns import", "external deck", "flag import",
    "trading card", "nationstates import",
  ],
};

function expandSynonyms(roots: readonly string[]): string[] {
  const set = new Set<string>();
  for (const root of roots) {
    const lower = root.toLowerCase();
    set.add(lower);
    if (!lower.includes(" ")) {
      if (lower.endsWith("y") && !lower.endsWith("ey") && !lower.endsWith("ay")) {
        set.add(lower.slice(0, -1) + "ies");
      } else if (
        lower.endsWith("s") ||
        lower.endsWith("sh") ||
        lower.endsWith("ch") ||
        lower.endsWith("x") ||
        lower.endsWith("z")
      ) {
        set.add(lower + "es");
      } else {
        set.add(lower + "s");
      }
    }
  }
  return Array.from(set);
}

/**
 * Comprehensive synonym, alias, and keyword mappings for each LoreCategory.
 */
export const CATEGORY_SYNONYMS: Record<LoreCategory, readonly string[]> = Object.fromEntries(
  Object.entries(CATEGORY_ROOTS).map(([cat, roots]) => [cat, expandSynonyms(roots)])
) as unknown as Record<LoreCategory, readonly string[]>;

/**
 * Returns all synonyms/aliases for a given category.
 */
export function getCategorySynonyms(category: LoreCategory): readonly string[] {
  return CATEGORY_SYNONYMS[category] || [];
}

/**
 * Find matching LoreCategory for any keyword, synonym, or alias.
 */
export function findMatchingCategory(term: string): LoreCategory | null {
  const normalized = term.trim().toLowerCase();
  for (const [cat, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (cat.toLowerCase() === normalized || synonyms.includes(normalized)) {
      return cat as LoreCategory;
    }
  }
  return null;
}
