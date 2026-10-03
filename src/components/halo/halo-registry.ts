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
} from "iconoir-react";

type CommandCategory =
  "Statecraft" | "Vault" | "Geography" | "Knowledge" | "Community" | "Sports" | "Labs" | "System";

type SystemActionId =
  | "toggle-theme"
  | "toggle-sound"
  | "toggle-compact"
  | "mark-all-read"
  | "reload-data"
  | "random-wiki"
  | "random-country"
  | "sign-out";

interface CommandEntry {
  id?: string;
  name: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: CommandCategory;
  keywords?: string[];
  actionId?: SystemActionId;
}

interface FeatureEntry {
  id?: string;
  name: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: CommandCategory;
  keywords?: string[];
  actionId?: SystemActionId;
}

/** Command catalog for the Halo search palette. */
export const CORE_COMMANDS: CommandEntry[] = [
  // 1. Statecraft & National Governance
  {
    name: "MyCountry overview",
    path: "/mycountry",
    icon: CheckCircle,
    category: "Statecraft",
    description: "Your nation's vitality, key stats and executive summary",
    keywords: ["overview", "executive", "vitality", "stats", "kpi", "government", "president"],
  },
  {
    name: "Executive council and Directives",
    path: "/mycountry/executive",
    icon: CheckCircle,
    category: "Statecraft",
    description: "Issue Directives, executive orders and cabinet meetings",
    keywords: ["directives", "decrees", "orders", "cabinet", "meetings", "executive", "council"],
  },
  {
    name: "Policy editor",
    path: "/mycountry/editor",
    icon: EditPencil,
    category: "Statecraft",
    description: "Edit governance, civic values and state policies",
    keywords: ["edit", "policy", "laws", "constitution", "governance", "sliders", "tuning"],
  },
  {
    name: "Embassies and diplomacy",
    path: "/mycountry/diplomacy",
    icon: Globe,
    category: "Statecraft",
    description: "Manage embassies, pacts and treaties",
    keywords: ["embassy", "treaties", "alliances", "ambassadors", "foreign policy", "diplomacy"],
  },
  {
    name: "Defense and readiness",
    path: "/mycountry/defense",
    icon: Shield,
    category: "Statecraft",
    description: "Force readiness, defense posture and military operations",
    keywords: ["military", "army", "navy", "air force", "war", "defense", "security", "readiness"],
  },
  {
    name: "Intelligence and recon",
    path: "/mycountry/intelligence",
    icon: Compass,
    category: "Statecraft",
    description: "Signals intelligence, economic trends and forecasts",
    keywords: ["intel", "recon", "spy", "signals", "projections", "forecasts", "trends"],
  },
  {
    name: "Fiscal and economic policy",
    path: "/mycountry/economy",
    icon: Coins,
    category: "Statecraft",
    description: "Budget allocation, tax rates and spending",
    keywords: ["economy", "budget", "tax", "spending", "treasury", "revenue", "fiscal"],
  },
  {
    name: "Legislature and elections",
    path: "/mycountry/politics",
    icon: Building,
    category: "Statecraft",
    description: "Parliamentary seats, parties and election cycles",
    keywords: ["politics", "parliament", "congress", "voting", "parties", "elections", "senate"],
  },
  {
    name: "Territory and borders editor",
    path: "/mycountry/map-editor",
    icon: Map,
    category: "Statecraft",
    description: "Draw national boundaries and provincial subdivisions",
    keywords: ["borders", "provinces", "claims", "geometry", "land", "territory", "map edit"],
  },

  // 2. Economy, Cards & IxVault
  {
    name: "IxVault cards",
    path: "/vault/cards",
    icon: MultiplePages,
    category: "Vault",
    description: "Your card binder, inventory and rarity collection",
    keywords: ["cards", "binder", "inventory", "collection", "deck", "tcg"],
  },
  {
    name: "Open card packs",
    path: "/vault/packs",
    icon: Page,
    category: "Vault",
    description: "Open booster packs for collectible lore cards",
    keywords: ["booster", "unbox", "packs", "pull", "gacha", "open cards"],
  },
  {
    name: "Marketplace and auctions",
    path: "/vault/marketplace",
    icon: Shop,
    category: "Vault",
    description: "Buy, sell and bid on cards with credits",
    keywords: ["market", "auction", "trade", "buy", "sell", "credits", "bids"],
  },
  {
    name: "Card crafting",
    path: "/vault/crafting",
    icon: Hammer,
    category: "Vault",
    description: "Combine duplicate cards into a higher-tier card",
    keywords: ["craft", "forge", "combine", "upgrade", "alchemy", "synthesis"],
  },
  {
    name: "Lore card gallery",
    path: "/vault/lore-gallery",
    icon: Palette,
    category: "Vault",
    description: "Illustrated world lore and history",
    keywords: ["art", "illustrations", "lore", "gallery", "cards", "paintings"],
  },
  {
    name: "NationStates deck",
    path: "/vault/ns-deck",
    icon: MultiplePages,
    category: "Vault",
    description: "Your synced NationStates cards and trades",
    keywords: ["ns", "deck", "nationstates", "sync", "cards"],
  },

  // 3. Geography & Atlas
  {
    name: "IxWorld map",
    path: "/maps",
    icon: Compass,
    category: "Geography",
    description: "The interactive world map and territory atlas",
    keywords: ["atlas", "globe", "terrain", "geography", "world", "continents", "map"],
  },
  {
    name: "Explore countries",
    path: "/countries",
    icon: Globe,
    category: "Geography",
    description: "Directory and profiles of every nation",
    keywords: ["browse", "directory", "nations", "search countries", "states", "world"],
  },
  {
    name: "Global leaderboards",
    path: "/leaderboards",
    icon: Trophy,
    category: "Geography",
    description: "World rankings by GDP, population and stability",
    keywords: ["rankings", "leaderboards", "top", "score", "economy", "gdp", "tier"],
  },
  {
    name: "Found a nation",
    path: "/builder",
    icon: Building,
    category: "Geography",
    description: "Start a new nation from a custom or real-world template",
    keywords: ["create", "builder", "found", "new nation", "wizard", "start nation"],
  },

  // 4. Knowledge & WikiOS
  {
    name: "Wiki main page",
    path: "/wiki/Main_Page",
    icon: Book,
    category: "Knowledge",
    description: "The WikiOS knowledge base and articles",
    keywords: ["wiki", "encyclopedia", "articles", "lore", "reading", "docs"],
  },
  {
    name: "Wiki recent changes",
    path: "/wiki/recent-changes",
    icon: Page,
    category: "Knowledge",
    description: "Recent article edits, revisions and lore updates",
    keywords: ["history", "diffs", "edits", "recent", "activity", "log"],
  },
  {
    name: "Random wiki article",
    path: "#random-wiki",
    icon: DiceFive,
    category: "Knowledge",
    actionId: "random-wiki",
    description: "Jump to a random nation or lore article",
    keywords: ["shuffle", "random", "surprise", "dice", "random wiki"],
  },
  {
    name: "Create wiki article",
    path: "/wiki/new",
    icon: EditPencil,
    category: "Knowledge",
    description: "Draft and publish a new article",
    keywords: ["new article", "write", "publish", "author", "compose"],
  },
  {
    name: "Lore stashes",
    path: "/stashes",
    icon: BookmarkBook,
    category: "Knowledge",
    description: "Bookmarks and saved lore collections",
    keywords: ["stashes", "bookmarks", "saved", "reading list", "collections"],
  },

  // 5. Social & Community
  {
    name: "ThinkShare messages",
    path: "/messages",
    icon: MessageText,
    category: "Community",
    description: "Private, diplomatic and forum messages in one inbox",
    keywords: ["dms", "inbox", "mail", "chat", "messages", "conversations"],
  },
  {
    name: "ThinkPages feed",
    path: "/thinkpages",
    icon: RssFeed,
    category: "Community",
    description: "Diplomatic dispatches, public broadcasts and short posts",
    keywords: ["social", "feed", "posts", "dispatches", "broadcasts", "timeline"],
  },
  {
    name: "ThinkTanks",
    path: "/thinktanks",
    icon: User,
    category: "Community",
    description: "Worldbuilding groups and policy working groups",
    keywords: ["thinktanks", "groups", "teams", "collaboration", "alliances"],
  },
  {
    name: "Forum",
    path: "/forum",
    icon: MessageText,
    category: "Community",
    description: "Discussion boards, proposals, roleplay and debates",
    keywords: ["forum", "boards", "threads", "discussions", "debates", "topics"],
  },
  {
    name: "Start forum thread",
    path: "/forum/new-thread",
    icon: EditPencil,
    category: "Community",
    description: "Create a new topic in the forum",
    keywords: ["new thread", "post", "topic", "create thread"],
  },
  {
    name: "Achievements and trophies",
    path: "/achievements",
    icon: Medal,
    category: "Community",
    description: "Milestones, badges and Loreward trophies",
    keywords: ["trophies", "badges", "rewards", "lorewards", "quests", "achievements"],
  },

  // 6. Sports & Simulation
  {
    name: "MyLeague standings and fixtures",
    path: "/myleague",
    icon: SoccerBall,
    category: "Sports",
    description: "League tables, schedules and live matches",
    keywords: ["myleague", "soccer", "football", "sports", "standings", "fixtures", "matches"],
  },
  {
    name: "MyClub squad and roster",
    path: "/myclub",
    icon: BasketballField,
    category: "Sports",
    description: "Manage your squad, tactics and club operations",
    keywords: ["myclub", "team", "squad", "players", "tactics", "club"],
  },

  // 7. Labs & Creative Engines
  {
    name: "Onoma language engine",
    path: "/labs/onoma",
    icon: Book,
    category: "Labs",
    description: "Generate languages, loanwords and names",
    keywords: ["onoma", "language", "names", "linguistics", "phonetics", "words"],
  },
  {
    name: "Vexel flag studio",
    path: "/labs/vexel",
    icon: TriangleFlag,
    category: "Labs",
    description: "Design flags and symbols, export as SVG",
    keywords: ["vexel", "flags", "emblem", "heraldry", "designer", "banner"],
  },
  {
    name: "Map mesh pipeline",
    path: "/labs/map-pipeline",
    icon: Globe,
    category: "Labs",
    description: "Generate Voronoi terrain meshes and inspect spline topology",
    keywords: ["mesh", "voronoi", "pipeline", "terrain", "splines", "map generator"],
  },

  // 8. System & Settings
  {
    name: "Toggle dark or light theme",
    path: "#toggle-theme",
    icon: HalfMoon,
    category: "System",
    actionId: "toggle-theme",
    description: "Switch between dark, light and system appearance",
    keywords: ["theme", "dark mode", "light mode", "appearance", "color"],
  },
  {
    name: "Toggle sound effects",
    path: "#toggle-sound",
    icon: SoundHigh,
    category: "System",
    actionId: "toggle-sound",
    description: "Turn interface sound effects on or off",
    keywords: ["sound", "audio", "sfx", "mute", "unmute", "volume", "chime"],
  },
  {
    name: "Toggle compact layout",
    path: "#toggle-compact",
    icon: LayoutLeft,
    category: "System",
    actionId: "toggle-compact",
    description: "Switch between compact and standard spacing",
    keywords: ["compact", "dense", "layout", "spacing", "mode"],
  },
  {
    name: "Mark all notifications read",
    path: "#mark-all-read",
    icon: CheckCircle,
    category: "System",
    actionId: "mark-all-read",
    description: "Clear all unread notification badges",
    keywords: ["read all", "clear notifications", "dismiss alerts", "inbox clean"],
  },
  {
    name: "Account settings",
    path: "/settings",
    icon: Settings,
    category: "System",
    description: "Manage your profile, sign-in and preferences",
    keywords: ["settings", "account", "profile", "password", "security", "preferences"],
  },
  {
    name: "Changelog",
    path: "/changelog",
    icon: Page,
    category: "System",
    description: "Release notes and version history",
    keywords: ["changelog", "updates", "versions", "release notes", "what's new"],
  },
  {
    name: "Admin panel",
    path: "/admin",
    icon: Shield,
    category: "System",
    description: "Administration, feature flags and CMS tools",
    keywords: ["admin", "cms", "management", "config", "owner", "staff"],
  },
];

/**
 * Feature shortcuts and quick interactive actions.
 */
export const CORE_FEATURES: FeatureEntry[] = [
  {
    name: "Economic dashboard",
    path: "/dashboard",
    icon: Coins,
    category: "Statecraft",
    description: "Economic metrics, GDP per capita and projections",
    keywords: ["economy", "gdp", "vitality", "analytics"],
  },
  {
    name: "Global rankings",
    path: "/leaderboards",
    icon: Trophy,
    category: "Geography",
    description: "Compare countries by economic tier and vitality",
    keywords: ["rankings", "leaderboards", "top"],
  },
  {
    name: "Map viewer",
    path: "/maps",
    icon: Compass,
    category: "Geography",
    description: "Geography and political boundaries",
    keywords: ["maps", "atlas", "globe"],
  },
  {
    name: "Open card packs",
    path: "/vault/packs",
    icon: Page,
    category: "Vault",
    description: "Open booster packs for collectible lore cards",
    keywords: ["packs", "cards", "booster"],
  },
  {
    name: "Refresh data",
    path: "#reload-data",
    icon: RefreshDouble,
    category: "System",
    actionId: "reload-data",
    description: "Reload the latest data",
    keywords: ["refresh", "reload", "sync"],
  },
  {
    name: "Notifications",
    path: "#notifications",
    icon: Compass,
    category: "System",
    description: "Open notifications and the diplomatic inbox",
    keywords: ["notifications", "alerts", "inbox"],
  },
  {
    name: "Search",
    path: "#search",
    icon: Search,
    category: "System",
    description: "Find a country, command or wiki article",
    keywords: ["search", "find", "lookup"],
  },
];
