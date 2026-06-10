"use client";

import React from "react";
import { countGeometryVertices } from "~/components/maps/editor/utils/editor-overlay-helpers";

interface RegionHoverTooltipProps {
  hoveredFeature: any;
  editorMode: string;
}

export function RegionHoverTooltip({ hoveredFeature, editorMode }: RegionHoverTooltipProps) {
  if (!hoveredFeature || (editorMode !== "view" && editorMode !== "paint")) {
    return null;
  }

  return (
    <div
      className="border-border bg-card/95 pointer-events-none absolute z-20 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm"
      style={{
        left: hoveredFeature.screenPos.x + 12,
        top: hoveredFeature.screenPos.y - 8,
        maxWidth: 220,
      }}
    >
      <div className="text-foreground text-xs font-semibold">
        {hoveredFeature.feature.name}
      </div>
      <div className="text-muted-foreground mt-1 space-y-0.5 text-[10px]">
        <div className="flex justify-between gap-3">
          <span>Type</span>
          <span className="text-foreground font-medium">
            {hoveredFeature.feature.properties.subdivisionType ??
              hoveredFeature.feature.type}
          </span>
        </div>
        {hoveredFeature.feature.properties.areaSqKm != null && (
          <div className="flex justify-between gap-3">
            <span>Area</span>
            <span className="text-foreground font-medium tabular-nums">
              {Number(hoveredFeature.feature.properties.areaSqKm).toLocaleString()} km²
            </span>
          </div>
        )}
        {hoveredFeature.feature.properties.population != null && (
          <div className="flex justify-between gap-3">
            <span>Population</span>
            <span className="text-foreground font-medium tabular-nums">
              {Number(hoveredFeature.feature.properties.population).toLocaleString()}
            </span>
          </div>
        )}
        {hoveredFeature.feature.geometry && (
          <div className="flex justify-between gap-3">
            <span>Vertices</span>
            <span className="text-foreground font-medium tabular-nums">
              {countGeometryVertices(hoveredFeature.feature.geometry)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
