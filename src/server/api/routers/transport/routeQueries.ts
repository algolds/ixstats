/**
 * transport.ts — tRPC router for transport infrastructure.
 *
 * Provides CRUD for transport routes and hubs, plus procedural
 * route generation using terrain-aware pathfinding.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";

// eslint-disable-next-line unused-imports/no-unused-vars
function calculateRouteCosts(routeType: string, lengthKm: number, terrainDifficulty: number) {
  let baseCostPerKm = 0.01; // default road
  switch (routeType) {
    case "rail":
      baseCostPerKm = 0.04;
      break;
    case "highway":
      baseCostPerKm = 0.05;
      break;
    case "shipping_lane":
      baseCostPerKm = 0.001;
      break;
    case "canal":
      baseCostPerKm = 0.1;
      break;
    case "road":
      baseCostPerKm = 0.01;
      break;
    case "air_corridor":
      baseCostPerKm = 0.08;
      break;
    case "ferry":
      baseCostPerKm = 0.02;
      break;
  }
  const costBillion = lengthKm * baseCostPerKm * (1 + terrainDifficulty * 1.5);
  const maintenanceCost = costBillion * 0.02; // 2% annual maintenance
  return {
    costBillion: Math.round(costBillion * 1000) / 1000,
    maintenanceCost: Math.round(maintenanceCost * 1000) / 1000,
  };
}

export async function syncTransportEconomicModifiers(db: any, countryId: string) {
  const routes = await db.transportRoute.findMany({
    where: { countryId, status: "operational" },
  });

  const hubs = await db.transportHub.findMany({
    where: { countryId },
  });

  let totalLengthKm = 0;
  let totalMaintenanceCost = 0;

  for (const route of routes) {
    totalLengthKm += route.lengthKm ?? 0;
    const props = (route.properties as Record<string, any>) || {};
    totalMaintenanceCost += props.maintenanceCost !== undefined ? Number(props.maintenanceCost) : 0;
  }

  const gdpBonus = Math.min(0.15, totalLengthKm * 0.0001 + hubs.length * 0.01);
  const tradeBonus = Math.min(0.2, totalLengthKm * 0.00015 + hubs.length * 0.015);
  const syncDate = new Date();

  // GDP modifier effect
  const gdpEffectName = "transport_gdp_bonus";
  const existingGdp = await db.storytellerEffect.findFirst({
    where: { countryId, inputType: gdpEffectName, createdBy: "system_transport_sync" },
  });
  if (existingGdp) {
    await db.storytellerEffect.update({
      where: { id: existingGdp.id },
      data: {
        value: gdpBonus,
        description: `GDP growth bonus from transport network (${totalLengthKm.toFixed(1)} km operational routes, ${hubs.length} hubs)`,
        isActive: gdpBonus > 0,
        ixTimeTimestamp: syncDate,
      },
    });
  } else if (gdpBonus > 0) {
    await db.storytellerEffect.create({
      data: {
        countryId,
        inputType: gdpEffectName,
        value: gdpBonus,
        description: `GDP growth bonus from transport network (${totalLengthKm.toFixed(1)} km operational routes, ${hubs.length} hubs)`,
        isActive: true,
        createdBy: "system_transport_sync",
        ixTimeTimestamp: syncDate,
      },
    });
  }

  // Trade modifier effect
  const tradeEffectName = "transport_trade_bonus";
  const existingTrade = await db.storytellerEffect.findFirst({
    where: { countryId, inputType: tradeEffectName, createdBy: "system_transport_sync" },
  });
  if (existingTrade) {
    await db.storytellerEffect.update({
      where: { id: existingTrade.id },
      data: {
        value: tradeBonus,
        description: `Trade efficiency bonus from transport network (${totalLengthKm.toFixed(1)} km operational routes, ${hubs.length} hubs)`,
        isActive: tradeBonus > 0,
        ixTimeTimestamp: syncDate,
      },
    });
  } else if (tradeBonus > 0) {
    await db.storytellerEffect.create({
      data: {
        countryId,
        inputType: tradeEffectName,
        value: tradeBonus,
        description: `Trade efficiency bonus from transport network (${totalLengthKm.toFixed(1)} km operational routes, ${hubs.length} hubs)`,
        isActive: true,
        createdBy: "system_transport_sync",
        ixTimeTimestamp: syncDate,
      },
    });
  }

  // Maintenance cost effect
  const maintenanceEffectName = "transport_infra_maintenance";
  const existingMaintenance = await db.storytellerEffect.findFirst({
    where: { countryId, inputType: maintenanceEffectName, createdBy: "system_transport_sync" },
  });
  if (existingMaintenance) {
    await db.storytellerEffect.update({
      where: { id: existingMaintenance.id },
      data: {
        value: -totalMaintenanceCost,
        description: `Annual transport network maintenance cost (${totalMaintenanceCost.toFixed(3)} billion IxCredits)`,
        isActive: totalMaintenanceCost > 0,
        ixTimeTimestamp: syncDate,
      },
    });
  } else if (totalMaintenanceCost > 0) {
    await db.storytellerEffect.create({
      data: {
        countryId,
        inputType: maintenanceEffectName,
        value: -totalMaintenanceCost,
        description: `Annual transport network maintenance cost (${totalMaintenanceCost.toFixed(3)} billion IxCredits)`,
        isActive: true,
        createdBy: "system_transport_sync",
        ixTimeTimestamp: syncDate,
      },
    });
  }
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
          const props = (r.properties as Record<string, any>) || {};
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
        const meta = (res.metadata as Record<string, any>) || {};
        return {
          id: res.id,
          name: res.name,
          isConnected: meta.isConnected === true,
          resourceType: (meta.resourceType as string) || "minerals",
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

  // ── Hub Management ──
});

// ── Helpers ──────────────────────────────────────────────────────

// eslint-disable-next-line unused-imports/no-unused-vars
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
