import React from "react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";

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
    <div className="pointer-events-auto absolute bottom-6 left-1/2 z-30 -translate-x-1/2 duration-200">
      <FacetMaterial
        layer="chrome"
        className="facet-chrome-subtle rounded-control flex items-center gap-2.5 px-3 py-1.5"
      >
        <span className="text-label text-caption mr-1 font-semibold select-none">
          Drawing subdivision:{" "}
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
        <Button type="button" size="xs" onClick={saveDraw} disabled={!canSaveDraw}>
          Save shape
        </Button>
      </FacetMaterial>
    </div>
  );
}
