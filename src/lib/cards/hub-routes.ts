// src/lib/cards/hub-routes.ts
/**
 * The cards hub's addresses, and the new home of every old card address (spec §2.3 Hub). Client-safe: the standalone
 * WikiOS Lorewards view links into the hub with these, and `src/proxy.ts` answers the old addresses with them.
 */
import { stripBasePath } from "~/lib/base-path";
import { NS_REALM_ID } from "~/lib/realms/realm-ids";
import { withQuery, type PageQuery } from "~/lib/thinkpages-forum/links";

/** The cards hub's four tabs (spec §2.3 Hub), each its own address. */
export const CARD_HUB_TABS = ["mine", "sets", "market", "explore"] as const;
export type CardHubTab = (typeof CARD_HUB_TABS)[number];

export const CARD_HUB_PATHS = {
  mine: "/vault/cards/mine",
  sets: "/vault/cards/sets",
  market: "/vault/cards/market",
  explore: "/vault/cards/explore",
} as const satisfies Record<CardHubTab, string>;

export const CARD_HUB_TITLES = {
  mine: "Mine",
  sets: "Sets",
  market: "Market",
  explore: "Explore",
} as const satisfies Record<CardHubTab, string>;

/** The Store keeps packs, cosmetics and upgrades. */
export const STORE_PATH = "/vault/store";

/** The Market's sub-tabs (`?tab=`); Browse when absent or unknown. */
export const MARKET_TABS = ["browse", "trades", "wishlist", "selling"] as const;
export type MarketTab = (typeof MARKET_TABS)[number];

/** A pathname without the base path or a trailing slash. */
const barePath = (pathname: string) => stripBasePath(pathname).replace(/\/+$/, "");

/** The hub tab a pathname shows, or null outside the four tab pages. */
export function cardHubTabOf(rawPathname: string): CardHubTab | null {
  const pathname = barePath(rawPathname);
  return CARD_HUB_TABS.find((tab) => pathname === CARD_HUB_PATHS[tab]) ?? null;
}

export function marketTabOf(value: string | null | undefined): MarketTab {
  return MARKET_TABS.find((tab) => tab === value) ?? "browse";
}

/** A Market sub-tab, as a plain path (`<Link>` and notification hrefs add the base path). */
export function marketTabHref(tab: MarketTab): string {
  return withQuery(CARD_HUB_PATHS.market, { tab });
}

/** The trade builder on the Market Trades tab: an open trade, or a new one seeded with a partner and cards. */
export function tradeBuilderHref(args: {
  tradeId?: string;
  partner?: string;
  give?: string;
  get?: string;
}): string {
  const { tradeId = "new", partner, give, get } = args;
  return withQuery(CARD_HUB_PATHS.market, { tab: "trades", trade: tradeId, partner, give, get });
}

/** Old card addresses; every one redirects permanently. */
export type LegacyCardRoute =
  | "inventory"
  | "crafting"
  | "collections"
  | "collection"
  | "explore-collections"
  | "lore-gallery"
  | "lore-generator"
  | "ns-library"
  | "ns-deck"
  | "ns-deck-nation"
  | "market"
  | "marketplace"
  | "trading"
  | "packs";

interface Target {
  path: string;
  set?: Record<string, string>;
}

const first = (value: PageQuery[string]) => (Array.isArray(value) ? value[0] : value);

/** Where an old Store `?tab=` lives now: auctions and trading moved into the hub's Market. */
function storeTabTarget(tab: string | undefined): Target | null {
  if (tab === "auctions") return { path: CARD_HUB_PATHS.market };
  if (tab === "trading") return { path: CARD_HUB_PATHS.market, set: { tab: "trades" } };
  return null;
}

/**
 * The old marketplace with no auctions or trading tab: its Store tab is the Store, still on the view it showed (my
 * packs, cosmetics, upgrades); anything else is the hub's Market.
 */
function marketplaceTarget(query: PageQuery): Target {
  if (first(query.tab) !== "store") return { path: CARD_HUB_PATHS.market };
  const view = first(query.view);
  return { path: STORE_PATH, set: view ? { view } : undefined };
}

/** NationStates cards are a realm shelf in Explore; a system realm's slug is its id. */
const NS_EXPLORE: Target = { path: CARD_HUB_PATHS.explore, set: { realm: NS_REALM_ID } };

const LEGACY: Record<LegacyCardRoute, (query: PageQuery, param?: string) => Target> = {
  inventory: () => ({ path: CARD_HUB_PATHS.mine }),
  crafting: () => ({ path: CARD_HUB_PATHS.mine }),
  collections: () => ({ path: CARD_HUB_PATHS.sets }),
  "explore-collections": () => ({ path: CARD_HUB_PATHS.sets }),
  collection: (_query, id) => ({
    path: CARD_HUB_PATHS.sets,
    set: id ? { showcase: id } : undefined,
  }),
  "lore-gallery": () => ({ path: CARD_HUB_PATHS.explore }),
  // `?suggest=1` opens Explore's "Suggest a card" dialog.
  "lore-generator": () => ({ path: CARD_HUB_PATHS.explore, set: { suggest: "1" } }),
  "ns-library": () => NS_EXPLORE,
  "ns-deck-nation": () => NS_EXPLORE,
  "ns-deck": () => ({ path: "/vault/import" }),
  market: () => ({ path: CARD_HUB_PATHS.market }),
  trading: () => ({ path: CARD_HUB_PATHS.market, set: { tab: "trades" } }),
  packs: () => ({ path: STORE_PATH, set: { view: "packs" } }),
  marketplace: (query) => storeTabTarget(first(query.tab)) ?? marketplaceTarget(query),
};

/** The query an old page came with, minus its own `tab` and `view`: those named old screens. */
function carried(query: PageQuery): PageQuery {
  return Object.fromEntries(
    Object.entries(query).filter(([key]) => key !== "tab" && key !== "view")
  );
}

/** The new home of an old card address, keeping the rest of its query (`?card=` opens the sheet there). */
export function legacyCardRedirect(
  route: LegacyCardRoute,
  query: PageQuery,
  param?: string
): string {
  const target = LEGACY[route](query, param);
  return withQuery(target.path, { ...carried(query), ...target.set });
}

/** For `/vault/store`: where an old `?tab=auctions|trading` link now goes, or null to stay in the Store. */
export function storeTabRedirect(query: PageQuery): string | null {
  const target = storeTabTarget(first(query.tab));
  return target ? withQuery(target.path, { ...carried(query), ...target.set }) : null;
}

/** The old card pages without a path parameter. */
const LEGACY_PAGES: ReadonlyMap<string, LegacyCardRoute> = new Map<string, LegacyCardRoute>([
  ["/vault/inventory", "inventory"],
  ["/vault/crafting", "crafting"],
  ["/vault/collections", "collections"],
  ["/explore/collections", "explore-collections"],
  ["/vault/lore-gallery", "lore-gallery"],
  ["/vault/lore-generator", "lore-generator"],
  ["/vault/ns-library", "ns-library"],
  ["/vault/ns-deck", "ns-deck"],
  ["/vault/market", "market"],
  ["/vault/marketplace", "marketplace"],
  ["/vault/trading", "trading"],
  ["/vault/packs", "packs"],
]);
/** `/vault/collections/<id>`: one collection, which became a showcase. */
const COLLECTION_PAGE = /^\/vault\/collections\/([^/]+)$/;
/** `/vault/ns-deck/<nation>`: the old public NS deck viewer. */
const NS_DECK_NATION_PAGE = /^\/vault\/ns-deck\/[^/]+$/;

/** A query string (with or without its `?`) as a page receives it. */
function pageQueryOf(search: string): PageQuery {
  const params = new URLSearchParams(search);
  return Object.fromEntries([...new Set(params.keys())].map((key) => [key, params.getAll(key)]));
}

/** Which old card page a base-path-free path is, with its path parameter; null for every other path. */
function legacyPageOf(path: string): { route: LegacyCardRoute; param?: string } | null {
  const route = LEGACY_PAGES.get(path);
  if (route) return { route };
  const collection = COLLECTION_PAGE.exec(path);
  if (collection) return { route: "collection", param: collection[1] };
  return NS_DECK_NATION_PAGE.test(path) ? { route: "ns-deck-nation" } : null;
}

/**
 * The new home of an old card address, for `src/proxy.ts` to answer with a 308 (a redirect thrown by the page would
 * stream as a 200 under the Vault's loading boundary); null for every other address. `search` is the request's query
 * string, read only once the path matches. The bare hub address `/vault/cards` is not an old one (see below).
 */
export function legacyCardRedirectFor(pathname: string, search: string): string | null {
  const path = barePath(pathname);
  if (path === STORE_PATH) return storeTabRedirect(pageQueryOf(search));
  const page = legacyPageOf(path);
  return page ? legacyCardRedirect(page.route, pageQueryOf(search), page.param) : null;
}

/** The hub's own address, which has no page: it opens on Mine. */
const CARD_HUB_INDEX = "/vault/cards";

/**
 * For `src/proxy.ts`: the bare hub address opens Mine with its query (`?card=`) kept; null for every other address.
 * The proxy answers it with a 307, not a 308, so browsers do not remember which tab the hub opens on.
 */
export function cardHubIndexRedirectFor(pathname: string, search: string): string | null {
  return barePath(pathname) === CARD_HUB_INDEX
    ? withQuery(CARD_HUB_PATHS.mine, pageQueryOf(search))
    : null;
}
