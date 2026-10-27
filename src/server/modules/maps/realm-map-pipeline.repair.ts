/**
 * The pipeline's `repair` step: the realm's political borders made valid, overlaps given to one side and, with the
 * pipeline's `coverage`, smoothed as one coverage, idempotently (src/lib/maps/realm-layer-repair.ts). A smoothing
 * that must start again reads the unsmoothed borders from the realm's source (its source-sync repository at its
 * ref, or the CLI's local checkout); after an apply the areas are measured again and adjacency rebuilt.
 */
import { scaleAreaToRadius } from "~/lib/maps/planet";
import { realmRadiusKm } from "~/lib/maps/realm-map-settings";
import {
  repairRealmLayer,
  type LayerRepairPlan,
  type LayerRepairReport,
  type SourceOutline,
} from "~/lib/maps/realm-layer-repair";
import { geometryHash } from "~/lib/realms/sources/plan";
import { recomputeRealmMapAreas } from "~/server/modules/realms/realms.map";
import {
  loadSourceSyncConfig,
  readSourceSnapshot,
} from "~/server/modules/realms/realms.source-sync";
import { refreshRealmMap } from "./map-import.apply";
import {
  capDetails,
  changedStatus,
  currentSettings,
  type StepContext,
  type StepReport,
} from "./realm-map-pipeline.context";
import { localRepoFile } from "./realm-map-pipeline.art";

const LAYER = "political";

/** The source's borders by key, or why they could not be read. */
async function sourceOutlines(
  ctx: StepContext
): Promise<{ sourceRaw?: Map<string, SourceOutline>; sourceUnavailable?: string }> {
  const config = await loadSourceSyncConfig(ctx.db, ctx.realm.id);
  if (!config) return { sourceUnavailable: "the realm has no source sync" };
  try {
    const fetchFile =
      ctx.deps.fetchFile ?? (ctx.deps.localDir ? localRepoFile(ctx.deps.localDir) : undefined);
    const snapshot = await readSourceSnapshot(config, { fetchFile });
    return {
      sourceRaw: new Map(
        snapshot.features.map((f) => [
          f.key,
          { geometry: f.geometry, sourceHash: geometryHash(f.geometry) },
        ])
      ),
    };
  } catch (error) {
    return { sourceUnavailable: error instanceof Error ? error.message : String(error) };
  }
}

function smoothingLine(plan: LayerRepairPlan): string {
  const s = plan.smoothing;
  switch (s.status) {
    case "off":
      return "smoothing off";
    case "up-to-date":
      return "smoothing up to date";
    case "smooth":
      return `smoothing ${s.pending.length} pending: the layer is smoothed again (${s.fromSource.length} from the source)`;
    default:
      return `smoothing blocked: ${s.blocked.length} smoothed borders have no unsmoothed outline${s.sourceProblem ? ` (source: ${s.sourceProblem})` : ""}`;
  }
}

function planDetails(plan: LayerRepairPlan): string[] {
  const trimmed = plan.trims.reduce((sum, t) => sum + t.removedKm2, 0);
  return [
    ...plan.needsRepair.map((key) => `repair ${key}`),
    ...plan.trims.map((t) => `overlap ${t.key}: -${t.removedKm2.toFixed(2)} km²`),
    ...(plan.trims.length > 0 ? [`overlaps: ${trimmed.toFixed(1)} km² in all`] : []),
    ...plan.smoothing.blocked.map((key) => `blocked ${key}`),
    ...plan.crossing.map((key) => `${key} crosses ±180°: left as it is`),
  ];
}

function report(ctx: StepContext, result: LayerRepairReport, after: string[]): StepReport {
  const { plan, written } = result;
  const summary = `${plan.features} borders: ${plan.needsRepair.length} to repair, ${plan.trims.length} overlaps, ${smoothingLine(plan)}`;
  return {
    status: plan.changed ? changedStatus(ctx) : "unchanged",
    summary: written
      ? `${summary}; rewrote ${written.written.length}, smoothed ${written.smoothed}, ${written.rejected.length} rejected`
      : summary,
    details: capDetails([
      ...planDetails(plan),
      ...(written?.rejected.map((r) => `rejected ${r.key}: ${r.reason}`) ?? []),
      ...after,
    ]),
    counts: {
      features: plan.features,
      repair: plan.needsRepair.length,
      overlaps: plan.trims.length,
      smoothPending: plan.smoothing.pending.length,
      blocked: plan.smoothing.blocked.length,
      written: written?.written.length ?? 0,
    },
  };
}

export async function runRepairStep(ctx: StepContext): Promise<StepReport> {
  const coverage = ctx.pipeline.coverage ?? null;
  const areaScale = scaleAreaToRadius(1, realmRadiusKm(await currentSettings(ctx)));
  const options = {
    layerType: LAYER,
    coverage,
    createdBy: ctx.requestedBy,
    areaScale,
  };
  ctx.progress(0.05, "Checking the borders");
  const first = await repairRealmLayer(ctx.db, ctx.realm.id, { ...options, apply: false });
  const wantsSource = first.plan.smoothing.pending.length > 0;
  if (!wantsSource && (ctx.dryRun || !first.plan.changed)) return report(ctx, first, []);

  ctx.progress(0.2, wantsSource ? "Reading the source's borders" : "Repairing");
  const source = wantsSource ? await sourceOutlines(ctx) : {};
  const result = await repairRealmLayer(ctx.db, ctx.realm.id, {
    ...options,
    ...source,
    apply: !ctx.dryRun,
  });
  if (!result.written) return report(ctx, result, []);

  ctx.progress(0.85, "Measuring areas and rebuilding adjacency");
  const areas = await recomputeRealmMapAreas(ctx.db, ctx.actor, ctx.realm.id);
  const pairs = await refreshRealmMap(ctx.db, ctx.realm.id);
  return report(ctx, result, [
    `areas measured again: ${areas.updated} features (radius ${areas.radiusKm} km)`,
    `adjacency: ${pairs ?? "not rebuilt"} neighbour pairs`,
    `rollback: map import ${result.mapImportId}`,
  ]);
}
