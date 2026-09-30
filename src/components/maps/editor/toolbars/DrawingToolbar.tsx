import { FacetContainer } from "~/components/ui/facet-container";
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
    <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 duration-200">
      <FacetContainer material="regular" className="flex items-center gap-3 rounded-full px-4 py-2">
        <span className="text-foreground mr-2 text-xs font-semibold select-none">
          Drawing Subdivision:{" "}
          <span className="text-primary font-bold tabular-nums">{drawVertices.length}</span>{" "}
          {drawVertices.length === 1 ? "vertex" : "vertices"}
        </span>
        <div className="bg-border h-4 w-px" />
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={undoLastVertex}
        >
          Delete Last
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={clearDraw}
        >
          Clear
        </Button>
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
      </FacetContainer>
    </div>
  );
}
import { Button } from "~/components/ui/button";
