"use client";

/**
 * Map Measurement Control Wrapper
 *
 * Integrates the enhanced DistanceMeasurement component with the maps interface.
 * This is a simple wrapper to maintain backwards compatibility with existing code.
 */

import type { Map as MapLibreMap } from "maplibre-gl";
import { DistanceMeasurement, type MeasurementResult } from "../measurement";

interface MapMeasurementProps {
  map: MapLibreMap | null;
  active: boolean;
  onMeasurementComplete?: (distanceKm: number, distanceMi: number) => void;
}

export default function MeasurementControl({
  map,
  active,
  onMeasurementComplete,
}: MapMeasurementProps) {
  const handleComplete = (result: MeasurementResult) => {
    if (onMeasurementComplete) {
      if (result.type === "distance" && result.distanceKm && result.distanceMi) {
        onMeasurementComplete(result.distanceKm, result.distanceMi);
      } else if (result.type === "area" && result.distanceKm && result.distanceMi) {
        // For area measurements, pass the perimeter as distance
        onMeasurementComplete(result.distanceKm, result.distanceMi);
      }
    }
  };

  return <DistanceMeasurement map={map} active={active} onComplete={handleComplete} />;
}
