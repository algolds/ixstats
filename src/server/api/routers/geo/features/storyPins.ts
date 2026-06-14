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
import { validatePointContainment, checkNameUniqueness } from "~/lib/geo-validation";

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

export const geoFeaturesStoryPinsRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

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
