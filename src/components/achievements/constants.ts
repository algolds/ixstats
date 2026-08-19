import {
  Trophy,
  Star,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Medal,
  Crown,
  Sparkles,
  TrendingUp,
  Shield,
  Landmark,
  BookOpen,
  Globe,
} from "lucide-react";

export const QUEST_PATHS = [
  {
    name: "Merchant Path",
    description: "Build a massive national economy and GDP",
    icon: TrendingUp,
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    glowColor: "shadow-emerald-500/20 shadow-lg",
    lineColor: "bg-emerald-500/30",
    activeLineColor: "bg-emerald-500",
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
    badgeColor: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    glowColor: "shadow-yellow-500/20 shadow-lg",
    lineColor: "bg-yellow-500/30",
    activeLineColor: "bg-yellow-500",
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
    badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    glowColor: "shadow-red-500/20 shadow-lg",
    lineColor: "bg-red-500/30",
    activeLineColor: "bg-red-500",
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
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    glowColor: "shadow-blue-500/20 shadow-lg",
    lineColor: "bg-blue-500/30",
    activeLineColor: "bg-blue-500",
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
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    glowColor: "shadow-purple-500/20 shadow-lg",
    lineColor: "bg-purple-500/30",
    activeLineColor: "bg-purple-500",
    nodeColor: "purple",
    keys: ["gov-first-component", "gov-building-blocks", "gov-sophisticated", "gov-complex-system"],
  },
  {
    name: "Thinker Path",
    description: "Influence public discourse on ThinkPages",
    icon: BookOpen,
    badgeColor: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    glowColor: "shadow-pink-500/20 shadow-lg",
    lineColor: "bg-pink-500/30",
    activeLineColor: "bg-pink-500",
    nodeColor: "pink",
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
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    glowColor: "shadow-amber-500/20 shadow-lg",
    lineColor: "bg-amber-500/30",
    activeLineColor: "bg-amber-500",
    nodeColor: "yellow",
    keys: ["vid-lightswitch", "vid-annual", "vid-end-of-days"],
  },
  {
    name: "Lore & Meme Path",
    description: "Nostalgic community jokes, stonks, and wiki archives",
    icon: Trophy,
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    glowColor: "shadow-indigo-500/20 shadow-lg",
    lineColor: "bg-indigo-500/30",
    activeLineColor: "bg-indigo-500",
    nodeColor: "purple",
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

export interface CategoryTheme {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  pedestal: string;
  cardGlow: string;
  cardBorderHover: string;
  accentColor: string;
  iconGradient: string;
  auroraGradient: string;
}

export const CATEGORY_THEME_MAP: Record<string, CategoryTheme> = {
  Economic: {
    name: "Economic",
    icon: TrendingUp,
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    pedestal:
      "border-emerald-500/30 bg-gradient-to-b from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    cardGlow: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    cardBorderHover: "hover:border-emerald-500/40",
    accentColor: "emerald",
    iconGradient: "from-amber-300 via-yellow-100 to-amber-500",
    auroraGradient: "from-emerald-500/15 via-amber-500/10 to-transparent",
  },
  Military: {
    name: "Military",
    icon: Shield,
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
    pedestal:
      "border-rose-500/30 bg-gradient-to-b from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400",
    cardGlow: "from-rose-500/10 via-rose-500/5 to-transparent",
    cardBorderHover: "hover:border-rose-500/40",
    accentColor: "rose",
    iconGradient: "from-rose-300 via-orange-200 to-rose-600",
    auroraGradient: "from-rose-500/15 via-amber-500/10 to-transparent",
  },
  Diplomatic: {
    name: "Diplomatic",
    icon: Globe,
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
    pedestal:
      "border-sky-500/30 bg-gradient-to-b from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400",
    cardGlow: "from-sky-500/10 via-sky-500/5 to-transparent",
    cardBorderHover: "hover:border-sky-500/40",
    accentColor: "sky",
    iconGradient: "from-sky-300 via-cyan-100 to-blue-500",
    auroraGradient: "from-sky-500/15 via-blue-500/10 to-transparent",
  },
  Government: {
    name: "Government",
    icon: Landmark,
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25",
    pedestal:
      "border-purple-500/30 bg-gradient-to-b from-purple-500/15 to-purple-500/5 text-purple-600 dark:text-purple-400",
    cardGlow: "from-purple-500/10 via-purple-500/5 to-transparent",
    cardBorderHover: "hover:border-purple-500/40",
    accentColor: "purple",
    iconGradient: "from-purple-300 via-fuchsia-100 to-indigo-500",
    auroraGradient: "from-purple-500/15 via-indigo-500/10 to-transparent",
  },
  Social: {
    name: "Social",
    icon: BookOpen,
    badge: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/25",
    pedestal:
      "border-pink-500/30 bg-gradient-to-b from-pink-500/15 to-pink-500/5 text-pink-600 dark:text-pink-400",
    cardGlow: "from-pink-500/10 via-pink-500/5 to-transparent",
    cardBorderHover: "hover:border-pink-500/40",
    accentColor: "pink",
    iconGradient: "from-pink-300 via-rose-100 to-pink-500",
    auroraGradient: "from-pink-500/15 via-purple-500/10 to-transparent",
  },
  General: {
    name: "General",
    icon: Trophy,
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    pedestal:
      "border-amber-500/30 bg-gradient-to-b from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
    cardGlow: "from-amber-500/10 via-amber-500/5 to-transparent",
    cardBorderHover: "hover:border-amber-500/40",
    accentColor: "amber",
    iconGradient: "from-amber-300 via-yellow-100 to-amber-500",
    auroraGradient: "from-amber-500/15 via-purple-500/10 to-transparent",
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
      return "text-amber-500 dark:text-amber-400 border-amber-500/30";
    case "Epic":
      return "text-purple-600 dark:text-purple-400 border-purple-500/30";
    case "Ultra Rare":
    case "ULTRA_RARE":
      return "text-cyan-600 dark:text-cyan-400 border-cyan-500/30";
    case "Rare":
      return "text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "Uncommon":
      return "text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    default:
      return "text-muted-foreground border-border/60";
  }
};

export const getRarityBg = (rarity: string, isUnlocked = true) => {
  if (!isUnlocked) return "bg-muted/30 border-border/40 text-muted-foreground/60";
  switch (rarity) {
    case "Legendary":
      return "bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/15";
    case "Epic":
      return "bg-purple-500/10 border-purple-500/30 dark:bg-purple-500/15";
    case "Ultra Rare":
    case "ULTRA_RARE":
      return "bg-cyan-500/10 border-cyan-500/30 dark:bg-cyan-500/15";
    case "Rare":
      return "bg-blue-500/10 border-blue-500/30 dark:bg-blue-500/15";
    case "Uncommon":
      return "bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-500/15";
    default:
      return "bg-muted/50 border-border/50";
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
  "econ-millionaire-nation": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/money-stack.svg",
  "econ-economic-powerhouse": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/bank.svg",
  "econ-trillion-club": "/icons/game-icons/icons/ffffff/transparent/1x1/willdabeast/gold-bar.svg",
  "econ-global-titan": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/crown.svg",

  // Economic GDP Per Capita Series
  "econ-wealthy-citizens": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/buy-card.svg",
  "econ-prosperity-nation": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/greek-temple.svg",
  "econ-first-world-status": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/sparkles.svg",
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
  "mil-armed-forces": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/spartan-helmet.svg",
  "mil-full-spectrum": "/icons/game-icons/icons/ffffff/transparent/1x1/sbed/shield.svg",

  // Military Defense Spending
  "mil-defense-commitment": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/police-officer-head.svg",
  "mil-strong-defense": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/castle.svg",
  "mil-military-superpower": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/lightning-branches.svg",

  // Military Personnel
  "mil-standing-army": "/icons/game-icons/icons/ffffff/transparent/1x1/skoll/rank-3.svg",
  "mil-large-force": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/meeple-army.svg",
  "mil-massive-force": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/tank.svg",
  "mil-global-force": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/jet-fighter.svg",

  // Diplomatic Embassies
  "dip-first-embassy": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/capitol.svg",
  "dip-diplomatic-network": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/globe.svg",
  "dip-global-presence": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/treasure-map.svg",
  "dip-embassy-network": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/greek-temple.svg",

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
  "gov-complex-system": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/gear-stick-pattern.svg",

  // Social & Thinkpages
  "social-first-thinkpage": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/quill.svg",
  "social-thinkpage-author": "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/book-cover.svg",
  "social-prolific-author": "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/bookshelf.svg",
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
    keys: [
      "gov-first-component",
      "gov-building-blocks",
      "gov-sophisticated",
      "gov-complex-system",
    ],
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
    stripeGradient: "from-emerald-700 via-teal-400 to-emerald-700",
    borderStyle: "border-emerald-300/60 shadow-emerald-500/30",
    badgeLabel: "WIKI",
  },
  {
    id: "forum-pioneer",
    title: "Community Forum Pioneer Ribbon",
    category: "Community Forum",
    stripeGradient: "from-amber-600 via-yellow-400 to-amber-600",
    borderStyle: "border-amber-300/60 shadow-amber-500/30",
    badgeLabel: "FORUM",
  },
  {
    id: "map-cartographer",
    title: "Master Cartographer Ribbon",
    category: "Map & Atlas",
    stripeGradient: "from-blue-700 via-sky-400 to-blue-700",
    borderStyle: "border-sky-300/60 shadow-sky-500/30",
    badgeLabel: "ATLAS",
  },
  {
    id: "community-veteran",
    title: "Community Veteran Commendation",
    category: "Platform Service",
    stripeGradient: "from-purple-700 via-fuchsia-400 to-purple-700",
    borderStyle: "border-purple-300/60 shadow-purple-500/30",
    badgeLabel: "VETERAN",
  },
  {
    id: "lore-historian",
    title: "Grand Lore Historian Order",
    category: "Canon & Lore",
    stripeGradient: "from-rose-700 via-pink-400 to-rose-700",
    borderStyle: "border-rose-300/60 shadow-rose-500/30",
    badgeLabel: "CANON",
  },
];

