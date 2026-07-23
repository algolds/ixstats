/**
 * UPG v2 — Chaikin Curve Subdivision & Fractal Edge Perturbation
 *
 * Smooths Voronoi polygon edges so cell boundaries become invisible
 * at 50K+ resolution. Also adds fractal midpoint displacement for
 * coastline complexity.
 */

/**
 * Apply Chaikin's corner-cutting algorithm to smooth a closed polygon ring.
 *
 * Each iteration doubles the vertex count by replacing each edge with two
 * points at 25% and 75% along the edge. The result converges to a
 * quadratic B-spline.
 *
 * @param ring Closed ring (first === last coordinate)
 * @param iterations Number of subdivision passes (2-4 recommended)
 * @returns Smoothed closed ring
 */
export function chaikinSmooth(
  ring: [number, number][],
  iterations: number
): [number, number][] {
  if (ring.length < 4 || iterations <= 0) return ring;

  let current = ring;

  for (let iter = 0; iter < iterations; iter++) {
    const next: [number, number][] = [];
    // Process all edges except the closing edge (last → first)
    const len = current.length - 1; // exclude closing vertex

    for (let i = 0; i < len; i++) {
      const [x0, y0] = current[i]!;
      const [x1, y1] = current[(i + 1) % len]!;

      // Q = 0.75 * P_i + 0.25 * P_{i+1}
      next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      // R = 0.25 * P_i + 0.75 * P_{i+1}
      next.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }

    // Close the ring
    if (next.length > 0) {
      next.push([next[0]![0], next[0]![1]]);
    }

    current = next;
  }

  return current;
}

/**
 * Smooth an open polyline (not closed). Used for rivers.
 *
 * @param line Open polyline coordinates
 * @param iterations Subdivision passes
 * @returns Smoothed polyline (preserves start and end points)
 */
export function chaikinSmoothLine(
  line: [number, number][],
  iterations: number
): [number, number][] {
  if (line.length < 3 || iterations <= 0) return line;

  let current = line;

  for (let iter = 0; iter < iterations; iter++) {
    const next: [number, number][] = [];
    // Preserve first point
    next.push(current[0]!);

    for (let i = 0; i < current.length - 1; i++) {
      const [x0, y0] = current[i]!;
      const [x1, y1] = current[i + 1]!;

      next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      next.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }

    // Preserve last point
    next.push(current[current.length - 1]!);
    current = next;
  }

  return current;
}

/**
 * Smooth a closed polygon ring using Catmull-Rom spline interpolation (tau = 0.5).
 * Replaces sharp polygon corners with continuous spline curves.
 */
export function catmullRomSmooth(
  ring: [number, number][],
  passes: number = 3
): [number, number][] {
  if (ring.length < 4 || passes <= 0) return ring;

  let current = ring;

  for (let p = 0; p < passes; p++) {
    const next: [number, number][] = [];
    const len = current.length - 1; // exclude duplicate closing vertex

    for (let i = 0; i < len; i++) {
      const p0 = current[(i - 1 + len) % len]!;
      const p1 = current[i]!;
      const p2 = current[(i + 1) % len]!;
      const p3 = current[(i + 2) % len]!;

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

    if (next.length > 0) {
      next.push([next[0]![0], next[0]![1]]);
    }
    current = next;
  }

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
 * Add fractal midpoint displacement to an edge.
 * Used for coastline complexity — breaks straight cell edges into
 * natural-looking irregular boundaries.
 *
 * @param p1 Start point
 * @param p2 End point
 * @param roughness Displacement amplitude as fraction of edge length (0-1)
 * @param rng Seeded RNG function
 * @param depth Recursion depth (default 2)
 * @returns Array of intermediate points (excluding p1 and p2)
 */
export function fractalizeEdge(
  p1: [number, number],
  p2: [number, number],
  roughness: number,
  rng: () => number,
  depth: number = 2
): [number, number][] {
  if (depth <= 0) return [];

  const mx = (p1[0] + p2[0]) / 2;
  const my = (p1[1] + p2[1]) / 2;

  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular displacement
  const offset = (rng() - 0.5) * roughness * len;
  const nx = -dy / (len || 1);
  const ny = dx / (len || 1);

  const mid: [number, number] = [mx + nx * offset, my + ny * offset];

  const left = fractalizeEdge(p1, mid, roughness * 0.6, rng, depth - 1);
  const right = fractalizeEdge(mid, p2, roughness * 0.6, rng, depth - 1);

  return [...left, mid, ...right];
}

/**
 * Smooth a polygon ring with optional pre-fractalization.
 * This is the main entry point for export polygon processing.
 *
 * @param ring Closed polygon ring
 * @param smoothPasses Chaikin iterations (0 = no smoothing)
 * @param fractalize Whether to add fractal midpoint displacement first
 * @param roughness Fractal roughness (0-1, only used if fractalize=true)
 * @param rng Seeded RNG (only used if fractalize=true)
 * @returns Processed ring
 */
export function processRing(
  ring: [number, number][],
  smoothPasses: number,
  fractalize: boolean = false,
  roughness: number = 0.15,
  rng?: () => number
): [number, number][] {
  let result = ring;

  if (fractalize && rng && ring.length >= 4) {
    const fractalized: [number, number][] = [];
    const len = ring.length - 1; // exclude closing vertex
    for (let i = 0; i < len; i++) {
      fractalized.push(ring[i]!);
      const intermediates = fractalizeEdge(ring[i]!, ring[(i + 1) % len]!, roughness, rng, 2);
      fractalized.push(...intermediates);
    }
    // Close
    fractalized.push(fractalized[0]!);
    result = fractalized;
  }

  return chaikinSmooth(result, smoothPasses);
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
    ring[0]![0] === ring[ring.length - 1]![0] &&
    ring[0]![1] === ring[ring.length - 1]![1];

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
    const n2 = Math.sin(lng * frequency * 2.5 - seed * 1.3) * Math.cos(lat * frequency * 2.5 + seed * 2.1) * 0.5;

    const dx = (n1 + n2) * amplitude;
    const dy = (n2 - n1) * amplitude * 0.8;

    const newLng = Math.max(-180, Math.min(180, lng + dx));
    const newLat = Math.max(-85, Math.min(85, lat + dy));

    perturbed.push([
      Math.round(newLng * 10000) / 10000,
      Math.round(newLat * 10000) / 10000,
    ]);
  }

  return perturbed;
}
