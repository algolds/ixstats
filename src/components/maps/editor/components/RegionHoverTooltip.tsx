"use client";

/**
 * RegionHoverTooltip — stats card that follows the pointer over a region.
 *
 * Subscribes to the transient store (hovered id + cursor pixel position) so
 * hovering re-renders only this tooltip, not the editor.
 */

import { FacetContainer } from "~/components/ui/facet-container";
import React, { useMemo } from "react";
import { countGeometryVertices } from "~/components/maps/editor/utils/editor-overlay-helpers";
import { useTransientMapStore } from "~/components/maps/editor/utils/transientStore";
import type { EditorFeature } from "~/components/maps/editor/types/editor-state";

export interface HoveredFeatureInfo {
  feature: EditorFeature;
  screenPos: { x: number; y: number };
}

interface RegionHoverTooltipProps {
  /** Editor features; the tooltip shows only for regions (subdivisions). */
  features: EditorFeature[];
  editorMode: string;
}

export const RegionHoverTooltip = React.memo(function RegionHoverTooltip({
  features,
  editorMode,
}: RegionHoverTooltipProps) {
  const hoveredId = useTransientMapStore((s) => s.hoveredFeatureId);
  const screen = useTransientMapStore((s) => s.cursorScreen);

  const regionsById = useMemo(() => {
    const m = new Map<string, EditorFeature>();
    for (const f of features) if (f.type === "subdivision") m.set(f.id, f);
    return m;
  }, [features]);

  const feature = hoveredId ? regionsById.get(hoveredId) : undefined;
  const vertexCount = useMemo(
    () => (feature?.geometry ? countGeometryVertices(feature.geometry) : null),
    [feature]
  );

  if (!feature || !screen || (editorMode !== "view" && editorMode !== "paint")) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-20"

      style={{
        left: screen.x + 14,
        top: screen.y + 14,
        maxWidth: 220,
      }}
    >
      <FacetContainer depth={2} className="rounded-lg px-3 py-2">
        <div className="text-foreground text-xs font-semibold">{feature.name}</div>
        <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
          <div className="flex justify-between gap-3">
            <span>Type</span>
            <span className="text-foreground font-medium capitalize">
              {String(feature.properties.type ?? feature.properties.subdivisionType ?? "region")}
            </span>
          </div>
          {feature.properties.areaSqKm != null && (
            <div className="flex justify-between gap-3">
              <span>Area</span>
              <span className="text-foreground font-medium tabular-nums">
                {Math.round(Number(feature.properties.areaSqKm)).toLocaleString()} km²
              </span>
            </div>
          )}
          {feature.properties.population != null && (
            <div className="flex justify-between gap-3">
              <span>Population</span>
              <span className="text-foreground font-medium tabular-nums">
                {Number(feature.properties.population).toLocaleString()}
              </span>
            </div>
          )}
          {vertexCount !== null && (
            <div className="flex justify-between gap-3">
              <span>Vertices</span>
              <span className="text-foreground font-medium tabular-nums">{vertexCount}</span>
            </div>
          )}
        </div>
      </FacetContainer>
    </div>
  );
});
