import {
  BookmarkBook,
  Building,
  CheckCircle,
  Coins,
  DiceFive,
  EditPencil,
  Globe,
  HalfMoon,
  LayoutLeft,
  Map as MapIcon,
  Shield,
  Shop,
  SoundHigh,
} from "iconoir-react";
import type { CommandCategory, CommandEntry } from "~/components/halo/halo-registry";
import { MYCOUNTRY_MAP_EDITOR_PATH } from "~/lib/mycountry/routes";
import {
  getVisibleApps,
  withCountryRows,
  type AppDefinition,
  type AppVisibilityContext,
} from "~/lib/navigation/app-sections";
import { newThreadHref } from "~/lib/thinkpages-forum/links";

export type AppVisibilityInput = AppVisibilityContext & {
  countryHref?: string;
};

type AppId = AppDefinition["id"];

export interface NavCommandMeta {
  name?: string;
  description: string;
  category?: CommandCategory;
  keywords?: string[];
  pathOverride?: string;
}

const APP_DEFAULT_CATEGORY: Record<AppId, CommandCategory> = {
  home: "Community",
  mycountry: "Statecraft",
  maps: "Geography",
  vault: "Vault",
  wiki: "Knowledge",
  thinkpages: "Community",
  countries: "Geography",
  labs: "Labs",
  help: "System",
  admin: "System",
  settings: "System",
};

/**
 * Side metadata keyed by `app:<appId>` or `<appId>:<sectionId>`.
 * Keeps search prose and keywords out of the 885-line `app-sections.ts` table while letting any
 * newly added sidebar app or section surface automatically with sensible defaults.
 */
export const NAV_COMMAND_META: Readonly<Record<string, NavCommandMeta>> = {
  "home:dashboard": {
    name: "Home",
    description: "Diplomatic dispatches, public broadcasts and short posts",
    keywords: ["social", "feed", "posts", "dispatches", "broadcasts", "timeline"],
  },
  "home:messages": {
    name: "Messages",
    description: "Private, diplomatic and forum messages in one inbox",
    keywords: ["dms", "inbox", "mail", "chat", "messages", "conversations"],
  },
  "app:mycountry": {
    name: "MyCountry overview",
    description: "Your nation's vitality, key stats and executive summary",
    keywords: ["overview", "executive", "vitality", "stats", "kpi", "government", "president"],
  },
  "mycountry:public-profile": {
    name: "My nation's public profile",
    category: "Statecraft",
    description: "Your nation's public dossier and statistics",
    keywords: ["profile", "dossier", "public", "nation"],
  },
  "mycountry:editor": {
    name: "Country editor",
    description: "Rename your nation and edit its flag, symbols, government and size",
    keywords: [
      "edit",
      "rename",
      "name",
      "flag",
      "symbols",
      "identity",
      "capital",
      "language",
      "government",
      "institutions",
      "population",
    ],
  },
  "app:maps": {
    name: "World map",
    description: "The interactive world map and territory atlas",
    keywords: ["atlas", "globe", "terrain", "geography", "world", "continents", "map"],
  },
  "vault:dashboard": {
    name: "Wallet",
    description: "Your IxC balance and Vault activity",
    keywords: ["wallet", "balance", "credits", "ixc", "funds", "vault"],
  },
  "vault:store": {
    name: "Store and card packs",
    description: "Buy and open card packs in the Store",
    keywords: ["booster", "unbox", "packs", "pull", "gacha", "open cards", "store"],
  },
  "vault:achievements": {
    name: "Achievements and trophies",
    description: "Milestones, badges and Loreward trophies",
    keywords: ["trophies", "badges", "rewards", "lorewards", "quests", "achievements"],
  },
  "vault:lorewards": {
    name: "Lorewards",
    description: "Loreward trophies and their progress",
    keywords: ["lorewards", "trophies", "rewards", "lore", "progress", "medals"],
  },
  "vault:leaderboards": {
    name: "Leaderboards",
    category: "Geography",
    description: "Rankings of a realm's nations by GDP, population and stability",
    keywords: ["rankings", "leaderboards", "top", "score", "economy", "gdp", "tier", "global"],
  },
  "vault:cards-mine": {
    name: "My cards",
    description: "Your cards, showcases and the card market",
    keywords: ["cards", "mine", "showcase", "binder", "inventory", "collection", "deck", "tcg"],
  },
  "vault:cards-sets": {
    name: "Card sets",
    description: "Your card sets and how far each one is complete",
    keywords: ["sets", "album", "complete", "completion", "collection", "binder"],
  },
  "vault:cards-market": {
    name: "Card market",
    description: "Bid on, sell and trade cards",
    keywords: ["market", "auction", "trade", "buy", "sell", "credits", "bids"],
  },
  "vault:cards-explore": {
    name: "Explore cards",
    description: "Every realm's cards, collected or not",
    keywords: ["explore", "gallery", "lore", "cards", "realms", "catalogue"],
  },
  "vault:cards-import": {
    name: "Import NationStates cards",
    description: "Import the cards of a NationStates nation you own",
    keywords: ["ns", "deck", "nationstates", "import", "cards"],
  },
  "wiki:main": {
    name: "Wiki main page",
    pathOverride: "/wiki/Main_Page",
    description: "The Wiki knowledge base and articles",
    keywords: ["wiki", "encyclopedia", "articles", "lore", "reading", "docs"],
  },
  "wiki:search": {
    name: "Search the wiki",
    description: "Find articles and pages across the wiki",
    keywords: ["search wiki", "find article", "lookup", "articles", "search", "find page"],
  },
  "wiki:recent-changes": {
    name: "Wiki recent changes",
    description: "Recent article edits, revisions and lore updates",
    keywords: ["history", "diffs", "edits", "recent", "activity", "log"],
  },
  "wiki:categories": {
    name: "Wiki categories",
    description: "Browse the wiki's article categories",
    keywords: ["categories", "topics", "tags", "browse", "sections"],
  },
  "wiki:repository": {
    name: "Wiki repository",
    description: "Files, media and other shared wiki resources",
    keywords: ["repository", "files", "media", "uploads", "images", "resources"],
  },
  "wiki:stash": {
    name: "Stash",
    description: "Bookmarks and saved lore collections",
    keywords: ["stashes", "bookmarks", "saved", "reading list", "collections"],
  },
  "wiki:lorewards": {
    name: "Wiki Lorewards",
    description: "Loreward trophies earned through wiki contributions",
    keywords: ["wiki lorewards", "lore", "writing", "trophies"],
  },
  "wiki:utilities": {
    name: "Wiki utilities",
    description: "Special pages, contributor tools and wiki maintenance",
    keywords: ["utilities", "special pages", "tools", "wiki"],
  },
  "thinkpages:forums": {
    name: "ThinkPages",
    description: "The forum: sitewide boards and a section for every realm",
    keywords: ["forum", "boards", "threads", "discussions", "thinkpages", "debates", "topics"],
  },
  "thinkpages:thinktanks": {
    name: "ThinkTanks",
    description: "Worldbuilding groups and policy working groups",
    keywords: ["thinktanks", "groups", "teams", "collaboration", "alliances"],
  },
  "thinkpages:accounts": {
    name: "Accounts",
    description: "Your personas: government, media and citizen accounts",
    keywords: ["personas", "accounts", "post as"],
  },
  "thinkpages:moderation": {
    name: "Forum moderation",
    description: "Review reports and moderate forum threads",
    keywords: ["moderation", "reports", "mod", "forum"],
  },
  "countries:my-realm": {
    name: "My realm",
    description: "Your realm's nations",
    keywords: ["browse", "directory", "nations", "search countries", "states", "world", "realm"],
  },
  "countries:explore": {
    name: "Explore realms",
    description: "Browse every realm and what it holds",
    keywords: ["realms", "explore", "browse", "regions", "worlds", "realm list"],
  },
  "labs:onoma": {
    name: "Onoma language engine",
    description: "Generate languages, loanwords and names",
    keywords: ["onoma", "language", "names", "linguistics", "phonetics", "words"],
  },
  "labs:vexel": {
    name: "Vexel flag studio",
    description: "Design flags and symbols, export as SVG",
    keywords: ["vexel", "flags", "emblem", "heraldry", "designer", "banner"],
  },
  "labs:exchange": {
    name: "Exchange",
    description: "Companies, tenders, treasuries and the market",
    keywords: ["exchange", "companies", "tenders", "treasury", "trade", "business"],
  },
  "labs:myleague": {
    name: "MyLeague standings and fixtures",
    category: "Sports",
    description: "League tables, schedules and live matches",
    keywords: ["myleague", "soccer", "football", "sports", "standings", "fixtures", "matches"],
  },
  "labs:myclub": {
    name: "MyClub squad and roster",
    category: "Sports",
    description: "Manage your squad, tactics and club operations",
    keywords: ["myclub", "team", "squad", "players", "tactics", "club"],
  },
  "app:help": {
    name: "Help",
    description: "Guides and answers to common questions",
    keywords: ["help", "guide", "support", "faq", "how to", "docs"],
  },
  "help:changelog": {
    name: "Changelog",
    description: "Release notes and version history",
    keywords: ["changelog", "updates", "versions", "release notes", "what's new"],
  },
  "app:settings": {
    name: "Account settings",
    description: "Manage your profile, sign-in and preferences",
    keywords: ["settings", "account", "profile", "password", "security", "preferences"],
  },
  "admin:overview": {
    name: "Admin panel",
    description: "Administration, feature flags and CMS tools",
    keywords: ["admin", "cms", "management", "config", "owner", "staff"],
  },
};

export interface ScopedExtraCommand extends CommandEntry {
  /** When set, included only if this sidebar app is visible to the viewer. */
  parentAppId?: AppId;
}

/**
 * Hand-written commands that have no row in `APPS`: MyCountry's command-ribbon sections,
 * in-app deep links, and client-side system actions.
 */
export const EXTRA_HALO_COMMANDS: readonly ScopedExtraCommand[] = [
  // MyCountry command-ribbon sections (`APPS` leaves `mycountry.sections` empty)
  {
    name: "Executive and Directives",
    path: "/mycountry/executive",
    parentAppId: "mycountry",
    icon: CheckCircle,
    category: "Statecraft",
    description: "Issue Directives and executive orders",
    keywords: ["directives", "decrees", "orders", "executive", "council"],
  },
  {
    name: "Country editor",
    path: "/mycountry/editor",
    parentAppId: "mycountry",
    icon: EditPencil,
    category: "Statecraft",
    description: "Rename your nation and edit its flag, symbols, government and size",
    keywords: [
      "edit",
      "rename",
      "name",
      "flag",
      "symbols",
      "identity",
      "capital",
      "language",
      "government",
      "institutions",
      "population",
    ],
  },
  {
    name: "Embassies and diplomacy",
    path: "/mycountry/diplomacy",
    parentAppId: "mycountry",
    icon: Globe,
    category: "Statecraft",
    description: "Manage embassies, pacts and treaties",
    keywords: ["embassy", "treaties", "alliances", "ambassadors", "foreign policy", "diplomacy"],
  },
  {
    name: "Defense and readiness",
    path: "/mycountry/defense",
    parentAppId: "mycountry",
    icon: Shield,
    category: "Statecraft",
    description: "Force readiness, defense posture and military operations",
    keywords: [
      "military",
      "army",
      "navy",
      "air force",
      "war",
      "defense",
      "security",
      "readiness",
      "intel",
      "recon",
      "spy",
      "signals",
    ],
  },
  {
    name: "Fiscal and economic policy",
    path: "/mycountry/economy",
    parentAppId: "mycountry",
    icon: Coins,
    category: "Statecraft",
    description: "Budget allocation, tax rates and spending",
    keywords: ["economy", "budget", "tax", "spending", "treasury", "revenue", "fiscal"],
  },
  {
    name: "Legislature and elections",
    path: "/mycountry/politics",
    parentAppId: "mycountry",
    icon: Building,
    category: "Statecraft",
    description: "Parliamentary seats, parties and election cycles",
    keywords: ["politics", "parliament", "congress", "voting", "parties", "elections", "senate"],
  },
  {
    name: "Territory and borders editor",
    path: MYCOUNTRY_MAP_EDITOR_PATH,
    parentAppId: "mycountry",
    icon: MapIcon,
    category: "Statecraft",
    description: "Draw national boundaries and provincial subdivisions",
    keywords: ["borders", "provinces", "claims", "geometry", "land", "territory", "map edit"],
  },

  // In-app / flow deep links not listed as top-level sidebar rows
  {
    name: "Found a nation",
    path: "/builder",
    icon: Building,
    category: "Geography",
    description: "Choose a kind of nation, name it and found it",
    keywords: ["create", "builder", "found", "new nation", "wizard", "start nation"],
  },
  {
    name: "Create wiki article",
    path: "/wiki?create=true",
    parentAppId: "wiki",
    icon: EditPencil,
    category: "Knowledge",
    description: "Draft and publish a new article",
    keywords: ["new article", "write", "publish", "author", "compose"],
  },
  {
    name: "Saved posts",
    path: "/dashboard/saved",
    parentAppId: "home",
    icon: BookmarkBook,
    category: "Community",
    description: "Feed posts you bookmarked",
    keywords: ["saved", "bookmarks", "posts"],
  },
  {
    name: "Start forum thread",
    path: newThreadHref({ key: "general" }),
    parentAppId: "thinkpages",
    icon: EditPencil,
    category: "Community",
    description: "Create a new topic in the forum",
    keywords: ["new thread", "post", "topic", "create thread"],
  },
  {
    name: "Exchange markets",
    path: "/exchange/markets",
    parentAppId: "labs",
    icon: Shop,
    category: "Labs",
    description: "Prices and listings on the exchange",
    keywords: ["markets", "prices", "listings", "exchange", "trading"],
  },
  {
    name: "Exchange portfolio",
    path: "/exchange/portfolio",
    parentAppId: "labs",
    icon: Coins,
    category: "Labs",
    description: "Your holdings on the exchange",
    keywords: ["portfolio", "holdings", "stakes", "investments", "exchange"],
  },

  // System actions (non-route actions executed by Halo)
  {
    name: "Random country",
    path: "#random-country",
    icon: DiceFive,
    category: "Geography",
    actionId: "random-country",
    description: "Open a random nation's profile",
    keywords: ["random", "surprise", "nation"],
  },
  {
    name: "Random wiki article",
    path: "#random-wiki",
    parentAppId: "wiki",
    icon: DiceFive,
    category: "Knowledge",
    actionId: "random-wiki",
    description: "Jump to a random nation or lore article",
    keywords: ["shuffle", "random", "surprise", "dice", "random wiki"],
  },
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
];

type Section = AppDefinition["sections"][number];

function buildAppRootEntry(app: AppDefinition): CommandEntry {
  const meta = NAV_COMMAND_META[`app:${app.id}`];
  return {
    name: meta?.name ?? app.label,
    path: meta?.pathOverride ?? app.href,
    icon: app.icon,
    category: meta?.category ?? APP_DEFAULT_CATEGORY[app.id],
    description: meta?.description ?? `Open ${app.label}`,
    keywords: meta?.keywords ?? [app.label.toLowerCase()],
    adminOnly: app.adminOnly,
  };
}

function buildSectionEntry(app: AppDefinition, section: Section): CommandEntry {
  const meta = NAV_COMMAND_META[`${app.id}:${section.id}`];
  const fallbackName =
    app.id === "settings" || app.id === "admin"
      ? `${app.label}: ${section.label}`
      : section.label;
  const fallbackDescription = section.group
    ? `${app.label} · ${section.group}`
    : `Open ${section.label} in ${app.label}`;
  return {
    name: meta?.name ?? fallbackName,
    path: meta?.pathOverride ?? section.href,
    icon: section.icon,
    category: meta?.category ?? APP_DEFAULT_CATEGORY[app.id],
    description: meta?.description ?? fallbackDescription,
    keywords: meta?.keywords ?? [
      app.label.toLowerCase(),
      section.label.toLowerCase(),
      ...(section.group ? [section.group.toLowerCase()] : []),
    ],
    adminOnly: app.adminOnly || section.requires === "admin" || undefined,
  };
}

function shouldSkipSection(app: AppDefinition, section: Section, hasAppRoot: boolean): boolean {
  if (section.action || section.conditional || section.external) return true;
  // Default query-tab section (e.g. `/settings?tab=account`) duplicates its parent app root (`/settings`).
  if (section.isDefault && hasAppRoot && section.href.split("?")[0] === app.href) return true;
  return false;
}

/**
 * Derives Halo command entries from already-resolved visible `AppDefinition`s (`getVisibleApps`),
 * merged with `EXTRA_HALO_COMMANDS` scoped to the visible apps and deduplicated by destination path.
 */
export function commandsFromVisibleApps(
  visibleApps: readonly AppDefinition[],
  options: { includeExtras?: boolean } = {}
): CommandEntry[] {
  const { includeExtras = true } = options;
  const entries: CommandEntry[] = [];
  const seenPaths = new Set<string>();
  const visibleIds = new Set<AppId>(visibleApps.map((app) => app.id));

  const pushUnique = (entry: CommandEntry) => {
    const dedupeKey = entry.actionId ? `action:${entry.actionId}` : entry.path ?? entry.name;
    if (seenPaths.has(dedupeKey)) return;
    seenPaths.add(dedupeKey);
    entries.push(entry);
  };

  for (const app of visibleApps) {
    const rootSharesSectionHref = app.sections.some(
      (s) => !s.action && !s.conditional && !s.external && s.href === app.href
    );
    if (!app.inline && !rootSharesSectionHref) {
      pushUnique(buildAppRootEntry(app));
    }

    for (const section of app.sections) {
      if (shouldSkipSection(app, section, !rootSharesSectionHref && !app.inline)) continue;
      const entry = buildSectionEntry(app, section);
      if (section.href === app.href && seenPaths.has(app.href)) continue;
      pushUnique(entry);
    }
  }

  if (includeExtras) {
    for (const extra of EXTRA_HALO_COMMANDS) {
      if (extra.parentAppId && !visibleIds.has(extra.parentAppId)) continue;
      const { parentAppId: _parentAppId, ...command } = extra;
      pushUnique(command);
    }
  }

  return entries;
}

/**
 * Derives Halo command entries from the sidebar's `getVisibleApps` + `withCountryRows` model.
 */
export function commandsFromApps(viewer: AppVisibilityInput): CommandEntry[] {
  const visible = withCountryRows(getVisibleApps(viewer), viewer.countryHref);
  return commandsFromVisibleApps(visible);
}
