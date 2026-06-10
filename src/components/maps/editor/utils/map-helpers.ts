// @ts-nocheck
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { Geometry, Position, Feature } from "geojson";
import { intersect, featureCollection } from "@turf/turf";

export const EMPTY_FC = { type: "FeatureCollection" as const, features: [] as Feature[] };

export const SNAP_GUIDE_SOURCE = "editor-snap-guide";
export const SNAP_GUIDE_LAYER = "editor-snap-guide-line";
export const SNAP_GUIDE_POINT_LAYER = "editor-snap-guide-point";

/**
 * Helper to get a typed GeoJSON source from the map
 */
export function getGeoJSONSource(map: MapLibreMap | null, id: string): GeoJSONSource | undefined {
  if (!map) return;
  try {
    return map.getSource(id) as GeoJSONSource;
  } catch {
    return undefined;
  }
}

/**
 * Helper to safely extract coordinates from a feature's geometry
 */
export function getFeatureCoords(geometry: Geometry): Position | undefined {
  if (geometry.type === "Point") return geometry.coordinates;
  if (geometry.type === "MultiPoint") return geometry.coordinates[0];
  return undefined;
}

/**
 * Calculate overlap GeoJSON between a drawn geometry and other subdivisions
 */
export function calculateOverlapGeoJson(
  drawnGeom: any,
  allFeatures: any[],
  currentFeatureId?: string
) {
  if (!drawnGeom || !drawnGeom.coordinates || drawnGeom.coordinates.length === 0) {
    return EMPTY_FC;
  }

  const overlapFeatures: any[] = [];
  try {
    const turfDrawn =
      drawnGeom.type === "Feature"
        ? drawnGeom
        : {
            type: "Feature",
            geometry: drawnGeom,
            properties: {},
          };

    const otherSubdivisions = allFeatures.filter(
      (f) =>
        f.type === "subdivision" &&
        f.id !== currentFeatureId &&
        f.geometry &&
        (f.geometry as any).coordinates &&
        (f.geometry as any).coordinates.length > 0
    );

    for (const sub of otherSubdivisions) {
      const subGeom = sub.geometry;
      const turfSub = {
        type: "Feature",
        geometry: subGeom,
        properties: {},
      };

      const intersection = intersect(featureCollection([turfDrawn, turfSub]));
      if (intersection && intersection.geometry) {
        overlapFeatures.push(intersection);
      }
    }
  } catch (err) {
    console.warn("[calculateOverlapGeoJson] Error calculating turf overlap:", err);
  }

  return {
    type: "FeatureCollection" as const,
    features: overlapFeatures,
  };
}

/**
 * Show/hide a snap guide line between drag origin and snap target
 */
export function updateSnapGuide(map: MapLibreMap, from: Position | null, to: Position | null) {
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features:
      from && to
        ? [
            {
              type: "Feature",
              geometry: { type: "LineString", coordinates: [from, to] },
              properties: {},
            },
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: to },
              properties: {},
            },
          ]
        : [],
  };

  const source = map.getSource(SNAP_GUIDE_SOURCE);
  if (source && "setData" in source) {
    (source as GeoJSONSource).setData(fc);
  } else {
    map.addSource(SNAP_GUIDE_SOURCE, { type: "geojson", data: fc });
    map.addLayer({
      id: SNAP_GUIDE_LAYER,
      type: "line",
      source: SNAP_GUIDE_SOURCE,
      paint: {
        "line-color": "#06b6d4",
        "line-width": 1.5,
        "line-dasharray": [3, 3],
        "line-opacity": 0.8,
      },
    });
    map.addLayer({
      id: SNAP_GUIDE_POINT_LAYER,
      type: "circle",
      source: SNAP_GUIDE_SOURCE,
      filter: ["==", "$type", "Point"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#06b6d4",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.9,
      },
    });
  }
}

/**
 * Calculate distance between two points in kilometers using haversine formula
 */
export function haversineDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const dLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1[1] * Math.PI) / 180) *
      Math.cos((coord2[1] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
