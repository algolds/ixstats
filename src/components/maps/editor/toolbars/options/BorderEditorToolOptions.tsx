"use client";

import { FacetContainer } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import React from "react";
import { useNotify } from "~/hooks/useNotify";
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
import { Eyebrow } from "~/components/ui/eyebrow";

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
  const notify = useNotify();
  return (
    <FacetContainer
      material="regular"
      role="toolbar"
      aria-label="Border editor options"
      className="pointer-events-auto flex h-9 shrink-0 items-center justify-between rounded-none px-3"
    >
      {/* Left Side: Active Tool Options */}
      <div className="flex items-center gap-2">
        <div className="border-border mr-2 flex items-center gap-1.5 border-r pr-2">
          <Scissors className="text-muted-foreground h-3.5 w-3.5" />
          <span className="text-foreground text-xs font-semibold">
            Border Editor ({countryName || "unnamed"})
          </span>
        </div>

        {/* Tool-specific configuration */}
        {borderState.mode === "brush" && (
          <div className="flex items-center gap-2">
            <Eyebrow>Brush Size</Eyebrow>
            <input
              type="range"
              min="1"
              max="200"
              step="1"
              value={brushRadius}
              onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
              className="accent-primary h-4 w-24"
            />
            <span className="text-muted-foreground w-12 text-right font-mono text-xs tabular-nums">
              {brushRadius}km
            </span>
          </div>
        )}

        {borderState.mode === "split" && borderState.splitLine.length > 0 && (
          <span className="text-xs font-medium text-amber-500">
            Split Line: {borderState.splitLine.length} points
          </span>
        )}

        {borderState.mode === "select" && (
          <span className="text-muted-foreground text-xs">
            Click a vertex/edge to start editing.
          </span>
        )}

        {borderState.mode === "vertex_edit" && (
          <span className="text-muted-foreground text-xs">
            Drag vertices. Click midpoints to add vertices.
          </span>
        )}

        {borderState.mode === "merge" && (
          <span className="text-muted-foreground text-xs">
            Select neighbor subdivisions to merge.
          </span>
        )}

        {borderState.mode === "trace" && (
          <span className="text-muted-foreground text-xs">
            Click points on river/coast to trace.
          </span>
        )}
      </div>

      {/* Right Side: Actions (Undo/Redo, Stats, Advanced, Save, Apply, Cancel) */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground h-6 w-6 justify-center"
            disabled={!(borderState.isDirty && borderState.undoStackState.position >= 0)}
            onClick={borderActions.undo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground h-6 w-6 justify-center"
            disabled={
              !(
                borderState.isDirty &&
                borderState.undoStackState.position < borderState.undoStackState.entries.length - 1
              )
            }
            onClick={borderActions.redo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="bg-border h-4 w-px" />

        {/* Area Stats */}
        {borderState.areaKm2 !== null && (
          <span className="text-muted-foreground text-xs font-medium select-none">
            {borderState.areaKm2 > 1000000
              ? `${(borderState.areaKm2 / 1000000).toFixed(2)}M km²`
              : `${Math.round(borderState.areaKm2).toLocaleString()} km²`}
          </span>
        )}

        <div className="bg-border h-4 w-px" />

        {/* Advanced operations popover */}
        <Popover>
          <PopoverTrigger className="bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-xs font-medium transition-colors active:scale-[0.98]">
            <Wrench className="h-3 w-3" />
            <span>Advanced</span>
          </PopoverTrigger>
          <PopoverContent className="w-48 rounded-md p-2" align="end">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => {
                  void borderActions.repair();
                  notify.info("Repaired geometry spikes", undefined, {
                    actions: [{ label: "Undo", onClick: () => borderActions.undo() }],
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
                  notify.info("Applied Chaikin smoothing", undefined, {
                    actions: [{ label: "Undo", onClick: () => borderActions.undo() }],
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
                  notify.info("Naturalized coastline", undefined, {
                    actions: [{ label: "Undo", onClick: () => borderActions.undo() }],
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
                  notify.info("Simplified border vertices", undefined, {
                    actions: [{ label: "Undo", onClick: () => borderActions.undo() }],
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
        <Button
          variant="ghost"
          size="xs"
          onClick={() => void borderActions.save()}
          disabled={!borderState.isDirty || isSubmitting}
          title="Save draft"
        >
          <Save className="h-3 w-3" />
          <span>{isSubmitting ? "Saving..." : "Save"}</span>
        </Button>

        {/* Revert edits */}
        <Button
          variant="ghost"
          size="xs"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={borderActions.revert}
          disabled={
            !borderState.isDirty &&
            borderState.splitLine.length === 0 &&
            borderState.mergeTargets.length === 0
          }
          title="Revert all unsaved changes for this feature"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Revert</span>
        </Button>

        {/* Apply & Exit */}
        <Button
          variant="ghost"
          size="xs"
          onClick={onSubmit}
          disabled={
            !borderState.isDirty &&
            !(borderState.mode === "split" && borderState.splitLine.length >= 2) &&
            !(borderState.mode === "merge" && borderState.mergeTargets.length > 0)
          }
          title="Apply and exit"
        >
          <Check className="h-3 w-3" />
          <span>Apply</span>
        </Button>

        <div className="bg-border h-4 w-px" />

        {/* Close / Exit Border Editor */}
        <Button variant="secondary" size="xs" onClick={onExit} title="Close Border Editor">
          <X className="h-3 w-3" />
          <span>Close</span>
        </Button>
      </div>
    </FacetContainer>
  );
});
