"use client";

/**
 * Map Scale Component
 *
 * Displays a dynamic scale bar that updates with zoom level and map position.
 * Shows both metric (kilometers/meters) and imperial (miles/feet) units.
 */

import { useEffect, useState, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  calculateScaleAtZoom,
  getNiceScaleDistance,
  KM_TO_MILES,
  getScaleForProjection,
} from "~/lib/maps/measurement-utils";

interface MapScaleProps {
  map: MapLibreMap | null;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  maxWidth?: number; // Maximum width of scale bar in pixels
  showImperial?: boolean;
  showMetric?: boolean;
  currentProjection?: "mercator" | "globe" | "equalEarth";
}

export default function MapScale({
  map,
  position = "bottom-left",
  maxWidth = 100,
  showImperial = true,
  showMetric = true,
  currentProjection = "mercator",
}: MapScaleProps) {
  const [scaleInfo, setScaleInfo] = useState<{
    widthPx: number;
    distanceKm: number;
    distanceMi: number;
    labelKm: string;
    labelMi: string;
  } | null>(null);

  const updateScale = useCallback(() => {
    if (!map) return;

    try {
      const center = map.getCenter();
      const zoom = map.getZoom();

      // Use projection-aware scale calculation
      const { kmPerPixel } = getScaleForProjection(currentProjection, zoom, center.lat);

      // Calculate target distance for max width
      const targetKm = kmPerPixel * maxWidth;

      // Get a nice round number for the scale
      const niceKm = getNiceScaleDistance(targetKm);

      // Calculate actual width in pixels for this nice distance
      const widthPx = Math.round(niceKm / kmPerPixel);

      // Calculate miles
      const niceMi = niceKm * KM_TO_MILES;

      // Format labels
      let labelKm: string;
      let labelMi: string;

      if (niceKm < 1) {
        // Show in meters
        const meters = Math.round(niceKm * 1000);
        labelKm = `${meters} m`;
      } else if (niceKm < 10) {
        labelKm = `${niceKm.toFixed(1)} km`;
      } else {
        labelKm = `${Math.round(niceKm)} km`;
      }

      if (niceMi < 0.1) {
        // Show in feet
        const feet = Math.round(niceMi * 5280);
        labelMi = `${feet} ft`;
      } else if (niceMi < 10) {
        labelMi = `${niceMi.toFixed(1)} mi`;
      } else {
        labelMi = `${Math.round(niceMi)} mi`;
      }

      setScaleInfo({
        widthPx,
        distanceKm: niceKm,
        distanceMi: niceMi,
        labelKm,
        labelMi,
      });
    } catch (e) {
      console.warn("Error updating map scale:", e);
    }
  }, [map, maxWidth, currentProjection]);

  // Update scale on map events
  useEffect(() => {
    if (!map) return;

    // Initial update
    updateScale();

    // Update on zoom or move
    map.on("zoom", updateScale);
    map.on("move", updateScale);
    map.on("resize", updateScale);

    return () => {
      map.off("zoom", updateScale);
      map.off("move", updateScale);
      map.off("resize", updateScale);
    };
  }, [map, updateScale]);

  if (!map || !scaleInfo) return null;

  // Position classes
  const positionClasses = {
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} pointer-events-none z-[1000] select-none`}
    >
      <div className="rounded border border-gray-300 bg-white/90 px-2 py-1 shadow-md backdrop-blur-sm">
        {/* Metric scale */}
        {showMetric && (
          <div className="mb-1">
            <div className="flex items-end gap-1">
              <div className="mb-0.5 text-[10px] font-medium text-gray-700">
                {scaleInfo.labelKm}
              </div>
            </div>
            <div className="relative h-1 border-r-2 border-b-2 border-l-2 border-gray-700">
              <div
                className="absolute bottom-0 left-0 h-full border-t-2 border-gray-700"
                style={{ width: `${scaleInfo.widthPx}px` }}
              >
                {/* Tick marks */}
                <div className="absolute top-0 left-0 h-1.5 w-px bg-gray-700"></div>
                <div className="absolute top-0 left-1/2 h-1 w-px bg-gray-700"></div>
                <div className="absolute top-0 right-0 h-1.5 w-px bg-gray-700"></div>
              </div>
            </div>
          </div>
        )}

        {/* Imperial scale */}
        {showImperial && (
          <div>
            <div className="flex items-end gap-1">
              <div className="mb-0.5 text-[10px] font-medium text-gray-700">
                {scaleInfo.labelMi}
              </div>
            </div>
            <div className="relative h-1 border-r-2 border-b-2 border-l-2 border-gray-700">
              <div
                className="absolute bottom-0 left-0 h-full border-t-2 border-gray-700"
                style={{ width: `${scaleInfo.widthPx}px` }}
              >
                {/* Tick marks */}
                <div className="absolute top-0 left-0 h-1.5 w-px bg-gray-700"></div>
                <div className="absolute top-0 left-1/2 h-1 w-px bg-gray-700"></div>
                <div className="absolute top-0 right-0 h-1.5 w-px bg-gray-700"></div>
              </div>
            </div>
          </div>
        )}

        {/* Scale ratio (optional info) */}
        {showMetric && showImperial && (
          <div className="mt-0.5 text-center text-[9px] text-gray-500">
            1:
            {Math.round(
              1 / calculateScaleAtZoom(map.getCenter().lat, map.getZoom())
            ).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
