"use client";

/**
 * RiskHeatmapOverlay — Crisis risk coloring on the existing political layer
 * + active crisis event point markers.
 *
 * Colors the existing `fill-political` layer via a match expression on `_countryId`.
 * Green (safe) → Yellow → Orange → Red (high risk).
 * Crisis events get their own circle source/layer (point data, no banding issue).
 */

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import {
  setOrUpdateGeoJSONSource,
  ensureMapLayer,
  removeLayerAndSource,
} from "~/lib/maps/geojson-layer-helpers";

const POLITICAL_LAYER_ID = "fill-political";
const ORIGINAL_FILL_COLOR = ["coalesce", ["get", "_fillColor"], "#e8e5da"];

const CRISIS_SOURCE = "crisis-events-source";
const CRISIS_LAYER = "crisis-events-circle";

const RISK_STOPS: [number, string][] = [
  [0, "#22c55e"], // green (safe)
  [0.3, "#facc15"], // yellow (moderate)
  [0.6, "#f97316"], // orange (elevated)
  [0.9, "#dc2626"], // red (high risk)
];

function interpolateColor(value: number, stops: [number, string][]): string {
  if (value <= stops[0]![0]) return stops[0]![1];
  if (value >= stops[stops.length - 1]![0]) return stops[stops.length - 1]![1];

  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]!;
    const [t1, c1] = stops[i + 1]!;
    if (value >= t0 && value <= t1) {
      const t = (value - t0) / (t1 - t0);
      const r = Math.round(
        parseInt(c0.slice(1, 3), 16) * (1 - t) + parseInt(c1.slice(1, 3), 16) * t
      );
      const g = Math.round(
        parseInt(c0.slice(3, 5), 16) * (1 - t) + parseInt(c1.slice(3, 5), 16) * t
      );
      const b = Math.round(
        parseInt(c0.slice(5, 7), 16) * (1 - t) + parseInt(c1.slice(5, 7), 16) * t
      );
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
  }
  return stops[stops.length - 1]![1];
}

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
        map.setPaintProperty(POLITICAL_LAYER_ID, "fill-color", ORIGINAL_FILL_COLOR as any);
        activeRef.current = false;
      }
      if (map.getLayer(CRISIS_LAYER)) {
        map.setLayoutProperty(CRISIS_LAYER, "visibility", "none");
      }
      return;
    }

    // Build match expression for risk coloring on existing political layer
    const matchExpr: unknown[] = ["match", ["get", "_countryId"]];

    for (const feature of riskData.features) {
      const props = feature.properties;
      if (!props?.id || props.riskScore === undefined) continue;
      const color = interpolateColor(props.riskScore as number, RISK_STOPS);
      matchExpr.push(props.id as string);
      matchExpr.push(color);
    }
    matchExpr.push("#e8e5da"); // fallback

    if (matchExpr.length > 3) {
      map.setPaintProperty(POLITICAL_LAYER_ID, "fill-color", matchExpr as any);
      activeRef.current = true;
    }

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
          map.setPaintProperty(POLITICAL_LAYER_ID, "fill-color", ORIGINAL_FILL_COLOR as any);
        } catch (_e) {}
      }
      removeLayerAndSource(map, CRISIS_LAYER, CRISIS_SOURCE);
      activeRef.current = false;
    };
  }, [map]);

  return null;
}
