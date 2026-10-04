import { FacetMaterial } from "~/components/ui/facet";
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
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <FacetMaterial layer="chrome" className="flex items-center gap-2 rounded-full p-2">
        <span className="text-label-secondary text-caption hidden px-3 sm:inline">
          Drag vertices · Midpoints to add · Right-click to remove
        </span>
        <div className="bg-separator hidden h-4 w-px sm:block" />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSimplifyAndSave}
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
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSave}
          title="Save the shape and keep reshaping (Ctrl+Z undoes the save)"
        >
          Save
        </Button>
        <Button size="sm" onClick={finishVertexEdit} title="Save any changes and stop reshaping">
          Done
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={cancelVertexEdit}
          title="Discard unsaved vertex changes"
        >
          Cancel
        </Button>
      </FacetMaterial>
    </div>
  );
}
import { Button } from "~/components/ui/button";
