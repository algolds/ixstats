// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { Geometry, Position, Feature, Polygon, MultiPolygon } from "geojson";
import { intersect } from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import {
  getAllRings,
  rebuildGeometry,
  projectPointToSegment,
  distanceDeg,
} from "~/lib/border-editor";

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

/**
 * Snap a coordinate point to visible background features (rivers, lakes, elevation contour, climate zones).
 */
export function snapToLayerFeatures(
  point: [number, number],
  worldMapLayers: any[] | undefined,
  visibleLayers: Set<string>,
  tolerance: number = 0.015
): [number, number] {
  if (!worldMapLayers) return point;

  let bestDist = Infinity;
  let bestProj: [number, number] = point;

  const targetLayerTypes = ["rivers", "lakes", "altitudes", "climate"];

  for (const layerType of targetLayerTypes) {
    if (!visibleLayers.has(layerType)) continue;

    const layer = worldMapLayers.find((l) => l.type === layerType);
    if (!layer || !layer.data || !layer.data.features) continue;

    for (const feature of layer.data.features) {
      const geom = feature.geometry;
      if (!geom) continue;

      if (geom.type === "LineString") {
        const coords = geom.coordinates;
        for (let i = 0; i < coords.length - 1; i++) {
          const proj = projectPointToSegment(
            point,
            coords[i] as Position,
            coords[i + 1] as Position
          );
          const d = distanceDeg(point, proj);
          if (d < bestDist && d <= tolerance) {
            bestDist = d;
            bestProj = proj as [number, number];
          }
        }
      } else if (geom.type === "MultiLineString") {
        for (const line of geom.coordinates) {
          for (let i = 0; i < line.length - 1; i++) {
            const proj = projectPointToSegment(point, line[i] as Position, line[i + 1] as Position);
            const d = distanceDeg(point, proj);
            if (d < bestDist && d <= tolerance) {
              bestDist = d;
              bestProj = proj as [number, number];
            }
          }
        }
      } else if (geom.type === "Polygon") {
        for (const ring of geom.coordinates) {
          for (let i = 0; i < ring.length - 1; i++) {
            const proj = projectPointToSegment(point, ring[i] as Position, ring[i + 1] as Position);
            const d = distanceDeg(point, proj);
            if (d < bestDist && d <= tolerance) {
              bestDist = d;
              bestProj = proj as [number, number];
            }
          }
        }
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
          for (const ring of poly) {
            for (let i = 0; i < ring.length - 1; i++) {
              const proj = projectPointToSegment(
                point,
                ring[i] as Position,
                ring[i + 1] as Position
              );
              const d = distanceDeg(point, proj);
              if (d < bestDist && d <= tolerance) {
                bestDist = d;
                bestProj = proj as [number, number];
              }
            }
          }
        }
      }
    }
  }

  return bestDist <= tolerance ? bestProj : point;
}

/**
 * Snap all rings/vertices of a polygon geometry to visible background layers.
 */
export function snapGeometryToBackgroundLayers(
  geometry: Polygon | MultiPolygon,
  worldMapLayers: any[] | undefined,
  visibleLayers: Set<string>,
  tolerance: number = 0.015
): Polygon | MultiPolygon {
  if (!worldMapLayers || !visibleLayers || visibleLayers.size === 0) return geometry;

  const rings = getAllRings(geometry);
  const newRings: Position[][] = [];

  for (const ring of rings) {
    const newRing: Position[] = [];
    for (const pt of ring) {
      const snapped = snapToLayerFeatures(
        pt as [number, number],
        worldMapLayers,
        visibleLayers,
        tolerance
      );
      newRing.push(snapped);
    }
    if (newRing.length > 0) {
      const first = newRing[0]!;
      const last = newRing[newRing.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) {
        newRing.push([...first] as Position);
      }
    }
    newRings.push(newRing);
  }

  return rebuildGeometry(geometry, newRings);
}
