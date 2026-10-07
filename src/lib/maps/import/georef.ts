/**
 * Georeferencing for map imports: how a pixel (x right, y down) of an image, or a point of an SVG's viewBox,
 * becomes a lon/lat. Three ways, in order of precedence:
 *   1. control points (at least three pixel ↔ lon/lat pairs), fitted with the SVG calibration helper's robust
 *      affine fit (Theil-Sen, then least squares on the inliers);
 *   2. bounds: the image covers exactly this lon/lat box (a crop);
 *   3. nothing: the image is the whole globe (the old assumption, still the default).
 * Each in either projection: equirectangular (degrees are linear in pixels) or Mercator (the vertical axis is
 * linear in Mercator y, so the latitude comes from the inverse Mercator). Pure, client-safe.
 */
import type { Geometry, Position } from "geojson";
import { createConfigFromCalibration, svgToWgs84 } from "~/lib/flags/svg-coordinate-config";
import {
  MERCATOR_MAX_LAT,
  type MapBounds,
  type MapGeoreference,
  type MapProjection,
} from "~/lib/maps/realm-map-settings";

export type PixelToLonLat = (x: number, y: number) => [number, number];

export interface GeorefResolution {
  transform: PixelToLonLat;
  method: "whole-globe" | "bounds" | "control-points";
  projection: MapProjection;
  /** The lon/lat box the image covers after the transform. */
  extent: MapBounds;
  /** Root mean square misfit of the control points, in degrees. */
  rmseDegrees?: number;
  warnings: string[];
}

export class GeorefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeorefError";
  }
}

const RAD = Math.PI / 180;

/** Mercator y of a latitude, in degree-like units (equal to longitude degrees at the equator). */
export function mercatorY(lat: number): number {
  const clamped = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
  return Math.log(Math.tan(Math.PI / 4 + (clamped * RAD) / 2)) / RAD;
}

/** The latitude of a Mercator y (degree-like units): the inverse of mercatorY. */
export function inverseMercatorY(y: number): number {
  return (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;
}

const clampLon = (lon: number) => Math.max(-180, Math.min(180, lon));
const clampLat = (lat: number) => Math.max(-90, Math.min(90, lat));

/** The projected vertical coordinate of a latitude (degrees for equirectangular, Mercator y otherwise). */
const project = (lat: number, projection: MapProjection) =>
  projection === "mercator" ? mercatorY(lat) : lat;
const unproject = (v: number, projection: MapProjection) =>
  projection === "mercator" ? inverseMercatorY(v) : v;

function boxTransform(bounds: MapBounds, width: number, height: number, projection: MapProjection) {
  const top = project(bounds.north, projection);
  const bottom = project(bounds.south, projection);
  return (x: number, y: number): [number, number] => [
    clampLon(bounds.west + ((bounds.east - bounds.west) * x) / width),
    clampLat(unproject(top - ((top - bottom) * y) / height, projection)),
  ];
}

function controlPointTransform(
  georef: MapGeoreference,
  width: number,
  height: number,
  projection: MapProjection
): { transform: PixelToLonLat; rmseDegrees: number } {
  const points = georef.controlPoints ?? [];
  const config = createConfigFromCalibration(
    width,
    height,
    points.map((p) => ({ svgX: p.x, svgY: p.y, lng: p.lon, lat: project(p.lat, projection) }))
  );
  if (!config) {
    throw new GeorefError(
      "The control points do not fit a map: use at least three points that are not in a line, with longitude growing to the right and latitude upwards"
    );
  }
  const transform: PixelToLonLat = (x, y) => {
    const [lon, v] = svgToWgs84(x, y, config);
    return [clampLon(lon), clampLat(unproject(v, projection))];
  };
  const squared = points.map((p) => {
    const [lon, lat] = transform(p.x, p.y);
    return (lon - p.lon) ** 2 + (lat - p.lat) ** 2;
  });
  return {
    transform,
    rmseDegrees: Math.sqrt(squared.reduce((a, b) => a + b, 0) / Math.max(1, squared.length)),
  };
}

/** The lon/lat box a transform maps the image onto (corners and edge midpoints). */
function extentOf(transform: PixelToLonLat, width: number, height: number): MapBounds {
  const samples: Array<[number, number]> = [];
  for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) samples.push(transform(fx * width, fy * height));
  const lons = samples.map((s) => s[0]);
  const lats = samples.map((s) => s[1]);
  return {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  };
}

/** How an image of `width` × `height` (pixels or viewBox units) maps onto lon/lat under `georef`. */
export function resolveGeoreference(
  georef: MapGeoreference | undefined,
  width: number,
  height: number
): GeorefResolution {
  if (!(width > 0 && height > 0)) throw new GeorefError("The map has no size to georeference");
  const projection = georef?.projection ?? "equirectangular";
  const warnings: string[] = [];

  if (georef?.controlPoints && georef.controlPoints.length >= 3) {
    const { transform, rmseDegrees } = controlPointTransform(georef, width, height, projection);
    if (rmseDegrees > 1) {
      warnings.push(
        `The control points disagree by ${rmseDegrees.toFixed(2)}° on average: check them for a typo`
      );
    }
    return {
      transform,
      method: "control-points",
      projection,
      extent: extentOf(transform, width, height),
      rmseDegrees,
      warnings,
    };
  }

  if (georef?.bounds) {
    const transform = boxTransform(georef.bounds, width, height, projection);
    return { transform, method: "bounds", projection, extent: extentOf(transform, width, height), warnings };
  }

  const whole: MapBounds =
    projection === "mercator"
      ? { west: -180, south: -MERCATOR_MAX_LAT, east: 180, north: MERCATOR_MAX_LAT }
      : { west: -180, south: -90, east: 180, north: 90 };
  const expected = projection === "mercator" ? 1 : 2;
  const aspect = width / height;
  if (Math.abs(aspect - expected) / expected > 0.03) {
    warnings.push(
      `The map is ${aspect.toFixed(2)}:1, but a whole-globe ${projection} map is ${expected}:1. If it is a crop, set its bounds or control points, or it will be stretched`
    );
  }
  const transform = boxTransform(whole, width, height, projection);
  return { transform, method: "whole-globe", projection, extent: whole, warnings };
}

/** Every position of a geometry passed through `transform` (Polygon and MultiPolygon; others unchanged). */
export function transformPolygonal<T extends Geometry>(geometry: T, transform: PixelToLonLat): T {
  const mapRing = (ring: Position[]) => ring.map(([x, y]) => transform(x!, y!) as Position);
  if (geometry.type === "Polygon") {
    return { ...geometry, coordinates: geometry.coordinates.map(mapRing) };
  }
  if (geometry.type === "MultiPolygon") {
    return { ...geometry, coordinates: geometry.coordinates.map((poly) => poly.map(mapRing)) };
  }
  return geometry;
}
