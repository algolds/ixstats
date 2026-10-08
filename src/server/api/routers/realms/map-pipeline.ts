/**
 * realms.mapPipeline: a realm's map pipeline for its admin panel (Map): the config (`Realm.settings.map.pipeline`),
 * filling it from a source preset, runs (dry run or apply, any steps) as background jobs, their progress and
 * history, and cancel. The realm's map editors only (realmMapAccess: site admins, the founder, officers with the
 * Map power; IxWorld stays with site admins). Logic lives in ~/server/modules/maps/realm-map-pipeline.*.ts; the
 * runbook is docs/systems/realm-maps.md.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { mutationRealmId } from "~/server/api/trpc/realm-scope";
import { mapPipelineOptionsSchema, realmMapPipelineSchema } from "~/lib/maps/realm-map-pipeline";
import { MapImportError } from "~/server/modules/maps/map-import.realm";
import {
  cancelMapPipelineRun,
  getMapPipeline,
  getMapPipelineRun,
  listMapPipelineRuns,
  loadMapPipelinePreset,
  saveMapPipeline,
  startMapPipelineRun,
} from "~/server/modules/maps/realm-map-pipeline.config";

function pipelineError(error: Error): never {
  if (error instanceof MapImportError) {
    throw new TRPCError({ code: error.code, message: error.message });
  }
  throw error;
}

/** The realm, by slug, resolved strictly (an unknown slug is NOT_FOUND, never IxWorld). */
const realmInput = z.object({ realm: z.string().min(1).max(100) });
const jobInput = z.object({ jobId: z.string().min(1).max(64) });

export const realmMapPipelineRouter = createTRPCRouter({
  /** The config (or null, or the reason a stored one no longer parses), source repository, presets, steps, built state. */
  get: protectedProcedure.input(realmInput).query(async ({ ctx, input }) => {
    const realmId = await mutationRealmId(ctx, input.realm);
    return getMapPipeline(ctx.db, ctx.user, realmId).catch(pipelineError);
  }),

  /** Replace the config (validated; every art a step names must exist; null removes it). Audited. */
  save: rateLimitedMutationProcedure
    .input(realmInput.extend({ pipeline: realmMapPipelineSchema.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const realmId = await mutationRealmId(ctx, input.realm);
      return saveMapPipeline(ctx.db, ctx.user, realmId, input.pipeline).catch(pipelineError);
    }),

  /** Fill the config from a source preset's map pipeline: empty fields only, or everything with `force`. Audited. */
  loadPreset: rateLimitedMutationProcedure
    .input(
      realmInput.extend({ presetId: z.string().min(1).max(60), force: z.boolean().default(false) })
    )
    .mutation(async ({ ctx, input }) => {
      const realmId = await mutationRealmId(ctx, input.realm);
      return loadMapPipelinePreset(ctx.db, ctx.user, realmId, input.presetId, {
        force: input.force,
      }).catch(pipelineError);
    }),

  /** Queue a run: the steps to take (run in pipeline order) and whether it only reports (dry run). Audited. */
  start: rateLimitedMutationProcedure
    .input(realmInput.extend(mapPipelineOptionsSchema.shape))
    .mutation(async ({ ctx, input }) => {
      const realmId = await mutationRealmId(ctx, input.realm);
      return startMapPipelineRun(ctx.db, ctx.user, realmId, {
        steps: input.steps,
        dryRun: input.dryRun,
      }).catch(pipelineError);
    }),

  /** One run: status, progress, stage and each step's report (poll while it runs). */
  run: protectedProcedure
    .input(jobInput)
    .query(({ ctx, input }) =>
      getMapPipelineRun(ctx.db, ctx.user, input.jobId).catch(pipelineError)
    ),

  /** The realm's last runs, newest first, with each step's status and summary. */
  runs: protectedProcedure
    .input(realmInput.extend({ take: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const realmId = await mutationRealmId(ctx, input.realm);
      return listMapPipelineRuns(ctx.db, ctx.user, realmId, input.take).catch(pipelineError);
    }),

  /** Cancel a queued or running run. Audited. */
  cancel: rateLimitedMutationProcedure
    .input(jobInput)
    .mutation(({ ctx, input }) =>
      cancelMapPipelineRun(ctx.db, ctx.user, input.jobId).catch(pipelineError)
    ),
});
