/**
 * Pure geometric and spatial calculation utilities for the Map Editor.
 */

import { union } from "@turf/union";
import { difference } from "@turf/difference";
import { featureCollection } from "@turf/helpers";
import { simplify } from "@turf/simplify";
import { area } from "@turf/area";
import { buffer } from "@turf/buffer";
import type { FeatureCollection } from "geojson";

const isValidRing = (ring: unknown) => Array.isArray(ring) && ring.length >= 4;

/** Drop rings with fewer than 4 positions (and polygons left without rings); null if nothing is left. */
export function cleanPolygonGeometry(geometry: any): any {
  if (!geometry || typeof geometry !== "object") return null;

  if (geometry.type === "Polygon") {
    const coordinates = (geometry.coordinates || []).filter(isValidRing);
    return coordinates.length > 0 ? { type: "Polygon", coordinates } : null;
  }

  if (geometry.type === "MultiPolygon") {
    const coordinates = (geometry.coordinates || [])
      .map((poly: any[]) => (poly || []).filter(isValidRing))
      .filter((poly: any[]) => poly.length > 0);
    return coordinates.length > 0 ? { type: "MultiPolygon", coordinates } : null;
  }

  return null;
}

const isDegeneratePolygonError = (err: unknown) =>
  err instanceof Error && /fewer than 4 points|invalid polygon/i.test(err.message);

/** Simplify a feature and clean its geometry; the input comes back if either step fails. */
function simplifyAndClean(feature: any, label: string): any {
  try {
    const simplified = simplify(feature, { tolerance: 0.0001, highQuality: false });
    const cleaned = cleanPolygonGeometry(simplified?.geometry);
    return cleaned ? { ...simplified, geometry: cleaned } : feature;
  } catch (err) {
    if (!isDegeneratePolygonError(err)) console.warn(`Failed to simplify ${label} geometry:`, err);
    return feature;
  }
}

/** Union of the subdivision polygons; geometries that fail to merge are skipped. */
function unionSubdivisions(subdivisions: any[]): any {
  let unionFeature: any = null;
  for (const sub of subdivisions) {
    const subFeature = { type: "Feature" as const, geometry: sub.geometry!, properties: {} };
    if (!unionFeature) {
      unionFeature = subFeature;
      continue;
    }
    try {
      const merged = union(featureCollection([unionFeature, subFeature]));
      const cleanedMerged = merged && cleanPolygonGeometry(merged.geometry);
      if (cleanedMerged) unionFeature = { ...merged, geometry: cleanedMerged };
    } catch (err) {
      console.warn("Error unioning subdivision geometry:", err);
    }
  }
  return unionFeature;
}

/** The part of the country not covered by any subdivision (null when none or on failure). */
export function calculateNegativeSpaceGaps(
  countryFeature: any,
  subdivisions: any[]
): FeatureCollection | null {
  if (!countryFeature?.geometry) return null;

  const validSubs = (subdivisions || []).filter(
    (s) => s.geometry && (s.geometry.type === "Polygon" || s.geometry.type === "MultiPolygon")
  );
  const unionFeature = validSubs.length > 0 ? unionSubdivisions(validSubs) : null;
  if (!unionFeature) return featureCollection([countryFeature]);

  try {
    const gap = difference(
      featureCollection([
        simplifyAndClean(countryFeature, "country"),
        simplifyAndClean(unionFeature, "union"),
      ])
    );
    const cleanedGapGeom = gap && cleanPolygonGeometry(gap.geometry);
    if (!gap || !cleanedGapGeom) return null;

    // One feature per gap polygon
    return cleanedGapGeom.type === "MultiPolygon"
      ? featureCollection(
          cleanedGapGeom.coordinates.map((coordinates: any) => ({
            type: "Feature" as const,
            geometry: { type: "Polygon" as const, coordinates },
            properties: {},
          }))
        )
      : featureCollection([{ ...gap, geometry: cleanedGapGeom }]);
  } catch (err) {
    console.warn("Error calculating difference gaps:", err);
  }

  return null;
}

export function splitPolygonByLine(polygon: any, lineCoords: [number, number][]) {
  if (lineCoords.length < 2) return null;
  const lineFeature = {
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: lineCoords,
    },
    properties: {},
  };

  const lineBuffered = buffer(lineFeature, 0.005, { units: "kilometers" });
  if (!lineBuffered) return null;

  const polyFeature = {
    type: "Feature" as const,
    geometry: polygon,
    properties: {},
  };

  try {
    const diff = difference(featureCollection([polyFeature, lineBuffered]));
    if (!diff) return null;

    const pieces: any[] = [];
    if (diff.geometry.type === "Polygon") {
      pieces.push(diff.geometry);
    } else if (diff.geometry.type === "MultiPolygon") {
      for (const coords of diff.geometry.coordinates) {
        const pieceGeom = { type: "Polygon" as const, coordinates: coords };
        const a = area(pieceGeom);
        if (a > 100) {
          pieces.push(pieceGeom);
        }
      }
    }
    return pieces;
  } catch (err) {
    console.error("Error splitting polygon:", err);
    return null;
  }
}
