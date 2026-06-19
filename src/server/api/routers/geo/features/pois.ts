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
import { ActivityGenerator } from "~/lib/activity-generator";
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
export { syncGeographicDemographics };

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

export const geoFeaturesPoisRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

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
