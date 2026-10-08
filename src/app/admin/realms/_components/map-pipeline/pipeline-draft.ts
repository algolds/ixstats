/**
 * The map pipeline panel's draft: the realm's pipeline config (realm-map-pipeline.ts) as the form edits it, its art
 * as rows (so a key can be renamed while typing), and validation that puts each problem at the field it belongs to.
 * Pure: no React.
 */
import type { z } from "zod";
import {
  MAP_PIPELINE_STEP_LABELS,
  MAP_PIPELINE_STEPS,
  firstIssue,
  realmMapPipelineSchema,
  stepArt,
  type RealmMapPipeline,
} from "~/lib/maps/realm-map-pipeline";
import { artKeySchema, type ArtSource } from "~/lib/maps/realm-map-art";
import { climateKeyFileSchema, type RealmLayerConfig } from "~/lib/maps/import/realm-layer-config";
import { realmLabelSeedFileSchema } from "~/lib/maps/realm-labels";
import { ClimateKeySchema } from "~/lib/maps/realm-map-settings";
import { repoPathSchema } from "~/lib/realms/sources/config";

export interface ArtRow {
  key: string;
  source: ArtSource;
}

export interface PipelineDraft extends Omit<RealmMapPipeline, "art"> {
  art: ArtRow[];
}

/** Field path ("rasters.0.art") → the first problem found there. */
export type DraftErrors = Record<string, string>;

export const EMPTY_PIPELINE: RealmMapPipeline = { art: {}, rasters: [] };

export function toDraft(pipeline: RealmMapPipeline): PipelineDraft {
  return {
    ...pipeline,
    art: Object.entries(pipeline.art).map(([key, source]) => ({ key, source })),
  };
}

/** The draft as a pipeline config (not yet validated); a repeated art key keeps its last row. */
export function draftPipeline(draft: PipelineDraft): RealmMapPipeline {
  return {
    ...draft,
    art: Object.fromEntries(draft.art.map((row) => [row.key, row.source])),
  };
}

/** JSON with object keys sorted, so two configs compare equal whatever order their fields were set in. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export function stableJson(value: RealmMapPipeline | null): string {
  return JSON.stringify(value, (_key: string, v: Json) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}

const firstMessage = (error: z.ZodError) => error.issues[0]?.message ?? "Invalid";

function artSourceError(source: ArtSource): string | null {
  if ("uploadId" in source) return source.uploadId ? null : "Upload a file";
  const path = repoPathSchema.safeParse(source.repoPath);
  return path.success ? null : firstMessage(path.error);
}

function artRowErrors(rows: readonly ArtRow[], errors: DraftErrors) {
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const key = artKeySchema.safeParse(row.key);
    if (!key.success) errors[`art.${i}.key`] = firstMessage(key.error);
    else if (seen.has(row.key)) errors[`art.${i}.key`] = `"${row.key}" is used twice`;
    seen.add(row.key);
    const source = artSourceError(row.source);
    if (source) errors[`art.${i}.source`] = source;
  });
}

/** Each art field of the physical config, with its form path. */
export function physicalArtFields(
  physical: RealmLayerConfig
): Array<{ key: string; path: string }> {
  const { climate, ice, elevation, rivers } = physical;
  const fields: Array<{ key: string | undefined; path: string }> = [
    { key: physical.land, path: "physical.land" },
    { key: climate?.art, path: "physical.climate.art" },
    {
      key: climate && "art" in climate.key ? climate.key.art : undefined,
      path: "physical.climate.key.art",
    },
    { key: ice?.art, path: "physical.ice.art" },
    { key: elevation?.art, path: "physical.elevation.art" },
    { key: rivers?.art, path: "physical.rivers.art" },
  ];
  return fields.filter((f): f is { key: string; path: string } => f.key !== undefined);
}

/** Every field that names art, with its form path. */
function artReferences(draft: PipelineDraft): Array<{ key: string; path: string }> {
  const refs = draft.rasters.flatMap((raster, i) => [
    { key: raster.art, path: `rasters.${i}.art` },
    ...(raster.legendArt ? [{ key: raster.legendArt, path: `rasters.${i}.legendArt` }] : []),
  ]);
  if (draft.physical) refs.push(...physicalArtFields(draft.physical));
  if (draft.labels && "art" in draft.labels)
    refs.push({ key: draft.labels.art, path: "labels.art" });
  return refs;
}

/** A field naming art the draft does not have (or none yet). */
function missingArt(draft: PipelineDraft, errors: DraftErrors) {
  const keys = new Set(draft.art.map((row) => row.key));
  for (const ref of artReferences(draft)) {
    if (!ref.key) errors[ref.path] ??= "Choose art";
    else if (!keys.has(ref.key)) errors[ref.path] ??= `No art named "${ref.key}"`;
  }
}

/** Issues of the one branch a union value was meant to match (zod reports a union failure only as a whole). */
function branchIssues(pipeline: RealmMapPipeline): z.core.$ZodIssue[] {
  const issues: z.core.$ZodIssue[] = [];
  const key = pipeline.physical?.climate?.key;
  if (key) {
    const schema = "art" in key ? climateKeyFileSchema : ClimateKeySchema;
    const parsed = schema.safeParse(key);
    if (!parsed.success)
      issues.push(
        ...parsed.error.issues.map((i) => ({
          ...i,
          path: ["physical", "climate", "key", ...i.path],
        }))
      );
  }
  if (pipeline.labels && !("art" in pipeline.labels)) {
    const parsed = realmLabelSeedFileSchema.safeParse(pipeline.labels);
    if (!parsed.success)
      issues.push(...parsed.error.issues.map((i) => ({ ...i, path: ["labels", ...i.path] })));
  }
  return issues;
}

/** Where an issue is shown: none for those checked field by field (art rows, art references, unions). */
function issuePath(issue: z.core.$ZodIssue): string | null {
  const path = issue.path.map(String);
  if (path[0] === "art") return null;
  if (issue.code === "invalid_union" || issue.message.startsWith("No art named")) return null;
  return path.join(".");
}

/**
 * Validate the draft: the pipeline it saves as, or null with every problem at its field ("" for one that belongs
 * to no field).
 */
export function validateDraft(draft: PipelineDraft): {
  pipeline: RealmMapPipeline | null;
  errors: DraftErrors;
} {
  const errors: DraftErrors = {};
  artRowErrors(draft.art, errors);
  missingArt(draft, errors);
  const candidate = draftPipeline(draft);
  const parsed = realmMapPipelineSchema.safeParse(candidate);
  const issues = parsed.success ? [] : [...parsed.error.issues, ...branchIssues(candidate)];
  for (const issue of issues) {
    const path = issuePath(issue);
    if (path !== null) errors[path] ??= issue.message;
  }
  if (!parsed.success && Object.keys(errors).length === 0) errors[""] = firstIssue(parsed.error);
  const ok = parsed.success && Object.keys(errors).length === 0;
  return { pipeline: ok ? parsed.data : null, errors };
}

/** The steps that read each art key, by label. */
export function artUsage(draft: PipelineDraft): Record<string, string[]> {
  const pipeline = draftPipeline(draft);
  const usage: Record<string, string[]> = {};
  for (const step of MAP_PIPELINE_STEPS) {
    for (const key of new Set(stepArt(pipeline, step))) {
      (usage[key] ??= []).push(MAP_PIPELINE_STEP_LABELS[step]);
    }
  }
  return usage;
}

/** The list with item `from` moved by `by` places (unchanged when that leaves the list). */
export function moveItem<T>(items: readonly T[], from: number, by: number): T[] {
  const to = from + by;
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** The list with item `index` replaced by `patch` applied to it. */
export function patchItem<T>(items: readonly T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}
