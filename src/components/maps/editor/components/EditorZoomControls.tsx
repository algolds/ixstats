"use client";

import { Minus, Plus } from "iconoir-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { cn } from "~/lib/utils/cn";

interface EditorZoomControlsProps {
  map: MapLibreMap | null;
  className?: string;
}

/** Subtle Chrome zoom controls shared by the Map Editor and World Studio. */
export function EditorZoomControls({ map, className }: EditorZoomControlsProps) {
  return (
    <FacetMaterial
      layer="chrome"
      role="group"
      aria-label="Map zoom"
      className={cn(
        "facet-chrome-subtle rounded-control-sm pointer-events-auto flex flex-col p-0.5",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => map?.zoomIn()}
        disabled={!map}
        title="Zoom in"
        aria-label="Zoom in"
        className="text-label-secondary hover:text-label"
      >
        <Plus aria-hidden />
      </Button>
      <div className="bg-separator mx-1 h-px" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => map?.zoomOut()}
        disabled={!map}
        title="Zoom out"
        aria-label="Zoom out"
        className="text-label-secondary hover:text-label"
      >
        <Minus aria-hidden />
      </Button>
    </FacetMaterial>
  );
}
