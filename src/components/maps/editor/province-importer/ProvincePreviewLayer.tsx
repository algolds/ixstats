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
  // Debug mount
  console.log("[ProvincePreview] MOUNTED", {
    hasMap: !!map,
    provinceCount: provinces.length,
    includedCount: provinces.filter((p) => p.included).length,
    hasBorder: !!countryBorder,
    visible,
  });

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

      // Country border reference — bright outline so user can see alignment
      map.addLayer({
        id: BORDER_FILL_LAYER_ID,
        type: "fill",
        source: BORDER_SOURCE_ID,
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.05,
        },
      });

      map.addLayer({
        id: BORDER_LINE_LAYER_ID,
        type: "line",
        source: BORDER_SOURCE_ID,
        paint: {
          "line-color": "#22c55e",
          "line-width": 3,
          "line-dasharray": [6, 4],
          "line-opacity": 0.8,
        },
      });
    }

    const vis = visible ? "visible" : "none";
    if (map.getLayer(BORDER_FILL_LAYER_ID))
      map.setLayoutProperty(BORDER_FILL_LAYER_ID, "visibility", vis);
    if (map.getLayer(BORDER_LINE_LAYER_ID))
      map.setLayoutProperty(BORDER_LINE_LAYER_ID, "visibility", vis);
  }, [map, countryBorder, visible]);

  // ── Memoized FeatureCollection — only recomputes when provinces change ──
  const fc = useMemo<FeatureCollection>(() => {
    const included = provinces.filter((p) => p.included);
    if (included.length === 0) return { type: "FeatureCollection", features: [] };

    // Compute bounding box of ALL province shapes (included + excluded for full SVG extent)
    let svgMinX = Infinity,
      svgMinY = Infinity,
      svgMaxX = -Infinity,
      svgMaxY = -Infinity;
    for (const p of provinces) {
      const coords =
        p.geometry.type === "Polygon"
          ? p.geometry.coordinates
          : p.geometry.coordinates.flatMap((c) => c);
      for (const ring of coords) {
        for (const pt of ring) {
          svgMinX = Math.min(svgMinX, pt[0]!);
          svgMinY = Math.min(svgMinY, pt[1]!);
          svgMaxX = Math.max(svgMaxX, pt[0]!);
          svgMaxY = Math.max(svgMaxY, pt[1]!);
        }
      }
    }

    // Detect if provinces are in SVG coordinates (outside WGS84 range)
    const needsTransform = svgMaxX > 180 || svgMaxY > 90 || svgMinX < -180 || svgMinY < -90;

    console.log("[ProvincePreview] FC computation:", {
      includedCount: included.length,
      svgBounds: {
        svgMinX: svgMinX.toFixed(2),
        svgMinY: svgMinY.toFixed(2),
        svgMaxX: svgMaxX.toFixed(2),
        svgMaxY: svgMaxY.toFixed(2),
      },
      needsTransform,
      hasBorder: !!countryBorder,
    });

    if (!needsTransform) {
      // Already in geographic coordinates — pass through
      console.log("[ProvincePreview] Passthrough mode (coords already geographic)");
      return {
        type: "FeatureCollection",
        features: included.map(
          (p, i): Feature => ({
            type: "Feature",
            id: i,
            geometry: normalizeGeometry(p.geometry),
            properties: { name: p.name, color: p.color || "#6366f1", sourceId: p.sourceId },
          })
        ),
      };
    }

    // Compute country border bounding box as target
    let geoMinX = -10,
      geoMinY = -10,
      geoMaxX = 10,
      geoMaxY = 10;
    if (countryBorder) {
      geoMinX = Infinity;
      geoMinY = Infinity;
      geoMaxX = -Infinity;
      geoMaxY = -Infinity;
      const borderCoords =
        countryBorder.type === "Polygon"
          ? countryBorder.coordinates
          : countryBorder.coordinates.flatMap((c) => c);
      for (const ring of borderCoords) {
        for (const pt of ring) {
          geoMinX = Math.min(geoMinX, pt[0]!);
          geoMinY = Math.min(geoMinY, pt[1]!);
          geoMaxX = Math.max(geoMaxX, pt[0]!);
          geoMaxY = Math.max(geoMaxY, pt[1]!);
        }
      }
    }

    const svgW = svgMaxX - svgMinX || 1;
    const svgH = svgMaxY - svgMinY || 1;
    const geoW = geoMaxX - geoMinX;
    const geoH = geoMaxY - geoMinY;

    // Aspect-ratio-preserving fit (object-fit: contain)
    // Pick the smaller scale to fit without distortion
    const scale = Math.min(geoW / svgW, geoH / svgH);
    const scaledW = svgW * scale;
    const scaledH = svgH * scale;
    // Center the scaled content within the country bounds
    const padX = (geoW - scaledW) / 2;
    const padY = (geoH - scaledH) / 2;

    const transformPt = (pt: Position): Position => {
      // Normalize point to 0-1 within SVG bounds
      const nx = (pt[0]! - svgMinX) / svgW;
      const ny = (pt[1]! - svgMinY) / svgH;
      // Map to geographic coords, flipping Y (SVG Y=0 is top, geo Y increases north)
      const geoX = geoMinX + padX + nx * scaledW;
      const geoY = geoMaxY - padY - ny * scaledH;
      return [geoX, geoY];
    };

    const transformRing = (ring: Position[]): Position[] => ring.map(transformPt);
    const transformGeom = (geom: Polygon | MultiPolygon): Polygon | MultiPolygon => {
      if (geom.type === "Polygon") {
        return { type: "Polygon", coordinates: geom.coordinates.map(transformRing) };
      }
      return {
        type: "MultiPolygon",
        coordinates: geom.coordinates.map((poly) => poly.map(transformRing)),
      };
    };

    return {
      type: "FeatureCollection",
      features: included.map(
        (p, i): Feature => ({
          type: "Feature",
          id: i,
          geometry: normalizeGeometry(transformGeom(p.geometry)),
          properties: {
            name: p.name,
            color: p.color || "#6366f1",
            sourceId: p.sourceId,
          },
        })
      ),
    };
  }, [provinces, countryBorder]);

  // Track previous feature count to avoid unnecessary MapLibre updates
  const prevFcRef = useRef<string>("");

  // ── Province preview layers ──
  useEffect(() => {
    if (!map) return;

    // Skip if data hasn't actually changed (avoids expensive setData calls)
    const firstCoord =
      fc.features[0]?.geometry?.type === "Polygon"
        ? (fc.features[0].geometry as any).coordinates?.[0]?.[0]
        : (fc.features[0]?.geometry as any)?.coordinates?.[0]?.[0]?.[0];
    const fcKey = `${fc.features.length}:${JSON.stringify(firstCoord ?? [])}`;
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

        // Add layers at the TOP of the layer stack so they render above
        // the editor country fill/mask layers.
        // Use a fixed visible color (not the SVG fill which may be near-white/grey)
        map.addLayer({
          id: FILL_LAYER_ID,
          type: "fill",
          source: SOURCE_ID,
          paint: {
            "fill-color": "#f59e0b",
            "fill-opacity": 0.2,
          },
        });

        map.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": "#ef4444",
            "line-width": 2.5,
            "line-opacity": 1.0,
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

        // Log bounds for debugging
        const bounds = fc.features.reduce(
          (acc, f) => {
            const geom = f.geometry as any;
            const coords =
              geom.type === "Polygon"
                ? geom.coordinates
                : (geom.coordinates?.flatMap((c: any) => c) ?? []);
            for (const ring of coords) {
              for (const pt of ring as Position[]) {
                acc.minLng = Math.min(acc.minLng, pt[0]!);
                acc.minLat = Math.min(acc.minLat, pt[1]!);
                acc.maxLng = Math.max(acc.maxLng, pt[0]!);
                acc.maxLat = Math.max(acc.maxLat, pt[1]!);
              }
            }
            return acc;
          },
          { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity }
        );
        console.log(
          `[ProvincePreview] Created ${fc.features.length} features, bounds: lng ${bounds.minLng.toFixed(2)}-${bounds.maxLng.toFixed(2)}, lat ${bounds.minLat.toFixed(2)}-${bounds.maxLat.toFixed(2)}`
        );
      }
    } catch (err) {
      console.error("[ProvincePreview] Error creating/updating layers:", err);
    }

    // Visibility
    const vis = visible ? "visible" : "none";
    if (map.getLayer(FILL_LAYER_ID)) map.setLayoutProperty(FILL_LAYER_ID, "visibility", vis);
    if (map.getLayer(LINE_LAYER_ID)) map.setLayoutProperty(LINE_LAYER_ID, "visibility", vis);
    if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, "visibility", vis);
  }, [map, fc, provinces, visible]);

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
