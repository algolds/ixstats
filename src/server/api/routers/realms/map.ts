/**
 * realms.map: what a realm's map viewer shows beyond its layers (planet radius, default view, base image, credit
 * line, unclaimed nations, whether the viewer edits it), the realm's map settings, "Recompute areas", and the World
 * tab's server side (the lock, the slot tools). Logic lives in ~/server/modules/realms/realms.map.ts and
 * realms.world-slots.ts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { mutationRealmId, realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { worldReliefFailed } from "~/server/modules/maps/world-import.relief-state";
import { RealmRegionError } from "~/server/modules/realms/realms.region";
import {
  deleteWorldSlot,
  getRealmWorldStatus,
  getWorldSlot,
  requireWorldEditor,
  setSlotClaimable,
} from "~/server/modules/realms/realms.world-slots";
import {
  getRealmMapDisplay,
  realmForWikiArticle,
  recomputeRealmMapAreas,
  updateRealmMapSettings,
} from "~/server/modules/realms/realms.map";
import { RealmMapSettingsSchema } from "~/lib/maps/realm-map-settings";
import { listPublishedWorldPresets } from "~/server/modules/maps/world-presets";
import { getRealmMapVersion, invalidateRealmMap } from "~/server/shared/map-invalidation";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";

function mapError(error: Error): never {
  if (error instanceof RealmRegionError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

/** A mutation names its realm by slug, resolved strictly (an unknown slug is NOT_FOUND, never Ixnay). */
const realmInput = z.object({ realm: z.string().min(1).max(100) });

const settingsShape = RealmMapSettingsSchema.shape;

export const realmMapRouter = createTRPCRouter({
  /** The viewer's realm (`?realm=`, else their active nation's, else Ixnay) and how its map is shown. */
  display: publicProcedure.input(realmScopeInput.optional()).query(async ({ ctx, input }) => {
    const realmId = await viewerRealmId(ctx, input?.realm);
    return getRealmMapDisplay(ctx.db, ctx.user ?? null, realmId);
  }),

  /**
   * The realm's map version, from which the client builds the versioned layer and tile URLs (a change to the map is
   * a new URL). Resolved like `display`: `?realm=`, else the viewer's realm, else Ixnay; a draft realm resolves to
   * Ixnay for everyone but its staff.
   */
  version: publicProcedure.input(realmScopeInput.optional()).query(async ({ ctx, input }) => {
    const realmId = await viewerRealmId(ctx, input?.realm);
    return { realmId, version: await getRealmMapVersion(ctx.db, realmId) };
  }),

  /**
   * The realm whose map a non-IxWiki article's coordinates embed shows: the realm whose lore index holds the
   * article, else the only realm whose lore comes from that wiki; null leaves the embed on the viewer's realm.
   */
  realmForWikiArticle: publicProcedure
    .input(z.object({ wikiSource: z.string().min(1).max(40), title: z.string().max(300) }))
    .query(({ ctx, input }) => realmForWikiArticle(ctx.db, input.wikiSource, input.title)),

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
      const realmId = await mutationRealmId(ctx, input.realm);
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
      const realmId = await mutationRealmId(ctx, input.realm);
      const result = await recomputeRealmMapAreas(ctx.db, ctx.user, realmId, {
        alsoSetLandArea: input.alsoSetLandArea,
      }).catch(mapError);
      await invalidateRealmMap(ctx.db, realmId);
      broadcastMapUpdate("borders", undefined, realmId);
      return result;
    }),
  /**
   * Whether the realm's world can be regenerated or applied: its status and the pending and approved claims that
   * lock it, and whether the relief step of its latest world import failed (the tab then offers to rebuild it). The
   * realm's map editors only; never Ixnay.
   */
  worldStatus: protectedProcedure.input(realmInput).query(async ({ ctx, input }) => {
    const realmId = await mutationRealmId(ctx, input.realm);
    const status = await getRealmWorldStatus(ctx.db, ctx.user, realmId).catch(mapError);
    return { ...status, reliefFailed: await worldReliefFailed(ctx.db, realmId) };
  }),

  /**
   * The presets the World tab offers: published and unarchived, in the admin's order, each by slug and name with its
   * published recipe (no seed). Drafts never leave the admin's `atlas.presets` procedures. The realm's map editors
   * only, like the rest of the World tab (`worldStatus`).
   */
  worldPresets: protectedProcedure.input(realmInput).query(async ({ ctx, input }) => {
    const realmId = await mutationRealmId(ctx, input.realm);
    await requireWorldEditor(ctx.db, ctx.user, realmId).catch(mapError);
    return listPublishedWorldPresets(ctx.db);
  }),

  /** A country as a generated nation slot, for the Properties inspector's slot tools. */
  worldSlot: protectedProcedure
    .input(realmInput.extend({ countryId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const realmId = await mutationRealmId(ctx, input.realm);
      return getWorldSlot(ctx.db, ctx.user, realmId, input.countryId).catch(mapError);
    }),

  /** Whether players may claim a generated nation slot (`Country.claimable`). */
  setSlotClaimable: rateLimitedMutationProcedure
    .input(realmInput.extend({ countryId: z.string().min(1), claimable: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const realmId = await mutationRealmId(ctx, input.realm);
      return setSlotClaimable(ctx.db, ctx.user, realmId, input.countryId, input.claimable).catch(
        mapError
      );
    }),

  /** Delete a generated nation slot nobody holds or has claimed; its map features stay, unlinked. */
  deleteSlot: rateLimitedMutationProcedure
    .input(realmInput.extend({ countryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const realmId = await mutationRealmId(ctx, input.realm);
      await deleteWorldSlot(ctx.db, ctx.user, realmId, input.countryId).catch(mapError);
      await invalidateRealmMap(ctx.db, realmId);
      return { deleted: true };
    }),
});
