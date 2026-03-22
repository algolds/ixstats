/**
 * Province Alignment Engine
 *
 * Pure math functions for aligning imported province geometries
 * to a country's existing border polygon.
 *
 * Three alignment modes:
 * 1. Reference Points — user-placed 3+ point pairs → least-squares affine
 * 2. Auto-Align — ICP-inspired shape matching of province outline to country border
 * 3. Manual — interactive drag/rotate/scale
 *
 * All functions operate on GeoJSON coordinates (WGS84 [lng, lat]).
 * No React, no database dependencies — purely functional.
 */

import type { Position, Polygon, MultiPolygon } from "geojson";
import type {
  AffineMatrix,
  ReferencePoint,
  AlignmentResult,
  ManualTransform,
  ProvinceFeature,
} from "./types";

// ──────────────────────────────────────────────
// Identity Transform
// ──────────────────────────────────────────────

export const IDENTITY_MATRIX: AffineMatrix = {
  a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0,
};

// ──────────────────────────────────────────────
// Affine Transform from Reference Points
// ──────────────────────────────────────────────

/**
 * Compute least-squares affine transform from 3+ reference point pairs.
 * Returns the 6-parameter affine matrix that best maps source → target.
 *
 * For < 3 points, computes a similarity transform (translate + uniform scale + rotation).
 * For >= 3 points, computes a full affine (includes shear).
 */
export function computeAffineFromReferencePoints(
  points: ReferencePoint[]
): AlignmentResult {
  if (points.length < 2) {
    return { matrix: IDENTITY_MATRIX, rmse: Infinity, matchCount: 0 };
  }

  const n = points.length;

  if (n === 2) {
    // Similarity transform from 2 points
    const matrix = computeSimilarityTransform(
      points.map((p) => p.source),
      points.map((p) => p.target)
    );
    const rmse = computeRMSE(points, matrix);
    return { matrix, rmse, matchCount: 2 };
  }

  // Full affine from 3+ points using least-squares
  // We solve: [a b tx; c d ty] minimizing sum of squared residuals
  // System: for each point (sx, sy) → (tx, ty):
  //   a*sx + b*sy + tx = target_x
  //   c*sx + d*sy + ty = target_y

  let sumSx = 0, sumSy = 0, sumTx = 0, sumTy = 0;
  let sumSxSx = 0, sumSxSy = 0, sumSySy = 0;
  let sumSxTx = 0, sumSyTx = 0, sumSxTy = 0, sumSyTy = 0;

  for (const p of points) {
    const sx = p.source[0]!, sy = p.source[1]!;
    const tx = p.target[0]!, ty = p.target[1]!;

    sumSx += sx; sumSy += sy; sumTx += tx; sumTy += ty;
    sumSxSx += sx * sx; sumSxSy += sx * sy; sumSySy += sy * sy;
    sumSxTx += sx * tx; sumSyTx += sy * tx;
    sumSxTy += sx * ty; sumSyTy += sy * ty;
  }

  // Solve the 3x3 system for X-axis: [sumSxSx, sumSxSy, sumSx; sumSxSy, sumSySy, sumSy; sumSx, sumSy, n] * [a, b, tx]' = [sumSxTx, sumSyTx, sumTx]'
  const A = [
    [sumSxSx, sumSxSy, sumSx],
    [sumSxSy, sumSySy, sumSy],
    [sumSx, sumSy, n],
  ];
  const bX = [sumSxTx, sumSyTx, sumTx];
  const bY = [sumSxTy, sumSyTy, sumTy];

  const solX = solve3x3(A, bX);
  const solY = solve3x3(A, bY);

  if (!solX || !solY) {
    // Degenerate — fall back to similarity
    const matrix = computeSimilarityTransform(
      points.map((p) => p.source),
      points.map((p) => p.target)
    );
    const rmse = computeRMSE(points, matrix);
    return { matrix, rmse, matchCount: n };
  }

  const matrix: AffineMatrix = {
    a: solX[0]!, b: solX[1]!, tx: solX[2]!,
    c: solY[0]!, d: solY[1]!, ty: solY[2]!,
  };

  const rmse = computeRMSE(points, matrix);
  return { matrix, rmse, matchCount: n };
}

// ──────────────────────────────────────────────
// ICP Auto-Alignment
// ──────────────────────────────────────────────

/**
 * Auto-align province outline to country border using ICP-inspired algorithm.
 *
 * Steps:
 * 1. Compute outer boundary (convex hull) of all province geometries
 * 2. Initial estimate: align bounding boxes (translation + scale)
 * 3. Iteratively: find nearest border point for each outline point, recompute transform
 * 4. Converge when RMSE delta < threshold
 *
 * @param provinces - Array of province features to align
 * @param countryBorder - Target country border polygon
 * @param maxIterations - Maximum ICP iterations (default: 50)
 * @param convergenceThreshold - Stop when RMSE change < this value in degrees (default: 0.001)
 */
export function autoAlignToCountryBorder(
  provinces: ProvinceFeature[],
  countryBorder: Polygon | MultiPolygon,
  _maxIterations = 50,
  _convergenceThreshold = 0.001
): AlignmentResult {
  // Step 1: Extract outline vertices from all provinces
  const sourceVertices = extractOuterBoundaryVertices(provinces);
  if (sourceVertices.length < 3) {
    return { matrix: IDENTITY_MATRIX, rmse: Infinity, matchCount: 0, iterations: 0 };
  }

  // Step 2: Extract border vertices from country
  const targetVertices = extractGeometryVertices(countryBorder);
  if (targetVertices.length < 3) {
    return { matrix: IDENTITY_MATRIX, rmse: Infinity, matchCount: 0, iterations: 0 };
  }

  // Step 3: Bounding box alignment (with SVG Y-flip)
  // This maps SVG pixel space → geographic space, flipping Y-axis and scaling to fit.
  //
  // NOTE: ICP refinement is intentionally disabled. Province outer rings include
  // internal shared borders that are NOT on the country border. Matching these
  // internal vertices to the nearest border point distorts the transform badly,
  // compressing provinces to near-zero area. The bbox alignment alone produces
  // correct placement and scale.
  const currentMatrix = computeBBoxAlignment(sourceVertices, targetVertices);

  // Compute RMSE for diagnostics (transform source → check distance to nearest target)
  const transformed = sourceVertices.map((v) => applyAffineToPoint(v, currentMatrix));
  let sumSq = 0;
  const sampleStep = Math.max(1, Math.ceil(transformed.length / 200));
  let sampleCount = 0;
  for (let i = 0; i < transformed.length; i += sampleStep) {
    const nearest = findNearestPoint(transformed[i]!, targetVertices);
    if (nearest) {
      const dx = transformed[i]![0]! - nearest[0]!;
      const dy = transformed[i]![1]! - nearest[1]!;
      sumSq += dx * dx + dy * dy;
      sampleCount++;
    }
  }
  const rmse = sampleCount > 0 ? Math.sqrt(sumSq / sampleCount) : Infinity;

  return {
    matrix: currentMatrix,
    rmse,
    matchCount: sourceVertices.length,
    iterations: 0,
  };
}

// ──────────────────────────────────────────────
// Manual Transform
// ──────────────────────────────────────────────

/**
 * Convert manual transform parameters to an affine matrix.
 * Operations are applied in order: scale → rotate → translate.
 * Rotation center is the centroid of the provinces.
 */
export function manualTransformToMatrix(
  transform: ManualTransform,
  center: Position
): AffineMatrix {
  const { translate, rotate, scale } = transform;
  const radians = (rotate * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = center[0]!;
  const cy = center[1]!;

  // Combined matrix: T * R(center) * S(center)
  // = translate * rotate-about-center * scale-about-center
  return {
    a: scale * cos,
    b: -scale * sin,
    c: scale * sin,
    d: scale * cos,
    tx: cx * (1 - scale * cos) + cy * scale * sin + translate[0],
    ty: cy * (1 - scale * cos) - cx * scale * sin + translate[1],
  };
}

// ──────────────────────────────────────────────
// Geometry Transform Functions
// ──────────────────────────────────────────────

/** Apply affine transform to a single point. */
export function applyAffineToPoint(point: Position, matrix: AffineMatrix): Position {
  return [
    matrix.a * point[0]! + matrix.b * point[1]! + matrix.tx,
    matrix.c * point[0]! + matrix.d * point[1]! + matrix.ty,
  ];
}

/** Signed area of a ring via the shoelace formula. Positive = CCW, negative = CW. */
function signedRingArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
  }
  return area / 2;
}

/** Ensure a ring has the correct winding order per GeoJSON RFC 7946. */
function ensureWinding(ring: Position[], shouldBeCCW: boolean): Position[] {
  const area = signedRingArea(ring);
  if (area === 0) return ring; // Degenerate ring
  if (shouldBeCCW && area < 0) return ring.slice().reverse();
  if (!shouldBeCCW && area > 0) return ring.slice().reverse();
  return ring;
}

/** Apply affine transform to a Polygon or MultiPolygon geometry. */
export function applyAffineToGeometry(
  geometry: Polygon | MultiPolygon,
  matrix: AffineMatrix
): Polygon | MultiPolygon {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map((ring, i) => {
        const transformed = ring.map((coord) => applyAffineToPoint(coord, matrix));
        // GeoJSON RFC 7946: outer ring (index 0) = CCW, holes = CW
        return ensureWinding(transformed, i === 0);
      }),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((polygon) =>
      polygon.map((ring, i) => {
        const transformed = ring.map((coord) => applyAffineToPoint(coord, matrix));
        return ensureWinding(transformed, i === 0);
      })
    ),
  };
}

/** Apply affine transform to an array of ProvinceFeatures. */
export function applyAffineToProvinces(
  provinces: ProvinceFeature[],
  matrix: AffineMatrix
): ProvinceFeature[] {
  return provinces.map((p) => {
    const geometry = applyAffineToGeometry(p.geometry, matrix);
    const centroid = applyAffineToPoint(p.centroid, matrix) as [number, number];
    const corners = [
      applyAffineToPoint([p.bbox[0], p.bbox[1]], matrix),
      applyAffineToPoint([p.bbox[2], p.bbox[3]], matrix),
    ];
    const bbox: [number, number, number, number] = [
      Math.min(corners[0]![0]!, corners[1]![0]!),
      Math.min(corners[0]![1]!, corners[1]![1]!),
      Math.max(corners[0]![0]!, corners[1]![0]!),
      Math.max(corners[0]![1]!, corners[1]![1]!),
    ];

    return { ...p, geometry, centroid, bbox };
  });
}

// ──────────────────────────────────────────────
// Boundary Snapping
// ──────────────────────────────────────────────

/** Information about a snapped vertex */
interface SnapInfo {
  coord: Position;
  snapped: boolean;
  /** Index of the border edge this vertex snapped to */
  edgeIndex: number;
  /** Parameter t along the border edge (0=start, 1=end) */
  t: number;
}

/**
 * Extract the ordered border ring vertices from a country border geometry.
 * For MultiPolygon, uses the outer ring of the largest polygon.
 */
export function extractBorderRing(countryBorder: Polygon | MultiPolygon): Position[] {
  if (countryBorder.type === "Polygon") {
    return countryBorder.coordinates[0] ?? [];
  }
  // MultiPolygon: pick the largest outer ring by vertex count
  let best: Position[] = [];
  for (const poly of countryBorder.coordinates) {
    const ring = poly[0];
    if (ring && ring.length > best.length) best = ring;
  }
  return best;
}

/**
 * Extract ALL outer rings from a country border geometry.
 * For MultiPolygon, returns the outer ring of every polygon (supports islands).
 */
export function extractAllBorderRings(countryBorder: Polygon | MultiPolygon): Position[][] {
  if (countryBorder.type === "Polygon") {
    const ring = countryBorder.coordinates[0];
    return ring && ring.length > 0 ? [ring] : [];
  }
  return countryBorder.coordinates
    .map((poly) => poly[0] ?? [])
    .filter((r) => r.length > 0);
}

/**
 * Find the border ring nearest to a given geometry.
 * Uses the centroid of the geometry's first ring to pick the closest ring.
 */
export function findNearestBorderRing(
  geometry: Polygon | MultiPolygon,
  countryBorder: Polygon | MultiPolygon
): Position[] {
  const rings = extractAllBorderRings(countryBorder);
  if (rings.length <= 1) return rings[0] ?? [];

  // Compute centroid of the geometry
  const firstRing =
    geometry.type === "Polygon"
      ? geometry.coordinates[0]
      : geometry.coordinates[0]?.[0];
  if (!firstRing || firstRing.length === 0) return rings[0] ?? [];

  let cx = 0, cy = 0;
  for (const pt of firstRing) {
    cx += pt[0]!;
    cy += pt[1]!;
  }
  cx /= firstRing.length;
  cy /= firstRing.length;
  const centroid: Position = [cx, cy];

  let bestRing = rings[0]!;
  let bestDist = Infinity;
  for (const ring of rings) {
    for (const pt of ring) {
      const d = distanceDeg(centroid, pt);
      if (d < bestDist) {
        bestDist = d;
        bestRing = ring;
      }
    }
  }
  return bestRing;
}

/**
 * Snap provinces to border with multi-ring support (handles islands).
 * For each province, finds the nearest border ring and snaps to that ring.
 */
export function snapProvincesToBorderMultiRing(
  provinces: ProvinceFeature[],
  countryBorder: Polygon | MultiPolygon,
  tolerance: number
): ProvinceFeature[] {
  return provinces.map((province) => {
    if (!province.included) return province;

    const ring = findNearestBorderRing(province.geometry, countryBorder);
    const edges: Array<[Position, Position]> = [];
    for (let i = 0; i < ring.length - 1; i++) {
      edges.push([ring[i]!, ring[i + 1]!]);
    }

    const geometry = snapGeometryToBorder(province.geometry, edges, ring, tolerance);
    return { ...province, geometry };
  });
}

/**
 * Snap province outer vertices to the country border and conform edges
 * to follow the actual border curve.
 *
 * For each province ring:
 * 1. Snap vertices within tolerance to the nearest border point
 * 2. For consecutive snapped vertices, insert intermediate border vertices
 *    so the province edge follows the actual border curve
 * 3. Ensure the result is a closed polygon
 */
export function snapProvincesToBorder(
  provinces: ProvinceFeature[],
  countryBorder: Polygon | MultiPolygon,
  tolerance: number
): ProvinceFeature[] {
  const borderRing = extractBorderRing(countryBorder);
  // Extract edges from the outer ring only (not holes) so edge indices match borderRing
  const borderEdges: Array<[Position, Position]> = [];
  for (let i = 0; i < borderRing.length - 1; i++) {
    borderEdges.push([borderRing[i]!, borderRing[i + 1]!]);
  }

  return provinces.map((province) => {
    if (!province.included) return province;
    const geometry = snapGeometryToBorder(
      province.geometry, borderEdges, borderRing, tolerance
    );
    return { ...province, geometry };
  });
}

export function snapGeometryToBorder(
  geometry: Polygon | MultiPolygon,
  borderEdges: Array<[Position, Position]>,
  borderRing: Position[],
  tolerance: number
): Polygon | MultiPolygon {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map((ring, i) =>
        // Only snap outer ring (index 0); holes stay as-is
        i === 0 ? snapAndConformRing(ring, borderEdges, borderRing, tolerance) : ring
      ),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((polygon) =>
      polygon.map((ring, i) =>
        i === 0 ? snapAndConformRing(ring, borderEdges, borderRing, tolerance) : ring
      )
    ),
  };
}

/**
 * Snap a ring's vertices to the border and insert border path segments
 * between consecutive snapped vertices.
 */
function snapAndConformRing(
  ring: Position[],
  borderEdges: Array<[Position, Position]>,
  borderRing: Position[],
  tolerance: number
): Position[] {
  if (ring.length < 3 || borderRing.length < 3) return ring;

  // Step 1: Determine snap info for each vertex
  const snapInfos: SnapInfo[] = ring.map((coord) => {
    let bestDist = Infinity;
    let bestProj: Position = coord;
    let bestEdge = -1;
    let bestT = 0;

    for (let ei = 0; ei < borderEdges.length; ei++) {
      const [a, b] = borderEdges[ei]!;
      const proj = projectPointToSegment(coord, a, b);
      const dist = distanceDeg(coord, proj);
      if (dist < bestDist && dist <= tolerance) {
        bestDist = dist;
        bestProj = proj;
        bestEdge = ei;
        // Compute parameter t along the edge
        const edgeLen = distanceDeg(a, b);
        bestT = edgeLen > 1e-12 ? distanceDeg(a, proj) / edgeLen : 0;
      }
    }

    return {
      coord: bestEdge >= 0 ? bestProj : coord,
      snapped: bestEdge >= 0,
      edgeIndex: bestEdge,
      t: bestT,
    };
  });

  // Step 2: Build new ring, inserting border vertices between consecutive snapped points
  const result: Position[] = [];
  const n = snapInfos.length;
  // Skip the last vertex if it's the closure point (will re-close at end)
  const ringLen = (n > 1 && coordsEqual(ring[0]!, ring[n - 1]!)) ? n - 1 : n;

  for (let i = 0; i < ringLen; i++) {
    const curr = snapInfos[i]!;
    const next = snapInfos[(i + 1) % ringLen]!;

    // Add current vertex
    result.push(curr.coord);

    // If both current and next are snapped to the border, insert border path between them
    if (curr.snapped && next.snapped && curr.edgeIndex >= 0 && next.edgeIndex >= 0) {
      const borderPts = getBorderPathBetween(
        curr.edgeIndex, curr.t,
        next.edgeIndex, next.t,
        borderRing, borderEdges.length
      );
      // Insert intermediate border vertices (skip first and last — they're curr/next)
      for (const bp of borderPts) {
        result.push(bp);
      }
    }
  }

  // Close the ring
  if (result.length > 0) {
    const first = result[0]!;
    const last = result[result.length - 1]!;
    if (!coordsEqual(first, last)) {
      result.push([first[0]!, first[1]!]);
    }
  }

  return result;
}

/**
 * Get the border vertices between two points on the border ring.
 * Walks the border ring in the shorter direction.
 * Returns only the INTERMEDIATE vertices (not the start/end snap points).
 */
function getBorderPathBetween(
  startEdge: number,
  startT: number,
  endEdge: number,
  endT: number,
  borderRing: Position[],
  totalEdges: number
): Position[] {
  if (startEdge === endEdge) {
    // Same edge — no intermediate vertices needed
    return [];
  }

  // Border ring vertex indices: edge i goes from borderRing[i] to borderRing[i+1]
  // So the vertex AFTER edge startEdge is borderRing[startEdge + 1]
  // and the vertex AT the start of edge endEdge is borderRing[endEdge]

  const ringLen = borderRing.length - 1; // last point == first point (closure)
  if (ringLen <= 0) return [];

  // Calculate forward and backward distances (in edge count)
  const forwardDist = ((endEdge - startEdge) + totalEdges) % totalEdges;
  const backwardDist = totalEdges - forwardDist;

  // Cap to avoid inserting excessive vertices for nearly-complete border walks
  const maxInsert = Math.floor(ringLen * 0.4); // Don't walk more than 40% of the border

  const pts: Position[] = [];

  if (forwardDist <= backwardDist && forwardDist <= maxInsert) {
    // Walk forward: collect vertices from startEdge+1 to endEdge (inclusive)
    // These are the border ring vertices between the two snap points.
    for (let step = 1; step <= forwardDist; step++) {
      const vertIdx = (startEdge + step) % ringLen;
      pts.push(borderRing[vertIdx]!);
    }
  } else if (backwardDist <= maxInsert) {
    // Walk backward: collect vertices from startEdge back to endEdge+1 (inclusive)
    for (let step = 0; step < backwardDist; step++) {
      const vertIdx = ((startEdge - step) + ringLen) % ringLen;
      pts.push(borderRing[vertIdx]!);
    }
  }
  // If both distances exceed maxInsert, return nothing (too far apart on border)

  return pts;
}

/** Check if two coordinates are effectively equal */
function coordsEqual(a: Position, b: Position): boolean {
  return Math.abs(a[0]! - b[0]!) < 1e-10 && Math.abs(a[1]! - b[1]!) < 1e-10;
}

// ──────────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────────

function computeSimilarityTransform(
  source: Position[],
  target: Position[]
): AffineMatrix {
  const n = source.length;
  if (n === 0) return IDENTITY_MATRIX;

  // Compute centroids
  const srcCx = source.reduce((s, p) => s + p[0]!, 0) / n;
  const srcCy = source.reduce((s, p) => s + p[1]!, 0) / n;
  const tgtCx = target.reduce((s, p) => s + p[0]!, 0) / n;
  const tgtCy = target.reduce((s, p) => s + p[1]!, 0) / n;

  // Compute rotation + scale via least-squares
  let sumSxTx = 0, sumSxTy = 0, sumSxSx = 0;
  for (let i = 0; i < n; i++) {
    const sx = source[i]![0]! - srcCx;
    const sy = source[i]![1]! - srcCy;
    const tx = target[i]![0]! - tgtCx;
    const ty = target[i]![1]! - tgtCy;

    sumSxTx += sx * tx + sy * ty;
    sumSxTy += sx * ty - sy * tx;
    sumSxSx += sx * sx + sy * sy;
  }

  if (Math.abs(sumSxSx) < 1e-15) return IDENTITY_MATRIX;

  const a = sumSxTx / sumSxSx; // scale * cos(theta)
  const b = sumSxTy / sumSxSx; // scale * sin(theta)

  return {
    a,
    b: -b,
    c: b,
    d: a,
    tx: tgtCx - a * srcCx + b * srcCy,
    ty: tgtCy - b * srcCx - a * srcCy,
  };
}

function computeRMSE(points: ReferencePoint[], matrix: AffineMatrix): number {
  if (points.length === 0) return Infinity;
  let sumSq = 0;
  for (const p of points) {
    const [px, py] = applyAffineToPoint(p.source, matrix);
    const dx = px! - p.target[0]!;
    const dy = py! - p.target[1]!;
    sumSq += dx * dx + dy * dy;
  }
  return Math.sqrt(sumSq / points.length);
}

function computeBBoxAlignment(source: Position[], target: Position[]): AffineMatrix {
  // Compute bounding boxes
  let srcMinX = Infinity, srcMinY = Infinity, srcMaxX = -Infinity, srcMaxY = -Infinity;
  for (const p of source) {
    if (p[0]! < srcMinX) srcMinX = p[0]!;
    if (p[0]! > srcMaxX) srcMaxX = p[0]!;
    if (p[1]! < srcMinY) srcMinY = p[1]!;
    if (p[1]! > srcMaxY) srcMaxY = p[1]!;
  }

  let tgtMinX = Infinity, tgtMinY = Infinity, tgtMaxX = -Infinity, tgtMaxY = -Infinity;
  for (const p of target) {
    if (p[0]! < tgtMinX) tgtMinX = p[0]!;
    if (p[0]! > tgtMaxX) tgtMaxX = p[0]!;
    if (p[1]! < tgtMinY) tgtMinY = p[1]!;
    if (p[1]! > tgtMaxY) tgtMaxY = p[1]!;
  }

  const srcW = srcMaxX - srcMinX || 1;
  const srcH = srcMaxY - srcMinY || 1;
  const tgtW = tgtMaxX - tgtMinX || 1;
  const tgtH = tgtMaxY - tgtMinY || 1;

  // Uniform scale (fit inside)
  const scale = Math.min(tgtW / srcW, tgtH / srcH);

  // Center alignment
  const srcCx = (srcMinX + srcMaxX) / 2;
  const srcCy = (srcMinY + srcMaxY) / 2;
  const tgtCx = (tgtMinX + tgtMaxX) / 2;
  const tgtCy = (tgtMinY + tgtMaxY) / 2;

  // SVG Y-axis points downward while WGS84 latitude increases northward,
  // so we negate the Y scale to flip the orientation.
  return {
    a: scale,
    b: 0,
    c: 0,
    d: -scale,
    tx: tgtCx - scale * srcCx,
    ty: tgtCy + scale * srcCy,
  };
}

function extractOuterBoundaryVertices(provinces: ProvinceFeature[]): Position[] {
  const all: Position[] = [];
  for (const p of provinces) {
    if (!p.included) continue;
    const rings = p.geometry.type === "Polygon"
      ? p.geometry.coordinates
      : p.geometry.coordinates.flat();
    // Only use outer rings (first ring of each polygon)
    if (p.geometry.type === "Polygon") {
      if (rings[0]) all.push(...rings[0]);
    } else {
      for (const polyRings of p.geometry.coordinates) {
        if (polyRings[0]) all.push(...polyRings[0]);
      }
    }
  }
  return all;
}

function extractGeometryVertices(geometry: Polygon | MultiPolygon): Position[] {
  const all: Position[] = [];
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      all.push(...ring);
    }
  } else {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        all.push(...ring);
      }
    }
  }
  return all;
}

function _extractEdges(geometry: Polygon | MultiPolygon): Array<[Position, Position]> {
  const edges: Array<[Position, Position]> = [];
  const addRingEdges = (ring: Position[]) => {
    for (let i = 0; i < ring.length - 1; i++) {
      edges.push([ring[i]!, ring[i + 1]!]);
    }
  };

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) addRingEdges(ring);
  } else {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) addRingEdges(ring);
    }
  }
  return edges;
}

function findNearestPoint(point: Position, candidates: Position[]): Position | null {
  let best: Position | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = distanceDeg(point, c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function projectPointToSegment(p: Position, a: Position, b: Position): Position {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-20) return a;
  const t = Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / lenSq));
  return [a[0]! + t * dx, a[1]! + t * dy];
}

function distanceDeg(a: Position, b: Position): number {
  const dx = a[0]! - b[0]!;
  const dy = a[1]! - b[1]!;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Solve a 3x3 linear system Ax = b via Cramer's rule. */
function solve3x3(A: number[][], b: number[]): number[] | null {
  const det =
    A[0]![0]! * (A[1]![1]! * A[2]![2]! - A[1]![2]! * A[2]![1]!) -
    A[0]![1]! * (A[1]![0]! * A[2]![2]! - A[1]![2]! * A[2]![0]!) +
    A[0]![2]! * (A[1]![0]! * A[2]![1]! - A[1]![1]! * A[2]![0]!);

  if (Math.abs(det) < 1e-15) return null;

  const x0 =
    (b[0]! * (A[1]![1]! * A[2]![2]! - A[1]![2]! * A[2]![1]!) -
      A[0]![1]! * (b[1]! * A[2]![2]! - A[1]![2]! * b[2]!) +
      A[0]![2]! * (b[1]! * A[2]![1]! - A[1]![1]! * b[2]!)) / det;

  const x1 =
    (A[0]![0]! * (b[1]! * A[2]![2]! - A[1]![2]! * b[2]!) -
      b[0]! * (A[1]![0]! * A[2]![2]! - A[1]![2]! * A[2]![0]!) +
      A[0]![2]! * (A[1]![0]! * b[2]! - b[1]! * A[2]![0]!)) / det;

  const x2 =
    (A[0]![0]! * (A[1]![1]! * b[2]! - b[1]! * A[2]![1]!) -
      A[0]![1]! * (A[1]![0]! * b[2]! - b[1]! * A[2]![0]!) +
      b[0]! * (A[1]![0]! * A[2]![1]! - A[1]![1]! * A[2]![0]!)) / det;

  return [x0, x1, x2];
}
