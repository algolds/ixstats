"use client";

import { forwardRef, useImperativeHandle } from "react";
import { Trash2 } from "lucide-react";
import type { IxWorldMapRef } from "./IxWorldMap";
import { useMeasureToolState } from "./hooks/useMeasureToolState";
import { formatDistance } from "./utils/measure-helpers";

export interface MeasureToolRef {
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
        <button
          onClick={handleToggle}
          className={`flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-md transition-colors sm:min-h-0 sm:min-w-0 ${
            active ? "bg-blue-500 text-white" : "bg-card text-foreground hover:bg-accent"
          }`}
          title="Measure distance (M)"
        >
          <Trash2 className="h-4 w-4" />
          Measure
        </button>
      )}

      {/* Distance readout (fixed to map, below toolbar) */}
      {active && points.length >= 2 && (
        <div className="bg-card ring-border fixed top-36 left-6 z-30 flex items-center gap-2 rounded-lg px-3 py-2 text-sm shadow-lg ring-1 sm:absolute sm:top-14 sm:left-3">
          <span className="text-foreground font-semibold">{formatDistance(totalDistance)}</span>
          <span className="text-muted-foreground">({points.length} pts)</span>
          <button
            onClick={clearPoints}
            className="text-muted-foreground ml-1 rounded p-0.5 hover:text-red-500"
            title="Clear measurement (Esc)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
});
