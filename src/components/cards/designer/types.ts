import type { LoreCategory } from "~/lib/cards/category-enums";
import type { CardRarity } from "@prisma/client";
import type { MaterialFinishType } from "~/lib/cards/rarity-materials";
import type { CardBackVariant } from "~/components/cards/display/CardBack";

export type { MaterialFinishType, CardBackVariant };

export interface GameIconItem {
  id: string; // e.g. "lorc/crossed-swords"
  name: string; // e.g. "Crossed Swords"
  slug: string; // e.g. "crossed-swords"
  author: string; // e.g. "lorc"
  path: string; // e.g. "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/crossed-swords.svg"
  tags: string[];
}

export interface CardDesignState {
  // Identity
  title: string;
  category: LoreCategory;
  subcategory: string;
  season: number;
  cardType: string;
  customSubtitle: string;

  // Artwork & Custom Image
  artworkUrl: string | null;
  artworkSource: "PROCEDURAL" | "WIKI_FETCHED" | "UPLOADED" | "FLAG";
  enableArtwork: boolean;
  artworkOpacity: number; // 0.1 - 1.0

  // Icons & Sigils
  emblemIcon: GameIconItem | null;
  emblemScale: number; // 0.5 - 1.5
  emblemColor: string; // custom color or empty for category accent
  watermarkIcon: GameIconItem | null;
  watermarkOpacity: number; // 0.05 - 0.70
  watermarkScale: number; // 0.5 - 2.0
  watermarkColor: string; // custom color or empty for category accent

  // Materials & Physical Shaders
  rarity: CardRarity | string;
  materialFinish: MaterialFinishType;
  enableCategoryTint: boolean;
  accentColorOverride: string;
  foilSheen: boolean;
  holographicIntensity: number; // 0 - 1
  surfaceRefraction: number; // 0 - 1
  particleDensity: number; // 0 - 1
  cardBackVariant: CardBackVariant;

  // Lore & Wikitext
  wikiSource: "wikios" | "iiwiki" | "stash";
  wikiArticleTitle: string;
  wikiExcerpt: string;
  description: string;

  // Economy & Supply
  marketValue: number;
  useAutoValuation: boolean;
  isLimitedSupply: boolean;
  totalSupply: number | null;
}

export interface CardDesignPreset {
  id: string;
  name: string;
  createdAt: number;
  state: CardDesignState;
}

export const DEFAULT_DESIGN_STATE: CardDesignState = {
  title: "Concord of Nations",
  category: "DIPLOMACY" as LoreCategory,
  subcategory: "Treaties",
  season: 1,
  cardType: "WIKI_LORE",
  customSubtitle: "",

  artworkUrl: null,
  artworkSource: "PROCEDURAL",
  enableArtwork: false,
  artworkOpacity: 0.85,

  emblemIcon: {
    id: "lorc/laurel-crown",
    name: "Laurel Crown",
    slug: "laurel-crown",
    author: "lorc",
    path: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/laurel-crown.svg",
    tags: ["crown", "diplomacy", "peace", "laurel"],
  },
  emblemScale: 1.0,
  emblemColor: "",
  watermarkIcon: {
    id: "lorc/scroll-unfurled",
    name: "Unfurled Scroll",
    slug: "scroll-unfurled",
    author: "lorc",
    path: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/scroll-unfurled.svg",
    tags: ["scroll", "treaty", "diplomacy", "law"],
  },
  watermarkOpacity: 0.35,
  watermarkScale: 1.0,
  watermarkColor: "",

  rarity: "LEGENDARY" as CardRarity,
  materialFinish: "AUTO" as MaterialFinishType,
  enableCategoryTint: true,
  accentColorOverride: "",
  foilSheen: true,
  holographicIntensity: 0.85,
  surfaceRefraction: 0.6,
  particleDensity: 0.5,
  cardBackVariant: "lattice",

  wikiSource: "wikios",
  wikiArticleTitle: "Concord of Nations",
  wikiExcerpt:
    "The '''Concord of Nations''' serves as the supreme diplomatic council, uniting sovereign states across IxWorld under a unified charter of peace, trade, and non-aggression.",
  description:
    "Supreme diplomatic council uniting sovereign states under a unified charter of peace and trade.",

  marketValue: 6000,
  useAutoValuation: true,
  isLimitedSupply: false,
  totalSupply: null,
};

export const RARITY_BASE_VALUES: Record<string, number> = {
  COMMON: 100,
  UNCOMMON: 250,
  RARE: 600,
  ULTRA_RARE: 1200,
  EPIC: 2500,
  LEGENDARY: 6000,
  MYTHIC: 15000,
  DIVINE: 50000,
};
