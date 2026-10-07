import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { editableMapRealmId, realmScopeInput } from "~/server/api/trpc/realm-scope";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/cache";
import { clearLayerCache } from "../../core";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { findAllById } from "~/lib/system/find-all-by-id";
import { AUTO_LINK_MIN_CONFIDENCE } from "~/lib/maps/nation-name-matching";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import { assertCountryInFeatureRealm } from "~/server/shared/realm-link-guard";
import { linkRegionMatches, realmMatchSuggestions } from "./matching";

export const geoEditorLinkageValidationRouter = createTRPCRouter({
  /** Validate country ↔ map feature linkage. Returns inconsistencies. */
  validateLinkage: protectedProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      // The edited realm's political map layers and countries (ruling E-o)
      const realmId = await editableMapRealmId(ctx, input?.realm);
      const mapLayers = await ctx.db.mapLayer.findMany({
        where: { layerType: "political", isActive: true, realmId },
        take: 50_000,
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

      // Get all countries with their owners
      const countries = await ctx.db.country.findMany({
        where: { isDemo: false, realmId },
        take: 50_000,
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          landArea: true,
          geometry: true,
          centroid: true,
          boundingBox: true,
          owner: { select: { clerkUserId: true, forumUsername: true } },
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
            hasOwner: c.owner !== null,
            ownerName: c.owner?.forumUsername ?? c.owner?.clerkUserId ?? null,
          };
        }),
        unlinked: unlinked.map((c) => ({
          countryId: c.id,
          countryName: c.name,
          countryFlag: normalizeFlagUrl(c.flag),
          hasGeometry: !!c.geometry,
          hasLandArea: !!(c.landArea && c.landArea > 0),
          hasOwner: c.owner !== null,
          ownerName: c.owner?.forumUsername ?? c.owner?.clerkUserId ?? null,
        })),
      };
    }),

  /**
   * Auto-Match's review list: each unlinked region of the edited realm with the nation its name points to and
   * how sure the match is (exact, normalised, state form, or a similar spelling).
   */
  suggestLinkageMatches: protectedProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input?.realm);
      return realmMatchSuggestions(ctx.db, realmId);
    }),

  /**
   * Repair linkage: sync geometry/area from MapLayer to Country, auto-match by name (the confident matches
   * only), link the matches picked from the review list, or link one feature by hand.
   */
  repairLinkage: rateLimitedMutationProcedure
    .input(
      z.object({
        action: z.enum(["sync_all", "auto_match", "apply_matches", "link_by_name"]),
        /** For link_by_name: map featureId to countryId */
        featureId: z.string().optional(),
        countryId: z.string().optional(),
        /** For apply_matches: the reviewed region → nation pairs (several regions may share a nation). */
        matches: z
          .array(z.object({ featureId: z.string().min(1), countryId: z.string().min(1) }))
          .max(5000)
          .optional(),
        ...realmScopeInput.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      let repaired = 0;
      // Every action works inside the edited realm (site admins anywhere; founders and map officers in theirs)
      const realmId = await editableMapRealmId(ctx, input.realm);

      if (input.action === "sync_all") {
        // Re-sync geometry + area from MapLayer → Country for the realm's linked countries, once per nation
        const linkedLayers = await findAllById((page) =>
          ctx.db.mapLayer.findMany({
            where: { layerType: "political", countryId: { not: null }, isActive: true, realmId },
            select: { id: true, countryId: true },
            ...page,
          })
        );
        for (const countryId of new Set(linkedLayers.map((ml) => ml.countryId))) {
          if (!countryId) continue;
          await syncCountryGeometryFromMapLayer(ctx.db, countryId);
          repaired++;
        }
      }

      if (input.action === "auto_match") {
        const { suggestions } = await realmMatchSuggestions(ctx.db, realmId);
        repaired = await linkRegionMatches(
          ctx.db,
          realmId,
          suggestions.filter((s) => s.confidence >= AUTO_LINK_MIN_CONFIDENCE)
        );
      }

      if (input.action === "apply_matches") {
        repaired = await linkRegionMatches(ctx.db, realmId, input.matches ?? []);
      }

      if (input.action === "link_by_name" && input.featureId && input.countryId) {
        const ml = await ctx.db.mapLayer.findFirst({
          where: { layerType: "political", featureId: input.featureId, isActive: true, realmId },
        });
        if (!ml) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
        await assertCountryInFeatureRealm(ctx.db, input.countryId, realmId);

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
});
