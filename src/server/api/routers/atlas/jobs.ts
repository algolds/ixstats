/** Atlas, Map jobs across realms: list, retry, cancel, roll back (Task 6). Site admins only. */
import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  ATLAS_JOB_KINDS,
  ATLAS_JOB_STATUSES,
  ATLAS_JOBS_PAGE,
  cancelAtlasJob,
  getAtlasJob,
  listAtlasJobs,
  retryAtlasJob,
  rollbackAtlasImport,
} from "~/server/modules/maps/atlas-jobs";
import { atlasError } from "./errors";

const id = z.string().trim().min(1).max(64);

export const atlasJobsRouter = createTRPCRouter({
  /** A page of jobs, newest first, without results; `realm` is an id or slug. */
  list: adminProcedure
    .input(
      z.object({
        realm: id.optional(),
        kind: z.enum(ATLAS_JOB_KINDS).optional(),
        status: z.enum(ATLAS_JOB_STATUSES).optional(),
        cursor: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(100).default(ATLAS_JOBS_PAGE),
      })
    )
    .query(({ ctx, input }) => listAtlasJobs(ctx.db, input).catch(atlasError)),

  /** One job with its result and options (the detail sheet). */
  get: adminProcedure
    .input(z.object({ jobId: id }))
    .query(({ ctx, input }) => getAtlasJob(ctx.db, input.jobId).catch(atlasError)),

  /** Start a failed job again as a new job; answers the new job's id. */
  retry: adminProcedure
    .input(z.object({ jobId: id }))
    .mutation(({ ctx, input }) => retryAtlasJob(ctx.db, ctx.user, input.jobId).catch(atlasError)),

  cancel: adminProcedure
    .input(z.object({ jobId: id }))
    .mutation(({ ctx, input }) => cancelAtlasJob(ctx.db, ctx.user, input.jobId).catch(atlasError)),

  /** Undo an applied import (the row's `importId`). */
  rollback: adminProcedure
    .input(z.object({ importId: id }))
    .mutation(({ ctx, input }) =>
      rollbackAtlasImport(ctx.db, ctx.user, input.importId).catch(atlasError)
    ),
});
