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

export function cleanPolygonGeometry(geometry: any): any {
  if (!geometry || typeof geometry !== "object") return null;

  if (geometry.type === "Polygon") {
    const validRings = (geometry.coordinates || []).filter(
      (ring: any[]) => Array.isArray(ring) && ring.length >= 4
    );
    if (validRings.length === 0) return null;
    return {
      type: "Polygon",
      coordinates: validRings,
    };
  }

  if (geometry.type === "MultiPolygon") {
    const validPolys = (geometry.coordinates || [])
      .map((poly: any[]) =>
        (poly || []).filter((ring: any[]) => Array.isArray(ring) && ring.length >= 4)
      )
      .filter((poly: any[]) => poly.length > 0);
    if (validPolys.length === 0) return null;
    return {
      type: "MultiPolygon",
      coordinates: validPolys,
    };
  }

  return null;
}

export function calculateNegativeSpaceGaps(
  countryFeature: any,
  subdivisions: any[]
): FeatureCollection | null {
  if (!countryFeature || !countryFeature.geometry) return null;
  if (!subdivisions || subdivisions.length === 0) {
    return featureCollection([countryFeature]);
  }

  const validSubs = subdivisions.filter(
    (s) => s.geometry && (s.geometry.type === "Polygon" || s.geometry.type === "MultiPolygon")
  );

  if (validSubs.length === 0) {
    return featureCollection([countryFeature]);
  }

  let unionFeature: any = null;
  for (const sub of validSubs) {
    const subFeature = {
      type: "Feature" as const,
      geometry: sub.geometry!,
      properties: {},
    };
    if (!unionFeature) {
      unionFeature = subFeature;
    } else {
      try {
        const merged = union(featureCollection([unionFeature, subFeature]));
        if (merged) {
          const cleanedMerged = cleanPolygonGeometry(merged.geometry);
          if (cleanedMerged) {
            unionFeature = {
              ...merged,
              geometry: cleanedMerged,
            };
          }
        }
      } catch (err) {
        console.warn("Error unioning subdivision geometry:", err);
      }
    }
  }

  if (!unionFeature) {
    return featureCollection([countryFeature]);
  }

  let simplifiedCountry = countryFeature;
  let simplifiedUnion = unionFeature;

  const isDegeneratePolygonError = (err: unknown) =>
    err instanceof Error && /fewer than 4 points|invalid polygon/i.test(err.message);

  try {
    const simplified = simplify(countryFeature, { tolerance: 0.0001, highQuality: false });
    const cleaned = cleanPolygonGeometry(simplified?.geometry);
    if (cleaned) {
      simplifiedCountry = { ...simplified, geometry: cleaned };
    }
  } catch (err) {
    if (!isDegeneratePolygonError(err)) console.warn("Failed to simplify country geometry:", err);
  }

  try {
    const simplified = simplify(unionFeature, { tolerance: 0.0001, highQuality: false });
    const cleaned = cleanPolygonGeometry(simplified?.geometry);
    if (cleaned) {
      simplifiedUnion = { ...simplified, geometry: cleaned };
    }
  } catch (err) {
    if (!isDegeneratePolygonError(err)) console.warn("Failed to simplify union geometry:", err);
  }

  try {
    const gap = difference(featureCollection([simplifiedCountry, simplifiedUnion]));
    if (gap) {
      const cleanedGapGeom = cleanPolygonGeometry(gap.geometry);
      if (!cleanedGapGeom) return null;

      const cleanedGap = {
        ...gap,
        geometry: cleanedGapGeom,
      };

      if (cleanedGap.geometry.type === "MultiPolygon") {
        const polys = cleanedGap.geometry.coordinates.map((coords: any) => ({
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: coords,
          },
          properties: {},
        }));
        return featureCollection(polys);
      }
      return featureCollection([cleanedGap]);
    }
  } catch (err) {
    console.warn("Error calculating difference gaps:", err);
  }

  return null;
}

export function getNearestPointOnGeometryBoundary(
  pt: [number, number],
  geometry: any
): [number, number] {
  if (!geometry) return pt;
  let minDistance = Infinity;
  let nearestPoint: [number, number] = pt;

  const checkRing = (ring: [number, number][]) => {
    for (let i = 0; i < ring.length; i++) {
      const coord = ring[i]!;
      const dist = Math.hypot(coord[0] - pt[0], coord[1] - pt[1]);
      if (dist < minDistance) {
        minDistance = dist;
        nearestPoint = coord;
      }
    }
  };

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      checkRing(ring);
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) {
        checkRing(ring);
      }
    }
  }

  return nearestPoint;
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
