/**
 * The stored province adjacency graph (`MapLayer.neighbors`): which active political features of a realm touch.
 * Built from PostGIS; run by the admin `rebuildAdjacency` mutation and after a map import (AT-16).
 */
import type { PrismaClient } from "@prisma/client";
import { isPostGISAvailable } from "./geo-validation";

export interface AdjacencyResult {
  features: number;
  pairs: number;
  skipped?: true;
}

/**
 * Requires PostGIS (skipped without it). Safe to re-run: every active political feature's neighbors are
 * overwritten, and a feature that no longer touches anything is cleared.
 */
export async function rebuildAdjacency(
  db: PrismaClient,
  realmId: string
): Promise<AdjacencyResult> {
  if (!(await isPostGISAvailable(db))) return { features: 0, pairs: 0, skipped: true };
  const pairs = await db.$queryRawUnsafe<Array<{ a: string; b: string }>>(
    `SELECT a."featureId" AS a, b."featureId" AS b
       FROM map_layers a
       JOIN map_layers b
         ON a.id < b.id
        AND a."layerType" = 'political' AND a."isActive" = true
        AND b."layerType" = 'political' AND b."isActive" = true
        AND a."worldId" = $1 AND b."worldId" = $1
        AND a.geom_postgis IS NOT NULL AND b.geom_postgis IS NOT NULL
        AND ST_Intersects(a.geom_postgis, b.geom_postgis)
        AND NOT ST_Equals(a.geom_postgis, b.geom_postgis)`,
    realmId
  );
  const adj = new Map<string, Set<string>>();
  for (const { a, b } of pairs) {
    (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
    (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a);
  }
  // Features left without a neighbour (an island, or a neighbour removed) would keep a stale list
  await db.mapLayer.updateMany({
    where: {
      layerType: "political",
      isActive: true,
      realmId,
      featureId: { notIn: Array.from(adj.keys()) },
      NOT: { neighbors: { equals: [] } },
    },
    data: { neighbors: [] },
  });
  let updated = 0;
  for (const [featureId, set] of Array.from(adj.entries())) {
    await db.mapLayer.updateMany({
      where: { layerType: "political", featureId, isActive: true, realmId },
      data: { neighbors: Array.from(set) },
    });
    updated++;
  }
  return { features: updated, pairs: pairs.length };
}
