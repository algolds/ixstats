"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Feature, Polygon, MultiPolygon, Position } from "geojson";
import type { ProvinceFeature } from "~/lib/maps/province-importer/types";
import { getAllRings } from "~/lib/maps/border-editor";
import {
  collection,
  pointFeature,
  upsertGeoJSONLayers,
  type SourcelessLayer,
} from "../utils/map-helpers";

interface ProvincePreviewLayerProps {
  map: MapLibreMap | null;
  provinces: ProvinceFeature[];
  countryBorder: Polygon | MultiPolygon | null;
  visible: boolean;
  cities?: Array<{ name: string; lat: number; lng: number; isCapital: boolean }>;
}

type Geom = Polygon | MultiPolygon;

interface Overlay {
  sourceId: string;
  /** Bottom to top. */
  layers: SourcelessLayer[];
}

const LABEL_PAINT = {
  "text-color": "#1e293b",
  "text-halo-color": "#ffffff",
  "text-halo-width": 1.5,
};

const PROVINCES: Overlay = {
  sourceId: "province-import-preview",
  layers: [
    // A fixed visible colour: the SVG fill may be near-white or grey.
    {
      id: "province-import-fill",
      type: "fill",
      paint: { "fill-color": "#f59e0b", "fill-opacity": 0.2 },
    },
    {
      id: "province-import-line",
      type: "line",
      paint: { "line-color": "#ef4444", "line-width": 2.5, "line-opacity": 1.0 },
    },
    {
      id: "province-import-label",
      type: "symbol",
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-anchor": "center",
        "text-allow-overlap": false,
      },
      paint: LABEL_PAINT,
    },
  ],
};

// Bright outline so the user can see how provinces align to the existing territory.
const COUNTRY_BORDER: Overlay = {
  sourceId: "province-import-country-border",
  layers: [
    {
      id: "province-import-border-fill",
      type: "fill",
      paint: { "fill-color": "#22c55e", "fill-opacity": 0.05 },
    },
    {
      id: "province-import-border-line",
      type: "line",
      paint: {
        "line-color": "#22c55e",
        "line-width": 3,
        "line-dasharray": [6, 4],
        "line-opacity": 0.8,
      },
    },
  ],
};

const CITIES: Overlay = {
  sourceId: "province-import-preview-cities",
  layers: [
    {
      id: "province-import-preview-cities-circle",
      type: "circle",
      paint: {
        "circle-radius": 5,
        "circle-color": ["case", ["get", "isCapital"], "#ef4444", "#3b82f6"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: "province-import-preview-cities-label",
      type: "symbol",
      layout: {
        "text-field": ["get", "name"],
        "text-size": 10,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-allow-overlap": false,
      },
      paint: LABEL_PAINT,
    },
  ],
};

const OVERLAYS = [PROVINCES, COUNTRY_BORDER, CITIES];

function removeOverlay(map: MapLibreMap, { sourceId, layers }: Overlay) {
  for (const { id } of [...layers].reverse()) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function setOverlayVisibility(map: MapLibreMap, { layers }: Overlay, visible: boolean) {
  for (const { id } of layers) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

/** Updates the overlay's data (adding it, after clearing any stale leftovers, when missing). */
function syncOverlay(
  map: MapLibreMap,
  overlay: Overlay,
  data: FeatureCollection,
  visible: boolean
) {
  if (!map.getSource(overlay.sourceId)) removeOverlay(map, overlay);
  upsertGeoJSONLayers(map, overlay.sourceId, data, overlay.layers);
  setOverlayVisibility(map, overlay, visible);
}

/** Signed ring area (shoelace formula). Positive = CCW. */
function ringSignedArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
  }
  return area / 2;
}

/** GeoJSON RFC 7946 winding: outer ring CCW, holes CW. */
function normalizeRing(ring: Position[], index: number): Position[] {
  const area = ringSignedArea(ring);
  return (index === 0 ? area < 0 : area > 0) ? [...ring].reverse() : ring;
}

function mapRings(geom: Geom, fn: (ring: Position[], index: number) => Position[]): Geom {
  return geom.type === "Polygon"
    ? { type: "Polygon", coordinates: geom.coordinates.map(fn) }
    : { type: "MultiPolygon", coordinates: geom.coordinates.map((poly) => poly.map(fn)) };
}

function extentOf(geoms: Geom[]) {
  const extent = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const geom of geoms) {
    for (const [x, y] of getAllRings(geom).flat()) {
      extent.minX = Math.min(extent.minX, x!);
      extent.minY = Math.min(extent.minY, y!);
      extent.maxX = Math.max(extent.maxX, x!);
      extent.maxY = Math.max(extent.maxY, y!);
    }
  }
  return extent;
}

/** Fits SVG-space coordinates into the country's bounds (object-fit: contain, Y flipped). */
function svgToGeoTransform(svg: ReturnType<typeof extentOf>, geo: ReturnType<typeof extentOf>) {
  const svgW = svg.maxX - svg.minX || 1;
  const svgH = svg.maxY - svg.minY || 1;
  const geoW = geo.maxX - geo.minX;
  const geoH = geo.maxY - geo.minY;
  const scale = Math.min(geoW / svgW, geoH / svgH);
  const scaledW = svgW * scale;
  const scaledH = svgH * scale;
  const padX = (geoW - scaledW) / 2;
  const padY = (geoH - scaledH) / 2;

  return (pt: Position): Position => [
    geo.minX + padX + ((pt[0]! - svg.minX) / svgW) * scaledW,
    // SVG Y=0 is the top; geographic Y increases north.
    geo.maxY - padY - ((pt[1]! - svg.minY) / svgH) * scaledH,
  ];
}

/** The included provinces as a map-ready collection, projected into the country if they are in SVG space. */
function buildProvinceCollection(provinces: ProvinceFeature[], countryBorder: Geom | null) {
  const included = provinces.filter((p) => p.included);
  if (included.length === 0) return collection([]);

  // The extent covers every province (included or not): the full SVG.
  const svg = extentOf(provinces.map((p) => p.geometry));
  const isGeographic = svg.maxX <= 180 && svg.maxY <= 90 && svg.minX >= -180 && svg.minY >= -90;

  let toMap = (geom: Geom) => geom;
  if (!isGeographic) {
    const geo = countryBorder
      ? extentOf([countryBorder])
      : { minX: -10, minY: -10, maxX: 10, maxY: 10 };
    const transformPt = svgToGeoTransform(svg, geo);
    toMap = (geom) => mapRings(geom, (ring) => ring.map(transformPt));
  }

  return collection(
    included.map((p, i): Feature => ({
      type: "Feature",
      id: i,
      geometry: mapRings(toMap(p.geometry), normalizeRing),
      properties: { name: p.name, color: p.color || "#6366f1", sourceId: p.sourceId },
    }))
  );
}

/**
 * Renders imported provinces as a preview overlay on the MapLibre map, together with the
 * country border as a reference so users can see how provinces align to the territory.
 */
export const ProvincePreviewLayer = memo(function ProvincePreviewLayer({
  map,
  provinces,
  countryBorder,
  visible,
  cities,
}: ProvincePreviewLayerProps) {
  useEffect(() => {
    if (!map || !countryBorder) return;
    syncOverlay(
      map,
      COUNTRY_BORDER,
      collection([{ type: "Feature", geometry: countryBorder, properties: {} }]),
      visible
    );
  }, [map, countryBorder, visible]);

  const fc = useMemo(
    () => buildProvinceCollection(provinces, countryBorder),
    [provinces, countryBorder]
  );

  // Skips setData when the collection is unchanged (avoids expensive MapLibre updates).
  const prevFcKeyRef = useRef("");

  useEffect(() => {
    if (!map) return;

    const firstGeometry = fc.features[0]?.geometry as Geom | undefined;
    const firstCoord = firstGeometry && getAllRings(firstGeometry)[0]?.[0];
    const fcKey = `${fc.features.length}:${JSON.stringify(firstCoord ?? [])}`;
    if (prevFcKeyRef.current === fcKey && map.getSource(PROVINCES.sourceId)) {
      setOverlayVisibility(map, PROVINCES, visible);
      return;
    }
    prevFcKeyRef.current = fcKey;

    try {
      syncOverlay(map, PROVINCES, fc, visible);
    } catch (err) {
      console.error("[ProvincePreview] Error creating/updating layers:", err);
    }
    // oxlint-disable-next-line
  }, [map, fc, provinces, visible]);

  useEffect(() => {
    if (!map) return;
    try {
      const points = (cities ?? []).map((c, i) => ({
        ...pointFeature([c.lng, c.lat], { name: c.name, isCapital: c.isCapital }),
        id: i,
      }));
      syncOverlay(map, CITIES, collection(points), visible);
    } catch (err) {
      console.error("[ProvincePreview] Error rendering cities preview:", err);
    }
  }, [map, cities, visible]);

  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        for (const overlay of OVERLAYS) removeOverlay(map, overlay);
      } catch {
        // Map may already be destroyed
      }
    };
  }, [map]);

  return null; // Rendering is handled via MapLibre API
});
