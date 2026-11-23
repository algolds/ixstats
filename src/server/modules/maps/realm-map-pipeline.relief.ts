/**
 * The pipeline's `relief` step: the realm's hillshade (realm-relief.ts) and elevation model (realm-dem.ts) built
 * from its stored altitude bands, so it runs after `physical` has written them. It reads no art and needs no stored pipeline. A dry run reports whether
 * the layer's tiles or entry would change; a realm with no altitude bands has no relief and is skipped.
 */
import {
  capDetails,
  changedStatus,
  skipped,
  type StepContext,
  type StepReport,
} from "./realm-map-pipeline.context";
import { applyRealmRelief, planRealmRelief } from "./realm-relief";
import { applyRealmDem, planRealmDem } from "./realm-dem";

export async function runReliefStep(ctx: StepContext): Promise<StepReport> {
  ctx.progress(0, "Reading the altitude bands");
  const plan = await planRealmRelief(ctx.db, ctx.realm.id, { bands: true });
  if (!plan) return skipped("No altitude bands to shade");
  ctx.progress(0.2, "Shaping the elevation model");
  const dem = await planRealmDem(ctx.db, ctx.realm.id, { bands: true });

  const { version, maxZoom } = plan.entry;
  const layer = `relief: version ${version}, z0–${maxZoom}`;
  const demLayer = dem
    ? `elevation: version ${dem.entry.version}, z0–${dem.entry.maxZoom}`
    : "no elevation";
  if (!plan.changed && !dem?.changed) {
    return { status: "unchanged", summary: `${layer}, ${demLayer}, unchanged`, details: [] };
  }
  if (ctx.dryRun) {
    const change = (p: { built: boolean; changed: boolean }) =>
      !p.changed ? "unchanged" : p.built ? "entry changes" : "tiles to build";
    return {
      status: changedStatus(ctx),
      summary: `${layer}, ${change(plan)}; ${demLayer}${dem ? `, ${change(dem)}` : ""}`,
      details: [],
    };
  }

  ctx.progress(0.3, "Building tiles");
  const started = Date.now();
  const built = await applyRealmRelief(ctx.db, ctx.realm.id, plan);
  ctx.progress(0.5, "Building the elevation tiles");
  const builtDem = dem && (await applyRealmDem(ctx.db, ctx.realm.id, dem));
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const lines = [
    `${layer}: ${built.tiles} tiles written, ${built.skipped} fully transparent left out, in ${seconds} s`,
    ...(builtDem ? [`${demLayer}: ${builtDem.tiles} tiles written`] : []),
  ];
  return {
    status: "changed",
    summary: lines[0]!,
    details: capDetails(lines),
    counts: { tiles: built.tiles + (builtDem?.tiles ?? 0), skipped: built.skipped },
  };
}
