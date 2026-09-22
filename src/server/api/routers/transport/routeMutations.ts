/**
 * routeMutations.ts — tRPC mutations for transport infrastructure.
 *
 * Provides CRUD for transport routes and hubs, plus procedural
 * route generation using terrain-aware pathfinding.
 */

import { z } from "zod/v4";
import type { PrismaClient, Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import {
  generateTransportNetwork,
  estimateCoastalCities,
  type CityNode,
  type RouteType,
} from "~/lib/economy/transport-generator";
import { calculateRouteCosts } from "~/lib/economy/transport-costs";
import { syncResourcePoolModifiers } from "~/server/shared/geo-resource-sync";
import { syncTransportEconomicModifiers } from "~/server/shared/transport-sync";
import {
  polylineLengthKm,
  normalizeTerrainDifficulty,
  samplePolylinePoints,
} from "~/lib/maps/geo-math";
import { getTerrainAtPoint } from "~/lib/country-geo";

type JsonPrimitive = string | number | boolean | null;
type JsonObject = Record<string, JsonPrimitive | JsonPrimitive[] | Record<string, JsonPrimitive>>;

const lineStringGeometrySchema = z.object({
  type: z.string(),
  coordinates: z.array(z.array(z.number())),
});

const routePropertiesSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()),
    z.array(z.number()),
  ])
);

export const transportRouteMutationsRouter = createTRPCRouter({
  /**
   * Generate transport network procedurally for a country.
   * Available to country owners (generates for their own country) and admins.
   */
  generateRoutes: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        routeTypes: z
          .array(
            z.enum([
              "rail", "high_speed_rail", "freight_rail", "commuter_rail",
              "motorway", "highway", "trunk", "road", "secondary",
              "shipping_lane", "canal", "air_corridor", "ferry",
              "pipeline", "power_grid", "fiber", "military_supply", "military_naval",
            ])
          )
          .default(["rail", "highway"]),
        clearExisting: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get country + cities
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          id: true,
          name: true,
          boundingBox: true,
          coastlineKm: true,
          cities: {
            where: { status: "approved" },
            select: {
              id: true,
              name: true,
              coordinates: true,
              population: true,
              isNationalCapital: true,
            },
          },
        },
      });

      if (!country) throw new Error("Country not found");
      if (country.cities.length < 2) throw new Error("Need at least 2 cities to generate routes");

      const bbox = country.boundingBox as [number, number, number, number] | null;
      if (!bbox) throw new Error("Country has no bounding box");

      // Fetch airport POIs for air corridor generation
      const airportPois = input.routeTypes.includes("air_corridor")
        ? await ctx.db.pointOfInterest.findMany({
            where: { countryId: input.countryId, status: "approved", category: "airport" },
            select: { id: true, coordinates: true },
          })
        : [];

      // Build city nodes
      let cityNodes: CityNode[] = country.cities
        .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
        .map((c) => {
          const cityCoords = c.coordinates as [number, number];
          // Check if this city has an airport POI nearby
          const hasAirport = airportPois.some((poi) => {
            const poiCoords = poi.coordinates as [number, number] | null;
            if (!poiCoords || !Array.isArray(poiCoords)) return false;
            // Airport within ~50km of city center
            const dist = Math.sqrt(
              (poiCoords[0] - cityCoords[0]) ** 2 + (poiCoords[1] - cityCoords[1]) ** 2
            );
            return dist < 0.5; // ~50km at mid-latitudes
          });
          return {
            id: c.id,
            name: c.name,
            coordinates: cityCoords,
            population: c.population ?? 0,
            isCapital: c.isNationalCapital,
            hasAirport,
          };
        });

      // Mark coastal cities if country has coastline
      if ((country.coastlineKm ?? 0) > 0) {
        // Use country boundary points as coastline approximation
        const countryGeo = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { geometry: true },
        });
        if (countryGeo?.geometry) {
          const coords = extractBoundaryCoords(countryGeo.geometry);
          cityNodes = estimateCoastalCities(cityNodes, coords, 50);
        }
      }

      // Clear existing routes if requested
      if (input.clearExisting) {
        await ctx.db.transportRoute.deleteMany({ where: { countryId: input.countryId } });
        await ctx.db.transportHub.deleteMany({ where: { countryId: input.countryId } });
      }

      // Generate routes
      const generated = generateTransportNetwork(
        { cities: cityNodes, countryBbox: bbox },
        input.routeTypes as RouteType[]
      );

      // Save to database
      let created = 0;
      const hubCityIds = new Set<string>();

      for (const route of generated) {
        const { costBillion, maintenanceCost } = calculateRouteCosts({
          routeType: route.routeType,
          lengthKm: route.lengthKm,
          terrainDifficulty: route.terrainDifficulty,
        });
        await ctx.db.transportRoute.create({
          data: {
            countryId: input.countryId,
            routeType: route.routeType,
            name: route.name,
            geometry: route.geometry,
            stops: route.stops,
            properties: {
              ...((route.properties as JsonObject | null) || {}),
              costBillion,
              maintenanceCost,
            },
            isInternational: route.isInternational,
            status: "operational",
            terrainDifficulty: route.terrainDifficulty,
            lengthKm: route.lengthKm,
            speedKmh: typeof route.properties?.speed_kmh === "number" ? route.properties.speed_kmh : null,
          } as Prisma.TransportRouteCreateInput,
        });
        created++;

        // Collect hub cities
        for (const stop of route.stops) {
          hubCityIds.add(stop.cityId);
        }
      }

      // Create hubs for cities that are route stops
      for (const cityId of hubCityIds) {
        const city = cityNodes.find((c) => c.id === cityId);
        if (!city) continue;

        const routeCount = generated.filter((r) => r.stops.some((s) => s.cityId === cityId)).length;

        const hubType = city.isCapital
          ? "station"
          : city.isCoastal
            ? "port"
            : routeCount > 3
              ? "junction"
              : "station";

        await ctx.db.transportHub.create({
          data: {
            cityId,
            countryId: input.countryId,
            hubType,
            name: `${city.name} ${hubType === "port" ? "Port" : "Station"}`,
            coordinates: city.coordinates,
            connections: routeCount,
          },
        });
      }

      await syncTransportEconomicModifiers(ctx.db, input.countryId);
      await syncResourcePoolModifiers(ctx.db, input.countryId);

      return {
        routesCreated: created,
        hubsCreated: hubCityIds.size,
        totalLengthKm: Math.round(generated.reduce((s, r) => s + r.lengthKm, 0)),
      };
    }),

  createRoute: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        routeType: z.string(),
        name: z.string().optional(),
        geometry: lineStringGeometrySchema,
        properties: routePropertiesSchema.optional(),
        speedKmh: z.number().positive().max(2000).optional(),
        isInternational: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const coords = input.geometry.coordinates ?? [];

      const { lengthKm, terrainDifficulty } = await computeRouteLengthAndDifficulty(
        ctx.db,
        coords,
        input.countryId
      );

      const { costBillion, maintenanceCost } = calculateRouteCosts({
        routeType: input.routeType,
        lengthKm,
        terrainDifficulty,
      });

      const baseSpeed =
        input.speedKmh ??
        (typeof (input.properties as Record<string, unknown> | null)?.speed_kmh === "number"
          ? ((input.properties as Record<string, unknown>).speed_kmh as number)
          : null);

      const route = await ctx.db.transportRoute.create({
        data: {
          countryId: input.countryId,
          routeType: input.routeType,
          name: input.name,
          geometry: input.geometry,
          speedKmh: baseSpeed,
          properties: {
            ...((input.properties as JsonObject | null) || {}),
            ...(baseSpeed ? { speed_kmh: baseSpeed } : {}),
            costBillion,
            maintenanceCost,
          },
          isInternational: input.isInternational,
          status: "operational",
          lengthKm,
          terrainDifficulty,
        } as Prisma.TransportRouteCreateInput,
      });

      await syncTransportEconomicModifiers(ctx.db, input.countryId);
      await syncResourcePoolModifiers(ctx.db, input.countryId);

      return route;
    }),

  /**
   * Delete a transport route.
   */
  deleteRoute: standardMutationCountryOwnerProcedure
    .input(z.object({ id: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.transportRoute.delete({ where: { id: input.id } });
      await syncTransportEconomicModifiers(ctx.db, input.countryId);
      await syncResourcePoolModifiers(ctx.db, input.countryId);
      return deleted;
    }),

  updateRoute: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        id: z.string(),
        countryId: z.string(),
        name: z.string().optional(),
        routeType: z.string().optional(),
        status: z.enum(["planned", "under_construction", "operational", "abandoned"]).optional(),
        isInternational: z.boolean().optional(),
        builtYear: z.number().optional(),
        capacity: z.number().optional(),
        speedKmh: z.number().positive().max(2000).optional(),
        properties: routePropertiesSchema.optional(),
        /** Ordered stop list: [{cityId, name, coordinates, order}] */
        stops: z
          .array(
            z.object({
              cityId: z.string(),
              name: z.string(),
              coordinates: z.tuple([z.number(), z.number()]),
              order: z.number(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, countryId, ...data } = input;
      const updates: Prisma.TransportRouteUpdateInput = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.routeType !== undefined) updates.routeType = data.routeType;
      if (data.status !== undefined) updates.status = data.status;
      if (data.isInternational !== undefined) updates.isInternational = data.isInternational;
      if (data.builtYear !== undefined) updates.builtYear = data.builtYear;
      if (data.capacity !== undefined) updates.capacity = data.capacity;
      if (data.stops !== undefined) updates.stops = data.stops;
      if (data.speedKmh !== undefined) {
        (updates as Record<string, unknown>).speedKmh = data.speedKmh;
      }

      // If routeType changed or properties edited, recalculate costs
      const route = await ctx.db.transportRoute.findUnique({
        where: { id },
        select: { routeType: true, lengthKm: true, terrainDifficulty: true, properties: true },
      });
      if (route) {
        const type = (data.routeType as string) || route.routeType;
        const length = route.lengthKm ?? 0;
        const diff = route.terrainDifficulty ?? 0.2;
        const { costBillion, maintenanceCost } = calculateRouteCosts({
          routeType: type,
          lengthKm: length,
          terrainDifficulty: diff,
        });
        const currentProps = (route.properties as JsonObject | null) || {};
        const newProps = data.properties || {};
        updates.properties = {
          ...currentProps,
          ...newProps,
          ...(data.speedKmh !== undefined ? { speed_kmh: data.speedKmh } : {}),
          costBillion,
          maintenanceCost,
        };
      }

      const updated = await ctx.db.transportRoute.update({
        where: { id },
        data: updates,
      });

      await syncTransportEconomicModifiers(ctx.db, countryId);
      await syncResourcePoolModifiers(ctx.db, countryId);

      return updated;
    }),

  /**
   * Update route geometry (path editing).
   */
  updateRouteGeometry: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        id: z.string(),
        countryId: z.string(),
        geometry: lineStringGeometrySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Recalculate length and terrain difficulty from new geometry
      const coords = input.geometry.coordinates ?? [];

      const { lengthKm, terrainDifficulty } = await computeRouteLengthAndDifficulty(
        ctx.db,
        coords,
        input.countryId
      );

      // Fetch route to get its type and existing properties
      const route = await ctx.db.transportRoute.findUnique({
        where: { id: input.id },
        select: { routeType: true, properties: true },
      });
      const routeType = route?.routeType ?? "road";
      const existingProps = (route?.properties as JsonObject | null) || {};
      const { costBillion, maintenanceCost } = calculateRouteCosts({
        routeType,
        lengthKm,
        terrainDifficulty,
      });

      const updated = await ctx.db.transportRoute.update({
        where: { id: input.id },
        data: {
          geometry: input.geometry,
          lengthKm,
          terrainDifficulty,
          properties: {
            ...existingProps,
            costBillion,
            maintenanceCost,
          },
        },
      });

      await syncTransportEconomicModifiers(ctx.db, input.countryId);
      await syncResourcePoolModifiers(ctx.db, input.countryId);

      return updated;
    }),

  /**
   * Create a new network segment between two nodes.
   */
  createSegment: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        fromNodeId: z.string(),
        toNodeId: z.string(),
        routeType: z.string(),
        geometry: z.object({
          type: z.literal("LineString"),
          coordinates: z.array(z.array(z.number())),
        }),
        status: z.enum(["planned", "under_construction", "operational", "abandoned"]).default("operational"),
        speedKmh: z.number().optional(),
        capacity: z.number().optional(),
        isInternational: z.boolean().default(false),
        properties: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { lengthKm, terrainDifficulty } = await computeRouteLengthAndDifficulty(
        ctx.db,
        input.geometry.coordinates,
        input.countryId
      );

      const dbAny = ctx.db as any;
      if (!dbAny.transportSegment) {
        throw new Error("TransportSegment model not yet initialized in database.");
      }

      const segment = await dbAny.transportSegment.create({
        data: {
          countryId: input.countryId,
          fromNodeId: input.fromNodeId,
          toNodeId: input.toNodeId,
          routeType: input.routeType,
          geometry: input.geometry,
          status: input.status,
          lengthKm,
          terrainDifficulty,
          speedKmh: input.speedKmh,
          capacity: input.capacity,
          isInternational: input.isInternational,
          properties: input.properties as Prisma.InputJsonValue,
        },
      });

      await syncTransportEconomicModifiers(ctx.db, input.countryId);
      return segment;
    }),

  /**
   * Split a segment at an intermediate coordinate by creating a new junction node
   * and replacing the segment with two sub-segments.
   */
  splitSegment: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        segmentId: z.string(),
        splitCoordinate: z.tuple([z.number(), z.number()]),
        nodeName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbAny = ctx.db as any;
      const seg = await dbAny.transportSegment.findUnique({
        where: { id: input.segmentId },
      });
      if (!seg) throw new Error("Segment not found");

      // 1. Create junction node
      const node = await dbAny.transportNode.create({
        data: {
          countryId: input.countryId,
          coordinates: input.splitCoordinate,
          nodeType: "junction",
          name: input.nodeName ?? "Junction",
          worldId: seg.worldId,
        },
      });

      // 2. Divide geometry coordinates
      const coords = (seg.geometry as { coordinates: [number, number][] }).coordinates;
      const midIdx = Math.max(1, Math.floor(coords.length / 2));
      const geom1 = { type: "LineString", coordinates: [...coords.slice(0, midIdx), input.splitCoordinate] };
      const geom2 = { type: "LineString", coordinates: [input.splitCoordinate, ...coords.slice(midIdx)] };

      // 3. Create sub-segments
      const seg1 = await dbAny.transportSegment.create({
        data: {
          ...seg,
          id: undefined,
          fromNodeId: seg.fromNodeId,
          toNodeId: node.id,
          geometry: geom1,
          createdAt: undefined,
          updatedAt: undefined,
        },
      });

      const seg2 = await dbAny.transportSegment.create({
        data: {
          ...seg,
          id: undefined,
          fromNodeId: node.id,
          toNodeId: seg.toNodeId,
          geometry: geom2,
          createdAt: undefined,
          updatedAt: undefined,
        },
      });

      // 4. Delete original
      await dbAny.transportSegment.delete({ where: { id: input.segmentId } });

      return { node, segment1: seg1, segment2: seg2 };
    }),

  /**
   * Merge two adjacent segments sharing a node into a single segment.
   */
  mergeSegments: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        segmentIdA: z.string(),
        segmentIdB: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbAny = ctx.db as any;
      const [segA, segB] = await Promise.all([
        dbAny.transportSegment.findUnique({ where: { id: input.segmentIdA } }),
        dbAny.transportSegment.findUnique({ where: { id: input.segmentIdB } }),
      ]);
      if (!segA || !segB) throw new Error("Segments not found");

      const coordsA = (segA.geometry as { coordinates: [number, number][] }).coordinates;
      const coordsB = (segB.geometry as { coordinates: [number, number][] }).coordinates;

      const mergedCoords = [...coordsA, ...coordsB.slice(1)];
      const { lengthKm, terrainDifficulty } = await computeRouteLengthAndDifficulty(
        ctx.db,
        mergedCoords,
        input.countryId
      );

      const merged = await dbAny.transportSegment.create({
        data: {
          countryId: input.countryId,
          fromNodeId: segA.fromNodeId,
          toNodeId: segB.toNodeId,
          routeType: segA.routeType,
          geometry: { type: "LineString", coordinates: mergedCoords },
          status: segA.status,
          lengthKm,
          terrainDifficulty,
          worldId: segA.worldId,
        },
      });

      await dbAny.transportSegment.deleteMany({
        where: { id: { in: [input.segmentIdA, input.segmentIdB] } },
      });

      return merged;
    }),
});

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Compute accurate route length and terrain difficulty from GeoJSON LineString coordinates.
 * lengthKm uses the IxEarth-calibrated polylineLengthKm haversine.
 * terrainDifficulty samples up to 20 evenly-spaced points via PostGIS altitude data,
 * then normalizes cumulative elevation gain to 0-1.
 * Falls back to countryGeoProfile.terrainRoughness if PostGIS data is unavailable.
 */
async function computeRouteLengthAndDifficulty(
  db: PrismaClient | Prisma.TransactionClient,
  coords: number[][],
  countryId?: string
): Promise<{ lengthKm: number; terrainDifficulty: number }> {
  const points = coords
    .filter((c) => c.length >= 2 && c[0] !== undefined && c[1] !== undefined)
    .map((c) => [c[0]!, c[1]!] as [number, number]);

  const lengthKm = Math.round(polylineLengthKm(points) * 10) / 10;

  // Sample terrain at up to 20 evenly-spaced points
  const SAMPLE_COUNT = 20;
  const samplePoints = samplePolylinePoints(points, SAMPLE_COUNT);

  let terrainDifficulty: number;
  if (samplePoints.length >= 2) {
    try {
      const results = await Promise.all(
        samplePoints.map(([lng, lat]) => getTerrainAtPoint(db as PrismaClient, lng, lat))
      );
      const elevations = results.map((r) => {
        if (!r.elevationZone) return 0;
        // Use midpoint of the elevation zone range as sample value
        return (r.elevationZone.elevationMin + r.elevationZone.elevationMax) / 2;
      });
      terrainDifficulty = normalizeTerrainDifficulty(elevations);
    } catch {
      // Terrain data unavailable — fall back to country profile roughness
      terrainDifficulty = await getFallbackDifficulty(db, countryId);
    }
  } else {
    terrainDifficulty = await getFallbackDifficulty(db, countryId);
  }

  return { lengthKm, terrainDifficulty };
}

async function getFallbackDifficulty(
  db: PrismaClient | Prisma.TransactionClient,
  countryId?: string
): Promise<number> {
  if (!countryId) return 0.2;
  try {
    const geoProfile = await db.countryGeoProfile.findUnique({
      where: { countryId },
      select: { terrainRoughness: true },
    });
    return geoProfile?.terrainRoughness ?? 0.2;
  } catch {
    return 0.2;
  }
}

function extractBoundaryCoords(geometry: Prisma.JsonValue): [number, number][] {
  const coords: [number, number][] = [];
  if (!geometry || typeof geometry !== "object" || Array.isArray(geometry)) return coords;
  if (!("coordinates" in geometry)) return coords;

  const rawCoords = geometry.coordinates;
  if (!Array.isArray(rawCoords)) return coords;

  const stack: (Prisma.JsonValue | Prisma.JsonValue[] | number[])[] = [rawCoords];
  while (stack.length > 0 && coords.length < 200) {
    const item = stack.pop();
    if (!item || !Array.isArray(item)) continue;
    if (item.length >= 2 && typeof item[0] === "number" && typeof item[1] === "number") {
      coords.push([item[0], item[1]]);
    } else {
      for (const sub of item) {
        if (Array.isArray(sub)) {
          stack.push(sub);
        }
      }
    }
  }
  return coords;
}
