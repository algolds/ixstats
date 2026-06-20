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

export const geoFeaturesStorylinesRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Story Pins — Narrative markers on the map
  // ──────────────────────────────────────────────

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
