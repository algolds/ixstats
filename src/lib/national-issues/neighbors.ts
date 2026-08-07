/**
 * Neighbor resolution for the National Issues engine (plan 002, Phase 3).
 *
 * Uses live PostGIS ST_Touches over the active political map_layers to find a
 * country's real neighbors — gated + memoized per evaluation so the engine never
 * pays the spatial-join cost more than once per country per request.
 */

import type { PrismaClient } from "@prisma/client";

export interface Neighbor {
  name: string;
  countryId: string | null;
}

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { at: number; value: Neighbor[] }>();

/** Gated: enabled unless ISSUES_NEIGHBORS=0 (mirrors gameplay-flags posture). */
function enabled(): boolean {
  const v = process.env.ISSUES_NEIGHBORS;
  if (v === undefined || v === "") return true;
  return v !== "0" && v.toLowerCase() !== "false";
}

/**
 * Resolve real neighbor names/countryIds via PostGIS ST_Touches. Returns [] when
 * gated off, when the country has no political map layer, or on any spatial error.
 * Cached for 60s per country.
 */
export async function resolveNeighbors(
  countryId: string,
  db: PrismaClient
): Promise<Neighbor[]> {
  if (!enabled()) return [];

  const cached = cache.get(countryId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const mapLayer = await (db as any).mapLayer.findFirst({
      where: { layerType: "political", countryId, isActive: true },
      select: { id: true },
    });
    if (!mapLayer) return [];

    const dbNeighbors = (await (db as any).$queryRawUnsafe(
      `SELECT ml2."featureId", ml2."displayName", ml2."countryId"
       FROM map_layers ml1
       JOIN map_layers ml2 ON ml2."layerType" = 'political'
         AND ml2."isActive" = true
         AND ml2.id != ml1.id
         AND ml1.geom_postgis IS NOT NULL
         AND ml2.geom_postgis IS NOT NULL
         AND ST_Touches(ST_MakeValid(ml1.geom_postgis), ST_MakeValid(ml2.geom_postgis))
       WHERE ml1.id = $1`,
      mapLayer.id
    )) as Array<{ featureId: string; displayName: string | null; countryId: string | null }>;

    const value: Neighbor[] = dbNeighbors
      .map((n) => ({
        name: n.displayName || n.featureId,
        countryId: n.countryId ?? null,
      }))
      .filter((n) => Boolean(n.name))
      .slice(0, 12);

    cache.set(countryId, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.warn(`[Neighbors] Failed to resolve neighbors for ${countryId}:`, err);
    return [];
  }
}

/** Test seam: clear the memo cache. */
export function clearNeighborCache(): void {
  cache.clear();
}
