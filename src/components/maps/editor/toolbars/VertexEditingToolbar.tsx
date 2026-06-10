import React from "react";

interface VertexEditingToolbarProps {
  isVertexEditing: boolean;
  handleSimplifyAndSave: () => void;
  handleSave: () => void;
  finishVertexEdit: () => void;
  cancelVertexEdit: () => void;
}

export function VertexEditingToolbar({
  isVertexEditing,
  handleSimplifyAndSave,
  handleSave,
  finishVertexEdit,
  cancelVertexEdit,
}: VertexEditingToolbarProps) {
  if (!isVertexEditing) return null;

  return (
    <div className="bg-card/95 ring-border absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full p-1 shadow-lg ring-1 backdrop-blur-sm">
      <span className="text-muted-foreground hidden px-2 text-[11px] sm:inline">
        Drag vertices · Midpoints to add · Right-click to remove
      </span>
      <div className="bg-border hidden h-4 w-px sm:block" />
      <button
        onClick={handleSimplifyAndSave}
        className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        title="Simplify vertices, snap to country border, and save"
      >
        <svg
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20L8 4" />
          <path d="M20 20L16 4" />
          <path d="M6 12h12" />
        </svg>
        <span className="hidden sm:inline">Simplify</span>
      </button>
      <button
        onClick={handleSave}
        className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        title="Save current geometry"
      >
        Save
      </button>
      <button
        onClick={finishVertexEdit}
        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        Done
      </button>
      <button
        onClick={cancelVertexEdit}
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full px-3 py-1.5 text-xs font-medium"
      >
        Cancel
      </button>
    </div>
  );
}
