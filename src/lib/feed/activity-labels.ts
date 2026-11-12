import {
  WarningTriangle as AlertTriangle,
  Globe,
  Bank as Landmark,
  Map as MapIcon,
  RssFeed as Rss,
  Shield,
  StatUp as TrendingUp,
  Trophy,
  Group as Users,
  ChatBubble as MessageCircle,
  ClipboardCheck,
} from "iconoir-react";

/** `app` scopes the badge to that app's tint (`data-app`), so an app's items wear the app's colour. */
export interface FeedBadge {
  icon: typeof Rss;
  color: string;
  bg: string;
  label: string;
  app?: string;
}

export interface ActivityLabelInput {
  type?: string;
  category?: string;
  content?: {
    title?: string;
    metadata?: {
      category?: string;
    } | null;
  } | null;
}

const BLUE = { color: "text-blue", bg: "bg-blue/10" };
const GREEN = { color: "text-green", bg: "bg-green/10" };
const RED = { color: "text-red", bg: "bg-red/10" };
const tintOf = (app: string) => ({ color: "text-tint", bg: "bg-tint-fill", app });

export const SOURCE_CONFIG: Record<string, FeedBadge> = {
  activity: { icon: Rss, ...BLUE, label: "Activity" },
  thinkpages: { icon: Users, ...tintOf("thinkpages"), label: "Social" },
  forum: { icon: MessageCircle, ...tintOf("thinkpages"), label: "Forum" },
};

/** First match wins: an activity type, a category or a keyword in the title. */
export const ACTIVITY_RULES: (FeedBadge & {
  types?: string[];
  cats?: string[];
  words: string[];
})[] = [
  // A directive is named by its activity type; its title is the player's own goal text, so words never apply.
  {
    label: "Directive",
    icon: ClipboardCheck,
    ...tintOf("mycountry"),
    types: ["directive"],
    words: [],
  },
  // Before domain keyword rules so unlock titles mentioning trade, cities or embassies stay Achievements.
  {
    label: "Achievement",
    icon: Trophy,
    color: "text-yellow",
    bg: "bg-yellow/10",
    types: ["achievement"],
    cats: ["achievement"],
    words: ["tier", "achieve"],
  },
  { label: "POI", icon: MapIcon, ...tintOf("maps"), words: ["point of interest", "poi"] },
  { label: "City", icon: MapIcon, ...tintOf("maps"), words: ["city", "settlement"] },
  {
    label: "Subdivision",
    icon: MapIcon,
    ...tintOf("maps"),
    words: ["subdivision", "province", "state", "region"],
  },
  { label: "Maps", icon: MapIcon, ...tintOf("maps"), cats: ["map"], words: ["map", "claim"] },
  {
    label: "Economy",
    icon: TrendingUp,
    ...GREEN,
    cats: ["economic"],
    words: ["gdp", "econom", "trade"],
  },
  {
    label: "Diplomacy",
    icon: Globe,
    color: "text-teal",
    bg: "bg-teal/10",
    cats: ["diplomatic"],
    words: ["embassy", "diplom", "treaty"],
  },
  {
    label: "Defense",
    icon: Shield,
    ...RED,
    cats: ["military"],
    words: ["military", "defense", "deploy"],
  },
  {
    label: "Politics",
    icon: Landmark,
    color: "text-indigo",
    bg: "bg-indigo/10",
    cats: ["political", "government"],
    words: ["govern", "politic", "election"],
  },
  { label: "Crisis", icon: AlertTriangle, ...RED, cats: ["crisis"], words: ["crisis"] },
];

export function getActivityLabel(activity: ActivityLabelInput): FeedBadge {
  const cat = activity.category ?? activity.content?.metadata?.category ?? "";
  const title = (activity.content?.title ?? "").toLowerCase();
  const rule = ACTIVITY_RULES.find(
    (r) =>
      r.types?.includes(activity.type ?? "") ||
      r.cats?.includes(cat) ||
      r.words.some((word) => title.includes(word))
  );
  return rule ?? SOURCE_CONFIG.activity!;
}
