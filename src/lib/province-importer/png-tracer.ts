/**
 * PNG Province Tracer (Client-Side)
 *
 * Traces province boundaries from PNG images using color segmentation.
 * Runs entirely in the browser using Canvas API — no server dependencies.
 *
 * For server-side PNG processing, falls back to the existing png-to-svg.ts pipeline.
 */

import type { ProvinceFeature, PngTracerConfig, TracedRegion } from "./types";

const DEFAULT_CONFIG: Required<PngTracerConfig> = {
  minRegionPixels: 100,
  colorThreshold: 30,
  simplifyTolerance: 2,
  ignoreColors: ["#000000", "#ffffff", "#000", "#fff"],
};

// ──────────────────────────────────────────────
// Main Entry Point
// ──────────────────────────────────────────────

/**
 * Trace province regions from a PNG image.
 *
 * @param imageData - ImageData from a canvas context
 * @param imageWidth - Width of the image in pixels
 * @param imageHeight - Height of the image in pixels
 * @param config - Tracer configuration
 * @returns Array of traced regions in pixel coordinates
 */
export function traceProvincesFromPng(
  imageData: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  config: PngTracerConfig = {}
): TracedRegion[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Step 1: Extract unique fill colors
  const colorMap = buildColorMap(imageData, imageWidth, imageHeight, cfg.colorThreshold);

  // Step 2: Filter out ignored colors and small regions
  const ignoreSet = new Set(cfg.ignoreColors.map((c) => c.toLowerCase()));
  const regions: TracedRegion[] = [];

  for (const [hex, pixels] of colorMap) {
    if (ignoreSet.has(hex)) continue;
    if (pixels.length < cfg.minRegionPixels) continue;

    // Step 3: Trace boundary of each region
    const mask = createBinaryMask(imageData, imageWidth, imageHeight, hex, cfg.colorThreshold);
    const boundary = traceBoundary(mask, imageWidth, imageHeight);

    if (boundary.length < 4) continue;

    // Step 4: Simplify boundary
    const simplified = douglasPeucker(boundary, cfg.simplifyTolerance);
    if (simplified.length < 4) continue;

    // Close the ring
    if (simplified[0]![0] !== simplified[simplified.length - 1]![0] ||
        simplified[0]![1] !== simplified[simplified.length - 1]![1]) {
      simplified.push([...simplified[0]!]);
    }

    regions.push({
      color: hex,
      boundary: simplified,
      areaPixels: pixels.length,
    });
  }

  // Sort by area (largest first)
  regions.sort((a, b) => b.areaPixels - a.areaPixels);

  return regions;
}

/**
 * Convert traced regions to ProvinceFeatures.
 * Coordinates remain in pixel space — alignment engine handles the transform.
 */
export function tracedRegionsToProvinces(
  regions: TracedRegion[]
): ProvinceFeature[] {
  return regions.map((region, i) => {
    const coords = region.boundary.map((p) => [p[0]!, p[1]!] as [number, number]);

    // Calculate centroid
    let cx = 0, cy = 0;
    for (const [x, y] of coords) {
      cx += x; cy += y;
    }
    cx /= coords.length;
    cy /= coords.length;

    // Calculate bbox
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of coords) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    return {
      sourceId: `region_${i}`,
      name: `Region ${i + 1}`,
      geometry: { type: "Polygon" as const, coordinates: [coords] },
      color: region.color,
      confidence: 0.3, // Low confidence for color-based detection
      centroid: [cx, cy] as [number, number],
      bbox: [minX, minY, maxX, maxY] as [number, number, number, number],
      areaSqKm: region.areaPixels, // Placeholder (pixel-based)
      included: true,
    };
  });
}

// ──────────────────────────────────────────────
// Color Map Building
// ──────────────────────────────────────────────

/**
 * Build a map of hex color → pixel indices.
 * Groups similar colors within the threshold.
 */
function buildColorMap(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number
): Map<string, number[]> {
  const colorBuckets = new Map<string, number[]>();
  const pixelCount = width * height;

  // First pass: collect raw colors
  const rawColors = new Map<string, number[]>();
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = data[offset]!;
    const g = data[offset + 1]!;
    const b = data[offset + 2]!;
    const a = data[offset + 3]!;

    // Skip transparent pixels
    if (a < 128) continue;

    const hex = rgbToHex(r, g, b);
    const existing = rawColors.get(hex);
    if (existing) {
      existing.push(i);
    } else {
      rawColors.set(hex, [i]);
    }
  }

  // Second pass: group similar colors
  const processed = new Set<string>();
  for (const [hex, pixels] of rawColors) {
    if (processed.has(hex)) continue;
    processed.add(hex);

    const [r1, g1, b1] = hexToRgb(hex);
    const group = [...pixels];

    for (const [otherHex, otherPixels] of rawColors) {
      if (processed.has(otherHex)) continue;
      const [r2, g2, b2] = hexToRgb(otherHex);
      if (colorDistance(r1, g1, b1, r2, g2, b2) <= threshold) {
        group.push(...otherPixels);
        processed.add(otherHex);
      }
    }

    colorBuckets.set(hex, group);
  }

  return colorBuckets;
}

// ──────────────────────────────────────────────
// Binary Mask & Boundary Tracing
// ──────────────────────────────────────────────

function createBinaryMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  targetHex: string,
  threshold: number
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const [tr, tg, tb] = hexToRgb(targetHex);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const r = data[offset]!;
    const g = data[offset + 1]!;
    const b = data[offset + 2]!;
    const a = data[offset + 3]!;

    if (a >= 128 && colorDistance(r, g, b, tr, tg, tb) <= threshold) {
      mask[i] = 1;
    }
  }

  return mask;
}

/**
 * Trace the outer boundary of a binary mask using Moore neighborhood tracing.
 * Returns an array of [x, y] boundary pixel coordinates.
 */
function traceBoundary(
  mask: Uint8Array,
  width: number,
  height: number
): [number, number][] {
  // Find starting pixel (first set pixel scanning left-to-right, top-to-bottom)
  let startX = -1, startY = -1;
  for (let y = 0; y < height && startX < 0; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        startX = x;
        startY = y;
        break;
      }
    }
  }

  if (startX < 0) return [];

  // Moore neighborhood tracing
  const boundary: [number, number][] = [];
  const directions: [number, number][] = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1],
  ];

  let x = startX, y = startY;
  let dir = 7; // Start by looking left-up
  const maxSteps = width * height * 2; // Safety limit

  for (let step = 0; step < maxSteps; step++) {
    boundary.push([x, y]);

    // Search for next boundary pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const checkDir = (dir + 5 + i) % 8; // Start from backtrack direction + 1
      const [dx, dy] = directions[checkDir]!;
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
        x = nx;
        y = ny;
        dir = checkDir;
        found = true;
        break;
      }
    }

    if (!found) break;
    if (x === startX && y === startY && boundary.length > 2) break;
  }

  return boundary;
}

// ──────────────────────────────────────────────
// Douglas-Peucker Simplification
// ──────────────────────────────────────────────

function douglasPeucker(
  points: [number, number][],
  tolerance: number
): [number, number][] {
  if (points.length <= 2) return [...points];

  // Find the point farthest from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToLineDistance(points[i]!, first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function pointToLineDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);

  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  return Math.sqrt((p[0] - projX) ** 2 + (p[1] - projY) ** 2);
}

// ──────────────────────────────────────────────
// Color Utilities
// ──────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
