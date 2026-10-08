/**
 * The pipeline's `rasters` step: each raster layer of the pipeline built from its art as Web Mercator tiles
 * (realm-rasters.build.ts) and recorded in `settings.map.rasterLayers` with its version (a hash of the art and
 * options, so unchanged art is never built again and changed art gets new URLs). A dry run lists the layers whose
 * entry or tiles would change. On apply, a layer's versions other than the new one and the one it replaces are
 * removed. Raster layers the pipeline does not list are kept as they are.
 */
import type { Prisma } from "@prisma/client";
import { withRasterLayer } from "~/lib/maps/raster-tiles";
import type { PipelineRaster } from "~/lib/maps/realm-map-pipeline";
import {
  parseRealmMapSettings,
  RealmMapSettingsSchema,
  RealmRasterLayerSchema,
  withRealmMapSettings,
  type RealmRasterLayer,
} from "~/lib/maps/realm-map-settings";
import {
  buildRealmRaster,
  planRealmRaster,
  pruneRasterVersions,
  type RasterPlan,
} from "./realm-rasters.build";
import {
  capDetails,
  changedStatus,
  currentSettings,
  skipped,
  type StepContext,
  type StepReport,
} from "./realm-map-pipeline.context";

interface PlannedRaster {
  spec: PipelineRaster;
  entry: RealmRasterLayer;
  plan: RasterPlan;
  image: Uint8Array;
  legend?: Uint8Array;
  /** The stored entry differs, or its tiles are missing. */
  changed: boolean;
  previous: string | undefined;
}

/** The settings entry a built layer gets. */
function rasterEntry(
  spec: PipelineRaster,
  plan: Pick<RasterPlan, "version" | "maxZoom">,
  legend: boolean
) {
  return RealmRasterLayerSchema.parse({
    id: spec.id,
    label: spec.label,
    kind: spec.kind,
    version: plan.version,
    maxZoom: plan.maxZoom,
    ...(spec.kind === "overlay" && spec.order !== undefined && { order: spec.order }),
    ...(legend && { legend: true }),
  });
}

const sameEntry = (a: RealmRasterLayer | undefined, b: RealmRasterLayer) =>
  !!a &&
  a.label === b.label &&
  a.kind === b.kind &&
  a.version === b.version &&
  a.maxZoom === b.maxZoom &&
  a.order === b.order &&
  !!a.legend === !!b.legend;

async function planRaster(
  ctx: StepContext,
  spec: PipelineRaster,
  stored: readonly RealmRasterLayer[]
): Promise<PlannedRaster> {
  const image = (await ctx.art(spec.art)).bytes;
  const legend = spec.legendArt ? (await ctx.art(spec.legendArt)).bytes : undefined;
  const plan = await planRealmRaster({
    realmId: ctx.realm.id,
    layerId: spec.id,
    kind: spec.kind,
    image,
    legend,
    grey: spec.grey,
  });
  const entry = rasterEntry(spec, plan, !!legend);
  const current = stored.find((l) => l.id === spec.id);
  return {
    spec,
    entry,
    plan,
    image,
    legend,
    changed: !plan.built || !sameEntry(current, entry),
    previous: current?.version,
  };
}

async function build(ctx: StepContext, planned: PlannedRaster): Promise<string> {
  const started = Date.now();
  const result = await buildRealmRaster({
    realmId: ctx.realm.id,
    layerId: planned.spec.id,
    kind: planned.spec.kind,
    image: planned.image,
    legend: planned.legend,
    grey: planned.spec.grey,
  });
  return result.built
    ? `${planned.spec.id}: ${result.tiles} tiles, z0–${result.maxZoom}, in ${((Date.now() - started) / 1000).toFixed(1)} s`
    : `${planned.spec.id}: version ${result.version} is built already`;
}

/** Record the built layers in the settings (other layers and settings kept), then drop stale versions. */
async function record(ctx: StepContext, changed: readonly PlannedRaster[]): Promise<string[]> {
  const settings = await currentSettings(ctx);
  let layers = parseRealmMapSettings(settings).rasterLayers ?? [];
  for (const planned of changed) layers = withRasterLayer(layers, planned.entry);
  const rasterLayers = RealmMapSettingsSchema.shape.rasterLayers.parse(layers);
  await ctx.db.realm.update({
    where: { id: ctx.realm.id },
    data: { settings: withRealmMapSettings(settings, { rasterLayers }) as Prisma.InputJsonValue },
  });
  const lines = [`settings.map.rasterLayers: ${rasterLayers?.map((l) => l.id).join(", ")}`];
  for (const planned of changed) {
    const keep = [planned.entry.version, planned.previous ?? planned.entry.version];
    const removed = await pruneRasterVersions(ctx.realm.id, planned.spec.id, keep);
    if (removed.length > 0)
      lines.push(`${planned.spec.id}: removed old versions ${removed.join(", ")}`);
  }
  return lines;
}

export async function runRastersStep(ctx: StepContext): Promise<StepReport> {
  const specs = ctx.pipeline.rasters;
  if (specs.length === 0) return skipped("No raster layers in the pipeline");
  const stored = parseRealmMapSettings(await currentSettings(ctx)).rasterLayers ?? [];
  const planned: PlannedRaster[] = [];
  for (const [i, spec] of specs.entries()) {
    ctx.progress(i / specs.length / 4, `Reading ${spec.label}`);
    planned.push(await planRaster(ctx, spec, stored));
  }
  const changed = planned.filter((p) => p.changed);
  const lines = planned.map(
    (p) =>
      `${p.spec.id}: version ${p.entry.version}, z0–${p.entry.maxZoom}${p.changed ? (p.plan.built ? ", entry changes" : ", tiles to build") : ", unchanged"}`
  );
  if (changed.length > 0 && !ctx.dryRun) {
    for (const [i, p] of changed.entries()) {
      ctx.progress(0.25 + (i / changed.length) * 0.7, `Building ${p.spec.label}`);
      lines.push(await build(ctx, p));
    }
    lines.push(...(await record(ctx, changed)));
  }
  const unlisted = stored.filter((l) => !specs.some((s) => s.id === l.id)).map((l) => l.id);
  if (unlisted.length > 0) lines.push(`kept, not in the pipeline: ${unlisted.join(", ")}`);
  return {
    status: changed.length > 0 ? changedStatus(ctx) : "unchanged",
    summary: `${specs.length} raster layers: ${changed.length} to build or record`,
    details: capDetails(lines),
    counts: { layers: specs.length, changed: changed.length },
  };
}
