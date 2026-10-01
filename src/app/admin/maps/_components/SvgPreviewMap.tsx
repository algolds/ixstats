"use client";

/**
 * SvgPreviewMap - Renders a GeoJSON FeatureCollection on a MapLibre mini-map.
 * Used for previewing SVG upload results before committing.
 */

import { useEffect, useRef, useCallback } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { buildBaseStyle } from "~/lib/maps/map-config";
import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { loadMaplibre } from "~/lib/maps/load-maplibre";

/**
 * Fallback paint for features without their own SVG fill/stroke: the `gray` system colour and the
 * secondary label role, read from the theme at draw time (MapLibre paint cannot take CSS
 * variables). The literals only apply when no theme value resolves (tests, SSR).
 */
function resolveFallbackPaint(el: HTMLElement | null): { fill: string; stroke: string } {
  const style = el && typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
  const read = (name: string, fallback: string) => style?.getPropertyValue(name).trim() || fallback;
  return {
    fill: read("--color-gray", "#6b7280"),
    stroke: read("--color-label-secondary", "#52525b"),
  };
}

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
  const mapRef = useRef<MapLibreMap | null>(null);

  const initMap = useCallback(
    async (isCancelled: () => boolean) => {
      if (!containerRef.current || !geojson || geojson.features.length === 0) return;

      // Dynamic import for MapLibre (browser-only). maplibre-gl 6 is ESM-only,
      // so the module namespace itself carries the named exports (Map, Popup, …).
      const maplibregl = await loadMaplibre();
      await import("maplibre-gl/dist/maplibre-gl.css");
      // Unmounted (or geojson changed) while MapLibre was loading — don't create an orphan map.
      if (isCancelled() || !containerRef.current) return;

      // Clean up existing map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: buildBaseStyle() as any,
        center: [10, 5],
        zoom: 1.5,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        if (isCancelled()) return;
        const fallback = resolveFallbackPaint(containerRef.current);
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
            "fill-color": ["coalesce", ["get", "fill"], fallback.fill],
            "fill-opacity": 0.85,
          },
        });

        // Outline layer — uses per-feature stroke color from SVG
        map.addLayer({
          id: "preview-outline",
          type: "line",
          source: "preview-data",
          paint: {
            "line-color": ["coalesce", ["get", "stroke"], fallback.stroke],
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
    },
    [geojson]
  );

  useEffect(() => {
    let cancelled = false;
    void initMap(() => cancelled);
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initMap]);

  if (!geojson) {
    return <Skeleton className={`rounded-control w-full ${className}`} style={{ height }} />;
  }

  return (
    <div
      ref={containerRef}
      className={`border-separator rounded-control w-full border ${className}`}
      style={{ height }}
    />
  );
}
