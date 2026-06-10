import React from "react";

interface DrawingToolbarProps {
  drawVertices: [number, number][];
  undoLastVertex: () => void;
  clearDraw: () => void;
  saveDraw: () => void;
  canSaveDraw: boolean;
}

export function DrawingToolbar({
  drawVertices,
  undoLastVertex,
  clearDraw,
  saveDraw,
  canSaveDraw,
}: DrawingToolbarProps) {
  if (drawVertices.length === 0) return null;

  return (
    <div className="border-border bg-card/90 absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 shadow-lg backdrop-blur-md transition-all duration-200">
      <span className="text-foreground mr-2 text-xs font-semibold select-none">
        Drawing Subdivision:{" "}
        <span className="text-primary font-bold tabular-nums">{drawVertices.length}</span>{" "}
        {drawVertices.length === 1 ? "vertex" : "vertices"}
      </span>
      <div className="bg-border h-4 w-px" />
      <button
        onClick={undoLastVertex}
        className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-2 py-1 text-xs font-medium transition-colors"
      >
        Delete Last
      </button>
      <button
        onClick={clearDraw}
        className="text-destructive hover:bg-destructive/10 rounded-md px-2 py-1 text-xs font-medium transition-colors"
      >
        Clear
      </button>
      <button
        onClick={saveDraw}
        disabled={!canSaveDraw}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          canSaveDraw
            ? "bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        Save Shape
      </button>
    </div>
  );
}
