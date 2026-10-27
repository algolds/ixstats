/**
 * Compact wire format for map layers: every line or ring becomes one flat array of integer deltas
 * ([x0, y0, dx1, dy1, …] at 10^decimals), which roughly halves the JSON and its gzip. Packing at the
 * precision the layer is already truncated to loses nothing. Points stay as they are.
 */

import type { Feature, FeatureCollection, Geometry, GeometryCollection, Position } from "geojson";

type PackedLine = number[];

export type PackedGeometry =
  | { type: "Point"; coordinates: Position }
  | { type: "LineString" | "MultiPoint"; coordinates: PackedLine }
  | { type: "Polygon" | "MultiLineString"; coordinates: PackedLine[] }
  | { type: "MultiPolygon"; coordinates: PackedLine[][] }
  | GeometryCollection;

export interface PackedFeatureCollection {
  type: "FeatureCollection";
  /** Decimal places the coordinates were quantized to. */
  packed: number;
  features: Array<Omit<Feature, "geometry"> & { geometry: PackedGeometry | null }>;
}

function packLine(line: Position[], factor: number): PackedLine {
  const out: number[] = [];
  let px = 0;
  let py = 0;
  for (const p of line) {
    // Delta from the previous *rounded* point, so rounding never accumulates along the line
    const x = Math.round(p[0]! * factor);
    const y = Math.round(p[1]! * factor);
    out.push(x - px, y - py);
    px = x;
    py = y;
  }
  return out;
}

function unpackLine(line: PackedLine, factor: number): Position[] {
  const out: Position[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < line.length; i += 2) {
    x += line[i]!;
    y += line[i + 1]!;
    out.push([x / factor, y / factor]);
  }
  return out;
}

function packGeometry(g: Geometry, factor: number): PackedGeometry {
  switch (g.type) {
    case "LineString":
    case "MultiPoint":
      return { type: g.type, coordinates: packLine(g.coordinates, factor) };
    case "Polygon":
    case "MultiLineString":
      return { type: g.type, coordinates: g.coordinates.map((r) => packLine(r, factor)) };
    case "MultiPolygon":
      return {
        type: g.type,
        coordinates: g.coordinates.map((poly) => poly.map((r) => packLine(r, factor))),
      };
    default:
      return g;
  }
}

function unpackGeometry(g: PackedGeometry, factor: number): Geometry {
  switch (g.type) {
    case "LineString":
    case "MultiPoint":
      return { type: g.type, coordinates: unpackLine(g.coordinates, factor) };
    case "Polygon":
    case "MultiLineString":
      return { type: g.type, coordinates: g.coordinates.map((r) => unpackLine(r, factor)) };
    case "MultiPolygon":
      return {
        type: g.type,
        coordinates: g.coordinates.map((poly) => poly.map((r) => unpackLine(r, factor))),
      };
    default:
      return g;
  }
}

export function packFeatureCollection(
  fc: FeatureCollection,
  decimals: number
): PackedFeatureCollection {
  const factor = 10 ** decimals;
  return {
    type: "FeatureCollection",
    packed: decimals,
    features: fc.features.map((f) => ({
      ...f,
      geometry: f.geometry ? packGeometry(f.geometry, factor) : null,
    })),
  };
}

function unpackFeatureCollection(fc: PackedFeatureCollection): FeatureCollection {
  const factor = 10 ** fc.packed;
  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => ({
      ...f,
      geometry: (f.geometry ? unpackGeometry(f.geometry, factor) : null) as Geometry,
    })),
  };
}

const isPacked = (fc: PackedFeatureCollection | FeatureCollection): fc is PackedFeatureCollection =>
  "packed" in fc && typeof fc.packed === "number";

/** Each packed layer decoded once: a layer that didn't change keeps its decoded object, so the
 * caches keyed on it (snap grids, the map's "data changed" checks) survive other layers arriving. */
const decoded = new WeakMap<PackedFeatureCollection, FeatureCollection>();

function decodeOnce(fc: PackedFeatureCollection): FeatureCollection {
  let out = decoded.get(fc);
  if (!out) {
    out = unpackFeatureCollection(fc);
    decoded.set(fc, out);
  }
  return out;
}

/** Decode a record of layers; plain GeoJSON (e.g. the IndexedDB placeholder) passes through. */
export function unpackLayers(
  layers: Record<string, PackedFeatureCollection | FeatureCollection>
): Record<string, FeatureCollection> {
  const out: Record<string, FeatureCollection> = {};
  for (const [key, fc] of Object.entries(layers)) {
    out[key] = isPacked(fc) ? decodeOnce(fc) : fc;
  }
  return out;
}
