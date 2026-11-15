/**
 * The still map crop behind a Factbook block that has no fitting article image (owner ruling
 * 2026-11-09): pure framing and SVG path drawing in Plate Carrée, where x = longitude and
 * y = −latitude. No tiles, no WebGL; the component draws these from the geo bundle it already has.
 */
import type { Geometry, Position } from "geojson";

export type MapCropKind = "economy" | "state" | "foreign";

export interface MapCropInput {
  /** The country's [minLng, minLat, maxLng, maxLat]. */
  bbox: [number, number, number, number];
  capital: [number, number] | null;
  cities: readonly [number, number][];
  /** Neighbour centroids. */
  neighbors: readonly [number, number][];
}

export interface MapCropFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Smallest span in degrees, so a point-sized country still gets a frame. */
const MIN_SPAN = 1;
/** Margin around what a frame must hold, as a share of its span. */
const PAD = 0.12;
/** State zooms in to this share of the country's larger side. */
const STATE_ZOOM = 0.45;
/** Foreign zooms out at most this many times the country's larger side. */
const FOREIGN_MAX_ZOOM = 4;

type Box = [number, number, number, number];

const extend = (box: Box, points: readonly [number, number][]): Box =>
  points.reduce<Box>(
    ([a, b, c, d], [lng, lat]) => [
      Math.min(a, lng),
      Math.min(b, lat),
      Math.max(c, lng),
      Math.max(d, lat),
    ],
    box
  );

/** A frame at `aspect` (width / height) centred on (cx, cy) that holds a w × h span. */
function fit(cx: number, cy: number, w: number, h: number, aspect: number): MapCropFrame {
  const width = Math.max(w, h * aspect, MIN_SPAN);
  const height = width / aspect;
  return { x: cx - width / 2, y: -cy - height / 2, w: width, h: height };
}

/** Pads a lng/lat box and fits it at the aspect ratio. */
function frameBox([minLng, minLat, maxLng, maxLat]: Box, aspect: number): MapCropFrame {
  const w = (maxLng - minLng) * (1 + 2 * PAD);
  const h = (maxLat - minLat) * (1 + 2 * PAD);
  return fit((minLng + maxLng) / 2, (minLat + maxLat) / 2, w, h, aspect);
}

/**
 * Foreign: centred on the country, zoomed out symmetrically far enough to reach the neighbours,
 * but never past `FOREIGN_MAX_ZOOM` times the country, so one distant neighbour cannot shrink the
 * country to a speck in a corner.
 */
function foreignFrame(bbox: Box, neighbors: readonly [number, number][], aspect: number) {
  const cx = (bbox[0] + bbox[2]) / 2;
  const cy = (bbox[1] + bbox[3]) / 2;
  const reach = extend(bbox, neighbors);
  const halfW = Math.max(cx - reach[0], reach[2] - cx);
  const halfH = Math.max(cy - reach[1], reach[3] - cy);
  const cap = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1], MIN_SPAN) * FOREIGN_MAX_ZOOM;
  const w = Math.min(halfW * 2 * (1 + 2 * PAD), cap);
  const h = Math.min(halfH * 2 * (1 + 2 * PAD), cap / aspect);
  return fit(cx, cy, w, h, aspect);
}

/**
 * The SVG viewBox for one block: Economy holds the country and its cities, State centres on the
 * capital zoomed in (the country when there is no capital), Foreign zooms out to the neighbours
 * around the country.
 */
export function mapCropFrame(kind: MapCropKind, input: MapCropInput, aspect: number): MapCropFrame {
  const { bbox, capital, cities, neighbors } = input;
  if (kind === "state" && capital) {
    const side = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * STATE_ZOOM;
    return fit(capital[0], capital[1], side, side / aspect, aspect);
  }
  if (kind === "economy") return frameBox(extend(bbox, cities), aspect);
  if (kind === "foreign") return foreignFrame(bbox, neighbors, aspect);
  return frameBox(bbox, aspect);
}

const point = ([lng, lat]: Position) => `${+(lng ?? 0).toFixed(3)},${+(-(lat ?? 0)).toFixed(3)}`;
const ring = (positions: Position[]) =>
  positions.length ? `M${positions.map(point).join("L")}Z` : "";

/**
 * An SVG path for a Polygon or MultiPolygon, in SVG space. Other geometry types draw nothing.
 * ponytail: no simplification; a very detailed coastline makes a long path, add a tolerance pass
 * (or a server-side ST_Simplify) if a profile measurably slows on it.
 */
export function geometryPath(geometry: Geometry | null | undefined): string {
  if (geometry?.type === "Polygon") return geometry.coordinates.map(ring).join("");
  if (geometry?.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) => polygon.map(ring)).join("");
  }
  return "";
}
