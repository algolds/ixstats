/**
 * realms.map: what a realm's map viewer shows beyond its layers (planet radius, default view, base image, credit
 * line, unclaimed nations, whether the viewer edits it), the realm's map settings, and "Recompute areas". Logic
 * lives in ~/server/modules/realms/realms.map.ts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { RealmRegionError } from "~/server/modules/realms/realms.region";
import {
  getRealmMapDisplay,
  recomputeRealmMapAreas,
  updateRealmMapSettings,
} from "~/server/modules/realms/realms.map";
import { RealmMapSettingsSchema } from "~/lib/maps/realm-map-settings";
import { invalidateCache } from "~/lib/cache";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";

function mapError(error: Error): never {
  if (error instanceof RealmRegionError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

/** A mutation names its realm by slug; without one it would fall back to the caller's active nation's realm. */
const realmInput = z.object({ realm: z.string().min(1).max(100) });

const settingsShape = RealmMapSettingsSchema.shape;

export const realmMapRouter = createTRPCRouter({
  /** The viewer's realm (`?realm=`, else their active nation's, else IxWorld) and how its map is shown. */
  display: publicProcedure.input(realmScopeInput.optional()).query(async ({ ctx, input }) => {
    const realmId = await viewerRealmId(ctx, input?.realm);
    return getRealmMapDisplay(ctx.db, ctx.user ?? null, realmId);
  }),

  /**
   * Set (or, with null, clear) the planet radius, base image, credit line and default view. The realm's map
   * editors only (site admins, the founder, officers with the Map power).
   */
  updateSettings: rateLimitedMutationProcedure
    .input(
      realmInput.extend({
        radiusKm: settingsShape.radiusKm.unwrap().nullable().optional(),
        baseImage: settingsShape.baseImage.unwrap().or(z.literal("")).nullable().optional(),
        attribution: settingsShape.attribution.unwrap().nullable().optional(),
        defaultView: settingsShape.defaultView.unwrap().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realmId = await viewerRealmId(ctx, input.realm);
      const { realm: _realm, ...changes } = input;
      return updateRealmMapSettings(ctx.db, ctx.user, realmId, changes).catch(mapError);
    }),

  /**
   * Measure the realm's map features again on its planet radius. Nations' stated land area changes only when
   * `alsoSetLandArea` is ticked, by the founder (or site staff).
   */
  recomputeAreas: rateLimitedMutationProcedure
    .input(realmInput.extend({ alsoSetLandArea: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const realmId = await viewerRealmId(ctx, input.realm);
      const result = await recomputeRealmMapAreas(ctx.db, ctx.user, realmId, {
        alsoSetLandArea: input.alsoSetLandArea,
      }).catch(mapError);
      clearLayerCache();
      await invalidateCache([
        "geoCore.getWorldMap",
        "geoCore.getMapBundle",
        "geoCore.getCountryGeometry",
        "geoCore.getCountryFeatures",
        "geoEditor.validateLinkage",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("borders");
      return result;
    }),
});
