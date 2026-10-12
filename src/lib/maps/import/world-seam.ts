/**
 * The antimeridian in a world bundle. The generator smooths rivers across the seam without wrapping them, so a
 * river reaches about ±205 degrees of longitude, and the bundle allows 360 either way. The realm map stores longitudes
 * within ±180 (its writer rejects anything else) and draws a feature that crosses the seam as parts either side of it,
 * the way the generator already splits polygons. `fitToSeam` does the same for a feature that runs past ±180: it is cut
 * at each seam and every part shifted into range. A feature within ±180 comes back as it is.
 *
 * Pure, so it can run in the browser too.
 */
import type { Geometry, Position } from "geojson";

const SEAM = 180;

/** The turn a longitude is shifted by to land in ±180: 0 within the seams, 1 for (180, 540], -1 for [-540, -180). */
const bandOf = (lng: number) =>
  lng > SEAM ? Math.ceil((lng - SEAM) / 360) : lng < -SEAM ? -Math.ceil((-SEAM - lng) / 360) : 0;

/** The longitudes a band covers, as seen before shifting it back. */
const bandRange = (band: number): [number, number] => [
  band > 0 ? SEAM + 360 * (band - 1) : -SEAM + 360 * band,
  band >= 0 ? SEAM + 360 * band : -SEAM + 360 * (band + 1),
];

const shifted = (position: Position, band: number): Position => [
  position[0]! - 360 * band,
  ...position.slice(1),
];

const samePosition = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];

function positions(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case "LineString":
      return geometry.coordinates;
    case "MultiLineString":
    case "Polygon":
      return geometry.coordinates.flat();
    case "MultiPolygon":
      return geometry.coordinates.flat(2);
    default:
      return [];
  }
}

/** Whether any position of the geometry lies past ±180. */
export const passesSeam = (geometry: Geometry) =>
  positions(geometry).some((position) => Math.abs(position[0]!) > SEAM);

/** A line cut where it crosses a seam, each part shifted into ±180. Parts of fewer than two points are dropped. */
function splitLine(line: Position[]): Position[][] {
  const parts: Position[][] = [];
  let band = bandOf(line[0]![0]!);
  let current: Position[] = [shifted(line[0]!, band)];
  for (const [i, b] of line.entries()) {
    if (i === 0) continue;
    const a = line[i - 1]!;
    const next = bandOf(b[0]!);
    const step = next > band ? 1 : -1;
    for (let j = band; j !== next; j += step) {
      // The seam between band j and j + step, where the segment crosses it
      const x = SEAM + 360 * Math.min(j, j + step);
      const y = a[1]! + ((x - a[0]!) / (b[0]! - a[0]!)) * (b[1]! - a[1]!);
      const exit: Position = [step > 0 ? SEAM : -SEAM, y];
      if (!samePosition(current[current.length - 1]!, exit)) current.push(exit);
      parts.push(current);
      current = [[step > 0 ? -SEAM : SEAM, y]];
    }
    band = next;
    const point = shifted(b, band);
    if (!samePosition(current[current.length - 1]!, point)) current.push(point);
  }
  parts.push(current);
  return parts.filter((part) => part.length >= 2);
}

/** Sutherland-Hodgman against one vertical edge; `keep` says which side stays. A closed ring in, a closed ring out. */
function clipRing(ring: Position[], edge: number, keep: (x: number) => boolean): Position[] {
  const out: Position[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    const aIn = keep(a[0]!);
    if (aIn) out.push(a);
    if (aIn !== keep(b[0]!)) {
      out.push([edge, a[1]! + ((edge - a[0]!) / (b[0]! - a[0]!)) * (b[1]! - a[1]!)]);
    }
  }
  if (out.length > 0) out.push(out[0]!);
  return out;
}

/** The part of a ring inside one band, shifted into ±180; fewer than four positions means nothing is left. */
function ringInBand(ring: Position[], band: number): Position[] {
  const [low, high] = bandRange(band);
  const clipped = clipRing(
    clipRing(ring, low, (x) => x >= low),
    high,
    (x) => x <= high
  );
  return clipped.length >= 4 ? clipped.map((position) => shifted(position, band)) : [];
}

/** A polygon cut into the part inside each band it reaches; its holes go with the part they fall in. */
function splitPolygon(rings: Position[][]): Position[][][] {
  const xs = rings[0]!.map((position) => position[0]!);
  const parts: Position[][][] = [];
  for (let band = bandOf(Math.min(...xs)); band <= bandOf(Math.max(...xs)); band++) {
    const outer = ringInBand(rings[0]!, band);
    if (outer.length === 0) continue;
    parts.push([
      outer,
      ...rings
        .slice(1)
        .map((hole) => ringInBand(hole, band))
        .filter((r) => r.length > 0),
    ]);
  }
  return parts;
}

/**
 * The geometry with every part within ±180: cut at each seam it crosses, parts shifted in. A line becomes a
 * MultiLineString (a LineString when one part is left), a polygon a MultiPolygon. Null when nothing is left.
 */
export function fitToSeam(geometry: Geometry): Geometry | null {
  if (!passesSeam(geometry)) return geometry;
  if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
    const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
    const parts = lines.flatMap(splitLine);
    if (parts.length === 0) return null;
    return parts.length === 1
      ? { type: "LineString", coordinates: parts[0]! }
      : { type: "MultiLineString", coordinates: parts };
  }
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    const parts = polygons.flatMap(splitPolygon);
    return parts.length === 0 ? null : { type: "MultiPolygon", coordinates: parts };
  }
  return geometry;
}
