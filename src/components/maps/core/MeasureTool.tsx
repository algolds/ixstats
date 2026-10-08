"use client";

import { forwardRef, useImperativeHandle } from "react";
import { Trash as Trash2 } from "iconoir-react";
import type { IxWorldMapRef } from "./IxWorldMap";
import { useMeasureToolState } from "./hooks/useMeasureToolState";
import { formatArea, formatDistance, type MeasureMode } from "./utils/measure-helpers";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { SegmentedControl } from "~/components/ui/segmented-control";

const MODE_OPTIONS = [
  { value: "distance", label: "Distance" },
  { value: "area", label: "Area" },
] as const;

interface MeasureReadoutProps {
  mode: MeasureMode;
  pointCount: number;
  totalDistance: number;
  areaSqKm: number;
  perimeterKm: number;
}

/** The measurement so far, or how many points it still needs. */
function MeasureReadout({
  mode,
  pointCount,
  totalDistance,
  areaSqKm,
  perimeterKm,
}: MeasureReadoutProps) {
  const needed = mode === "area" ? 3 : 2;
  const remaining = needed - pointCount;
  if (remaining > 0) {
    const hint =
      pointCount === 0
        ? `Add ${needed} points`
        : `Add ${remaining} more ${remaining === 1 ? "point" : "points"}`;
    return <span className="text-label-secondary">{hint}</span>;
  }
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-label font-semibold tabular-nums">
        {mode === "area" ? formatArea(areaSqKm) : formatDistance(totalDistance)}
      </span>
      <span className="text-label-secondary tabular-nums">
        {mode === "area" ? `Perimeter ${formatDistance(perimeterKm)}` : `(${pointCount} pts)`}
      </span>
    </span>
  );
}

interface MeasureToolRef {
  toggle: () => void;
}

interface MeasureToolProps {
  mapRef: React.RefObject<IxWorldMapRef | null>;
  onActiveChange?: (active: boolean) => void;
  /** When true, hides the inline button (button rendered elsewhere via ref.toggle) */
  headless?: boolean;
  /** The realm's planet radius (km); distances and areas are measured on it. Earth's by default. */
  radiusKm?: number;
}

export const MeasureTool = forwardRef<MeasureToolRef, MeasureToolProps>(function MeasureTool(
  { mapRef, onActiveChange, headless = false, radiusKm },
  ref
) {
  const {
    active,
    mode,
    setMode,
    points,
    totalDistance,
    areaSqKm,
    perimeterKm,
    clearPoints,
    handleToggle,
  } = useMeasureToolState({
    mapRef,
    onActiveChange,
    radiusKm,
  });

  // Expose toggle via ref for external control (headless mode)
  useImperativeHandle(ref, () => ({ toggle: handleToggle }), [handleToggle]);

  return (
    <>
      {/* Inline measure button — hidden in headless mode (button rendered by MapControls) */}
      {!headless && (
        <Button
          variant={active ? "default" : "outline"}
          onClick={handleToggle}
          aria-pressed={active}
          className={`min-h-11 sm:min-h-0 ${active ? "bg-blue text-on-blue hover:bg-blue/90" : ""}`}
          title="Measure distance or area (M)"
        >
          <Trash2 aria-hidden />
          Measure
        </Button>
      )}

      {/* Mode switch and readout (fixed to map, below toolbar) */}
      {active && (
        <div className="fixed top-36 left-6 z-30 max-w-[calc(100vw-3rem)] sm:absolute sm:top-14 sm:left-3">
          <FacetMaterial
            layer="chrome"
            className="rounded-row text-body flex flex-wrap items-center gap-2 px-3 py-2"
          >
            <SegmentedControl
              aria-label="Measure"
              size="sm"
              value={mode}
              onValueChange={setMode}
              options={MODE_OPTIONS}
            />
            <span role="status" className="flex items-center">
              <MeasureReadout
                mode={mode}
                pointCount={points.length}
                totalDistance={totalDistance}
                areaSqKm={areaSqKm}
                perimeterKm={perimeterKm}
              />
            </span>
            {points.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearPoints}
                className="text-label-secondary hover:text-destructive h-7 w-7"
                title="Clear measurement (Esc)"
                aria-label="Clear measurement"
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </FacetMaterial>
        </div>
      )}
    </>
  );
});
