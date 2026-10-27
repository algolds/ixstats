import { FacetMaterial } from "~/components/ui/facet";
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
      <FacetMaterial layer="chrome" className="flex items-center gap-3 rounded-full px-4 py-2">
        <span className="text-label text-caption mr-2 font-semibold select-none">
          Drawing Subdivision:{" "}
          <span className="text-tint font-semibold tabular-nums">{drawVertices.length}</span>{" "}
          {drawVertices.length === 1 ? "vertex" : "vertices"}
        </span>
        <div className="bg-separator h-4 w-px" />
        <Button variant="ghost" size="xs" className="text-label-secondary" onClick={undoLastVertex}>
          Delete last
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={clearDraw}
        >
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={saveDraw}
          disabled={!canSaveDraw}
          className="rounded-full"
        >
          Save shape
        </Button>
      </FacetMaterial>
    </div>
  );
}
import { Button } from "~/components/ui/button";
