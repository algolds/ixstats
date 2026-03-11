/**
 * PNG-to-SVG Conversion for Political Maps
 *
 * Converts a PNG map image (where each country is a distinct color)
 * into an SVG with layered paths, ready for the existing SVG parser pipeline.
 *
 * Pipeline: PNG → sharp (color extraction) → potrace (vectorization) → SVG
 */

import type { Buffer } from "node:buffer";

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
        const potrace = eval('require')("potrace") as {
          trace: (buf: Buffer, opts: Record<string, unknown>, cb: (err: Error | null, svg: string) => void) => void;
        };
        pathData = await new Promise<string>((resolve, reject) => {
          potrace.trace(mask, {
            turdSize: config.minRegionSize ?? 10,
            optTolerance: config.smoothing ?? 0.2,
          }, (err: Error | null, svg: string) => {
            if (err) reject(err);
            else {
              // Extract path d attribute from potrace SVG output
              const match = svg.match(/d="([^"]+)"/);
              resolve(match?.[1] ?? "");
            }
          });
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
      log.push(`ERROR processing ${entry.hex}: ${err instanceof Error ? err.message : String(err)}`);
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").slice(0, 6);
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
