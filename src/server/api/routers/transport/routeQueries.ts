/**
 * routeQueries.ts — tRPC queries for transport infrastructure.
 *
 * Provides queries for transport routes, GeoJSON exports,
 * network statistics, and stop resolution.
 */

import { z } from "zod/v4";
import type { Geometry } from "geojson";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";
import {
  calculateTAMI,
  calculateMaintenanceDegradation,
  calculateModalBreakdown,
  estimateIntercityTravelTimes,
} from "~/lib/economy/national-mobility";
import {
  calculateRouteTravelTime,
  resolveRouteBaseSpeed,
} from "~/lib/economy/travel-time";

type JsonPrimitive = string | number | boolean | null;
type JsonObject = Record<string, JsonPrimitive | JsonPrimitive[] | Record<string, JsonPrimitive>>;

type JsonGeometry = {
  type: string;
  coordinates?: Prisma.JsonValue;
  geometries?: Prisma.JsonValue;
};

function toGeometry(val: Prisma.JsonValue): Geometry {
  return (val as JsonGeometry) as Geometry;
}

interface RouteProperties {
  maintenanceCost?: number | string;
  [key: string]: JsonPrimitive | JsonPrimitive[] | Record<string, JsonPrimitive> | undefined;
}

interface ResourceMetadata {
  isConnected?: boolean;
  resourceType?: string;
  quality?: number | string;
  [key: string]: JsonPrimitive | JsonPrimitive[] | Record<string, JsonPrimitive> | undefined;
}

interface CountryEconomySelect {
  name: string;
  currentTotalGdp: number;
  currentGdpPerCapita: number;
  economicTier: string;
  currentPopulation: number;
}

interface SegmentQueryResult {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  routeType: string;
  geometry: Prisma.JsonValue;
  status: string;
  lengthKm: number | null;
  terrainDifficulty: number | null;
  isInternational: boolean;
  builtYear: number | null;
  properties: Prisma.JsonValue;
  country: CountryEconomySelect | null;
}

interface NodeQueryResult {
  id: string;
  coordinates: Prisma.JsonValue;
  nodeType: string;
  name: string | null;
  cityId: string | null;
  countryId: string | null;
  city: { name: string; population: number | null } | null;
}

type SelectField = boolean | { select: Record<string, boolean> };

type DynamicTransportDb = PrismaClient & {
  transportSegment?: {
    findMany(args: {
      where: { worldId: string };
      select: Record<string, SelectField>;
    }): Promise<SegmentQueryResult[]>;
  };
  transportNode?: {
    findMany(args: {
      where: { worldId: string };
      select: Record<string, SelectField>;
    }): Promise<NodeQueryResult[]>;
  };
  transportRouteSegment?: object;
};

export const transportRouteQueriesRouter = createTRPCRouter({
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
        include: {
          country: {
            select: {
              name: true,
              currentTotalGdp: true,
              currentGdpPerCapita: true,
              economicTier: true,
              currentPopulation: true,
            },
          },
        },
        orderBy: { routeType: "asc" },
      });

      return {
        type: "FeatureCollection" as const,
        features: routes.map((r) => ({
          type: "Feature" as const,
          geometry: toGeometry(r.geometry),
          properties: {
            id: r.id,
            name: r.name,
            routeType: r.routeType,
            status: r.status,
            lengthKm: r.lengthKm,
            terrainDifficulty: r.terrainDifficulty,
            isInternational: r.isInternational,
            builtYear: r.builtYear,
            stops: r.stops ?? [],
            countryName: r.country?.name ?? null,
            totalGdp: r.country?.currentTotalGdp ?? null,
            gdpPerCapita: r.country?.currentGdpPerCapita ?? null,
            economicTier: r.country?.economicTier ?? null,
            population: r.country?.currentPopulation ?? null,
            speedKmh: (r as { speedKmh?: number | null }).speedKmh ?? (r.properties as JsonObject | null)?.speed_kmh ?? null,
            ...((r.properties as JsonObject | null) ?? {}),
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
          builtYear: true,
          properties: true,
          country: {
            select: {
              name: true,
              currentTotalGdp: true,
              currentGdpPerCapita: true,
              economicTier: true,
              currentPopulation: true,
            },
          },
        },
      });

      return {
        type: "FeatureCollection" as const,
        features: routes.map((r) => ({
          type: "Feature" as const,
          geometry: toGeometry(r.geometry),
          properties: {
            id: r.id,
            name: r.name,
            routeType: r.routeType,
            status: r.status,
            lengthKm: r.lengthKm,
            speedKmh: (r as { speedKmh?: number | null }).speedKmh ?? (r.properties as JsonObject | null)?.speed_kmh ?? null,
            terrainDifficulty: r.terrainDifficulty,
            isInternational: r.isInternational,
            builtYear: r.builtYear,
            countryName: r.country?.name ?? null,
            totalGdp: r.country?.currentTotalGdp ?? null,
            gdpPerCapita: r.country?.currentGdpPerCapita ?? null,
            economicTier: r.country?.economicTier ?? null,
            population: r.country?.currentPopulation ?? null,
            ...((r.properties as JsonObject | null) ?? {}),
          },
        })),
      };
    }),

  /**
   * Get transport network statistics for a country.
   */
  getTransportStats: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const routes = await ctx.db.transportRoute.findMany({
        where: { countryId: input.countryId },
        select: { routeType: true, lengthKm: true, status: true, properties: true },
      });

      const hubs = await ctx.db.transportHub.count({
        where: { countryId: input.countryId },
      });

      const byType: Record<string, { count: number; totalKm: number }> = {};
      let totalMaintenanceCost = 0;
      for (const r of routes) {
        if (!byType[r.routeType]) byType[r.routeType] = { count: 0, totalKm: 0 };
        byType[r.routeType]!.count++;
        byType[r.routeType]!.totalKm += r.lengthKm ?? 0;
        if (r.status === "operational") {
          const props = (r.properties as RouteProperties | null) || {};
          totalMaintenanceCost +=
            props.maintenanceCost !== undefined ? Number(props.maintenanceCost) : 0;
        }
      }

      const totalKm = routes.reduce((s, r) => s + (r.lengthKm ?? 0), 0);
      const operationalCount = routes.filter((r) => r.status === "operational").length;

      const rawResources = await ctx.db.pointOfInterest.findMany({
        where: { countryId: input.countryId, category: "resource", status: "approved" },
        select: { id: true, name: true, metadata: true },
      });

      const resources = rawResources.map((res) => {
        const meta = (res.metadata as ResourceMetadata | null) || {};
        return {
          id: res.id,
          name: res.name,
          isConnected: meta.isConnected === true,
          resourceType: meta.resourceType || "minerals",
          quality: meta.quality !== undefined ? Number(meta.quality) : 0.5,
        };
      });

      return {
        totalRoutes: routes.length,
        totalKm: Math.round(totalKm),
        totalHubs: hubs,
        operationalCount,
        byType,
        totalMaintenanceCost,
        resources,
      };
    }),

  /**
   * Get comprehensive National Mobility & Transit Accessibility profile (Phase 2).
   */
  getNationalMobilityProfile: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [routes, hubs, cities, budget, country] = await Promise.all([
        ctx.db.transportRoute.findMany({
          where: { countryId: input.countryId },
          select: {
            id: true,
            name: true,
            routeType: true,
            lengthKm: true,
            terrainDifficulty: true,
            status: true,
            properties: true,
          },
        }),
        ctx.db.transportHub.findMany({
          where: { countryId: input.countryId },
          select: { id: true, name: true, hubType: true, coordinates: true },
        }),
        ctx.db.city.findMany({
          where: { countryId: input.countryId },
          select: { id: true, name: true, population: true, coordinates: true },
          orderBy: { population: "desc" },
          take: 6,
        }),
        ctx.db.governmentBudget.findUnique({
          where: { countryId: input.countryId },
          select: { spendingCategories: true },
        }),
        ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { id: true, name: true, currentTotalGdp: true, currentPopulation: true },
        }),
      ]);

      let totalOperationalKm = 0;
      let totalMaintenanceCost = 0;

      const operationalRoutes = routes.filter((r) => r.status === "operational");

      for (const route of operationalRoutes) {
        totalOperationalKm += route.lengthKm ?? 0;
        const props = (route.properties as Record<string, unknown> | null) || {};
        totalMaintenanceCost +=
          props.maintenanceCost !== undefined ? Number(props.maintenanceCost) : 0;
      }

      // Resolve budgeted infrastructure maintenance
      let budgetedInfraMaintenance = 0;
      if (budget?.spendingCategories) {
        try {
          const parsed = JSON.parse(budget.spendingCategories) as Array<{
            category?: string;
            amount?: number;
          }>;
          if (Array.isArray(parsed)) {
            const infraCat = parsed.find(
              (c) =>
                c.category &&
                (c.category.toLowerCase().includes("infra") ||
                  c.category.toLowerCase().includes("transport") ||
                  c.category.toLowerCase().includes("transit"))
            );
            if (infraCat && typeof infraCat.amount === "number") {
              budgetedInfraMaintenance =
                infraCat.amount > 100_000_000 ? infraCat.amount / 1e9 : infraCat.amount;
            }
          }
        } catch {
          // JSON parse fallback
        }
      }

      if (budgetedInfraMaintenance <= 0 && country?.currentTotalGdp) {
        budgetedInfraMaintenance = (country.currentTotalGdp * 0.015) / 1e9;
      }

      const mobilityRoutes = operationalRoutes.map((r) => ({
        id: r.id,
        name: r.name,
        routeType: r.routeType,
        lengthKm: r.lengthKm,
        speedKmh: (r as { speedKmh?: number | null }).speedKmh ?? null,
        terrainDifficulty: r.terrainDifficulty,
        status: r.status,
        properties: r.properties as Record<string, unknown> | null,
      }));

      const modalSummary = calculateModalBreakdown(mobilityRoutes);

      const tamiResult = calculateTAMI({
        totalLengthKm: totalOperationalKm,
        effectiveAverageSpeedKmh: modalSummary.overallWeightedSpeedKmh,
        totalHubs: hubs.length,
        cityCount: cities.length,
        operationalRouteTypes: operationalRoutes.map((r) => r.routeType),
      });

      const degradation = calculateMaintenanceDegradation({
        budgetedMaintenance: budgetedInfraMaintenance,
        requiredMaintenance: totalMaintenanceCost,
      });

      const topCitiesFormatted = cities.map((c) => ({
        id: c.id,
        name: c.name,
        population: c.population,
        coordinates: Array.isArray(c.coordinates)
          ? (c.coordinates as [number, number])
          : null,
      }));

      const intercityLinks = estimateIntercityTravelTimes(topCitiesFormatted, mobilityRoutes);

      const topCorridors = [...operationalRoutes]
        .sort((a, b) => (b.lengthKm ?? 0) - (a.lengthKm ?? 0))
        .slice(0, 5)
        .map((r) => {
          const baseSpeed = resolveRouteBaseSpeed({
            speedKmh: (r as { speedKmh?: number | null }).speedKmh,
            properties: r.properties as Record<string, unknown> | null,
            routeType: r.routeType,
          });
          const travel = calculateRouteTravelTime({
            lengthKm: r.lengthKm ?? 0,
            speedKmh: baseSpeed,
            routeType: r.routeType,
            terrainDifficulty: r.terrainDifficulty,
          });
          return {
            id: r.id,
            name: r.name ?? `${r.routeType} Link`,
            routeType: r.routeType,
            lengthKm: Math.round((r.lengthKm ?? 0) * 10) / 10,
            effectiveSpeedKmh: Math.round(travel.effectiveSpeedKmh),
            formattedTravelTime: travel.formattedTime,
          };
        });

      return {
        countryId: input.countryId,
        tami: tamiResult,
        degradation: {
          ...degradation,
          budgetedMaintenance: Math.round(budgetedInfraMaintenance * 1000) / 1000,
          requiredMaintenance: Math.round(totalMaintenanceCost * 1000) / 1000,
        },
        modalSummary,
        intercityLinks,
        topCorridors,
        totalOperationalKm: Math.round(totalOperationalKm),
        totalHubs: hubs.length,
      };
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
   * Get ALL transport network segments as GeoJSON for map overlay.
   * Dual-reads: returns TransportSegment records if populated, otherwise
   * falls back to TransportRoute for backwards compatibility.
   */
  getAllSegmentsGeoJSON: cachedPublicProcedure
    .input(z.object({ worldId: z.string().default("default") }).optional())
    .query(async ({ ctx, input }) => {
      const worldId = input?.worldId ?? "default";
      const dynamicDb = ctx.db as DynamicTransportDb;

      if (dynamicDb.transportSegment) {
        const segments = await dynamicDb.transportSegment.findMany({
          where: { worldId },
          select: {
            id: true,
            fromNodeId: true,
            toNodeId: true,
            routeType: true,
            geometry: true,
            status: true,
            lengthKm: true,
            terrainDifficulty: true,
            isInternational: true,
            builtYear: true,
            properties: true,
            country: {
              select: {
                name: true,
                currentTotalGdp: true,
                currentGdpPerCapita: true,
                economicTier: true,
                currentPopulation: true,
              },
            },
          },
        });

        if (segments.length > 0) {
          return {
            type: "FeatureCollection" as const,
            features: segments.map((s: SegmentQueryResult) => ({
              type: "Feature" as const,
              geometry: toGeometry(s.geometry),
              properties: {
                id: s.id,
                fromNodeId: s.fromNodeId,
                toNodeId: s.toNodeId,
                routeType: s.routeType,
                status: s.status,
                lengthKm: s.lengthKm,
                terrainDifficulty: s.terrainDifficulty,
                isInternational: s.isInternational,
                builtYear: s.builtYear,
                countryName: s.country?.name ?? null,
                totalGdp: s.country?.currentTotalGdp ?? null,
                gdpPerCapita: s.country?.currentGdpPerCapita ?? null,
                economicTier: s.country?.economicTier ?? null,
                population: s.country?.currentPopulation ?? null,
                ...((s.properties as JsonObject | null) ?? {}),
              },
            })),
          };
        }
      }

      // Fallback to legacy routes
      const routes = await ctx.db.transportRoute.findMany({
        where: { worldId },
        select: {
          id: true,
          routeType: true,
          name: true,
          geometry: true,
          status: true,
          lengthKm: true,
          terrainDifficulty: true,
          isInternational: true,
          builtYear: true,
          properties: true,
          country: {
            select: {
              name: true,
              currentTotalGdp: true,
              currentGdpPerCapita: true,
              economicTier: true,
              currentPopulation: true,
            },
          },
        },
      });

      return {
        type: "FeatureCollection" as const,
        features: routes.map((r) => ({
          type: "Feature" as const,
          geometry: toGeometry(r.geometry),
          properties: {
            id: r.id,
            name: r.name,
            routeType: r.routeType,
            status: r.status,
            lengthKm: r.lengthKm,
            terrainDifficulty: r.terrainDifficulty,
            isInternational: r.isInternational,
            builtYear: r.builtYear,
            countryName: r.country?.name ?? null,
            totalGdp: r.country?.currentTotalGdp ?? null,
            gdpPerCapita: r.country?.currentGdpPerCapita ?? null,
            economicTier: r.country?.economicTier ?? null,
            population: r.country?.currentPopulation ?? null,
            ...((r.properties as JsonObject | null) ?? {}),
          },
        })),
      };
    }),

  /**
   * Get transport network nodes as a GeoJSON FeatureCollection.
   */
  getNetworkNodes: cachedPublicProcedure
    .input(z.object({ worldId: z.string().default("default") }).optional())
    .query(async ({ ctx, input }) => {
      const worldId = input?.worldId ?? "default";
      const dynamicDb = ctx.db as DynamicTransportDb;

      if (dynamicDb.transportNode) {
        const nodes = await dynamicDb.transportNode.findMany({
          where: { worldId },
          select: {
            id: true,
            coordinates: true,
            nodeType: true,
            name: true,
            cityId: true,
            countryId: true,
            city: { select: { name: true, population: true } },
          },
        });

        if (nodes.length > 0) {
          return {
            type: "FeatureCollection" as const,
            features: nodes.map((n: NodeQueryResult) => ({
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: n.coordinates as [number, number],
              },
              properties: {
                id: n.id,
                nodeType: n.nodeType,
                name: n.name ?? n.city?.name ?? "Node",
                cityId: n.cityId,
                population: n.city?.population ?? null,
              },
            })),
          };
        }
      }

      // Fallback to legacy hubs
      const hubs = await ctx.db.transportHub.findMany({
        where: { worldId },
        select: {
          id: true,
          coordinates: true,
          hubType: true,
          name: true,
          connections: true,
          city: { select: { name: true, population: true } },
        },
      });

      return {
        type: "FeatureCollection" as const,
        features: hubs.map((h) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: h.coordinates as [number, number],
          },
          properties: {
            id: h.id,
            nodeType: h.hubType,
            name: h.name,
            connections: h.connections,
            population: h.city?.population ?? null,
          },
        })),
      };
    }),

  /**
   * Get a named route with its constituent ordered segments.
   */
  getRouteWithSegments: cachedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const dynamicDb = ctx.db as DynamicTransportDb;
      if (!dynamicDb.transportRouteSegment) {
        return ctx.db.transportRoute.findUnique({
          where: { id: input.id },
          include: { country: { select: { id: true, name: true, slug: true } } },
        });
      }

      return ctx.db.transportRoute.findUnique({
        where: { id: input.id },
        include: {
          country: { select: { id: true, name: true, slug: true } },
        },
      });
    }),
});
