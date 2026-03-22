"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Feature, Polygon, MultiPolygon, Position } from "geojson";
import type { ProvinceFeature } from "~/lib/province-importer/types";

interface ProvincePreviewLayerProps {
  map: MapLibreMap | null;
  provinces: ProvinceFeature[];
  countryBorder: Polygon | MultiPolygon | null;
  visible: boolean;
}

const SOURCE_ID = "province-import-preview";
const FILL_LAYER_ID = "province-import-fill";
const LINE_LAYER_ID = "province-import-line";
const LABEL_LAYER_ID = "province-import-label";

const BORDER_SOURCE_ID = "province-import-country-border";
const BORDER_LINE_LAYER_ID = "province-import-border-line";
const BORDER_FILL_LAYER_ID = "province-import-border-fill";

/** Compute signed ring area (shoelace formula). Positive = CCW. */
function ringSignedArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
  }
  return area / 2;
}

/** Ensure outer ring is CCW and hole rings are CW per GeoJSON RFC 7946 */
function normalizePolygonWinding(coords: Position[][]): Position[][] {
  return coords.map((ring, i) => {
    const area = ringSignedArea(ring);
    const isOuter = i === 0;
    if (isOuter && area < 0) return ring.slice().reverse();
    if (!isOuter && area > 0) return ring.slice().reverse();
    return ring;
  });
}

/** Normalize geometry winding for valid GeoJSON rendering */
function normalizeGeometry(geom: Polygon | MultiPolygon): Polygon | MultiPolygon {
  if (geom.type === "Polygon") {
    return { type: "Polygon", coordinates: normalizePolygonWinding(geom.coordinates) };
  }
  return {
    type: "MultiPolygon",
    coordinates: geom.coordinates.map((poly) => normalizePolygonWinding(poly)),
  };
}

/**
 * Renders imported provinces as a preview overlay on the MapLibre map.
 * Also renders the country border as a reference so users can see
 * how provinces align to the existing territory.
 */
export const ProvincePreviewLayer = memo(function ProvincePreviewLayer({
  map,
  provinces,
  countryBorder,
  visible,
}: ProvincePreviewLayerProps) {
  // ── Country border reference layer ──
  useEffect(() => {
    if (!map || !countryBorder) return;

    const borderFc: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: countryBorder,
          properties: {},
        },
      ],
    };

    const source = map.getSource(BORDER_SOURCE_ID);
    if (source && "setData" in source) {
      (source as { setData: (data: FeatureCollection) => void }).setData(borderFc);
    } else {
      // Clean stale layers
      if (map.getLayer(BORDER_LINE_LAYER_ID)) map.removeLayer(BORDER_LINE_LAYER_ID);
      if (map.getLayer(BORDER_FILL_LAYER_ID)) map.removeLayer(BORDER_FILL_LAYER_ID);
      if (map.getSource(BORDER_SOURCE_ID)) map.removeSource(BORDER_SOURCE_ID);

      map.addSource(BORDER_SOURCE_ID, { type: "geojson", data: borderFc });

      // Translucent fill to show the country area
      map.addLayer({
        id: BORDER_FILL_LAYER_ID,
        type: "fill",
        source: BORDER_SOURCE_ID,
        paint: {
          "fill-color": "#f59e0b",
          "fill-opacity": 0.08,
        },
      });

      // Subtle dashed border outline (reference only)
      map.addLayer({
        id: BORDER_LINE_LAYER_ID,
        type: "line",
        source: BORDER_SOURCE_ID,
        paint: {
          "line-color": "#22c55e",
          "line-width": 2,
          "line-dasharray": [6, 4],
          "line-opacity": 0.6,
        },
      });
    }

    const vis = visible ? "visible" : "none";
    if (map.getLayer(BORDER_FILL_LAYER_ID)) map.setLayoutProperty(BORDER_FILL_LAYER_ID, "visibility", vis);
    if (map.getLayer(BORDER_LINE_LAYER_ID)) map.setLayoutProperty(BORDER_LINE_LAYER_ID, "visibility", vis);
  }, [map, countryBorder, visible]);

  // ── Memoized FeatureCollection — only recomputes when provinces change ──
  const fc = useMemo<FeatureCollection>(() => {
    const included = provinces.filter((p) => p.included);
    return {
      type: "FeatureCollection",
      features: included.map(
        (p, i): Feature => ({
          type: "Feature",
          id: i,
          geometry: normalizeGeometry(p.geometry),
          properties: {
            name: p.name,
            color: p.color || "#6366f1",
            sourceId: p.sourceId,
          },
        })
      ),
    };
  }, [provinces]);

  // Track previous feature count to avoid unnecessary MapLibre updates
  const prevFcRef = useRef<string>("");

  // ── Province preview layers ──
  useEffect(() => {
    if (!map) return;

    // Skip if data hasn't actually changed (avoids expensive setData calls)
    const fcKey = `${fc.features.length}:${provinces.length}`;
    if (prevFcRef.current === fcKey && map.getSource(SOURCE_ID)) {
      // Just update visibility
      const vis = visible ? "visible" : "none";
      if (map.getLayer(FILL_LAYER_ID)) map.setLayoutProperty(FILL_LAYER_ID, "visibility", vis);
      if (map.getLayer(LINE_LAYER_ID)) map.setLayoutProperty(LINE_LAYER_ID, "visibility", vis);
      if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, "visibility", vis);
      return;
    }
    prevFcRef.current = fcKey;

    // Add or update source
    try {
      const source = map.getSource(SOURCE_ID);
      if (source && "setData" in source) {
        (source as { setData: (data: FeatureCollection) => void }).setData(fc);
      } else {
        // Clean up any stale layers first
        if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

        map.addSource(SOURCE_ID, { type: "geojson", data: fc });

        map.addLayer({
          id: FILL_LAYER_ID,
          type: "fill",
          source: SOURCE_ID,
          paint: {
            "fill-color": ["coalesce", ["get", "color"], "#6366f1"],
            "fill-opacity": 0.25,
          },
        });

        map.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": "#6366f1",
            "line-width": 1.5,
            "line-dasharray": [3, 2],
            "line-opacity": 0.7,
          },
        });

        map.addLayer({
          id: LABEL_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-anchor": "center",
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#1e293b",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });

        console.log("[ProvincePreview] Created source + 3 layers (fill, line, label)");
      }
    } catch (err) {
      console.error("[ProvincePreview] Error creating/updating layers:", err);
    }

    // Visibility
    const vis = visible ? "visible" : "none";
    if (map.getLayer(FILL_LAYER_ID)) map.setLayoutProperty(FILL_LAYER_ID, "visibility", vis);
    if (map.getLayer(LINE_LAYER_ID)) map.setLayoutProperty(LINE_LAYER_ID, "visibility", vis);
    if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, "visibility", vis);
  }, [map, provinces, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        if (map.getLayer(BORDER_LINE_LAYER_ID)) map.removeLayer(BORDER_LINE_LAYER_ID);
        if (map.getLayer(BORDER_FILL_LAYER_ID)) map.removeLayer(BORDER_FILL_LAYER_ID);
        if (map.getSource(BORDER_SOURCE_ID)) map.removeSource(BORDER_SOURCE_ID);
      } catch {
        // Map may already be destroyed
      }
    };
  }, [map]);

  return null; // Rendering is handled via MapLibre API
});
