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
    <div className="border-border bg-card/90 ring-border/50 absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border p-1.5 shadow-xl ring-1 backdrop-blur-md transition-all">
      <span className="text-muted-foreground hidden px-2.5 text-[11px] font-medium sm:inline">
        Drag route vertices · Midpoints to add · Right-click to remove
      </span>
      <div className="bg-border hidden h-4 w-px sm:block" />
      <button
        onClick={onRouteEditCommit}
        className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-all"
      >
        Save Route Path
      </button>
      <button
        onClick={onRouteEditCancel}
        className="text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98] rounded-full px-3 py-1.5 text-xs font-medium transition-all"
      >
        Cancel
      </button>
    </div>
  );
}
