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
 * This module centralizes the section list + pathname mapping so both the
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
