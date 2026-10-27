import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { editableMapRealmId, realmScopeInput } from "~/server/api/trpc/realm-scope";
import { isSiteAdmin, type RealmActor } from "~/server/modules/realms";
import { RealmRegionError } from "~/server/modules/realms/realms.region";
import { renameGeneratedSlot } from "~/server/modules/realms/realms.slot-rename";
import { createNationFromShape } from "~/server/modules/realms/realms.shape-nation";
import { invalidateCache } from "~/lib/cache";
import { TRPCError } from "@trpc/server";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import { assertCountryInFeatureRealm } from "~/server/shared/realm-link-guard";
import { assertFound, requirePoliticalLayer } from "../../core/shared";

function regionError(error: Error): never {
  if (error instanceof RealmRegionError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

export const geoEditorLinkageAssignmentRouter = createTRPCRouter({
  /**
   * Link a map feature to a Country record (site admins, or the realm's founder and map officers).
   */
  assignCountryGeometry: rateLimitedMutationProcedure
    .input(
      z.object({
        featureId: z.string(),
        countryId: z.string(),
        ...realmScopeInput.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify feature exists (featureId is unique only within a realm)
      const realmId = await editableMapRealmId(ctx, input.realm);
      const mapLayer = await requirePoliticalLayer(ctx.db, input.featureId, realmId);

      // Verify the country exists and belongs to the feature's realm
      const country = await assertCountryInFeatureRealm(ctx.db, input.countryId, realmId);

      // Update map layer with country link
      await ctx.db.mapLayer.update({
        where: { id: mapLayer.id },
        data: { countryId: input.countryId },
      });

      // Update country with geometry + area. The link is stored: the map version moves even if the sync fails.
      try {
        await syncCountryGeometryFromMapLayer(ctx.db, input.countryId);
      } finally {
        await invalidateRealmMap(ctx.db, realmId);
      }
      broadcastMapUpdate("linkage", input.countryId, realmId);

      return {
        featureId: input.featureId,
        countryId: input.countryId,
        countryName: country.name,
      };
    }),

  /**
   * Unlink a map feature from a Country record (site admins, the realm's founder and map officers).
   */
  unlinkCountryGeometry: rateLimitedMutationProcedure
    .input(z.object({ featureId: z.string(), ...realmScopeInput.shape }))
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const mapLayer = await requirePoliticalLayer(ctx.db, input.featureId, realmId);

      const previousCountryId = mapLayer.countryId;

      await ctx.db.mapLayer.update({
        where: { id: mapLayer.id },
        data: { countryId: null },
      });

      // Clear geometry + area from country. The unlink is stored: the map version moves even if the sync fails.
      try {
        if (previousCountryId) {
          await syncCountryGeometryFromMapLayer(ctx.db, previousCountryId);
        }
      } finally {
        await invalidateRealmMap(ctx.db, realmId);
      }
      broadcastMapUpdate("linkage", previousCountryId ?? undefined, realmId);

      return { featureId: input.featureId, previousCountryId };
    }),

  /**
   * All details of a map feature (site admins, the realm's founder and map officers).
   */
  getFeatureDetails: protectedProcedure
    .input(z.object({ featureId: z.string(), ...realmScopeInput.shape }))
    .query(async ({ ctx, input }) => {
      const feature = assertFound(
        await ctx.db.mapLayer.findFirst({
          where: {
            layerType: "political",
            featureId: input.featureId,
            isActive: true,
            realmId: await editableMapRealmId(ctx, input.realm),
          },
          include: {
            country: {
              select: {
                id: true,
                name: true,
                wikiPageTitle: true,
              },
            },
          },
        }),
        `Feature not found: ${input.featureId}`
      );
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
   * Update properties (displayName, countryId, properties, wikiPageTitle) of a map feature. Renaming the
   * linked nation (and its wiki page) is for site admins only: realm map editors rename the region.
   */
  updateFeatureProperties: rateLimitedMutationProcedure
    .input(
      z.object({
        featureId: z.string(),
        displayName: z.string().optional(),
        countryId: z.string().nullable().optional(),
        properties: z.record(z.string(), z.any()).optional(),
        wikiPageTitle: z.string().nullable().optional(),
        ...realmScopeInput.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const renamesNation = !!ctx.user && isSiteAdmin(ctx.user as RealmActor);
      const feature = assertFound(
        await ctx.db.mapLayer.findFirst({
          where: { layerType: "political", featureId: input.featureId, isActive: true, realmId },
        }),
        `Feature not found: ${input.featureId}`
      );
      // A new link (and the rename/wiki/sync writes that follow it) must stay inside the feature's realm
      await assertCountryInFeatureRealm(ctx.db, input.countryId, realmId);

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

      const targetCountryId = input.countryId !== undefined ? input.countryId : feature.countryId;
      const newName = input.displayName !== feature.displayName ? input.displayName : undefined;

      // A generated slot is its country: the nation is renamed first and in the same transaction, so a refused
      // name (taken) leaves the region as it was
      const slotRenamed = await ctx.db
        .$transaction(async (tx) => {
          const followed = await renameGeneratedSlot(tx, realmId, targetCountryId, newName);
          await tx.mapLayer.update({ where: { id: feature.id }, data: updateData });
          return followed;
        })
        .catch(regionError);
      if (slotRenamed) await invalidateCache(["countries."]).catch(() => undefined);

      // The region is stored: the map version moves even if a nation write or sync below fails
      try {
        // Update Country name and slug if displayName is changed and country is linked
        if (renamesNation && targetCountryId && newName !== undefined && !slotRenamed) {
          const slug = newName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
          await ctx.db.country.update({
            where: { id: targetCountryId },
            data: {
              name: newName,
              slug,
            },
          });
        }

        // Update wikiPageTitle on Country if linked
        if (renamesNation && targetCountryId && input.wikiPageTitle !== undefined) {
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
      } finally {
        await invalidateRealmMap(ctx.db, realmId);
      }

      if (input.countryId !== undefined) {
        broadcastMapUpdate("linkage", input.countryId ?? undefined, realmId);
      }

      return { ok: true };
    }),

  /**
   * Create a nation from an unclaimed political shape: site admins, or the realm's founder and map officers in their
   * own realm (audited for site admins).
   */
  createCountryFromShape: rateLimitedMutationProcedure
    .input(z.object({ featureId: z.string(), name: z.string().min(1), ...realmScopeInput.shape }))
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const created = await createNationFromShape(
        ctx.db,
        ctx.user as RealmActor,
        realmId,
        input
      ).catch(regionError);
      // The link is stored: the map version moves even if the sync fails
      try {
        await syncCountryGeometryFromMapLayer(ctx.db, created.countryId);
      } finally {
        await invalidateRealmMap(ctx.db, realmId);
      }
      broadcastMapUpdate("linkage", created.countryId, realmId);
      return created;
    }),
});
