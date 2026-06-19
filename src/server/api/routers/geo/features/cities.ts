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
import { createTRPCRouter, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/map-update-bus";
import {
  validatePointContainment,
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

import { syncGeographicDemographics } from "~/lib/country-geo/sync";

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

export const geoFeaturesCitiesRouter = createTRPCRouter({
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

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
});
