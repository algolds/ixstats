/**
 * The pipeline's `relief` step: the realm's hillshade (realm-relief.ts) built from its stored altitude bands, so it
 * runs after `physical` has written them. It reads no art and needs no stored pipeline. A dry run reports whether
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

export async function runReliefStep(ctx: StepContext): Promise<StepReport> {
  ctx.progress(0, "Reading the altitude bands");
  const plan = await planRealmRelief(ctx.db, ctx.realm.id, { bands: true });
  if (!plan) return skipped("No altitude bands to shade");

  const { version, maxZoom } = plan.entry;
  const layer = `relief: version ${version}, z0–${maxZoom}`;
  if (!plan.changed) {
    return { status: "unchanged", summary: `${layer}, unchanged`, details: [] };
  }
  if (ctx.dryRun) {
    const change = plan.built ? "entry changes" : "tiles to build";
    return { status: changedStatus(ctx), summary: `${layer}, ${change}`, details: [] };
  }

  ctx.progress(0.3, "Building tiles");
  const started = Date.now();
  const built = await applyRealmRelief(ctx.db, ctx.realm.id, plan);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const lines = [
    `${layer}: ${built.tiles} tiles written, ${built.skipped} fully transparent left out, in ${seconds} s`,
  ];
  return {
    status: "changed",
    summary: lines[0]!,
    details: capDetails(lines),
    counts: { tiles: built.tiles, skipped: built.skipped },
  };
}
