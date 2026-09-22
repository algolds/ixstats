"use client";

import React from "react";
import { toast } from "sonner";
import {
  Cut as Scissors,
  Undo as Undo2,
  Redo as Redo2,
  Wrench,
  GraphUp as Spline,
  SeaWaves as Waves,
  Compress as Minimize2,
  FloppyDisk as Save,
  Check,
  Xmark as X,
  Refresh as RefreshCw,
} from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import type { BorderEditorState, BorderEditorActions } from "~/hooks/useBorderEditor";

interface BorderEditorToolOptionsProps {
  countryName?: string;
  borderState: BorderEditorState;
  borderActions: BorderEditorActions;
  brushRadius: number;
  setBrushRadius: (radius: number) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onExit: () => void;
}

export const BorderEditorToolOptions = React.memo(function BorderEditorToolOptions({
  countryName,
  borderState,
  borderActions,
  brushRadius,
  setBrushRadius,
  isSubmitting,
  onSubmit,
  onExit,
}: BorderEditorToolOptionsProps) {
  return (
    <div className="border-border bg-card/85 pointer-events-auto flex h-8 shrink-0 items-center justify-between border-b px-3 backdrop-blur-sm">
      {/* Left Side: Active Tool Options */}
      <div className="flex items-center gap-2">
        <div className="border-border mr-2 flex items-center gap-1.5 border-r pr-2">
          <Scissors className="text-muted-foreground h-3.5 w-3.5" />
          <span className="text-foreground text-[11px] font-semibold">
            Border Editor ({countryName || "unnamed"})
          </span>
        </div>

        {/* Tool-specific configuration */}
        {borderState.mode === "brush" && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Brush Size
            </span>
            <input
              type="range"
              min="1"
              max="200"
              step="1"
              value={brushRadius}
              onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
              className="accent-primary h-4 w-24"
            />
            <span className="text-muted-foreground w-12 text-right font-mono text-[11px] tabular-nums">
              {brushRadius}km
            </span>
          </div>
        )}

        {borderState.mode === "split" && borderState.splitLine.length > 0 && (
          <span className="animate-pulse text-[11px] font-medium text-amber-500">
            Split Line: {borderState.splitLine.length} points
          </span>
        )}

        {borderState.mode === "select" && (
          <span className="text-muted-foreground text-[11px]">
            Click a vertex/edge to start editing.
          </span>
        )}

        {borderState.mode === "vertex_edit" && (
          <span className="text-muted-foreground text-[11px]">
            Drag vertices. Click midpoints to add vertices.
          </span>
        )}

        {borderState.mode === "merge" && (
          <span className="text-muted-foreground text-[11px]">
            Select neighbor subdivisions to merge.
          </span>
        )}

        {borderState.mode === "trace" && (
          <span className="text-muted-foreground text-[11px]">
            Click points on river/coast to trace.
          </span>
        )}
      </div>

      {/* Right Side: Actions (Undo/Redo, Stats, Advanced, Save, Apply, Cancel) */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button
            disabled={!(borderState.isDirty && borderState.undoStackState.position >= 0)}
            onClick={borderActions.undo}
            className="text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98] flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={
              !(
                borderState.isDirty &&
                borderState.undoStackState.position <
                  borderState.undoStackState.entries.length - 1
              )
            }
            onClick={borderActions.redo}
            className="text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98] flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="bg-border h-4 w-px" />

        {/* Area Stats */}
        {borderState.areaKm2 !== null && (
          <span className="text-muted-foreground text-[11px] font-medium select-none">
            {borderState.areaKm2 > 1000000
              ? `${(borderState.areaKm2 / 1000000).toFixed(2)}M km²`
              : `${Math.round(borderState.areaKm2).toLocaleString()} km²`}
          </span>
        )}

        <div className="bg-border h-4 w-px" />

        {/* Advanced operations popover */}
        <Popover>
          <PopoverTrigger className="bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98] flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors">
            <Wrench className="h-3 w-3" />
            <span>Advanced</span>
          </PopoverTrigger>
          <PopoverContent
            className="bg-popover border-border text-foreground z-[100] w-48 rounded-md border p-2 shadow-md"
            align="end"
          >
            <div className="flex flex-col gap-1">
              <button
                onClick={() => {
                  void borderActions.repair();
                  toast("Repaired geometry spikes", {
                    action: {
                      label: "Undo",
                      onClick: () => borderActions.undo(),
                    },
                  });
                }}
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors active:scale-[0.98]"
                title="Repair geometry spikes"
              >
                <Wrench className="h-3.5 w-3.5 text-amber-500" />
                <span>Repair Spikes</span>
              </button>
              <button
                onClick={() => {
                  void borderActions.smooth();
                  toast("Applied Chaikin smoothing", {
                    action: {
                      label: "Undo",
                      onClick: () => borderActions.undo(),
                    },
                  });
                }}
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors active:scale-[0.98]"
                title="Soften corners (Chaikin smoothing)"
              >
                <Spline className="h-3.5 w-3.5 text-blue-500" />
                <span>Smooth Geometry</span>
              </button>
              <button
                onClick={() => {
                  void borderActions.naturalize();
                  toast("Naturalized coastline", {
                    action: {
                      label: "Undo",
                      onClick: () => borderActions.undo(),
                    },
                  });
                }}
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors active:scale-[0.98]"
                title="Subdivide and randomize for organic coastlines"
              >
                <Waves className="h-3.5 w-3.5 text-cyan-500" />
                <span>Naturalize Coastline</span>
              </button>
              <button
                onClick={() => {
                  void borderActions.simplify();
                  toast("Simplified border vertices", {
                    action: {
                      label: "Undo",
                      onClick: () => borderActions.undo(),
                    },
                  });
                }}
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors active:scale-[0.98]"
                title="Reduce vertex count (Douglas-Peucker)"
              >
                <Minimize2 className="h-3.5 w-3.5 text-indigo-500" />
                <span>Simplify (Reduce Vertices)</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="bg-border h-4 w-px" />

        {/* Save Draft */}
        <button
          onClick={() => void borderActions.save()}
          disabled={!borderState.isDirty || isSubmitting}
          className="bg-muted/50 text-foreground hover:bg-accent active:scale-[0.98] flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors disabled:opacity-30"
          title="Save draft"
        >
          <Save className="h-3 w-3" />
          <span>{isSubmitting ? "Saving..." : "Save"}</span>
        </button>

        {/* Revert edits */}
        <button
          onClick={borderActions.revert}
          disabled={
            !borderState.isDirty &&
            borderState.splitLine.length === 0 &&
            borderState.mergeTargets.length === 0
          }
          className="flex h-6 cursor-pointer items-center gap-1 rounded bg-red-500/10 px-2 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-30"
          title="Revert all unsaved changes for this feature"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Revert</span>
        </button>

        {/* Apply & Exit */}
        <button
          onClick={onSubmit}
          disabled={
            !borderState.isDirty &&
            !(borderState.mode === "split" && borderState.splitLine.length >= 2) &&
            !(borderState.mode === "merge" && borderState.mergeTargets.length > 0)
          }
          className="flex h-6 cursor-pointer items-center gap-1 rounded bg-emerald-600/20 px-2 text-[11px] font-medium text-emerald-500 transition-colors hover:bg-emerald-600/30 active:scale-[0.98] disabled:opacity-30"
          title="Apply and exit"
        >
          <Check className="h-3 w-3" />
          <span>Apply</span>
        </button>

        <div className="bg-border h-4 w-px" />

        {/* Close / Exit Border Editor */}
        <button
          onClick={onExit}
          className="bg-muted hover:bg-accent text-foreground active:scale-[0.98] flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors"
          title="Close Border Editor"
        >
          <X className="h-3 w-3" />
          <span>Close</span>
        </button>
      </div>
    </div>
  );
});
