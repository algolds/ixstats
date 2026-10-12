/**
 * UPG v2 — Vector smoothing: Douglas-Peucker decimation, splines through polygon vertices, harmonic perturbation.
 */

/** Exported rings are held to this latitude (Web Mercator's limit is 85.05°). */
export const MAX_LATITUDE = 85;

/**
 * Length of a spline end tangent as a fraction of its segment. A full Catmull-Rom curve (1) swells the area of
 * a small region by up to 9% (a two-cell country); at 0.35 a region of 13 cells or more is within 3% of its cells
 * and the smallest within 5%, at the price of tighter corners.
 */
const SPLINE_TENSION = 0.35;

/**
 * The edges of the map. A border that runs along an edge is a straight chain, and the chain meeting it at a
 * sharp angle must not sag across it: a splined point on the far side of an edge is put `inset` inside.
 */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  inset: number;
}

function holdInside(value: number, min: number, max: number, inset: number): number {
  if (value < min) return min + inset;
  if (value > max) return max - inset;
  return value;
}

function distance(a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Point halfway along the spline segment p1 → p2, with p0 and p3 the points around it. A cubic Hermite
 * segment whose end tangents point along p0 → p2 and p1 → p3 and are SPLINE_TENSION times as long as the
 * segment itself: the curve passes through every control point, like a Catmull-Rom spline, yet a long
 * neighbouring segment cannot throw a short one into a loop, and a point never moves more than a quarter of
 * SPLINE_TENSION of its segment off the chord. Swapping the direction of travel gives the same point.
 */
function splineMidpoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): [number, number] {
  const length = distance(p1, p2);
  const inLength = distance(p0, p2) || 1;
  const outLength = distance(p1, p3) || 1;
  const scale = (length / 8) * SPLINE_TENSION;
  return [
    (p1[0] + p2[0]) / 2 + scale * ((p2[0] - p0[0]) / inLength - (p3[0] - p1[0]) / outLength),
    (p1[1] + p2[1]) / 2 + scale * ((p2[1] - p0[1]) / inLength - (p3[1] - p1[1]) / outLength),
  ];
}

/** One refinement pass: every segment gains the spline point halfway along it. */
function refine(points: [number, number][], closed: boolean, bounds?: Bounds): [number, number][] {
  // A closed ring repeats its first point at the end; an open chain keeps its ends fixed
  const n = closed ? points.length - 1 : points.length;
  const at = (i: number) =>
    closed ? points[(i + n) % n]! : points[Math.max(0, Math.min(n - 1, i))]!;
  const refined: [number, number][] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const mid = splineMidpoint(at(i - 1), at(i), at(i + 1), at(i + 2));
    if (bounds) {
      mid[0] = holdInside(mid[0], bounds.minX, bounds.maxX, bounds.inset);
      mid[1] = holdInside(mid[1], bounds.minY, bounds.maxY, bounds.inset);
    }
    refined.push(points[i]!, mid);
  }
  refined.push(closed ? [refined[0]![0], refined[0]![1]] : points[n - 1]!);
  return refined;
}

/**
 * Smooth a closed polygon ring with a spline through its vertices. Replaces sharp polygon corners with
 * continuous curves; each pass doubles the number of vertices. New points are held within `bounds`.
 */
export function catmullRomSmooth(
  ring: [number, number][],
  passes: number = 3,
  bounds?: Bounds
): [number, number][] {
  if (ring.length < 4 || passes <= 0) return ring;
  let current = ring;
  for (let p = 0; p < passes; p++) current = refine(current, true, bounds);
  return current;
}

/**
 * Smooth an open chain of a ring (the stretch of border between two corners) the same way. Its end points
 * stay where they are and the curve leaves each of them along the chain's first and last segment, so a
 * corner stays a corner and the result depends on the chain alone.
 */
export function catmullRomSmoothChain(
  chain: [number, number][],
  passes: number = 3,
  bounds?: Bounds
): [number, number][] {
  if (chain.length < 3 || passes <= 0) return chain;
  let current = chain;
  for (let p = 0; p < passes; p++) current = refine(current, false, bounds);
  return current;
}

/**
 * Smooth an open polyline (e.g. rivers) using Catmull-Rom spline interpolation.
 */
export function catmullRomSmoothLine(
  line: [number, number][],
  passes: number = 3
): [number, number][] {
  if (line.length < 3 || passes <= 0) return line;

  let current = line;

  for (let p = 0; p < passes; p++) {
    const next: [number, number][] = [];
    const len = current.length;

    for (let i = 0; i < len - 1; i++) {
      const p0 = current[Math.max(0, i - 1)]!;
      const p1 = current[i]!;
      const p2 = current[i + 1]!;
      const p3 = current[Math.min(len - 1, i + 2)]!;

      for (let tStep = 0; tStep < 2; tStep++) {
        const t = tStep * 0.5;
        const tt = t * t;
        const ttt = tt * t;

        const q0 = -0.5 * ttt + tt - 0.5 * t;
        const q1 = 1.5 * ttt - 2.5 * tt + 1.0;
        const q2 = -1.5 * ttt + 2.0 * tt + 0.5 * t;
        const q3 = 0.5 * ttt - 0.5 * tt;

        const x = p0[0] * q0 + p1[0] * q1 + p2[0] * q2 + p3[0] * q3;
        const y = p0[1] * q0 + p1[1] * q1 + p2[1] * q2 + p3[1] * q3;
        next.push([x, y]);
      }
    }

    next.push([current[len - 1]![0], current[len - 1]![1]]);
    current = next;
  }

  return current;
}

/**
 * Ramer-Douglas-Peucker algorithm for polyline/ring vertex decimation.
 * Strips high-frequency Voronoi cell chatter ($120^\circ$ direction flips every few meters)
 * before curve smoothing.
 */
export function simplifyRing(
  ring: [number, number][],
  tolerance: number = 0.012
): [number, number][] {
  if (ring.length <= 4 || tolerance <= 0) return ring;

  const isClosed =
    ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1];

  const points = isClosed ? ring.slice(0, -1) : ring;
  const n = points.length;
  if (n <= 3) return ring;

  function perpendicularDistance(
    pt: [number, number],
    lineStart: [number, number],
    lineEnd: [number, number]
  ): number {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    const magSq = dx * dx + dy * dy;
    if (magSq === 0) {
      const px = pt[0] - lineStart[0];
      const py = pt[1] - lineStart[1];
      return Math.sqrt(px * px + py * py);
    }
    const u = ((pt[0] - lineStart[0]) * dx + (pt[1] - lineStart[1]) * dy) / magSq;
    const clampedU = Math.max(0, Math.min(1, u));
    const projX = lineStart[0] + clampedU * dx;
    const projY = lineStart[1] + clampedU * dy;
    const rx = pt[0] - projX;
    const ry = pt[1] - projY;
    return Math.sqrt(rx * rx + ry * ry);
  }

  function rdp(
    pts: [number, number][],
    startIdx: number,
    endIdx: number,
    sqTolerance: number,
    out: [number, number][]
  ) {
    let maxDist = 0;
    let index = startIdx;

    for (let i = startIdx + 1; i < endIdx; i++) {
      const dist = perpendicularDistance(pts[i]!, pts[startIdx]!, pts[endIdx]!);
      if (dist > maxDist) {
        index = i;
        maxDist = dist;
      }
    }

    if (maxDist > sqTolerance) {
      if (index - startIdx > 1) rdp(pts, startIdx, index, sqTolerance, out);
      out.push(pts[index]!);
      if (endIdx - index > 1) rdp(pts, index, endIdx, sqTolerance, out);
    }
  }

  const result: [number, number][] = [points[0]!];
  rdp(points, 0, n - 1, tolerance, result);
  result.push(points[n - 1]!);

  if (isClosed) {
    result.push([result[0]![0], result[0]![1]]);
  }

  return result.length >= 4 ? result : ring;
}

/**
 * Continuous multi-octave harmonic noise perturbation directly on vector coordinates
 * matching IxWorld vector synthesis engine.
 */
export function perturbRing(
  ring: [number, number][],
  seed: number = 42,
  frequency: number = 0.08,
  amplitude: number = 0.008
): [number, number][] {
  if (ring.length < 3) return ring;

  const perturbed: [number, number][] = [];
  const len = ring.length;

  for (let i = 0; i < len; i++) {
    const [lng, lat] = ring[i]!;
    const n1 = Math.sin(lng * frequency + seed) * Math.cos(lat * frequency + seed * 0.5);
    const n2 =
      Math.sin(lng * frequency * 2.5 - seed * 1.3) *
      Math.cos(lat * frequency * 2.5 + seed * 2.1) *
      0.5;

    const dx = (n1 + n2) * amplitude;
    const dy = (n2 - n1) * amplitude * 0.8;

    const newLng = Math.max(-180, Math.min(180, lng + dx));
    const newLat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat + dy));

    perturbed.push([Math.round(newLng * 10000) / 10000, Math.round(newLat * 10000) / 10000]);
  }

  return perturbed;
}
