"use client";

import { forwardRef, useImperativeHandle } from "react";
import { Trash as Trash2 } from "iconoir-react";
import type { IxWorldMapRef } from "./IxWorldMap";
import { useMeasureToolState } from "./hooks/useMeasureToolState";
import { formatDistance } from "./utils/measure-helpers";
import { Button } from "~/components/ui/button";
import { FacetContainer } from "~/components/ui/facet-container";

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
        <Button
          variant={active ? "default" : "outline"}
          onClick={handleToggle}
          aria-pressed={active}
          className={`min-h-11 sm:min-h-0 ${active ? "bg-blue-500 text-white hover:bg-blue-500/90" : ""}`}
          title="Measure distance (M)"
        >
          <Trash2 aria-hidden />
          Measure
        </Button>
      )}

      {/* Distance readout (fixed to map, below toolbar) */}
      {active && points.length >= 2 && (
        <div className="fixed top-36 left-6 z-30 sm:absolute sm:top-14 sm:left-3">
          <FacetContainer
            material="regular"
            role="status"
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm"
          >
            <span className="text-foreground font-semibold tabular-nums">
              {formatDistance(totalDistance)}
            </span>
            <span className="text-muted-foreground">({points.length} pts)</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearPoints}
              className="text-muted-foreground hover:text-destructive h-7 w-7"
              title="Clear measurement (Esc)"
              aria-label="Clear measurement"
            >
              <Trash2 aria-hidden />
            </Button>
          </FacetContainer>
        </div>
      )}
    </>
  );
});
