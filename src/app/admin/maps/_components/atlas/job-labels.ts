import type { BadgeVariant } from "~/components/ui/badge";
import type { RouterOutputs } from "~/trpc/react";

export type JobRow = RouterOutputs["atlas"]["jobs"]["list"]["jobs"][number];

const IMAGE_KINDS: Record<string, string> = { png: "PNG", svg: "SVG", geojson: "GeoJSON" };

/** What a job is, in words: "World check", "Apply (PNG)", "Map pipeline run". */
export function jobLabel({ kind, dryRun }: Pick<JobRow, "kind" | "dryRun">): string {
  if (kind === "map-pipeline") return "Map pipeline run";
  if (kind === "world") return dryRun ? "World check" : "World apply";
  return `${dryRun ? "Analysis" : "Apply"} (${IMAGE_KINDS[kind] ?? kind})`;
}

export const KIND_OPTIONS = [
  ["png", "PNG import"],
  ["svg", "SVG import"],
  ["geojson", "GeoJSON import"],
  ["world", "World"],
  ["map-pipeline", "Map pipeline"],
] as const;

export const STATUS_OPTIONS = [
  ["queued", "Queued"],
  ["running", "Running"],
  ["succeeded", "Succeeded"],
  ["failed", "Failed"],
  ["cancelled", "Cancelled"],
] as const;

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS);

const STATUS_TONE: Record<string, BadgeVariant> = {
  running: "info",
  succeeded: "success",
  failed: "destructive",
};

export const statusTone = (status: string): BadgeVariant => STATUS_TONE[status] ?? "default";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

const MAX_SUMMARY_ROWS = 12;

const sentence = (key: string) => {
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

function describe(value: Json | undefined): string {
  if (value === null || value === undefined) return "None";
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === "object") return `${Object.keys(value).length} fields`;
  return String(value);
}

/** A job's stored result as label and value rows: scalars as they are, lists and objects by size. */
export function summarizeResult(result: Json | undefined): Array<[label: string, value: string]> {
  if (result === null || result === undefined || typeof result !== "object") return [];
  if (Array.isArray(result)) return [["Result", describe(result)]];
  return Object.entries(result)
    .slice(0, MAX_SUMMARY_ROWS)
    .map(([key, value]) => [sentence(key), describe(value)]);
}
