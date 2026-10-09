/**
 * App section map for the navigation shell.
 *
 * One list of apps — icon, route, `data-app` tint key and sections — read by the AppSidebar (app
 * switcher + the current app's sections), the TabBar (primary apps + "More") and anything else that
 * needs to know "which app am I in". Every `href` must resolve to a real `src/app/**\/page.tsx`
 * that renders something (not a redirect stub); `src/tests/lib/navigation/app-sections.test.ts`
 * enforces that.
 *
 * Adding an app: add an entry to `APPS` (and its tint to `tokens.css` if it is new), then list it in
 * `TAB_BAR_PRIORITY` if it should be able to take a tab. Adding a section: add it to the app's
 * `sections`; use `match` for extra path prefixes that belong to it (sub-pages, legacy aliases) and
 * `group` to list it under a sub-heading (admin, settings).
 *
 * The sidebar and the More sheet are the only navigation, so every destination an app offers must
 * be listed here; an app renders no navigation of its own.
 */

import type { ComponentType, SVGProps } from "react";
import { DiscordLogomark } from "./icons/DiscordLogomark";
import { MyCountryLogomark } from "./icons/MyCountryLogomark";
import { RealmsLogomark } from "./icons/RealmsLogomark";
import { VaultLogomark } from "./icons/VaultLogomark";
import {
  Compass as SolidCompass,
  MultiBubble as SolidMultiBubble,
  RoundFlask as SolidRoundFlask,
} from "iconoir-react/solid";
import { WikiLogomark } from "./icons/WikiLogomark";
import {
  Activity,
  Archive,
  Bell,
  Bookmark,
  BookStack,
  Building,
  Cart,
  ChatBubble,
  ChatLines,
  CheckSquare,
  Clock,
  Coins,
  Community,
  Component,
  Cpu,
  Crown,
  Database,
  Download,
  FireFlame,
  Folder,
  Gamepad,
  Gift,
  Globe,
  Group,
  HelpCircle,
  HomeSimple,
  Journal,
  LightBulbOn,
  List,
  Lock,
  Mail,
  Map as MapIcon,
  MediaImage,
  Medal,
  MultiplePages,
  OpenBook,
  Package,
  Page,
  Palette,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Shuffle,
  Sparks,
  StatsReport,
  Terminal,
  Translate,
  Trophy,
  User,
  Wallet,
} from "iconoir-react";

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavBadgeKey =
  "diplomacy-inbox" | "daily-reward" | "messages-unread" | "issues-pending" | "whats-new";
export type NavAction = "daily-reward";
export type NavBadge = { kind: "count"; value: number } | { kind: "action"; label: string };
export type NavBadges = Partial<Record<NavBadgeKey, NavBadge>>;

/** `data-app` tint keys (tokens.css). Omitted = the default (indigo) tint. */
type AppTint =
  "admin" | "mycountry" | "maps" | "thinkpages" | "vault" | "forum" | "wiki" | "realms" | "labs";

type AppId =
  | "home"
  | "mycountry"
  | "maps"
  | "vault"
  | "wiki"
  | "forum"
  | "countries"
  | "labs"
  | "help"
  | "admin"
  | "settings";

/** Admin navigation settings (`api.admin.getNavigationSettings`) that can hide an app. */
export interface NavigationVisibilitySettings {
  showWikiTab?: boolean;
  showCardsTab?: boolean;
  showLabsTab?: boolean;
  showMapsTab?: boolean;
  showForumTab?: boolean;
  showHelpTab?: boolean;
}

interface AppSection {
  id: string;
  label: string;
  /** A real route, optionally with a query (`/settings?tab=appearance`). */
  href: string;
  icon: NavIcon;
  /** Only the exact path is this section (e.g. an app's overview). */
  exact?: boolean;
  /** Extra path prefixes that belong to this section (exact paths when `exact` is set). */
  match?: string[];
  /** For query sections: also current when the page has no query (the page's default tab). */
  isDefault?: boolean;
  /** Overrides the app tint while this section is current (e.g. ThinkPages under Home). */
  tint?: AppTint;
  /**
   * Sub-heading the section is listed under. Consecutive sections with the same `group` form one
   * group (`groupSections`); ungrouped sections lead the list without a heading.
   */
  group?: string;
  /** Live value from `useNavBadges`. */
  badge?: NavBadgeKey;
  /** Rendered as a button that runs the action; shown only while its badge is present. */
  action?: NavAction;
  /** A normal link that is listed only while its badge is present (e.g. "What's new"). */
  conditional?: true;
  /** An absolute URL outside the app: opens in a new tab, and is never the current section. */
  external?: true;
  /**
   * Listed only for users who pass this check (`getVisibleApps` context). The route itself is not
   * gated by the map: the page keeps its own premium preview for anyone who arrives by URL.
   */
  requires?: SectionRequirement;
}

/** `mycountry-premium`: MyCountry Premium (the premium ability) or the beta-tester role. */
type SectionRequirement = "mycountry-premium";

export interface AppDefinition {
  id: AppId;
  label: string;
  href: string;
  icon: NavIcon;
  tint?: AppTint;
  /** Live value from `useNavBadges`, shown on the app's row. */
  badge?: NavBadgeKey;
  /** Path prefixes that belong to this app ("/" means the root page only). */
  match: string[];
  sections: AppSection[];
  requiresAuth?: boolean;
  adminOnly?: boolean;
  /** Admin navigation setting that hides the app when false. */
  navSetting?: keyof NavigationVisibilitySettings;
  /**
   * Who still sees the app while its `navSetting` is off (the legacy nav shows Labs to admins and
   * to holders of the `labs.access` permission regardless of `showLabsTab`).
   */
  navSettingBypass?: { admin?: boolean; labsAccess?: boolean };
  /** `footer`: listed below the main apps, and opens as an area of its own (Admin, Settings). */
  placement?: "main" | "footer";
  /** Sections are listed as top-level rows, always shown, with no app row to expand (Home). */
  inline?: true;
}

/** The admin console's sections of one sidebar group: `[id, label, href, icon]` rows. */
function adminGroup(
  group: string,
  rows: ReadonlyArray<readonly [id: string, label: string, href: string, icon: NavIcon]>
): AppSection[] {
  return rows.map(([id, label, href, icon]) => ({ id, label, href, icon, group }));
}

export const APPS: readonly AppDefinition[] = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard",
    icon: HomeSimple,
    // /feed, /achievements and /hashtags are not listed but stay Home's, so the sidebar keeps its place.
    match: [
      "/",
      "/dashboard",
      "/feed",
      "/achievements",
      "/hashtags",
      "/messages",
      "/thinkpages",
      "/thinktanks",
    ],
    requiresAuth: true,
    inline: true,
    sections: [
      // Listed only while this build is unseen; Help keeps a permanent changelog row.
      {
        id: "whats-new",
        label: "What's new",
        href: "/changelog",
        icon: Clock,
        badge: "whats-new",
        conditional: true,
      },
      { id: "dashboard", label: "Home", href: "/dashboard", icon: HomeSimple },
      {
        id: "messages",
        label: "Messages",
        href: "/messages",
        icon: Mail,
        badge: "messages-unread",
      },
      // ThinkPages is part of Home: ThinkTanks takes /thinkpages, and Forum takes the forum routes
      // (longest prefix wins). Both keep the emerald section tint.
      {
        id: "thinktanks",
        label: "ThinkTanks",
        href: "/thinktanks",
        icon: LightBulbOn,
        tint: "thinkpages",
        match: ["/thinkpages"],
      },
      {
        id: "forum",
        label: "Forum",
        href: "/thinkpages/forum",
        icon: ChatBubble,
        tint: "thinkpages",
        match: ["/thinkpages/c", "/thinkpages/t", "/thinkpages/r", "/thinkpages/mod"],
      },
    ],
  },
  {
    id: "mycountry",
    label: "MyCountry",
    href: "/mycountry",
    icon: MyCountryLogomark,
    tint: "mycountry",
    match: ["/mycountry"],
    requiresAuth: true,
    sections: [
      {
        id: "overview",
        label: "Overview",
        href: "/mycountry",
        icon: Crown,
        exact: true,
      },
      {
        id: "executive",
        label: "Directives",
        href: "/mycountry/executive",
        icon: Building,
        badge: "issues-pending",
      },
      { id: "economy", label: "Economy", href: "/mycountry/economy", icon: StatsReport },
      {
        id: "diplomacy",
        label: "Diplomacy",
        href: "/mycountry/diplomacy",
        icon: Globe,
        badge: "diplomacy-inbox",
      },
      { id: "politics", label: "Politics", href: "/mycountry/politics", icon: Community },
      {
        id: "defense",
        label: "Defense",
        href: "/mycountry/defense",
        icon: Shield,
        // Intelligence has no row of its own; its page keeps Defense's highlight.
        match: ["/mycountry/intelligence"],
        requires: "mycountry-premium",
      },
    ],
  },
  {
    id: "maps",
    label: "Maps",
    href: "/maps",
    icon: SolidCompass,
    tint: "maps",
    match: ["/maps"],
    navSetting: "showMapsTab",
    sections: [],
  },
  {
    id: "vault",
    label: "Vault",
    href: "/vault",
    icon: VaultLogomark,
    tint: "vault",
    match: ["/vault"],
    requiresAuth: true,
    navSetting: "showCardsTab",
    // Achievements lives under Home → Achievements, not here.
    sections: [
      { id: "dashboard", label: "Dashboard", href: "/vault", icon: Wallet, exact: true },
      {
        id: "daily-reward",
        label: "Daily reward",
        href: "/vault",
        icon: Gift,
        action: "daily-reward",
        badge: "daily-reward",
      },
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
      { id: "exchange", label: "Exchange", href: "/vault/exchange", icon: Coins },
      { id: "import", label: "Import", href: "/vault/import", icon: Download },
    ],
  },
  {
    id: "wiki",
    label: "Wiki",
    href: "/wiki",
    icon: WikiLogomark,
    tint: "wiki",
    match: ["/wiki", "/util", "/blurbs", "/stashes"],
    navSetting: "showWikiTab",
    // WikiOS utilities live under /util; the /wiki/<tool> routes are redirect stubs. WikiOS has no rail
    // of its own: search is a section here, and page creation and page tools live in the page header.
    sections: [
      {
        id: "main",
        label: "Main page",
        href: "/wiki",
        icon: OpenBook,
        exact: true,
        match: ["/wiki/Main_Page"],
      },
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
      { id: "stashes", label: "Stashes", href: "/stashes", icon: Bookmark },
      {
        id: "repository",
        label: "Repository",
        href: "/util/repository",
        icon: MediaImage,
        match: ["/wiki/repository"],
      },
      { id: "blurbs", label: "Blurbs", href: "/blurbs", icon: Page },
      { id: "utilities", label: "Utilities", href: "/util", icon: List },
    ],
  },
  {
    id: "forum",
    label: "Forum",
    href: "/forum",
    icon: SolidMultiBubble,
    tint: "forum",
    match: ["/forum"],
    navSetting: "showForumTab",
    // The forum's rail entry "Messages" is ThinkPages → Messages.
    sections: [
      { id: "forums", label: "All forums", href: "/forum", icon: ChatBubble },
      { id: "trending", label: "Trending", href: "/forum?sort=trending", icon: FireFlame },
      { id: "new-posts", label: "New posts", href: "/forum?sort=new", icon: Clock },
      { id: "search", label: "Search", href: "/forum/search", icon: Search },
      { id: "bookmarks", label: "Bookmarks", href: "/forum/bookmarks", icon: Bookmark },
      { id: "new-thread", label: "New thread", href: "/forum/new-thread", icon: Plus },
    ],
  },
  {
    id: "countries",
    label: "Realms",
    // /realms is the landing page for exploring, searching and joining realms.
    href: "/realms",
    icon: RealmsLogomark,
    tint: "realms",
    match: ["/realms", "/r", "/countries", "/explore", "/leaderboards"],
    sections: [
      // The nations of the viewer's realm (/countries follows the active nation's realm).
      { id: "my-realm", label: "My realm", href: "/countries", icon: Globe },
      { id: "explore", label: "Explore", href: "/realms", icon: Search, match: ["/r"] },
    ],
  },
  {
    id: "labs",
    label: "Labs",
    href: "/labs/onoma",
    icon: SolidRoundFlask,
    tint: "labs",
    match: ["/labs", "/myleague", "/myclub"],
    requiresAuth: true,
    navSetting: "showLabsTab",
    navSettingBypass: { admin: true, labsAccess: true },
    // Labs with a shipped entry point. Onoma keeps its own in-app navigation (src/app/labs/onoma).
    sections: [
      { id: "onoma", label: "Onoma", href: "/labs/onoma", icon: Translate },
      { id: "vexel", label: "Vexel", href: "/labs/vexel", icon: Shield },
      { id: "myleague", label: "MyLeague", href: "/myleague", icon: Trophy },
      { id: "myclub", label: "MyClub", href: "/myclub", icon: Group },
    ],
  },
  {
    id: "help",
    label: "Help",
    href: "/help",
    icon: HelpCircle,
    // /changelog is Help's so its permanent "What's new" row highlights there (Home's conditional
    // row links to the same page).
    match: ["/help", "/changelog"],
    navSetting: "showHelpTab",
    sections: [
      { id: "changelog", label: "What's new", href: "/changelog", icon: Clock },
      {
        id: "discord",
        label: "Ixnay Discord",
        href: "https://discord.gg/mgXAEYdqkd",
        icon: DiscordLogomark,
        external: true,
      },
    ],
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
    placement: "footer",
    // The console's pages; the sidebar lists them as an area, grouped by `group`.
    sections: [
      { id: "overview", label: "Overview", href: "/admin", icon: ShieldCheck, exact: true },
      ...adminGroup("Platform", [
        ["platform", "General settings", "/admin/platform", Server],
        ["bot", "Bot", "/admin/bot", Cpu],
        ["notifications", "Notifications", "/admin/notifications", Bell],
        ["realms", "Realms", "/admin/realms", Sparks],
      ]),
      ...adminGroup("Apps", [
        ["maps", "WorldStudio", "/admin/maps", MapIcon],
        ["style-editor", "Map style editor", "/admin/maps/style-editor", Palette],
        ["wikios", "WikiOS", "/admin/wikios-settings", OpenBook],
        ["lorescanner", "LoreScanner", "/admin/lorescanner", Search],
        ["image-repo", "Image repository", "/admin/image-repo", MediaImage],
        ["stash", "Stash", "/admin/stash", Folder],
        ["vault", "Vault & IxCredits", "/admin/vault", Coins],
        ["cards", "Card packs & lore", "/admin/cards", Package],
        ["achievements", "Achievements", "/admin/achievements", Medal],
        ["thinkpages", "ThinkPages", "/admin/thinkpages", ChatLines],
        ["blurbs", "Blurbs & prompts", "/admin/blurbs", ChatBubble],
        ["polls", "Polls", "/admin/polls", CheckSquare],
        ["myleague", "MyLeague", "/admin/myleague", Trophy],
      ]),
      ...adminGroup("Simulation", [
        ["countries", "Countries", "/admin/countries", Globe],
        ["calculations", "Calculations", "/admin/calculations", Cpu],
        ["rings-audit", "Vitality rings audit", "/admin/rings-audit", Activity],
        ["reference-data", "Reference data", "/admin/reference-data", Database],
        ["storyteller", "Storyteller", "/admin/storyteller", Gamepad],
        ["national-issues", "National issues", "/admin/national-issues", Journal],
        ["diplomatic-options", "Diplomatic options", "/admin/diplomatic-options", Bookmark],
        ["diplomatic-scenarios", "Diplomatic scenarios", "/admin/diplomatic-scenarios", Shield],
        ["npc-personalities", "NPC personalities", "/admin/npc-personalities", Group],
        ["military-equipment", "Military equipment", "/admin/military-equipment", Package],
        ["economic-archetypes", "Economic archetypes", "/admin/economic-archetypes", Trophy],
        ["economic-components", "Economic components", "/admin/economic-components", Component],
        [
          "government-components",
          "Government components",
          "/admin/government-components",
          Database,
        ],
        [
          "intelligence-templates",
          "Intelligence templates",
          "/admin/intelligence-templates",
          Shield,
        ],
      ]),
      ...adminGroup("Users & security", [
        ["users", "Users", "/admin/users", User],
        ["user-roles", "Roles", "/admin/user-roles", Lock],
        ["logs", "Logs", "/admin/logs", Terminal],
        ["membership", "Membership tiers", "/admin/membership", Medal],
      ]),
      ...adminGroup("Labs", [
        ["onoma", "Onoma", "/admin/onoma", Translate],
        ["facet-lab", "Facet lab", "/admin/facet-lab", Component],
      ]),
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
    // Tabs of src/app/settings; the `?tab=` ids are `SETTINGS_TAB_IDS` (src/app/settings/_lib/sections.ts).
    sections: [
      {
        id: "account",
        label: "IxnayID & Passport",
        href: "/settings?tab=account",
        icon: User,
        isDefault: true,
        group: "Profile",
      },
      {
        id: "country",
        label: "MyCountry",
        href: "/settings?tab=country",
        icon: Crown,
        group: "Profile",
      },
      {
        id: "appearance",
        label: "Appearance & accessibility",
        href: "/settings?tab=appearance",
        icon: Palette,
        group: "Preferences",
      },
      {
        id: "wikios",
        label: "WikiOS",
        href: "/settings?tab=wikios",
        icon: OpenBook,
        group: "Preferences",
      },
      {
        id: "notifications",
        label: "Notifications",
        href: "/settings?tab=notifications",
        icon: Bell,
        group: "Preferences",
      },
      {
        id: "social",
        label: "Social & ThinkPages",
        href: "/settings?tab=social",
        icon: ChatLines,
        group: "Preferences",
      },
      {
        id: "privacy",
        label: "Privacy & security",
        href: "/settings?tab=privacy",
        icon: Lock,
        group: "Preferences",
      },
      {
        id: "vault",
        label: "Vault status",
        href: "/settings?tab=vault",
        icon: Wallet,
        group: "Vault",
      },
      {
        id: "cosmetics",
        label: "Cosmetics",
        href: "/settings?tab=cosmetics",
        icon: Palette,
        group: "Vault",
      },
      {
        id: "cards",
        label: "NationStates cards",
        href: "/settings?tab=cards",
        icon: MultiplePages,
        group: "Vault",
      },
    ],
  },
];

/** Order in which apps claim the TabBar's four slots (the fifth is "More"). */
const TAB_BAR_PRIORITY: readonly AppId[] = [
  "home",
  "mycountry",
  "maps",
  "countries",
  "wiki",
  "forum",
  "vault",
  "labs",
  "help",
];
export const TAB_BAR_SLOTS = 4;

/**
 * Routes that stay chromeless with the shell: no sidebar, no tab bar (Maps keeps
 * its own wayfinding; the full-screen map editors cover the viewport).
 */
const CHROMELESS_PREFIXES: readonly string[] = [
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
function normalizePath(pathname: string): string {
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
    // An action row shares its app's route; it is never "where you are".
    if (section.action || section.external) continue;
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
      for (const alias of [sectionPath, ...(section.match ?? [])]) {
        if (path === normalizePath(alias)) score = Math.max(score, normalizePath(alias).length);
      }
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

/** Consecutive runs of sections sharing a `group` (ungrouped runs have no `group`). */
export function groupSections(
  sections: readonly AppSection[]
): { group: string | undefined; sections: AppSection[] }[] {
  const runs: { group: string | undefined; sections: AppSection[] }[] = [];
  for (const section of sections) {
    const last = runs[runs.length - 1];
    if (last && last.group === section.group) last.sections.push(section);
    else runs.push({ group: section.group, sections: [section] });
  }
  return runs;
}

interface AppVisibilityContext {
  signedIn: boolean;
  isAdmin: boolean;
  /** Holds the `labs.access` permission (sees Labs even when `showLabsTab` is off). */
  hasLabsAccess?: boolean;
  /** MyCountry Premium (the premium ability) or a beta tester: sees `requires: "mycountry-premium"` sections. */
  hasMycountryPremium?: boolean;
  navigationSettings?: NavigationVisibilitySettings | null;
}

/** Apps this user can see, in `APPS` order. */
export function getVisibleApps({
  signedIn,
  isAdmin,
  hasLabsAccess = false,
  hasMycountryPremium = false,
  navigationSettings,
}: AppVisibilityContext): AppDefinition[] {
  const granted: Record<SectionRequirement, boolean> = {
    "mycountry-premium": hasMycountryPremium,
  };
  const visibleApps = APPS.filter((app) => {
    if (app.requiresAuth && !signedIn) return false;
    if (app.adminOnly && !isAdmin) return false;
    if (app.navSetting && navigationSettings && navigationSettings[app.navSetting] === false) {
      const bypass = app.navSettingBypass;
      const exempt = (bypass?.admin && isAdmin) || (bypass?.labsAccess && hasLabsAccess);
      if (!exempt) return false;
    }
    return true;
  });
  // Copies only where a section is hidden, so apps without gated sections stay the shared objects.
  return visibleApps.map((app) =>
    app.sections.some((section) => section.requires && !granted[section.requires])
      ? {
          ...app,
          sections: app.sections.filter(
            (section) => !section.requires || granted[section.requires]
          ),
        }
      : app
  );
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
