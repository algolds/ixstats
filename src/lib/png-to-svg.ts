/**
 * PNG-to-SVG Conversion for Political Maps
 *
 * Converts a PNG map image (where each country is a distinct color)
 * into an SVG with layered paths, ready for the existing SVG parser pipeline.
 *
 * Pipeline: PNG → sharp (color extraction) → potrace (vectorization) → SVG
 */

import { Buffer } from "node:buffer";

export interface PngToSvgConfig {
  /** Color map: hex color → feature ID. If not provided, auto-detects colors. */
  colorMapping?: Record<string, string>;
  /** Auto-detect distinct colors from the image */
  autoDetectColors?: boolean;
  /** Minimum region size in pixels to keep (filters noise) */
  minRegionSize?: number;
  /** Background color to ignore (e.g., ocean) */
  backgroundColor?: string;
  /** Simplification tolerance for potrace (0 = none, higher = smoother) */
  smoothing?: number;
}

export interface PngToSvgResult {
  svg: string;
  width: number;
  height: number;
  detectedColors: Array<{ hex: string; pixelCount: number; featureId: string | null }>;
  log: string[];
}

/**
 * Extract distinct colors from a PNG image buffer.
 * Returns an array of { hex, count } sorted by pixel count descending.
 *
 * Uses sharp to read raw pixel data and count unique RGB values.
 */
export async function extractColors(
  pngBuffer: Buffer,
  options: { backgroundColor?: string; minPixels?: number } = {}
): Promise<Array<{ hex: string; pixelCount: number }>> {
  // Dynamic import to avoid bundling sharp in client code
  const sharp = (await import("sharp")).default;

  const image = sharp(pngBuffer).removeAlpha().raw();
  const { data, info } = await image.toBuffer({ resolveWithObject: true });

  const colorCounts = new Map<string, number>();
  const bgHex = options.backgroundColor?.toLowerCase().replace("#", "");

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const hex = `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

    // Skip background color
    if (bgHex && hex === bgHex) continue;

    colorCounts.set(hex, (colorCounts.get(hex) ?? 0) + 1);
  }

  const minPixels = options.minPixels ?? Math.round(info.width * info.height * 0.0001);

  return Array.from(colorCounts.entries())
    .filter(([, count]) => count >= minPixels)
    .sort((a, b) => b[1] - a[1])
    .map(([hex, count]) => ({ hex: `#${hex}`, pixelCount: count }));
}

/**
 * Create a binary mask for a specific color from a PNG image.
 * Returns a 1-bit PNG buffer where matching pixels are white and others are black.
 */
export async function createColorMask(
  pngBuffer: Buffer,
  targetHex: string,
  tolerance: number = 15
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  const target = hexToRgb(targetHex);
  const image = sharp(pngBuffer).removeAlpha().raw();
  const { data, info } = await image.toBuffer({ resolveWithObject: true });

  // Create mask: white for matching pixels, black for others
  const mask = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;

    const dr = Math.abs(r - target[0]);
    const dg = Math.abs(g - target[1]);
    const db = Math.abs(b - target[2]);

    if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
      mask[i / 3] = 255;
    }
  }

  // Convert mask to PNG for potrace
  return sharp(mask, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .png()
    .toBuffer();
}

/**
 * Convert a PNG political map to SVG.
 *
 * Steps:
 * 1. Extract distinct colors from the image
 * 2. For each color: create binary mask → vectorize with potrace
 * 3. Combine all vectorized paths into a single SVG
 */
export async function convertPngToSvg(
  pngBuffer: Buffer,
  config: PngToSvgConfig = {}
): Promise<PngToSvgResult> {
  const sharp = (await import("sharp")).default;
  const log: string[] = [];

  // Get image dimensions
  const metadata = await sharp(pngBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  log.push(`Image size: ${width}x${height}`);

  // Step 1: Detect or use provided colors
  let colorEntries: Array<{ hex: string; pixelCount: number; featureId: string | null }>;

  if (config.colorMapping) {
    colorEntries = Object.entries(config.colorMapping).map(([hex, featureId]) => ({
      hex,
      pixelCount: 0,
      featureId,
    }));
    log.push(`Using ${colorEntries.length} provided color mappings`);
  } else {
    const detected = await extractColors(pngBuffer, {
      backgroundColor: config.backgroundColor,
      minPixels: config.minRegionSize ?? Math.round(width * height * 0.0001),
    });
    colorEntries = detected.map((c, i) => ({
      ...c,
      featureId: `country_${i}`,
    }));
    log.push(`Auto-detected ${colorEntries.length} distinct colors`);
  }

  // Step 2: For each color, create mask and vectorize
  const svgPaths: string[] = [];

  for (const entry of colorEntries) {
    try {
      const mask = await createColorMask(pngBuffer, entry.hex);

      // Use potrace to vectorize the mask
      let pathData: string;
      try {
        // Optional native dependency — use eval to hide from Webpack static analysis
        const potrace = eval("require")("potrace") as {
          trace: (
            buf: Buffer,
            opts: Record<string, unknown>,
            cb: (err: Error | null, svg: string) => void
          ) => void;
        };
        pathData = await new Promise<string>((resolve, reject) => {
          potrace.trace(
            mask,
            {
              turdSize: config.minRegionSize ?? 10,
              optTolerance: config.smoothing ?? 0.2,
            },
            (err: Error | null, svg: string) => {
              if (err) reject(err);
              else {
                // Extract path d attribute from potrace SVG output
                const match = svg.match(/d="([^"]+)"/);
                resolve(match?.[1] ?? "");
              }
            }
          );
        });
      } catch {
        log.push(`WARNING: potrace not available for ${entry.hex}, skipping`);
        continue;
      }

      if (pathData) {
        const featureId = entry.featureId ?? `feature_${svgPaths.length}`;
        svgPaths.push(
          `  <path id="${featureId}" d="${pathData}" fill="${entry.hex}" stroke="none" />`
        );
        log.push(`Vectorized: ${featureId} (${entry.hex}, ${entry.pixelCount}px)`);
      }
    } catch (err) {
      log.push(
        `ERROR processing ${entry.hex}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Step 3: Assemble SVG
  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"`,
    `     viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `  <g inkscape:label="political" inkscape:groupmode="layer">`,
    ...svgPaths,
    `  </g>`,
    `</svg>`,
  ].join("\n");

  log.push(`Generated SVG with ${svgPaths.length} features`);

  return {
    svg,
    width,
    height,
    detectedColors: colorEntries,
    log,
  };
}

// ──────────────────────────────────────────────
// Direct PNG → ProvinceFeature[] Pipeline
// ──────────────────────────────────────────────

export interface PngProvinceResult {
  provinces: Array<{
    sourceId: string;
    name: string;
    geometry: { type: "Polygon"; coordinates: [number, number][][] };
    color: string;
    confidence: number;
    centroid: [number, number];
    bbox: [number, number, number, number];
    areaSqKm: number;
    included: boolean;
  }>;
  width: number;
  height: number;
  log: string[];
}

export interface PngProvinceConfig {
  /** Brightness threshold (0-255) — pixels darker than this are boundary/ocean. Default 130 */
  boundaryThreshold?: number;
  /** Minimum region area in pixels to keep. Default 500 */
  minRegionPixels?: number;
  /** Douglas-Peucker simplification tolerance in pixels. Default 1.5 */
  simplifyTolerance?: number;
  /** Erosion passes to clean anti-aliased edges. Default 2 */
  erosionPasses?: number;
}

/**
 * Extract provinces directly from a PNG raster map.
 *
 * Designed for maps where provinces share the same fill color and are
 * separated by thin dark boundary lines (e.g., rasterized political maps).
 *
 * Pipeline:
 *   1. Decode PNG → raw RGB via sharp
 *   2. Classify pixels: boundary (dark) / ocean (blue-hue) / land
 *   3. Erode land mask to clean anti-aliased edges between land & boundary
 *   4. Connected component labeling (scan-line flood fill)
 *   5. Moore-neighbor contour tracing per component
 *   6. Douglas-Peucker simplification
 *   7. Output ProvinceFeature[] in pixel coordinates
 */
export async function extractProvincesFromPng(
  pngBuffer: Buffer,
  config: PngProvinceConfig = {}
): Promise<PngProvinceResult> {
  const sharp = (await import("sharp")).default;
  const log: string[] = [];

  const threshold = config.boundaryThreshold ?? 130;
  const minRegion = config.minRegionPixels ?? 500;
  const simplifyTol = config.simplifyTolerance ?? 1.5;
  const erosionPasses = config.erosionPasses ?? 2;

  // ── Step 1: Decode ──
  const { data, info } = await sharp(pngBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const N = W * H;
  log.push(`PNG decoded: ${W}×${H} (${N} pixels)`);

  // ── Step 2: Classify pixels ──
  // 1 = land, 0 = boundary or ocean
  const mask = new Uint8Array(N);
  let nLand = 0,
    nBound = 0,
    nOcean = 0;

  for (let i = 0; i < N; i++) {
    const r = data[i * 3]!;
    const g = data[i * 3 + 1]!;
    const b = data[i * 3 + 2]!;
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b; // perceptual luminance

    // Ocean: convert to HSL, check blue hue range (180-260) with minimum saturation
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    let hue = 0;
    if (max !== min) {
      if (max === r) hue = 60 * (((g - b) / (max - min)) % 6);
      else if (max === g) hue = 60 * ((b - r) / (max - min) + 2);
      else hue = 60 * ((r - g) / (max - min) + 4);
      if (hue < 0) hue += 360;
    }
    const isOcean = hue >= 170 && hue <= 270 && sat > 0.15 && brightness > 50;
    const isBoundary = brightness < threshold;

    if (isOcean) {
      nOcean++;
    } else if (isBoundary) {
      nBound++;
    } else {
      mask[i] = 1;
      nLand++;
    }
  }
  log.push(`Classified: ${nLand} land, ${nBound} boundary, ${nOcean} ocean`);

  // ── Step 3: Erode land mask ──
  // Removes anti-aliased fringe pixels that blur boundary lines.
  // Each pass removes 1px of land adjacent to any non-land pixel.
  for (let pass = 0; pass < erosionPasses; pass++) {
    const eroded = new Uint8Array(mask);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (mask[idx] === 0) continue;
        // If any 4-connected neighbor is non-land, erode this pixel
        if (
          (x > 0 && mask[idx - 1] === 0) ||
          (x < W - 1 && mask[idx + 1] === 0) ||
          (y > 0 && mask[idx - W] === 0) ||
          (y < H - 1 && mask[idx + W] === 0)
        ) {
          eroded[idx] = 0;
        }
      }
    }
    for (let i = 0; i < N; i++) mask[i] = eroded[i]!;
  }
  if (erosionPasses > 0) {
    const remaining = mask.reduce((s, v) => s + v, 0);
    log.push(`After ${erosionPasses} erosion passes: ${remaining} land pixels remaining`);
  }

  // ── Step 4: Connected component labeling ──
  const labels = new Int32Array(N);
  let nextLabel = 1;
  const sizes = new Map<number, number>();

  for (let i = 0; i < N; i++) {
    if (mask[i] === 0 || labels[i] !== 0) continue;

    // Scan-line flood fill
    const label = nextLabel++;
    let size = 0;
    const stack: number[] = [i];

    while (stack.length > 0) {
      const seed = stack.pop()!;
      if (labels[seed] !== 0 || mask[seed] === 0) continue;

      // Find leftmost pixel of this scan line
      let sx = seed % W;
      const sy = (seed - sx) / W;
      while (sx > 0 && mask[sy * W + sx - 1] === 1 && labels[sy * W + sx - 1] === 0) sx--;

      // Scan right, labeling pixels and pushing neighbors above/below
      let x = sx;
      while (x < W && mask[sy * W + x] === 1 && labels[sy * W + x] === 0) {
        const ci = sy * W + x;
        labels[ci] = label;
        size++;

        // Check row above
        if (sy > 0 && mask[ci - W] === 1 && labels[ci - W] === 0) stack.push(ci - W);
        // Check row below
        if (sy < H - 1 && mask[ci + W] === 1 && labels[ci + W] === 0) stack.push(ci + W);
        x++;
      }
    }

    sizes.set(label, size);
  }

  // Filter small components
  const validLabels: number[] = [];
  for (const [label, size] of sizes) {
    if (size >= minRegion) validLabels.push(label);
  }
  // Sort by size descending
  validLabels.sort((a, b) => (sizes.get(b) ?? 0) - (sizes.get(a) ?? 0));

  log.push(
    `Found ${nextLabel - 1} components, ${validLabels.length} above ${minRegion}px threshold`
  );

  // ── Step 5 & 6: Trace contour + simplify for each component ──
  const palette = generatePalette(validLabels.length);
  const provinces: PngProvinceResult["provinces"] = [];

  for (let pi = 0; pi < validLabels.length; pi++) {
    const label = validLabels[pi]!;
    const compSize = sizes.get(label) ?? 0;

    // Build per-component binary mask
    const compMask = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (labels[i] === label) compMask[i] = 1;
    }

    // Moore-neighbor contour trace
    const contour = traceContour(compMask, W, H);
    if (contour.length < 6) continue;

    // Simplify
    const simplified = douglasPeuckerSimplify(contour, simplifyTol);
    if (simplified.length < 4) continue;

    // Close ring
    const first = simplified[0]!;
    const last = simplified[simplified.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplified.push([first[0], first[1]]);
    }

    // Compute centroid & bbox
    let cx = 0,
      cy = 0;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [px, py] of simplified) {
      cx += px;
      cy += py;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    cx /= simplified.length;
    cy /= simplified.length;

    const color = palette[pi % palette.length]!;
    provinces.push({
      sourceId: `region_${pi}`,
      name: `Province ${pi + 1}`,
      geometry: {
        type: "Polygon",
        coordinates: [simplified.map(([x, y]) => [x, y] as [number, number])],
      },
      color,
      confidence: 0.5,
      centroid: [cx, cy],
      bbox: [minX, minY, maxX, maxY],
      areaSqKm: compSize, // pixel count, will be remapped after alignment
      included: true,
    });

    log.push(`Province ${pi + 1}: ${compSize}px, ${simplified.length} vertices`);
  }

  log.push(`Extracted ${provinces.length} provinces from PNG`);
  return { provinces, width: W, height: H, log };
}

// ──────────────────────────────────────────────
// Shared Geometry Utilities
// ──────────────────────────────────────────────

/** Moore neighborhood contour tracing */
function traceContour(mask: Uint8Array, width: number, height: number): [number, number][] {
  // Find start pixel (first set pixel, left→right, top→bottom)
  let startX = -1,
    startY = -1;
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

  const dirs: [number, number][] = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ];

  const boundary: [number, number][] = [];
  let x = startX,
    y = startY,
    dir = 2; // east — we "entered" from the west (scan left→right)
  const maxSteps = Math.min(width * height, 500_000); // safety cap

  for (let step = 0; step < maxSteps; step++) {
    boundary.push([x, y]);

    let found = false;
    for (let i = 0; i < 8; i++) {
      const checkDir = (dir + 5 + i) % 8;
      const [dx, dy] = dirs[checkDir]!;
      const nx = x + dx,
        ny = y + dy;
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

/** Douglas-Peucker line simplification */
function douglasPeuckerSimplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) return [...points];

  let maxDist = 0,
    maxIdx = 0;
  const first = points[0]!,
    last = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = ptLineDist(points[i]!, first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeuckerSimplify(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeuckerSimplify(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function ptLineDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Generate N visually distinct colors for province fills */
function generatePalette(n: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < Math.max(n, 20); i++) {
    const hue = (i * 137.508) % 360;
    const sat = 50 + (i % 3) * 15;
    const lit = 55 + (i % 2) * 15;
    colors.push(hslToHex(hue, sat, lit));
  }
  return colors;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").slice(0, 6);
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
