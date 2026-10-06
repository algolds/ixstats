/**
 * Factbook routing utilities — shared by the public country profile
 * (`/countries/[slug]`) and its nested factbook section routes.
 *
 * The country profile has two navigation tiers:
 *  - Tier 1 (top bar): Factbook / Dossier / Activity → `/countries/:slug` (the Factbook, which
 *    opens on its overview), `/dossier`, `/activity`
 *  - Tier 2 (inner pills): five factbook sections → `/countries/:slug` (overview),
 *    `/factbook/economy`, `/factbook/labor`, ...
 *
 * `/countries/:slug/factbook` is the old Factbook index; it redirects to `/countries/:slug`.
 *
 * This module centralizes the section list + pathname/hash mapping so both the
 * routes and their Jest tests use the exact same source of truth.
 */

export const FACTBOOK_SECTIONS = [
  "overview",
  "economy",
  "labor",
  "government",
  "geography",
] as const;

export type FactbookSection = (typeof FACTBOOK_SECTIONS)[number];

export function isFactbookSection(value: string): value is FactbookSection {
  return (FACTBOOK_SECTIONS as readonly string[]).includes(value);
}

/**
 * Resolve the active factbook section from a pathname like
 * `/countries/acme/factbook/economy`. Any unknown or missing segment resolves
 * to `overview`.
 */
export function sectionFromPathname(pathname: string): FactbookSection {
  const parts = pathname.split("/").filter(Boolean);
  const fbIndex = parts.indexOf("factbook");
  const candidate = fbIndex >= 0 ? parts[fbIndex + 1] : undefined;
  if (candidate !== undefined && isFactbookSection(candidate)) return candidate;
  return "overview";
}

/**
 * Canonical URL (relative) for a factbook section under a country slug. The overview is the
 * country's own URL; the other sections live under `/factbook`.
 */
export function factbookSectionHref(section: FactbookSection, slug: string): string {
  const base = `/countries/${slug}`;
  return section === "overview" ? base : `${base}/factbook/${section}`;
}

/**
 * Legacy URL-hash deep links (`/countries/:slug#economy`, `#dossier`, ...)
 * mapped onto the equivalent nested route, relative to `/countries/:slug`. The empty route is
 * the country's own URL (the Factbook overview). Unknown hashes land on the Factbook overview.
 */
const HASH_ROUTE_MAP: Record<string, string> = {
  overview: "",
  economy: "/factbook/economy",
  labor: "/factbook/labor",
  government: "/factbook/government",
  geography: "/factbook/geography",
  dossier: "/dossier",
  activity: "/activity",
  // Legacy executive-drill kinds: default to the Factbook overview.
  relations: "",
  defense: "",
  politics: "",
};

export function hashToFactbookRoute(hash: string): string {
  return legacyHashRoute(hash) ?? "";
}

/**
 * The route a legacy hash deep link on the bare country URL moved to, or `null` when the hash is
 * empty, not a legacy tab, or already belongs on the country's own URL (the Factbook overview
 * renders in place; its own anchors keep working).
 */
export function legacyHashRoute(hash: string): string | null {
  const normalized = hash.replace(/^#/, "").toLowerCase();
  const route = Object.hasOwn(HASH_ROUTE_MAP, normalized) ? HASH_ROUTE_MAP[normalized]! : null;
  return route === "" ? null : route;
}
