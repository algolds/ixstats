/**
 * history-coercion — turns recorded feature snapshots (DB rows carry nulls and
 * loose types) into values the geo-feature tRPC inputs accept. zod `.optional()`
 * rejects null, so every helper returns `undefined` for missing/invalid values.
 */

import type { HistoryData } from "./useMapHistory";

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
export function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
export function int(v: unknown): number | undefined {
  const n = num(v);
  return n === undefined ? undefined : Math.max(0, Math.round(n));
}
export function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
export function coords(v: unknown): [number, number] | undefined {
  return Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number"
    ? [v[0], v[1]]
    : undefined;
}
export function has(data: HistoryData, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined;
}

const STORY_CATEGORIES = [
  "battle",
  "founding",
  "treaty",
  "cultural",
  "religious",
  "natural",
  "trade",
  "exploration",
  "naval",
  "settlement",
  "government",
  "biography",
  "linguistic",
  "upheaval",
] as const;
export type StoryCategory = (typeof STORY_CATEGORIES)[number];

const LABEL_TYPES = [
  "mountain_range",
  "strait",
  "bay",
  "peninsula",
  "plateau",
  "valley",
  "desert",
  "sea",
  "region",
  "historical",
] as const;
export type LabelType = (typeof LABEL_TYPES)[number];

export function storyCategory(v: unknown): StoryCategory | undefined {
  return STORY_CATEGORIES.includes(v as StoryCategory) ? (v as StoryCategory) : undefined;
}
export function labelType(v: unknown): LabelType | undefined {
  return LABEL_TYPES.includes(v as LabelType) ? (v as LabelType) : undefined;
}
export function hexColor(v: unknown): string | undefined {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
}

export type GeometryInput = Record<string, unknown>;
export type LineStringInput = { type: "LineString"; coordinates: [number, number][] };

export function geometry(v: unknown): GeometryInput | undefined {
  return v && typeof v === "object" && "type" in v ? (v as GeometryInput) : undefined;
}
export function lineString(v: unknown): LineStringInput | undefined {
  const g = geometry(v) as { type?: string; coordinates?: unknown } | undefined;
  if (!g) return undefined;
  if (g.type === "LineString" && Array.isArray(g.coordinates)) {
    return { type: "LineString", coordinates: g.coordinates as [number, number][] };
  }
  if (g.type === "MultiLineString" && Array.isArray(g.coordinates)) {
    return {
      type: "LineString",
      coordinates: (g.coordinates as [number, number][][]).flat(),
    };
  }
  return undefined;
}
