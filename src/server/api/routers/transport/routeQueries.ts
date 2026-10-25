/**
 * routeQueries.ts — tRPC queries for transport infrastructure.
 *
 * Provides queries for transport routes, GeoJSON exports,
 * network statistics, and stop resolution.
 */

import { z } from "zod/v4";
import type { Geometry } from "geojson";
import type { Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  cachedPublicProcedure,
  publicProcedure,
  userCacheMiddleware,
} from "~/server/api/trpc";
import { hasCountryWriteAccess } from "~/server/shared/country-authorization";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import {
  calculateTAMI,
  calculateMaintenanceDegradation,
  calculateModalBreakdown,
  estimateIntercityTravelTimes,
  infrastructureBudgetBillions,
  type DegradationResult,
} from "~/lib/economy/national-mobility";
import { currentBudgetYear } from "~/lib/government/budget-year";
import {
  calculateRouteTravelTime,
  resolveRouteBaseSpeed,
} from "~/lib/economy/travel-time";

type JsonPrimitive = string | number | boolean | null;

/** Network condition; `fundingRatio` and `budgetedMaintenance` are the owner's only. */
type MobilityDegradation = Omit<DegradationResult, "fundingRatio"> & {
  fundingRatio?: number;
  budgetedMaintenance?: number;
  requiredMaintenance: number;
};

/** The network condition from its budget (billions); the budget figures go to the owner only. */
function maintenanceView(
  budgeted: number,
  required: number,
  ownerView: boolean
): MobilityDegradation {
  const { fundingRatio, ...condition } = calculateMaintenanceDegradation({
    budgetedMaintenance: budgeted,
    requiredMaintenance: required,
  });
  const requiredMaintenance = Math.round(required * 1000) / 1000;
  return ownerView
    ? {
        ...condition,
        fundingRatio,
        budgetedMaintenance: Math.round(budgeted * 1000) / 1000,
        requiredMaintenance,
      }
    : { ...condition, requiredMaintenance };
}

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
   * Get the viewed realm's transport routes as GeoJSON for map overlay.
   */
  getAllRoutesGeoJSON: cachedPublicProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const routes = await ctx.db.transportRoute.findMany({
        where: { realmId: await viewerRealmId(ctx, input?.realm) },
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
   * Public (the factbook's geography tab), but the maintenance budget behind the network's
   * condition (`degradation.budgetedMaintenance`, `degradation.fundingRatio`) goes to the
   * nation's owner and privileged roles only. Cached per viewer for that reason. The budget is
   * the transport department's live allocation; `degradation` is null when there is none.
   */
  getNationalMobilityProfile: publicProcedure
    .use(userCacheMiddleware)
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [routes, hubs, cities, allocations] = await Promise.all([
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
        ctx.db.budgetAllocation.findMany({
          where: { governmentStructure: { countryId: input.countryId } },
          select: {
            budgetYear: true,
            allocatedAmount: true,
            department: { select: { name: true, category: true } },
          },
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

      // The transport department's live allocation (the budget is owner-edited); none, no figure.
      const budgetedInfraMaintenance = infrastructureBudgetBillions(
        allocations,
        currentBudgetYear()
      );

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

      // The condition is observable; the budget behind it is the owner's.
      const degradationOut =
        budgetedInfraMaintenance == null
          ? null
          : maintenanceView(
              budgetedInfraMaintenance,
              totalMaintenanceCost,
              await hasCountryWriteAccess(ctx, input.countryId)
            );

      return {
        countryId: input.countryId,
        tami: tamiResult,
        degradation: degradationOut,
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
});
