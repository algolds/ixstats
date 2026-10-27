/**
 * migrate-routes-to-segments.ts — ETL migration from point-to-point TransportRoutes to
 * OSM-style TransportNodes, TransportSegments, and TransportRouteSegments.
 *
 * Usage:
 *   bun run scripts/archive/migrations/migrate-routes-to-segments.ts          # dry run
 *   bun run scripts/archive/migrations/migrate-routes-to-segments.ts --apply  # write changes
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

interface GeoJSONLineString {
  type: string;
  coordinates: [number, number][];
}

function distanceKm(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);
  const cosLat1 = Math.cos((lat1 * Math.PI) / 180);
  const cosLat2 = Math.cos((lat2 * Math.PI) / 180);
  const aVal = sinHalfLat * sinHalfLat + cosLat1 * cosLat2 * sinHalfLng * sinHalfLng;
  return 2 * R * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

async function main() {
  console.log(`[migrate-routes-to-segments] Mode: ${APPLY ? "APPLY (writes enabled)" : "DRY RUN"}`);

  // 1. Fetch all routes and hubs
  const routes = await prisma.transportRoute.findMany();
  const hubs = await prisma.transportHub.findMany();
  const cities = await prisma.city.findMany({
    select: { id: true, name: true, countryId: true, latitude: true, longitude: true },
  });

  console.log(`Found ${routes.length} routes, ${hubs.length} hubs, and ${cities.length} cities.`);

  // In-memory node registry for proximity deduplication (< 0.01 deg ~= 1 km)
  interface TempNode {
    id: string;
    coordinates: [number, number];
    nodeType: string;
    cityId?: string | null;
    countryId?: string | null;
    name?: string | null;
    worldId: string;
  }

  const nodes: TempNode[] = [];

  function findOrCreateNode(
    coord: [number, number],
    countryId?: string | null,
    worldId = "default",
    nameHint?: string | null
  ): TempNode {
    // Check if node exists within ~0.01 deg
    for (const n of nodes) {
      if (Math.abs(n.coordinates[0] - coord[0]) < 0.01 && Math.abs(n.coordinates[1] - coord[1]) < 0.01) {
        return n;
      }
    }

    // Check if near a known city (< 2 km)
    let matchedCityId: string | null = null;
    let matchedCityName: string | null = null;
    for (const city of cities) {
      if (
        city.latitude != null &&
        city.longitude != null &&
        distanceKm(coord, [city.longitude, city.latitude]) < 2
      ) {
        matchedCityId = city.id;
        matchedCityName = city.name;
        break;
      }
    }

    const newNode: TempNode = {
      id: `tn_${nodes.length + 1}_${Math.random().toString(36).slice(2, 8)}`,
      coordinates: coord,
      nodeType: matchedCityId ? "city" : "waypoint",
      cityId: matchedCityId,
      countryId: countryId ?? null,
      name: matchedCityName ?? nameHint ?? null,
      worldId,
    };

    nodes.push(newNode);
    return newNode;
  }

  // 2. Pre-seed nodes from TransportHubs
  let hubNodesConverted = 0;
  for (const hub of hubs) {
    const coords = hub.coordinates as [number, number];
    if (Array.isArray(coords) && coords.length >= 2) {
      const node = findOrCreateNode(coords, hub.countryId, hub.worldId, hub.name);
      node.nodeType = hub.hubType;
      node.name = hub.name;
      hubNodesConverted++;
    }
  }

  console.log(`Converted / mapped ${hubNodesConverted} hubs to candidate nodes.`);

  // 3. Build segments from routes
  interface TempSegment {
    id: string;
    routeId: string;
    fromNodeId: string;
    toNodeId: string;
    routeType: string;
    geometry: GeoJSONLineString;
    status: string;
    builtYear?: number | null;
    lengthKm?: number | null;
    terrainDifficulty?: number | null;
    capacity?: number | null;
    properties?: any;
    isInternational: boolean;
    countryId?: string | null;
    worldId: string;
    order: number;
  }

  const segments: TempSegment[] = [];

  for (const route of routes) {
    const geom = route.geometry as unknown as GeoJSONLineString;
    if (!geom || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
      continue;
    }

    const coords = geom.coordinates;
    const startCoord = coords[0]!;
    const endCoord = coords[coords.length - 1]!;

    const fromNode = findOrCreateNode(startCoord, route.countryId, route.worldId, route.name ? `${route.name} (Start)` : null);
    const toNode = findOrCreateNode(endCoord, route.countryId, route.worldId, route.name ? `${route.name} (End)` : null);

    const segId = `ts_${segments.length + 1}_${Math.random().toString(36).slice(2, 8)}`;
    segments.push({
      id: segId,
      routeId: route.id,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      routeType: route.routeType,
      geometry: geom,
      status: route.status,
      builtYear: route.builtYear,
      lengthKm: route.lengthKm,
      terrainDifficulty: route.terrainDifficulty,
      capacity: route.capacity,
      properties: route.properties,
      isInternational: route.isInternational,
      countryId: route.countryId,
      worldId: route.worldId,
      order: 0,
    });
  }

  console.log(`Generated ${nodes.length} unique nodes and ${segments.length} network segments across ${routes.length} routes.`);

  if (!APPLY) {
    console.log(`\n[DRY RUN SUMMARY]`);
    console.log(`- Nodes to create: ${nodes.length}`);
    console.log(`- Segments to create: ${segments.length}`);
    console.log(`- Route-segment joins: ${segments.length}`);
    console.log(`To apply changes to the database, run with --apply.`);
    return;
  }

  // 4. Apply changes transactionally or in batches
  console.log(`Writing nodes to database...`);
  const nodeDbMap = new Map<string, string>(); // temp id -> actual db cuid

  for (const n of nodes) {
    const created = await (prisma as any).transportNode.create({
      data: {
        coordinates: n.coordinates,
        nodeType: n.nodeType,
        cityId: n.cityId,
        countryId: n.countryId,
        name: n.name,
        worldId: n.worldId,
      },
    });
    nodeDbMap.set(n.id, created.id);
  }

  console.log(`Writing segments and route joins...`);
  for (const s of segments) {
    const actualFrom = nodeDbMap.get(s.fromNodeId);
    const actualTo = nodeDbMap.get(s.toNodeId);
    if (!actualFrom || !actualTo) continue;

    const createdSeg = await (prisma as any).transportSegment.create({
      data: {
        fromNodeId: actualFrom,
        toNodeId: actualTo,
        routeType: s.routeType,
        geometry: s.geometry,
        status: s.status,
        builtYear: s.builtYear,
        lengthKm: s.lengthKm,
        terrainDifficulty: s.terrainDifficulty,
        capacity: s.capacity,
        properties: s.properties,
        isInternational: s.isInternational,
        countryId: s.countryId,
        worldId: s.worldId,
      },
    });

    await (prisma as any).transportRouteSegment.create({
      data: {
        routeId: s.routeId,
        segmentId: createdSeg.id,
        order: s.order,
        direction: "forward",
      },
    });
  }

  console.log(`Migration complete! Successfully written ${nodes.length} nodes and ${segments.length} segments.`);
}

main()
  .catch((err) => {
    console.error("[migrate-routes-to-segments] ERROR:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
