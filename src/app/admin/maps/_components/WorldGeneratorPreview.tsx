"use client";

import React, { useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";
import type { FeatureCollection } from "geojson";
import { OCEAN_COLOR } from "~/lib/map-config";

interface WorldGeneratorPreviewProps {
  worldId: string | null;
  /** Direct layers data for immediate preview without DB fetch */
  directLayers?: Record<string, FeatureCollection> | null;
}

/**
 * Layer rendering order and paint configuration for the preview.
 * Altitude zones are the base terrain layer (high opacity, no gaps).
 * Climate is hidden by default (shares altitude geometry, toggle-able).
 * Political borders shown as subtle outlines over terrain.
 */
const PREVIEW_LAYERS = [
  {
    id: "altitudes",
    fillOpacity: 0.9,
    lineColor: "#666",
    lineWidth: 0.2,
    lineOpacity: 0.3,
  },
  {
    id: "climate",
    fillOpacity: 0, // Hidden — shares altitude geometry, toggle via UI if needed
    lineColor: "#666",
    lineWidth: 0,
    lineOpacity: 0,
  },
  {
    id: "icecaps",
    fillOpacity: 0.75,
    lineColor: "#ccd",
    lineWidth: 0.3,
    lineOpacity: 0.3,
  },
  {
    id: "lakes",
    fillOpacity: 0.7,
    lineColor: "#7cb5d2",
    lineWidth: 0.3,
    lineOpacity: 0.5,
  },
  {
    id: "rivers",
    fillOpacity: 0.5,
    lineColor: "#7cb5d2",
    lineWidth: 0.8,
    lineOpacity: 0.6,
  },
  {
    id: "political",
    fillOpacity: 0.15,
    lineColor: "#555",
    lineWidth: 1,
    lineOpacity: 0.7,
  },
] as const;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export const WorldGeneratorPreview = React.memo(function WorldGeneratorPreview({
  worldId,
  directLayers,
}: WorldGeneratorPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const sourcesReady = useRef(false);

  const { data } = api.geoEditor.getProceduralWorldPreview.useQuery(
    { worldId: worldId! },
    { enabled: !!worldId && !directLayers, refetchOnWindowFocus: false }
  );

  const layers = directLayers || (data?.layers as Record<string, FeatureCollection> | null);

  // Initialize map with pre-created empty sources for fast updates
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "bg",
            type: "background",
            paint: { "background-color": OCEAN_COLOR },
          },
        ],
      },
      center: [0, 20],
      zoom: 1.5,
      maxTileCacheSize: 50,
      fadeDuration: 0,
    });

    // Set the canvas background to match the ocean so no dark flash
    const canvas = containerRef.current.querySelector("canvas");
    if (canvas) canvas.style.background = OCEAN_COLOR;

    map.on("load", () => {
      // Pre-create sources and layers for each preview layer
      for (const layer of PREVIEW_LAYERS) {
        const sourceId = `gen-${layer.id}`;

        map.addSource(sourceId, { type: "geojson", data: EMPTY_FC });

        // Fill layer — uses per-feature "fill" property for color
        map.addLayer({
          id: `${sourceId}-fill`,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": ["coalesce", ["get", "fill"], "#888"],
            "fill-opacity": layer.fillOpacity,
          },
        });

        // Line layer — subtle outlines
        if (layer.lineWidth > 0) {
          map.addLayer({
            id: `${sourceId}-line`,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": layer.lineColor,
              "line-width": layer.lineWidth,
              "line-opacity": layer.lineOpacity,
            },
          });
        }
      }
      sourcesReady.current = true;
    });

    mapRef.current = map;

    return () => {
      sourcesReady.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update layer data — just setData on existing sources (fast)
  const updateMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !sourcesReady.current || !layers) return;

    for (const layer of PREVIEW_LAYERS) {
      const source = map.getSource(`gen-${layer.id}`) as maplibregl.GeoJSONSource | undefined;
      if (!source) continue;

      const fc = layers[layer.id];
      source.setData(fc ? (fc as GeoJSON.FeatureCollection) : EMPTY_FC);
    }
  }, [layers]);

  useEffect(() => {
    if (!layers) return;

    // If sources already ready, update immediately
    if (sourcesReady.current) {
      updateMap();
      return;
    }

    // Otherwise wait for map load
    const map = mapRef.current;
    if (!map) return;
    const handler = () => updateMap();
    map.on("load", handler);
    return () => {
      map.off("load", handler);
    };
  }, [layers, updateMap]);

  return (
    <div className="relative h-full w-full">
      {!layers && !directLayers && worldId && (
        <div className="bg-card/80 absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading preview...</span>
          </div>
        </div>
      )}
      {!worldId && !directLayers && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="text-muted-foreground/50 text-sm">Generate a world to see preview</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="bg-muted h-full w-full rounded-lg"
        style={{ minHeight: 400 }}
      />
    </div>
  );
});
