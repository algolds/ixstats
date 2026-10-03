"use client";

/** Crisis risk heatmap (green safe → red high) on the political fill, plus active crisis event markers. */

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import {
  setOrUpdateGeoJSONSource,
  ensureMapLayer,
  removeLayerAndSource,
} from "~/lib/maps/geojson-layer-helpers";
import {
  POLITICAL_LAYER_ID,
  colorPoliticalFill,
  interpolateColor,
  restorePoliticalFill,
  type ColorStops,
} from "./political-fill";

const CRISIS_SOURCE = "crisis-events-source";
const CRISIS_LAYER = "crisis-events-circle";

const RISK_STOPS: ColorStops = [
  [0, "#22c55e"], // green (safe)
  [0.3, "#facc15"], // yellow (moderate)
  [0.6, "#f97316"], // orange (elevated)
  [0.9, "#dc2626"], // red (high risk)
];

interface RiskHeatmapOverlayProps {
  map: MapLibreMap | null;
  riskData: FeatureCollection;
  crisisEvents: FeatureCollection;
  visible: boolean;
}

export function RiskHeatmapOverlay({
  map,
  riskData,
  crisisEvents,
  visible,
}: RiskHeatmapOverlayProps) {
  const activeRef = useRef(false);

  useEffect(() => {
    if (!map || !map.getLayer(POLITICAL_LAYER_ID)) return;

    if (!visible) {
      if (activeRef.current) {
        restorePoliticalFill(map);
        activeRef.current = false;
      }
      if (map.getLayer(CRISIS_LAYER)) {
        map.setLayoutProperty(CRISIS_LAYER, "visibility", "none");
      }
      return;
    }

    const colors = riskData.features.flatMap(({ properties: props }): [string, string][] =>
      !props?.id || props.riskScore === undefined
        ? []
        : [[props.id as string, interpolateColor(props.riskScore as number, RISK_STOPS)]]
    );
    if (colorPoliticalFill(map, colors)) activeRef.current = true;

    // Crisis event point markers
    setOrUpdateGeoJSONSource(map, CRISIS_SOURCE, crisisEvents);
    ensureMapLayer(map, {
      id: CRISIS_LAYER,
      type: "circle",
      source: CRISIS_SOURCE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "severity"], 1, 5, 5, 10, 10, 16],
        "circle-color": "#ef4444",
        "circle-opacity": 0.85,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    });

    map.setLayoutProperty(CRISIS_LAYER, "visibility", "visible");
  }, [map, riskData, crisisEvents, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map) return;
      if (activeRef.current && map.getLayer(POLITICAL_LAYER_ID)) {
        try {
          restorePoliticalFill(map);
        } catch (err) {
          console.debug(
            "[RiskHeatmapOverlay] Non-fatal paint property reset error during unmount:",
            err
          );
        }
      }
      removeLayerAndSource(map, CRISIS_LAYER, CRISIS_SOURCE);
      activeRef.current = false;
    };
  }, [map]);

  return null;
}
