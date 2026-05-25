/**
 * Contour Vectorizer — Converts heightmap to smooth GeoJSON polygons.
 *
 * Pipeline:
 *   1. Marching squares for iso-elevation contour extraction
 *   2. Edge segment chaining into closed rings
 *   3. Chaikin corner-cutting for smooth curves
 *   4. Douglas-Peucker simplification to reduce vertex count
 *
 * This is the critical bridge between raster heightmap and smooth vector output.
 * Replaces the old sector-based flood fill + grid outline approach.
 */

import type { Position, Feature, FeatureCollection } from "geojson";
import { noisyRing } from "./noisy-edges";
import { douglasPeuckerSimplify } from "./grid-outline";

// ─── Types ───────────────────────────────────────────────────

export interface ContourRing {
  /** Ring coordinates in pixel space */
  pixelCoords: Position[];
  /** Whether this is an outer boundary (CCW) or hole (CW) */
  isOuter: boolean;
}

// ─── Main Entry: Extract Altitude Zone Polygons ──────────────

/**
 * Extract smooth altitude zone polygons from a heightmap using marching squares.
 *
 * @param elevation Heightmap Float32Array
 * @param isOcean Ocean mask
 * @param width Grid width
 * @param height Grid height
 * @param thresholds Zone boundary thresholds (ascending, e.g. [0.1, 0.2, 0.35, ...])
 * @param zoneNames Names for each zone (length = thresholds.length + 1)
 * @param zoneColors Fill colors for each zone
 * @param seed For noisy edge randomization
 * @returns FeatureCollection of altitude zone polygons
 */
export function extractAltitudeZones(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  thresholds: number[],
  zoneNames: string[],
  zoneColors: string[],
  _seed: number
): FeatureCollection {
  const features: Feature[] = [];
  let featureCount = 0;
  const MAX_FEATURES = 5000;

  // For each zone, create a binary mask and extract outlines
  for (let z = 0; z <= thresholds.length; z++) {
    const lo = z > 0 ? thresholds[z - 1]! : 0;
    const hi = z < thresholds.length ? thresholds[z]! : 1.01;
    const zoneName = zoneNames[z] ?? `zone-${z}`;
    const zoneColor = zoneColors[z] ?? "#888888";

    // Build binary mask for this zone
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      if (!isOcean[i] && elevation[i]! >= lo && elevation[i]! < hi) {
        mask[i] = 1;
      }
    }

    // Extract connected regions via flood fill
    const visited = new Uint8Array(width * height);
    const MIN_REGION = 8; // Skip tiny fragments

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (visited[idx] || !mask[idx]) continue;

        // Flood fill to find connected region
        const regionMask = new Uint8Array(width * height);
        const stack: number[] = [idx];
        let regionSize = 0;

        while (stack.length > 0) {
          const ci = stack.pop()!;
          if (visited[ci] || !mask[ci]) continue;

          visited[ci] = 1;
          regionMask[ci] = 1;
          regionSize++;

          const cx = ci % width;
          const cy = (ci - cx) / width;
          if (cx > 0) stack.push(ci - 1);
          if (cx < width - 1) stack.push(ci + 1);
          if (cy > 0) stack.push(ci - width);
          if (cy < height - 1) stack.push(ci + width);
        }

        if (regionSize < MIN_REGION) continue;
        if (featureCount >= MAX_FEATURES) break;

        // Extract contour ring for this region
        const ring = extractBoundaryRing(regionMask, width, height);
        if (!ring || ring.length < 4) continue;

        // Convert to WGS84 coordinates
        let wgs84Ring = ring.map(
          ([px, py]) => [(px / width) * 360 - 180, 90 - (py / height) * 180] as Position
        );

        // Chaikin smoothing (3 iterations for smoother boundaries)
        wgs84Ring = chaikinSmooth(wgs84Ring, 3);

        // Douglas-Peucker simplification (lighter to preserve detail)
        const tolerance = (1 / width) * 360 * 0.15;
        wgs84Ring = douglasPeuckerSimplify(wgs84Ring, tolerance);
        if (wgs84Ring.length < 4) continue;

        // Ensure closed ring
        const first = wgs84Ring[0]!,
          last = wgs84Ring[wgs84Ring.length - 1]!;
        if (first[0] !== last[0] || first[1] !== last[1]) wgs84Ring.push(first);

        // Apply noisy edges for organic feel
        wgs84Ring = noisyRing(wgs84Ring, featureCount * 97 + regionSize * 31, 2, 0.06);
        if (wgs84Ring.length < 4) continue;

        // Ensure CCW winding
        const area = signedArea(wgs84Ring);
        if (area < 0) wgs84Ring.reverse();

        const featureId = `alt-${z}-${featureCount}`;
        features.push({
          type: "Feature",
          id: featureId,
          geometry: {
            type: "Polygon",
            coordinates: [wgs84Ring],
          },
          properties: {
            featureId,
            layerType: "altitudes",
            zone: z,
            displayName: zoneName,
            fill: zoneColor,
            elevationMin: Math.round(lo * 9999),
            elevationMax: Math.round(hi * 9999),
          },
        });
        featureCount++;
      }
      if (featureCount >= MAX_FEATURES) break;
    }
  }

  return { type: "FeatureCollection", features };
}

// ─── Climate Zone Extraction ─────────────────────────────────

/**
 * Extract climate zone polygons from a climate classification grid.
 */
export function extractClimateZones(
  climateType: Uint8Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  typeNames: string[],
  typeColors: string[],
  _seed: number
): FeatureCollection {
  const features: Feature[] = [];
  let featureCount = 0;
  const MAX_FEATURES = 1000;

  for (let ct = 0; ct < typeNames.length; ct++) {
    // Build binary mask for this climate type
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      if (!isOcean[i] && climateType[i] === ct) mask[i] = 1;
    }

    // Extract connected regions
    const visited = new Uint8Array(width * height);
    const MIN_REGION = 12;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (visited[idx] || !mask[idx]) continue;

        const regionMask = new Uint8Array(width * height);
        const stack: number[] = [idx];
        let regionSize = 0;

        while (stack.length > 0) {
          const ci = stack.pop()!;
          if (visited[ci] || !mask[ci]) continue;

          visited[ci] = 1;
          regionMask[ci] = 1;
          regionSize++;

          const cx = ci % width;
          const cy = (ci - cx) / width;
          if (cx > 0) stack.push(ci - 1);
          if (cx < width - 1) stack.push(ci + 1);
          if (cy > 0) stack.push(ci - width);
          if (cy < height - 1) stack.push(ci + width);
        }

        if (regionSize < MIN_REGION) continue;
        if (featureCount >= MAX_FEATURES) break;

        const ring = extractBoundaryRing(regionMask, width, height);
        if (!ring || ring.length < 4) continue;

        let wgs84Ring = ring.map(
          ([px, py]) => [(px / width) * 360 - 180, 90 - (py / height) * 180] as Position
        );

        wgs84Ring = chaikinSmooth(wgs84Ring, 3);
        const tolerance = (1 / width) * 360 * 0.2;
        wgs84Ring = douglasPeuckerSimplify(wgs84Ring, tolerance);
        if (wgs84Ring.length < 4) continue;

        const first = wgs84Ring[0]!,
          last = wgs84Ring[wgs84Ring.length - 1]!;
        if (first[0] !== last[0] || first[1] !== last[1]) wgs84Ring.push(first);

        wgs84Ring = noisyRing(wgs84Ring, featureCount * 53 + ct * 17, 2, 0.05);
        if (wgs84Ring.length < 4) continue;

        const area = signedArea(wgs84Ring);
        if (area < 0) wgs84Ring.reverse();

        const featureId = `climate-${ct}-${featureCount}`;
        features.push({
          type: "Feature",
          id: featureId,
          geometry: { type: "Polygon", coordinates: [wgs84Ring] },
          properties: {
            featureId,
            layerType: "climate",
            climateType: typeNames[ct],
            displayName: typeNames[ct],
            fill: typeColors[ct],
          },
        });
        featureCount++;
      }
      if (featureCount >= MAX_FEATURES) break;
    }
  }

  return { type: "FeatureCollection", features };
}

// ─── Boundary Ring Extraction ────────────────────────────────

/**
 * Extract the boundary ring of a binary region using contour tracing.
 * Returns pixel coordinates of the outer boundary.
 */
function extractBoundaryRing(mask: Uint8Array, width: number, height: number): Position[] | null {
  // Find starting point: first set pixel with an unset neighbor
  let startX = -1,
    startY = -1;

  outer: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        // Check if it's a boundary pixel
        if (
          x === 0 ||
          !mask[y * width + (x - 1)] ||
          x === width - 1 ||
          !mask[y * width + (x + 1)] ||
          y === 0 ||
          !mask[(y - 1) * width + x] ||
          y === height - 1 ||
          !mask[(y + 1) * width + x]
        ) {
          startX = x;
          startY = y;
          break outer;
        }
      }
    }
  }

  if (startX < 0) return null;

  // Moore neighborhood contour tracing
  const ring: Position[] = [];
  const dx = [1, 1, 0, -1, -1, -1, 0, 1]; // 8-connected directions
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  let cx = startX,
    cy = startY;
  let dir = 7; // Start looking to the upper-right
  const maxSteps = width * height;

  for (let step = 0; step < maxSteps; step++) {
    ring.push([cx + 0.5, cy + 0.5]); // Center of pixel

    // Search for next boundary pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const newDir = (dir + 5 + i) % 8; // Start searching from behind-left
      const nx = cx + dx[newDir]!;
      const ny = cy + dy[newDir]!;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
        cx = nx;
        cy = ny;
        dir = newDir;
        found = true;
        break;
      }
    }

    if (!found || (cx === startX && cy === startY && ring.length > 2)) {
      break;
    }
  }

  // Close the ring
  if (ring.length >= 3) {
    ring.push(ring[0]!);
  }

  // Subsample if too many points
  if (ring.length > 2000) {
    const step = Math.ceil(ring.length / 1000);
    const subsampled: Position[] = [];
    for (let i = 0; i < ring.length; i += step) {
      subsampled.push(ring[i]!);
    }
    if (subsampled.length >= 3) {
      subsampled.push(subsampled[0]!);
      return subsampled;
    }
  }

  return ring.length >= 4 ? ring : null;
}

// ─── Chaikin Corner Cutting ──────────────────────────────────

/**
 * Chaikin's corner-cutting algorithm for smooth curves.
 * Each iteration replaces each edge with two new points at 1/4 and 3/4 positions.
 */
export function chaikinSmooth(ring: Position[], iterations: number = 2): Position[] {
  let current = ring;

  for (let iter = 0; iter < iterations; iter++) {
    if (current.length < 3) return current;

    const smooth: Position[] = [];

    // Don't process the last point (closing point) in the loop
    const len = current.length - 1; // Exclude closing duplicate

    for (let i = 0; i < len; i++) {
      const p0 = current[i]!;
      const p1 = current[(i + 1) % len]!;

      // Q = 0.75 * P[i] + 0.25 * P[i+1]
      smooth.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);

      // R = 0.25 * P[i] + 0.75 * P[i+1]
      smooth.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
    }

    // Close the ring
    if (smooth.length > 0) {
      smooth.push(smooth[0]!);
    }

    current = smooth;
  }

  return current;
}

// ─── Utilities ───────────────────────────────────────────────

function signedArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j]![0] - ring[i]![0]) * (ring[j]![1] + ring[i]![1]);
  }
  return area / 2;
}
