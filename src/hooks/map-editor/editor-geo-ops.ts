/**
 * editor-geo-ops — pure geometry helpers behind the map editor's city
 * placement tools (scatter, snap-to-border, snap-to-coast, centroid cities)
 * and the GeoJSON import/export.
 *
 * No React, no tRPC — data in, data out, so they can be unit tested.
 */

import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { EditorFeature } from "./editor-types";

type LngLat = [number, number];

export function isPolygonal(g: unknown): g is Polygon | MultiPolygon {
  const t = (g as { type?: string } | null)?.type;
  return t === "Polygon" || t === "MultiPolygon";
}

function outerRings(geom: Polygon | MultiPolygon): Position[][] {
  return geom.type === "Polygon"
    ? geom.coordinates.slice(0, 1)
    : geom.coordinates.map((poly) => poly[0]!).filter(Boolean);
}

function allRings(geom: Polygon | MultiPolygon): Position[][] {
  return geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
}

function geometryBbox(geom: Polygon | MultiPolygon): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of outerRings(geom)) {
    for (const [x, y] of ring as LngLat[]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

export function pointInGeometry(pt: LngLat, geom: Polygon | MultiPolygon): boolean {
  try {
    return booleanPointInPolygon(point(pt), geom);
  } catch {
    return false;
  }
}

/** Deterministic PRNG (mulberry32) so scatter results are reproducible in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` random points inside a polygon, rejection-sampled from its bbox and kept
 * at least `minSpacingDeg` apart where possible.
 */
export function randomPointsInPolygon(
  geom: Polygon | MultiPolygon,
  count: number,
  opts: { random?: () => number; minSpacingDeg?: number; maxAttempts?: number } = {}
): LngLat[] {
  const random = opts.random ?? Math.random;
  const [minX, minY, maxX, maxY] = geometryBbox(geom);
  if (!Number.isFinite(minX)) return [];
  const spacing = opts.minSpacingDeg ?? Math.min(maxX - minX, maxY - minY) / (Math.sqrt(count) * 3);
  const maxAttempts = opts.maxAttempts ?? count * 200;
  const out: LngLat[] = [];
  let attempts = 0;
  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const candidate: LngLat = [minX + random() * (maxX - minX), minY + random() * (maxY - minY)];
    if (!pointInGeometry(candidate, geom)) continue;
    // Relax spacing in the second half of the budget so small shapes still fill up.
    const needSpacing = attempts < maxAttempts / 2 ? spacing : 0;
    if (
      needSpacing > 0 &&
      out.some((p) => Math.hypot(p[0] - candidate[0], p[1] - candidate[1]) < needSpacing)
    ) {
      continue;
    }
    out.push(candidate);
  }
  return out;
}

/** Nearest point on any ring of a polygon (segment projection in lng/lat space). */
export function nearestPointOnBoundary(pt: LngLat, geom: Polygon | MultiPolygon): LngLat {
  let best: LngLat = pt;
  let bestD = Infinity;
  for (const ring of allRings(geom)) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i] as LngLat;
      const b = ring[i + 1] as LngLat;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      const t =
        len2 === 0
          ? 0
          : Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len2));
      const proj: LngLat = [a[0] + t * dx, a[1] + t * dy];
      const d = Math.hypot(proj[0] - pt[0], proj[1] - pt[1]);
      if (d < bestD) {
        bestD = d;
        best = proj;
      }
    }
  }
  return best;
}

/**
 * Moves a point that sits exactly on a boundary a hair toward `inside` so it is
 * unambiguously within the shape (point-in-polygon on an edge is unstable).
 */
export function nudgeToward(pt: LngLat, inside: LngLat, fraction = 0.002): LngLat {
  return [pt[0] + (inside[0] - pt[0]) * fraction, pt[1] + (inside[1] - pt[1]) * fraction];
}

/** A point guaranteed to lie inside the shape: the vertex centroid when inside, else a grid probe. */
export function interiorPoint(geom: Polygon | MultiPolygon): LngLat | null {
  const ring = outerRings(geom).sort((a, b) => b.length - a.length)[0];
  if (!ring || ring.length === 0) return null;
  let cx = 0;
  let cy = 0;
  const n = ring.length > 1 ? ring.length - 1 : ring.length;
  for (let i = 0; i < n; i++) {
    cx += ring[i]![0]!;
    cy += ring[i]![1]!;
  }
  const centroid: LngLat = [cx / n, cy / n];
  if (pointInGeometry(centroid, geom)) return centroid;

  const [minX, minY, maxX, maxY] = geometryBbox(geom);
  const steps = 12;
  let best: LngLat | null = null;
  let bestD = Infinity;
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const p: LngLat = [minX + ((maxX - minX) * i) / steps, minY + ((maxY - minY) * j) / steps];
      if (!pointInGeometry(p, geom)) continue;
      const d = Math.hypot(p[0] - centroid[0], p[1] - centroid[1]);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best;
}

/** Regions that contain no city (by subdivisionId link or by location). */
export function findEmptyRegions(features: EditorFeature[]): EditorFeature[] {
  const cities = features.filter((f) => f.type === "city" && f.coordinates);
  const linked = new Set(
    cities.map((c) => c.properties.subdivisionId).filter((v): v is string => typeof v === "string")
  );
  return features.filter((f) => {
    if (f.type !== "subdivision" || !isPolygonal(f.geometry)) return false;
    if (linked.has(f.id)) return false;
    const geom = f.geometry;
    return !cities.some((c) => pointInGeometry(c.coordinates!, geom));
  });
}

/** The first region (by list order) whose shape contains the point. */
export function findContainingRegion(
  pt: LngLat,
  features: EditorFeature[]
): EditorFeature | undefined {
  return features.find(
    (f) => f.type === "subdivision" && isPolygonal(f.geometry) && pointInGeometry(pt, f.geometry)
  );
}

/** Serialises editor features to a GeoJSON FeatureCollection (one feature per editor feature). */
export function featuresToGeoJSON(features: EditorFeature[]): FeatureCollection {
  const out: Feature[] = [];
  for (const f of features) {
    if (f.type === "gap") continue;
    const geometry: Geometry | null = f.coordinates
      ? { type: "Point", coordinates: f.coordinates }
      : ((f.geometry as Geometry | undefined) ?? null);
    if (!geometry) continue;
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(f.properties)) {
      // Geometry lives on the feature; PostGIS/internal columns are noise in an export.
      if (key === "geometry" || key === "coordinates" || key === "geom_postgis") continue;
      if (value === undefined) continue;
      properties[key] = value;
    }
    properties.id = f.id;
    properties.name = f.name;
    properties.featureType = f.type;
    out.push({ type: "Feature", geometry, properties });
  }
  return { type: "FeatureCollection", features: out };
}

type ImportableFeature =
  | { kind: "city"; name: string; coordinates: LngLat; properties: Record<string, unknown> }
  | { kind: "poi"; name: string; coordinates: LngLat; properties: Record<string, unknown> }
  | {
      kind: "subdivision";
      name: string;
      geometry: Polygon | MultiPolygon;
      properties: Record<string, unknown>;
    };

interface GeoJSONImportPlan {
  features: ImportableFeature[];
  skipped: number;
}

const NAME_KEYS = ["name", "NAME", "Name", "title", "text", "label", "NAME_1", "NAME_2"];

function pickName(props: Record<string, unknown>, fallback: string): string {
  for (const k of NAME_KEYS) {
    const v = props[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 100);
  }
  return fallback;
}

/**
 * Turns an arbitrary GeoJSON document into importable editor features:
 * Points become cities (or POIs when `featureType`/`category` says so) and
 * Polygons/MultiPolygons become regions. Lines and unknown shapes are skipped.
 */
export function planGeoJSONImport(input: unknown): GeoJSONImportPlan {
  const doc = input as { type?: string; features?: unknown[]; geometry?: unknown };
  const raw: Array<{ geometry?: unknown; properties?: unknown }> =
    doc?.type === "FeatureCollection" && Array.isArray(doc.features)
      ? (doc.features as Array<{ geometry?: unknown; properties?: unknown }>)
      : doc?.type === "Feature"
        ? [doc as { geometry?: unknown; properties?: unknown }]
        : doc && typeof doc === "object" && "coordinates" in doc
          ? [{ geometry: doc, properties: {} }]
          : [];

  const features: ImportableFeature[] = [];
  let skipped = 0;
  raw.forEach((f, i) => {
    const props = (f.properties && typeof f.properties === "object" ? f.properties : {}) as Record<
      string,
      unknown
    >;
    const g = f.geometry as { type?: string; coordinates?: unknown } | undefined;
    if (!g || !g.type) {
      skipped++;
      return;
    }
    if (g.type === "Point" && Array.isArray(g.coordinates)) {
      const [lng, lat] = g.coordinates as number[];
      if (typeof lng !== "number" || typeof lat !== "number") {
        skipped++;
        return;
      }
      const isPoi =
        props.featureType === "poi" || (typeof props.category === "string" && !props.cityType);
      features.push({
        kind: isPoi ? "poi" : "city",
        name: pickName(props, `${isPoi ? "Place" : "City"} ${i + 1}`),
        coordinates: [lng, lat],
        properties: props,
      });
      return;
    }
    if (isPolygonal(g)) {
      features.push({
        kind: "subdivision",
        name: pickName(props, `Region ${i + 1}`),
        geometry: g,
        properties: props,
      });
      return;
    }
    skipped++;
  });
  return { features, skipped };
}
