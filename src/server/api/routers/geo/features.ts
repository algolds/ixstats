/**
 * Geographic Map Router
 *
 * tRPC router for the IxEarth world map system.
 * Handles map layer data, country geometry, spatial queries,
 * and country-feature linking.
 *
 * Data source: PostgreSQL + PostGIS (map_layers table),
 * with file-based fallback for initial load.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  rateLimitedPublicProcedure,
  cachedPublicProcedure,
  adminProcedure,
  countryOwnerProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/map-update-bus";
import { clearLayerCache } from "./core";
import { ActivityGenerator } from "~/lib/activity-generator";
import { getTerrainForArea } from "~/lib/base-layer-query";
import {
  validatePointContainment,
  validatePolygonContainment,
  clipAndValidatePolygon,
  checkPointCollision,
  checkNameUniqueness,
} from "~/lib/geo-validation";

/** Reusable Zod schema for WGS84 coordinate pair [lng, lat] with bounds checking. */
const coordinatesSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
    message: "Coordinates must be valid WGS84 (lng: -180 to 180, lat: -90 to 90)",
  });

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function syncGeographicDemographics(
  db: any,
  countryId: string,
  subdivisionId?: string | null
) {
  // 1. If subdivisionId is provided, sync subdivision population from its cities
  if (subdivisionId) {
    const citiesSum = await db.city.aggregate({
      where: { subdivisionId, status: "approved" },
      _sum: { population: true },
    });
    const subPop = citiesSum._sum.population ?? 0;
    await db.subdivision.update({
      where: { id: subdivisionId },
      data: { population: subPop },
    });
  }

  // 2. Sync country population from all subdivisions
  const subdivisionsSum = await db.subdivision.aggregate({
    where: { countryId, status: "approved" },
    _sum: { population: true },
  });
  const totalSubPop = subdivisionsSum._sum.population ?? 0;
  if (totalSubPop > 0) {
    await db.country.update({
      where: { id: countryId },
      data: { currentPopulation: totalSubPop },
    });
  }
}

export async function syncResourcePoolModifiers(db: any, countryId: string) {
  // 1. Get all points of interest for this country with category "resource"
  const resources = await db.pointOfInterest.findMany({
    where: { countryId, category: "resource", status: "approved" },
  });

  // 2. Get all operational transport routes and hubs for this country
  const routes = await db.transportRoute.findMany({
    where: { countryId, status: "operational" },
  });
  const hubs = await db.transportHub.findMany({
    where: { countryId },
  });

  for (const resource of resources) {
    const resCoords = resource.coordinates as [number, number] | null;
    if (!resCoords || !Array.isArray(resCoords) || resCoords.length < 2) continue;
    const [resLng, resLat] = resCoords;

    let isConnected = false;

    // Check distance to hubs
    for (const hub of hubs) {
      const hubCoords = hub.coordinates as [number, number] | null;
      if (hubCoords && Array.isArray(hubCoords) && hubCoords.length >= 2) {
        const dist = calculateDistanceKm(resLat, resLng, hubCoords[1], hubCoords[0]);
        if (dist <= 15) {
          isConnected = true;
          break;
        }
      }
    }

    // Check distance to routes
    if (!isConnected) {
      for (const route of routes) {
        const geom = route.geometry as any;
        const coords = geom?.coordinates as [number, number][] | undefined;
        if (Array.isArray(coords)) {
          for (const pt of coords) {
            const dist = calculateDistanceKm(resLat, resLng, pt[1], pt[0]);
            if (dist <= 15) {
              isConnected = true;
              break;
            }
          }
        }
        if (isConnected) break;
      }
    }

    // 3. Update POI metadata with connection status
    const existingMeta = (resource.metadata as Record<string, any>) || {};
    const resourceType = existingMeta.resourceType || "minerals";
    const quality = existingMeta.quality !== undefined ? Number(existingMeta.quality) : 0.5;

    await db.pointOfInterest.update({
      where: { id: resource.id },
      data: {
        metadata: {
          ...existingMeta,
          isConnected,
          resourceType,
          quality,
        },
      },
    });

    // 4. Create/update StorytellerEffect (DmInput)
    const inputType = `resource_${resourceType}_output`;
    const effectValue = isConnected ? quality * 100 : 0;
    const description = `Resource output for ${resource.name} (${resourceType}, quality: ${quality.toFixed(2)}, connected: ${isConnected})`;

    // Check if a StorytellerEffect already exists for this resource POI
    const existingEffect = await db.storytellerEffect.findFirst({
      where: {
        countryId,
        inputType,
        createdBy: `resource_node_${resource.id}`,
      },
    });

    if (existingEffect) {
      await db.storytellerEffect.update({
        where: { id: existingEffect.id },
        data: {
          value: effectValue,
          description,
          isActive: isConnected,
          ixTimeTimestamp: new Date(),
        },
      });
    } else {
      await db.storytellerEffect.create({
        data: {
          countryId,
          inputType,
          value: effectValue,
          description,
          isActive: isConnected,
          createdBy: `resource_node_${resource.id}`,
          ixTimeTimestamp: new Date(),
        },
      });
    }
  }

  // Deactivate storyteller effects for any deleted resource POIs
  const activeResourcePoiIds = resources.map((r: any) => r.id);
  const obsoleteEffects = await db.storytellerEffect.findMany({
    where: {
      countryId,
      createdBy: { startsWith: "resource_node_" },
      isActive: true,
    },
  });

  for (const eff of obsoleteEffects) {
    const poiId = eff.createdBy.replace("resource_node_", "");
    if (!activeResourcePoiIds.includes(poiId)) {
      await db.storytellerEffect.update({
        where: { id: eff.id },
        data: {
          isActive: false,
          value: 0,
          description: "Resource POI deleted",
          ixTimeTimestamp: new Date(),
        },
      });
    }
  }
}

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoFeaturesRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

  /**
   * Create a city within the user's country.
   * Auto-approved if the point is inside the country's borders.
   */
  createCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        cityType: z.string().default("city"),
        coordinates: coordinatesSchema,
        population: z.number().int().min(0).optional(),
        isNationalCapital: z.boolean().default(false),
        isSubdivisionCapital: z.boolean().default(false),
        subdivisionId: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + collision + name uniqueness
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "City"
      );
      await checkPointCollision(
        ctx.db as any,
        "city",
        input.countryId,
        input.coordinates[0],
        input.coordinates[1]
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "city");

      // If marking as capital, clear any existing capital for this country
      if (input.isNationalCapital) {
        await ctx.db.city.updateMany({
          where: { countryId: input.countryId, isNationalCapital: true },
          data: { isNationalCapital: false },
        });
      }

      const city = await ctx.db.city.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          type: input.cityType,
          coordinates: input.coordinates,
          population: input.population,
          isNationalCapital: input.isNationalCapital,
          isSubdivisionCapital: input.isSubdivisionCapital,
          subdivisionId: input.subdivisionId,
          wikiPageTitle: input.wikiPageTitle,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });

      // Invalidate map caches so the public map updates
      await invalidateCache(["geoCore.getAllMapFeatures"]);
      if (input.isNationalCapital) {
        await invalidateCache(["geoCore.getCapitalCities"]);
      }
      broadcastMapUpdate("city", input.countryId);

      if (city.subdivisionId) {
        await syncGeographicDemographics(ctx.db, input.countryId, city.subdivisionId);
      }

      return { id: city.id, name: city.name, status: "approved" as const };
    }),

  /**
   * Update a city within the user's country.
   */
  updateCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cityId: z.string(),
        name: z.string().min(1).max(100).optional(),
        cityType: z.string().optional(),
        coordinates: coordinatesSchema.optional(),
        population: z.number().int().min(0).optional(),
        isNationalCapital: z.boolean().optional(),
        isSubdivisionCapital: z.boolean().optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Verify city belongs to country
      const city = await ctx.db.city.findFirst({
        where: { id: input.cityId, countryId: input.countryId },
      });
      if (!city) {
        throw new TRPCError({ code: "NOT_FOUND", message: "City not found" });
      }

      // If coordinates changed, validate containment + collision
      if (input.coordinates) {
        await validatePointContainment(
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "City"
        );
        await checkPointCollision(
          ctx.db as any,
          "city",
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          input.cityId
        );
      }
      if (input.name) {
        await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "city", input.cityId);
      }

      const updated = await ctx.db.city.update({
        where: { id: input.cityId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.cityType && { type: input.cityType }),
          ...(input.coordinates && { coordinates: input.coordinates }),
          ...(input.population !== undefined && { population: input.population }),
          ...(input.isNationalCapital !== undefined && {
            isNationalCapital: input.isNationalCapital,
          }),
          ...(input.isSubdivisionCapital !== undefined && {
            isSubdivisionCapital: input.isSubdivisionCapital,
          }),
          ...(input.wikiPageTitle !== undefined && { wikiPageTitle: input.wikiPageTitle }),
        },
      });

      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("city", input.countryId);

      if (updated.subdivisionId) {
        await syncGeographicDemographics(ctx.db, input.countryId, updated.subdivisionId);
      }

      return { id: updated.id, name: updated.name };
    }),

  /**
   * Delete a city from the user's country.
   */
  deleteCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cityId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const city = await ctx.db.city.findFirst({
        where: { id: input.cityId, countryId: input.countryId },
      });
      if (!city) {
        throw new TRPCError({ code: "NOT_FOUND", message: "City not found" });
      }

      const wasCapital = city.isNationalCapital;
      await ctx.db.city.delete({ where: { id: input.cityId } });
      await invalidateCache(["geoCore.getAllMapFeatures"]);
      if (wasCapital) {
        await invalidateCache(["geoCore.getCapitalCities"]);
      }
      broadcastMapUpdate("city", input.countryId);

      if (city.subdivisionId) {
        await syncGeographicDemographics(ctx.db, input.countryId, city.subdivisionId);
      }

      return { id: input.cityId, deleted: true };
    }),

  /**
   * Create a subdivision within the user's country.
   * Auto-approved if polygon is inside country borders.
   */
  createSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        type: z.string().default("province"),
        level: z.number().int().min(1).max(5).default(1),
        geometry: z.record(z.string(), z.unknown()),
        capital: z.string().optional(),
        population: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + clip polygon to country borders
      const clippedGeometry = await clipAndValidatePolygon(
        ctx.db as any,
        input.countryId,
        input.geometry,
        "Subdivision"
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "subdivision");

      const subdivision = await ctx.db.subdivision.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          type: input.type,
          level: input.level,
          geometry: clippedGeometry,
          capital: input.capital,
          population: input.population,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });

      // Get terrain breakdown for the subdivision (informational)
      let terrainInfo: Awaited<ReturnType<typeof getTerrainForArea>> | null = null;
      try {
        terrainInfo = await getTerrainForArea(
          ctx.db as any,
          clippedGeometry as unknown as import("geojson").Geometry
        );
      } catch {
        // Terrain query failed — non-blocking
      }

      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("subdivision", input.countryId);

      await syncGeographicDemographics(ctx.db, input.countryId);

      return {
        id: subdivision.id,
        name: subdivision.name,
        status: "approved" as const,
        terrain: terrainInfo,
      };
    }),

  /**
   * Update a subdivision within the user's country.
   */
  updateSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        subdivisionId: z.string(),
        name: z.string().min(1).max(100).optional(),
        type: z.string().optional(),
        level: z.number().int().min(1).max(5).optional(),
        geometry: z.record(z.string(), z.unknown()).optional(),
        capital: z.string().optional(),
        population: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const sub = await ctx.db.subdivision.findFirst({
        where: { id: input.subdivisionId, countryId: input.countryId },
      });
      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subdivision not found" });
      }

      // Validate new geometry if provided
      let clippedGeometry = undefined;
      if (input.geometry) {
        clippedGeometry = await clipAndValidatePolygon(
          ctx.db as any,
          input.countryId,
          input.geometry,
          "Subdivision"
        );
      }
      if (input.name) {
        await checkNameUniqueness(
          ctx.db as any,
          input.countryId,
          input.name,
          "subdivision",
          input.subdivisionId
        );
      }

      const updated = await ctx.db.subdivision.update({
        where: { id: input.subdivisionId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.type && { type: input.type }),
          ...(input.level !== undefined && { level: input.level }),
          ...(clippedGeometry && { geometry: clippedGeometry }),
          ...(input.capital !== undefined && { capital: input.capital }),
          ...(input.population !== undefined && { population: input.population }),
        },
      });

      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("subdivision", input.countryId);

      await syncGeographicDemographics(ctx.db, input.countryId);

      return { id: updated.id, name: updated.name };
    }),

  /**
   * Delete a subdivision from the user's country.
   */
  deleteSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        subdivisionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const sub = await ctx.db.subdivision.findFirst({
        where: { id: input.subdivisionId, countryId: input.countryId },
      });
      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subdivision not found" });
      }

      await ctx.db.subdivision.delete({ where: { id: input.subdivisionId } });
      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("subdivision", input.countryId);

      await syncGeographicDemographics(ctx.db, input.countryId);

      return { id: input.subdivisionId, deleted: true };
    }),

  /**
   * Batch simplify all subdivisions for a country.
   * Reduces vertex count using Douglas-Peucker, sanitizes shapes,
   * and snaps shared borders between neighbors.
   */
  simplifySubdivisions: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        targetVerticesPerProvince: z.number().min(30).max(300).default(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const subdivisions = await ctx.db.subdivision.findMany({
        where: { countryId: input.countryId },
        select: { id: true, name: true, geometry: true },
      });

      if (subdivisions.length === 0) {
        return { updated: 0, total: 0, verticesBefore: 0, verticesAfter: 0, reduction: 0 };
      }

      const { simplifyProvinceBatch, countVertices } =
        await import("~/lib/province-importer/topo-simplify");

      // Build Feature array from all subdivisions with valid geometry
      const validSubs = subdivisions.filter((s) => s.geometry);
      const features = validSubs.map((sub) => ({
        type: "Feature" as const,
        properties: { name: sub.name, _dbId: sub.id },
        geometry: sub.geometry as any,
      }));

      const verticesBefore = features.reduce((s, f) => s + countVertices(f.geometry), 0);

      const result = simplifyProvinceBatch(features, {
        targetVerticesPerProvince: input.targetVerticesPerProvince,
      });

      // Write simplified geometries back to the database
      let updated = 0;
      for (let i = 0; i < validSubs.length; i++) {
        const sub = validSubs[i]!;
        const simplified = result.features[i];
        if (!simplified?.geometry) continue;

        const beforeCount = countVertices(features[i]!.geometry);
        const afterCount = countVertices(simplified.geometry);

        // Only update if actually reduced
        if (afterCount < beforeCount) {
          await ctx.db.subdivision.update({
            where: { id: sub.id },
            data: { geometry: simplified.geometry as any },
          });
          updated++;
        }
      }

      await invalidateCache(["geoCore.getAllMapFeatures"]);

      return {
        updated,
        total: subdivisions.length,
        verticesBefore,
        verticesAfter: result.totalVerticesAfter,
        reduction:
          verticesBefore > 0
            ? Math.round((1 - result.totalVerticesAfter / verticesBefore) * 100)
            : 0,
      };
    }),

  /**
   * Get per-subdivision stats for the Province Painter map mode.
   * Returns population, area, feature counts, development score, etc.
   */
  getSubdivisionStats: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const subdivisions = await ctx.db.subdivision.findMany({
        where: { countryId: input.countryId, status: "approved" },
        select: {
          id: true,
          name: true,
          type: true,
          population: true,
          areaSqKm: true,
          geometry: true,
          color: true,
        },
      });

      if (subdivisions.length === 0) return [];

      // Fetch related features for the country
      const [cities, pois, resources, routes] = await Promise.all([
        ctx.db.city.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, coordinates: true, population: true, wikiPageTitle: true },
        }),
        ctx.db.pointOfInterest.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, coordinates: true, wikiPageTitle: true },
        }),
        ctx.db.geographicResource.findMany({
          where: { countryId: input.countryId },
          select: { id: true, coordinates: true, resourceType: true },
        }),
        ctx.db.transportRoute.findMany({
          where: { countryId: input.countryId },
          select: { id: true, geometry: true },
        }),
      ]);

      // Simple bbox containment check (no PostGIS needed)
      function pointInBbox(pt: unknown, bbox: [number, number, number, number]): boolean {
        if (!Array.isArray(pt) || pt.length < 2) return false;
        const [lng, lat] = pt as [number, number];
        return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
      }

      function geoBbox(geo: any): [number, number, number, number] | null {
        if (!geo || !geo.coordinates) return null;
        const coords = geo.type === "Polygon" ? geo.coordinates[0] : geo.coordinates?.[0]?.[0];
        if (!Array.isArray(coords) || coords.length === 0) return null;
        let minLng = Infinity,
          maxLng = -Infinity,
          minLat = Infinity,
          maxLat = -Infinity;
        for (const c of coords) {
          if (c[0] < minLng) minLng = c[0];
          if (c[0] > maxLng) maxLng = c[0];
          if (c[1] < minLat) minLat = c[1];
          if (c[1] > maxLat) maxLat = c[1];
        }
        return [minLng, minLat, maxLng, maxLat];
      }

      return subdivisions.map((sub) => {
        const bbox = geoBbox(sub.geometry);

        // Count features within this subdivision's bbox
        let cityCount = 0,
          poiCount = 0,
          resourceCount = 0,
          wikiLinked = 0;
        const resourceTypes = new Set<string>();

        if (bbox) {
          for (const c of cities) {
            if (pointInBbox(c.coordinates, bbox)) {
              cityCount++;
              if (c.wikiPageTitle) wikiLinked++;
            }
          }
          for (const p of pois) {
            if (pointInBbox(p.coordinates, bbox)) {
              poiCount++;
              if (p.wikiPageTitle) wikiLinked++;
            }
          }
          for (const r of resources) {
            if (pointInBbox(r.coordinates, bbox)) {
              resourceCount++;
              if (r.resourceType) resourceTypes.add(r.resourceType);
            }
          }
        }

        const totalFeatures = cityCount + poiCount;
        const routeCount = routes.length; // simplified: all routes count for all regions

        // Development score (0-10): weighted combination of metrics
        const popScore = Math.min((sub.population ?? 0) / 1_000_000, 3); // up to 3 pts for 1M+ pop
        const cityScore = Math.min(cityCount * 1.5, 3); // up to 3 pts for 2+ cities
        const resourceScore = Math.min(resourceCount * 0.5, 2); // up to 2 pts for 4+ resources
        const infraScore = Math.min(routeCount * 0.3, 1); // up to 1 pt for routes
        const wikiScore = totalFeatures > 0 ? wikiLinked / totalFeatures : 0; // up to 1 pt
        const developmentScore = Math.min(
          10,
          Math.round((popScore + cityScore + resourceScore + infraScore + wikiScore) * 10) / 10
        );

        return {
          id: sub.id,
          name: sub.name,
          type: sub.type,
          population: sub.population,
          areaSqKm: sub.areaSqKm,
          color: sub.color,
          cityCount,
          poiCount,
          resourceCount,
          resourceTypes: Array.from(resourceTypes),
          wikiLinked,
          totalFeatures,
          developmentScore,
        };
      });
    }),

  /**
   * Create a point of interest within the user's country.
   * Auto-approved if point is inside borders.
   */
  createPOI: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        category: z.string().default("landmark"),
        coordinates: coordinatesSchema,
        description: z.string().max(500).optional(),
        icon: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + collision + name uniqueness
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Point of interest"
      );
      await checkPointCollision(
        ctx.db as any,
        "pointOfInterest",
        input.countryId,
        input.coordinates[0],
        input.coordinates[1]
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "poi");

      const poi = await ctx.db.pointOfInterest.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          category: input.category,
          coordinates: input.coordinates,
          description: input.description,
          icon: input.icon,
          wikiPageTitle: input.wikiPageTitle,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
          metadata: (input.metadata ?? {}) as any,
        },
      });

      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { name: true },
        });
        await ActivityGenerator.createActivity({
          type: "meta",
          category: "game",
          countryId: input.countryId,
          title: `New Point of Interest: ${poi.name}`,
          description: `${country?.name ?? "A country"} added a new point of interest: ${poi.name} (${poi.category}).`,
          priority: "low",
          visibility: "public",
          metadata: {
            poiId: poi.id,
            poiName: poi.name,
            category: poi.category,
            wikiPageTitle: poi.wikiPageTitle,
            description: poi.description,
          },
        });
      } catch (e) {
        console.error("[geo.createPOI] Failed to create activity for POI:", e);
      }

      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("poi", input.countryId);

      if (poi.category === "resource") {
        await syncResourcePoolModifiers(ctx.db, input.countryId);
      }

      return { id: poi.id, name: poi.name, status: "approved" as const };
    }),

  /**
   * Update a point of interest within the user's country.
   */
  updatePOI: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        poiId: z.string(),
        name: z.string().min(1).max(100).optional(),
        category: z.string().optional(),
        coordinates: coordinatesSchema.optional(),
        description: z.string().max(500).optional(),
        icon: z.string().optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const poi = await ctx.db.pointOfInterest.findFirst({
        where: { id: input.poiId, countryId: input.countryId },
      });
      if (!poi) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Point of interest not found" });
      }

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Point of interest"
        );
        await checkPointCollision(
          ctx.db as any,
          "pointOfInterest",
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          input.poiId
        );
      }
      if (input.name) {
        await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "poi", input.poiId);
      }

      const updated = await ctx.db.pointOfInterest.update({
        where: { id: input.poiId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.category && { category: input.category }),
          ...(input.coordinates && { coordinates: input.coordinates }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.wikiPageTitle !== undefined && { wikiPageTitle: input.wikiPageTitle }),
          ...(input.metadata !== undefined && { metadata: input.metadata as any }),
        },
      });

      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("poi", input.countryId);

      if (poi.category === "resource" || updated.category === "resource") {
        await syncResourcePoolModifiers(ctx.db, input.countryId);
      }

      return { id: updated.id, name: updated.name };
    }),

  /**
   * Delete a point of interest from the user's country.
   */
  deletePOI: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        poiId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const poi = await ctx.db.pointOfInterest.findFirst({
        where: { id: input.poiId, countryId: input.countryId },
      });
      if (!poi) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Point of interest not found" });
      }

      await ctx.db.pointOfInterest.delete({ where: { id: input.poiId } });
      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("poi", input.countryId);

      if (poi.category === "resource") {
        await syncResourcePoolModifiers(ctx.db, input.countryId);
      }

      return { id: input.poiId, deleted: true };
    }),

  // ──────────────────────────────────────────────
  // Story Pins — Narrative markers on the map
  // ──────────────────────────────────────────────

  createStoryPin: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(15000),
        contentFormat: z.enum(["plain", "markdown"]).default("plain"),
        category: z.enum([
          "battle",
          "founding",
          "treaty",
          "cultural",
          "religious",
          "natural",
          "trade",
          "exploration",
          "naval",
          "settlement",
          "government",
          "biography",
          "linguistic",
          "upheaval",
        ]),
        importance: z.number().int().min(0).max(2).default(0),
        coordinates: coordinatesSchema,
        ixTimeYear: z.number().int().optional(),
        eraLabel: z.string().max(100).optional(),
        wikiPageTitle: z.string().max(200).optional(),
        photos: z.array(z.string().url()).max(10).optional(),
        thumbnailUrl: z.string().url().optional(),
        icon: z.string().optional(),
        storylineId: z.string().optional(),
        storylineOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Story pin"
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.title, "storyPin");

      const pin = await ctx.db.storyPin.create({
        data: {
          title: input.title,
          content: input.content,
          contentFormat: input.contentFormat,
          countryId: input.countryId,
          category: input.category,
          importance: input.importance,
          coordinates: input.coordinates,
          ixTimeYear: input.ixTimeYear,
          eraLabel: input.eraLabel,
          wikiPageTitle: input.wikiPageTitle,
          photos: input.photos ?? [],
          thumbnailUrl: input.thumbnailUrl,
          icon: input.icon,
          storylineId: input.storylineId,
          storylineOrder: input.storylineOrder,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });
      await invalidateCache(["geoCore.getAllMapFeatures", "geoFeatures.getAllStoryPins"]);
      broadcastMapUpdate("storyPin", input.countryId);

      // Auto-generate ThinkPages news for major/legendary story pins
      if (input.importance >= 1) {
        import("~/lib/diplomatic-news-generator")
          .then(({ generateStoryPinNews }) => {
            generateStoryPinNews(
              ctx.db,
              input.countryId,
              pin.title,
              input.category,
              input.importance,
              input.ixTimeYear
            ).catch((err: unknown) => {
              console.error("[Geo] Background op failed:", (err as Error).message);
            });
          })
          .catch((err: unknown) => {
            console.error("[Geo] Background op failed:", (err as Error).message);
          });
      }

      return { id: pin.id, title: pin.title, status: "approved" as const };
    }),

  updateStoryPin: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        pinId: z.string(),
        title: z.string().min(1).max(200).optional(),
        content: z.string().min(1).max(15000).optional(),
        contentFormat: z.enum(["plain", "markdown"]).optional(),
        category: z
          .enum([
            "battle",
            "founding",
            "treaty",
            "cultural",
            "religious",
            "natural",
            "trade",
            "exploration",
            "naval",
            "settlement",
            "government",
            "biography",
            "linguistic",
            "upheaval",
          ])
          .optional(),
        importance: z.number().int().min(0).max(2).optional(),
        coordinates: coordinatesSchema.optional(),
        ixTimeYear: z.number().int().nullable().optional(),
        eraLabel: z.string().max(100).nullable().optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
        photos: z.array(z.string().url()).max(10).optional(),
        thumbnailUrl: z.string().url().nullable().optional(),
        icon: z.string().nullable().optional(),
        storylineId: z.string().nullable().optional(),
        storylineOrder: z.number().int().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const pin = await ctx.db.storyPin.findFirst({
        where: { id: input.pinId, countryId: input.countryId },
      });
      if (!pin) throw new TRPCError({ code: "NOT_FOUND", message: "Story pin not found" });

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Story pin"
        );
      }
      if (input.title) {
        await checkNameUniqueness(
          ctx.db as any,
          input.countryId,
          input.title,
          "storyPin",
          input.pinId
        );
      }

      const updated = await ctx.db.storyPin.update({
        where: { id: input.pinId },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.content && { content: input.content }),
          ...(input.contentFormat && { contentFormat: input.contentFormat }),
          ...(input.category && { category: input.category }),
          ...(input.importance !== undefined && { importance: input.importance }),
          ...(input.coordinates && { coordinates: input.coordinates }),
          ...(input.ixTimeYear !== undefined && { ixTimeYear: input.ixTimeYear }),
          ...(input.eraLabel !== undefined && { eraLabel: input.eraLabel }),
          ...(input.wikiPageTitle !== undefined && { wikiPageTitle: input.wikiPageTitle }),
          ...(input.photos && { photos: input.photos }),
          ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.storylineId !== undefined && { storylineId: input.storylineId }),
          ...(input.storylineOrder !== undefined && { storylineOrder: input.storylineOrder }),
        },
      });
      await invalidateCache(["geoCore.getAllMapFeatures", "geoFeatures.getAllStoryPins"]);
      broadcastMapUpdate("storyPin", input.countryId);
      return { id: updated.id, title: updated.title };
    }),

  deleteStoryPin: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), pinId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const pin = await ctx.db.storyPin.findFirst({
        where: { id: input.pinId, countryId: input.countryId },
      });
      if (!pin) throw new TRPCError({ code: "NOT_FOUND", message: "Story pin not found" });
      await ctx.db.storyPin.delete({ where: { id: input.pinId } });
      await invalidateCache(["geoCore.getAllMapFeatures", "geoFeatures.getAllStoryPins"]);
      broadcastMapUpdate("storyPin", input.countryId);
      return { id: input.pinId, deleted: true };
    }),

  getStoryPin: cachedPublicProcedure
    .input(z.object({ pinId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.storyPin.findUnique({
        where: { id: input.pinId },
        include: {
          country: { select: { name: true, slug: true } },
          storyline: { select: { id: true, title: true, color: true } },
        },
      });
    }),

  /** Full story pin data with wiki enrichment for the modal view. */
  getStoryPinFull: cachedPublicProcedure
    .input(z.object({ pinId: z.string() }))
    .query(async ({ ctx, input }) => {
      const pin = await ctx.db.storyPin.findUnique({
        where: { id: input.pinId },
        include: {
          country: { select: { id: true, name: true, slug: true } },
          storyline: {
            select: {
              id: true,
              title: true,
              color: true,
              description: true,
              pins: {
                select: {
                  id: true,
                  title: true,
                  ixTimeYear: true,
                  eraLabel: true,
                  category: true,
                  coordinates: true,
                },
                where: { status: "approved" },
                orderBy: [{ storylineOrder: "asc" }, { ixTimeYear: "asc" }],
              },
            },
          },
        },
      });
      if (!pin) throw new TRPCError({ code: "NOT_FOUND", message: "Story pin not found" });

      // Fetch wiki enrichment if linked
      let wikiEnrichment = null;
      if (pin.wikiPageTitle) {
        try {
          const { enrichFromWiki } = await import("~/lib/story-pin-enrichment");
          wikiEnrichment = await enrichFromWiki(pin.wikiPageTitle);
        } catch {
          // Wiki enrichment is best-effort
        }
      }

      // Fetch related pins: nearby (same country) and same-era
      const relatedPins = await ctx.db.storyPin.findMany({
        where: {
          countryId: pin.countryId,
          status: "approved",
          id: { not: pin.id },
          ...(pin.ixTimeYear != null
            ? {
                ixTimeYear: { gte: pin.ixTimeYear - 50, lte: pin.ixTimeYear + 50 },
              }
            : {}),
        },
        select: {
          id: true,
          title: true,
          category: true,
          ixTimeYear: true,
          eraLabel: true,
          coordinates: true,
          thumbnailUrl: true,
        },
        take: 10,
        orderBy: { ixTimeYear: "asc" },
      });

      return { pin, wikiEnrichment, relatedPins };
    }),

  getStoryPinsByCountry: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.storyPin.findMany({
        where: { countryId: input.countryId, status: "approved" },
        orderBy: { ixTimeYear: "asc" },
      });
    }),

  getAllStoryPins: cachedPublicProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          minYear: z.number().int().optional(),
          maxYear: z.number().int().optional(),
          storylineId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { status: "approved" };
      if (input?.category) where.category = input.category;
      if (input?.storylineId) where.storylineId = input.storylineId;
      if (input?.minYear !== undefined || input?.maxYear !== undefined) {
        where.ixTimeYear = {};
        if (input?.minYear !== undefined)
          (where.ixTimeYear as Record<string, unknown>).gte = input.minYear;
        if (input?.maxYear !== undefined)
          (where.ixTimeYear as Record<string, unknown>).lte = input.maxYear;
      }
      const pins = await ctx.db.storyPin.findMany({
        where,
        include: { country: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        type: "FeatureCollection" as const,
        features: pins
          .filter((p) => Array.isArray(p.coordinates) && (p.coordinates as number[]).length >= 2)
          .map((p) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: p.coordinates as [number, number] },
            properties: {
              id: p.id,
              title: p.title,
              category: p.category,
              importance: p.importance,
              storylineId: p.storylineId,
              ixTimeYear: p.ixTimeYear,
              eraLabel: p.eraLabel,
              wikiPageTitle: p.wikiPageTitle,
              icon: p.icon,
              thumbnailUrl: p.thumbnailUrl,
              countryId: p.countryId,
              countryName: p.country.name,
              countrySlug: p.country.slug,
            },
          })),
      };
    }),

  // ──────────────────────────────────────────────
  // Storylines — Narrative chains connecting story pins
  // ──────────────────────────────────────────────

  createStoryline: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      return ctx.db.storyline.create({
        data: {
          title: input.title,
          description: input.description,
          countryId: input.countryId,
          color: input.color ?? "#6366f1",
        },
      });
    }),

  updateStoryline: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        storylineId: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const sl = await ctx.db.storyline.findFirst({
        where: { id: input.storylineId, countryId: input.countryId },
      });
      if (!sl) throw new TRPCError({ code: "NOT_FOUND", message: "Storyline not found" });
      return ctx.db.storyline.update({
        where: { id: input.storylineId },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.color && { color: input.color }),
        },
      });
    }),

  deleteStoryline: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), storylineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const sl = await ctx.db.storyline.findFirst({
        where: { id: input.storylineId, countryId: input.countryId },
      });
      if (!sl) throw new TRPCError({ code: "NOT_FOUND", message: "Storyline not found" });
      // Unlink pins before deleting
      await ctx.db.storyPin.updateMany({
        where: { storylineId: input.storylineId },
        data: { storylineId: null, storylineOrder: null },
      });
      await ctx.db.storyline.delete({ where: { id: input.storylineId } });
      return { id: input.storylineId, deleted: true };
    }),

  getStorylinesByCountry: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.storyline.findMany({
        where: { countryId: input.countryId },
        include: { _count: { select: { pins: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  getStorylineWithPins: cachedPublicProcedure
    .input(z.object({ storylineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const storyline = await ctx.db.storyline.findUnique({
        where: { id: input.storylineId },
        include: {
          pins: {
            where: { status: "approved" },
            orderBy: [{ storylineOrder: "asc" }, { ixTimeYear: "asc" }],
            select: {
              id: true,
              title: true,
              category: true,
              ixTimeYear: true,
              eraLabel: true,
              coordinates: true,
              importance: true,
              thumbnailUrl: true,
            },
          },
          country: { select: { name: true, slug: true } },
        },
      });
      if (!storyline) throw new TRPCError({ code: "NOT_FOUND", message: "Storyline not found" });
      return storyline;
    }),

  // ──────────────────────────────────────────────
  // Map Labels — Custom styled text on the map
  // ──────────────────────────────────────────────

  createMapLabel: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        text: z.string().min(1).max(100),
        labelType: z.enum([
          "mountain_range",
          "strait",
          "bay",
          "peninsula",
          "plateau",
          "valley",
          "desert",
          "sea",
          "region",
          "historical",
        ]),
        coordinates: coordinatesSchema,
        fontSize: z.number().min(8).max(48).default(14),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#374151"),
        rotation: z.number().min(-180).max(180).default(0),
        letterSpacing: z.number().min(0).max(1).default(0),
        fontWeight: z.enum(["normal", "bold"]).default("normal"),
        opacity: z.number().min(0.1).max(1).default(1),
        minZoom: z.number().min(0).max(18).default(4),
        maxZoom: z.number().min(0).max(22).default(18),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Map label"
      );

      const label = await ctx.db.mapLabel.create({
        data: {
          text: input.text,
          countryId: input.countryId,
          labelType: input.labelType,
          coordinates: input.coordinates,
          fontSize: input.fontSize,
          color: input.color,
          rotation: input.rotation,
          letterSpacing: input.letterSpacing,
          fontWeight: input.fontWeight,
          opacity: input.opacity,
          minZoom: input.minZoom,
          maxZoom: input.maxZoom,
          wikiPageTitle: input.wikiPageTitle,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });
      await invalidateCache(["geoCore.getAllMapFeatures", "geoFeatures.getAllMapLabels"]);
      broadcastMapUpdate("mapLabel", input.countryId);
      return { id: label.id, text: label.text, status: "approved" as const };
    }),

  updateMapLabel: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        labelId: z.string(),
        text: z.string().min(1).max(100).optional(),
        labelType: z
          .enum([
            "mountain_range",
            "strait",
            "bay",
            "peninsula",
            "plateau",
            "valley",
            "desert",
            "sea",
            "region",
            "historical",
          ])
          .optional(),
        coordinates: coordinatesSchema.optional(),
        fontSize: z.number().min(8).max(48).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        rotation: z.number().min(-180).max(180).optional(),
        letterSpacing: z.number().min(0).max(1).optional(),
        fontWeight: z.enum(["normal", "bold"]).optional(),
        opacity: z.number().min(0.1).max(1).optional(),
        minZoom: z.number().min(0).max(18).optional(),
        maxZoom: z.number().min(0).max(22).optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const label = await ctx.db.mapLabel.findFirst({
        where: { id: input.labelId, countryId: input.countryId },
      });
      if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Map label not found" });

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Map label"
        );
      }

      const { countryId: _, labelId: __, ...updateData } = input;
      const updated = await ctx.db.mapLabel.update({
        where: { id: input.labelId },
        data: Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined)),
      });
      await invalidateCache(["geoCore.getAllMapFeatures", "geoFeatures.getAllMapLabels"]);
      broadcastMapUpdate("mapLabel", input.countryId);
      return { id: updated.id, text: updated.text };
    }),

  deleteMapLabel: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), labelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const label = await ctx.db.mapLabel.findFirst({
        where: { id: input.labelId, countryId: input.countryId },
      });
      if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Map label not found" });
      await ctx.db.mapLabel.delete({ where: { id: input.labelId } });
      await invalidateCache(["geoCore.getAllMapFeatures", "geoFeatures.getAllMapLabels"]);
      broadcastMapUpdate("mapLabel", input.countryId);
      return { id: input.labelId, deleted: true };
    }),

  getMapLabelsByCountry: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.mapLabel.findMany({
        where: { countryId: input.countryId, status: "approved" },
        orderBy: { text: "asc" },
      });
    }),

  getAllMapLabels: cachedPublicProcedure.query(async ({ ctx }) => {
    const labels = await ctx.db.mapLabel.findMany({
      where: { status: "approved" },
      include: { country: { select: { name: true, slug: true } } },
    });
    return {
      type: "FeatureCollection" as const,
      features: labels
        .filter((l) => Array.isArray(l.coordinates) && (l.coordinates as number[]).length >= 2)
        .map((l) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: l.coordinates as [number, number] },
          properties: {
            id: l.id,
            text: l.text,
            labelType: l.labelType,
            fontSize: l.fontSize,
            color: l.color,
            rotation: l.rotation,
            letterSpacing: l.letterSpacing,
            fontWeight: l.fontWeight,
            opacity: l.opacity,
            minZoom: l.minZoom,
            maxZoom: l.maxZoom,
            wikiPageTitle: l.wikiPageTitle,
            countryId: l.countryId,
            countryName: l.country.name,
          },
        })),
    };
  }),

  // ──────────────────────────────────────────────
  // Sovereignty / dependency management
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Linkage validation & repair
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // SVG Upload & Processing Pipeline
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // World Template / Clone System (Phase 3)
  // ──────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // Procedural World Generation (Phase 4)
  // ──────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Map Pipeline Endpoints
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Province Import Endpoints
  // ──────────────────────────────────────────────

  /**
   * Delete all subdivisions for a country. Admin forge operation.
   */
  deleteAllSubdivisions: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete regions for your own country",
        });
      }
      const result = await ctx.db.subdivision.deleteMany({
        where: { countryId: input.countryId },
      });
      return { deleted: result.count };
    }),

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
});
