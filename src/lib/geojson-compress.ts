/**
 * GeoJSON compression utilities for reducing map data transfer size.
 *
 * Applies three transformations:
 * 1. Geometry simplification (turf.simplify — Visvalingam-Whyatt)
 * 2. Coordinate precision truncation (e.g. 20dp → 4dp)
 * 3. Consecutive duplicate point removal
 */

import { simplify } from "@turf/simplify";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

// ── Coordinate truncation + pole clamping ──────────

/** Max latitude — 90° is fine for globe projection; MapLibre clamps internally for Mercator. */
const MAX_LAT = 90;

function truncCoord(n: number, factor: number): number {
  return Math.round(n * factor) / factor;
}

function truncPosition(p: Position, factor: number): Position {
  const lng = truncCoord(p[0], factor);
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, truncCoord(p[1], factor)));
  return p.length > 2 ? ([lng, lat, ...p.slice(2)] as Position) : ([lng, lat] as Position);
}

function truncPositions(coords: Position[], factor: number): Position[] {
  if (!Array.isArray(coords)) return [];
  return coords
    .filter((p) => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number")
    .map((p) => truncPosition(p, factor));
}

function truncateGeometry(geom: Geometry, decimals: number): Geometry {
  const factor = 10 ** decimals;

  switch (geom.type) {
    case "Point":
      return { ...geom, coordinates: truncPosition(geom.coordinates, factor) };
    case "MultiPoint":
    case "LineString":
      return { ...geom, coordinates: truncPositions(geom.coordinates, factor) };
    case "MultiLineString":
    case "Polygon":
      return { ...geom, coordinates: geom.coordinates.map((ring) => truncPositions(ring, factor)) };
    case "MultiPolygon":
      return {
        ...geom,
        coordinates: geom.coordinates.map((poly) =>
          poly.map((ring) => truncPositions(ring, factor))
        ),
      };
    case "GeometryCollection":
      return {
        ...geom,
        geometries: geom.geometries.map((g) => truncateGeometry(g, decimals)),
      };
    default:
      return geom;
  }
}

// ── Consecutive duplicate removal ──────────────────

function posEqual(a: Position, b: Position): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function dedupLine(coords: Position[]): Position[] {
  if (coords.length < 2) return coords;
  const result: Position[] = [coords[0]!];
  for (let i = 1; i < coords.length; i++) {
    if (!posEqual(coords[i]!, coords[i - 1]!)) {
      result.push(coords[i]!);
    }
  }
  return result;
}

function dedupRing(coords: Position[]): Position[] {
  if (coords.length < 4) return coords; // minimum valid ring
  // Dedup interior points, then ensure closure
  const deduped = dedupLine(coords);
  // Ring must close: first === last
  if (deduped.length >= 2 && !posEqual(deduped[0]!, deduped[deduped.length - 1]!)) {
    deduped.push([...deduped[0]!] as Position);
  }
  // Minimum 4 points for a valid ring (triangle + closure)
  if (deduped.length < 4) return coords;
  return deduped;
}

function deduplicateGeometry(geom: Geometry): Geometry {
  switch (geom.type) {
    case "Point":
      return geom;
    case "MultiPoint":
      return geom; // no dedup needed for discrete points
    case "LineString":
      return { ...geom, coordinates: dedupLine(geom.coordinates) };
    case "MultiLineString":
      return { ...geom, coordinates: geom.coordinates.map(dedupLine) };
    case "Polygon":
      return { ...geom, coordinates: geom.coordinates.map(dedupRing) };
    case "MultiPolygon":
      return {
        ...geom,
        coordinates: geom.coordinates.map((poly) => poly.map(dedupRing)),
      };
    case "GeometryCollection":
      return {
        ...geom,
        geometries: geom.geometries.map(deduplicateGeometry),
      };
    default:
      return geom;
  }
}

// ── Master compression ─────────────────────────────

export interface CompressOptions {
  /** Simplification tolerance in degrees (0.01 ≈ 1.1km). 0 = skip simplification. */
  simplifyTolerance: number;
  /** Coordinate decimal places (4 = ~11m accuracy). */
  coordinatePrecision: number;
  /** Property keys to strip from features. */
  stripProperties?: string[];
}

/**
 * Compress a FeatureCollection by simplifying geometry, truncating
 * coordinate precision, removing duplicate points, and stripping properties.
 */
export function compressFeatureCollection(
  fc: FeatureCollection,
  options: CompressOptions
): FeatureCollection {
  const features = fc.features.map((f) => {
    let feature: Feature = f;

    // 1. Simplify geometry (reduce vertex count via Visvalingam-Whyatt)
    if (options.simplifyTolerance > 0) {
      try {
        feature = simplify(feature, {
          tolerance: options.simplifyTolerance,
          highQuality: true,
        }) as Feature;
      } catch {
        // Simplification can fail on degenerate geometries — keep original
      }
    }

    // 2. Truncate coordinate precision
    const truncated = truncateGeometry(feature.geometry, options.coordinatePrecision);

    // 3. Remove consecutive duplicate points
    const deduped = deduplicateGeometry(truncated);

    // 4. Strip unnecessary properties
    let props = feature.properties;
    if (options.stripProperties?.length && props) {
      props = { ...props };
      for (const key of options.stripProperties) {
        delete (props as Record<string, unknown>)[key];
      }
    }

    return {
      ...feature,
      geometry: deduped,
      properties: props,
    };
  });

  return { type: "FeatureCollection", features };
}
