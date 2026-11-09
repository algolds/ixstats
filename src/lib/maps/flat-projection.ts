/**
 * Flat maps in Plate Carrée (equirectangular) on MapLibre, which draws only Web Mercator and the globe.
 *
 * Each point goes to MapLibre at a "carrier" latitude whose Mercator position is its Plate Carrée one.
 * Mercator draws latitude φ' at y = gd⁻¹(φ') = ln tan(π/4 + φ'/2), so φ' = gd(φ) = atan(sinh φ) draws φ at
 * y = φ: linear, like longitude. Longitude is untouched, so world copies, the antimeridian and tile
 * columns behave as before. The poles land at ±66.51° (inside Mercator's ±85.05° cut), so nothing is
 * lost and areas no longer swell toward them. It is also the projection realm art is drawn in.
 *
 * Everything crossing the map boundary converts: data and camera targets go in through `toCarrier*`,
 * pointer and camera reads come back through `fromCarrier`. A straight edge stays straight (both
 * projections are linear in longitude and in their own y), so geometry needs no densifying.
 */
import type { Feature, FeatureCollection, Geometry, GeoJSON, Position } from "geojson";

const RAD = Math.PI / 180;

/** The latitude MapLibre's Mercator needs to draw `lat` where Plate Carrée puts it. */
export function toCarrierLat(lat: number): number {
  return Math.atan(Math.sinh(lat * RAD)) / RAD;
}

/** The true latitude of a carrier latitude (a pointer or camera read); held at the poles, past which is nothing. */
export function fromCarrierLat(lat: number): number {
  return Math.max(-90, Math.min(90, Math.asinh(Math.tan(lat * RAD)) / RAD));
}

/** Where the poles land in carrier latitude: the flat world's top and bottom edges. */
export const CARRIER_POLE_LAT = toCarrierLat(90);

interface LngLat {
  lng: number;
  lat: number;
}

/** A point read off the map (event, camera, unproject) in true coordinates. */
export function fromCarrier({ lng, lat }: LngLat): LngLat {
  return { lng, lat: fromCarrierLat(lat) };
}

/** A `[lng, lat]` camera target or marker position for the map. */
export function toCarrierLngLat(lng: number, lat: number): [number, number] {
  return [lng, toCarrierLat(lat)];
}

type LatMap = (lat: number) => number;

const positionWith =
  (lat: LatMap) =>
  (p: Position): Position => [p[0]!, lat(p[1]!), ...p.slice(2)];

function geometryWith(lat: LatMap, g: Geometry): Geometry {
  const position = positionWith(lat);
  const geometry = (inner: Geometry): Geometry => geometryWith(lat, inner);
  switch (g.type) {
    case "Point":
      return { ...g, coordinates: position(g.coordinates) };
    case "MultiPoint":
    case "LineString":
      return { ...g, coordinates: g.coordinates.map(position) };
    case "MultiLineString":
    case "Polygon":
      return { ...g, coordinates: g.coordinates.map((ring) => ring.map(position)) };
    case "MultiPolygon":
      return { ...g, coordinates: g.coordinates.map((poly) => poly.map((r) => r.map(position))) };
    case "GeometryCollection":
      return { ...g, geometries: g.geometries.map(geometry) };
  }
}

function convert(lat: LatMap, data: GeoJSON): GeoJSON {
  if (data.type === "FeatureCollection") {
    const { bbox: _bbox, ...rest } = data;
    return { ...rest, features: data.features.map((f) => convert(lat, f) as Feature) };
  }
  if (data.type === "Feature") {
    const { bbox: _bbox, ...rest } = data;
    return { ...rest, geometry: data.geometry && geometryWith(lat, data.geometry) };
  }
  return geometryWith(lat, data);
}

/** GeoJSON data for a flat map's source: every coordinate at its carrier latitude, stale bounding boxes dropped. */
export function toCarrierGeoJSON(data: FeatureCollection): FeatureCollection;
export function toCarrierGeoJSON(data: Feature): Feature;
export function toCarrierGeoJSON(data: Geometry): Geometry;
export function toCarrierGeoJSON(data: GeoJSON): GeoJSON;
export function toCarrierGeoJSON(data: GeoJSON): GeoJSON {
  return convert(toCarrierLat, data);
}

/** A geometry read off a flat map (a queried feature's) back in true coordinates. */
export function fromCarrierGeometry(data: Geometry): Geometry {
  return geometryWith(fromCarrierLat, data);
}

/**
 * The true bounds (degrees) a flat map's tile z/x/y covers, or null when it lies wholly past a pole. Tiles keep
 * MapLibre's grid; in carrier space a tile row's Mercator y is the true latitude in radians.
 */
export function flatTileBounds(
  z: number,
  x: number,
  y: number
): { west: number; south: number; east: number; north: number } | null {
  const n = 2 ** z;
  const north = 180 * (1 - (2 * y) / n);
  const south = 180 * (1 - (2 * (y + 1)) / n);
  if (south >= 90 || north <= -90) return null;
  return {
    west: (x / n) * 360 - 180,
    south: Math.max(south, -90),
    east: ((x + 1) / n) * 360 - 180,
    north: Math.min(north, 90),
  };
}

/** MapLibre draws a zoom-0 world 512 px wide; the flat world is half as tall as it is wide. */
const WORLD_PX = 512;

/** The zoom at which the flat world just covers a `width` × `height` box. */
export function flatWorldCoverZoom(width: number, height: number): number {
  return Math.log2(Math.max(width / WORLD_PX, (2 * height) / WORLD_PX));
}

/**
 * A camera centre (carrier latitude) held so a view `height` px tall never shows past a pole; a view
 * taller than the world is centred on the equator. For MapLibre's `transformConstrain`.
 */
export function clampFlatCenterLat(carrierLat: number, zoom: number, height: number): number {
  // In carrier space Mercator's y is the true latitude in radians, and the world is 2π wide.
  const halfView = ((height / 2) * 2 * Math.PI) / (WORLD_PX * 2 ** zoom);
  const limit = Math.max(Math.PI / 2 - halfView, 0) / RAD;
  return toCarrierLat(Math.min(limit, Math.max(-limit, fromCarrierLat(carrierLat))));
}
