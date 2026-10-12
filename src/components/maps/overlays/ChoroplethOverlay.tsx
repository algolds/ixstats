"use client";

/** Colours the political fill layer by a per-country metric; restores the original colours when hidden. */

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { OverlayRow } from "~/lib/maps/overlay-types";
import {
  POLITICAL_LAYER_ID,
  colorPoliticalFill,
  interpolateColor,
  restorePoliticalFill,
  type ColorStops,
} from "./political-fill";

type ColorScale = "wealth" | "population" | "neutral" | "canon";

interface ChoroplethOverlayProps {
  map: MapLibreMap | null;
  rows: OverlayRow[];
  visible: boolean;
  layerId: string; // unique key to avoid conflicts between wealth/population
  colorScale?: ColorScale;
  metadata?: { minVal: number; maxVal: number };
}

const COLOR_SCALES: Record<ColorScale, ColorStops> = {
  wealth: [
    [0, "#94a3b8"], // slate (poor)
    [0.25, "#6ee7b7"], // emerald
    [0.5, "#34d399"], // emerald
    [0.75, "#fbbf24"], // amber
    [1, "#f59e0b"], // gold (wealthy)
  ],
  population: [
    [0, "#e0f2fe"], // sky-100 (sparse)
    [0.25, "#7dd3fc"], // sky-300
    [0.5, "#6366f1"], // indigo
    [0.75, "#a855f7"], // purple
    [1, "#ec4899"], // pink (dense)
  ],
  neutral: [
    [0, "#dbeafe"],
    [0.5, "#3b82f6"],
    [1, "#1e3a8a"],
  ],
  canon: [
    [0, "#fef9c3"], // yellow-100 (quiet)
    [0.25, "#fde047"], // yellow-300
    [0.5, "#f97316"], // orange-500
    [0.75, "#dc2626"], // red-600
    [1, "#7f1d1d"], // red-900 (story-dense)
  ],
};

export function ChoroplethOverlay({
  map,
  rows,
  visible,
  colorScale = "neutral",
}: ChoroplethOverlayProps) {
  const activeRef = useRef(false);

  useEffect(() => {
    if (!map || !map.getLayer(POLITICAL_LAYER_ID)) return;

    if (!visible) {
      if (activeRef.current) {
        restorePoliticalFill(map);
        activeRef.current = false;
      }
      return;
    }

    const stops = COLOR_SCALES[colorScale];
    const colors = rows.map(({ countryId, value }): [string, string] => [
      countryId,
      interpolateColor(value, stops),
    ]);
    if (colorPoliticalFill(map, colors)) activeRef.current = true;
  }, [map, rows, visible, colorScale]);

  // Restore on unmount
  useEffect(() => {
    return () => {
      if (!map || !activeRef.current) return;
      try {
        if (map.getLayer(POLITICAL_LAYER_ID)) restorePoliticalFill(map);
      } catch {
        /* map may be destroyed */
      }
      activeRef.current = false;
    };
  }, [map]);

  return null;
}
