/**
 * What every map pipeline step gets and gives back (realm-map-pipeline.job.ts runs them): the realm, its pipeline
 * config, its art, dry run or apply, progress and cancel, and a report the panel and the CLI show. A step never
 * throws for "nothing to do": it reports `unchanged` or `skipped`. A dry run writes nothing and reports what an apply
 * would change (`would-change`); an apply that finds nothing to change writes nothing either.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { MapPipelineStep, RealmMapPipeline } from "~/lib/maps/realm-map-pipeline";
import type { LayerEngineResult, LayerEngineSources } from "~/lib/maps/import/png/layer-engine";
import type { LayerEngineOptions } from "~/lib/maps/import/png/layer-engine-options";
import type { ProgressFn } from "~/lib/maps/import/progress";
import type { fetchRepoBytes, fetchRepoFile } from "~/lib/realms/sources/fetch";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import type { ArtResolver } from "./realm-map-pipeline.art";

export type StepStatus = "unchanged" | "would-change" | "changed" | "skipped" | "failed";

export interface StepReport {
  status: StepStatus;
  /** One line for the run's list. */
  summary: string;
  /** The step's own lines (per layer, per nation…), at most MAX_STEP_DETAILS. */
  details: string[];
  counts?: Record<string, number>;
}

export interface StepResult extends StepReport {
  step: MapPipelineStep;
  ms: number;
}

const MAX_STEP_DETAILS = 200;

interface PipelineRealm {
  id: string;
  slug: string;
  name: string;
}

/** Replaceable parts (the CLI's local checkout, tests). */
export interface PipelineDeps {
  /** A local checkout of the realm's source repository (repository art and source files are read from it). */
  localDir?: string;
  fetchBytes?: typeof fetchRepoBytes;
  fetchFile?: typeof fetchRepoFile;
  runLayerEngine?: (
    sources: LayerEngineSources,
    options: Partial<LayerEngineOptions>,
    progress: ProgressFn,
    isCancelled: () => boolean
  ) => Promise<LayerEngineResult>;
  /** Progress lines as they happen (the CLI prints them). */
  onProgress?: ProgressFn;
}

export interface StepContext {
  db: PrismaClient;
  realm: PipelineRealm;
  pipeline: RealmMapPipeline;
  dryRun: boolean;
  art: ArtResolver;
  /** Who started the run (Clerk userId, "cron" or "script:…"), recorded on what it writes. */
  requestedBy: string;
  /** The actor writes are made as: the run was checked against realmMapAccess when it started. */
  actor: RealmActor;
  jobId: string | null;
  /** This step's progress, 0–1. */
  progress: (fraction: number, stage: string) => void;
  isCancelled: () => boolean;
  deps: PipelineDeps;
}

/** The realm's settings as stored now (a step before may have changed them). */
export async function currentSettings(ctx: StepContext): Promise<Prisma.JsonValue> {
  const realm = await ctx.db.realm.findUnique({
    where: { id: ctx.realm.id },
    select: { settings: true },
  });
  return realm?.settings ?? {};
}

/** The report of a step that changes something: what an apply would do, or did. */
export const changedStatus = (ctx: StepContext): StepStatus =>
  ctx.dryRun ? "would-change" : "changed";

export const skipped = (summary: string): StepReport => ({
  status: "skipped",
  summary,
  details: [],
});

export const capDetails = (lines: readonly string[]): string[] =>
  lines.length > MAX_STEP_DETAILS
    ? [...lines.slice(0, MAX_STEP_DETAILS - 1), `… and ${lines.length - MAX_STEP_DETAILS + 1} more`]
    : [...lines];
