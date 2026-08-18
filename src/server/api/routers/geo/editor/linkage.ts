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
  // eslint-disable-next-line unused-imports/no-unused-imports
  publicProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  rateLimitedPublicProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  cachedPublicProcedure,
  adminProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  countryOwnerProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { clearLayerCache } from "../core";
// eslint-disable-next-line unused-imports/no-unused-imports
import { ActivityGenerator } from "~/lib/activity";
import { normalizeFlagUrl } from "~/lib/flags/unified-flag-service";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoEditorLinkageRouter = createTRPCRouter({
  /**
   * Admin: Link a map feature to a Country record.
   */
  assignCountryGeometry: adminProcedure
    .input(
      z.object({
        featureId: z.string(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify feature exists
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId },
      });
      if (!mapLayer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Map feature not found: ${input.featureId}`,
        });
      }

      // Verify country exists
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
      });
      if (!country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Country not found: ${input.countryId}`,
        });
      }

      // Update map layer with country link
      await ctx.db.mapLayer.update({
        where: { id: mapLayer.id },
        data: { countryId: input.countryId },
      });

      // Update country with geometry + area
      await syncCountryGeometryFromMapLayer(ctx.db, input.countryId);

      // Invalidate caches
      clearLayerCache("political");
      await invalidateCache([
        "geoCore.listCountries",
        "geoCore.getWorldMap",
        "geoEditor.validateLinkage",
        "geoCore.getCountryLinkage",
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("linkage", input.countryId);

      return {
        featureId: input.featureId,
        countryId: input.countryId,
        countryName: country.name,
      };
    }),

  /**
   * Admin: Unlink a map feature from a Country record.
   */
  unlinkCountryGeometry: adminProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId },
      });

      if (!mapLayer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Map feature not found: ${input.featureId}`,
        });
      }

      const previousCountryId = mapLayer.countryId;

      await ctx.db.mapLayer.update({
        where: { id: mapLayer.id },
        data: { countryId: null },
      });

      // Clear geometry + area from country
      if (previousCountryId) {
        await syncCountryGeometryFromMapLayer(ctx.db, previousCountryId);
      }

      clearLayerCache("political");
      await invalidateCache([
        "geoCore.listCountries",
        "geoCore.getWorldMap",
        "geoEditor.validateLinkage",
        "geoCore.getCountryLinkage",
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("linkage", previousCountryId ?? undefined);

      return { featureId: input.featureId, previousCountryId };
    }),

  /**
   * Admin: Get all details for a specific map feature.
   */
  getFeatureDetails: adminProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const feature = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId, isActive: true },
        include: {
          country: {
            select: {
              id: true,
              name: true,
              wikiPageTitle: true,
            },
          },
        },
      });
      if (!feature) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Feature not found: ${input.featureId}`,
        });
      }
      return {
        id: feature.id,
        featureId: feature.featureId,
        displayName: feature.displayName,
        countryId: feature.countryId,
        areaSqKm: feature.areaSqKm,
        centroid: feature.centroid,
        boundingBox: feature.boundingBox,
        properties: feature.properties,
        wikiPageTitle: feature.country?.wikiPageTitle ?? null,
        countryName: feature.country?.name ?? null,
      };
    }),

  /**
   * Admin: Update properties (displayName, countryId, properties, wikiPageTitle) of a map feature.
   */
  updateFeatureProperties: adminProcedure
    .input(
      z.object({
        featureId: z.string(),
        displayName: z.string().optional(),
        countryId: z.string().nullable().optional(),
        properties: z.record(z.string(), z.any()).optional(),
        wikiPageTitle: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId, isActive: true },
      });
      if (!feature) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Feature not found: ${input.featureId}`,
        });
      }

      const updateData: any = {};
      if (input.displayName !== undefined) {
        updateData.displayName = input.displayName;
      }
      if (input.countryId !== undefined) {
        updateData.countryId = input.countryId;
      }
      if (input.properties !== undefined) {
        updateData.properties = input.properties;
      }

      await ctx.db.mapLayer.update({
        where: { id: feature.id },
        data: updateData,
      });

      const targetCountryId = input.countryId !== undefined ? input.countryId : feature.countryId;

      // Update Country name and slug if displayName is changed and country is linked
      if (targetCountryId && input.displayName !== undefined) {
        const slug = input.displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        await ctx.db.country.update({
          where: { id: targetCountryId },
          data: {
            name: input.displayName,
            slug,
          },
        });
      }

      // Update wikiPageTitle on Country if linked
      if (targetCountryId && input.wikiPageTitle !== undefined) {
        await ctx.db.country.update({
          where: { id: targetCountryId },
          data: { wikiPageTitle: input.wikiPageTitle },
        });
      }

      if (input.countryId !== undefined) {
        if (feature.countryId) {
          await syncCountryGeometryFromMapLayer(ctx.db, feature.countryId);
        }
        if (input.countryId) {
          await syncCountryGeometryFromMapLayer(ctx.db, input.countryId);
        }
      }

      clearLayerCache("political");
      await invalidateCache([
        "geoCore.listCountries",
        "geoCore.getWorldMap",
        "geoEditor.validateLinkage",
        "geoCore.getCountryLinkage",
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "countryGeo.getCountryGeoBundle",
      ]);

      if (input.countryId !== undefined) {
        broadcastMapUpdate("linkage", input.countryId ?? undefined);
      }

      return { ok: true };
    }),

  /**
   * Admin: Auto-link all unlinked political map features to Country records.
   * For each unlinked feature:
   *   1. Try to match an existing Country by name (case-insensitive)
   *   2. If no match, auto-create a new Country record
   * Also auto-detects wiki articles and sets wikiPageTitle.
   */
  autoLinkAllCountries: adminProcedure.mutation(async ({ ctx }) => {
    const unlinked = await ctx.db.mapLayer.findMany({
      where: { layerType: "political", countryId: null, isActive: true },
      select: {
        id: true,
        featureId: true,
        displayName: true,
        geometry: true,
        areaSqKm: true,
        centroid: true,
        boundingBox: true,
      },
    });

    if (unlinked.length === 0) return { linked: 0, created: 0, failed: [] as string[] };

    // Get all existing countries for name matching
    const existingCountries = await ctx.db.country.findMany({
      where: { isDemo: false },
      select: { id: true, name: true },
    });
    const countryByName = new Map(existingCountries.map((c) => [c.name.toLowerCase(), c]));

    // Track which countries are already linked
    const alreadyLinked = new Set(
      (
        await ctx.db.mapLayer.findMany({
          where: { layerType: "political", countryId: { not: null }, isActive: true },
          select: { countryId: true },
        })
      ).map((ml) => ml.countryId)
    );

    let linked = 0;
    let created = 0;
    const failed: string[] = [];

    // Load WikiBridge for auto-detecting wiki articles
    let wikiBridge: typeof import("~/lib/wiki/bridge") | null = null;
    try {
      wikiBridge = await import("~/lib/wiki/bridge");
    } catch {
      /* wiki bridge unavailable */
    }

    for (const feature of unlinked) {
      const name = feature.displayName || feature.featureId;
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      try {
        // Try to match existing country by name
        const existing = countryByName.get(name.toLowerCase());

        if (existing && !alreadyLinked.has(existing.id)) {
          // Link to existing country
          await ctx.db.mapLayer.update({
            where: { id: feature.id },
            data: { countryId: existing.id },
          });
          await syncCountryGeometryFromMapLayer(ctx.db, existing.id);
          alreadyLinked.add(existing.id);
          linked++;
        } else {
          // Auto-detect wiki article
          let wikiPageTitle: string | null = null;
          if (wikiBridge) {
            const wikiResults = await wikiBridge.searchPages(name, 1, "ixwiki");
            if (
              wikiResults.length > 0 &&
              wikiResults[0]!.title.toLowerCase() === name.toLowerCase()
            ) {
              wikiPageTitle = wikiResults[0]!.title;
            }
          }

          // Create new country
          const newCountry = await ctx.db.country.create({
            data: {
              name,
              slug,
              geometry: feature.geometry as any,
              centroid: feature.centroid as any,
              boundingBox: feature.boundingBox as any,
              landArea: feature.areaSqKm ?? undefined,
              areaSqMi: feature.areaSqKm ? feature.areaSqKm * 0.386102 : undefined,
              economicTier: "developing",
              isDemo: false,
              wikiPageTitle,
              wikiSource: wikiPageTitle ? "ixwiki" : undefined,
            } as any,
          });

          // Link map feature to new country
          await ctx.db.mapLayer.update({
            where: { id: feature.id },
            data: { countryId: newCountry.id },
          });
          alreadyLinked.add(newCountry.id);
          created++;
        }
      } catch (err) {
        failed.push(`${name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    clearLayerCache("political");
    await invalidateCache([
      "geoCore.listCountries",
      "geoCore.getWorldMap",
      "geoEditor.validateLinkage",
      "geoCore.getCountryFeatures",
      "geoCore.getMapBundle",
      "countryGeo.getCountryGeoBundle",
    ]);

    return { linked, created, failed, total: unlinked.length };
  }),

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

  // ──────────────────────────────────────────────
  // Sovereignty / dependency management
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Linkage validation & repair
  // ──────────────────────────────────────────────

  /**
   * Admin: Create a new Country record from an unclaimed political map feature.
   */
  createCountryFromShape: adminProcedure
    .input(z.object({ featureId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId, isActive: true },
      });
      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
      }
      if (feature.countryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Feature already linked to a country",
        });
      }
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const newCountry = await ctx.db.country.create({
        data: {
          name: input.name,
          slug,
          geometry: feature.geometry as any,
          centroid: feature.centroid as any,
          boundingBox: feature.boundingBox as any,
          landArea: feature.areaSqKm ?? undefined,
          areaSqMi: feature.areaSqKm ? feature.areaSqKm * 0.386102 : undefined,
          economicTier: "developing",
          isDemo: false,
        } as any,
      });
      await ctx.db.mapLayer.update({
        where: { id: feature.id },
        data: { countryId: newCountry.id },
      });
      await syncCountryGeometryFromMapLayer(ctx.db, newCountry.id);
      clearLayerCache("political");
      await invalidateCache([
        "geoCore.listCountries",
        "geoCore.getWorldMap",
        "geoEditor.validateLinkage",
        "geoCore.getCountryLinkage",
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("linkage", newCountry.id);
      return { countryId: newCountry.id, name: newCountry.name };
    }),

  /** Validate country ↔ map feature linkage. Returns inconsistencies. */
  validateLinkage: adminProcedure.query(async ({ ctx }) => {
    // Get all political map layers with country links
    const mapLayers = await ctx.db.mapLayer.findMany({
      where: { layerType: "political", isActive: true },
      select: {
        id: true,
        featureId: true,
        displayName: true,
        countryId: true,
        areaSqKm: true,
        centroid: true,
        boundingBox: true,
      },
    });

    // Get all countries with their users
    const countries = await ctx.db.country.findMany({
      where: { isDemo: false },
      select: {
        id: true,
        name: true,
        slug: true,
        flag: true,
        landArea: true,
        geometry: true,
        centroid: true,
        boundingBox: true,
        users: { select: { clerkUserId: true, forumUsername: true } },
      },
    });

    const mapLayerByCountryId = new Map(
      mapLayers.filter((l) => l.countryId).map((l) => [l.countryId!, l])
    );
    const countryById = new Map(countries.map((c) => [c.id, c]));

    const issues: Array<{
      type:
        | "no_map_link"
        | "orphan_geometry"
        | "missing_geometry_sync"
        | "missing_area_sync"
        | "stale_map_link";
      countryId: string;
      countryName: string;
      featureId?: string;
      featureName?: string;
      detail: string;
    }> = [];

    // Countries with no MapLayer link
    for (const country of countries) {
      const mapLayer = mapLayerByCountryId.get(country.id);

      if (!mapLayer) {
        // Country has no linked map feature
        if (country.geometry || (country.landArea && country.landArea > 0)) {
          issues.push({
            type: "orphan_geometry",
            countryId: country.id,
            countryName: country.name,
            detail: `Country has geometry/landArea but no MapLayer link`,
          });
        } else {
          issues.push({
            type: "no_map_link",
            countryId: country.id,
            countryName: country.name,
            detail: `Country has no linked map feature`,
          });
        }
      } else {
        // Country IS linked — check data sync
        if (!country.geometry) {
          issues.push({
            type: "missing_geometry_sync",
            countryId: country.id,
            countryName: country.name,
            featureId: mapLayer.featureId,
            featureName: mapLayer.displayName ?? mapLayer.featureId,
            detail: `MapLayer linked but Country.geometry is null`,
          });
        }
        if (!country.landArea && mapLayer.areaSqKm) {
          issues.push({
            type: "missing_area_sync",
            countryId: country.id,
            countryName: country.name,
            featureId: mapLayer.featureId,
            featureName: mapLayer.displayName ?? mapLayer.featureId,
            detail: `MapLayer has areaSqKm=${mapLayer.areaSqKm?.toFixed(0)} but Country.landArea is null`,
          });
        }
      }
    }

    // MapLayers pointing to non-existent countries
    for (const layer of mapLayers) {
      if (layer.countryId && !countryById.has(layer.countryId)) {
        issues.push({
          type: "stale_map_link",
          countryId: layer.countryId,
          countryName: "(deleted)",
          featureId: layer.featureId,
          featureName: layer.displayName ?? layer.featureId,
          detail: `MapLayer links to non-existent country ${layer.countryId}`,
        });
      }
    }

    // Build linkage summary
    const linked = countries.filter((c) => mapLayerByCountryId.has(c.id));
    const unlinked = countries.filter((c) => !mapLayerByCountryId.has(c.id));

    return {
      totalCountries: countries.length,
      linkedCount: linked.length,
      unlinkedCount: unlinked.length,
      issueCount: issues.length,
      issues,
      linked: linked.map((c) => {
        const ml = mapLayerByCountryId.get(c.id)!;
        return {
          countryId: c.id,
          countryName: c.name,
          countryFlag: normalizeFlagUrl(c.flag),
          featureId: ml.featureId,
          featureName: ml.displayName ?? ml.featureId,
          areaSqKm: ml.areaSqKm,
          hasOwner: c.users.length > 0,
          ownerName: c.users[0]?.forumUsername ?? c.users[0]?.clerkUserId ?? null,
        };
      }),
      unlinked: unlinked.map((c) => ({
        countryId: c.id,
        countryName: c.name,
        countryFlag: normalizeFlagUrl(c.flag),
        hasGeometry: !!c.geometry,
        hasLandArea: !!(c.landArea && c.landArea > 0),
        hasOwner: c.users.length > 0,
        ownerName: c.users[0]?.forumUsername ?? c.users[0]?.clerkUserId ?? null,
      })),
    };
  }),

  /** Repair linkage: sync geometry/area from MapLayer to Country, or auto-match by name. */
  repairLinkage: adminProcedure
    .input(
      z.object({
        action: z.enum(["sync_all", "auto_match", "link_by_name"]),
        /** For link_by_name: map featureId to countryId */
        featureId: z.string().optional(),
        countryId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let repaired = 0;

      if (input.action === "sync_all") {
        // Re-sync geometry + area from MapLayer → Country for all linked countries
        const linkedLayers = await ctx.db.mapLayer.findMany({
          where: { layerType: "political", countryId: { not: null }, isActive: true },
          select: {
            countryId: true,
            geometry: true,
            centroid: true,
            boundingBox: true,
            areaSqKm: true,
          },
        });

        for (const ml of linkedLayers) {
          if (!ml.countryId) continue;
          await syncCountryGeometryFromMapLayer(ctx.db, ml.countryId);
          repaired++;
        }
      }

      if (input.action === "auto_match") {
        // Try to match unlinked countries to unlinked features by name
        const unlinkedLayers = await ctx.db.mapLayer.findMany({
          where: { layerType: "political", countryId: null, isActive: true },
          select: {
            id: true,
            featureId: true,
            displayName: true,
            geometry: true,
            centroid: true,
            boundingBox: true,
            areaSqKm: true,
          },
        });
        const unlinkedCountries = await ctx.db.country.findMany({
          where: {
            isDemo: false,
            id: {
              notIn: (
                await ctx.db.mapLayer.findMany({
                  where: { layerType: "political", countryId: { not: null } },
                  select: { countryId: true },
                })
              )
                .map((m) => m.countryId!)
                .filter(Boolean),
            },
          },
          select: { id: true, name: true },
        });

        const countryNameMap = new Map(unlinkedCountries.map((c) => [c.name.toLowerCase(), c]));

        for (const layer of unlinkedLayers) {
          const name = (layer.displayName || featureIdToDisplayName(layer.featureId)).toLowerCase();
          const match = countryNameMap.get(name);
          if (match) {
            await ctx.db.mapLayer.update({
              where: { id: layer.id },
              data: { countryId: match.id },
            });
            await syncCountryGeometryFromMapLayer(ctx.db, match.id);
            repaired++;
            countryNameMap.delete(name);
          }
        }
      }

      if (input.action === "link_by_name" && input.featureId && input.countryId) {
        const ml = await ctx.db.mapLayer.findFirst({
          where: { layerType: "political", featureId: input.featureId, isActive: true },
        });
        if (!ml) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

        await ctx.db.mapLayer.update({
          where: { id: ml.id },
          data: { countryId: input.countryId },
        });
        await syncCountryGeometryFromMapLayer(ctx.db, input.countryId);
        repaired = 1;
      }

      clearLayerCache("political");
      await invalidateCache([
        "geoCore.listCountries",
        "geoCore.getWorldMap",
        "geoEditor.validateLinkage",
        "geoCore.getCountryGeometry",
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "countryGeo.getCountryGeoBundle",
      ]);

      return { repaired };
    }),

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
