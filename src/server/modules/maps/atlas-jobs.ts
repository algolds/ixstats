/**
 * Atlas jobs: every map job (MapImportJob) across realms for the Jobs tab, with what each row can do (cancel, retry,
 * roll back) worked out here so the UI never guesses. Lists read without `result` and page by (createdAt, id).
 * Cancel and roll back pass through the import services; retry starts a new job with the old one's inputs. There are
 * five kinds: png, svg, geojson, world and map-pipeline (a relief build is a pipeline step, not a job of its own).
 * Server only.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { stat } from "node:fs/promises";
import path from "node:path";
import { mapImportApplySchema, type MapImportOptionsInput } from "~/lib/maps/import/options";
import { mapPipelineOptionsSchema } from "~/lib/maps/realm-map-pipeline";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import {
  cancelMapImportJob,
  startMapImport,
  startMapImportApply,
  type MapImportDeps,
} from "./map-import.jobs";
import { atlasRealmId } from "./atlas-overview";
import { rollbackMapImport } from "./map-import.history";
import { loadImportRealm, MapImportError } from "./map-import.realm";
import { mapImportDir, mapUploadSize } from "./map-import.storage";
import { startMapPipelineRun, cancelMapPipelineRun } from "./realm-map-pipeline.config";
import { MAP_PIPELINE_KIND } from "./realm-map-pipeline.job";
import { fittedMapVersionOf } from "./world-import.check";
import { assertWorldImportAllowed } from "./world-import.guards";

export const ATLAS_JOB_KINDS = ["png", "svg", "geojson", "world", MAP_PIPELINE_KIND] as const;
export const ATLAS_JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export const ATLAS_JOBS_PAGE = 25;

/** What a retry starts: another analysis, the same apply, a new world check, or the pipeline run again. */
export type RetryAs = "analysis" | "apply" | "world-check" | "pipeline";

export interface AtlasJobRow {
  id: string;
  realm: { id: string; slug: string; name: string } | null;
  kind: string;
  status: string;
  progress: number;
  stage: string | null;
  dryRun: boolean;
  error: string | null;
  filename: string | null;
  parentJobId: string | null;
  requestedBy: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  canCancel: boolean;
  canRetry: boolean;
  /** What retrying would start */
  retryAs: RetryAs;
  /** Why a failed job cannot be retried (the upload or analysis is gone), else null */
  retryBlocked: string | null;
  /** The import this apply job wrote, and whether it is still the realm's latest in place */
  importId: string | null;
  canRollBack: boolean;
}

export interface AtlasJobFilters {
  /** Realm id or slug */
  realm?: string;
  kind?: (typeof ATLAS_JOB_KINDS)[number];
  status?: (typeof ATLAS_JOB_STATUSES)[number];
  cursor?: string;
  limit?: number;
}

const JOB_SELECT = {
  id: true,
  realmId: true,
  kind: true,
  status: true,
  progress: true,
  stage: true,
  dryRun: true,
  error: true,
  filename: true,
  parentJobId: true,
  requestedBy: true,
  uploadId: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
} as const;

type JobRecord = Prisma.MapImportJobGetPayload<{ select: typeof JOB_SELECT }>;

const encodeCursor = (job: { createdAt: Date; id: string }) =>
  `${job.createdAt.toISOString()}|${job.id}`;

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [at, id] = cursor.split("|");
  const createdAt = new Date(at ?? "");
  if (!id || Number.isNaN(createdAt.getTime())) {
    throw new MapImportError("BAD_REQUEST", "That page of jobs is not valid");
  }
  return { createdAt, id };
}

export function retryAs(job: Pick<JobRecord, "kind" | "dryRun">): RetryAs {
  if (job.kind === MAP_PIPELINE_KIND) return "pipeline";
  if (job.kind === "world") return "world-check";
  return job.dryRun ? "analysis" : "apply";
}

/** A world apply is only called off while it is queued (cancelMapImportJob). */
const canCancelJob = (job: Pick<JobRecord, "kind" | "dryRun" | "status">) =>
  job.status === "queued" || (job.status === "running" && !(job.kind === "world" && !job.dryRun));

const resultExists = (jobId: string) =>
  stat(path.join(mapImportDir(), "results", `${jobId}.json`)).then(
    () => true,
    () => false
  );

/**
 * Why a failed job cannot be started again, or null when it can. A retry reads the same upload (an analysis, a world
 * check and a world apply, which starts a new check), or the analysis result (an apply); a pipeline run reads its
 * own stored settings and checks its art when it starts.
 */
async function retryBlocker(
  job: Pick<JobRecord, "id" | "kind" | "dryRun" | "status" | "uploadId" | "parentJobId">
): Promise<string | null> {
  if (job.status !== "failed") return "Only a failed job can be started again";
  const as = retryAs(job);
  if (as === "pipeline") return null;
  if (as === "apply") {
    if (!job.parentJobId || !(await resultExists(job.parentJobId))) {
      return "The analysis this import was applied from is gone: analyse the file again";
    }
    return null;
  }
  if (!job.uploadId || (await mapUploadSize(job.uploadId)) === null) {
    return "The uploaded map file is gone: upload it again";
  }
  return null;
}

/** The imports of these jobs, and which of them is its realm's latest still in place (two queries, whatever the page). */
async function rollbackStates(db: PrismaClient, jobIds: string[]) {
  const imports = await db.mapImport.findMany({
    where: { jobId: { in: jobIds } },
    select: {
      id: true,
      jobId: true,
      realmId: true,
      createdAt: true,
      rolledBackAt: true,
      rollbackAvailable: true,
    },
  });
  const newest = new Map<string, Date | null>();
  if (imports.length > 0) {
    const latest = await db.mapImport.groupBy({
      by: ["realmId"],
      where: { realmId: { in: [...new Set(imports.map((i) => i.realmId))] }, rolledBackAt: null },
      _max: { createdAt: true },
    });
    for (const row of latest) newest.set(row.realmId, row._max.createdAt);
  }
  return new Map(
    imports.map((record) => [
      record.jobId,
      {
        importId: record.id,
        canRollBack:
          !record.rolledBackAt &&
          record.rollbackAvailable &&
          newest.get(record.realmId)?.getTime() === record.createdAt.getTime(),
      },
    ])
  );
}

async function toRows(db: PrismaClient, jobs: JobRecord[]): Promise<AtlasJobRow[]> {
  if (jobs.length === 0) return [];
  const [realms, rollback, blockers] = await Promise.all([
    db.realm.findMany({
      where: { id: { in: [...new Set(jobs.map((job) => job.realmId))] } },
      select: { id: true, slug: true, name: true },
    }),
    rollbackStates(
      db,
      jobs.map((job) => job.id)
    ),
    Promise.all(jobs.map((job) => (job.status === "failed" ? retryBlocker(job) : null))),
  ]);
  const realmById = new Map(realms.map((realm) => [realm.id, realm]));
  return jobs.map((job, index) => {
    const state = rollback.get(job.id);
    const { uploadId: _upload, realmId, ...rest } = job;
    return {
      ...rest,
      realm: realmById.get(realmId) ?? null,
      canCancel: canCancelJob(job),
      canRetry: job.status === "failed" && blockers[index] === null,
      retryAs: retryAs(job),
      retryBlocked: job.status === "failed" ? (blockers[index] ?? null) : null,
      importId: state?.importId ?? null,
      canRollBack: state?.canRollBack ?? false,
    };
  });
}

/** The realm's latest applied import still in place, with whether it can be rolled back (null when it has none). */
export async function latestAtlasImport(db: PrismaClient, realmId: string) {
  const record = await db.mapImport.findFirst({
    where: { realmId, rolledBackAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      jobId: true,
      layerTypes: true,
      mode: true,
      createdBy: true,
      summary: true,
      rollbackAvailable: true,
      createdAt: true,
    },
  });
  if (!record) return null;
  const { rollbackAvailable, ...rest } = record;
  return { ...rest, canRollBack: rollbackAvailable };
}

/** A page of jobs across realms, newest first, without their results. */
export async function listAtlasJobs(
  db: PrismaClient,
  filters: AtlasJobFilters = {}
): Promise<{ jobs: AtlasJobRow[]; nextCursor: string | null }> {
  const limit = filters.limit ?? ATLAS_JOBS_PAGE;
  const realmId = filters.realm ? await atlasRealmId(db, filters.realm) : undefined;
  if (realmId === null) return { jobs: [], nextCursor: null };
  const after = filters.cursor ? decodeCursor(filters.cursor) : null;
  const rows = await db.mapImportJob.findMany({
    where: {
      ...(realmId && { realmId }),
      ...(filters.kind && { kind: filters.kind }),
      ...(filters.status && { status: filters.status }),
      ...(after && {
        OR: [
          { createdAt: { lt: after.createdAt } },
          { createdAt: after.createdAt, id: { lt: after.id } },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: JOB_SELECT,
  });
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    jobs: await toRows(db, page),
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
}

const RETRY_NOTES: Record<RetryAs, string> = {
  analysis: "Analyses the same upload again with the same settings.",
  apply: "Applies the same mapping again from the analysis.",
  "world-check":
    "Starts a new check of the same world from its upload. Review the check, then apply it.",
  pipeline: "Runs the same steps again.",
};

const FITTED_NOTE =
  " The world was fitted to the realm's map, so the check fails if the map has changed since.";

/** One job with its result, options and what a retry would do. */
export async function getAtlasJob(db: PrismaClient, jobId: string) {
  const job = await db.mapImportJob.findUnique({
    where: { id: jobId },
    select: { ...JOB_SELECT, result: true, options: true },
  });
  if (!job) throw new MapImportError("NOT_FOUND", "Job not found");
  const { result, options, ...record } = job;
  const [row] = await toRows(db, [record]);
  const fitted = await fittedVersionOf(db, job);
  return {
    ...row!,
    result,
    options,
    fittedMapVersion: fitted,
    retryNote: RETRY_NOTES[retryAs(job)] + (fitted === null ? "" : FITTED_NOTE),
  };
}

/** The map version a world job (or the check it was applied from) was fitted to. */
async function fittedVersionOf(
  db: PrismaClient,
  job: { kind: string; dryRun: boolean; parentJobId: string | null; options: Prisma.JsonValue }
): Promise<number | null> {
  if (job.kind !== "world") return null;
  if (job.dryRun || !job.parentJobId) return fittedMapVersionOf(job.options);
  const parent = await db.mapImportJob.findUnique({
    where: { id: job.parentJobId },
    select: { options: true },
  });
  return fittedMapVersionOf(parent?.options);
}

/** Cancel a queued or running job (a pipeline run through its own cancel, which audits it). */
export async function cancelAtlasJob(
  db: PrismaClient,
  actor: RealmActor,
  jobId: string
): Promise<{ cancelled: boolean }> {
  const job = await db.mapImportJob.findUnique({ where: { id: jobId }, select: { kind: true } });
  if (!job) throw new MapImportError("NOT_FOUND", "Job not found");
  return job.kind === MAP_PIPELINE_KIND
    ? cancelMapPipelineRun(db, actor, jobId)
    : cancelMapImportJob(db, actor, jobId);
}

/** Roll back an applied import (only the realm's latest one in place; the service checks). */
export const rollbackAtlasImport = (db: PrismaClient, actor: RealmActor, importId: string) =>
  rollbackMapImport(db, actor, importId);

/**
 * Start a failed job again as a new job with the same inputs, by kind: an analysis from the same upload and settings,
 * an apply of png, svg or geojson from its analysis, a failed world apply as a new world CHECK (never an apply: the
 * admin reviews it first), a pipeline run with its stored options. Refused when the upload or analysis is gone. The
 * new job's requester is the acting admin.
 */
export async function retryAtlasJob(
  db: PrismaClient,
  actor: RealmActor,
  jobId: string,
  deps: MapImportDeps = {}
): Promise<{ jobId: string; retryAs: RetryAs; note: string }> {
  const job = await db.mapImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new MapImportError("NOT_FOUND", "Job not found");
  const blocked = await retryBlocker(job);
  if (blocked) throw new MapImportError("BAD_REQUEST", blocked);
  const as = retryAs(job);
  // Who may import into the realm, and not into an archived one; a world also has its own guard below
  if (job.kind !== "world") await loadImportRealm(db, actor, job.realmId);
  const started = { db, ...deps };
  if (as === "pipeline") {
    const { jobId: newId } = await startMapPipelineRun(
      db,
      actor,
      job.realmId,
      mapPipelineOptionsSchema.parse(job.options),
      deps
    );
    return { jobId: newId, retryAs: as, note: RETRY_NOTES[as] };
  }
  if (as === "apply") {
    const { apply } = z.object({ apply: mapImportApplySchema }).parse(job.options);
    const newId = await startMapImportApply(db, actor, job.parentJobId!, apply, started);
    return { jobId: newId, retryAs: as, note: RETRY_NOTES[as] };
  }
  // A world apply keeps its settings (the layers to write) in the check it was queued from
  const source =
    job.kind === "world" && !job.dryRun && job.parentJobId
      ? await db.mapImportJob.findUnique({ where: { id: job.parentJobId } })
      : job;
  if (!source)
    throw new MapImportError("BAD_REQUEST", "The check this world was applied from is gone");
  if (job.kind === "world") await assertWorldImportAllowed(db, actor, job.realmId);
  const fitted = fittedMapVersionOf(source.options);
  const newId = await startMapImport(
    {
      realmId: job.realmId,
      source: {
        kind: job.kind as "png" | "svg" | "geojson" | "world",
        uploadId: job.uploadId!,
        filename: job.filename ?? "map",
      },
      options: source.options as MapImportOptionsInput,
      fittedMapVersion: fitted ?? undefined,
      requestedBy: actor.clerkUserId,
    },
    started
  );
  return {
    jobId: newId,
    retryAs: as,
    note: RETRY_NOTES[as] + (fitted === null ? "" : FITTED_NOTE),
  };
}
