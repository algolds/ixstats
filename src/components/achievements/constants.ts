import {
  Airplane,
  Archive,
  Bank,
  Bell,
  Book,
  Bookmark,
  Building,
  Calendar,
  Camera,
  Car,
  Cart,
  Check,
  ChatBubble,
  City,
  Clock,
  Cloud,
  Code,
  Coins,
  Community,
  Compass,
  Cpu,
  Crown,
  Cube,
  Database,
  Dollar,
  Edit,
  EditPencil,
  Eye,
  Flare,
  Flash,
  Folder,
  Gamepad,
  Gift,
  Globe,
  GraphUp,
  Group,
  Hammer,
  Heart,
  Hexagon,
  Home,
  Hospital,
  Hourglass,
  Infinite,
  Journal,
  Key,
  Language,
  Leaf,
  LightBulb,
  Link,
  Lock,
  Mail,
  Map as MapIcon,
  MapPin,
  MediaImage,
  Medal,
  Megaphone,
  Network,
  Notes,
  OpenBook,
  Package,
  Page,
  PageEdit,
  Palette,
  Percentage,
  Pin,
  Podcast,
  Puzzle,
  Rocket,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparks,
  StatDown,
  StatUp,
  Star,
  Timer,
  Trophy,
  Truck,
  User,
  UserCircle,
  Wallet,
  WarningTriangle,
  Wrench,
} from "iconoir-react";
import type { BadgeVariant } from "~/components/ui/badge";
import type { FacetAccent } from "~/lib/design/identity";
import { ACHIEVEMENT_ICON_KEYS, type IconKey } from "~/lib/achievements/icons";

type IconComponent = React.ComponentType<{ className?: string }>;

/**
 * Every achievement icon: the key a definition names (`Achievement.iconUrl`) to its iconoir
 * component. Typed over `ACHIEVEMENT_ICON_KEYS`, so a key without a component fails to compile.
 */
export const ACHIEVEMENT_ICON_MAP: Record<IconKey, IconComponent> = {
  Airplane,
  Archive,
  Bank,
  Bell,
  Book,
  Bookmark,
  Building,
  Calendar,
  Camera,
  Car,
  Cart,
  Check,
  ChatBubble,
  City,
  Clock,
  Cloud,
  Code,
  Coins,
  Community,
  Compass,
  Cpu,
  Crown,
  Cube,
  Database,
  Dollar,
  Edit,
  EditPencil,
  Eye,
  Flare,
  Flash,
  Folder,
  Gamepad,
  Gift,
  Globe,
  GraphUp,
  Group,
  Hammer,
  Heart,
  Hexagon,
  Home,
  Hospital,
  Hourglass,
  Infinite,
  Journal,
  Key,
  Language,
  Leaf,
  LightBulb,
  Link,
  Lock,
  Mail,
  Map: MapIcon,
  MapPin,
  MediaImage,
  Medal,
  Megaphone,
  Network,
  Notes,
  OpenBook,
  Package,
  Page,
  PageEdit,
  Palette,
  Percentage,
  Pin,
  Podcast,
  Puzzle,
  Rocket,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparks,
  StatDown,
  StatUp,
  Star,
  Timer,
  Trophy,
  Truck,
  User,
  UserCircle,
  Wallet,
  WarningTriangle,
  Wrench,
};

const isIconKey = (key: string): key is IconKey =>
  (ACHIEVEMENT_ICON_KEYS as readonly string[]).includes(key);

/**
 * Per-category styling: a system colour carries the category on its badge and icon pedestal, and
 * drives the card's aurora (`accent` / `accent2`). All are system colour roles, so they follow the theme.
 */
export interface CategoryTheme {
  name: string;
  icon: IconComponent;
  /** Category chip: a system-colour `Badge` variant (AA ink on a 15% fill). */
  badgeVariant: BadgeVariant;
  /** Icon pedestal: a 15% wash of the category colour; the icon inherits its text colour. */
  pedestal: string;
  cardBorderHover: string;
  /**
   * Category accent: the aurora colour of `AchievementCardBackdrop`.
   */
  accent: FacetAccent;
  /** The aurora's secondary hue. */
  accent2: FacetAccent;
}

/** Tailwind needs the class names written out, so each colour's classes are listed here. */
const TONES = {
  green: {
    badgeVariant: "success",
    pedestal: "bg-green/15 text-green",
    cardBorderHover: "hover:border-green/40",
  },
  red: {
    badgeVariant: "destructive",
    pedestal: "bg-red/15 text-red",
    cardBorderHover: "hover:border-red/40",
  },
  teal: {
    badgeVariant: "info",
    pedestal: "bg-teal/15 text-teal",
    cardBorderHover: "hover:border-teal/40",
  },
  indigo: {
    badgeVariant: "secondary",
    pedestal: "bg-indigo/15 text-indigo",
    cardBorderHover: "hover:border-indigo/40",
  },
  blue: {
    badgeVariant: "info",
    pedestal: "bg-blue/15 text-blue",
    cardBorderHover: "hover:border-blue/40",
  },
  yellow: {
    badgeVariant: "warning",
    pedestal: "bg-yellow/15 text-yellow",
    cardBorderHover: "hover:border-yellow/40",
  },
  orange: {
    badgeVariant: "warning",
    pedestal: "bg-orange/15 text-orange",
    cardBorderHover: "hover:border-orange/40",
  },
  purple: {
    badgeVariant: "secondary",
    pedestal: "bg-purple/15 text-purple",
    cardBorderHover: "hover:border-purple/40",
  },
  pink: {
    badgeVariant: "default",
    pedestal: "bg-pink/15 text-pink",
    cardBorderHover: "hover:border-pink/40",
  },
  mint: {
    badgeVariant: "success",
    pedestal: "bg-mint/15 text-mint",
    cardBorderHover: "hover:border-mint/40",
  },
} as const satisfies Record<
  string,
  Pick<CategoryTheme, "badgeVariant" | "pedestal" | "cardBorderHover">
>;

function theme(
  name: string,
  icon: IconComponent,
  tone: keyof typeof TONES,
  accent2: FacetAccent
): CategoryTheme {
  return { name, icon, ...TONES[tone], accent: tone, accent2 };
}

const CATEGORY_THEME_MAP: Record<string, CategoryTheme> = {
  Executive: theme("Executive", Flash, "orange", "yellow"),
  Politics: theme("Politics", Bank, "indigo", "cyan"),
  Diplomacy: theme("Diplomacy", Globe, "teal", "blue"),
  Defense: theme("Defense", Shield, "red", "yellow"),
  Nation: theme("Nation", MapIcon, "green", "yellow"),
  Social: theme("Social", OpenBook, "blue", "cyan"),
  Wiki: theme("Wiki", Page, "purple", "blue"),
  Cards: theme("Cards", Archive, "pink", "orange"),
  Lorewards: theme("Lorewards", Medal, "mint", "yellow"),
  General: theme("General", Trophy, "yellow", "orange"),
  // Categories of retired achievements: Legacy unlocks keep the category they were earned under
  Economic: theme("Economic", StatUp, "green", "yellow"),
  Military: theme("Military", Shield, "red", "yellow"),
  Diplomatic: theme("Diplomatic", Globe, "teal", "blue"),
  Government: theme("Government", Bank, "indigo", "cyan"),
};

export function getCategoryTheme(category?: string): CategoryTheme {
  if (category && CATEGORY_THEME_MAP[category]) {
    return CATEGORY_THEME_MAP[category];
  }
  return CATEGORY_THEME_MAP.General;
}

/** The icon component for an achievement's icon key; the category's icon when the key is unknown (old emoji rows). */
export function getAchievementIcon(iconKey: string | null | undefined, category?: string) {
  return iconKey && isIconKey(iconKey)
    ? ACHIEVEMENT_ICON_MAP[iconKey]
    : getCategoryTheme(category).icon;
}

export const rarities = ["all", "Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
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
  if (!isUnlocked) return "default";
  switch (rarity) {
    case "Legendary":
      return "warning";
    case "Epic":
      return "secondary";
    case "Ultra Rare":
    case "ULTRA_RARE":
      return "info";
    case "Rare":
      return "info";
    case "Uncommon":
      return "success";
    default:
      return "default";
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
 * Multi-level achievement progression series: the tiers of a ladder shown as one card.
 */
interface AchievementSeriesConfig {
  id: string;
  name: string;
  category: string;
  icon: IconKey;
  keys: string[];
}

const ACHIEVEMENT_SERIES_DEFINITIONS: AchievementSeriesConfig[] = [
  {
    id: "series-social-thinkpages",
    name: "ThinkPages Thought Leadership",
    category: "Social",
    icon: "EditPencil",
    keys: ["social-first-thinkpage", "social-thinkpage-author", "social-prolific-author"],
  },
  {
    id: "series-social-influence",
    name: "Public Discourse & Trending",
    category: "Social",
    icon: "Flare",
    keys: ["social-popular", "social-trending"],
  },
  {
    id: "series-lore-scholar",
    name: "WikiOS Lore & Archives",
    category: "Social",
    icon: "Book",
    keys: ["lore-scholar", "lore-collector"],
  },
];

/** A row of `achievements.getAllWithStatus`, as far as the cards read it. */
export interface AchievementItem {
  key: string;
  title: string;
  description: string;
  category: string;
  rarity: string;
  points: number;
  /** The icon key (`ACHIEVEMENT_ICON_KEYS`); old rows may still hold an emoji. */
  iconUrl?: string | null;
  isUnlocked: boolean;
  unlockedAt: string | null;
  /** Retired: shown greyed, counted in no total. */
  isLegacy?: boolean;
  globalUnlockPercent?: number;
  /** JSON (a string) or the parsed object; Order of the Lore medals carry `{ count }`. */
  metadata?: string | { count?: number } | null;
}

export interface GroupedAchievementItem {
  isSeries: boolean;
  seriesId?: string;
  seriesName?: string;
  category: string;
  icon: IconComponent;
  levels: AchievementItem[];
  currentTierIndex: number;
  activeAchievement: AchievementItem;
  unlockedCount: number;
  totalLevels: number;
  totalSeriesPoints: number;
  earnedPoints: number;
  isComplete: boolean;
  isUnlocked: boolean;
  isLegacy: boolean;
}

/**
 * Groups a flat array of achievements into series chains + standalone achievements. Legacy
 * achievements are always standalone, so a series only ever holds active tiers.
 */
export function groupAchievements(achievements: AchievementItem[] = []): GroupedAchievementItem[] {
  const achMap = new Map<string, AchievementItem>(
    achievements.filter((a) => !a.isLegacy).map((a) => [a.key, a])
  );
  const usedKeys = new Set<string>();
  const results: GroupedAchievementItem[] = [];

  // 1. Process series
  for (const series of ACHIEVEMENT_SERIES_DEFINITIONS) {
    const seriesAchievements = series.keys
      .map((k) => achMap.get(k))
      .filter((a): a is AchievementItem => !!a);

    if (seriesAchievements.length === 0) continue;

    seriesAchievements.forEach((a) => usedKeys.add(a.key));

    const unlockedLevels = seriesAchievements.filter((a) => a.isUnlocked);
    const unlockedCount = unlockedLevels.length;
    const isComplete = unlockedCount === seriesAchievements.length;

    // Highest unlocked level or the first level to work on
    const currentTierIndex =
      unlockedCount > 0 ? Math.min(unlockedCount - 1, seriesAchievements.length - 1) : 0;

    const totalSeriesPoints = seriesAchievements.reduce((s, a) => s + (a.points ?? 0), 0);
    const earnedPoints = unlockedLevels.reduce((s, a) => s + (a.points ?? 0), 0);

    results.push({
      isSeries: true,
      seriesId: series.id,
      seriesName: series.name,
      category: series.category,
      icon: getAchievementIcon(series.icon, series.category),
      levels: seriesAchievements,
      currentTierIndex,
      activeAchievement: seriesAchievements[currentTierIndex] ?? seriesAchievements[0]!,
      unlockedCount,
      totalLevels: seriesAchievements.length,
      totalSeriesPoints,
      earnedPoints,
      isComplete,
      isUnlocked: unlockedCount > 0,
      isLegacy: false,
    });
  }

  // 2. Process standalone achievements
  for (const a of achievements) {
    if (usedKeys.has(a.key)) continue;

    results.push({
      isSeries: false,
      category: a.category || "General",
      icon: getAchievementIcon(a.iconUrl, a.category),
      levels: [a],
      currentTierIndex: 0,
      activeAchievement: a,
      unlockedCount: a.isUnlocked ? 1 : 0,
      totalLevels: 1,
      totalSeriesPoints: a.points ?? 0,
      earnedPoints: a.isUnlocked ? (a.points ?? 0) : 0,
      isComplete: !!a.isUnlocked,
      isUnlocked: !!a.isUnlocked,
      isLegacy: !!a.isLegacy,
    });
  }

  // Legacy last
  return [...results.filter((r) => !r.isLegacy), ...results.filter((r) => r.isLegacy)];
}
