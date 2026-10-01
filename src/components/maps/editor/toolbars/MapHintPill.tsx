import { FacetMaterial } from "~/components/ui/facet";
import React from "react";
import type { EditorMode } from "~/hooks/useMapEditor";

interface MapHintPillProps {
  isVertexEditing: boolean;
  mode: EditorMode;
  drawVerticesCount: number;
  /** Points on the in-progress route / river / split line. */
  polylineCount?: number;
}

const HINTS: Partial<Record<EditorMode, (n: number) => string>> = {
  "add-city": () => "Click the map to place a city · Esc to cancel",
  "add-poi": () => "Click the map to place a point of interest · Esc to cancel",
  "add-peak": () => "Click the map to place a peak · Esc to cancel",
  "add-route": (n) =>
    n >= 2
      ? "Keep clicking to extend · Enter to finish · Ctrl+Z removes the last point"
      : "Click cities or the map to add waypoints",
  "add-river": (n) =>
    n >= 2
      ? "Keep clicking to extend the river · name it in the panel to save"
      : "Click along the river's course, source to mouth",
  "split-subdivision": (n) =>
    n >= 2
      ? "Enter to split · Ctrl+Z removes the last point"
      : "Click points across the region, edge to edge",
  "lasso-select": () => "Drag to select · Shift adds · Alt removes",
  ruler: () => "Click points to measure · the profile shows elevation",
};

export function MapHintPill({
  isVertexEditing,
  mode,
  drawVerticesCount,
  polylineCount = 0,
}: MapHintPillProps) {
  if (isVertexEditing) return null;

  let text: string | null = null;
  if (mode === "add-subdivision" || mode === "add-lake") {
    if (drawVerticesCount === 0) text = "Click to add vertices";
    else if (drawVerticesCount >= 3)
      text = "Double-click to close the shape · Backspace removes a vertex";
    else return null;
  } else {
    text = HINTS[mode]?.(polylineCount) ?? null;
  }
  if (!text) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 max-w-[90%] -translate-x-1/2">
      <FacetMaterial
        material="regular"
        className="text-label-secondary text-footnote truncate rounded-full px-3 py-1"
      >
        {text}
      </FacetMaterial>
    </div>
  );
}
