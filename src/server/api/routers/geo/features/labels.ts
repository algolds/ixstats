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
import { validatePointContainment } from "~/lib/geo-validation";

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

export const geoFeaturesLabelsRouter = createTRPCRouter({
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

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
});
