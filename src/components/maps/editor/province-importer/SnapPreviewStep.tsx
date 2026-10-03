"use client";
import { Button } from "~/components/ui/button";
import React, { memo, useMemo } from "react";
import { Magnet, Compress as Minimize2 } from "iconoir-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import type { Polygon, MultiPolygon, Position } from "geojson";
import { Slider } from "~/components/ui/slider";
import { Card } from "~/components/ui/card";

interface SnapPreviewStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
}

/** Count total vertices across all rings in a geometry */
function countVertices(geometry: Polygon | MultiPolygon | null | undefined): number {
  if (!geometry) return 0;
  const coords = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
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
        <h3 className="text-label text-body font-medium">Snap & simplify</h3>
        <p className="text-label-secondary text-footnote mt-1">
          Snap edges to the country border, simplify vertices to the minimum needed, and align
          shared borders between neighboring provinces.
        </p>
      </div>

      {/* Snap Tolerance */}
      <div className="space-y-2">
        <label className="text-label-secondary text-footnote flex items-center gap-2">
          <Magnet className="h-3 w-3" /> Border snap tolerance
        </label>
        <Slider
          aria-label="Border snap tolerance"
          min={0.01}
          max={2}
          step={0.01}
          value={[importer.snapTolerance]}
          onValueChange={([v]) => v !== undefined && importer.setSnapTolerance(v)}
          className="w-full py-2"
        />
        <div className="text-label-secondary text-footnote flex justify-between">
          <span>Tight (1km)</span>
          <span className="font-mono">{importer.snapTolerance.toFixed(2)}°</span>
          <span>Loose (220km)</span>
        </div>
      </div>

      {/* Simplify Tolerance */}
      <div className="space-y-2">
        <label className="text-label-secondary text-footnote flex items-center gap-2">
          <Minimize2 className="h-3 w-3" /> Vertex reduction
        </label>
        <Slider
          aria-label="Vertex reduction"
          min={0.001}
          max={0.02}
          step={0.001}
          value={[importer.simplifyTolerance]}
          onValueChange={([v]) => v !== undefined && importer.setSimplifyTolerance(v)}
          className="w-full py-2"
        />
        <div className="text-label-secondary text-footnote flex justify-between">
          <span>More detail</span>
          <span className="font-mono">{importer.simplifyTolerance.toFixed(3)}°</span>
          <span>Fewer points</span>
        </div>
      </div>

      {/* Vertex count stats */}
      {vertexStats.before > 0 && (
        <Card className="text-footnote px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-label-secondary">Original vertices</span>
            <span className="font-medium tabular-nums">{vertexStats.before.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-label-secondary">Current vertices</span>
            <span className="font-medium tabular-nums">{vertexStats.after.toLocaleString()}</span>
          </div>
          {vertexStats.reduction > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-label-secondary">Reduction</span>
              <span className="text-green font-medium tabular-nums">{vertexStats.reduction}%</span>
            </div>
          )}
        </Card>
      )}

      <Button
        size="sm"
        className="w-full justify-center"
        onClick={importer.applySnapping}
        disabled={!importer.countryBorder}
      >
        <Magnet className="h-3.5 w-3.5" />
        Apply snap & simplify
      </Button>

      <div className="text-label-secondary text-footnote">
        Snapping aligns edges to the country border. Simplification reduces vertices while
        preserving shape. Neighbor alignment ensures no gaps between adjacent provinces.
      </div>
    </div>
  );
});
