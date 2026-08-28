import {
  Compass,
  Search,
  Globe,
  Settings,
  Book,
  Page,
  EditPencil,
  MessageText,
  RssFeed,
  HalfMoon,
  SoundHigh,
  LayoutLeft,
  CheckCircle,
  RefreshDouble,
  Palette,
  User,
  Shield,
  MultiplePages,
  Shop,
  Hammer,
  Map,
  Trophy,
  Medal,
  SoccerBall,
  BasketballField,
  Building,
  Coins,
  BookmarkBook,
  DiceFive,
  TriangleFlag,
  Flask,
} from "iconoir-react";

export type CommandCategory =
  "Statecraft" | "Vault" | "Geography" | "Knowledge" | "Community" | "Sports" | "Labs" | "System";

export type SystemActionId =
  | "toggle-theme"
  | "toggle-sound"
  | "toggle-compact"
  | "mark-all-read"
  | "reload-data"
  | "random-wiki"
  | "random-country";

export interface CommandEntry {
  id?: string;
  name: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: CommandCategory;
  keywords?: string[];
  actionId?: SystemActionId;
}

export interface FeatureEntry {
  id?: string;
  name: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: CommandCategory;
  keywords?: string[];
  actionId?: SystemActionId;
}

/**
 * Comprehensive platform command catalog for the Halo search palette.
 * Covers all executive statecraft, vault trading cards, geography, wiki, community,
 * sports leagues, labs, and interactive system shortcuts.
 */
export const CORE_COMMANDS: CommandEntry[] = [
  // ─── 1. Statecraft & National Governance ──────────────────────────────────
  {
    name: "MyCountry Command Center",
    path: "/mycountry",
    icon: CheckCircle,
    category: "Statecraft",
    description: "National executive command overview, vitality, and KPIs",
    keywords: ["overview", "executive", "vitality", "stats", "kpi", "government", "president"],
  },
  {
    name: "Executive Council & Directives",
    path: "/mycountry/executive",
    icon: CheckCircle,
    category: "Statecraft",
    description: "Issue national directives, executive orders, and cabinet meetings",
    keywords: ["directives", "decrees", "orders", "cabinet", "meetings", "executive", "council"],
  },
  {
    name: "National Policy Studio",
    path: "/mycountry/editor",
    icon: EditPencil,
    category: "Statecraft",
    description: "Tune national governance, civic values, and state policies",
    keywords: ["edit", "policy", "laws", "constitution", "governance", "sliders", "tuning"],
  },
  {
    name: "Diplomatic Missions & Embassies",
    path: "/mycountry/diplomacy",
    icon: Globe,
    category: "Statecraft",
    description: "Manage embassy network, diplomatic pacts, and treaties",
    keywords: ["embassy", "treaties", "alliances", "ambassadors", "foreign policy", "diplomacy"],
  },
  {
    name: "National Defense & Readiness",
    path: "/mycountry/defense",
    icon: Shield,
    category: "Statecraft",
    description: "Force readiness, defense posture, and military operations",
    keywords: ["military", "army", "navy", "air force", "war", "defense", "security", "readiness"],
  },
  {
    name: "Strategic Intelligence & Recon",
    path: "/mycountry/intelligence",
    icon: Compass,
    category: "Statecraft",
    description: "Signals intelligence, economic trends, and predictive forecasting",
    keywords: ["intel", "recon", "spy", "signals", "projections", "forecasts", "trends"],
  },
  {
    name: "Fiscal & Economic Policy",
    path: "/mycountry/economy",
    icon: Coins,
    category: "Statecraft",
    description: "National budget allocation, tax rates, and spending levers",
    keywords: ["economy", "budget", "tax", "spending", "treasury", "revenue", "fiscal"],
  },
  {
    name: "National Legislature & Elections",
    path: "/mycountry/politics",
    icon: Building,
    category: "Statecraft",
    description: "Parliamentary seats, political parties, and election cycles",
    keywords: ["politics", "parliament", "congress", "voting", "parties", "elections", "senate"],
  },
  {
    name: "Territory & Borders Map Editor",
    path: "/mycountry/map-editor",
    icon: Map,
    category: "Statecraft",
    description: "Draw national boundary claims and provincial subdivisions",
    keywords: ["borders", "provinces", "claims", "geometry", "land", "territory", "map edit"],
  },

  // ─── 2. Economy, Cards & IxVault ──────────────────────────────────────────
  {
    name: "IxVault Trading Cards",
    path: "/vault/cards",
    icon: MultiplePages,
    category: "Vault",
    description: "Card binder, player inventory, and rarity collection",
    keywords: ["cards", "binder", "inventory", "collection", "deck", "tcg"],
  },
  {
    name: "Open Card Packs",
    path: "/vault/packs",
    icon: Page,
    category: "Vault",
    description: "Open booster packs and unbox collectible lore cards",
    keywords: ["booster", "unbox", "packs", "pull", "gacha", "open cards"],
  },
  {
    name: "Marketplace & Auctions",
    path: "/vault/marketplace",
    icon: Shop,
    category: "Vault",
    description: "Buy, sell, and bid on collectible cards with credits",
    keywords: ["market", "auction", "trade", "buy", "sell", "credits", "bids"],
  },
  {
    name: "Card Crafting & Synthesis",
    path: "/vault/crafting",
    icon: Hammer,
    category: "Vault",
    description: "Combine duplicate cards to synthesize higher tier cards",
    keywords: ["craft", "forge", "combine", "upgrade", "alchemy", "synthesis"],
  },
  {
    name: "Lore Card Gallery",
    path: "/vault/lore-gallery",
    icon: Palette,
    category: "Vault",
    description: "Canonical illustrated world lore and history archive",
    keywords: ["art", "illustrations", "lore", "gallery", "cards", "paintings"],
  },
  {
    name: "NationStates NS Deck",
    path: "/vault/ns-deck",
    icon: MultiplePages,
    category: "Vault",
    description: "NationStates synced card collection and trading roster",
    keywords: ["ns", "deck", "nationstates", "sync", "cards"],
  },

  // ─── 3. Geography & Atlas ────────────────────────────────────────────────
  {
    name: "IxWorld Interactive Map",
    path: "/maps",
    icon: Compass,
    category: "Geography",
    description: "Vector spline procedural world map and territory atlas",
    keywords: ["atlas", "globe", "terrain", "geography", "world", "continents", "map"],
  },
  {
    name: "Explore Countries",
    path: "/countries",
    icon: Globe,
    category: "Geography",
    description: "Directory and comparative profiles of all recognized nations",
    keywords: ["browse", "directory", "nations", "search countries", "states", "world"],
  },
  {
    name: "Global Leaderboards",
    path: "/leaderboards",
    icon: Trophy,
    category: "Geography",
    description: "World rankings across GDP, population, and stability",
    keywords: ["rankings", "leaderboards", "top", "score", "economy", "gdp", "tier"],
  },
  {
    name: "Found Nation Builder",
    path: "/builder",
    icon: Building,
    category: "Geography",
    description: "Found a new nation from custom or real-world templates",
    keywords: ["create", "builder", "found", "new nation", "wizard", "start nation"],
  },

  // ─── 4. Knowledge & WikiOS ────────────────────────────────────────────────
  {
    name: "Wiki Main Page",
    path: "/wiki/Main_Page",
    icon: Book,
    category: "Knowledge",
    description: "WikiOS community knowledge base and encyclopedic articles",
    keywords: ["wiki", "encyclopedia", "articles", "lore", "reading", "docs"],
  },
  {
    name: "Wiki Recent Changes",
    path: "/wiki/recent-changes",
    icon: Page,
    category: "Knowledge",
    description: "Real-time feed of article edits, revisions, and lore updates",
    keywords: ["history", "diffs", "edits", "recent", "activity", "log"],
  },
  {
    name: "Random Wiki Article",
    path: "#random-wiki",
    icon: DiceFive,
    category: "Knowledge",
    actionId: "random-wiki",
    description: "Jump to a random nation or lore article",
    keywords: ["shuffle", "random", "surprise", "dice", "random wiki"],
  },
  {
    name: "Create Wiki Article",
    path: "/wiki/new",
    icon: EditPencil,
    category: "Knowledge",
    description: "Draft and publish a new encyclopedic article",
    keywords: ["new article", "write", "publish", "author", "compose"],
  },
  {
    name: "Lore Stashes",
    path: "/stashes",
    icon: BookmarkBook,
    category: "Knowledge",
    description: "Curated bookmarks and saved lore collections",
    keywords: ["stashes", "bookmarks", "saved", "reading list", "collections"],
  },

  // ─── 5. Social & Community ────────────────────────────────────────────────
  {
    name: "ThinkShare Messages",
    path: "/messages",
    icon: MessageText,
    category: "Community",
    description: "Unified messaging across private, diplomatic, and forum channels",
    keywords: ["dms", "inbox", "mail", "chat", "messages", "conversations"],
  },
  {
    name: "ThinkPages Social Feed",
    path: "/thinkpages",
    icon: RssFeed,
    category: "Community",
    description: "Diplomatic dispatches, public broadcasts, and microblogs",
    keywords: ["social", "feed", "posts", "dispatches", "broadcasts", "timeline"],
  },
  {
    name: "ThinkTanks Working Groups",
    path: "/thinktanks",
    icon: User,
    category: "Community",
    description: "Collaborative worldbuilding groups and policy working tables",
    keywords: ["thinktanks", "groups", "teams", "collaboration", "alliances"],
  },
  {
    name: "Community Forum",
    path: "/forum",
    icon: MessageText,
    category: "Community",
    description: "Discussion boards, proposals, roleplay, and community debates",
    keywords: ["forum", "boards", "threads", "discussions", "debates", "topics"],
  },
  {
    name: "Start Forum Thread",
    path: "/forum/new-thread",
    icon: EditPencil,
    category: "Community",
    description: "Create a new discussion topic in the forum",
    keywords: ["new thread", "post", "topic", "create thread"],
  },
  {
    name: "Achievements & Trophies",
    path: "/achievements",
    icon: Medal,
    category: "Community",
    description: "Milestones, badges, and Loreward progression trophies",
    keywords: ["trophies", "badges", "rewards", "lorewards", "quests", "achievements"],
  },

  // ─── 6. Sports & Simulation ───────────────────────────────────────────────
  {
    name: "MyLeague Standings & Fixtures",
    path: "/myleague",
    icon: SoccerBall,
    category: "Sports",
    description: "Simulated sports league tables, schedules, and live traces",
    keywords: ["myleague", "soccer", "football", "sports", "standings", "fixtures", "matches"],
  },
  {
    name: "MyClub Squad & Roster",
    path: "/myclub",
    icon: BasketballField,
    category: "Sports",
    description: "Manage club squad roster, tactics, and club operations",
    keywords: ["myclub", "team", "squad", "players", "tactics", "club"],
  },

  // ─── 7. Labs & Creative Engines ───────────────────────────────────────────
  {
    name: "Onoma Linguistic Engine",
    path: "/labs/onoma",
    icon: Book,
    category: "Labs",
    description: "Procedural language synthesis, loanwords, and naming generator",
    keywords: ["onoma", "language", "names", "linguistics", "phonetics", "words"],
  },
  {
    name: "Vexel Flag Studio",
    path: "/labs/vexel",
    icon: TriangleFlag,
    category: "Labs",
    description: "Procedural vector flag designer, symbols, and SVG export",
    keywords: ["vexel", "flags", "emblem", "heraldry", "designer", "banner"],
  },
  {
    name: "Map Mesh Pipeline",
    path: "/labs/map-pipeline",
    icon: Globe,
    category: "Labs",
    description: "Voronoi terrain mesh generator and spline topology inspector",
    keywords: ["mesh", "voronoi", "pipeline", "terrain", "splines", "map generator"],
  },
  {
    name: "Simulation Sandbox",
    path: "/labs/sandbox",
    icon: Flask,
    category: "Labs",
    description: "Isolated sandbox to test economic dynamics and formulas",
    keywords: ["sandbox", "test", "experiment", "sim", "model", "lab"],
  },
  {
    name: "Facet Design Bible",
    path: "/labs/design-bible",
    icon: LayoutLeft,
    category: "Labs",
    description: "UI component showcase and glass physics design system",
    keywords: ["design", "facet", "tokens", "components", "bible", "ui"],
  },

  // ─── 8. System & Settings ─────────────────────────────────────────────────
  {
    name: "Toggle Dark/Light Theme",
    path: "#toggle-theme",
    icon: HalfMoon,
    category: "System",
    actionId: "toggle-theme",
    description: "Switch between dark, light, and system theme appearance",
    keywords: ["theme", "dark mode", "light mode", "appearance", "color"],
  },
  {
    name: "Toggle Audio & Sound Effects",
    path: "#toggle-sound",
    icon: SoundHigh,
    category: "System",
    actionId: "toggle-sound",
    description: "Turn Cuelume interaction sound effects on or off",
    keywords: ["sound", "audio", "sfx", "mute", "unmute", "volume", "chime"],
  },
  {
    name: "Toggle Compact Layout",
    path: "#toggle-compact",
    icon: LayoutLeft,
    category: "System",
    actionId: "toggle-compact",
    description: "Switch between dense and standard interface spacing",
    keywords: ["compact", "dense", "layout", "spacing", "mode"],
  },
  {
    name: "Mark All Notifications Read",
    path: "#mark-all-read",
    icon: CheckCircle,
    category: "System",
    actionId: "mark-all-read",
    description: "Clear all unread notification badges and alert counters",
    keywords: ["read all", "clear notifications", "dismiss alerts", "inbox clean"],
  },
  {
    name: "Account Settings",
    path: "/settings",
    icon: Settings,
    category: "System",
    description: "Manage your profile, authentication, and preferences",
    keywords: ["settings", "account", "profile", "password", "security", "preferences"],
  },
  {
    name: "Platform Changelog",
    path: "/changelog",
    icon: Page,
    category: "System",
    description: "Platform release notes, capability logs, and version history",
    keywords: ["changelog", "updates", "versions", "release notes", "what's new"],
  },
  {
    name: "Admin Panel",
    path: "/admin",
    icon: Shield,
    category: "System",
    description: "Platform administration, feature flags, and CMS tools",
    keywords: ["admin", "cms", "management", "config", "owner", "staff"],
  },
];

/**
 * Feature shortcuts and quick interactive actions.
 */
export const CORE_FEATURES: FeatureEntry[] = [
  {
    name: "Economic Dashboard",
    path: "/dashboard",
    icon: Coins,
    category: "Statecraft",
    description: "Macroeconomic metrics, GDP per capita, and projections",
    keywords: ["economy", "gdp", "vitality", "analytics"],
  },
  {
    name: "Global Rankings",
    path: "/leaderboards",
    icon: Trophy,
    category: "Geography",
    description: "Compare countries by economic tier and vitality",
    keywords: ["rankings", "leaderboards", "top"],
  },
  {
    name: "Interactive Map Viewer",
    path: "/maps",
    icon: Compass,
    category: "Geography",
    description: "Vector spline geography and political boundaries",
    keywords: ["maps", "atlas", "globe"],
  },
  {
    name: "Open Card Packs",
    path: "/vault/packs",
    icon: Page,
    category: "Vault",
    description: "Open booster packs and unbox collectible lore cards",
    keywords: ["packs", "cards", "booster"],
  },
  {
    name: "Sync Latest Data",
    path: "#reload-data",
    icon: RefreshDouble,
    category: "System",
    actionId: "reload-data",
    description: "Reload and synchronize the latest platform telemetry",
    keywords: ["refresh", "reload", "sync"],
  },
  {
    name: "Alert Center",
    path: "#notifications",
    icon: Compass,
    category: "System",
    description: "Open notifications and diplomatic inbox tray",
    keywords: ["notifications", "alerts", "inbox"],
  },
  {
    name: "Global Search",
    path: "#search",
    icon: Search,
    category: "System",
    description: "Locate any country, command, or wiki article",
    keywords: ["search", "find", "lookup"],
  },
];
