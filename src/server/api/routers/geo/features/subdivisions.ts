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
  cachedPublicProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/map-update-bus";
import { getTerrainForArea } from "~/lib/base-layer-query";
import { clipAndValidatePolygon, checkNameUniqueness } from "~/lib/geo-validation";
import { generateProvinces } from "~/lib/province-generator";

/** Reusable Zod schema for WGS84 coordinate pair [lng, lat] with bounds checking. */
// eslint-disable-next-line unused-imports/no-unused-vars
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

export const geoFeaturesSubdivisionsRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

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

  // ──────────────────────────────────────────────
  // Story Pins — Narrative markers on the map
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Storylines — Narrative chains connecting story pins
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Map Labels — Custom styled text on the map
  // ──────────────────────────────────────────────

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

  /**
   * Commit generated subdivisions: auto-subdivide a country polygon into N
   * provinces using Voronoi tessellation. Each cell is clipped to the country
   * border via clipAndValidatePolygon and bulk-created as an approved Subdivision.
   */
  commitGeneratedSubdivisions: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        count: z.number().int().min(2).max(200),
        seed: z.number().optional(),
        names: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Load country geometry from the map_layers table (needed for the pure-math generator)
      const rows = await ctx.db.$queryRawUnsafe<Array<{ geom_geojson: string }>>(
        `SELECT ST_AsGeoJSON(geom_postgis) as geom_geojson
         FROM map_layers
         WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL
         LIMIT 1`,
        input.countryId
      );
      if (rows.length === 0 || !rows[0]?.geom_geojson) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country geometry not found" });
      }
      const countryGeom = JSON.parse(rows[0].geom_geojson) as any;

      // Generate raw Voronoi cells (pure math, no DB yet)
      const rawCells = generateProvinces(countryGeom, input.count, {
        seed: input.seed,
      });
      if (rawCells.length === 0) {
        return { created: 0, skipped: 0 };
      }

      const names = input.names ?? [];
      let created = 0;
      let skipped = 0;

      // Clip each cell to the country border and create a Subdivision
      for (let i = 0; i < rawCells.length; i++) {
        const cell = rawCells[i]!;
        const clipped = await clipAndValidatePolygon(
          ctx.db as any,
          input.countryId,
          cell as unknown as Record<string, unknown>,
          `Generated Province ${i + 1}`
        );
        const name = names[i] || `Province ${i + 1}`;

        try {
          await ctx.db.subdivision.create({
            data: {
              name,
              countryId: input.countryId,
              type: "province",
              level: 1,
              geometry: clipped,
              status: "approved",
              submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
            },
          });
          created++;
        } catch {
          skipped++;
        }
      }

      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("subdivision", input.countryId);
      await syncGeographicDemographics(ctx.db, input.countryId);

      return { created, skipped, totalCells: rawCells.length };
    }),

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
});
