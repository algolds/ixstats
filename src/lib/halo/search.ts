import type { ComponentType } from "react";
import { Book, Globe, LogIn, LogOut } from "iconoir-react";
import {
  commandsFor,
  type CommandEntry,
  type FeatureEntry,
  type SystemActionId,
} from "~/components/halo/halo-registry";
import type { CountrySummary, SearchFilter } from "~/components/halo/types";
import { commandsFromVisibleApps } from "~/lib/halo/commands-from-apps";
import type { AppDefinition } from "~/lib/navigation/app-sections";

export type IndexedEntry<T> = T & { _lower: string };

export interface WikiSearchItem {
  title: string;
  snippet?: string | null;
}

export interface SearchSources {
  countries: ReadonlyArray<IndexedEntry<CountrySummary>>;
  commands: ReadonlyArray<IndexedEntry<CommandEntry>>;
  features: ReadonlyArray<IndexedEntry<FeatureEntry>>;
  wiki: ReadonlyArray<WikiSearchItem>;
}

export interface CatalogDescriptor {
  kind: "country" | "command" | "feature" | "wiki";
  key: string;
  title: string;
  description: string;
  category: string;
  icon?: ComponentType<{ className?: string }>;
  flagUrl?: string;
  economicTier?: string;
  slug?: string;
  path?: string;
  actionId?: SystemActionId;
}

export function buildIndex<
  T extends {
    name: string;
    description?: string;
    category?: string;
    keywords?: string[];
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

export function searchCatalog(
  query: string,
  filter: SearchFilter,
  sources: SearchSources,
  opts: { wikiFirst: boolean }
): CatalogDescriptor[] {
  if (!query.trim()) return [];

  const needle = query.toLowerCase();
  const limit = filter === "all" ? 3 : 12;

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

  if (filter === "all" && opts.wikiFirst) {
    return [...wiki, ...countries, ...commands, ...features].slice(0, 12);
  }

  return [...countries, ...commands, ...features, ...wiki].slice(0, 12);
}
