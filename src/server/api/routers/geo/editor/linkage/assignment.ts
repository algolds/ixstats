import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { clearLayerCache } from "../../core";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";

export const geoEditorLinkageAssignmentRouter = createTRPCRouter({
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
});
