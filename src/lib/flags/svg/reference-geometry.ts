/**
 * Reference GeoJSON helpers: feature centroids for calibration and exact
 * geometry reuse for features that already exist in the reference layer.
 */

import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { calculateApproxArea } from "./topology-flattener";

export interface ReferenceGeometry {
  geometry: Polygon | MultiPolygon;
  centroid: [number, number];
  bbox: [number, number, number, number];
  area: number;
}

function referenceFeatureId(feat: Feature): string {
  return String(feat.properties?.id ?? feat.id ?? "");
}

type NestedCoordinates = number | NestedCoordinates[];

/**
 * Recursively collect every [x, y, ...] position in a GeoJSON coordinates array.
 */
function flattenCoordinates(value: NestedCoordinates): [number, number][] {
  const coords: [number, number][] = [];
  const visit = (arr: NestedCoordinates): void => {
    if (!Array.isArray(arr)) return;
    if (arr.length >= 2 && typeof arr[0] === "number" && typeof arr[1] === "number") {
      coords.push(arr as [number, number]);
      return;
    }
    for (const item of arr) visit(item);
  };
  visit(value);
  return coords;
}

function averagePosition(coords: [number, number][]): [number, number] {
  const avgLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [avgLng, avgLat];
}

function boundsOf(coords: [number, number][]): [number, number, number, number] {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Reference feature CENTROIDS by ID. Centroids are ring-start-invariant (unlike
 * the first coordinate, which differs between SVG and GeoJSON because rings can
 * start at any vertex).
 */
export function buildReferenceCentroids(
  reference: FeatureCollection
): Map<string, [number, number]> {
  const refCentroids = new Map<string, [number, number]>();
  for (const feat of reference.features) {
    const fid = referenceFeatureId(feat);
    if (!fid || !feat.geometry || !("coordinates" in feat.geometry)) continue;
    const allCoords = flattenCoordinates(feat.geometry.coordinates);
    if (allCoords.length > 0) {
      refCentroids.set(fid, averagePosition(allCoords));
    }
  }
  return refCentroids;
}

/**
 * Exact reference geometry (with centroid, bbox and area) by feature ID. The SVG is
 * still used for feature discovery, colors, and names.
 */
export function buildReferenceGeometryMap(
  reference: FeatureCollection | undefined,
  log: string[]
): Map<string, ReferenceGeometry> {
  const refGeometryMap = new Map<string, ReferenceGeometry>();
  if (!reference) return refGeometryMap;

  for (const feat of reference.features) {
    const fid = referenceFeatureId(feat);
    if (!fid || !feat.geometry || !("coordinates" in feat.geometry)) continue;
    const geom = feat.geometry as Polygon | MultiPolygon;
    const allCoords = flattenCoordinates(geom.coordinates);
    if (allCoords.length === 0) continue;
    // Approximate area using the reference rings
    const refRings =
      geom.type === "Polygon"
        ? (geom.coordinates as Position[][])
        : (geom.coordinates as Position[][][]).flat();
    refGeometryMap.set(fid, {
      geometry: geom,
      centroid: averagePosition(allCoords),
      bbox: boundsOf(allCoords),
      area: calculateApproxArea(refRings as [number, number][][]),
    });
  }
  log.push(`Reference geometry available for ${refGeometryMap.size} features`);
  return refGeometryMap;
}
