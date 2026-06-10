import React from "react";
import type { EditorMode } from "~/hooks/useMapEditor";

interface MapHintPillProps {
  isVertexEditing: boolean;
  mode: EditorMode;
  drawVerticesCount: number;
}

export function MapHintPill({ isVertexEditing, mode, drawVerticesCount }: MapHintPillProps) {
  if (isVertexEditing) return null;
  if (
    mode === "view" ||
    mode === "import-provinces" ||
    mode === "edit-subdivision" ||
    mode === "edit-route"
  ) {
    return null;
  }

  return (
    <div className="bg-card/95 text-muted-foreground ring-border absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] shadow-md ring-1 backdrop-blur-sm">
      {mode === "add-city" && "Click map to place city"}
      {mode === "add-subdivision" &&
        (drawVerticesCount >= 3
          ? "Double-click to finish polygon"
          : "Click to add polygon vertices")}
      {mode === "add-poi" && "Click map to place POI"}
      {mode === "add-route" && "Click cities or map to add waypoints"}
    </div>
  );
}
