/**
 * Background map import jobs (MapImportJob). A job is queued by the wizard (or by another importer through
 * `startMapImport`) and run off the request path:
 *
 *   - analyse (dryRun): read the upload, run the engine (a worker thread under Bun), store the result file and a
 *     summary (regions, report, georeference, suggested mapping);
 *   - apply: plan the analysed result with the admin's mapping and write it (map-import.apply.ts).
 *
 * Who runs them: the `map-import` cron job when it is enabled (CRON_ENABLED_JOBS), else the web process right
 * after queueing, in-process. Apply jobs always start in the web process, so its map caches are dropped at once;
 * the cron job picks them up only if they were left queued. A realm runs one job at a time (the job lease
 * `map-import:<realmId>`); a running job that stops reporting progress for STALE_AFTER_MS is marked failed.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  mapImportApplySchema,
  mapImportOptionsSchema,
  MAX_MAP_IMPORT_BYTES,
  type EngineReport,
  type EngineResult,
  type ImportRegion,
  type MapImportApplyInput,
  type MapImportKind,
  type MapImportOptions,
  type MapImportOptionsInput,
} from "~/lib/maps/import/options";
import { resolveGeoreference, type GeorefResolution } from "~/lib/maps/import/georef";
import { autoMatchNations } from "~/lib/maps/import/nation-names";
import { ImportCancelledError, type ProgressFn } from "~/lib/maps/import/progress";
import type { MapGeoreference } from "~/lib/maps/realm-map-settings";
import { withJobLock } from "~/lib/system/job-lock";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import {
  applyMapImportPlan,
  importGeoreference,
  planMapImport,
  type AppliedImport,
  type MapImportDiff,
} from "./map-import.apply";
import {
  findImportRealm,
  loadImportRealm,
  MapImportError,
  realmNations,
  saveRealmGeoreference,
} from "./map-import.realm";
import { mapUploadSize, readImportResult, readMapUpload, saveImportResult, saveMapUpload } from "./map-import.storage";

export const MAP_IMPORT_LOCK_MS = 30 * 60_000;
export const STALE_AFTER_MS = 10 * 60_000;
export const mapImportLockName = (realmId: string) => `map-import:${realmId}`;
const PROGRESS_INTERVAL_MS = 750;

export interface AnalyseSummary {
  phase: "analyse";
  kind: MapImportKind;
  space: "pixel" | "lonlat";
  width: number;
  height: number;
  regions: ImportRegion[];
  report: EngineReport;
  georef: Pick<GeorefResolution, "method" | "projection" | "extent" | "warnings" | "rmseDegrees"> | null;
  /** Region key → nation: the colour key's or source's names matched to the realm (null = left to the admin). */
  suggestedMapping: Record<string, string | null>;
}

export interface ApplySummary extends AppliedImport {
  phase: "apply";
  nations: number;
}

export type MapImportSummary = AnalyseSummary | ApplySummary;

export interface StartMapImportInput {
  realmId: string;
  source: { kind: MapImportKind; bytes?: Uint8Array; uploadId?: string; filename: string };
  options?: MapImportOptionsInput;
  /** Clerk userId, or "cron" / "script". */
  requestedBy: string;
}

export interface MapImportDeps {
  db?: PrismaClient;
  /** Start the in-process runner after queueing (default true). */
  kick?: boolean;
  /** The engine (tests replace it). */
  runEngine?: (
    kind: MapImportKind,
    bytes: Uint8Array,
    options: MapImportOptions,
    progress: ProgressFn,
    isCancelled: () => boolean
  ) => Promise<EngineResult>;
}

async function defaultDb(): Promise<PrismaClient> {
  return (await import("~/server/db")).db as PrismaClient;
}

/**
 * Queue an analyse job for a realm's map from a file's bytes or an earlier upload. Returns the job id. Server
 * only; the caller has checked who may import (the tRPC router does, with canImportRealmMap).
 */
export async function startMapImport(input: StartMapImportInput, deps: MapImportDeps = {}): Promise<string> {
  const db = deps.db ?? (await defaultDb());
  await findImportRealm(db, input.realmId);
  const options = mapImportOptionsSchema.parse(input.options ?? {});
  let uploadId = input.source.uploadId;
  if (input.source.bytes) {
    if (input.source.bytes.byteLength > MAX_MAP_IMPORT_BYTES) {
      throw new MapImportError("BAD_REQUEST", `Map files are limited to ${MAX_MAP_IMPORT_BYTES / 1024 / 1024} MB`);
    }
    uploadId = await saveMapUpload(input.source.bytes);
  }
  if (!uploadId || (await mapUploadSize(uploadId)) === null) {
    throw new MapImportError("BAD_REQUEST", "The uploaded map file was not found: upload it again");
  }
  const job = await db.mapImportJob.create({
    data: {
      realmId: input.realmId,
      kind: input.source.kind,
      dryRun: true,
      options: options as Prisma.InputJsonValue,
      requestedBy: input.requestedBy,
      uploadId,
      filename: input.source.filename.slice(0, 200),
      stage: "Waiting to start",
    },
    select: { id: true },
  });
  if (deps.kick !== false) kickMapImports(db, deps);
  return job.id;
}

/** Queue an apply job for an analysed import (the wizard's "Apply"). */
export async function startMapImportApply(
  db: PrismaClient,
  actor: RealmActor,
  parentJobId: string,
  applyInput: MapImportApplyInput,
  deps: MapImportDeps = {}
): Promise<string> {
  const parent = await db.mapImportJob.findUnique({ where: { id: parentJobId } });
  if (!parent) throw new MapImportError("NOT_FOUND", "Import not found");
  await loadImportRealm(db, actor, parent.realmId);
  if (!parent.dryRun || parent.status !== "succeeded") {
    throw new MapImportError("BAD_REQUEST", "Only a finished analysis can be applied");
  }
  const apply = mapImportApplySchema.parse(applyInput);
  const job = await db.mapImportJob.create({
    data: {
      realmId: parent.realmId,
      kind: parent.kind,
      dryRun: false,
      options: { apply, georef: (parent.options as MapImportOptions).georef ?? null } as Prisma.InputJsonValue,
      requestedBy: actor.clerkUserId,
      parentJobId: parent.id,
      uploadId: parent.uploadId,
      filename: parent.filename,
      stage: "Waiting to start",
    },
    select: { id: true },
  });
  if (deps.kick !== false) kickMapImports(db, deps);
  return job.id;
}

export interface MapImportJobView {
  id: string;
  realmId: string;
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
  result: MapImportSummary | null;
}

const toView = (job: Prisma.MapImportJobGetPayload<object>): MapImportJobView => ({
  id: job.id,
  realmId: job.realmId,
  kind: job.kind,
  status: job.status,
  progress: job.progress,
  stage: job.stage,
  dryRun: job.dryRun,
  error: job.error,
  filename: job.filename,
  parentJobId: job.parentJobId,
  requestedBy: job.requestedBy,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  result: (job.result as MapImportSummary | null) ?? null,
});

export async function getMapImportJob(db: PrismaClient, actor: RealmActor, jobId: string): Promise<MapImportJobView> {
  const job = await db.mapImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new MapImportError("NOT_FOUND", "Import not found");
  await loadImportRealm(db, actor, job.realmId);
  return toView(job);
}

export async function listMapImportJobs(db: PrismaClient, actor: RealmActor, realmId: string, take = 20) {
  await loadImportRealm(db, actor, realmId);
  const jobs = await db.mapImportJob.findMany({ where: { realmId }, orderBy: { createdAt: "desc" }, take });
  return jobs.map((job) => {
    const { result: _result, ...rest } = toView(job);
    return rest;
  });
}

/** Cancel a queued or running job (a running one stops at its next progress report). */
export async function cancelMapImportJob(db: PrismaClient, actor: RealmActor, jobId: string) {
  const job = await getMapImportJob(db, actor, jobId);
  const { count } = await db.mapImportJob.updateMany({
    where: { id: job.id, status: { in: ["queued", "running"] } },
    data: { status: "cancelled", stage: "Cancelled", finishedAt: new Date() },
  });
  if (count === 0) throw new MapImportError("CONFLICT", "The import has already finished");
  return { cancelled: true };
}

/** The dry-run diff of an analysed import under a mapping (the wizard's review step). Writes nothing. */
export async function previewMapImport(
  db: PrismaClient,
  actor: RealmActor,
  jobId: string,
  applyInput: MapImportApplyInput
): Promise<MapImportDiff> {
  const job = await db.mapImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new MapImportError("NOT_FOUND", "Import not found");
  const realm = await loadImportRealm(db, actor, job.realmId);
  if (!job.dryRun || job.status !== "succeeded") {
    throw new MapImportError("BAD_REQUEST", "The analysis has not finished");
  }
  const options = mapImportOptionsSchema.parse(job.options ?? {});
  const result = await readImportResult(job.id);
  const plan = await planMapImport(
    db,
    realm,
    result,
    mapImportApplySchema.parse(applyInput),
    importGeoreference(realm, options.georef)
  );
  return plan.diff;
}

/** Throttled progress writes that also notice a cancel (the status is no longer "running"). */
function progressWriter(db: PrismaClient, jobId: string) {
  let cancelled = false;
  let lastWrite = 0;
  let lastStage = "";
  let pending: Promise<unknown> = Promise.resolve();
  const write = (percent: number, stage: string) => {
    const now = Date.now();
    if (stage === lastStage && now - lastWrite < PROGRESS_INTERVAL_MS) return;
    lastWrite = now;
    lastStage = stage;
    pending = pending
      .then(() =>
        db.mapImportJob.updateMany({
          where: { id: jobId, status: "running" },
          data: { progress: Math.max(0, Math.min(100, Math.round(percent))), stage, heartbeatAt: new Date() },
        })
      )
      .then(({ count }) => {
        if (count === 0) cancelled = true;
      })
      .catch((error: unknown) => console.warn("[map-import] progress write failed:", error));
  };
  return { write, isCancelled: () => cancelled, flush: () => pending };
}

async function runAnalyse(
  db: PrismaClient,
  job: Prisma.MapImportJobGetPayload<object>,
  progress: ReturnType<typeof progressWriter>,
  deps: MapImportDeps
): Promise<AnalyseSummary> {
  const realm = await findImportRealm(db, job.realmId);
  const options = mapImportOptionsSchema.parse(job.options ?? {});
  if (!job.uploadId) throw new MapImportError("BAD_REQUEST", "The job has no uploaded file");
  progress.write(1, "Reading the upload");
  const bytes = await readMapUpload(job.uploadId);
  const runEngine = deps.runEngine ?? (await import("~/lib/maps/import/run-engine")).runImportEngine;
  const result = await runEngine(job.kind as MapImportKind, bytes, options, progress.write, progress.isCancelled);
  if (progress.isCancelled()) throw new ImportCancelledError();

  const georefInput: MapGeoreference = importGeoreference(realm, options.georef);
  const georef = result.space === "pixel" ? resolveGeoreference(georefInput, result.width, result.height) : null;
  await saveImportResult(job.id, result);

  const { candidates } = await realmNations(db, realm.id);
  const named = result.regions.filter((r) => r.name && !r.water);
  const matched = autoMatchNations(
    named.map((r) => r.name!),
    candidates
  );
  const suggestedMapping: Record<string, string | null> = {};
  for (const region of result.regions) {
    // A colour key's or source's own name is kept even when the realm has no such nation yet.
    suggestedMapping[region.key] = region.water || !region.name ? null : (matched[region.name] ?? region.name);
  }
  return {
    phase: "analyse",
    kind: result.kind,
    space: result.space,
    width: result.width,
    height: result.height,
    regions: result.regions,
    report: result.report,
    georef: georef && {
      method: georef.method,
      projection: georef.projection,
      extent: georef.extent,
      warnings: georef.warnings,
      rmseDegrees: georef.rmseDegrees,
    },
    suggestedMapping,
  };
}

async function runApply(
  db: PrismaClient,
  job: Prisma.MapImportJobGetPayload<object>,
  progress: ReturnType<typeof progressWriter>
): Promise<ApplySummary> {
  if (!job.parentJobId) throw new MapImportError("BAD_REQUEST", "The apply job has no analysis");
  const realm = await findImportRealm(db, job.realmId);
  const stored = (job.options ?? {}) as { apply?: unknown; georef?: MapGeoreference | null };
  const apply = mapImportApplySchema.parse(stored.apply ?? {});
  progress.write(5, "Reading the analysis");
  const result = await readImportResult(job.parentJobId);
  const georef = importGeoreference(realm, stored.georef ?? undefined);
  progress.write(15, "Planning the changes");
  const plan = await planMapImport(db, realm, result, apply, georef);
  if (progress.isCancelled()) throw new ImportCancelledError();
  progress.write(30, `Writing ${plan.features.length} borders`);
  const applied = await applyMapImportPlan(db, realm, plan, { jobId: job.id, requestedBy: job.requestedBy });
  if (apply.saveGeoreference && result.space === "pixel") {
    progress.write(95, "Saving the georeference");
    await saveRealmGeoreference(db, realm, georef);
  }
  return { phase: "apply", nations: plan.features.length, ...applied };
}

/** Mark running jobs that stopped reporting (a restarted process) as failed. Returns how many. */
export async function recoverStaleMapImports(db: PrismaClient, now = new Date()): Promise<number> {
  const { count } = await db.mapImportJob.updateMany({
    where: { status: "running", heartbeatAt: { lt: new Date(now.getTime() - STALE_AFTER_MS) } },
    data: {
      status: "failed",
      error: "The import stopped (the server restarted?). Start it again; an apply can be rolled back if it wrote anything.",
      finishedAt: now,
    },
  });
  return count;
}

/**
 * Run one queued job under its realm's lease. "busy" when another job of the realm holds the lease (the job
 * stays queued), "gone" when it is no longer queued.
 */
export async function runMapImportJob(
  db: PrismaClient,
  jobId: string,
  deps: MapImportDeps = {}
): Promise<"ran" | "busy" | "gone"> {
  const queued = await db.mapImportJob.findUnique({ where: { id: jobId } });
  if (!queued || queued.status !== "queued") return "gone";
  const outcome = await withJobLock(
    db,
    mapImportLockName(queued.realmId),
    async () => {
      const now = new Date();
      const claimed = await db.mapImportJob.updateMany({
        where: { id: jobId, status: "queued" },
        data: { status: "running", startedAt: now, heartbeatAt: now, progress: 0, stage: "Starting" },
      });
      if (claimed.count === 0) return "gone" as const;
      const job = (await db.mapImportJob.findUnique({ where: { id: jobId } }))!;
      const progress = progressWriter(db, jobId);
      try {
        const summary = job.dryRun ? await runAnalyse(db, job, progress, deps) : await runApply(db, job, progress);
        await progress.flush();
        await db.mapImportJob.updateMany({
          where: { id: jobId, status: "running" },
          data: {
            status: "succeeded",
            progress: 100,
            stage: "Done",
            result: summary as unknown as Prisma.InputJsonValue,
            finishedAt: new Date(),
          },
        });
      } catch (error) {
        await progress.flush();
        const cancelled = error instanceof ImportCancelledError;
        await db.mapImportJob.updateMany({
          where: { id: jobId, status: { in: ["running", "cancelled"] } },
          data: {
            status: cancelled ? "cancelled" : "failed",
            stage: cancelled ? "Cancelled" : "Failed",
            error: cancelled ? null : (error instanceof Error ? error.message : String(error)).slice(0, 1000),
            finishedAt: new Date(),
          },
        });
        if (!cancelled) console.error(`[map-import] job ${jobId} failed:`, error);
      }
      return "ran" as const;
    },
    { timeoutMs: MAP_IMPORT_LOCK_MS }
  );
  return outcome.ran ? outcome.result : "busy";
}

/**
 * Run queued jobs, oldest first, one at a time; a realm whose lease is held is skipped for this pass. `applyOnly`
 * runs only apply jobs; `minAgeMs` leaves younger jobs to the process that queued them.
 */
export async function processMapImportQueue(
  db: PrismaClient,
  options: { applyOnly?: boolean; minApplyAgeMs?: number; maxJobs?: number } = {},
  deps: MapImportDeps = {}
): Promise<{ ran: number; busy: number; recovered: number }> {
  const recovered = await recoverStaleMapImports(db);
  const busyRealms = new Set<string>();
  const seen = new Set<string>();
  let ran = 0;
  for (let i = 0; i < (options.maxJobs ?? 50); i++) {
    const applyCutoff = new Date(Date.now() - (options.minApplyAgeMs ?? 0));
    const next = await db.mapImportJob.findFirst({
      where: {
        status: "queued",
        id: { notIn: [...seen] },
        realmId: { notIn: [...busyRealms] },
        ...(options.applyOnly && { dryRun: false }),
        ...(!options.applyOnly &&
          options.minApplyAgeMs && { OR: [{ dryRun: true }, { createdAt: { lt: applyCutoff } }] }),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, realmId: true },
    });
    if (!next) break;
    seen.add(next.id);
    const outcome = await runMapImportJob(db, next.id, deps);
    if (outcome === "busy") busyRealms.add(next.realmId);
    if (outcome === "ran") ran++;
  }
  return { ran, busy: busyRealms.size, recovered };
}

/** The cron job (`map-import`, every minute): analyses, plus apply jobs the web process left queued. */
export async function runQueuedMapImports(db: PrismaClient) {
  return processMapImportQueue(db, { minApplyAgeMs: 2 * 60_000 });
}

/** Whether the cron runner runs map imports (then the web process leaves analyses to it). */
export async function cronRunsMapImports(): Promise<boolean> {
  const [{ resolveEnabledJobs }, { env }] = await Promise.all([import("~/server/cron/jobs"), import("~/env")]);
  return resolveEnabledJobs(env.CRON_ENABLED_JOBS).enabled.some((job) => job.name === "map-import");
}

let kickRunning = false;
let kickAgain = false;
const BUSY_RETRY_MS = 5_000;
const BUSY_RETRIES = 360; // half an hour: a realm's running job holds its lease at most MAP_IMPORT_LOCK_MS

const pause = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });

/**
 * Run the queue in this process soon (not inside the request). Analyses are left to the cron runner when it runs
 * `map-import`; apply jobs always run here. A call while a pass runs schedules one more pass; a job waiting for
 * its realm's lease is retried every few seconds.
 */
export function kickMapImports(db: PrismaClient, deps: MapImportDeps = {}): void {
  if (kickRunning) {
    kickAgain = true;
    return;
  }
  kickRunning = true;
  const timer = setTimeout(async () => {
    try {
      let retries = 0;
      do {
        kickAgain = false;
        const cronAnalyses = await cronRunsMapImports().catch(() => false);
        const { busy } = await processMapImportQueue(db, { applyOnly: cronAnalyses }, deps);
        if (busy > 0 && retries++ < BUSY_RETRIES) {
          await pause(BUSY_RETRY_MS);
          kickAgain = true;
        }
      } while (kickAgain);
    } catch (error) {
      console.error("[map-import] in-process runner failed:", error);
    } finally {
      kickRunning = false;
    }
  }, 0);
  timer.unref?.();
}
