import type { Prisma, PrismaClient } from "@prisma/client";
import { distanceKmLatLng } from "~/lib/maps/geo-math";

type Db = PrismaClient | Prisma.TransactionClient;

/** A resource POI counts as connected when a hub or route vertex is within this many km. */
const CONNECTION_RADIUS_KM = 15;
/** Defensive cap per query; a country never legitimately has more than this. */
const MAX_ROWS = 500;

/**
 * Recompute the "connected to transport" flag on every approved resource POI of a country
 * and mirror it into a StorytellerEffect (`resource_<type>_output`). Effects belonging to
 * deleted POIs are deactivated.
 *
 * Single implementation shared by the geo feature routers and the transport router
 * (five copies were folded into this one on 2026-09-25, plan 345).
 */
export async function syncResourcePoolModifiers(db: Db, countryId: string) {
  const resources = await db.pointOfInterest.findMany({
    where: { countryId, category: "resource", status: "approved" },
    take: MAX_ROWS,
  });
  const routes = await db.transportRoute.findMany({
    where: { countryId, status: "operational" },
    take: MAX_ROWS,
  });
  const hubs = await db.transportHub.findMany({ where: { countryId }, take: MAX_ROWS });

  const routeVertices: [number, number][] = [];
  for (const route of routes) {
    const coords = (route.geometry as { coordinates?: unknown } | null)?.coordinates;
    if (Array.isArray(coords)) routeVertices.push(...(coords as [number, number][]));
  }
  const hubPoints = hubs
    .map((hub) => hub.coordinates as [number, number] | null)
    .filter((c): c is [number, number] => Array.isArray(c) && c.length >= 2);

  for (const resource of resources) {
    const resCoords = resource.coordinates as [number, number] | null;
    if (!resCoords || !Array.isArray(resCoords) || resCoords.length < 2) continue;
    const [resLng, resLat] = resCoords;

    const near = (pt: [number, number]) =>
      distanceKmLatLng(resLat, resLng, pt[1], pt[0]) <= CONNECTION_RADIUS_KM;
    const isConnected = hubPoints.some(near) || routeVertices.some(near);

    const existingMeta = (resource.metadata as Record<string, unknown> | null) ?? {};
    const resourceType = (existingMeta.resourceType as string | undefined) || "minerals";
    const quality = existingMeta.quality !== undefined ? Number(existingMeta.quality) : 0.5;

    await db.pointOfInterest.update({
      where: { id: resource.id },
      data: { metadata: { ...existingMeta, isConnected, resourceType, quality } },
    });

    const inputType = `resource_${resourceType}_output`;
    const effectValue = isConnected ? quality * 100 : 0;
    const description = `Resource output for ${resource.name} (${resourceType}, quality: ${quality.toFixed(2)}, connected: ${isConnected})`;
    const createdBy = `resource_node_${resource.id}`;

    const existingEffect = await db.storytellerEffect.findFirst({
      where: { countryId, inputType, createdBy },
    });

    if (existingEffect) {
      await db.storytellerEffect.update({
        where: { id: existingEffect.id },
        data: { value: effectValue, description, isActive: isConnected, ixTimeTimestamp: new Date() },
      });
    } else {
      await db.storytellerEffect.create({
        data: {
          countryId,
          inputType,
          value: effectValue,
          description,
          isActive: isConnected,
          createdBy,
          ixTimeTimestamp: new Date(),
        },
      });
    }
  }

  // Deactivate storyteller effects for any deleted resource POIs.
  const activeIds = new Set(resources.map((r) => r.id));
  const obsoleteEffects = await db.storytellerEffect.findMany({
    where: { countryId, createdBy: { startsWith: "resource_node_" }, isActive: true },
  });
  for (const eff of obsoleteEffects) {
    if (activeIds.has((eff.createdBy ?? "").replace("resource_node_", ""))) continue;
    await db.storytellerEffect.update({
      where: { id: eff.id },
      data: { isActive: false, value: 0, description: "Resource POI deleted", ixTimeTimestamp: new Date() },
    });
  }
}
