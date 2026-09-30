/**
 * Help center registry: every article the hub lists, grouped into sections.
 *
 * Each `path` is `/help/<folder>/<slug>` and must match `src/content/help/<folder>/<slug>.md`.
 * An article's folder does not have to match the section it is listed in
 * (e.g. `gameplay/national-issues` is listed under MyCountry). Every article file must be listed
 * exactly once; `src/tests/content/help-center.test.ts` enforces this.
 */

export type HelpSectionIcon =
  | "sparkles"
  | "crown"
  | "trending"
  | "users"
  | "shield"
  | "globe"
  | "book"
  | "coins"
  | "chat"
  | "flask"
  | "settings";

export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  path: string;
  tags: string[];
}

export interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: HelpSectionIcon;
  articles: HelpArticle[];
}

export const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Start Here",
    description: "New to IxStats? Start with these.",
    icon: "sparkles",
    articles: [
      {
        id: "welcome",
        title: "Welcome to IxStats",
        description: "What IxStats is, what you do here, and where to go first.",
        path: "/help/getting-started/welcome",
        tags: ["basics", "intro", "nationstates"],
      },
      {
        id: "first-country",
        title: "Create Your First Nation",
        description: "Build a nation in the Country Builder, import one from a wiki, or claim one.",
        path: "/help/getting-started/first-country",
        tags: ["country", "builder", "claim", "tutorial"],
      },
      {
        id: "country-building",
        title: "The Country Builder in Depth",
        description:
          "Every builder step, Standard vs Advanced mode, wiki import, and editing later.",
        path: "/help/gameplay/country-building",
        tags: ["builder", "components", "import", "editor"],
      },
      {
        id: "gameplay-overview",
        title: "How It All Fits Together",
        description: "The main systems, what each one does, and a good first week.",
        path: "/help/getting-started/gameplay-overview",
        tags: ["basics", "overview"],
      },
      {
        id: "navigation",
        title: "Finding Your Way Around",
        description: "The top menu, the Halo search palette, keyboard shortcuts, and Settings.",
        path: "/help/getting-started/navigation",
        tags: ["menu", "search", "shortcuts", "settings", "halo"],
      },
      {
        id: "ixtime",
        title: "The World Clock (IxTime)",
        description: "The shared world clock runs at twice real speed. What that means for you.",
        path: "/help/getting-started/ixtime",
        tags: ["time", "clock", "basics"],
      },
      {
        id: "ixnayid",
        title: "IxnayID & Your Passport",
        description: "Your account, your public passport, and linking wiki, forum and Discord.",
        path: "/help/getting-started/ixnayid",
        tags: ["account", "passport", "profile", "wiki", "verify"],
      },
      {
        id: "premium",
        title: "MyCountry Premium",
        description: "What Premium unlocks today and how accounts get it.",
        path: "/help/getting-started/premium",
        tags: ["premium", "membership", "defense"],
      },
    ],
  },
  {
    id: "mycountry",
    title: "MyCountry",
    description: "Running your nation day to day.",
    icon: "crown",
    articles: [
      {
        id: "mycountry-overview",
        title: "MyCountry Overview",
        description: "Your nation's home page: vital signs, agenda, and where each section lives.",
        path: "/help/mycountry/overview",
        tags: ["mycountry", "dashboard", "vitality", "overview"],
      },
      {
        id: "executive",
        title: "Executive Directives",
        description: "Declare directives: state a goal, pick a package, and live with the result.",
        path: "/help/mycountry/executive",
        tags: ["directives", "executive", "civcap", "policy"],
      },
      {
        id: "national-issues",
        title: "National Issues",
        description: "Issues that land on your desk, your four ways to respond, and what sticks.",
        path: "/help/gameplay/national-issues",
        tags: ["issues", "decisions", "events", "delegate"],
      },
      {
        id: "mycountry-economy",
        title: "Economy & Budget",
        description: "Economic Report, National Budget, Fiscal Policy and Trade & Commerce.",
        path: "/help/mycountry/economy",
        tags: ["economy", "budget", "taxes", "trade"],
      },
      {
        id: "politics",
        title: "Politics & Elections",
        description: "Cabinet, parties, legislature, bills, power brokers, and elections.",
        path: "/help/mycountry/politics",
        tags: ["politics", "elections", "parties", "legislature", "bills"],
      },
      {
        id: "mycountry-intelligence",
        title: "Intelligence & Insights",
        description: "Where to find analysis of your nation today, and what isn't built yet.",
        path: "/help/mycountry/intelligence",
        tags: ["intelligence", "rankings", "census", "analytics"],
      },
      {
        id: "editor",
        title: "The Country Editor",
        description: "Change your nation's identity, government and economy after launch.",
        path: "/help/mycountry/editor",
        tags: ["editor", "builder", "edit", "identity"],
      },
      {
        id: "map-editor",
        title: "Editing Your Territory",
        description: "Add cities, provinces, landmarks and routes to your nation on the map.",
        path: "/help/mycountry/map-editor",
        tags: ["map", "editor", "cities", "provinces", "routes"],
      },
    ],
  },
  {
    id: "economy-government",
    title: "Economy & Government",
    description: "How your economy grows and how your government is built.",
    icon: "trending",
    articles: [
      {
        id: "tiers",
        title: "Economic Tiers",
        description: "The seven tiers, their GDP-per-person bands, and their growth caps.",
        path: "/help/economy/tiers",
        tags: ["economy", "tiers", "gdp", "growth"],
      },
      {
        id: "calculations",
        title: "How Your Economy Is Calculated",
        description: "How GDP and population move, and which decisions actually change them.",
        path: "/help/economy/calculations",
        tags: ["economy", "formulas", "growth", "gdp", "population"],
      },
      {
        id: "tax-system",
        title: "Taxes & Revenue",
        description: "Setting tax rates in Fiscal Policy and what they affect.",
        path: "/help/economy/tax-system",
        tags: ["taxes", "revenue", "fiscal"],
      },
      {
        id: "trade",
        title: "Trade & Commerce",
        description: "Exports, imports, tariffs, trade agreements, and routes.",
        path: "/help/economy/trade",
        tags: ["trade", "tariffs", "exports"],
      },
      {
        id: "modeling",
        title: "Economic Modeling",
        description: "A what-if sandbox for any country's economy.",
        path: "/help/economy/modeling",
        tags: ["modeling", "projections", "scenarios"],
      },
      {
        id: "atomic",
        title: "Building Your Government",
        description: "Government components, the effectiveness score, and how to choose.",
        path: "/help/government/atomic",
        tags: ["government", "components", "effectiveness"],
      },
      {
        id: "components",
        title: "The Component Catalog",
        description: "The 64 government, 27 economic and 42 tax components, and what they do.",
        path: "/help/government/components",
        tags: ["government", "economy", "components", "catalog"],
      },
      {
        id: "synergy",
        title: "Synergies & Conflicts",
        description: "How component pairs raise or lower your government effectiveness.",
        path: "/help/government/synergy",
        tags: ["synergy", "conflict", "effectiveness"],
      },
      {
        id: "traditional",
        title: "Government Structure & Departments",
        description: "Names and titles, departments, and the government budget.",
        path: "/help/government/traditional",
        tags: ["government", "structure", "departments", "budget"],
      },
    ],
  },
  {
    id: "diplomacy",
    title: "Diplomacy",
    description: "Embassies, relations, alliances, and other nations.",
    icon: "users",
    articles: [
      {
        id: "mycountry-diplomacy",
        title: "Foreign Affairs",
        description: "The Diplomacy section: inbox, embassies, relations, alliances, exchanges.",
        path: "/help/mycountry/diplomacy",
        tags: ["diplomacy", "relations", "alliances", "inbox", "stance"],
      },
      {
        id: "embassies",
        title: "Embassies",
        description: "Open, manage and close embassies, and what they do for you.",
        path: "/help/diplomacy/embassies",
        tags: ["diplomacy", "embassies"],
      },
      {
        id: "cultural",
        title: "Cultural Exchanges",
        description: "Run cultural programs with other nations.",
        path: "/help/diplomacy/cultural",
        tags: ["diplomacy", "cultural", "exchanges"],
      },
      {
        id: "scenarios",
        title: "Diplomatic Events",
        description: "Diplomatic scenarios that ask for your response.",
        path: "/help/diplomacy/scenarios",
        tags: ["diplomacy", "scenarios", "events"],
      },
      {
        id: "npc-personalities",
        title: "NPC Personalities",
        description: "How computer-run nations are characterised, and where that matters today.",
        path: "/help/diplomacy/npc-personalities",
        tags: ["diplomacy", "npc", "personalities"],
      },
    ],
  },
  {
    id: "defense",
    title: "Defense",
    description: "Military, security and stability (Premium).",
    icon: "shield",
    articles: [
      {
        id: "mycountry-defense",
        title: "Defense & Security",
        description: "Branches, threats, forces, operations and internal stability.",
        path: "/help/mycountry/defense",
        tags: ["defense", "military", "premium", "operations"],
      },
      {
        id: "equipment",
        title: "The Equipment Catalog",
        description: "Browse real-world aircraft, ships, vehicles and weapons for your forces.",
        path: "/help/defense/equipment",
        tags: ["defense", "equipment", "military"],
      },
      {
        id: "stability",
        title: "Internal Stability",
        description: "Your stability score, what moves it, and security events.",
        path: "/help/defense/stability",
        tags: ["stability", "security", "unrest"],
      },
    ],
  },
  {
    id: "world",
    title: "The World",
    description: "Maps, realms, other nations, and how the world moves.",
    icon: "globe",
    articles: [
      {
        id: "maps",
        title: "IxMaps: The World Map",
        description: "Explore the globe, switch overlays, and find any nation.",
        path: "/help/world/maps",
        tags: ["maps", "ixmaps", "atlas", "overlays"],
      },
      {
        id: "realms",
        title: "Realms & Claiming a Nation",
        description: "The worlds nations live in, realm boards, and claiming a nation.",
        path: "/help/world/realms",
        tags: ["realms", "claim", "ixworld", "board"],
      },
      {
        id: "countries",
        title: "Exploring Countries",
        description: "Browse nations, read their factbooks, and act on their profiles.",
        path: "/help/world/countries",
        tags: ["countries", "explore", "profile", "factbook"],
      },
      {
        id: "simulation",
        title: "How the World Moves",
        description: "What changes on its own, what only changes when someone acts, and when.",
        path: "/help/gameplay/simulation",
        tags: ["simulation", "world", "updates"],
      },
      {
        id: "world-events",
        title: "Crises & World Events",
        description: "Where crises come from today and how world events affect your economy.",
        path: "/help/gameplay/world-events",
        tags: ["crisis", "events", "storyteller"],
      },
    ],
  },
  {
    id: "wiki",
    title: "Wiki & Lore",
    description: "Reading, writing and saving lore.",
    icon: "book",
    articles: [
      {
        id: "wikios",
        title: "The Wiki (WikiOS)",
        description: "Read, search, edit and discuss wiki articles, and earn Lorewards.",
        path: "/help/wiki/wikios",
        tags: ["wiki", "wikios", "editing", "lorewards"],
      },
      {
        id: "stash",
        title: "Stash",
        description: "Save wiki pages, quotes and forum threads into collections.",
        path: "/help/wiki/stash",
        tags: ["stash", "bookmarks", "reading list"],
      },
    ],
  },
  {
    id: "vault",
    title: "Vault, Cards & Rewards",
    description: "IxCredits, cards, achievements and rankings.",
    icon: "coins",
    articles: [
      {
        id: "vault-overview",
        title: "Your Vault",
        description: "Your IxCredits, level, daily reward and card collection.",
        path: "/help/vault/overview",
        tags: ["vault", "cards", "daily reward"],
      },
      {
        id: "ixcredits",
        title: "IxCredits",
        description: "Every way to earn and spend IxCredits, with the daily caps.",
        path: "/help/vault/ixcredits",
        tags: ["ixcredits", "earning", "daily reward", "caps"],
      },
      {
        id: "card-packs",
        title: "Card Packs",
        description: "Buying packs in the Vault Shop and opening them.",
        path: "/help/vault/card-packs",
        tags: ["packs", "cards", "shop"],
      },
      {
        id: "trading",
        title: "Auctions & Trading",
        description: "Auction cards, bid, buy outright, and trade directly with players.",
        path: "/help/vault/trading",
        tags: ["auctions", "trading", "marketplace"],
      },
      {
        id: "lore-cards",
        title: "Lore Cards",
        description: "Cards made from wiki articles, and requesting a new one.",
        path: "/help/vault/lore-cards",
        tags: ["lore", "wiki", "cards"],
      },
      {
        id: "ns-import",
        title: "Importing NationStates Cards",
        description: "Bring your NationStates deck into your Vault.",
        path: "/help/vault/ns-import",
        tags: ["nationstates", "import", "deck", "cards"],
      },
      {
        id: "achievements",
        title: "Achievements & Ribbons",
        description: "How achievements unlock, what they pay, and ribbons on your passport.",
        path: "/help/gameplay/achievements",
        tags: ["achievements", "ribbons", "rewards"],
      },
      {
        id: "leaderboards",
        title: "Leaderboards",
        description: "Rank nations by GDP, population, achievements and more.",
        path: "/help/gameplay/leaderboards",
        tags: ["leaderboards", "rankings"],
      },
    ],
  },
  {
    id: "community",
    title: "Community",
    description: "Posting, messaging, groups and the forum.",
    icon: "chat",
    articles: [
      {
        id: "thinkpages",
        title: "ThinkPages & the Feed",
        description: "Post to the feed as yourself or a persona, follow, react, and use hashtags.",
        path: "/help/social/thinkpages",
        tags: ["thinkpages", "feed", "posts", "personas", "blurbs"],
      },
      {
        id: "thinkshare",
        title: "Messages",
        description: "Direct and group messages in one inbox.",
        path: "/help/social/thinkshare",
        tags: ["messages", "thinkshare", "dm", "chat"],
      },
      {
        id: "thinktanks",
        title: "ThinkTanks",
        description: "Groups with a shared feed, members, docs and chat.",
        path: "/help/social/thinktanks",
        tags: ["thinktanks", "groups", "collaboration"],
      },
      {
        id: "forum",
        title: "The Forum",
        description: "Read and post in the community forum, and link your forum account.",
        path: "/help/social/forum",
        tags: ["forum", "threads", "discussion"],
      },
    ],
  },
  {
    id: "labs",
    title: "Labs",
    description: "Experimental tools and sports.",
    icon: "flask",
    articles: [
      {
        id: "labs-overview",
        title: "Labs: Onoma, MyLeague & More",
        description: "The experimental tools: language generation, sports leagues, flags.",
        path: "/help/labs/overview",
        tags: ["labs", "onoma", "myleague", "myclub", "vexel"],
      },
    ],
  },
  {
    id: "admin",
    title: "For Admins",
    description: "Tools for the people who run the platform.",
    icon: "settings",
    articles: [
      {
        id: "cms-overview",
        title: "The Admin Console",
        description: "What each admin area does, and who can reach it.",
        path: "/help/admin/cms-overview",
        tags: ["admin", "console", "roles"],
      },
      {
        id: "reference-data",
        title: "Reference Data",
        description: "Editing the catalogs everyone builds with.",
        path: "/help/admin/reference-data",
        tags: ["admin", "catalog", "components", "equipment"],
      },
    ],
  },
];

/**
 * Articles that were removed or merged, and where their readers go now. The article route
 * redirects these paths so old links keep working.
 */
export const retiredHelpArticles: Record<string, string> = {
  "diplomacy/missions": "/help/diplomacy/embassies",
  "defense/overview": "/help/mycountry/defense",
  "defense/units": "/help/mycountry/defense",
  "defense/customization": "/help/mycountry/defense",
  "defense/crisis-events": "/help/gameplay/world-events",
  "intelligence/alerts": "/help/mycountry/intelligence",
  "intelligence/dashboard": "/help/mycountry/intelligence",
  "intelligence/executive-operations": "/help/mycountry/intelligence",
  "intelligence/forecasting": "/help/mycountry/intelligence",
  "intelligence/metrics": "/help/mycountry/intelligence",
  "intelligence/strategic-intelligence": "/help/mycountry/intelligence",
  "intelligence/unified-overview": "/help/mycountry/intelligence",
};

/** Case-insensitive match on title, description, tags and section title. */
export function filterHelpSections(
  sections: HelpSection[],
  query: string,
  sectionId: string
): HelpSection[] {
  const scoped = sectionId === "all" ? sections : sections.filter((s) => s.id === sectionId);
  const q = query.trim().toLowerCase();
  if (!q) return scoped;
  return scoped
    .map((section) => {
      const sectionMatches = section.title.toLowerCase().includes(q);
      return {
        ...section,
        articles: sectionMatches
          ? section.articles
          : section.articles.filter(
              (article) =>
                article.title.toLowerCase().includes(q) ||
                article.description.toLowerCase().includes(q) ||
                article.tags.some((tag) => tag.toLowerCase().includes(q))
            ),
      };
    })
    .filter((section) => section.articles.length > 0);
}
