import { z } from "zod";
import { adminProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { TRPCError } from "@trpc/server";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { queueGeoProfileRecalculation } from "./profile-job";
import { requirePoliticalLayer } from "./shared";

export const adminOpsProcedures = {
  recalculateArea: adminProcedure
    .input(z.object({ featureId: z.string(), ...realmScopeInput.shape }))
    .mutation(async ({ ctx, input }) => {
      const realmId = await viewerRealmId(ctx, input.realm);
      const mapLayer = await requirePoliticalLayer(ctx.db, input.featureId, realmId);

      let areaSqKm: number | null = null;
      try {
        const result = await ctx.db.$queryRawUnsafe<Array<{ area_sqkm: number }>>(
          `SELECT ST_Area(geom_postgis::geography) / 1000000.0 as area_sqkm
           FROM map_layers WHERE id = $1 AND geom_postgis IS NOT NULL`,
          mapLayer.id
        );

        if (result.length > 0 && result[0].area_sqkm) {
          await ctx.db.mapLayer.update({
            where: { id: mapLayer.id },
            data: { areaSqKm: result[0].area_sqkm },
          });
          if (mapLayer.countryId) {
            await syncCountryGeometryFromMapLayer(ctx.db, mapLayer.countryId);
          }
          areaSqKm = result[0].area_sqkm;
        }
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "PostGIS area calculation failed",
        });
      }

      if (areaSqKm !== null) {
        await invalidateRealmMap(ctx.db, realmId);
        return { featureId: input.featureId, areaSqKm };
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No geometry available for area calculation",
      });
    }),

  /**
   * Admin: queue a recompute of the stored geo profiles (one country, or every country with geometry), and with
   * them the country's map-derived `GeographicResource` rows (AT-9). The `geo-profiles` cron job does the work.
   */
  recalculateGeoProfiles: adminProcedure
    .input(z.object({ countryId: z.string().optional() }).optional())
    .mutation(({ ctx, input }) => queueGeoProfileRecalculation(ctx.db, input?.countryId)),
};
