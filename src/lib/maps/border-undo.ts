/**
 * Border Editor — Undo/Redo Stack
 */

import type { Polygon, MultiPolygon } from "geojson";

export type BorderEditAction =
  | "move_vertex"
  | "add_vertex"
  | "delete_vertex"
  | "split"
  | "merge"
  | "brush"
  | "simplify"
  | "smooth"
  | "naturalize"
  | "snap";

export interface UndoEntry {
  action: BorderEditAction;
  previousGeometry: Polygon | MultiPolygon;
  resultGeometry: Polygon | MultiPolygon;
}

export interface UndoStack {
  entries: UndoEntry[];
  position: number; // Index of current state (-1 = at base)
}

export function createUndoStack(): UndoStack {
  return { entries: [], position: -1 };
}

const MAX_UNDO = 50;

export function pushUndo(
  stack: UndoStack,
  action: BorderEditAction,
  previousGeometry: Polygon | MultiPolygon,
  resultGeometry?: Polygon | MultiPolygon
): UndoStack {
  // Truncate any redo entries
  const entries = stack.entries.slice(0, stack.position + 1);
  entries.push({ action, previousGeometry, resultGeometry: resultGeometry ?? previousGeometry });

  // Cap history to prevent unbounded memory growth with complex polygons
  if (entries.length > MAX_UNDO) {
    const excess = entries.length - MAX_UNDO;
    entries.splice(0, excess);
  }

  return { entries, position: entries.length - 1 };
}

export function canUndo(stack: UndoStack): boolean {
  return stack.position >= 0;
}

export function canRedo(stack: UndoStack): boolean {
  return stack.position < stack.entries.length - 1;
}

export function getUndoGeometry(stack: UndoStack): Polygon | MultiPolygon | null {
  if (!canUndo(stack)) return null;
  return stack.entries[stack.position]!.previousGeometry;
}

export function undo(stack: UndoStack): UndoStack {
  if (!canUndo(stack)) return stack;
  return { ...stack, position: stack.position - 1 };
}

export function getRedoGeometry(stack: UndoStack): Polygon | MultiPolygon | null {
  if (!canRedo(stack)) return null;
  return stack.entries[stack.position + 1]!.resultGeometry;
}

export function redo(stack: UndoStack): UndoStack {
  if (!canRedo(stack)) return stack;
  return { ...stack, position: stack.position + 1 };
}
