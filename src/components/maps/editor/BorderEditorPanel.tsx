"use client";

import React from "react";
import {
  MapPin,
  Component as Layers,
  WarningTriangle as AlertTriangle,
  Group as Users,
  Archery as Crosshair,
} from "iconoir-react";
import type { Polygon, MultiPolygon } from "geojson";
import { getVertices } from "~/lib/maps/border-editor";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  formatPlanetArea,
  useRealmPlanetRadius,
} from "~/components/maps/core/hooks/useRealmMapDisplay";

interface BorderEditorPanelProps {
  featureId: string | null;
  displayName: string | null;
  geometry: Polygon | MultiPolygon | null;
  neighbors: Array<{ featureId: string; displayName: string | null }>;
  mergeTargets: string[];
  onToggleMergeTarget: (featureId: string) => void;
  mode: string;
  areaKm2: number | null;
  isDirty: boolean;
  /** Brush mode: selected target neighbor featureId */
  brushTargetId: string | null;
  onBrushTargetChange: (featureId: string | null) => void;
}

export const BorderEditorPanel = React.memo(function BorderEditorPanel({
  featureId,
  displayName,
  geometry,
  neighbors,
  mergeTargets,
  onToggleMergeTarget,
  mode,
  areaKm2,
  isDirty,
  brushTargetId,
  onBrushTargetChange,
}: BorderEditorPanelProps) {
  const radiusKm = useRealmPlanetRadius();
  const vertices = geometry ? getVertices(geometry) : [];
  const ringCount = geometry
    ? geometry.type === "Polygon"
      ? geometry.coordinates.length
      : geometry.coordinates.reduce((sum, p) => sum + p.length, 0)
    : 0;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      {featureId ? (
        <div>
          <h3 className="text-label text-headline">{displayName || featureId}</h3>
          <p className="text-label-secondary text-footnote">{featureId}</p>
          {isDirty && (
            <span className="bg-yellow/20 text-footnote text-yellow-ink rounded-control-sm mt-1 inline-block px-2 py-0.5">
              Modified
            </span>
          )}
        </div>
      ) : (
        <div className="text-label-secondary flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-body">No feature selected</span>
        </div>
      )}

      {geometry && (
        <div className="border-separator space-y-1 border-t pt-2">
          <div className="text-label-secondary text-footnote flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>{vertices.length} vertices</span>
          </div>
          <div className="text-label-secondary text-footnote flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            <span>
              {ringCount} ring{ringCount !== 1 ? "s" : ""}
            </span>
          </div>
          {areaKm2 !== null && (
            <div className="text-label-secondary text-footnote">
              Area: {formatPlanetArea(areaKm2, radiusKm)}
            </div>
          )}
        </div>
      )}

      {mode === "merge" && neighbors.length > 0 && (
        <div className="border-separator border-t pt-2">
          <div className="text-label text-caption mb-2 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Select neighbors to merge
          </div>
          <ToggleGroup
            type="multiple"
            orientation="vertical"
            size="sm"
            aria-label="Neighbors to merge"
            className="w-full"
            value={mergeTargets}
            onValueChange={(next) => {
              const toggled =
                next.find((id) => !mergeTargets.includes(id)) ??
                mergeTargets.find((id) => !next.includes(id));
              if (toggled) onToggleMergeTarget(toggled);
            }}
          >
            {neighbors.map((n) => (
              <ToggleGroupItem key={n.featureId} value={n.featureId} className="justify-start">
                {n.displayName || n.featureId}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {mode !== "merge" && mode !== "brush" && neighbors.length > 0 && (
        <div className="border-separator border-t pt-2">
          <div className="text-label-secondary text-caption mb-1">
            Neighbors ({neighbors.length})
          </div>
          <div className="space-y-0.5">
            {neighbors.slice(0, 10).map((n) => (
              <div key={n.featureId} className="text-label-secondary text-footnote">
                {n.displayName || n.featureId}
              </div>
            ))}
            {neighbors.length > 10 && (
              <div className="text-label-tertiary text-footnote">+{neighbors.length - 10} more</div>
            )}
          </div>
        </div>
      )}

      {mode === "brush" && neighbors.length > 0 && (
        <div className="border-separator border-t pt-2">
          <div className="text-label text-caption mb-2 flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5" />
            Select target neighbor
          </div>
          <ToggleGroup
            type="single"
            orientation="vertical"
            size="sm"
            aria-label="Target neighbor"
            className="w-full"
            value={brushTargetId ?? ""}
            onValueChange={(id) => onBrushTargetChange(id || null)}
          >
            {neighbors.map((n) => (
              <ToggleGroupItem key={n.featureId} value={n.featureId} className="justify-start">
                {n.displayName || n.featureId}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-label-tertiary text-footnote mt-1">
            Click and drag on the map to paint territory into the selected neighbor.
          </p>
        </div>
      )}
    </div>
  );
});
