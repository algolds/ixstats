"use client";

/**
 * TradeRouteOverlay — Bilateral trade routes as MapLibre line layer.
 *
 * Lines connect country centroids. Width scales with trade volume,
 * color indicates trade balance direction (green=surplus, red=deficit, blue=balanced).
 */

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";

const SOURCE_ID = "trade-routes-source";
const LAYER_ID = "trade-routes-line";

interface TradeRouteOverlayProps {
  map: MapLibreMap | null;
  data: FeatureCollection;
  visible: boolean;
  maxVolume?: number;
}

export function TradeRouteOverlay({
  map,
  data,
  visible,
  maxVolume = 1e12,
}: TradeRouteOverlayProps) {
  const addedRef = useRef(false);

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource(SOURCE_ID);
    if (source && "setData" in source) {
      (source as any).setData(data);
    } else if (!source) {
      map.addSource(SOURCE_ID, { type: "geojson", data });
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": ["get", "balanceColor"],
          "line-width": [
            "interpolate",
            ["linear"],
            ["get", "volume"],
            0,
            1,
            maxVolume * 0.1,
            2,
            maxVolume * 0.5,
            4,
            maxVolume,
            6,
          ],
          "line-opacity": 0.6,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });
      addedRef.current = true;
    }

    map.setLayoutProperty(LAYER_ID, "visibility", visible ? "visible" : "none");
  }, [map, data, visible, maxVolume]);

  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* map may be destroyed */
      }
      addedRef.current = false;
    };
  }, [map]);

  return null;
}
