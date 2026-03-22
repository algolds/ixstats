"use client";

/**
 * GeopoliticalOverlay — Alliance groups, diplomatic relations, and military conflicts.
 *
 * - Diplomatic relation lines: green=friendly, yellow=neutral, red=hostile (thickness=strength)
 * - Conflict markers: red circles at midpoint between combatants
 */

import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";

const RELATIONS_SOURCE = "diplo-relations-source";
const RELATIONS_LAYER = "diplo-relations-line";
const CONFLICTS_SOURCE = "conflicts-source";
const CONFLICTS_LAYER = "conflicts-circle";

interface GeopoliticalOverlayProps {
  map: MapLibreMap | null;
  relations: FeatureCollection;
  conflicts: FeatureCollection;
  visible: boolean;
}

export function GeopoliticalOverlay({ map, relations, conflicts, visible }: GeopoliticalOverlayProps) {
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    // Diplomatic relations
    const relSource = map.getSource(RELATIONS_SOURCE);
    if (relSource && "setData" in relSource) {
      (relSource as any).setData(relations);
    } else if (!relSource) {
      map.addSource(RELATIONS_SOURCE, { type: "geojson", data: relations });
    }

    if (!map.getLayer(RELATIONS_LAYER)) {
      map.addLayer({
        id: RELATIONS_LAYER,
        type: "line",
        source: RELATIONS_SOURCE,
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["get", "strength"],
            0, 0.5,
            50, 2,
            100, 4,
          ],
          "line-opacity": 0.5,
          "line-dasharray": [4, 2],
        },
        layout: {
          "line-cap": "round",
        },
      });
    }

    // Conflict markers
    const confSource = map.getSource(CONFLICTS_SOURCE);
    if (confSource && "setData" in confSource) {
      (confSource as any).setData(conflicts);
    } else if (!confSource) {
      map.addSource(CONFLICTS_SOURCE, { type: "geojson", data: conflicts });
    }

    if (!map.getLayer(CONFLICTS_LAYER)) {
      map.addLayer({
        id: CONFLICTS_LAYER,
        type: "circle",
        source: CONFLICTS_SOURCE,
        paint: {
          "circle-radius": 8,
          "circle-color": "#dc2626",
          "circle-opacity": 0.9,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }

    const vis = visible ? "visible" : "none";
    map.setLayoutProperty(RELATIONS_LAYER, "visibility", vis);
    map.setLayoutProperty(CONFLICTS_LAYER, "visibility", vis);
  }, [map, relations, conflicts, visible]);

  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        if (map.getLayer(CONFLICTS_LAYER)) map.removeLayer(CONFLICTS_LAYER);
        if (map.getLayer(RELATIONS_LAYER)) map.removeLayer(RELATIONS_LAYER);
        if (map.getSource(CONFLICTS_SOURCE)) map.removeSource(CONFLICTS_SOURCE);
        if (map.getSource(RELATIONS_SOURCE)) map.removeSource(RELATIONS_SOURCE);
      } catch { /* map may be destroyed */ }
    };
  }, [map]);

  return null;
}
