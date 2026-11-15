import React from "react";
import { Compress } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";

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
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <FacetMaterial
        layer="chrome"
        className="facet-chrome-subtle rounded-control flex items-center gap-2 px-2.5 py-1.5"
      >
        <span className="text-label-secondary text-caption hidden px-2 sm:inline">
          Drag vertices · Midpoints to add · Right-click to remove
        </span>
        <div className="bg-separator hidden h-4 w-px sm:block" />
        <Button
          variant="secondary"
          size="xs"
          onClick={handleSimplifyAndSave}
          title="Simplify vertices, snap to country border, and save"
        >
          <Compress className="h-3 w-3" aria-hidden />
          <span className="hidden sm:inline">Simplify</span>
        </Button>
        <Button
          variant="secondary"
          size="xs"
          onClick={handleSave}
          title="Save the shape and keep reshaping (Ctrl+Z undoes the save)"
        >
          Save
        </Button>
        <Button size="xs" onClick={finishVertexEdit} title="Save any changes and stop reshaping">
          Done
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={cancelVertexEdit}
          title="Discard unsaved vertex changes"
        >
          Cancel
        </Button>
      </FacetMaterial>
    </div>
  );
}
