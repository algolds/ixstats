/**
 * App section map for the Facet 3 navigation shell (spec §7.4, Phase 3).
 *
 * One list of apps — icon, route, `data-app` tint key and sections — read by the AppSidebar (app
 * switcher + the current app's sections), the TabBar (primary apps + "More") and anything else that
 * needs to know "which app am I in". Every `href` must resolve to a real `src/app/**\/page.tsx`
 * that renders something (not a redirect stub); `src/tests/lib/navigation/app-sections.test.ts`
 * enforces that.
 *
 * Adding an app: add an entry to `APPS` (and its tint to `tokens.css` if it is new), then list it in
 * `TAB_BAR_PRIORITY` if it should be able to take a tab. Adding a section: add it to the app's
 * `sections`; use `match` for extra path prefixes that belong to it (sub-pages, legacy aliases).
 */

import type { ComponentType, SVGProps } from "react";
import {
  Archive,
  Bell,
  Bookmark,
  BookStack,
  Brain,
  Building,
  Cart,
  ChatBubble,
  ChatLines,
  Clock,
  Community,
  Crown,
  Database,
  DocMagnifyingGlass,
  Download,
  EditPencil,
  Globe,
  Group,
  Hammer,
  HelpCircle,
  HomeSimple,
  Journal,
  LeaderboardStar,
  List,
  Lock,
  Mail,
  Map as MapIcon,
  MapPin,
  Medal,
  MultiplePages,
  OpenBook,
  Page,
  Palette,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Shuffle,
  StatsReport,
  Trophy,
  User,
  Wallet,
} from "iconoir-react";

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** `data-app` tint keys (tokens.css §2.2). Omitted = the default (indigo) tint. */
export type AppTint =
  "admin" | "mycountry" | "intel" | "maps" | "thinkpages" | "vault" | "forum" | "wiki" | "sports";

export type AppId =
  | "home"
  | "mycountry"
  | "maps"
  | "thinkpages"
  | "vault"
  | "wiki"
  | "forum"
  | "sports"
  | "countries"
  | "help"
  | "admin"
  | "settings";

/** Admin navigation settings (`api.admin.getNavigationSettings`) that can hide an app. */
export interface NavigationVisibilitySettings {
  showWikiTab?: boolean;
  showCardsTab?: boolean;
  showMapsTab?: boolean;
  showForumTab?: boolean;
  showHelpTab?: boolean;
}

export interface AppSection {
  id: string;
  label: string;
  /** A real route, optionally with a query (`/settings?tab=appearance`). */
  href: string;
  icon: NavIcon;
  /** Only the exact path is this section (e.g. an app's overview). */
  exact?: boolean;
  /** Extra path prefixes that belong to this section. */
  match?: string[];
  /** For query sections: also current when the page has no query (the page's default tab). */
  isDefault?: boolean;
  /** Overrides the app tint while this section is current (e.g. Intelligence is crimson). */
  tint?: AppTint;
}

export interface AppDefinition {
  id: AppId;
  label: string;
  href: string;
  icon: NavIcon;
  tint?: AppTint;
  /** Path prefixes that belong to this app ("/" means the root page only). */
  match: string[];
  sections: AppSection[];
  requiresAuth?: boolean;
  adminOnly?: boolean;
  /** Admin navigation setting that hides the app when false. */
  navSetting?: keyof NavigationVisibilitySettings;
  /** `footer`: pinned to the bottom of the sidebar instead of listed in the app switcher. */
  placement?: "main" | "footer";
}

export const APPS: readonly AppDefinition[] = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard",
    icon: HomeSimple,
    match: ["/", "/dashboard", "/feed", "/achievements", "/hashtags", "/changelog"],
    requiresAuth: true,
    sections: [
      { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: StatsReport },
      { id: "feed", label: "Activity", href: "/feed", icon: Bell, match: ["/hashtags"] },
      { id: "achievements", label: "Achievements", href: "/achievements", icon: Medal },
      { id: "changelog", label: "What's new", href: "/changelog", icon: Clock },
    ],
  },
  {
    id: "mycountry",
    label: "MyCountry",
    href: "/mycountry",
    icon: Crown,
    tint: "mycountry",
    match: ["/mycountry"],
    requiresAuth: true,
    sections: [
      { id: "overview", label: "Overview", href: "/mycountry", icon: Crown, exact: true },
      { id: "executive", label: "Directives", href: "/mycountry/executive", icon: Building },
      { id: "economy", label: "Economy", href: "/mycountry/economy", icon: StatsReport },
      { id: "diplomacy", label: "Diplomacy", href: "/mycountry/diplomacy", icon: Globe },
      {
        id: "defense",
        label: "Defense",
        href: "/mycountry/defense",
        icon: Shield,
        tint: "intel",
      },
      { id: "politics", label: "Politics", href: "/mycountry/politics", icon: Community },
      {
        id: "intelligence",
        label: "Intelligence",
        href: "/mycountry/intelligence",
        icon: Brain,
        tint: "intel",
      },
      { id: "map-editor", label: "Map editor", href: "/mycountry/map-editor", icon: MapPin },
      { id: "editor", label: "Editor", href: "/mycountry/editor", icon: EditPencil },
    ],
  },
  {
    id: "maps",
    label: "Maps",
    href: "/maps",
    icon: MapIcon,
    tint: "maps",
    match: ["/maps"],
    navSetting: "showMapsTab",
    sections: [],
  },
  {
    id: "thinkpages",
    label: "ThinkPages",
    href: "/thinkpages",
    icon: ChatLines,
    tint: "thinkpages",
    match: ["/thinkpages", "/thinktanks", "/messages"],
    requiresAuth: true,
    sections: [
      { id: "accounts", label: "Accounts", href: "/thinkpages", icon: User },
      { id: "thinktanks", label: "ThinkTanks", href: "/thinktanks", icon: Group },
      { id: "messages", label: "Messages", href: "/messages", icon: Mail },
    ],
  },
  {
    id: "vault",
    label: "Vault",
    href: "/vault",
    icon: MultiplePages,
    tint: "vault",
    match: ["/vault"],
    requiresAuth: true,
    navSetting: "showCardsTab",
    sections: [
      { id: "dashboard", label: "Dashboard", href: "/vault", icon: Wallet, exact: true },
      {
        id: "cards",
        label: "Cards",
        href: "/vault/cards",
        icon: MultiplePages,
        match: ["/vault/inventory", "/vault/lore-gallery", "/vault/ns-library", "/vault/ns-deck"],
      },
      { id: "collections", label: "Collections", href: "/vault/collections", icon: Archive },
      {
        id: "marketplace",
        label: "Marketplace",
        href: "/vault/marketplace",
        icon: Cart,
        // /vault/packs redirects into the marketplace store.
        match: ["/vault/market", "/vault/trading", "/vault/packs"],
      },
      { id: "crafting", label: "Crafting", href: "/vault/crafting", icon: Hammer },
      { id: "import", label: "Import", href: "/vault/import", icon: Download },
    ],
  },
  {
    id: "wiki",
    label: "Wiki",
    href: "/wiki",
    icon: OpenBook,
    tint: "wiki",
    match: ["/wiki", "/util", "/blurbs"],
    navSetting: "showWikiTab",
    // WikiOS utilities live under /util; the /wiki/<tool> routes are redirect stubs.
    sections: [
      { id: "main", label: "Main page", href: "/wiki", icon: OpenBook, exact: true },
      {
        id: "search",
        label: "Search",
        href: "/util/search",
        icon: Search,
        match: ["/wiki/search"],
      },
      {
        id: "recent-changes",
        label: "Recent changes",
        href: "/util/recent-changes",
        icon: Clock,
      },
      {
        id: "categories",
        label: "Categories",
        href: "/util/categories",
        icon: BookStack,
        match: ["/wiki/categories"],
      },
      { id: "random", label: "Random article", href: "/util/random", icon: Shuffle },
      { id: "watchlist", label: "Watchlist", href: "/util/watchlist", icon: Bookmark },
      {
        id: "history",
        label: "Contributions",
        href: "/util/contributions",
        icon: Journal,
        match: ["/wiki/contributions"],
      },
      { id: "blurbs", label: "Blurbs", href: "/blurbs", icon: Page },
      { id: "utilities", label: "Utilities", href: "/util", icon: List },
    ],
  },
  {
    id: "forum",
    label: "Forum",
    href: "/forum",
    icon: ChatBubble,
    tint: "forum",
    match: ["/forum"],
    navSetting: "showForumTab",
    sections: [
      { id: "forums", label: "All forums", href: "/forum", icon: ChatBubble },
      { id: "search", label: "Search", href: "/forum/search", icon: Search },
      { id: "bookmarks", label: "Bookmarks", href: "/forum/bookmarks", icon: Bookmark },
      { id: "new-thread", label: "New thread", href: "/forum/new-thread", icon: Plus },
    ],
  },
  {
    id: "sports",
    label: "Sports",
    href: "/myleague",
    icon: Trophy,
    tint: "sports",
    match: ["/myleague", "/myclub"],
    requiresAuth: true,
    sections: [
      { id: "myleague", label: "MyLeague", href: "/myleague", icon: Trophy },
      { id: "myclub", label: "MyClub", href: "/myclub", icon: Group },
    ],
  },
  {
    id: "countries",
    label: "Countries",
    href: "/countries",
    icon: Globe,
    match: ["/countries", "/explore", "/leaderboards", "/realms", "/r"],
    sections: [
      { id: "directory", label: "Directory", href: "/countries", icon: Globe },
      { id: "explore", label: "Explore", href: "/explore", icon: DocMagnifyingGlass },
      { id: "collections", label: "Collections", href: "/explore/collections", icon: Archive },
      { id: "leaderboards", label: "Leaderboards", href: "/leaderboards", icon: LeaderboardStar },
      { id: "realms", label: "Realms", href: "/realms", icon: Community, match: ["/r"] },
    ],
  },
  {
    id: "help",
    label: "Help",
    href: "/help",
    icon: HelpCircle,
    match: ["/help"],
    navSetting: "showHelpTab",
    sections: [],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    icon: ShieldCheck,
    tint: "admin",
    match: ["/admin"],
    requiresAuth: true,
    adminOnly: true,
    sections: [
      { id: "overview", label: "Overview", href: "/admin", icon: ShieldCheck, exact: true },
      { id: "platform", label: "Platform", href: "/admin/platform", icon: Server },
      { id: "users", label: "Users", href: "/admin/users", icon: User },
      { id: "user-roles", label: "Roles", href: "/admin/user-roles", icon: Lock },
      { id: "countries", label: "Countries", href: "/admin/countries", icon: Globe },
      { id: "maps", label: "Maps", href: "/admin/maps", icon: MapIcon },
      { id: "wikios", label: "WikiOS", href: "/admin/wikios-settings", icon: OpenBook },
      { id: "vault", label: "Vault", href: "/admin/vault", icon: MultiplePages },
      { id: "thinkpages", label: "ThinkPages", href: "/admin/thinkpages", icon: ChatLines },
      { id: "notifications", label: "Notifications", href: "/admin/notifications", icon: Bell },
      { id: "logs", label: "Logs", href: "/admin/logs", icon: Database },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    match: ["/settings"],
    requiresAuth: true,
    placement: "footer",
    // Tabs of src/app/settings (`?tab=` ids from src/app/settings/_lib/sections.ts).
    sections: [
      {
        id: "account",
        label: "IxnayID & Passport",
        href: "/settings?tab=account",
        icon: User,
        isDefault: true,
      },
      { id: "country", label: "MyCountry", href: "/settings?tab=country", icon: Crown },
      {
        id: "appearance",
        label: "Appearance & accessibility",
        href: "/settings?tab=appearance",
        icon: Palette,
      },
      { id: "wikios", label: "WikiOS", href: "/settings?tab=wikios", icon: OpenBook },
      {
        id: "notifications",
        label: "Notifications",
        href: "/settings?tab=notifications",
        icon: Bell,
      },
      { id: "social", label: "Social & ThinkPages", href: "/settings?tab=social", icon: ChatLines },
      { id: "privacy", label: "Privacy & security", href: "/settings?tab=privacy", icon: Lock },
      { id: "vault", label: "Vault status", href: "/settings?tab=vault", icon: Wallet },
      { id: "cosmetics", label: "Cosmetics", href: "/settings?tab=cosmetics", icon: Palette },
      {
        id: "cards",
        label: "NationStates cards",
        href: "/settings?tab=cards",
        icon: MultiplePages,
      },
    ],
  },
];

/** Order in which apps claim the TabBar's four slots (the fifth is "More"). */
export const TAB_BAR_PRIORITY: readonly AppId[] = [
  "home",
  "mycountry",
  "maps",
  "thinkpages",
  "countries",
  "wiki",
  "forum",
  "vault",
  "sports",
  "help",
];
export const TAB_BAR_SLOTS = 4;

/**
 * Routes that stay chromeless with the new shell: no sidebar, no tab bar (spec §7.4 — Maps keeps
 * its own wayfinding; the full-screen map editors cover the viewport).
 */
export const CHROMELESS_PREFIXES: readonly string[] = [
  "/maps",
  "/mycountry/map-editor",
  "/admin/maps/editor",
  "/admin/maps/style-editor",
];

/** `URLSearchParams` or Next's `ReadonlyURLSearchParams`. */
export type SearchParamsLike = Pick<URLSearchParams, "get">;

function splitHref(href: string): { path: string; query: URLSearchParams } {
  const [beforeHash = ""] = href.split("#");
  const [rawPath = "/", rawQuery = ""] = beforeHash.split("?");
  return { path: normalizePath(rawPath), query: new URLSearchParams(rawQuery) };
}

/** `/a/b/` → `/a/b`; empty → `/`. */
export function normalizePath(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (path === "" || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

/** `prefix` owns `pathname` (itself or a sub-path). `/` owns only the root. */
export function matchesPrefix(pathname: string, prefix: string): boolean {
  const path = normalizePath(pathname);
  const base = normalizePath(prefix);
  if (base === "/") return path === "/";
  return path === base || path.startsWith(`${base}/`);
}

export function getApp(id: AppId): AppDefinition {
  const app = APPS.find((candidate) => candidate.id === id);
  if (!app) throw new Error(`Unknown app: ${id}`);
  return app;
}

/** The app that owns `pathname` (longest matching prefix), if any. */
export function getAppForPath(pathname: string): AppDefinition | undefined {
  let best: { app: AppDefinition; length: number } | undefined;
  for (const app of APPS) {
    for (const prefix of app.match) {
      if (matchesPrefix(pathname, prefix) && (!best || prefix.length > best.length)) {
        best = { app, length: prefix.length };
      }
    }
  }
  return best?.app;
}

/**
 * The single current section of `app` for this URL: the most specific match wins, so
 * `/mycountry/economy` is Economy, not Overview. `searchParams` is null when not known yet
 * (prerender); query sections then fall back to their `isDefault` section.
 */
export function getActiveSectionId(
  app: AppDefinition,
  pathname: string,
  searchParams: SearchParamsLike | null
): string | undefined {
  const path = normalizePath(pathname);
  let best: { id: string; score: number } | undefined;
  for (const section of app.sections) {
    const { path: sectionPath, query } = splitHref(section.href);
    let score = -1;
    const queryKeys = [...query.keys()];
    if (queryKeys.length > 0) {
      if (path !== sectionPath) continue;
      const matchesQuery = queryKeys.every((key) => searchParams?.get(key) === query.get(key));
      const noQuery = queryKeys.every((key) => !searchParams?.get(key));
      if (matchesQuery) score = 10_000;
      else if (section.isDefault && noQuery) score = 5_000;
      else continue;
    } else if (section.exact) {
      if (path === sectionPath) score = sectionPath.length;
    } else {
      for (const prefix of [sectionPath, ...(section.match ?? [])]) {
        if (matchesPrefix(path, prefix)) score = Math.max(score, normalizePath(prefix).length);
      }
    }
    if (score >= 0 && (!best || score > best.score)) best = { id: section.id, score };
  }
  return best?.id;
}

/** The `data-app` tint for this URL: the current section's override, else the app's tint. */
export function getTintForPath(
  app: AppDefinition | undefined,
  activeSectionId: string | undefined
): AppTint | undefined {
  if (!app) return undefined;
  const section = app.sections.find((candidate) => candidate.id === activeSectionId);
  return section?.tint ?? app.tint;
}

export function isChromelessPath(pathname: string): boolean {
  return CHROMELESS_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export interface AppVisibilityContext {
  signedIn: boolean;
  isAdmin: boolean;
  navigationSettings?: NavigationVisibilitySettings | null;
}

/** Apps this user can see, in `APPS` order. */
export function getVisibleApps({
  signedIn,
  isAdmin,
  navigationSettings,
}: AppVisibilityContext): AppDefinition[] {
  return APPS.filter((app) => {
    if (app.requiresAuth && !signedIn) return false;
    if (app.adminOnly && !isAdmin) return false;
    if (app.navSetting && navigationSettings && navigationSettings[app.navSetting] === false) {
      return false;
    }
    return true;
  });
}

/** The TabBar's primary apps (up to `TAB_BAR_SLOTS`) and the rest (listed under "More"). */
export function splitTabBarApps(visible: readonly AppDefinition[]): {
  primary: AppDefinition[];
  more: AppDefinition[];
} {
  const primary = TAB_BAR_PRIORITY.map((id) => visible.find((app) => app.id === id))
    .filter((app): app is AppDefinition => app !== undefined && app.placement !== "footer")
    .slice(0, TAB_BAR_SLOTS);
  const more = visible.filter((app) => !primary.includes(app));
  return { primary, more };
}
