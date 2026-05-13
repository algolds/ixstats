"use client";

/**
 * ChoroplethOverlay — Colors the existing political fill layer by metric data.
 *
 * Instead of creating a separate fill layer (which causes banding/misalignment),
 * this modifies the `fill-color` paint property on the existing `fill-political`
 * layer using a `match` expression on `_countryId`.
 *
 * When deactivated, restores the original fill-color expression.
 */

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";

type ColorScale = "wealth" | "population" | "neutral";

interface ChoroplethOverlayProps {
  map: MapLibreMap | null;
  data: FeatureCollection;
  visible: boolean;
  layerId: string; // unique key to avoid conflicts between wealth/population
  colorScale?: ColorScale;
  metadata?: { minVal: number; maxVal: number };
}

/** Interpolate a hex color between stops based on a 0–1 value */
function interpolateColor(value: number, stops: [number, string][]): string {
  // Guard against non-numeric values
  if (value === null || value === undefined || isNaN(value)) return stops[0]![1];
  
  if (value <= stops[0]![0]) return stops[0]![1];
  if (value >= stops[stops.length - 1]![0]) return stops[stops.length - 1]![1];

  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]!;
    const [t1, c1] = stops[i + 1]!;
    if (value >= t0 && value <= t1) {
      const t = (value - t0) / (t1 - t0);
      // Ensure t is a valid number
      const safeT = isNaN(t) ? 0 : t;
      const r = Math.round(parseInt(c0.slice(1, 3), 16) * (1 - safeT) + parseInt(c1.slice(1, 3), 16) * safeT);
      const g = Math.round(parseInt(c0.slice(3, 5), 16) * (1 - safeT) + parseInt(c1.slice(3, 5), 16) * safeT);
      const b = Math.round(parseInt(c0.slice(5, 7), 16) * (1 - safeT) + parseInt(c1.slice(5, 7), 16) * safeT);
      
      // Ensure r, g, b are valid numbers
      const safeR = isNaN(r) ? 0 : Math.max(0, Math.min(255, r));
      const safeG = isNaN(g) ? 0 : Math.max(0, Math.min(255, g));
      const safeB = isNaN(b) ? 0 : Math.max(0, Math.min(255, b));

      return `#${safeR.toString(16).padStart(2, "0")}${safeG.toString(16).padStart(2, "0")}${safeB.toString(16).padStart(2, "0")}`;
    }
  }
  return stops[stops.length - 1]![1];
}

const COLOR_SCALES: Record<ColorScale, [number, string][]> = {
  wealth: [
    [0, "#94a3b8"],    // slate (poor)
    [0.25, "#6ee7b7"], // emerald
    [0.5, "#34d399"],  // emerald
    [0.75, "#fbbf24"], // amber
    [1, "#f59e0b"],    // gold (wealthy)
  ],
  population: [
    [0, "#e0f2fe"],    // sky-100 (sparse)
    [0.25, "#7dd3fc"], // sky-300
    [0.5, "#6366f1"],  // indigo
    [0.75, "#a855f7"], // purple
    [1, "#ec4899"],    // pink (dense)
  ],
  neutral: [
    [0, "#dbeafe"],
    [0.5, "#3b82f6"],
    [1, "#1e3a8a"],
  ],
};

const POLITICAL_LAYER_ID = "fill-political";
const ORIGINAL_FILL_COLOR = ["coalesce", ["get", "_fillColor"], "#e8e5da"];

export function ChoroplethOverlay({ map, data, visible, colorScale = "neutral" }: ChoroplethOverlayProps) {
  const activeRef = useRef(false);

  useEffect(() => {
    if (!map || !map.getLayer(POLITICAL_LAYER_ID)) return;

    if (!visible) {
      // Restore original paint
      if (activeRef.current) {
        map.setPaintProperty(POLITICAL_LAYER_ID, "fill-color", ORIGINAL_FILL_COLOR as any);
        activeRef.current = false;
      }
      return;
    }

    // Build a match expression: ["match", ["get", "_countryId"], id1, color1, id2, color2, ..., fallback]
    const stops = COLOR_SCALES[colorScale];
    const matchExpr: unknown[] = ["match", ["get", "_countryId"]];

    for (const feature of data.features) {
      const props = feature.properties;
      if (!props?.id || props.value === undefined || props.value === null) continue;

      const color = interpolateColor(props.value as number, stops);
      matchExpr.push(props.id as string);
      matchExpr.push(color);
    }

    // Fallback for countries not in the dataset
    matchExpr.push("#e8e5da");

    if (matchExpr.length > 3) {
      // Has at least one id→color pair
      map.setPaintProperty(POLITICAL_LAYER_ID, "fill-color", matchExpr as any);
      activeRef.current = true;
    }
  }, [map, data, visible, colorScale]);

  // Restore on unmount
  useEffect(() => {
    return () => {
      if (!map || !activeRef.current) return;
      try {
        if (map.getLayer(POLITICAL_LAYER_ID)) {
          map.setPaintProperty(POLITICAL_LAYER_ID, "fill-color", ORIGINAL_FILL_COLOR as any);
        }
      } catch { /* map may be destroyed */ }
      activeRef.current = false;
    };
  }, [map]);

  return null;
}
