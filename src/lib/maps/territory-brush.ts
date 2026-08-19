/**
 * Territory Brush Math — pure geometry for territory brush transfers (plan 012).
 *
 * Mechanic: a brush stroke (sequence of [lng,lat] points + a radius) is expanded
 * into a polygon B via turf/buffer. The intersection B∩S is cut from the source
 * territory S and unioned into the target territory T:
 *
 *   transfer = intersect(B, S)
 *   T' = union(T, transfer)
 *   S' = difference(S, transfer)
 *
 * Results are passed through sanitizeRegionShape to remove spikes / degenerate rings.
 * Returns null when the stroke doesn't overlap the source at all.
 */

import { buffer } from "@turf/buffer";
import { difference } from "@turf/difference";
import { featureCollection } from "@turf/helpers";
import { intersect } from "@turf/intersect";
import { union } from "@turf/union";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { sanitizeRegionShape } from "~/lib/maps/border-editor";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Wrap a raw geometry as a GeoJSON Feature for turf. */
function toFeature(geometry: Polygon | MultiPolygon): Feature<Polygon | MultiPolygon> {
  return { type: "Feature", geometry, properties: {} };
}

/**
 * Extract a Polygon | MultiPolygon from a turf result feature, or return null
 * if the result is empty / a non-area geometry type.
 */
function extractPolygonGeom(feat: Feature | null | undefined): Polygon | MultiPolygon | null {
  if (!feat?.geometry) return null;
  const t = feat.geometry.type;
  if (t === "Polygon" || t === "MultiPolygon") {
    return feat.geometry as Polygon | MultiPolygon;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface BrushStrokeResult {
  source: Polygon | MultiPolygon;
  target: Polygon | MultiPolygon;
  /** Sanitization notes from both geometries. */
  issues: string[];
}

/**
 * Apply a brush stroke that transfers territory from `source` into `target`.
 *
 * @param strokePoints  Ordered [lng, lat] pairs along the stroke path (min 1).
 * @param radiusKm      Buffer radius in kilometres.
 * @param source        Geometry that loses area (the feature being edited).
 * @param target        Geometry that gains area (a neighbour).
 * @returns             Updated { source, target } pair, or null if no overlap.
 *
 * Edge cases:
 * - Single point → buffered to a circle (turf treats a Point as a 1-member LineString).
 * - Stroke entirely outside source → returns null (caller can ignore / warn).
 * - After transfer, if source becomes empty (full absorption), returns null to
 *   signal that a merge operation should be used instead.
 */
export function applyBrushStroke(
  strokePoints: [number, number][],
  radiusKm: number,
  source: Polygon | MultiPolygon,
  target: Polygon | MultiPolygon
): BrushStrokeResult | null {
  if (strokePoints.length === 0 || radiusKm <= 0) return null;

  // ── 1. Build brush polygon from stroke ────────────────────────────────────
  // Use a LineString for ≥2 points (turf buffers as a capsule along the path).
  // For a single point use a Point geometry directly (circular brush).
  let strokeGeom: GeoJSON.Geometry;
  if (strokePoints.length === 1) {
    strokeGeom = {
      type: "Point",
      coordinates: strokePoints[0] as [number, number],
    };
  } else {
    strokeGeom = {
      type: "LineString",
      coordinates: strokePoints as [number, number][],
    };
  }

  const strokeFeature: Feature = {
    type: "Feature",
    geometry: strokeGeom,
    properties: {},
  };

  // buffer returns Feature<Polygon> | null
  const brushFeature = buffer(strokeFeature, radiusKm, { units: "kilometers" });
  const brushGeom = extractPolygonGeom(brushFeature ?? null);
  if (!brushGeom) return null; // degenerate stroke

  // ── 2. Compute transfer area = B ∩ S ──────────────────────────────────────
  const fc: FeatureCollection<Polygon | MultiPolygon> = featureCollection([
    toFeature(brushGeom) as Feature<Polygon | MultiPolygon>,
    toFeature(source) as Feature<Polygon | MultiPolygon>,
  ]);

  let transferFeature: Feature | null = null;
  try {
    transferFeature = intersect(fc);
  } catch {
    return null; // invalid geometry — bail
  }

  const transferGeom = extractPolygonGeom(transferFeature);
  if (!transferGeom) return null; // no overlap with source

  // ── 3. S' = S − transfer ──────────────────────────────────────────────────
  let newSourceGeom: Polygon | MultiPolygon | null = null;
  try {
    const diff = difference(
      featureCollection([
        toFeature(source) as Feature<Polygon | MultiPolygon>,
        toFeature(transferGeom) as Feature<Polygon | MultiPolygon>,
      ])
    );
    newSourceGeom = extractPolygonGeom(diff);
  } catch {
    return null;
  }

  // If source was fully consumed, signal caller to use a merge instead.
  if (!newSourceGeom) return null;

  // ── 4. T' = T ∪ transfer ──────────────────────────────────────────────────
  let newTargetGeom: Polygon | MultiPolygon | null = null;
  try {
    const united = union(
      featureCollection([
        toFeature(target) as Feature<Polygon | MultiPolygon>,
        toFeature(transferGeom) as Feature<Polygon | MultiPolygon>,
      ])
    );
    newTargetGeom = extractPolygonGeom(united);
  } catch {
    return null;
  }

  if (!newTargetGeom) return null;

  // ── 5. Sanitize both results ───────────────────────────────────────────────
  // sanitizeRegionShape expects (geometry, countryBorder). Since we're operating
  // on region shapes without a strict outer border here, pass the geometry itself
  // as the countryBorder (no-op clipping path — only spike/dedup and despiking run).
  const sanitizedSource = sanitizeRegionShape(newSourceGeom, newSourceGeom);
  const sanitizedTarget = sanitizeRegionShape(newTargetGeom, newTargetGeom);

  return {
    source: sanitizedSource.geometry,
    target: sanitizedTarget.geometry,
    issues: [...sanitizedSource.issues, ...sanitizedTarget.issues],
  };
}
