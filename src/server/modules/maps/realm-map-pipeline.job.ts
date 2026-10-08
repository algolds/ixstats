/**
 * A realm map pipeline run: a MapImportJob of kind `map-pipeline` (options `{ steps, dryRun }`), queued from the
 * realm's admin panel or run in process by `scripts/realms/build-realm-map.ts`. It runs in the map import queue
 * (map-import.jobs.ts): one job of a realm at a time under the lease `map-import:<realmId>`, stale runs recovered,
 * progress and stage written as it goes, cancel honoured between and inside steps. Heavy work stays off the web
 * request path: the `map-import` cron runner takes pipeline runs (applied ones included) when it is enabled, and
 * the physical layer engine runs in a worker thread under Bun.
 *
 * Steps run in pipeline order (repair, physical, rasters, labels, flags, defaultView, areas), each with a slice of
 * the progress bar; a failing step is recorded and the run goes on with the next one (the run is then `failed`, with
 * every step's report kept). The result holds each step's report and the SHA-256 of every art file read.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { ImportCancelledError } from "~/lib/maps/import/progress";
import {
  MAP_PIPELINE_STEP_LABELS,
  mapPipelineOptionsSchema,
  orderedSteps,
  readRealmMapPipeline,
  type MapPipelineStep,
} from "~/lib/maps/realm-map-pipeline";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import { loadSourceSyncConfig } from "~/server/modules/realms/realms.source-sync";
import { artResolver, type ArtResolver } from "./realm-map-pipeline.art";
import type {
  PipelineDeps,
  StepContext,
  StepReport,
  StepResult,
} from "./realm-map-pipeline.context";
import { runPhysicalStep } from "./realm-map-pipeline.physical";
import { runRastersStep } from "./realm-map-pipeline.rasters";
import { runRepairStep } from "./realm-map-pipeline.repair";
import {
  runAreasStep,
  runDefaultViewStep,
  runFlagsStep,
  runLabelsStep,
} from "./realm-map-pipeline.steps";

export const MAP_PIPELINE_KIND = "map-pipeline";

export interface PipelineSummary {
  phase: "pipeline";
  dryRun: boolean;
  steps: StepResult[];
  /** Art key → SHA-256 of what the run read. */
  art: Record<string, string>;
}

/** Writes are made as site staff: who may start a run was checked (realmMapAccess) when it was queued. */
const PIPELINE_ACTOR: RealmActor = {
  id: "system:map-pipeline",
  clerkUserId: "system:map-pipeline",
  role: { name: "system", level: 0 },
};

const STEP_RUNNERS: Record<MapPipelineStep, (ctx: StepContext) => Promise<StepReport>> = {
  repair: runRepairStep,
  physical: runPhysicalStep,
  rasters: runRastersStep,
  labels: runLabelsStep,
  flags: runFlagsStep,
  defaultView: runDefaultViewStep,
  areas: runAreasStep,
};

interface PipelineProgress {
  write: (percent: number, stage: string) => void;
  isCancelled: () => boolean;
}

interface PipelineJob {
  id: string;
  realmId: string;
  options: Prisma.JsonValue;
  requestedBy: string;
}

async function loadRun(db: PrismaClient, job: PipelineJob) {
  const options = mapPipelineOptionsSchema.parse(job.options);
  const realm = await db.realm.findUnique({
    where: { id: job.realmId },
    select: { id: true, slug: true, name: true, settings: true },
  });
  if (!realm) throw new Error("Realm not found");
  const { pipeline, problem } = readRealmMapPipeline(realm.settings);
  if (!pipeline)
    throw new Error(problem ?? "The realm has no map pipeline: load a preset or set one up");
  return { options, realm: { id: realm.id, slug: realm.slug, name: realm.name }, pipeline };
}

/** One step under its own error boundary; a cancel stops the run. */
async function runStep(ctx: StepContext, step: MapPipelineStep): Promise<StepResult> {
  const started = Date.now();
  try {
    const report = await STEP_RUNNERS[step](ctx);
    return { step, ...report, ms: Date.now() - started };
  } catch (error) {
    if (error instanceof ImportCancelledError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[map-pipeline] ${ctx.realm.slug} ${step} failed:`, error);
    return {
      step,
      status: "failed",
      summary: message.slice(0, 500),
      details: [],
      ms: Date.now() - started,
    };
  }
}

/** Run a queued `map-pipeline` job (called by map-import.jobs.ts under the realm's lease). */
export async function runMapPipelineJob(
  db: PrismaClient,
  job: PipelineJob,
  progress: PipelineProgress,
  deps: PipelineDeps = {}
): Promise<PipelineSummary> {
  const { options, realm, pipeline } = await loadRun(db, job);
  const sync = await loadSourceSyncConfig(db, realm.id);
  const read = artResolver({
    art: pipeline.art,
    repo: sync ? { repo: sync.repo, ref: sync.ref } : null,
    localDir: deps.localDir,
    fetchBytes: deps.fetchBytes,
  });
  const hashes: Record<string, string> = {};
  const art: ArtResolver = async (key) => {
    const resolved = await read(key);
    hashes[key] = resolved.sha256;
    return resolved;
  };
  const steps = orderedSteps(options.steps);
  const results: StepResult[] = [];
  for (const [i, step] of steps.entries()) {
    if (progress.isCancelled()) throw new ImportCancelledError();
    const label = MAP_PIPELINE_STEP_LABELS[step];
    const report = (fraction: number, stage: string) => {
      const percent = ((i + Math.max(0, Math.min(1, fraction))) / steps.length) * 100;
      progress.write(percent, `${label}: ${stage}`);
      deps.onProgress?.(percent, `${label}: ${stage}`);
    };
    report(0, "Starting");
    results.push(
      await runStep(
        {
          db,
          realm,
          pipeline,
          dryRun: options.dryRun,
          art,
          requestedBy: job.requestedBy,
          actor: PIPELINE_ACTOR,
          jobId: job.id,
          progress: report,
          isCancelled: progress.isCancelled,
          deps,
        },
        step
      )
    );
  }
  return {
    phase: "pipeline",
    dryRun: options.dryRun,
    steps: results,
    art: hashes,
  };
}

/** The run's failed steps, as the job's error ("" when none failed). */
export function pipelineError(summary: PipelineSummary): string {
  return summary.steps
    .filter((s) => s.status === "failed")
    .map((s) => `${MAP_PIPELINE_STEP_LABELS[s.step]}: ${s.summary}`)
    .join("; ")
    .slice(0, 1000);
}
