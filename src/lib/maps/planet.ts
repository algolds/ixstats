/**
 * The planet the maps are drawn on: its radius and the degree → km factors behind every flat approximation in the
 * map code (areas, circles, spans). One module, so a realm with its own planet size changes one input instead of a
 * literal in every file.
 *
 * The figures are Earth's: IxEarth's scale is baked into the map geometry (see geo-math.ts). Each helper takes an
 * optional planet radius and scales Earth's figures by `radiusKm / EARTH_RADIUS_KM`, so without one it returns
 * exactly the values the map code has always used. Pure, client-safe.
 */
import type { Geometry, Position } from "geojson";

/** Earth's mean radius in km: the haversine radius. */
export const EARTH_RADIUS_KM = 6_371;

/** Km per degree of longitude at the equator, the flat "1° ≈ 111.32 km" factor. */
export const KM_PER_DEGREE = 111.32;

/** Km per degree of latitude (a meridian degree at the equator). */
export const KM_PER_DEGREE_LAT = 110.574;

const scale = (radiusKm: number) => radiusKm / EARTH_RADIUS_KM;

/** Km per degree of longitude at the equator on a planet of `radiusKm`. */
export function kmPerDegree(radiusKm: number = EARTH_RADIUS_KM): number {
  return KM_PER_DEGREE * scale(radiusKm);
}

/** Km per degree of longitude at latitude `lat` (degrees). */
export function kmPerDegreeLng(lat: number, radiusKm: number = EARTH_RADIUS_KM): number {
  return kmPerDegree(radiusKm) * Math.cos((lat * Math.PI) / 180);
}

/** Km per degree of latitude. */
export function kmPerDegreeLat(radiusKm: number = EARTH_RADIUS_KM): number {
  return KM_PER_DEGREE_LAT * scale(radiusKm);
}

/**
 * Approximate area (km²) inside one closed ring: the shoelace formula over degrees, scaled by the km per degree at
 * the ring's mean latitude. Unsigned: the ring's direction does not matter.
 */
export function ringAreaSqKm(ring: Position[], radiusKm: number = EARTH_RADIUS_KM): number {
  if (ring.length === 0) return 0;
  const meanLat = ring.reduce((sum, p) => sum + p[1]!, 0) / ring.length;
  const kmLng = kmPerDegreeLng(meanLat, radiusKm);
  const kmLat = kmPerDegreeLat(radiusKm);
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[i + 1]!;
    area += x1! * kmLng * (y2! * kmLat) - x2! * kmLng * (y1! * kmLat);
  }
  return Math.abs(area) / 2;
}

/** Approximate area (km²) of a polygon given as `[outer, ...holes]`: the outer ring less its holes. */
export function polygonAreaSqKm(rings: Position[][], radiusKm: number = EARTH_RADIUS_KM): number {
  const [outer, ...holes] = rings;
  if (!outer) return 0;
  const area = holes.reduce(
    (sum, hole) => sum - ringAreaSqKm(hole, radiusKm),
    ringAreaSqKm(outer, radiusKm)
  );
  return Math.max(0, area);
}

/** Approximate area (km²) of a Polygon or MultiPolygon, holes subtracted; 0 for any other geometry. */
export function polygonalAreaSqKm(
  geometry: Geometry | null | undefined,
  radiusKm: number = EARTH_RADIUS_KM
): number {
  if (geometry?.type === "Polygon") return polygonAreaSqKm(geometry.coordinates, radiusKm);
  if (geometry?.type === "MultiPolygon") {
    return geometry.coordinates.reduce((sum, poly) => sum + polygonAreaSqKm(poly, radiusKm), 0);
  }
  return 0;
}

/**
 * Area (km²) inside one ring of `[lng, lat]` vertices joined by great-circle edges, on a planet of `radiusKm`. Exact
 * for great-circle edges, unlike the flat helpers above: sums the spherical excess between each edge and the equator
 * (tan(E/2) = tan(Δλ/2)·(t₁ + t₂)/(1 + t₁t₂), t = tan(φ/2)). Edges take the short way across the antimeridian; a ring
 * that winds all the way round in longitude encloses a pole. Unsigned and implicitly closed; of the two sides of the
 * ring, the smaller one is measured.
 */
export function sphericalRingAreaSqKm(
  ring: readonly (readonly [number, number] | Position)[],
  radiusKm: number = EARTH_RADIUS_KM
): number {
  if (ring.length < 3) return 0;
  const rad = Math.PI / 180;
  let excess = 0;
  let lngTurn = 0;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    const dLng = ((((b[0]! - a[0]!) % 360) + 540) % 360) - 180;
    const ta = Math.tan((a[1]! * rad) / 2);
    const tb = Math.tan((b[1]! * rad) / 2);
    lngTurn += dLng;
    excess += 2 * Math.atan2(Math.tan((dLng * rad) / 2) * (ta + tb), 1 + ta * tb);
  });
  // Around a pole the sum is measured from the equator, so the pole's side is a hemisphere less it: always the
  // smaller side. Otherwise the sum is one side; the other is the rest of the sphere.
  const side = Math.abs(excess);
  const smaller = Math.abs(lngTurn) > 180 ? 2 * Math.PI - side : Math.min(side, 4 * Math.PI - side);
  return smaller * radiusKm ** 2;
}

/**
 * A distance measured on Earth's radius (PostGIS geography, haversine at 6371 km) as it is on a planet of
 * `radiusKm`: distances scale with the radius.
 */
export function scaleDistanceToRadius(km: number, radiusKm: number = EARTH_RADIUS_KM): number {
  return km * scale(radiusKm);
}

/**
 * An area measured on Earth's radius (PostGIS geography, the flat helpers above without a radius) as it is on a
 * planet of `radiusKm`: areas scale with the square of the radius, `area × (r / 6371)²`.
 */
export function scaleAreaToRadius(areaSqKm: number, radiusKm: number = EARTH_RADIUS_KM): number {
  return areaSqKm * scale(radiusKm) ** 2;
}

/** Great-circle (haversine) distance in km between two `[lng, lat]` points on a planet of `radiusKm`. */
export function haversineKm(
  a: readonly [number, number] | Position,
  b: readonly [number, number] | Position,
  radiusKm: number = EARTH_RADIUS_KM
): number {
  const rad = Math.PI / 180;
  const dLat = (b[1]! - a[1]!) * rad;
  const dLng = (b[0]! - a[0]!) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1]! * rad) * Math.cos(b[1]! * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}
