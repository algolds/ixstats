"use client";

import React from "react";
import { MapPin, Layers, AlertTriangle, Users } from "lucide-react";
import type { Polygon, MultiPolygon } from "geojson";
import { getVertices } from "~/lib/border-editor";

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
}: BorderEditorPanelProps) {
  const vertices = geometry ? getVertices(geometry) : [];
  const ringCount = geometry
    ? geometry.type === "Polygon"
      ? geometry.coordinates.length
      : geometry.coordinates.reduce((sum, p) => sum + p.length, 0)
    : 0;

  return (
    <div className="border-border bg-card/90 flex h-full flex-col gap-3 overflow-y-auto rounded-lg border p-3 backdrop-blur">
      {/* Feature Info */}
      {featureId ? (
        <div>
          <h3 className="text-foreground text-sm font-semibold">{displayName || featureId}</h3>
          <p className="text-muted-foreground text-xs">{featureId}</p>
          {isDirty && (
            <span className="mt-1 inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-500">
              Modified
            </span>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">No feature selected</span>
        </div>
      )}

      {/* Stats */}
      {geometry && (
        <div className="border-border space-y-1 border-t pt-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <MapPin className="h-3.5 w-3.5" />
            <span>{vertices.length} vertices</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Layers className="h-3.5 w-3.5" />
            <span>
              {ringCount} ring{ringCount !== 1 ? "s" : ""}
            </span>
          </div>
          {areaKm2 !== null && (
            <div className="text-muted-foreground text-xs">
              Area:{" "}
              {areaKm2 > 1000000
                ? `${(areaKm2 / 1000000).toFixed(2)}M km²`
                : `${Math.round(areaKm2).toLocaleString()} km²`}
            </div>
          )}
        </div>
      )}

      {/* Neighbors (for merge mode) */}
      {mode === "merge" && neighbors.length > 0 && (
        <div className="border-border border-t pt-2">
          <div className="text-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
            <Users className="h-3.5 w-3.5" />
            Select neighbors to merge
          </div>
          <div className="space-y-1">
            {neighbors.map((n) => (
              <button
                key={n.featureId}
                onClick={() => onToggleMergeTarget(n.featureId)}
                className={`w-full rounded px-2 py-1 text-left text-xs transition-colors ${
                  mergeTargets.includes(n.featureId)
                    ? "bg-blue-500/30 text-blue-500 ring-1 ring-blue-500/40"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {n.displayName || n.featureId}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Neighbor list (non-merge mode) */}
      {mode !== "merge" && neighbors.length > 0 && (
        <div className="border-border border-t pt-2">
          <div className="text-muted-foreground mb-1 text-xs font-medium">
            Neighbors ({neighbors.length})
          </div>
          <div className="space-y-0.5">
            {neighbors.slice(0, 10).map((n) => (
              <div key={n.featureId} className="text-muted-foreground text-xs">
                {n.displayName || n.featureId}
              </div>
            ))}
            {neighbors.length > 10 && (
              <div className="text-muted-foreground/50 text-xs">+{neighbors.length - 10} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
