"use client";

import React, { memo, useMemo } from "react";
import { Magnet, Minimize2 } from "lucide-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import type { Polygon, MultiPolygon, Position } from "geojson";

interface SnapPreviewStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
}

/** Count total vertices across all rings in a geometry */
function countVertices(geometry: Polygon | MultiPolygon | null | undefined): number {
  if (!geometry) return 0;
  const coords =
    geometry.type === "Polygon"
      ? geometry.coordinates
      : geometry.coordinates.flat();
  return coords.reduce((sum: number, ring: Position[]) => sum + ring.length, 0);
}

export const SnapPreviewStep = memo(function SnapPreviewStep({ importer }: SnapPreviewStepProps) {
  // Count vertices before (raw) and after (current) processing
  const vertexStats = useMemo(() => {
    const rawSource = importer.rawProvinces.filter((p) => p.included);
    const currentSource = importer.currentProvinces.filter((p) => p.included);

    const before = rawSource.reduce(
      (sum, p) => sum + countVertices(p.geometry as Polygon | MultiPolygon),
      0
    );
    const after = currentSource.reduce(
      (sum, p) => sum + countVertices(p.geometry as Polygon | MultiPolygon),
      0
    );
    const reduction = before > 0 ? Math.round((1 - after / before) * 100) : 0;

    return { before, after, reduction };
  }, [importer.rawProvinces, importer.currentProvinces]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Snap & Simplify</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Snap edges to the country border, simplify vertices to the minimum needed,
          and align shared borders between neighboring provinces.
        </p>
      </div>

      {/* Snap Tolerance */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Magnet className="h-3 w-3" /> Border Snap Tolerance
        </label>
        <input
          type="range"
          min={0.01}
          max={2}
          step={0.01}
          value={importer.snapTolerance}
          onChange={(e) => importer.setSnapTolerance(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Tight (1km)</span>
          <span className="font-mono">{importer.snapTolerance.toFixed(2)}°</span>
          <span>Loose (220km)</span>
        </div>
      </div>

      {/* Simplify Tolerance */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Minimize2 className="h-3 w-3" /> Vertex Reduction
        </label>
        <input
          type="range"
          min={0.001}
          max={0.02}
          step={0.001}
          value={importer.simplifyTolerance}
          onChange={(e) => importer.setSimplifyTolerance(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>More detail</span>
          <span className="font-mono">{importer.simplifyTolerance.toFixed(3)}°</span>
          <span>Fewer points</span>
        </div>
      </div>

      {/* Vertex count stats */}
      {vertexStats.before > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Original vertices</span>
            <span className="font-medium tabular-nums">{vertexStats.before.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Current vertices</span>
            <span className="font-medium tabular-nums">{vertexStats.after.toLocaleString()}</span>
          </div>
          {vertexStats.reduction > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reduction</span>
              <span className="font-medium tabular-nums text-emerald-600">
                {vertexStats.reduction}%
              </span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={importer.applySnapping}
        disabled={!importer.countryBorder}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        <Magnet className="h-3.5 w-3.5" />
        Apply Snap & Simplify
      </button>

      <div className="text-[10px] text-muted-foreground">
        Snapping aligns edges to the country border. Simplification reduces vertices while
        preserving shape. Neighbor alignment ensures no gaps between adjacent provinces.
      </div>
    </div>
  );
});
