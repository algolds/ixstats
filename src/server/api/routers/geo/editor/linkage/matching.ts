/**
 * Auto-Match inputs and writes for one realm: its unlinked political regions, its nations with every name they
 * go by (name, wiki page title, source key, the roster's nation page titles), read in id-ordered pages so a large
 * map is never cut at the 1,000-row guard; and linking reviewed matches, several regions to a nation allowed.
 */
import type { PrismaClient } from "@prisma/client";
import { findAllById } from "~/lib/system/find-all-by-id";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import {
  coreName,
  suggestRegionMatches,
  type MatchSuggestion,
  type MatchableNation,
} from "~/lib/maps/nation-name-matching";

type MatchDb = Pick<PrismaClient, "mapLayer" | "country" | "realmPage">;

/** Match suggestions for the realm's unlinked regions, highest confidence first. */
export async function realmMatchSuggestions(
  db: MatchDb,
  realmId: string
): Promise<{ suggestions: MatchSuggestion[]; unlinkedRegions: number }> {
  const [regions, countries, pages] = await Promise.all([
    findAllById((page) =>
      db.mapLayer.findMany({
        where: { layerType: "political", isActive: true, realmId, countryId: null },
        select: { id: true, featureId: true, displayName: true },
        ...page,
      })
    ),
    findAllById((page) =>
      db.country.findMany({
        where: { realmId, isDemo: false },
        select: { id: true, name: true, wikiPageTitle: true, externalSourceKey: true },
        ...page,
      })
    ),
    findAllById((page) =>
      db.realmPage.findMany({
        where: { realmId, kind: "nation" },
        select: { id: true, title: true },
        ...page,
      })
    ),
  ]);

  // A roster page names a nation when it is the nation's wiki page or the same name with a state form
  // ("Republic of Gallambria" for Gallambria).
  const pagesByCore = new Map<string, string[]>();
  for (const page of pages) {
    const key = coreName(page.title);
    pagesByCore.set(key, [...(pagesByCore.get(key) ?? []), page.title]);
  }
  const nations: MatchableNation[] = countries.map((c) => ({
    id: c.id,
    name: c.name,
    aliases: [
      c.wikiPageTitle,
      c.externalSourceKey,
      ...(pagesByCore.get(coreName(c.name)) ?? []),
      ...(c.wikiPageTitle ? (pagesByCore.get(coreName(c.wikiPageTitle)) ?? []) : []),
    ],
  }));

  return { suggestions: suggestRegionMatches(regions, nations), unlinkedRegions: regions.length };
}

/**
 * Link each region to its nation, if the region is still unlinked and active in the realm and the nation belongs
 * to it; then sync each nation's outline once (the union of all its regions). Returns how many regions it linked.
 */
export async function linkRegionMatches(
  db: MatchDb,
  realmId: string,
  matches: ReadonlyArray<{ featureId: string; countryId: string }>
): Promise<number> {
  if (matches.length === 0) return 0;
  const realmCountries = new Set(
    (
      await db.country.findMany({
        where: { id: { in: [...new Set(matches.map((m) => m.countryId))] }, realmId },
        select: { id: true },
        take: matches.length,
      })
    ).map((c) => c.id)
  );
  let linked = 0;
  const synced = new Set<string>();
  for (const { featureId, countryId } of matches) {
    if (!realmCountries.has(countryId)) continue;
    const { count } = await db.mapLayer.updateMany({
      where: { layerType: "political", isActive: true, realmId, featureId, countryId: null },
      data: { countryId },
    });
    if (count > 0) {
      linked += count;
      synced.add(countryId);
    }
  }
  for (const countryId of synced) await syncCountryGeometryFromMapLayer(db, countryId);
  return linked;
}
