"use client";

import React from "react";
import { MousePointer2, Pencil, Scissors, Merge, Undo2, Redo2, Save, Check, X, Wrench } from "lucide-react";
import type { BorderEditMode } from "~/hooks/useBorderEditor";

interface BorderEditorToolbarProps {
  mode: BorderEditMode;
  onModeChange: (mode: BorderEditMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onRepair: () => void;
  isDirty: boolean;
  isSaving: boolean;
  areaKm2: number | null;
  splitPointCount: number;
}

const MODES: Array<{ id: BorderEditMode; label: string; icon: React.ReactNode; tip: string }> = [
  {
    id: "select",
    label: "Select",
    icon: <MousePointer2 className="h-4 w-4" />,
    tip: "Click to select a feature",
  },
  {
    id: "vertex_edit",
    label: "Edit Vertices",
    icon: <Pencil className="h-4 w-4" />,
    tip: "Click vertices to select, drag to move",
  },
  {
    id: "split",
    label: "Split",
    icon: <Scissors className="h-4 w-4" />,
    tip: "Draw a line to split a country",
  },
  {
    id: "merge",
    label: "Merge",
    icon: <Merge className="h-4 w-4" />,
    tip: "Select countries to merge together",
  },
];

export const BorderEditorToolbar = React.memo(function BorderEditorToolbar({
  mode,
  onModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onSubmit,
  onCancel,
  onRepair,
  isDirty,
  isSaving,
  areaKm2,
  splitPointCount,
}: BorderEditorToolbarProps) {
  return (
    <div className="border-border bg-card/90 flex flex-col gap-2 rounded-lg border p-2 backdrop-blur">
      {/* Mode buttons */}
      <div className="flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              mode === m.id
                ? "bg-blue-500/30 text-blue-500 ring-1 ring-blue-500/50"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={m.tip}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Undo/Redo + Area */}
      <div className="border-border flex items-center justify-between border-t pt-2">
        <div className="flex gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        {areaKm2 !== null && (
          <span className="text-muted-foreground text-xs">
            {areaKm2 > 1000000
              ? `${(areaKm2 / 1000000).toFixed(2)}M km²`
              : `${Math.round(areaKm2).toLocaleString()} km²`}
          </span>
        )}
      </div>

      {/* Split line info */}
      {mode === "split" && splitPointCount > 0 && (
        <div className="border-border border-t pt-2 text-xs text-amber-500">
          Split line: {splitPointCount} points
        </div>
      )}

      {/* Action buttons */}
      <div className="border-border flex gap-1 border-t pt-2">
        <button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="bg-muted/50 text-foreground hover:bg-muted/80 flex items-center gap-1 rounded px-2 py-1.5 text-xs disabled:opacity-30"
          title="Save draft"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onRepair}
          className="bg-muted/50 text-foreground hover:bg-muted/80 flex items-center gap-1 rounded px-2 py-1.5 text-xs"
          title="Clean duplicate vertices and spikes"
        >
          <Wrench className="h-3.5 w-3.5" />
          Repair
        </button>
        <button
          onClick={onSubmit}
          disabled={!isDirty}
          className="flex items-center gap-1 rounded bg-green-600/40 px-2 py-1.5 text-xs text-green-500 hover:bg-green-600/60 disabled:opacity-30"
          title="Apply changes"
        >
          <Check className="h-3.5 w-3.5" />
          Apply
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 rounded bg-red-600/30 px-2 py-1.5 text-xs text-red-500 hover:bg-red-600/50"
          title="Discard changes"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
});
