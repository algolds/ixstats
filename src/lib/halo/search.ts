import type { ComponentType } from "react";
import { Book, Compass, Globe, LogIn, LogOut } from "iconoir-react";
import {
  commandsFor,
  type CommandEntry,
  type FeatureEntry,
  type SystemActionId,
} from "~/components/halo/halo-registry";
import type { CountrySummary, PluginCommand, SearchFilter } from "~/components/halo/types";
import { commandsFromVisibleApps } from "~/lib/halo/commands-from-apps";
import type { AppDefinition } from "~/lib/navigation/app-sections";

export type IndexedEntry<T> = T & { _lower: string };

export type SearchablePluginCommand = Omit<PluginCommand, "run">;

export interface IndexedPluginCommand extends SearchablePluginCommand {
  _titleLower: string;
  _lower: string;
}

export interface WikiSearchItem {
  title: string;
  snippet?: string | null;
}

export interface RealmSearchItem {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  thumbnail?: string | null;
  tags?: readonly string[];
  nationCount?: number;
}

export interface IndexedRealm extends RealmSearchItem {
  _nameLower: string;
  _slugLower: string;
  _lower: string;
}

export interface SearchSources {
  countries: ReadonlyArray<IndexedEntry<CountrySummary>>;
  commands: ReadonlyArray<IndexedEntry<CommandEntry>>;
  features: ReadonlyArray<IndexedEntry<FeatureEntry>>;
  wiki: ReadonlyArray<WikiSearchItem>;
  pluginCommands?: ReadonlyArray<IndexedPluginCommand>;
  realms?: ReadonlyArray<IndexedRealm>;
}

export interface CatalogDescriptor {
  kind: "country" | "realm" | "command" | "feature" | "wiki";
  key: string;
  title: string;
  description: string;
  category: string;
  icon?: ComponentType<{ className?: string }>;
  flagUrl?: string;
  thumbnail?: string;
  economicTier?: string;
  slug?: string;
  path?: string;
  actionId?: SystemActionId;
  pluginCommandKey?: string;
}

export function buildIndex<
  T extends {
    name: string;
    description?: string;
    category?: string;
    keywords?: readonly string[];
  },
>(entries: readonly T[]): Array<IndexedEntry<T>> {
  return entries.map((entry) => {
    const hasMetadata =
      entry.description !== undefined ||
      entry.category !== undefined ||
      entry.keywords !== undefined;
    const _lower = hasMetadata
      ? `${entry.name}\t${entry.description ?? ""}\t${entry.category ?? ""}\t${entry.keywords?.join(" ") ?? ""}`.toLowerCase()
      : entry.name.toLowerCase();
    return { ...entry, _lower };
  });
}

export function indexPluginCommands(
  commands: readonly SearchablePluginCommand[]
): IndexedPluginCommand[] {
  return commands.map((cmd) => ({
    ...cmd,
    _titleLower: cmd.title.toLowerCase(),
    _lower:
      `${cmd.title}\t${cmd.description ?? ""}\t${cmd.keywords?.join(" ") ?? ""}`.toLowerCase(),
  }));
}

export function indexRealms(realms: readonly RealmSearchItem[]): IndexedRealm[] {
  return realms.map((realm) => ({
    ...realm,
    _nameLower: realm.name.toLowerCase(),
    _slugLower: realm.slug.toLowerCase(),
    _lower:
      `${realm.name}\t${realm.slug}\t${realm.description ?? ""}\t${realm.tags?.join(" ") ?? ""}`.toLowerCase(),
  }));
}

export function commandEntriesFor({
  isAdmin,
  signedIn,
  pathname,
  searchApps,
}: {
  isAdmin: boolean;
  signedIn: boolean;
  pathname: string | null;
  searchApps?: readonly AppDefinition[];
}): CommandEntry[] {
  const viewerEntries: CommandEntry[] = [];

  if (!signedIn) {
    viewerEntries.push(
      {
        name: "Sign in",
        path: "/sign-in",
        icon: LogIn,
        category: "System",
        description: "Sign in to your IxStates account",
        keywords: ["login", "auth", "signin", "session"],
      },
      {
        name: "Sign up",
        path: "/sign-up",
        icon: LogIn,
        category: "System",
        description: "Create a new IxStates account",
        keywords: ["register", "signup", "join", "new account"],
      }
    );
  } else {
    viewerEntries.push({
      name: "Sign out",
      actionId: "sign-out",
      icon: LogOut,
      category: "System",
      description: "Sign out of your account",
      keywords: ["logout", "exit", "signoff"],
    });
  }

  if (pathname?.includes("/countries/") && !pathname.includes("/countries/new")) {
    const cid = pathname.split("/countries/")[1]?.split("/")[0];
    if (cid) {
      viewerEntries.push({
        name: "Country profile",
        path: `/countries/${cid}`,
        icon: Globe,
        category: "Geography",
        description: "View detailed country profile and economy",
        keywords: ["profile", "showcase", "country"],
      });
    }
  }

  const baseCommands = searchApps ? commandsFromVisibleApps(searchApps) : commandsFor(isAdmin);
  return [...viewerEntries, ...baseCommands];
}

function rankText(primaryLower: string, altExactLower: string | null, needle: string): number {
  if (primaryLower === needle || altExactLower === needle) return 0;
  if (primaryLower.startsWith(needle)) return 1;
  if (primaryLower.includes(needle)) return 2;
  return 3;
}

function matchPluginCommands(
  commands: ReadonlyArray<IndexedPluginCommand>,
  pluginId: string,
  needle: string,
  limit: number
): CatalogDescriptor[] {
  const scored: Array<{ rank: number; order: number; entry: IndexedPluginCommand }> = [];
  for (let i = 0; i < commands.length; i++) {
    const entry = commands[i]!;
    if (!entry._lower.includes(needle)) continue;
    scored.push({ rank: rankText(entry._titleLower, null, needle), order: i, entry });
  }
  scored.sort((a, b) => a.rank - b.rank || a.order - b.order);

  return scored.slice(0, limit).map(({ entry }) => ({
    kind: "command",
    key: `plugin-${pluginId}-${entry.key}`,
    title: entry.title,
    description: entry.description ?? "",
    category: "On this page",
    icon: entry.icon ?? Compass,
    path: entry.path,
    pluginCommandKey: entry.key,
  }));
}

function formatRealmDescription(realm: RealmSearchItem): string {
  if (typeof realm.nationCount === "number") {
    const count = `${realm.nationCount} ${realm.nationCount === 1 ? "nation" : "nations"}`;
    return realm.description ? `${count} · ${realm.description}` : count;
  }
  return realm.description || "Open realm";
}

function matchRealms(
  realms: ReadonlyArray<IndexedRealm>,
  needle: string,
  limit: number
): CatalogDescriptor[] {
  const scored: Array<{ rank: number; order: number; realm: IndexedRealm }> = [];
  for (let i = 0; i < realms.length; i++) {
    const realm = realms[i]!;
    if (!realm._lower.includes(needle)) continue;
    scored.push({
      rank: rankText(realm._nameLower, realm._slugLower, needle),
      order: i,
      realm,
    });
  }
  scored.sort((a, b) => a.rank - b.rank || a.order - b.order);

  return scored.slice(0, limit).map(({ realm }) => ({
    kind: "realm",
    key: `realm-${realm.id}`,
    title: realm.name,
    description: formatRealmDescription(realm),
    category: "Realm",
    icon: Globe,
    slug: realm.slug,
    path: `/r/${encodeURIComponent(realm.slug)}`,
    thumbnail: realm.thumbnail ?? undefined,
  }));
}

function matchCountries(
  countries: ReadonlyArray<IndexedEntry<CountrySummary>>,
  needle: string,
  limit: number
): CatalogDescriptor[] {
  const out: CatalogDescriptor[] = [];
  for (const country of countries) {
    if (!country._lower.includes(needle)) continue;
    const slug = country.slug ?? country.id;
    out.push({
      kind: "country",
      key: `country-${country.id}`,
      title: country.name,
      description: country.economicTier ? `Tier: ${country.economicTier}` : "View country profile",
      category: "Country",
      flagUrl: country.flagUrl || country.flag || undefined,
      economicTier: country.economicTier,
      slug,
      path: `/countries/${slug}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function matchEntries<T extends CommandEntry | FeatureEntry>(
  kind: "command" | "feature",
  entries: ReadonlyArray<IndexedEntry<T>>,
  needle: string,
  limit: number
): CatalogDescriptor[] {
  const out: CatalogDescriptor[] = [];
  for (const entry of entries) {
    if (!entry._lower.includes(needle)) continue;
    out.push({
      kind,
      key: `${kind}-${entry.actionId ?? entry.path ?? entry.name}`,
      title: entry.name,
      description: entry.description,
      category: entry.category,
      icon: entry.icon,
      path: entry.path,
      actionId: entry.actionId,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function matchWiki(wiki: ReadonlyArray<WikiSearchItem>, limit: number): CatalogDescriptor[] {
  const out: CatalogDescriptor[] = [];
  for (const article of wiki) {
    out.push({
      kind: "wiki",
      key: `wiki-${article.title}`,
      title: article.title,
      description: article.snippet
        ? article.snippet.replace(/<[^>]*>/g, "").slice(0, 120)
        : "Wiki article",
      category: "Wiki",
      icon: Book,
      path: `/wiki/${encodeURIComponent(article.title.replace(/ /g, "_"))}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export interface SearchCatalogOptions {
  wikiFirst: boolean;
  pluginId?: string;
}

export function searchCatalog(
  query: string,
  filter: SearchFilter,
  sources: SearchSources,
  opts: SearchCatalogOptions
): CatalogDescriptor[] {
  if (!query.trim()) return [];

  const needle = query.toLowerCase();
  const limit = filter === "all" ? 3 : 12;

  const includePluginCommands =
    filter === "all" || filter === "commands" || (filter === "wiki" && opts.pluginId === "wiki");
  const pluginLimit = filter === "commands" ? 12 : 3;
  const pluginMatches =
    includePluginCommands && sources.pluginCommands?.length
      ? matchPluginCommands(sources.pluginCommands, opts.pluginId ?? "active", needle, pluginLimit)
      : [];

  const realms =
    filter === "all" && sources.realms?.length ? matchRealms(sources.realms, needle, 3) : [];
  const countries =
    filter === "all" || filter === "countries"
      ? matchCountries(sources.countries, needle, limit)
      : [];
  const commands =
    filter === "all" || filter === "commands"
      ? matchEntries("command", sources.commands, needle, limit)
      : [];
  const features =
    filter === "all" || filter === "features"
      ? matchEntries("feature", sources.features, needle, limit)
      : [];
  const wiki =
    query.length >= 2 && (filter === "all" || filter === "wiki")
      ? matchWiki(sources.wiki, limit)
      : [];

  if (filter === "commands") {
    return [...pluginMatches, ...commands].slice(0, 12);
  }
  if (filter === "wiki") {
    return [...pluginMatches, ...wiki].slice(0, 12);
  }
  if (filter === "all" && opts.wikiFirst) {
    return [...pluginMatches, ...wiki, ...realms, ...countries, ...commands, ...features].slice(
      0,
      12
    );
  }

  return [...pluginMatches, ...realms, ...countries, ...commands, ...features, ...wiki].slice(
    0,
    12
  );
}
