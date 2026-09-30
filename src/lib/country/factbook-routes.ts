/**
 * Factbook routing utilities — shared by the public country profile
 * (`/countries/[slug]`) and its nested factbook section routes.
 *
 * The country profile has two navigation tiers:
 *  - Tier 1 (top bar): Factbook / Dossier / Activity → `/factbook`, `/dossier`, `/activity`
 *  - Tier 2 (inner pills): five factbook sections → `/factbook`, `/factbook/economy`, ...
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

/** Canonical URL (relative) for a factbook section under a country slug. */
export function factbookSectionHref(section: FactbookSection, slug: string): string {
  const base = `/countries/${slug}/factbook`;
  return section === "overview" ? base : `${base}/${section}`;
}

/**
 * Legacy URL-hash deep links (`/countries/:slug#economy`, `#dossier`, ...)
 * mapped onto the equivalent nested route. Unknown hashes land on the factbook.
 */
const HASH_ROUTE_MAP: Record<string, string> = {
  overview: "/factbook",
  economy: "/factbook/economy",
  labor: "/factbook/labor",
  government: "/factbook/government",
  geography: "/factbook/geography",
  dossier: "/dossier",
  activity: "/activity",
  // Legacy v2 executive-drill kinds from V2DrillSheets — default to the factbook.
  relations: "/factbook",
  defense: "/factbook",
  politics: "/factbook",
};

export function hashToFactbookRoute(hash: string): string {
  const normalized = hash.replace(/^#/, "").toLowerCase();
  return HASH_ROUTE_MAP[normalized] ?? "/factbook";
}
