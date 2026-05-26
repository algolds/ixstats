/**
 * transport.ts — tRPC router for transport infrastructure.
 *
 * Provides CRUD for transport routes and hubs, plus procedural
 * route generation using terrain-aware pathfinding.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";
import { standardMutationCountryOwnerProcedure, adminProcedure } from "~/server/api/trpc";
import {
  generateTransportNetwork,
  estimateCoastalCities,
  type CityNode,
  type RouteType,
} from "~/lib/transport-generator";

export const transportRouter = createTRPCRouter({
  /**
   * Get all transport routes for a country as GeoJSON.
   */
  getCountryRoutes: cachedPublicProcedure
    .input(
      z.object({
        countryId: z.string(),
        routeType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const routes = await ctx.db.transportRoute.findMany({
        where: {
          countryId: input.countryId,
          ...(input.routeType ? { routeType: input.routeType } : {}),
        },
        orderBy: { routeType: "asc" },
      });

      return {
        type: "FeatureCollection" as const,
        features: routes.map((r) => ({
          type: "Feature" as const,
          geometry: r.geometry as unknown as import("geojson").Geometry,
          properties: {
            id: r.id,
            name: r.name,
            routeType: r.routeType,
            status: r.status,
            lengthKm: r.lengthKm,
            terrainDifficulty: r.terrainDifficulty,
            isInternational: r.isInternational,
            ...((r.properties as Record<string, unknown>) ?? {}),
          },
        })),
      };
    }),

  /**
   * Get ALL transport routes as GeoJSON for map overlay.
   */
  getAllRoutesGeoJSON: cachedPublicProcedure
    .input(z.object({ worldId: z.string().default("default") }).optional())
    .query(async ({ ctx, input }) => {
      const routes = await ctx.db.transportRoute.findMany({
        where: { worldId: input?.worldId ?? "default" },
        select: {
          id: true,
          routeType: true,
          name: true,
          geometry: true,
          status: true,
          lengthKm: true,
          terrainDifficulty: true,
          isInternational: true,
          properties: true,
          country: { select: { name: true } },
        },
      });

      return {
        type: "FeatureCollection" as const,
        features: routes.map((r) => ({
          type: "Feature" as const,
          geometry: r.geometry as unknown as import("geojson").Geometry,
          properties: {
            id: r.id,
            name: r.name,
            routeType: r.routeType,
            status: r.status,
            lengthKm: r.lengthKm,
            terrainDifficulty: r.terrainDifficulty,
            isInternational: r.isInternational,
            countryName: r.country?.name ?? null,
            ...((r.properties as Record<string, unknown>) ?? {}),
          },
        })),
      };
    }),

  /**
   * Get transport hubs for a country.
   */
  getCountryHubs: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.transportHub.findMany({
        where: { countryId: input.countryId },
        include: { city: { select: { name: true, population: true } } },
        orderBy: { connections: "desc" },
      });
    }),

  /**
   * Get transport network statistics for a country.
   */
  getTransportStats: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const routes = await ctx.db.transportRoute.findMany({
        where: { countryId: input.countryId },
        select: { routeType: true, lengthKm: true, status: true },
      });

      const hubs = await ctx.db.transportHub.count({
        where: { countryId: input.countryId },
      });

      const byType: Record<string, { count: number; totalKm: number }> = {};
      for (const r of routes) {
        if (!byType[r.routeType]) byType[r.routeType] = { count: 0, totalKm: 0 };
        byType[r.routeType]!.count++;
        byType[r.routeType]!.totalKm += r.lengthKm ?? 0;
      }

      const totalKm = routes.reduce((s, r) => s + (r.lengthKm ?? 0), 0);
      const operationalCount = routes.filter((r) => r.status === "operational").length;

      return {
        totalRoutes: routes.length,
        totalKm: Math.round(totalKm),
        totalHubs: hubs,
        operationalCount,
        byType,
      };
    }),

  /**
   * Generate transport network procedurally for a country.
   * Available to country owners (generates for their own country) and admins.
   */
  generateRoutes: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        routeTypes: z
          .array(z.enum(["rail", "highway", "road", "shipping_lane", "canal"]))
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

      // Build city nodes
      let cityNodes: CityNode[] = country.cities
        .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
        .map((c) => ({
          id: c.id,
          name: c.name,
          coordinates: c.coordinates as [number, number],
          population: c.population ?? 0,
          isCapital: c.isNationalCapital,
        }));

      // Mark coastal cities if country has coastline
      if ((country.coastlineKm ?? 0) > 0) {
        // Use country boundary points as coastline approximation
        const countryGeo = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { geometry: true },
        });
        if (countryGeo?.geometry) {
          const coords = extractBoundaryCoords(countryGeo.geometry as unknown as import("geojson").Geometry);
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
        await ctx.db.transportRoute.create({
          data: {
            countryId: input.countryId,
            routeType: route.routeType,
            name: route.name,
            geometry: route.geometry,
            stops: route.stops,
            properties: route.properties as any,
            isInternational: route.isInternational,
            status: "operational",
            terrainDifficulty: route.terrainDifficulty,
            lengthKm: route.lengthKm,
          },
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

      return {
        routesCreated: created,
        hubsCreated: hubCityIds.size,
        totalLengthKm: Math.round(generated.reduce((s, r) => s + r.lengthKm, 0)),
      };
    }),

  /**
   * Create a single transport route manually.
   */
  createRoute: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        routeType: z.string(),
        name: z.string().optional(),
        geometry: z.any(), // GeoJSON LineString
        properties: z.any().optional(),
        isInternational: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transportRoute.create({
        data: {
          countryId: input.countryId,
          routeType: input.routeType,
          name: input.name,
          geometry: input.geometry,
          properties: input.properties ?? {},
          isInternational: input.isInternational,
          status: "operational",
        },
      });
    }),

  /**
   * Delete a transport route.
   */
  deleteRoute: standardMutationCountryOwnerProcedure
    .input(z.object({ id: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transportRoute.delete({ where: { id: input.id } });
    }),

  /**
   * Get a single route by ID with full details.
   */
  getRouteById: cachedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const route = await ctx.db.transportRoute.findUnique({
        where: { id: input.id },
        include: {
          country: { select: { id: true, name: true, slug: true } },
        },
      });
      if (!route) return null;

      // Resolve stop city names
      const stops =
        (route.stops as Array<{
          cityId?: string;
          name?: string;
          coordinates?: [number, number];
          order?: number;
        }>) ?? [];
      const cityIds = stops.map((s) => s.cityId).filter(Boolean) as string[];
      const cities =
        cityIds.length > 0
          ? await ctx.db.city.findMany({
              where: { id: { in: cityIds } },
              select: { id: true, name: true, population: true },
            })
          : [];
      const cityMap = new Map(cities.map((c) => [c.id, c]));

      return {
        ...route,
        stopsResolved: stops.map((s) => ({
          ...s,
          cityName: s.cityId ? (cityMap.get(s.cityId)?.name ?? s.name) : s.name,
          cityPopulation: s.cityId ? cityMap.get(s.cityId)?.population : null,
        })),
      };
    }),

  /**
   * Update route properties (name, type, status, etc).
   */
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
        properties: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, countryId: _cid, ...data } = input;
      // Filter undefined values
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) updates[k] = v;
      }
      return ctx.db.transportRoute.update({
        where: { id },
        data: updates,
      });
    }),

  /**
   * Update route geometry (path editing).
   */
  updateRouteGeometry: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        id: z.string(),
        countryId: z.string(),
        geometry: z.any(), // GeoJSON LineString
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Recalculate length from new geometry
      const coords = (input.geometry as { coordinates?: number[][] })?.coordinates ?? [];
      let lengthKm = 0;
      for (let i = 1; i < coords.length; i++) {
        const [lon1, lat1] = coords[i - 1]!;
        const [lon2, lat2] = coords[i]!;
        lengthKm += haversineKm(lat1!, lon1!, lat2!, lon2!);
      }

      return ctx.db.transportRoute.update({
        where: { id: input.id },
        data: {
          geometry: input.geometry,
          lengthKm: Math.round(lengthKm * 10) / 10,
        },
      });
    }),

  // ── Hub Management ──

  /**
   * Get a single hub by ID.
   */
  getHubById: cachedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.transportHub.findUnique({
        where: { id: input.id },
        include: {
          city: { select: { id: true, name: true, population: true } },
          country: { select: { id: true, name: true } },
        },
      });
    }),

  /**
   * Create a transport hub manually.
   */
  createHub: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string(),
        hubType: z.enum(["station", "port", "airport", "junction", "interchange"]),
        coordinates: z.tuple([z.number(), z.number()]),
        cityId: z.string().optional(),
        throughput: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transportHub.create({
        data: {
          countryId: input.countryId,
          name: input.name,
          hubType: input.hubType,
          coordinates: input.coordinates,
          cityId: input.cityId,
          throughput: input.throughput,
        },
      });
    }),

  /**
   * Update a transport hub.
   */
  updateHub: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        id: z.string(),
        countryId: z.string(),
        name: z.string().optional(),
        hubType: z.enum(["station", "port", "airport", "junction", "interchange"]).optional(),
        throughput: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, countryId: _cid, ...data } = input;
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) updates[k] = v;
      }
      return ctx.db.transportHub.update({ where: { id }, data: updates });
    }),

  /**
   * Delete a transport hub.
   */
  deleteHub: standardMutationCountryOwnerProcedure
    .input(z.object({ id: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transportHub.delete({ where: { id: input.id } });
    }),
});

// ── Helpers ──────────────────────────────────────────────────────

import { distanceKmLatLng as haversineKm } from "~/lib/geo-math";

function extractBoundaryCoords(geometry: import("geojson").Geometry): [number, number][] {
  const coords: [number, number][] = [];
  function walk(obj: unknown): void {
    if (coords.length >= 200) return;
    if (!Array.isArray(obj)) return;
    if (obj.length >= 2 && typeof obj[0] === "number" && typeof obj[1] === "number") {
      coords.push([obj[0] as number, obj[1] as number]);
    } else {
      for (const item of obj) walk(item);
    }
  }
  if ("coordinates" in geometry) walk(geometry.coordinates);
  return coords;
}
