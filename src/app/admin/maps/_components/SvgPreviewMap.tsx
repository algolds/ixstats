"use client";

/**
 * SvgPreviewMap - Renders a GeoJSON FeatureCollection on a MapLibre mini-map.
 * Used for previewing SVG upload results before committing.
 */

import { useEffect, useRef, useCallback } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { buildBaseStyle } from "~/lib/map-config";
import type { FeatureCollection } from "geojson";

interface SvgPreviewMapProps {
  geojson: FeatureCollection | null;
  layerType: string;
  height?: string;
  className?: string;
}

export function SvgPreviewMap({
  geojson,
  layerType: _layerType,
  height = "400px",
  className = "",
}: SvgPreviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const initMap = useCallback(async () => {
    if (!containerRef.current || !geojson || geojson.features.length === 0) return;

    // Dynamic import for MapLibre (browser-only)
    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    // Clean up existing map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBaseStyle(),
      center: [10, 5],
      zoom: 1.5,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      // Add preview source
      map.addSource("preview-data", {
        type: "geojson",
        data: geojson,
      });

      // Fill layer — uses per-feature fill color from SVG
      map.addLayer({
        id: "preview-fill",
        type: "fill",
        source: "preview-data",
        paint: {
          "fill-color": ["coalesce", ["get", "fill"], "#94a3b8"],
          "fill-opacity": 0.85,
        },
      });

      // Outline layer — uses per-feature stroke color from SVG
      map.addLayer({
        id: "preview-outline",
        type: "line",
        source: "preview-data",
        paint: {
          "line-color": ["coalesce", ["get", "stroke"], "#334155"],
          "line-width": 0.5,
        },
      });

      // Fit to data bounds (clamp to valid WGS84 range)
      const bounds = new maplibregl.LngLatBounds();
      let hasCoords = false;

      for (const feature of geojson.features) {
        const addCoords = (coords: unknown): void => {
          if (!Array.isArray(coords)) return;
          if (
            coords.length >= 2 &&
            typeof coords[0] === "number" &&
            typeof coords[1] === "number"
          ) {
            const lng = Math.max(-180, Math.min(180, coords[0] as number));
            const lat = Math.max(-90, Math.min(90, coords[1] as number));
            bounds.extend([lng, lat]);
            hasCoords = true;
            return;
          }
          for (const c of coords) addCoords(c);
        };
        if (feature.geometry && "coordinates" in feature.geometry) {
          addCoords(feature.geometry.coordinates);
        }
      }

      if (hasCoords) {
        map.fitBounds(bounds, { padding: 40, maxZoom: 8 });
      }
    });
  }, [geojson]);

  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initMap]);

  if (!geojson) {
    return <Skeleton className={`w-full rounded-lg ${className}`} style={{ height }} />;
  }

  return (
    <div
      ref={containerRef}
      className={`border-border w-full rounded-lg border ${className}`}
      style={{ height }}
    />
  );
}
