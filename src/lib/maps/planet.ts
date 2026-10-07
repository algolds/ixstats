/**
 * The planet the maps are drawn on: its radius and the degree → km factors behind every flat approximation in the
 * map code (areas, circles, spans). One module, so a realm with its own planet size changes one input instead of a
 * literal in every file.
 *
 * The figures are Earth's: IxEarth's scale is baked into the map geometry (see geo-math.ts). Each helper takes an
 * optional planet radius and scales Earth's figures by `radiusKm / EARTH_RADIUS_KM`, so without one it returns
 * exactly the values the map code has always used. Pure, client-safe.
 */
import type { Position } from "geojson";

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
