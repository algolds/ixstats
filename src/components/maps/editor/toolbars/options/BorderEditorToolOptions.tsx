"use client";

import { FacetMaterial } from "~/components/ui/facet";
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
import { Slider } from "~/components/ui/slider";

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

const MODE_HINTS: Partial<Record<string, string>> = {
  select: "Click a vertex/edge to start editing.",
  vertex_edit: "Drag vertices. Click midpoints to add vertices.",
  merge: "Select neighbor subdivisions to merge.",
  trace: "Click points on river/coast to trace.",
};

const ADVANCED_OPERATIONS = [
  {
    run: (a: BorderEditorActions) => a.repair(),
    title: "Repair geometry spikes",
    label: "Repair spikes",
    toast: "Repaired geometry spikes",
    icon: Wrench,
    iconClass: "text-yellow",
  },
  {
    run: (a: BorderEditorActions) => a.smooth(),
    title: "Soften corners (Chaikin smoothing)",
    label: "Smooth geometry",
    toast: "Applied Chaikin smoothing",
    icon: Spline,
    iconClass: "text-blue",
  },
  {
    run: (a: BorderEditorActions) => a.naturalize(),
    title: "Subdivide and randomize for organic coastlines",
    label: "Naturalize coastline",
    toast: "Naturalized coastline",
    icon: Waves,
    iconClass: "text-cyan",
  },
  {
    run: (a: BorderEditorActions) => a.simplify(),
    title: "Reduce vertex count (Douglas-Peucker)",
    label: "Simplify (Reduce Vertices)",
    toast: "Simplified border vertices",
    icon: Minimize2,
    iconClass: "text-indigo",
  },
];

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
    <FacetMaterial
      layer="chrome"
      role="toolbar"
      aria-label="Border editor options"
      className="pointer-events-auto flex h-9 shrink-0 items-center justify-between rounded-none px-3"
    >
      <div className="flex items-center gap-2">
        <div className="border-separator mr-2 flex items-center gap-2 border-r pr-2">
          <Scissors className="text-label-secondary h-3.5 w-3.5" />
          <span className="text-label text-caption font-semibold">
            Border Editor ({countryName || "unnamed"})
          </span>
        </div>

        {borderState.mode === "brush" && (
          <div className="flex items-center gap-2">
            <Eyebrow>Brush size</Eyebrow>
            <Slider
              aria-label="Brush size"
              min={1}
              max={200}
              step={1}
              value={[brushRadius]}
              onValueChange={([v]) => v !== undefined && setBrushRadius(v)}
              className="w-24 py-2"
            />
            <span className="text-label-secondary text-footnote w-12 text-right tabular-nums">
              {brushRadius}km
            </span>
          </div>
        )}

        {borderState.mode === "split" && borderState.splitLine.length > 0 && (
          <span className="text-caption text-yellow">
            Split Line: {borderState.splitLine.length} points
          </span>
        )}

        {MODE_HINTS[borderState.mode] && (
          <span className="text-label-secondary text-footnote">{MODE_HINTS[borderState.mode]}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="text-label-secondary h-6 w-6 justify-center"
            disabled={!(borderState.isDirty && borderState.undoStackState.position >= 0)}
            onClick={borderActions.undo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-label-secondary h-6 w-6 justify-center"
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

        <div className="bg-separator h-4 w-px" />

        {borderState.areaKm2 !== null && (
          <span className="text-label-secondary text-caption select-none">
            {borderState.areaKm2 > 1000000
              ? `${(borderState.areaKm2 / 1000000).toFixed(2)}M km²`
              : `${Math.round(borderState.areaKm2).toLocaleString()} km²`}
          </span>
        )}

        <div className="bg-separator h-4 w-px" />

        <Popover>
          <PopoverTrigger className="bg-fill-3 text-label-secondary hover:bg-fill-3 hover:text-label text-caption rounded-control-sm flex h-6 cursor-pointer items-center gap-1 px-2 transition-colors">
            <Wrench className="h-3 w-3" />
            <span>Advanced</span>
          </PopoverTrigger>
          <PopoverContent className="rounded-control-sm w-48 p-2" align="end">
            <div className="flex flex-col gap-1">
              {ADVANCED_OPERATIONS.map(({ run, title, label, toast, icon: Icon, iconClass }) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void run(borderActions);
                    notify.info(toast, undefined, {
                      actions: [{ label: "Undo", onClick: () => borderActions.undo() }],
                    });
                  }}
                  title={title}
                  className="text-label-secondary hover:text-label h-auto min-h-(--control-height-sm) w-full justify-start gap-2 py-2 text-left whitespace-normal"
                >
                  <Icon className={`${iconClass} h-3.5 w-3.5`} />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="bg-separator h-4 w-px" />

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

        <div className="bg-separator h-4 w-px" />

        <Button variant="secondary" size="xs" onClick={onExit} title="Close border editor">
          <X className="h-3 w-3" />
          <span>Close</span>
        </Button>
      </div>
    </FacetMaterial>
  );
});
