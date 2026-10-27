/**
 * Border editor drafts: what autosave stores for an edit in progress, and the rules for
 * offering one back when the border editor opens the same feature again.
 *
 * Pure functions - no React, no database.
 */

import type { Polygon, MultiPolygon } from "geojson";
import type { Prisma } from "@prisma/client";

type Shape = Polygon | MultiPolygon;

/** The outline being edited, the neighbours it moved, and when this was saved (epoch ms). */
export type BorderDraft = {
  featureId: string;
  geometry: Shape;
  dirtyNeighbors: Record<string, Shape>;
  savedAt: number;
};

/** A draft not saved for this long is not offered back (the editor session lifetime). */
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The autosave payload: these four fields only (no undo history), so it stays well under 1 MB. */
export function buildBorderDraft({
  featureId,
  geometry,
  dirtyNeighbors,
  savedAt,
}: BorderDraft): BorderDraft {
  return { featureId, geometry, dirtyNeighbors, savedAt };
}

interface StoredDraft {
  featureId?: string;
  geometry?: object | null;
  dirtyNeighbors?: Record<string, object | null> | null;
  savedAt?: number;
}

function polygonal(value: object | null | undefined): Shape | null {
  const shape = value as Partial<Shape> | null | undefined;
  const isPolygon = shape?.type === "Polygon" || shape?.type === "MultiPolygon";
  return isPolygon && Array.isArray(shape.coordinates) && shape.coordinates.length > 0
    ? (shape as Shape)
    : null;
}

function neighborShapes(stored: StoredDraft["dirtyNeighbors"]): Record<string, Shape> {
  const shapes: Record<string, Shape> = {};
  if (!stored || typeof stored !== "object") return shapes;
  for (const [featureId, value] of Object.entries(stored)) {
    const shape = polygonal(value);
    if (shape) shapes[featureId] = shape;
  }
  return shapes;
}

function readDraft(sessionData: Prisma.JsonValue | object): BorderDraft | null {
  if (!sessionData || typeof sessionData !== "object" || Array.isArray(sessionData)) return null;
  const stored = sessionData as StoredDraft;
  const geometry = polygonal(stored.geometry);
  if (!geometry || typeof stored.featureId !== "string" || typeof stored.savedAt !== "number") {
    return null;
  }
  return {
    featureId: stored.featureId,
    geometry,
    dirtyNeighbors: neighborShapes(stored.dirtyNeighbors),
    savedAt: stored.savedAt,
  };
}

interface RestorableDraftInput {
  /** The stored session payload. */
  sessionData: Prisma.JsonValue | object;
  sessionUserId: string | null | undefined;
  sessionFeatureId: string | null | undefined;
  /** Who is opening the editor, and on which feature. */
  userId: string;
  featureId: string;
  /** When the feature was last saved. */
  featureUpdatedAt: Date | null | undefined;
  /** When each of the feature's neighbours was last saved; without it every moved neighbour is offered. */
  neighborUpdatedAt?: Record<string, Date>;
  now?: number;
}

/**
 * The draft to offer back, or null. Only the opener's own draft for this very feature is offered,
 * and only when it is newer than the feature's last save (a saved edit supersedes it) and recent.
 * A moved neighbour is offered only when the neighbour has not been saved since (restoring its old outline
 * would overwrite that save), and is gone from the offer when it is no longer next to the feature.
 * Older autosave formats (undo history, no save time) are never offered.
 */
export function restorableBorderDraft({
  sessionData,
  sessionUserId,
  sessionFeatureId,
  userId,
  featureId,
  featureUpdatedAt,
  neighborUpdatedAt,
  now = Date.now(),
}: RestorableDraftInput): BorderDraft | null {
  if (sessionUserId !== userId || sessionFeatureId !== featureId) return null;
  const draft = readDraft(sessionData);
  if (!draft || draft.featureId !== featureId) return null;
  if (now - draft.savedAt > DRAFT_MAX_AGE_MS) return null;
  if (featureUpdatedAt && draft.savedAt <= featureUpdatedAt.getTime()) return null;
  return neighborUpdatedAt ? withUnchangedNeighbors(draft, neighborUpdatedAt) : draft;
}

function withUnchangedNeighbors(
  draft: BorderDraft,
  neighborUpdatedAt: Record<string, Date>
): BorderDraft {
  const dirtyNeighbors = Object.fromEntries(
    Object.entries(draft.dirtyNeighbors).filter(([featureId]) => {
      const updatedAt = neighborUpdatedAt[featureId];
      return !!updatedAt && updatedAt.getTime() < draft.savedAt;
    })
  );
  return { ...draft, dirtyNeighbors };
}
