/**
 * The country document's addresses (`/countries/[slug]`): its four ribbon tabs, each its own URL,
 * the Factbook's sheets (`?sheet=`), and the new home of every old country route. Client-safe;
 * the tab pages, the router and the legacy redirect pages share it.
 */

/** The ribbon's tabs, in order. The Factbook is the country's own URL. */
export const COUNTRY_TABS = ["factbook", "map", "lore", "history"] as const;
export type CountryTab = (typeof COUNTRY_TABS)[number];

/** The Factbook blocks' detail sheets. */
const COUNTRY_SHEETS = ["economy", "state", "foreign"] as const;
export type CountrySheet = (typeof COUNTRY_SHEETS)[number];

/** The Economy & people sheet's two segments. */
const ECONOMY_SEGMENTS = ["economy", "labor"] as const;
export type EconomySegment = (typeof ECONOMY_SEGMENTS)[number];

const isOneOf = <T extends string>(
  list: readonly T[],
  value: string | null | undefined
): value is T => value != null && (list as readonly string[]).includes(value);

export function countryTabHref(tab: CountryTab, slug: string): string {
  const base = `/countries/${slug}`;
  return tab === "factbook" ? base : `${base}/${tab}`;
}

/** The tab a pathname shows (any base path, trailing slash ignored); unknown → Factbook. */
export function countryTabOf(pathname: string): CountryTab {
  const parts = pathname.split(/[?#]/)[0]!.split("/").filter(Boolean);
  const at = parts.indexOf("countries");
  const segment = at >= 0 ? parts[at + 2] : undefined;
  return isOneOf(COUNTRY_TABS, segment) ? segment : "factbook";
}

export function countrySheetHref(
  slug: string,
  sheet: CountrySheet,
  segment?: EconomySegment
): string {
  const query = new URLSearchParams({ sheet });
  if (sheet === "economy" && segment === "labor") query.set("segment", "labor");
  return `${countryTabHref("factbook", slug)}?${query.toString()}`;
}

/** The open sheet from the query; null when none or unknown. */
export function parseSheet(
  params: Pick<URLSearchParams, "get"> | null
): { sheet: CountrySheet; segment: EconomySegment } | null {
  const sheet = params?.get("sheet");
  if (!isOneOf(COUNTRY_SHEETS, sheet)) return null;
  const segment = params?.get("segment");
  return { sheet, segment: isOneOf(ECONOMY_SEGMENTS, segment) ? segment : "economy" };
}

/** The new home of an old country route (`rest` = the path after `/countries/[slug]`). */
export function legacyCountryRedirect(slug: string, rest: readonly string[]): string {
  const [first, second] = rest;
  if (first === "activity") return countryTabHref("history", slug);
  if (first === "dossier") return countryTabHref("lore", slug);
  if (first === "factbook") {
    if (second === "labor") return countrySheetHref(slug, "economy", "labor");
    if (second === "government") return countrySheetHref(slug, "state");
    if (second === "geography") return countryTabHref("map", slug);
    return countrySheetHref(slug, "economy");
  }
  return countryTabHref("factbook", slug);
}
