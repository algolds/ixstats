import React from "react";
import type { EditorMode } from "~/hooks/useMapEditor";

interface RouteEditingToolbarProps {
  mode: EditorMode;
  onRouteEditCommit?: () => void;
  onRouteEditCancel?: () => void;
}

export function RouteEditingToolbar({
  mode,
  onRouteEditCommit,
  onRouteEditCancel,
}: RouteEditingToolbarProps) {
  if (mode !== "edit-route") return null;

  return (
    <div className="bg-card/95 ring-border absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full p-1 shadow-lg ring-1 backdrop-blur-sm">
      <span className="text-muted-foreground hidden px-2 text-[11px] sm:inline">
        Drag route vertices · Midpoints to add · Right-click to remove
      </span>
      <div className="bg-border hidden h-4 w-px sm:block" />
      <button
        onClick={onRouteEditCommit}
        className="animate-pulse rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        Save Route Path
      </button>
      <button
        onClick={onRouteEditCancel}
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full px-3 py-1.5 text-xs font-medium"
      >
        Cancel
      </button>
    </div>
  );
}
