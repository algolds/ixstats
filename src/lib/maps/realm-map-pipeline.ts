/**
 * A realm's map pipeline: everything that builds the realm's map in IxWorld, as data (`Realm.settings.map.pipeline`),
 * so any realm's map is built the same way (docs/systems/realm-maps.md). Edited in the realm's admin panel (Map),
 * filled from a source preset ("Load preset"), run as a background job (MapImportJob kind `map-pipeline`) or by
 * `scripts/realms/build-realm-map.ts`. Client-safe.
 *
 * - `art`: named source files (realm-map-art.ts): a file of the realm's source-sync repository at its ref, or an
 *   upload. Every other field names art by key.
 * - `rasters`: raster tile layers built from full-globe equirectangular art (the `rasters` step), each recorded in
 *   `settings.map.rasterLayers` with its built version.
 * - `physical`: the physical layer engine's config (realm-layer-config.ts) for the `physical` step.
 * - `labels`: the realm's ocean, sea, region and continent labels: a JSON label file of the art, or typed in.
 * - `flags.localize`: the `flags` step copies the nations' wiki flags and arms to local files.
 * - `defaultView: "auto"`: the `defaultView` step centres the map on the continent with the most nations.
 * - `coverage`: smoothing for the realm's borders as one coverage (the `repair` step, and the source sync after it
 *   writes borders): ST_CoverageSimplify's tolerance in degrees (about one source pixel) and rounds of corner cutting.
 */
import { z } from "zod";
import { realmLabelSeedFileSchema } from "./realm-labels";
import { artKeySchema, artSourceSchema } from "./realm-map-art";
import { MAP_DEFAULTS } from "./map-config";
import { RealmRasterLayerSchema } from "./realm-map-settings";
import { layerConfigArt, realmLayerConfigSchema } from "./import/realm-layer-config";

/** The pipeline's steps, in the order a run takes them. */
export const MAP_PIPELINE_STEPS = [
  "repair",
  "physical",
  "rasters",
  "labels",
  "flags",
  "defaultView",
  "areas",
] as const;
export type MapPipelineStep = (typeof MAP_PIPELINE_STEPS)[number];

export const MAP_PIPELINE_STEP_LABELS: Record<MapPipelineStep, string> = {
  repair: "Border repair and smoothing",
  physical: "Physical layers",
  rasters: "Raster layers",
  labels: "Map labels",
  flags: "Local flags",
  defaultView: "Default view",
  areas: "Areas",
};

/** A run's options (MapImportJob.options of kind `map-pipeline`): the steps to take and whether it only reports. */
export const mapPipelineOptionsSchema = z.object({
  steps: z.array(z.enum(MAP_PIPELINE_STEPS)).min(1).max(MAP_PIPELINE_STEPS.length),
  dryRun: z.boolean(),
});
export type MapPipelineOptions = z.infer<typeof mapPipelineOptionsSchema>;

/** Where `defaultView: "auto"` opens the map: IxWorld's home zoom. */
export const AUTO_VIEW_ZOOM = MAP_DEFAULTS.zoom;

const pipelineRasterSchema = RealmRasterLayerSchema.pick({
  id: true,
  label: true,
  kind: true,
  order: true,
}).extend({
  /** A full-globe equirectangular image (2:1). */
  art: artKeySchema,
  /** The layer's key image, shown while the layer is on. */
  legendArt: artKeySchema.optional(),
  /** The grey copy of the art (each pixel its brightest channel, the legend too). */
  grey: z.boolean().optional(),
});
export type PipelineRaster = z.infer<typeof pipelineRasterSchema>;

const coverageSettingsSchema = z.object({
  tolerance: z.number().positive().max(5),
  smooth: z.number().int().min(0).max(4).default(2),
});
export type CoverageSettings = z.infer<typeof coverageSettingsSchema>;

/** A label file of the art, or the labels themselves. */
const pipelineLabelsSchema = z.union([
  z.object({ art: artKeySchema }).strict(),
  realmLabelSeedFileSchema,
]);

const MAX_PIPELINE_ART = 40;

const pipelineObjectSchema = z.object({
  art: z
    .record(artKeySchema, artSourceSchema)
    .default({})
    .refine((art) => Object.keys(art).length <= MAX_PIPELINE_ART, {
      message: `At most ${MAX_PIPELINE_ART} art files`,
    }),
  rasters: z
    .array(pipelineRasterSchema)
    .max(12)
    .default([])
    .refine((layers) => new Set(layers.map((l) => l.id)).size === layers.length, {
      message: "Raster layer ids must be unique",
    }),
  physical: realmLayerConfigSchema.optional(),
  labels: pipelineLabelsSchema.optional(),
  flags: z.object({ localize: z.boolean() }).optional(),
  defaultView: z.literal("auto").optional(),
  coverage: coverageSettingsSchema.optional(),
});

/** Each art key the config reads, with where it is read (a path into the config). */
function pipelineArtUses(
  pipeline: Pick<RealmMapPipeline, "rasters" | "physical" | "labels">
): Array<{ key: string; path: (string | number)[] }> {
  const uses: Array<{ key: string; path: (string | number)[] }> = [];
  pipeline.rasters.forEach((raster, i) => {
    uses.push({ key: raster.art, path: ["rasters", i, "art"] });
    if (raster.legendArt) uses.push({ key: raster.legendArt, path: ["rasters", i, "legendArt"] });
  });
  if (pipeline.physical) {
    for (const key of layerConfigArt(pipeline.physical)) uses.push({ key, path: ["physical"] });
  }
  if (pipeline.labels && "art" in pipeline.labels) {
    uses.push({ key: pipeline.labels.art, path: ["labels", "art"] });
  }
  return uses;
}

export const realmMapPipelineSchema = pipelineObjectSchema.superRefine((pipeline, ctx) => {
  for (const use of pipelineArtUses(pipeline)) {
    if (!Object.hasOwn(pipeline.art, use.key)) {
      ctx.addIssue({ code: "custom", path: use.path, message: `No art named "${use.key}"` });
    }
  }
});
export type RealmMapPipeline = z.infer<typeof realmMapPipelineSchema>;

/** The art keys one step reads (none for steps that read no art). */
export function stepArt(pipeline: RealmMapPipeline, step: MapPipelineStep): string[] {
  if (step === "physical") return pipeline.physical ? layerConfigArt(pipeline.physical) : [];
  if (step === "rasters") {
    return pipeline.rasters.flatMap((r) => (r.legendArt ? [r.art, r.legendArt] : [r.art]));
  }
  if (step === "labels" && pipeline.labels && "art" in pipeline.labels)
    return [pipeline.labels.art];
  return [];
}

/** The steps asked for, once each, in run order. */
export function orderedSteps(steps: readonly MapPipelineStep[]): MapPipelineStep[] {
  return MAP_PIPELINE_STEPS.filter((step) => steps.includes(step));
}

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** First issue of a failed parse, as "path: message". */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "invalid";
  return issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message;
}

/**
 * The realm's pipeline from `Realm.settings` (`map.pipeline`): null when it has none; a stored config that no
 * longer parses is null too, with the reason in `problem` (the panel shows it, a run refuses to start).
 */
export function readRealmMapPipeline(settings: unknown): {
  pipeline: RealmMapPipeline | null;
  problem: string | null;
} {
  const raw = settingsObject(settingsObject(settings).map).pipeline;
  if (raw === undefined || raw === null) return { pipeline: null, problem: null };
  const parsed = realmMapPipelineSchema.safeParse(raw);
  return parsed.success
    ? { pipeline: parsed.data, problem: null }
    : { pipeline: null, problem: firstIssue(parsed.error) };
}

/** `Realm.settings` with the pipeline replaced (null removes it); every other setting is kept. */
export function withRealmMapPipeline(
  settings: unknown,
  pipeline: RealmMapPipeline | null
): Record<string, unknown> {
  const stored = settingsObject(settings);
  const map: Record<string, unknown> = { ...settingsObject(stored.map) };
  if (pipeline) map.pipeline = pipeline;
  else delete map.pipeline;
  return { ...stored, map };
}

/** The fields a preset fills, in the panel's order. */
const PIPELINE_FIELDS = [
  "art",
  "rasters",
  "physical",
  "labels",
  "flags",
  "defaultView",
  "coverage",
] as const;
type PipelineField = (typeof PIPELINE_FIELDS)[number];

const isEmptyField = (pipeline: RealmMapPipeline, field: PipelineField) => {
  const value = pipeline[field];
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return field === "art" && Object.keys(value).length === 0;
};

/**
 * Fill a realm's pipeline from a preset's, the way a source preset fills the sync config: fields the realm has
 * are kept, empty ones take the preset's; `force` takes every field of the preset. Art the realm already names is
 * never replaced (unless `force`); the preset's other art is added, so its steps find what they read. Fails when
 * the result names art it does not have.
 */
export function fillPipelineFromPreset(
  current: RealmMapPipeline | null,
  preset: RealmMapPipeline,
  { force = false }: { force?: boolean } = {}
): { pipeline: RealmMapPipeline; filled: PipelineField[]; kept: PipelineField[] } {
  if (!current || force) {
    return { pipeline: preset, filled: [...PIPELINE_FIELDS], kept: [] };
  }
  const next: Record<string, unknown> = { ...current, art: { ...preset.art, ...current.art } };
  const filled: PipelineField[] = [];
  const kept: PipelineField[] = [];
  for (const field of PIPELINE_FIELDS) {
    if (field === "art") {
      (Object.keys(preset.art).some((key) => !Object.hasOwn(current.art, key))
        ? filled
        : kept
      ).push(field);
    } else if (isEmptyField(current, field) && preset[field] !== undefined) {
      next[field] = preset[field];
      filled.push(field);
    } else {
      kept.push(field);
    }
  }
  return { pipeline: realmMapPipelineSchema.parse(next), filled, kept };
}
