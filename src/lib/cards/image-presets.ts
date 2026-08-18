// Card background image presets for MyCountry UI
// Provides default images and Unsplash search terms for different card types

export type CardImageType =
  | "national_identity"
  | "head_of_state"
  | "head_of_government"
  | "economic_indicators"
  | "demographics"
  | "labor"
  | "government"
  | "fiscal"
  | "trade"
  | "productivity"
  | "analytics"
  | "defense"
  | "diplomacy";

export interface CardImagePreset {
  type: CardImageType;
  label: string;
  description: string;
  unsplashKeywords: string[];
  fallbackUrl: string;
  fallbackGradient: string;
  allowCustomUpload: boolean;
}

// Default fallback gradient classes for cards without images
const gradientClasses = {
  amber: "from-amber-50/80 to-yellow-50/80 dark:from-amber-900/20 dark:to-yellow-900/20",
  blue: "from-blue-50/80 to-cyan-50/80 dark:from-blue-900/20 dark:to-cyan-900/20",
  emerald: "from-emerald-50/80 to-green-50/80 dark:from-emerald-900/20 dark:to-green-900/20",
  purple: "from-purple-50/80 to-violet-50/80 dark:from-purple-900/20 dark:to-violet-900/20",
  rose: "from-rose-50/80 to-pink-50/80 dark:from-rose-900/20 dark:to-pink-900/20",
  indigo: "from-indigo-50/80 to-blue-50/80 dark:from-indigo-900/20 dark:to-blue-900/20",
  cyan: "from-cyan-50/80 to-teal-50/80 dark:from-cyan-900/20 dark:to-teal-900/20",
  orange: "from-orange-50/80 to-amber-50/80 dark:from-orange-900/20 dark:to-amber-900/20",
} as const;

// Preset configurations for each card type
export const cardImagePresets: Record<CardImageType, CardImagePreset> = {
  national_identity: {
    type: "national_identity",
    label: "National Identity",
    description: "Parliament buildings, government architecture, national landmarks",
    unsplashKeywords: [
      "parliament building",
      "government architecture",
      "capitol building",
      "national landmark",
    ],
    fallbackUrl: "/images/presets/national-identity.jpg",
    fallbackGradient: gradientClasses.amber,
    allowCustomUpload: true,
  },
  head_of_state: {
    type: "head_of_state",
    label: "Head of State",
    description: "Executive office, formal portrait backdrop, presidential palace",
    unsplashKeywords: ["executive office", "presidential palace", "throne room", "formal office"],
    fallbackUrl: "/images/presets/head-of-state.jpg",
    fallbackGradient: gradientClasses.amber,
    allowCustomUpload: true,
  },
  head_of_government: {
    type: "head_of_government",
    label: "Head of Government",
    description: "Prime minister office, cabinet room, government meeting room",
    unsplashKeywords: [
      "cabinet room",
      "prime minister office",
      "government meeting",
      "official office",
    ],
    fallbackUrl: "/images/presets/head-of-government.jpg",
    fallbackGradient: gradientClasses.amber,
    allowCustomUpload: true,
  },
  economic_indicators: {
    type: "economic_indicators",
    label: "Economic Indicators",
    description: "Financial district, stock exchange, modern city skyline",
    unsplashKeywords: [
      "financial district",
      "stock exchange",
      "modern city skyline",
      "business district",
    ],
    fallbackUrl: "/images/presets/economic.jpg",
    fallbackGradient: gradientClasses.emerald,
    allowCustomUpload: true,
  },
  demographics: {
    type: "demographics",
    label: "Demographics",
    description: "Urban population, city crowd, diverse people",
    unsplashKeywords: ["city population", "urban crowd", "diverse people", "city life"],
    fallbackUrl: "/images/presets/demographics.jpg",
    fallbackGradient: gradientClasses.cyan,
    allowCustomUpload: true,
  },
  labor: {
    type: "labor",
    label: "Labor & Workforce",
    description: "Workers, factory floor, modern workplace, office workers",
    unsplashKeywords: ["workers", "modern workplace", "office workers", "factory floor"],
    fallbackUrl: "/images/presets/labor.jpg",
    fallbackGradient: gradientClasses.blue,
    allowCustomUpload: true,
  },
  government: {
    type: "government",
    label: "Government Structure",
    description: "Government building, legislative chamber, courthouse",
    unsplashKeywords: [
      "government building",
      "legislative chamber",
      "courthouse",
      "civic building",
    ],
    fallbackUrl: "/images/presets/government.jpg",
    fallbackGradient: gradientClasses.amber,
    allowCustomUpload: true,
  },
  fiscal: {
    type: "fiscal",
    label: "Fiscal System",
    description: "Treasury, bank vault, financial documents, tax office",
    unsplashKeywords: ["treasury", "bank vault", "financial documents", "central bank"],
    fallbackUrl: "/images/presets/fiscal.jpg",
    fallbackGradient: gradientClasses.amber,
    allowCustomUpload: true,
  },
  trade: {
    type: "trade",
    label: "Trade & Commerce",
    description: "Shipping port, cargo containers, international trade",
    unsplashKeywords: ["shipping port", "cargo containers", "international trade", "harbor"],
    fallbackUrl: "/images/presets/trade.jpg",
    fallbackGradient: gradientClasses.blue,
    allowCustomUpload: true,
  },
  productivity: {
    type: "productivity",
    label: "Productivity",
    description: "Modern factory, technology, innovation, research lab",
    unsplashKeywords: ["modern factory", "technology innovation", "research lab", "automation"],
    fallbackUrl: "/images/presets/productivity.jpg",
    fallbackGradient: gradientClasses.emerald,
    allowCustomUpload: true,
  },
  analytics: {
    type: "analytics",
    label: "Analytics",
    description: "Data visualization, charts, statistics, analysis",
    unsplashKeywords: [
      "data visualization",
      "analytics dashboard",
      "statistics",
      "business intelligence",
    ],
    fallbackUrl: "/images/presets/analytics.jpg",
    fallbackGradient: gradientClasses.indigo,
    allowCustomUpload: true,
  },
  defense: {
    type: "defense",
    label: "Defense & Security",
    description: "Military, defense forces, security infrastructure",
    unsplashKeywords: ["military", "defense", "security", "armed forces"],
    fallbackUrl: "/images/presets/defense.jpg",
    fallbackGradient: gradientClasses.rose,
    allowCustomUpload: true,
  },
  diplomacy: {
    type: "diplomacy",
    label: "Diplomacy",
    description: "Embassy, diplomatic meeting, international relations",
    unsplashKeywords: [
      "embassy",
      "diplomatic meeting",
      "international conference",
      "united nations",
    ],
    fallbackUrl: "/images/presets/diplomacy.jpg",
    fallbackGradient: gradientClasses.purple,
    allowCustomUpload: true,
  },
};

// Get preset for a specific card type
export function getCardImagePreset(type: CardImageType): CardImagePreset {
  return cardImagePresets[type] || cardImagePresets.national_identity;
}

// Get Unsplash search URL for a card type
export function getUnsplashSearchUrl(type: CardImageType): string {
  const preset = getCardImagePreset(type);
  const query = encodeURIComponent(preset.unsplashKeywords[0] || "abstract background");
  return `https://api.unsplash.com/search/photos?query=${query}&per_page=20&orientation=landscape`;
}

// Get fallback gradient class for a card type
export function getFallbackGradient(type: CardImageType): string {
  const preset = getCardImagePreset(type);
  return `bg-gradient-to-br ${preset.fallbackGradient}`;
}

// Check if a card type allows custom uploads
export function allowsCustomUpload(type: CardImageType): boolean {
  const preset = getCardImagePreset(type);
  return preset.allowCustomUpload;
}

// Get all card types that allow custom uploads
export function getCustomUploadableTypes(): CardImageType[] {
  return Object.values(cardImagePresets)
    .filter((preset) => preset.allowCustomUpload)
    .map((preset) => preset.type);
}

// Validate that a card type is valid
export function isValidCardType(type: string): type is CardImageType {
  return type in cardImagePresets;
}
