/**
 * Wiki Signal & Lore Rarity Algorithm
 *
 * Evaluates wiki articles against 6 weighted signals to suggest:
 *   - LoreCategory (from category keywords & content markers)
 *   - CardRarity (COMMON, UNCOMMON, RARE, ULTRA_RARE, EPIC, LEGENDARY)
 *   - ArtworkSource (PROCEDURAL | WIKI_FETCHED | FLAG)
 */

import { LoreCategory } from "./category-enums";
import type { CardRarity } from "@prisma/client";

export interface WikiArticleSignals {
  wordCount: number;
  inboundLinks: number;
  outboundLinks: number;
  editCount: number;
  categoryNames: string[];
  hasImages: boolean;
  firstEditAgeDays?: number;
}

export interface WikiSignalAnalysis {
  suggestedCategory: LoreCategory;
  suggestedRarity: CardRarity;
  suggestedArtworkSource: "PROCEDURAL" | "WIKI_FETCHED" | "FLAG";
  qualityScore: number; // 0.0 to 100.0
  breakdown: {
    wordCountScore: number;
    linkScore: number;
    editCountScore: number;
    categoryBreadthScore: number;
    imageScore: number;
    ageScore: number;
  };
}

/**
 * Category detection keyword rules
 */
const CATEGORY_KEYWORDS: Array<{ category: LoreCategory; keywords: string[] }> = [
  {
    category: LoreCategory.MILITARY,
    keywords: [
      "battle",
      "war",
      "siege",
      "campaign",
      "military",
      "army",
      "navy",
      "air force",
      "conflict",
      "invasion",
      "regiment",
      "weapon",
      "fortress",
      "defense",
      "conquest",
    ],
  },
  {
    category: LoreCategory.DIPLOMACY,
    keywords: [
      "treaty",
      "accord",
      "alliance",
      "pact",
      "embassy",
      "diplomacy",
      "summit",
      "ambassador",
      "convention",
      "league",
      "coalition",
      "sanction",
    ],
  },
  {
    category: LoreCategory.GEOGRAPHY,
    keywords: [
      "mountain",
      "river",
      "ocean",
      "sea",
      "island",
      "valley",
      "strait",
      "bay",
      "peninsula",
      "region",
      "province",
      "territory",
      "lake",
      "continent",
      "geography",
      "forest",
      "desert",
    ],
  },
  {
    category: LoreCategory.RELIGION,
    keywords: [
      "church",
      "faith",
      "religion",
      "god",
      "temple",
      "deity",
      "order",
      "abbey",
      "cult",
      "shrine",
      "pantheon",
      "holy",
      "sacred",
      "mythology",
      "prophet",
      "bishop",
    ],
  },
  {
    category: LoreCategory.CULTURE,
    keywords: [
      "art",
      "music",
      "language",
      "literature",
      "architecture",
      "theater",
      "festival",
      "tradition",
      "cuisine",
      "philosophy",
      "sport",
      "custom",
      "fashion",
      "museum",
    ],
  },
  {
    category: LoreCategory.GOVERNMENT,
    keywords: [
      "monarchy",
      "parliament",
      "constitution",
      "republic",
      "empire",
      "dynasty",
      "ministry",
      "law",
      "court",
      "crown",
      "senate",
      "council",
      "decree",
    ],
  },
  {
    category: LoreCategory.PEOPLE,
    keywords: [
      "biography",
      "people",
      "person",
      "ruler",
      "king",
      "queen",
      "emperor",
      "general",
      "prime minister",
      "president",
      "scholar",
      "artist",
      "births",
      "deaths",
    ],
  },
  {
    category: LoreCategory.ECONOMY,
    keywords: [
      "economy",
      "bank",
      "trade",
      "company",
      "industry",
      "currency",
      "market",
      "export",
      "import",
      "tariff",
      "corporation",
      "mining",
      "agriculture",
    ],
  },
  {
    category: LoreCategory.SCIENCE,
    keywords: [
      "science",
      "technology",
      "invention",
      "astronomy",
      "medicine",
      "university",
      "research",
      "ship",
      "engine",
      "railway",
      "discovery",
      "academic",
    ],
  },
  {
    category: LoreCategory.HISTORY,
    keywords: [
      "history",
      "era",
      "century",
      "period",
      "timeline",
      "chronology",
      "revolution",
      "event",
      "ancient",
      "medieval",
      "modern",
    ],
  },
  {
    category: LoreCategory.NATION,
    keywords: ["nation", "country", "sovereign state", "republic of", "kingdom of", "empire of"],
  },
];

/**
 * Detect LoreCategory from article title and wiki category names
 */
export function detectLoreCategory(title: string, categories: string[]): LoreCategory {
  const combinedText = `${title} ${categories.join(" ")}`.toLowerCase();

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => combinedText.includes(kw))) {
      return category;
    }
  }

  return LoreCategory.HISTORY; // Default fallback for historical lore
}

/**
 * Analyze wiki signals to compute quality score and suggest category, rarity, and artwork source
 */
export function analyzeWikiSignals(title: string, signals: WikiArticleSignals): WikiSignalAnalysis {
  // 1. Word Count Score (weight 25%, max 25 pts)
  // 2000+ words = 25 pts
  const wordCountScore = Math.min(25, (signals.wordCount / 2000) * 25);

  // 2. Link Score (weight 25%, max 25 pts)
  // Inbound links + outbound links, max at 50 links
  const totalLinks = signals.inboundLinks + signals.outboundLinks;
  const linkScore = Math.min(25, (totalLinks / 50) * 25);

  // 3. Edit Count Score (weight 15%, max 15 pts)
  // Max at 30 edits
  const editCountScore = Math.min(15, (signals.editCount / 30) * 15);

  // 4. Category Breadth Score (weight 15%, max 15 pts)
  // Max at 8 categories
  const categoryBreadthScore = Math.min(15, (signals.categoryNames.length / 8) * 15);

  // 5. Image Score (weight 10%, max 10 pts)
  const imageScore = signals.hasImages ? 10 : 0;

  // 6. Age Score (weight 10%, max 10 pts)
  // Max at 365 days
  const ageDays = signals.firstEditAgeDays ?? 30;
  const ageScore = Math.min(10, (ageDays / 365) * 10);

  const qualityScore = Math.min(
    100,
    Math.round(
      (wordCountScore + linkScore + editCountScore + categoryBreadthScore + imageScore + ageScore) *
        10
    ) / 10
  );

  // Suggested Rarity based on qualityScore distribution
  let suggestedRarity: CardRarity = "COMMON";
  if (qualityScore >= 88) {
    suggestedRarity = "LEGENDARY";
  } else if (qualityScore >= 74) {
    suggestedRarity = "EPIC";
  } else if (qualityScore >= 58) {
    suggestedRarity = "ULTRA_RARE";
  } else if (qualityScore >= 42) {
    suggestedRarity = "RARE";
  } else if (qualityScore >= 25) {
    suggestedRarity = "UNCOMMON";
  } else {
    suggestedRarity = "COMMON";
  }

  // Detect category
  const suggestedCategory = detectLoreCategory(title, signals.categoryNames);

  // Suggested Artwork Source
  let suggestedArtworkSource: "PROCEDURAL" | "WIKI_FETCHED" | "FLAG" = "PROCEDURAL";
  if (suggestedCategory === LoreCategory.NATION) {
    suggestedArtworkSource = "FLAG";
  } else if (signals.hasImages) {
    suggestedArtworkSource = "WIKI_FETCHED";
  }

  return {
    suggestedCategory,
    suggestedRarity,
    suggestedArtworkSource,
    qualityScore,
    breakdown: {
      wordCountScore: Math.round(wordCountScore * 10) / 10,
      linkScore: Math.round(linkScore * 10) / 10,
      editCountScore: Math.round(editCountScore * 10) / 10,
      categoryBreadthScore: Math.round(categoryBreadthScore * 10) / 10,
      imageScore: Math.round(imageScore * 10) / 10,
      ageScore: Math.round(ageScore * 10) / 10,
    },
  };
}
