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
    badgeColor: "bg-red-500/10 text-red-655 dark:text-red-400 border-red-500/20",
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
    badgeColor: "bg-pink-500/10 text-pink-655 dark:text-pink-400 border-pink-500/20",
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

export const categories = [
  { id: "all", name: "All Categories", icon: Star },
  { id: "Economic", name: "Economic", icon: TrendingUp },
  { id: "Diplomatic", name: "Diplomatic", icon: Globe },
  { id: "Government", name: "Government", icon: Landmark },
  { id: "Military", name: "Military", icon: Shield },
  { id: "Social", name: "Social", icon: BookOpen },
  { id: "General", name: "General", icon: Trophy },
];

export const rarities = ["all", "Common", "Uncommon", "Rare", "Epic", "Legendary"];

export const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case "Legendary":
      return "text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "Epic":
      return "text-purple-600 dark:text-purple-400 border-purple-500/30";
    case "Rare":
      return "text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "Uncommon":
      return "text-green-600 dark:text-green-400 border-green-500/30";
    default:
      return "text-muted-foreground border-border/50 dark:border-white/10";
  }
};

export const getRarityBg = (rarity: string, isUnlocked = true) => {
  if (!isUnlocked) return "bg-muted/50 border-border dark:bg-black/40 dark:border-white/5";
  switch (rarity) {
    case "Legendary":
      return "bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/5";
    case "Epic":
      return "bg-purple-500/10 border-purple-500/20 dark:bg-purple-500/5";
    case "Rare":
      return "bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/5";
    case "Uncommon":
      return "bg-green-500/10 border-green-500/20 dark:bg-green-500/5";
    default:
      return "bg-muted border-border/50 dark:bg-white/5 dark:border-white/10";
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
      return "silver";
    default:
      return "bronze";
  }
};

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


