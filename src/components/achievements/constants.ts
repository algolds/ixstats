import {
  Trophy,
  Star,
  Crown,
  Sparks as Sparkles,
  StatUp as TrendingUp,
  Shield,
  Bank as Landmark,
  OpenBook as BookOpen,
  Globe,
} from "iconoir-react";
import type { BadgeVariant } from "~/components/ui/badge";
import type { FacetAccent } from "~/lib/design/identity";

export const QUEST_PATHS = [
  {
    name: "Merchant Path",
    description: "Build a massive national economy and GDP",
    icon: TrendingUp,
    badgeColor: "bg-green/10 text-green border-green/20",
    glowColor: "shadow-floating",
    lineColor: "bg-green/30",
    activeLineColor: "bg-green",
    nodeColor: "emerald",
    keys: [
      "econ-first-million",
      "econ-millionaire-nation",
      "econ-economic-powerhouse",
      "econ-trillion-club",
      "econ-global-titan",
    ],
  },
  {
    name: "Prosperity Path",
    description: "Improve citizen wealth and economic development",
    icon: Sparkles,
    badgeColor: "bg-yellow/10 text-yellow border-yellow/20",
    glowColor: "shadow-floating",
    lineColor: "bg-yellow/30",
    activeLineColor: "bg-yellow",
    nodeColor: "yellow",
    keys: [
      "econ-wealthy-citizens",
      "econ-prosperity-nation",
      "econ-first-world-status",
      "econ-ultra-prosperity",
      "econ-tier-advancement",
    ],
  },
  {
    name: "Warlord Path",
    description: "Expand and fund the armed forces",
    icon: Shield,
    badgeColor: "bg-red/10 text-red border-red/20",
    glowColor: "shadow-floating",
    lineColor: "bg-red/30",
    activeLineColor: "bg-red",
    nodeColor: "red",
    keys: [
      "mil-first-branch",
      "mil-armed-forces",
      "mil-full-spectrum",
      "mil-defense-commitment",
      "mil-strong-defense",
      "mil-military-superpower",
      "mil-standing-army",
      "mil-large-force",
      "mil-massive-force",
      "mil-global-force",
    ],
  },
  {
    name: "Diplomat Path",
    description: "Extend global influence through treaties and trade",
    icon: Globe,
    badgeColor: "bg-blue/10 text-blue border-blue/20",
    glowColor: "shadow-floating",
    lineColor: "bg-blue/30",
    activeLineColor: "bg-blue",
    nodeColor: "blue",
    keys: [
      "dip-first-embassy",
      "dip-diplomatic-network",
      "dip-global-presence",
      "dip-embassy-network",
      "dip-first-treaty",
      "dip-treaty-network",
      "dip-trade-partners",
      "dip-trade-hub",
      "dip-alliance-maker",
      "dip-alliance-network",
    ],
  },
  {
    name: "Sovereign Path",
    description: "Develop atomic governance structures",
    icon: Landmark,
    badgeColor: "bg-indigo/10 text-indigo border-indigo/20",
    glowColor: "shadow-floating",
    lineColor: "bg-indigo/30",
    activeLineColor: "bg-indigo",
    nodeColor: "indigo",
    keys: ["gov-first-component", "gov-building-blocks", "gov-sophisticated", "gov-complex-system"],
  },
  {
    name: "Thinker Path",
    description: "Influence public discourse on ThinkPages",
    icon: BookOpen,
    badgeColor: "bg-blue/10 text-blue border-blue/20",
    glowColor: "shadow-floating",
    lineColor: "bg-blue/30",
    activeLineColor: "bg-blue",
    nodeColor: "blue",
    keys: [
      "social-first-thinkpage",
      "social-thinkpage-author",
      "social-prolific-author",
      "social-popular",
      "social-trending",
    ],
  },
  {
    name: "Vidmaster Path",
    description: "The ultimate trial of system mastery and dedication",
    icon: Crown,
    badgeColor: "bg-yellow/10 text-yellow border-yellow/20",
    glowColor: "shadow-floating",
    lineColor: "bg-yellow/30",
    activeLineColor: "bg-yellow",
    nodeColor: "yellow",
    keys: ["vid-lightswitch", "vid-annual", "vid-end-of-days"],
  },
  {
    name: "Lore & Meme Path",
    description: "Nostalgic community jokes, stonks, and wiki archives",
    icon: Trophy,
    badgeColor: "bg-indigo/10 text-indigo border-indigo/20",
    glowColor: "shadow-floating",
    lineColor: "bg-indigo/30",
    activeLineColor: "bg-indigo",
    nodeColor: "indigo",
    keys: [
      "meme-stonks",
      "meme-1337",
      "meme-bankruptcy",
      "lore-scholar",
      "lore-collector",
      "meme-ns-ref",
    ],
  },
];

/**
 * Per-category styling: a system colour carries the category on its badge, icon pedestal and icon
 * fill. Facet 3.1 (spec §16.5) restores the v2 card decoration through the identity sheet's
 * sanctioned classes, driven by `accent` / `accent2` (the card's `accent`, aurora, radiance) and the `jewel` stops
 * (the metallic icon fill) — system colour roles, so they follow the theme.
 */
export interface CategoryTheme {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Category chip: a system-colour `Badge` variant (AA ink on a 15% fill). */
  badgeVariant: BadgeVariant;
  /** @deprecated Category chip classes; use `badgeVariant`. */
  badge: string;
  /** Icon pedestal: a 15% wash of the category colour. */
  pedestal: string;
  cardBorderHover: string;
  accentColor: string;
  /** Solid fill painted through the achievement icon's mask (locked/fallback). */
  iconFill: string;
  /**
   * Category accent (Facet 3.1, spec §16.8): the card's `accent` prop (glass wash, tinted border,
   * glow) and the aurora / radiance colour of `AchievementCardBackdrop`.
   */
  accent: FacetAccent;
  /** The aurora's secondary hue (v2 `via-amber`/`via-cyan`…). */
  accent2: FacetAccent;
  /** Jewel icon gradient stops (`--jewel-from/-via/-to`; v2 `iconGradient`). */
  jewel: readonly [from: string, via: string, to: string];
}

/** A pale highlight of a colour, for the jewel's middle stop (v2 `via-*-100`). */
const pale = (color: string) => `color-mix(in srgb, ${color} 25%, white)`;

export const CATEGORY_THEME_MAP: Record<string, CategoryTheme> = {
  Economic: {
    name: "Economic",
    icon: TrendingUp,
    badgeVariant: "green",
    badge: "bg-green/15 text-green",
    pedestal: "bg-green/15 text-green",
    cardBorderHover: "hover:border-green/40",
    accentColor: "emerald",
    iconFill: "bg-green",
    accent: "green",
    accent2: "yellow",
    jewel: ["var(--gold-from)", pale("var(--color-yellow)"), "var(--gold-to)"],
  },
  Military: {
    name: "Military",
    icon: Shield,
    badgeVariant: "red",
    badge: "bg-red/15 text-red",
    pedestal: "bg-red/15 text-red",
    cardBorderHover: "hover:border-red/40",
    accentColor: "red",
    iconFill: "bg-red",
    accent: "red",
    accent2: "yellow",
    jewel: ["var(--color-red)", pale("var(--color-yellow)"), "var(--color-red)"],
  },
  Diplomatic: {
    name: "Diplomatic",
    icon: Globe,
    badgeVariant: "teal",
    badge: "bg-teal/15 text-teal",
    pedestal: "bg-teal/15 text-teal",
    cardBorderHover: "hover:border-teal/40",
    accentColor: "cyan",
    iconFill: "bg-teal",
    accent: "teal",
    accent2: "blue",
    jewel: ["var(--color-cyan)", pale("var(--color-cyan)"), "var(--color-blue)"],
  },
  Government: {
    name: "Government",
    icon: Landmark,
    badgeVariant: "indigo",
    badge: "bg-indigo/15 text-indigo",
    pedestal: "bg-indigo/15 text-indigo",
    cardBorderHover: "hover:border-indigo/40",
    accentColor: "indigo",
    iconFill: "bg-indigo",
    accent: "indigo",
    accent2: "cyan",
    jewel: ["var(--color-indigo)", pale("var(--color-cyan)"), "var(--color-indigo)"],
  },
  Social: {
    name: "Social",
    icon: BookOpen,
    badgeVariant: "blue",
    badge: "bg-blue/15 text-blue",
    pedestal: "bg-blue/15 text-blue",
    cardBorderHover: "hover:border-blue/40",
    accentColor: "blue",
    iconFill: "bg-blue",
    accent: "blue",
    accent2: "cyan",
    jewel: ["var(--color-blue)", pale("var(--color-cyan)"), "var(--color-blue)"],
  },
  General: {
    name: "General",
    icon: Trophy,
    badgeVariant: "yellow",
    badge: "bg-yellow/15 text-yellow",
    pedestal: "bg-yellow/15 text-yellow",
    cardBorderHover: "hover:border-yellow/40",
    accentColor: "amber",
    iconFill: "bg-yellow",
    accent: "yellow",
    accent2: "orange",
    jewel: ["var(--gold-from)", pale("var(--color-yellow)"), "var(--gold-to)"],
  },
};

export function getCategoryTheme(category?: string): CategoryTheme {
  if (category && CATEGORY_THEME_MAP[category]) {
    return CATEGORY_THEME_MAP[category];
  }
  return CATEGORY_THEME_MAP.General;
}

export const categories = [
  { id: "all", name: "All Categories", icon: Star },
  { id: "Economic", name: "Economic", icon: TrendingUp },
  { id: "Diplomatic", name: "Diplomatic", icon: Globe },
  { id: "Government", name: "Government", icon: Landmark },
  { id: "Military", name: "Military", icon: Shield },
  { id: "Social", name: "Social", icon: BookOpen },
  { id: "General", name: "General", icon: Trophy },
];

export const rarities = ["all", "Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
export type RarityType = (typeof rarities)[number];

export const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case "Legendary":
      return "text-yellow border-yellow/30";
    case "Epic":
      return "text-purple border-purple/30";
    case "Ultra Rare":
    case "ULTRA_RARE":
      return "text-teal border-teal/30";
    case "Rare":
      return "text-blue border-blue/30";
    case "Uncommon":
      return "text-green border-green/30";
    default:
      return "text-label-secondary border-separator";
  }
};

/** Rarity chip as a `Badge` variant; locked achievements are neutral. */
export const getRarityBadgeVariant = (rarity: string, isUnlocked = true): BadgeVariant => {
  if (!isUnlocked) return "neutral";
  switch (rarity) {
    case "Legendary":
      return "yellow";
    case "Epic":
      return "purple";
    case "Ultra Rare":
    case "ULTRA_RARE":
      return "teal";
    case "Rare":
      return "blue";
    case "Uncommon":
      return "green";
    default:
      return "neutral";
  }
};

export const getRarityBg = (rarity: string, isUnlocked = true) => {
  if (!isUnlocked) return "bg-fill-4 border-separator text-label-tertiary";
  switch (rarity) {
    case "Legendary":
      return "bg-yellow/10 border-yellow/30";
    case "Epic":
      return "bg-purple/10 border-purple/30";
    case "Ultra Rare":
    case "ULTRA_RARE":
      return "bg-teal/10 border-teal/30";
    case "Rare":
      return "bg-blue/10 border-blue/30";
    case "Uncommon":
      return "bg-green/10 border-green/30";
    default:
      return "bg-fill-3 border-separator";
  }
};

export type TrophyTier = "platinum" | "gold" | "silver" | "bronze";

export const getTrophyTier = (rarity: string): TrophyTier => {
  switch (rarity) {
    case "Legendary":
      return "platinum";
    case "Epic":
      return "gold";
    case "Rare":
    case "Ultra Rare":
    case "ULTRA_RARE":
      return "silver";
    default:
      return "bronze";
  }
};

/**
 * High-res Game-Icons.net SVG mapping (4,100+ SVG manifest from GameIconsBrowser)
 */
export const ACHIEVEMENT_GAME_ICONS: Record<string, string> = {
  // Economic GDP Series
  "econ-first-million": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/coins.svg",
  "econ-millionaire-nation":
    "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/money-stack.svg",
  "econ-economic-powerhouse": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/bank.svg",
  "econ-trillion-club": "/icons/game-icons/icons/ffffff/transparent/1x1/willdabeast/gold-bar.svg",
  "econ-global-titan": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/crown.svg",

  // Economic GDP Per Capita Series
  "econ-wealthy-citizens": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/buy-card.svg",
  "econ-prosperity-nation":
    "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/greek-temple.svg",
  "econ-first-world-status":
    "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/sparkles.svg",
  "econ-ultra-prosperity": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/profit.svg",

  // Economic Growth & General
  "econ-growth-rocket": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/growth.svg",
  "econ-boom-cycle": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/profit.svg",
  "econ-full-employment": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/hammer-drop.svg",
  "econ-price-stability": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/scales.svg",
  "econ-tax-efficiency": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/diploma.svg",
  "econ-tier-advancement": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/laurel-crown.svg",

  // Military Branches
  "mil-first-branch": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/crossed-swords.svg",
  "mil-armed-forces":
    "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/spartan-helmet.svg",
  "mil-full-spectrum": "/icons/game-icons/icons/ffffff/transparent/1x1/sbed/shield.svg",

  // Military Defense Spending
  "mil-defense-commitment":
    "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/police-officer-head.svg",
  "mil-strong-defense": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/castle.svg",
  "mil-military-superpower":
    "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/lightning-branches.svg",

  // Military Personnel
  "mil-standing-army": "/icons/game-icons/icons/ffffff/transparent/1x1/skoll/rank-3.svg",
  "mil-large-force": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/meeple-army.svg",
  "mil-massive-force": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/tank.svg",
  "mil-global-force": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/jet-fighter.svg",

  // Diplomatic Embassies
  "dip-first-embassy": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/capitol.svg",
  "dip-diplomatic-network": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/globe.svg",
  "dip-global-presence": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/treasure-map.svg",
  "dip-embassy-network":
    "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/greek-temple.svg",

  // Diplomatic Treaties & Trade
  "dip-first-treaty": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/tied-scroll.svg",
  "dip-treaty-network": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/diploma.svg",
  "dip-trade-partners": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/trade.svg",
  "dip-trade-hub": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/cargo-ship.svg",
  "dip-alliance-maker": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/two-shadows.svg",
  "dip-alliance-network": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/team-idea.svg",

  // Government & Atomic Systems
  "gov-first-component": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/stone-block.svg",
  "gov-building-blocks": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/brick-wall.svg",
  "gov-sophisticated": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/capitol.svg",
  "gov-complex-system":
    "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/gear-stick-pattern.svg",

  // Social & Thinkpages
  "social-first-thinkpage": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/quill.svg",
  "social-thinkpage-author": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/book-cover.svg",
  "social-prolific-author":
    "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/bookshelf.svg",
  "social-popular": "/icons/game-icons/icons/ffffff/transparent/1x1/carl-olsen/flame.svg",
  "social-trending": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/lightning-storm.svg",

  // Demographics & Population
  "pop-emerging": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/family-house.svg",
  "pop-populous": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/human-pyramid.svg",
  "pop-giant": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/meeple-group.svg",
  "pop-mega": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/earth-america.svg",

  // Lore, Wiki, Special & Memes
  "lore-scholar": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/spell-book.svg",
  "lore-collector": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/chest.svg",
  "meme-stonks": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/profit.svg",
  "meme-1337": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/laser-sparks.svg",
  "meme-bankruptcy": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/broken-bone.svg",
  "meme-ns-ref": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/flag-objective.svg",
  "vid-lightswitch": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/light-bulb.svg",
  "vid-annual": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/hourglass.svg",
  "vid-end-of-days": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/eclipse.svg",
};

/**
 * Resolves high-quality Game-Icons SVG path for any achievement key or category
 */
export function getAchievementGameIconPath(key: string, category?: string): string {
  if (ACHIEVEMENT_GAME_ICONS[key]) {
    return ACHIEVEMENT_GAME_ICONS[key];
  }

  // Category fallbacks
  switch (category) {
    case "Economic":
      return "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/coins.svg";
    case "Military":
      return "/icons/game-icons/icons/ffffff/transparent/1x1/sbed/shield.svg";
    case "Diplomatic":
      return "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/globe.svg";
    case "Government":
      return "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/capitol.svg";
    case "Social":
      return "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/quill.svg";
    default:
      return "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/trophy.svg";
  }
}

/**
 * Multi-Level Achievement Progression Series Definitions
 */
export interface AchievementSeriesConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  iconPath: string;
  keys: string[];
}

export const ACHIEVEMENT_SERIES_DEFINITIONS: AchievementSeriesConfig[] = [
  {
    id: "series-econ-gdp",
    name: "National GDP Milestones",
    category: "Economic",
    description: "Rank among the world's leading economies by total GDP.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/willdabeast/gold-bar.svg",
    keys: [
      "econ-first-million",
      "econ-millionaire-nation",
      "econ-economic-powerhouse",
      "econ-trillion-club",
      "econ-global-titan",
    ],
  },
  {
    id: "series-econ-per-capita",
    name: "Citizen Prosperity & GDP/Capita",
    category: "Economic",
    description: "Advance individual citizen wealth and high standard of living.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/greek-temple.svg",
    keys: [
      "econ-wealthy-citizens",
      "econ-prosperity-nation",
      "econ-first-world-status",
      "econ-ultra-prosperity",
    ],
  },
  {
    id: "series-econ-growth",
    name: "Economic Growth & Boom",
    category: "Economic",
    description: "Accelerate annual GDP expansion and economic growth rate.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/growth.svg",
    keys: ["econ-growth-rocket", "econ-boom-cycle"],
  },
  {
    id: "series-mil-branches",
    name: "Military Branches Spectrum",
    category: "Military",
    description: "Establish and diversify national armed forces branches.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/crossed-swords.svg",
    keys: ["mil-first-branch", "mil-armed-forces", "mil-full-spectrum"],
  },
  {
    id: "series-mil-personnel",
    name: "Standing Armed Personnel",
    category: "Military",
    description: "Mobilize and train active standing military personnel.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/meeple-army.svg",
    keys: ["mil-standing-army", "mil-large-force", "mil-massive-force", "mil-global-force"],
  },
  {
    id: "series-mil-budget",
    name: "National Defense Commitment",
    category: "Military",
    description: "Allocate strategic GDP expenditure toward sovereign defense.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/sbed/shield.svg",
    keys: ["mil-defense-commitment", "mil-strong-defense", "mil-military-superpower"],
  },
  {
    id: "series-dip-embassies",
    name: "Global Embassy Network",
    category: "Diplomatic",
    description: "Deploy diplomatic embassies to partner nations worldwide.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/capitol.svg",
    keys: [
      "dip-first-embassy",
      "dip-diplomatic-network",
      "dip-global-presence",
      "dip-embassy-network",
    ],
  },
  {
    id: "series-dip-treaties",
    name: "Bilateral Treaties & Accords",
    category: "Diplomatic",
    description: "Negotiate and ratify bilateral treaties and accords.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/tied-scroll.svg",
    keys: ["dip-first-treaty", "dip-treaty-network"],
  },
  {
    id: "series-dip-trade",
    name: "Trade Partnerships & Hubs",
    category: "Diplomatic",
    description: "Form international trade partnerships and commercial networks.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/trade.svg",
    keys: ["dip-trade-partners", "dip-trade-hub"],
  },
  {
    id: "series-gov-atomic",
    name: "Atomic Governance Architecture",
    category: "Government",
    description: "Configure modular atomic government branches and statecraft systems.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/brick-wall.svg",
    keys: ["gov-first-component", "gov-building-blocks", "gov-sophisticated", "gov-complex-system"],
  },
  {
    id: "series-social-thinkpages",
    name: "ThinkPages Thought Leadership",
    category: "Social",
    description: "Publish insightful articles and analysis on ThinkPages.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/quill.svg",
    keys: ["social-first-thinkpage", "social-thinkpage-author", "social-prolific-author"],
  },
  {
    id: "series-social-influence",
    name: "Public Discourse & Trending",
    category: "Social",
    description: "Gain widespread readership and trending discourse recognition.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/carl-olsen/flame.svg",
    keys: ["social-popular", "social-trending"],
  },
  {
    id: "series-lore-scholar",
    name: "WikiOS Lore & Archives",
    category: "General",
    description: "Archive national history and collect community lore entries.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/spell-book.svg",
    keys: ["lore-scholar", "lore-collector"],
  },
  {
    id: "series-pop-demographics",
    name: "Demographic Expansion",
    category: "General",
    description: "Grow national population from emerging state to global mega-nation.",
    iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/meeple-group.svg",
    keys: ["pop-emerging", "pop-populous", "pop-giant", "pop-mega"],
  },
];

export interface GroupedAchievementItem {
  isSeries: boolean;
  seriesId?: string;
  seriesName?: string;
  category: string;
  iconPath: string;
  levels: any[];
  currentTierIndex: number;
  activeAchievement: any;
  unlockedCount: number;
  totalLevels: number;
  totalSeriesPoints: number;
  earnedPoints: number;
  isComplete: boolean;
  isUnlocked: boolean;
}

/**
 * Groups a flat array of achievements into Series Chains + Standalone achievements
 */
export function groupAchievements(achievements: any[] = []): GroupedAchievementItem[] {
  const achMap = new Map<string, any>(achievements.map((a) => [a.key, a]));
  const usedKeys = new Set<string>();
  const results: GroupedAchievementItem[] = [];

  // 1. Process series
  for (const series of ACHIEVEMENT_SERIES_DEFINITIONS) {
    const seriesAchievements = series.keys
      .map((k) => achMap.get(k))
      .filter((a): a is NonNullable<typeof a> => !!a);

    if (seriesAchievements.length === 0) continue;

    seriesAchievements.forEach((a) => usedKeys.add(a.key));

    const unlockedLevels = seriesAchievements.filter((a) => a.isUnlocked);
    const unlockedCount = unlockedLevels.length;
    const isComplete = unlockedCount === seriesAchievements.length;

    // Highest unlocked level or the first level to work on
    const currentTierIndex =
      unlockedCount > 0 ? Math.min(unlockedCount - 1, seriesAchievements.length - 1) : 0;

    const totalSeriesPoints = seriesAchievements.reduce((s, a) => s + (a.points || 10), 0);
    const earnedPoints = unlockedLevels.reduce((s, a) => s + (a.points || 10), 0);

    results.push({
      isSeries: true,
      seriesId: series.id,
      seriesName: series.name,
      category: series.category,
      iconPath: series.iconPath,
      levels: seriesAchievements,
      currentTierIndex,
      activeAchievement: seriesAchievements[currentTierIndex] || seriesAchievements[0],
      unlockedCount,
      totalLevels: seriesAchievements.length,
      totalSeriesPoints,
      earnedPoints,
      isComplete,
      isUnlocked: unlockedCount > 0,
    });
  }

  // 2. Process standalone achievements
  for (const a of achievements) {
    if (usedKeys.has(a.key)) continue;

    const iconPath = getAchievementGameIconPath(a.key, a.category);

    results.push({
      isSeries: false,
      category: a.category || "General",
      iconPath,
      levels: [a],
      currentTierIndex: 0,
      activeAchievement: a,
      unlockedCount: a.isUnlocked ? 1 : 0,
      totalLevels: 1,
      totalSeriesPoints: a.points || 10,
      earnedPoints: a.isUnlocked ? a.points || 10 : 0,
      isComplete: !!a.isUnlocked,
      isUnlocked: !!a.isUnlocked,
    });
  }

  return results;
}

export interface ForumRibbon {
  id: string;
  title: string;
  category: string;
  stripeGradient: string;
  borderStyle: string;
  badgeLabel: string;
}

export const FORUM_RIBBONS: ForumRibbon[] = [
  {
    id: "wiki-archivist",
    title: "WikiOS Grand Archivist Ribbon",
    category: "Community Wiki",
    stripeGradient: "from-green via-teal to-green",
    borderStyle: "border-green/60",
    badgeLabel: "WIKI",
  },
  {
    id: "forum-pioneer",
    title: "Community Forum Pioneer Ribbon",
    category: "Community Forum",
    stripeGradient: "from-yellow via-yellow to-yellow",
    borderStyle: "border-yellow/60",
    badgeLabel: "FORUM",
  },
  {
    id: "map-cartographer",
    title: "Master Cartographer Ribbon",
    category: "Map & Atlas",
    stripeGradient: "from-blue via-blue to-blue",
    borderStyle: "border-blue/60",
    badgeLabel: "ATLAS",
  },
  {
    id: "community-veteran",
    title: "Community Veteran Commendation",
    category: "Platform Service",
    stripeGradient: "from-purple via-purple to-purple",
    borderStyle: "border-purple/60",
    badgeLabel: "VETERAN",
  },
  {
    id: "lore-historian",
    title: "Grand Lore Historian Order",
    category: "Canon & Lore",
    stripeGradient: "from-red via-pink to-red",
    borderStyle: "border-red/60",
    badgeLabel: "CANON",
  },
];
