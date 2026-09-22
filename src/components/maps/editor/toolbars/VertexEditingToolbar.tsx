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
    <div className="border-border bg-card/90 ring-border/50 absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border p-1.5 shadow-xl ring-1 backdrop-blur-md transition-all">
      <span className="text-muted-foreground hidden px-2.5 text-[11px] font-medium sm:inline">
        Drag vertices · Midpoints to add · Right-click to remove
      </span>
      <div className="bg-border hidden h-4 w-px sm:block" />
      <button
        onClick={handleSimplifyAndSave}
        className="bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
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
        className="bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98] rounded-full px-3 py-1.5 text-xs font-medium transition-all"
        title="Save current geometry"
      >
        Save
      </button>
      <button
        onClick={finishVertexEdit}
        className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-all"
      >
        Done
      </button>
      <button
        onClick={cancelVertexEdit}
        className="text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98] rounded-full px-3 py-1.5 text-xs font-medium transition-all"
      >
        Cancel
      </button>
    </div>
  );
}
