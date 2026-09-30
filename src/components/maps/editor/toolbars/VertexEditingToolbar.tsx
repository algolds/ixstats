import { FacetContainer } from "~/components/ui/facet-container";
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
      <FacetContainer depth={2} className="flex items-center gap-1.5 rounded-full p-1.5">
        <span className="text-muted-foreground hidden px-2.5 text-xs font-medium sm:inline">
          Drag vertices · Midpoints to add · Right-click to remove
        </span>
        <div className="bg-border hidden h-4 w-px sm:block" />
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
      </FacetContainer>
    </div>
  );
}
import { Button } from "~/components/ui/button";
