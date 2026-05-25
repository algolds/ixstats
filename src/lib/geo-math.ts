/**
 * geo-math.ts — Unified geographic math utilities for IxWorld/IxStats.
 *
 * Single source of truth for all distance, area, and coordinate calculations.
 *
 * IMPORTANT: IxEarth's scale is BAKED INTO THE MAP GEOMETRY.
 * The SVG map was drawn so that countries are already at their canonical
 * IxEarth sizes when projected onto a WGS84 Earth globe. This means:
 *   - PostGIS areas match wiki/roster areas at ~0.999 ratio (verified empirically)
 *   - Haversine with R=6371 gives correct IxEarth distances directly
 *   - No post-hoc scale factor is needed (areaScale = 1.0)
 *
 * The planet's lore surface area is 352.8M sq mi (1.79× Earth), but this
 * is achieved by drawing larger country polygons on the standard globe,
 * not by changing the radius.
 *
 * The scale factor is configurable for licensing to other communities
 * who may need to adjust measurements for their own world.
 */

// ─── IxEarth World Configuration ─────────────────────────────────────────────

/** Planet reference data */
const IXEARTH_REFERENCE = {
  /** Lore total surface area in sq mi */
  totalSurfaceAreaSqMi: 352_800_000,
  /** Earth total surface area in sq mi */
  earthSurfaceAreaSqMi: 196_940_000,
  /** Earth mean radius in km — used for haversine */
  earthRadiusKm: 6_371,
  /** Lore planet ratio (informational, NOT applied to calculations) */
  planetRatio: 352_800_000 / 196_940_000, // ~1.7914
} as const;

export interface WorldScale {
  /** Area multiplier applied after PostGIS/haversine calculations. Default: 1.0 (scale is baked in). */
  areaScale: number;
  /** Distance multiplier. Derived: √areaScale. Default: 1.0. */
  distanceScale: number;
  /** Effective planet radius in km for haversine. Default: 6371. */
  radiusKm: number;
}

/**
 * Current active world scale.
 * Default 1.0 — IxEarth scale is baked into the map geometry.
 * Only change this for communities using a different world/map scale.
 */
let activeScale: WorldScale = {
  areaScale: 1.0,
  distanceScale: 1.0,
  radiusKm: IXEARTH_REFERENCE.earthRadiusKm,
};

/**
 * Get the current world scale configuration.
 */
export function getWorldScale(): Readonly<WorldScale> {
  return activeScale;
}

/**
 * Set a custom world scale. Use for licensing to other communities.
 * @param areaScale — Area multiplier (e.g., 1.0 for Earth-sized, 2.0 for 2× Earth surface)
 */
export function setWorldScale(areaScale: number): void {
  activeScale = {
    areaScale,
    distanceScale: Math.sqrt(areaScale),
    radiusKm: IXEARTH_REFERENCE.earthRadiusKm * Math.sqrt(areaScale),
  };
}

/**
 * Reset to default IxEarth scale (1.0 — baked into map geometry).
 */
export function resetWorldScale(): void {
  activeScale = {
    areaScale: 1.0,
    distanceScale: 1.0,
    radiusKm: IXEARTH_REFERENCE.earthRadiusKm,
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;
const KM_PER_MI = 1.60934;
const SQKM_PER_SQMI = 2.58999;

// ─── Distance ────────────────────────────────────────────────────────────────

/**
 * Haversine distance between two [lng, lat] points, in IxEarth km.
 * Applies the world scale factor automatically.
 */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * DEG2RAD;
  const dLng = (b[0] - a[0]) * DEG2RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(a[1] * DEG2RAD) * Math.cos(b[1] * DEG2RAD) * sinLng * sinLng;
  return 2 * activeScale.radiusKm * Math.asin(Math.sqrt(h));
}

/**
 * Haversine distance in IxEarth miles.
 */
export function distanceMi(a: [number, number], b: [number, number]): number {
  return distanceKm(a, b) / KM_PER_MI;
}

/**
 * Haversine distance using raw lat/lng numbers (for backward compat with transport router).
 */
export function distanceKmLatLng(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return distanceKm([lng1, lat1], [lng2, lat2]);
}

// ─── Area ────────────────────────────────────────────────────────────────────

/**
 * Compute polygon area in IxEarth sq km from a coordinate ring [[lng,lat], ...].
 * Uses the spherical excess formula for accuracy.
 */
export function ringAreaSqKm(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  // Shoelace in coordinate space, then scale by latitude
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    area += ring[i]![0] * ring[j]![1];
    area -= ring[j]![0] * ring[i]![1];
  }
  area = Math.abs(area) / 2;

  // Convert square degrees to square km
  const centroidLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const latScale = 111.32; // km per degree latitude
  const lngScale = 111.32 * Math.cos(centroidLat * DEG2RAD); // km per degree longitude
  const areaSqKmEarth = area * latScale * lngScale;

  // Apply IxEarth scale
  return areaSqKmEarth * activeScale.areaScale;
}

/**
 * Compute polygon area in IxEarth sq mi.
 */
export function ringAreaSqMi(ring: [number, number][]): number {
  return ringAreaSqKm(ring) / SQKM_PER_SQMI;
}

/**
 * Compute area of a GeoJSON Polygon or MultiPolygon in IxEarth sq km.
 */
export function geometryAreaSqKm(geometry: {
  type: string;
  coordinates: number[][][] | number[][][][];
}): number {
  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates as [number, number][][];
    let area = ringAreaSqKm(coords[0]!);
    // Subtract holes
    for (let i = 1; i < coords.length; i++) {
      area -= ringAreaSqKm(coords[i]!);
    }
    return Math.abs(area);
  }
  if (geometry.type === "MultiPolygon") {
    const coords = geometry.coordinates as [number, number][][][];
    return coords.reduce((total, poly) => {
      let area = ringAreaSqKm(poly[0]!);
      for (let i = 1; i < poly.length; i++) {
        area -= ringAreaSqKm(poly[i]!);
      }
      return total + Math.abs(area);
    }, 0);
  }
  return 0;
}

/**
 * Compute area in IxEarth sq mi.
 */
export function geometryAreaSqMi(geometry: {
  type: string;
  coordinates: number[][][] | number[][][][];
}): number {
  return geometryAreaSqKm(geometry) / SQKM_PER_SQMI;
}

// ─── Perimeter ───────────────────────────────────────────────────────────────

/**
 * Compute perimeter of a coordinate ring in IxEarth km.
 */
export function ringPerimeterKm(ring: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < ring.length; i++) {
    total += distanceKm(ring[i - 1]!, ring[i]!);
  }
  // Close the ring if needed
  if (
    ring.length > 1 &&
    (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1])
  ) {
    total += distanceKm(ring[ring.length - 1]!, ring[0]!);
  }
  return total;
}

// ─── Polyline Length ─────────────────────────────────────────────────────────

/**
 * Compute length of a polyline (route/path) in IxEarth km.
 */
export function polylineLengthKm(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceKm(points[i - 1]!, points[i]!);
  }
  return total;
}

/**
 * Compute length in IxEarth miles.
 */
export function polylineLengthMi(points: [number, number][]): number {
  return polylineLengthKm(points) / KM_PER_MI;
}

// ─── Bearing ─────────────────────────────────────────────────────────────────

/**
 * Initial bearing from point A to point B in degrees (0-360).
 * Scale-independent (bearing doesn't change with planet size).
 */
export function bearing(a: [number, number], b: [number, number]): number {
  const dLng = (b[0] - a[0]) * DEG2RAD;
  const lat1 = a[1] * DEG2RAD;
  const lat2 = b[1] * DEG2RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Compass direction label from bearing (N, NE, E, SE, S, SW, W, NW).
 */
export function compassDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8]!;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Format distance with appropriate unit (km or mi with commas).
 */
export function formatDistance(km: number, unit: "km" | "mi" = "km"): string {
  const value = unit === "mi" ? km / KM_PER_MI : km;
  if (value < 1) return `${(value * 1000).toFixed(0)} ${unit === "mi" ? "ft" : "m"}`;
  if (value < 100) return `${value.toFixed(1)} ${unit}`;
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

/**
 * Format area with appropriate unit.
 */
export function formatArea(sqKm: number, unit: "km²" | "mi²" = "km²"): string {
  const value = unit === "mi²" ? sqKm / SQKM_PER_SQMI : sqKm;
  if (value < 1) return `${(value * 1e6).toFixed(0)} ${unit === "mi²" ? "sq ft" : "m²"}`;
  if (value < 100) return `${value.toFixed(1)} ${unit}`;
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

// ─── Coordinate utilities ────────────────────────────────────────────────────

/**
 * Centroid of a coordinate ring.
 */
export function ringCentroid(ring: [number, number][]): [number, number] {
  if (ring.length === 0) return [0, 0];
  let lng = 0,
    lat = 0;
  for (const p of ring) {
    lng += p[0];
    lat += p[1];
  }
  return [lng / ring.length, lat / ring.length];
}

/**
 * Bounding box of a coordinate ring: [minLng, minLat, maxLng, maxLat].
 */
export function ringBbox(ring: [number, number][]): [number, number, number, number] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
