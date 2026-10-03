"use client";

import { forwardRef, useImperativeHandle } from "react";
import { Trash as Trash2 } from "iconoir-react";
import type { IxWorldMapRef } from "./IxWorldMap";
import { useMeasureToolState } from "./hooks/useMeasureToolState";
import { formatDistance } from "./utils/measure-helpers";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";

interface MeasureToolRef {
  toggle: () => void;
}

interface MeasureToolProps {
  mapRef: React.RefObject<IxWorldMapRef | null>;
  onActiveChange?: (active: boolean) => void;
  /** When true, hides the inline button (button rendered elsewhere via ref.toggle) */
  headless?: boolean;
}

export const MeasureTool = forwardRef<MeasureToolRef, MeasureToolProps>(function MeasureTool(
  { mapRef, onActiveChange, headless = false },
  ref
) {
  const { active, points, totalDistance, clearPoints, handleToggle } = useMeasureToolState({
    mapRef,
    onActiveChange,
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
          title="Measure distance (M)"
        >
          <Trash2 aria-hidden />
          Measure
        </Button>
      )}

      {/* Distance readout (fixed to map, below toolbar) */}
      {active && points.length >= 2 && (
        <div className="fixed top-36 left-6 z-30 sm:absolute sm:top-14 sm:left-3">
          <FacetMaterial
            material="regular"
            role="status"
            className="rounded-row text-body flex items-center gap-2 px-3 py-2"
          >
            <span className="text-label font-semibold tabular-nums">
              {formatDistance(totalDistance)}
            </span>
            <span className="text-label-secondary">({points.length} pts)</span>
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
          </FacetMaterial>
        </div>
      )}
    </>
  );
});
