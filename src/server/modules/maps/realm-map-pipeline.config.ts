/**
 * A realm's map pipeline from its admin panel (`/admin/realms` → Map for site admins, `/r/<realm>/manage` → Map for
 * the founder and Map officers): read and save the config (`Realm.settings.map.pipeline`), fill it from a source
 * preset, start a run (dry run or apply, any steps), follow it, list past runs and cancel. Everything goes through
 * `realmMapAccess` (IxWorld stays with site admins; archived realms are read-only), and every change is recorded
 * in `AdminAuditLog`.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  fillPipelineFromPreset,
  MAP_PIPELINE_STEP_LABELS,
  MAP_PIPELINE_STEPS,
  mapPipelineOptionsSchema,
  readRealmMapPipeline,
  stepArt,
  withRealmMapPipeline,
  type MapPipelineOptions,
  type MapPipelineStep,
  type RealmMapPipeline,
} from "~/lib/maps/realm-map-pipeline";
import { parseRealmMapSettings } from "~/lib/maps/realm-map-settings";
import { SOURCE_PRESETS, sourcePreset } from "~/lib/realms/sources/presets";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import { realmMapAccess } from "~/server/modules/realms/realms.map-access";
import { loadSourceSyncConfig } from "~/server/modules/realms/realms.source-sync";
import {
  cancelMapImportJob,
  getMapImportJob,
  kickMapImports,
  type MapImportDeps,
  type MapImportJobView,
} from "./map-import.jobs";
import { MapImportError } from "./map-import.realm";
import { mapUploadSize } from "./map-import.storage";
import type { StepStatus } from "./realm-map-pipeline.context";
import { MAP_PIPELINE_KIND, type PipelineSummary } from "./realm-map-pipeline.job";
import { resolveDisplayNames } from "~/server/shared/display-names";

const runOptions = (options: Prisma.JsonValue) =>
  mapPipelineOptionsSchema.safeParse(options).data ?? null;

export const MAP_PIPELINE_SAVED_ACTION = "REALM_MAP_PIPELINE_SAVED";
export const MAP_PIPELINE_PRESET_ACTION = "REALM_MAP_PIPELINE_PRESET_LOADED";
export const MAP_PIPELINE_RUN_ACTION = "REALM_MAP_PIPELINE_RUN_STARTED";
export const MAP_PIPELINE_CANCEL_ACTION = "REALM_MAP_PIPELINE_RUN_CANCELLED";

type PipelineDb = PrismaClient;

interface EditableRealm {
  id: string;
  slug: string;
  name: string;
  settings: Prisma.JsonValue;
}

async function editableRealm(
  db: PipelineDb,
  actor: RealmActor,
  realmId: string
): Promise<EditableRealm> {
  const access = await realmMapAccess(db, actor, realmId);
  if (!access.canEdit)
    throw new MapImportError("FORBIDDEN", access.reason ?? "You can't edit this map");
  const realm = await db.realm.findUnique({
    where: { id: realmId },
    select: { id: true, slug: true, name: true, settings: true },
  });
  // IxWorld may have no realm row; it keeps no pipeline until it has one.
  if (!realm)
    throw new MapImportError(
      "NOT_FOUND",
      "This realm has no settings row to keep a map pipeline in"
    );
  return realm;
}

function audit(
  db: PipelineDb,
  actor: RealmActor,
  realm: EditableRealm,
  action: string,
  changes: object
) {
  return db.adminAuditLog.create({
    data: {
      action,
      targetType: "realm",
      targetId: realm.id,
      targetName: realm.name,
      changes: JSON.stringify(changes),
      adminId: actor.id,
      adminName: actor.clerkUserId,
    },
  });
}

/** Art keys whose upload is no longer in the map import store, among `keys` (all of the pipeline's when absent). */
async function missingUploads(
  pipeline: RealmMapPipeline,
  keys?: readonly string[]
): Promise<string[]> {
  const missing: string[] = [];
  for (const [key, source] of Object.entries(pipeline.art)) {
    if (keys && !keys.includes(key)) continue;
    if ("uploadId" in source && (await mapUploadSize(source.uploadId)) === null) missing.push(key);
  }
  return missing;
}

/**
 * The panel's view: the realm's pipeline (null when it has none; `problem` when the stored one no longer parses),
 * its source repository (where `repoPath` art is read), the presets that carry a map pipeline, the steps, and what
 * is built now (raster layers, default view).
 */
export async function getMapPipeline(db: PipelineDb, actor: RealmActor, realmId: string) {
  const realm = await editableRealm(db, actor, realmId);
  const { pipeline, problem } = readRealmMapPipeline(realm.settings);
  const sync = await loadSourceSyncConfig(db, realm.id);
  const settings = parseRealmMapSettings(realm.settings);
  return {
    realm: { id: realm.id, slug: realm.slug, name: realm.name },
    pipeline,
    problem,
    source: sync ? { repo: sync.repo, ref: sync.ref } : null,
    presets: SOURCE_PRESETS.filter((p) => p.mapPipeline).map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description ?? null,
    })),
    steps: MAP_PIPELINE_STEPS.map((step) => ({ step, label: MAP_PIPELINE_STEP_LABELS[step] })),
    built: {
      rasterLayers: settings.rasterLayers ?? [],
      defaultView: settings.defaultView ?? null,
      hasClimateKey: !!settings.climateKey,
    },
  };
}

async function store(db: PipelineDb, realm: EditableRealm, pipeline: RealmMapPipeline | null) {
  await db.realm.update({
    where: { id: realm.id },
    data: { settings: withRealmMapPipeline(realm.settings, pipeline) as Prisma.InputJsonValue },
  });
}

/** Save the realm's pipeline (validated by the caller's schema; null removes it). Uploads must still exist. */
export async function saveMapPipeline(
  db: PipelineDb,
  actor: RealmActor,
  realmId: string,
  pipeline: RealmMapPipeline | null
) {
  const realm = await editableRealm(db, actor, realmId);
  const gone = pipeline ? await missingUploads(pipeline) : [];
  if (gone.length > 0) {
    throw new MapImportError(
      "BAD_REQUEST",
      `Upload again: the files of ${gone.join(", ")} are gone`
    );
  }
  const previous = readRealmMapPipeline(realm.settings).pipeline;
  await store(db, realm, pipeline);
  await audit(db, actor, realm, MAP_PIPELINE_SAVED_ACTION, { previous, next: pipeline });
  return { pipeline };
}

/**
 * Fill the realm's pipeline from a preset's: empty fields only (the realm's own art and settings are kept), or
 * every field with `force` (fillPipelineFromPreset).
 */
export async function loadMapPipelinePreset(
  db: PipelineDb,
  actor: RealmActor,
  realmId: string,
  presetId: string,
  { force = false }: { force?: boolean } = {}
) {
  const realm = await editableRealm(db, actor, realmId);
  const preset = sourcePreset(presetId);
  if (!preset?.mapPipeline)
    throw new MapImportError("NOT_FOUND", `No preset "${presetId}" with a map pipeline`);
  const current = readRealmMapPipeline(realm.settings).pipeline;
  const result = fillPipelineFromPreset(current, preset.mapPipeline, { force });
  await store(db, realm, result.pipeline);
  await audit(db, actor, realm, MAP_PIPELINE_PRESET_ACTION, {
    presetId,
    force,
    filled: result.filled,
  });
  return { presetId, ...result };
}

/** Queue a run of the realm's pipeline (dry run or apply) for the map import runner. Returns the job id. */
export async function startMapPipelineRun(
  db: PipelineDb,
  actor: RealmActor,
  realmId: string,
  options: MapPipelineOptions,
  deps: Pick<MapImportDeps, "kick"> = {}
): Promise<{ jobId: string }> {
  const realm = await editableRealm(db, actor, realmId);
  const { pipeline, problem } = readRealmMapPipeline(realm.settings);
  if (!pipeline) {
    throw new MapImportError(
      "BAD_REQUEST",
      problem ?? "Set up the map pipeline first (or load a preset)"
    );
  }
  const gone = await missingUploads(
    pipeline,
    options.steps.flatMap((step) => stepArt(pipeline, step))
  );
  if (gone.length > 0) {
    throw new MapImportError(
      "BAD_REQUEST",
      `Upload again: the files of ${gone.join(", ")} are gone`
    );
  }
  const active = await db.mapImportJob.findFirst({
    where: { realmId, kind: MAP_PIPELINE_KIND, status: { in: ["queued", "running"] } },
    select: { id: true },
  });
  if (active)
    throw new MapImportError(
      "CONFLICT",
      "A map pipeline run of this realm is already queued or running"
    );
  const job = await db.mapImportJob.create({
    data: {
      realmId,
      kind: MAP_PIPELINE_KIND,
      dryRun: options.dryRun,
      options: options as Prisma.InputJsonValue,
      requestedBy: actor.clerkUserId,
      stage: "Waiting to start",
    },
    select: { id: true },
  });
  await audit(db, actor, realm, MAP_PIPELINE_RUN_ACTION, { jobId: job.id, ...options });
  if (deps.kick !== false) kickMapImports(db);
  return { jobId: job.id };
}

interface MapPipelineRunView extends Omit<MapImportJobView, "result"> {
  options: MapPipelineOptions | null;
  result: PipelineSummary | null;
  /** Who started the run, for people: a display name, "the schedule" or "script <name>". */
  requestedByName: string;
}

const isPersonRequester = (requestedBy: string) =>
  requestedBy !== "cron" && !requestedBy.startsWith("script:");

/** Each run's starter by name: one name lookup for every person among them. */
async function requesterNames(db: PipelineDb, requestedBy: readonly string[]) {
  const names = await resolveDisplayNames(db, requestedBy.filter(isPersonRequester));
  return (id: string) => {
    if (id === "cron") return "the schedule";
    if (id.startsWith("script:")) return `script ${id.slice("script:".length)}`;
    return names.get(id) ?? "a map editor";
  };
}

const asPipelineSummary = (result: MapImportJobView["result"]) =>
  result?.phase === "pipeline" ? result : null;

/** One run: status, progress, stage and every step's report (polled by the panel). */
export async function getMapPipelineRun(
  db: PipelineDb,
  actor: RealmActor,
  jobId: string
): Promise<MapPipelineRunView> {
  const view = await getMapImportJob(db, actor, jobId);
  if (view.kind !== MAP_PIPELINE_KIND)
    throw new MapImportError("NOT_FOUND", "Map pipeline run not found");
  await editableRealm(db, actor, view.realmId);
  const job = await db.mapImportJob.findUnique({ where: { id: jobId }, select: { options: true } });
  const nameOf = await requesterNames(db, [view.requestedBy]);
  return {
    ...view,
    options: runOptions(job?.options ?? null),
    result: asPipelineSummary(view.result),
    requestedByName: nameOf(view.requestedBy),
  };
}

/** The realm's last runs, newest first, each step's status and summary (no detail lines). */
export async function listMapPipelineRuns(
  db: PipelineDb,
  actor: RealmActor,
  realmId: string,
  take = 20
) {
  await editableRealm(db, actor, realmId);
  const jobs = await db.mapImportJob.findMany({
    where: { realmId, kind: MAP_PIPELINE_KIND },
    orderBy: { createdAt: "desc" },
    take,
  });
  const nameOf = await requesterNames(
    db,
    jobs.map((j) => j.requestedBy)
  );
  return jobs.map((job) => {
    const summary = (job.result ?? null) as PipelineSummary | null;
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      dryRun: job.dryRun,
      error: job.error,
      requestedBy: job.requestedBy,
      requestedByName: nameOf(job.requestedBy),
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      steps: runOptions(job.options)?.steps ?? [],
      results:
        summary?.steps.map(
          (s): { step: MapPipelineStep; status: StepStatus; summary: string; ms: number } => ({
            step: s.step,
            status: s.status,
            summary: s.summary,
            ms: s.ms,
          })
        ) ?? [],
    };
  });
}

/** Cancel a queued or running run (a running one stops at its next progress report). */
export async function cancelMapPipelineRun(db: PipelineDb, actor: RealmActor, jobId: string) {
  const run = await getMapPipelineRun(db, actor, jobId);
  const realm = await editableRealm(db, actor, run.realmId);
  const result = await cancelMapImportJob(db, actor, jobId);
  await audit(db, actor, realm, MAP_PIPELINE_CANCEL_ACTION, { jobId });
  return result;
}
