/**
 * transport.ts — tRPC router for transport infrastructure.
 *
 * Provides CRUD for transport routes and hubs, plus procedural
 * route generation using terrain-aware pathfinding.
 */

import { z } from "zod/v4";
import { createTRPCRouter } from "~/server/api/trpc";
import { standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import {
  generateTransportNetwork,
  estimateCoastalCities,
  type CityNode,
  type RouteType,
} from "~/lib/transport-generator";
import { calculateRouteCosts } from "~/lib/transport-costs";
import { syncResourcePoolModifiers } from "../geo/features";

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
              "rail",
              "highway",
              "road",
              "shipping_lane",
              "canal",
              "air_corridor",
              "ferry",
              "pipeline",
              "power_grid",
              "fiber",
              "military_supply",
              "military_naval",
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
          const coords = extractBoundaryCoords(
            countryGeo.geometry as unknown as import("geojson").Geometry
          );
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
              ...((route.properties as Record<string, any>) || {}),
              costBillion,
              maintenanceCost,
            },
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
        geometry: z.any(), // GeoJSON LineString
        properties: z.any().optional(),
        isInternational: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const coords = (input.geometry as { coordinates?: number[][] })?.coordinates ?? [];
      let lengthKm = 0;
      for (let i = 1; i < coords.length; i++) {
        const [lon1, lat1] = coords[i - 1]!;
        const [lon2, lat2] = coords[i]!;
        if (lon1 !== undefined && lat1 !== undefined && lon2 !== undefined && lat2 !== undefined) {
          lengthKm += haversineKm(lat1, lon1, lat2, lon2);
        }
      }
      const roundedLength = Math.round(lengthKm * 10) / 10;

      const geoProfile = await ctx.db.countryGeoProfile.findUnique({
        where: { countryId: input.countryId },
        select: { terrainRoughness: true },
      });
      const terrainDifficulty = geoProfile?.terrainRoughness ?? 0.2;

      const { costBillion, maintenanceCost } = calculateRouteCosts({
        routeType: input.routeType,
        lengthKm: roundedLength,
        terrainDifficulty,
      });

      const route = await ctx.db.transportRoute.create({
        data: {
          countryId: input.countryId,
          routeType: input.routeType,
          name: input.name,
          geometry: input.geometry,
          properties: {
            ...((input.properties as Record<string, any>) || {}),
            costBillion,
            maintenanceCost,
          },
          isInternational: input.isInternational,
          status: "operational",
          lengthKm: roundedLength,
          terrainDifficulty,
        },
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
        properties: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, countryId, ...data } = input;
      // Filter undefined values
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) updates[k] = v;
      }

      // If routeType changed or properties edited, recalculate costs
      const route = await ctx.db.transportRoute.findUnique({
        where: { id },
        select: { routeType: true, lengthKm: true, terrainDifficulty: true, properties: true },
      });
      if (route) {
        const type = (updates.routeType as string) || route.routeType;
        const length = route.lengthKm ?? 0;
        const diff = route.terrainDifficulty ?? 0.2;
        const { costBillion, maintenanceCost } = calculateRouteCosts({
          routeType: type,
          lengthKm: length,
          terrainDifficulty: diff,
        });
        updates.properties = {
          ...((route.properties as Record<string, any>) || {}),
          ...((updates.properties as Record<string, any>) || {}),
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
        if (lon1 !== undefined && lat1 !== undefined && lon2 !== undefined && lat2 !== undefined) {
          lengthKm += haversineKm(lat1, lon1, lat2, lon2);
        }
      }
      const roundedLength = Math.round(lengthKm * 10) / 10;

      const geoProfile = await ctx.db.countryGeoProfile.findUnique({
        where: { countryId: input.countryId },
        select: { terrainRoughness: true },
      });
      const terrainDifficulty = geoProfile?.terrainRoughness ?? 0.2;

      // Fetch route to get its type and existing properties
      const route = await ctx.db.transportRoute.findUnique({
        where: { id: input.id },
        select: { routeType: true, properties: true },
      });
      const routeType = route?.routeType ?? "road";
      const existingProps = (route?.properties as Record<string, any>) || {};
      const { costBillion, maintenanceCost } = calculateRouteCosts({
        routeType,
        lengthKm: roundedLength,
        terrainDifficulty,
      });

      const updated = await ctx.db.transportRoute.update({
        where: { id: input.id },
        data: {
          geometry: input.geometry,
          lengthKm: roundedLength,
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

  // ── Hub Management ──
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
