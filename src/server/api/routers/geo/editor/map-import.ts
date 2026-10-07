/**
 * geoEditor.mapImport: background realm map imports (PNG, SVG, GeoJSON) for the Pipeline wizard. The file arrives
 * through the upload route (/api/admin/map-import/upload), never as base64 here; jobs run off the request path and
 * the wizard polls `job`. Site admins and the realm's founder (canImportRealmMap). Logic lives in
 * ~/server/modules/maps/map-import.*.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import {
  MAP_IMPORT_KINDS,
  mapImportApplySchema,
  mapImportOptionsSchema,
} from "~/lib/maps/import/options";
import { mapGeoreferenceSchema } from "~/lib/maps/realm-map-settings";
import { resolveGeoreference, GeorefError } from "~/lib/maps/import/georef";
import { listMapImports, rollbackMapImport } from "~/server/modules/maps/map-import.history";
import {
  cancelMapImportJob,
  getMapImportJob,
  listMapImportJobs,
  previewMapImport,
  startMapImport,
  startMapImportApply,
} from "~/server/modules/maps/map-import.jobs";
import {
  loadImportRealm,
  MapImportError,
  realmMapSettings,
  realmNations,
  saveRealmGeoreference,
} from "~/server/modules/maps/map-import.realm";
import { isUploadId } from "~/server/modules/maps/map-import.storage";
import { startWikiMapImport } from "~/server/modules/maps/map-import.wiki";

function importError(error: unknown): never {
  if (error instanceof MapImportError) throw new TRPCError({ code: error.code, message: error.message });
  if (error instanceof GeorefError || error instanceof z.ZodError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

const id = z.string().min(1).max(64);
const uploadId = z.string().refine(isUploadId, "Not an upload id");

export const geoEditorMapImportRouter = createTRPCRouter({
  mapImport: createTRPCRouter({
    /** The realm's nations (to match regions to), map settings, recent jobs and applied imports. */
    context: protectedProcedure.input(z.object({ realmId: id })).query(async ({ ctx, input }) => {
      const realm = await loadImportRealm(ctx.db, ctx.user, input.realmId).catch(importError);
      const [{ candidates }, jobs, imports] = await Promise.all([
        realmNations(ctx.db, realm.id),
        listMapImportJobs(ctx.db, ctx.user, realm.id),
        listMapImports(ctx.db, ctx.user, realm.id),
      ]);
      return { realm: { id: realm.id, slug: realm.slug, name: realm.name }, mapSettings: realmMapSettings(realm), nations: candidates, jobs, imports };
    }),

    /** Queue an analysis of an uploaded file. */
    start: rateLimitedMutationProcedure
      .input(
        z.object({
          realmId: id,
          uploadId,
          kind: z.enum(MAP_IMPORT_KINDS),
          filename: z.string().min(1).max(200),
          options: mapImportOptionsSchema.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await loadImportRealm(ctx.db, ctx.user, input.realmId).catch(importError);
        const jobId = await startMapImport(
          {
            realmId: input.realmId,
            source: { kind: input.kind, uploadId: input.uploadId, filename: input.filename },
            options: input.options,
            requestedBy: ctx.user.clerkUserId,
          },
          { db: ctx.db }
        ).catch(importError);
        return { jobId };
      }),

    /**
     * "Import this map": fetch the original of the map chosen from the realm's wiki and queue its analysis with
     * the realm's credit line and georeference.
     */
    startFromWiki: rateLimitedMutationProcedure
      .input(z.object({ realmId: id }))
      .mutation(({ ctx, input }) =>
        startWikiMapImport(ctx.db, ctx.user, input.realmId).catch(importError)
      ),

    /** One job's status, progress and summary (polled by the wizard). */
    job: protectedProcedure
      .input(z.object({ jobId: id }))
      .query(({ ctx, input }) => getMapImportJob(ctx.db, ctx.user, input.jobId).catch(importError)),

    cancel: rateLimitedMutationProcedure
      .input(z.object({ jobId: id }))
      .mutation(({ ctx, input }) => cancelMapImportJob(ctx.db, ctx.user, input.jobId).catch(importError)),

    /** The dry-run diff of an analysed import under a mapping: nothing is written. */
    preview: protectedProcedure
      .input(z.object({ jobId: id, apply: mapImportApplySchema }))
      .query(({ ctx, input }) =>
        previewMapImport(ctx.db, ctx.user, input.jobId, input.apply).catch(importError)
      ),

    /** Queue the write of an analysed import (merge or replace) with a rollback snapshot. */
    applyImport: rateLimitedMutationProcedure
      .input(z.object({ jobId: id, apply: mapImportApplySchema }))
      .mutation(async ({ ctx, input }) => ({
        jobId: await startMapImportApply(ctx.db, ctx.user, input.jobId, input.apply, { db: ctx.db }).catch(importError),
      })),

    /** The lon/lat box an image of this size covers under a georeference (the wizard's preview). */
    previewGeoreference: protectedProcedure
      .input(z.object({ width: z.number().positive(), height: z.number().positive(), georef: mapGeoreferenceSchema }))
      .query(({ input }) => {
        try {
          const { method, projection, extent, warnings, rmseDegrees } = resolveGeoreference(input.georef, input.width, input.height);
          return { method, projection, extent, warnings, rmseDegrees: rmseDegrees ?? null };
        } catch (error) {
          return importError(error);
        }
      }),

    /** Save a georeference as the realm's (Realm.settings.map). */
    saveGeoreference: rateLimitedMutationProcedure
      .input(z.object({ realmId: id, georef: mapGeoreferenceSchema }))
      .mutation(async ({ ctx, input }) => {
        const realm = await loadImportRealm(ctx.db, ctx.user, input.realmId).catch(importError);
        await saveRealmGeoreference(ctx.db, realm, input.georef);
        return { saved: true };
      }),

    /** Undo the realm's latest applied import from its snapshot. */
    rollback: rateLimitedMutationProcedure
      .input(z.object({ importId: id }))
      .mutation(({ ctx, input }) => rollbackMapImport(ctx.db, ctx.user, input.importId).catch(importError)),
  }),
});
