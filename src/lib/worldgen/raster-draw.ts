/**
 * Drawing on an equirectangular RGBA raster, for the diagnostic layers and the PNG render. Pure (no DOM), so the
 * generator worker and jest run the same code.
 *
 * The raster follows the relief's convention: row 0 is 90N, column 0 is 180W, pixel (x, y) is centred at longitude
 * -180 + (x + 0.5) * 360 / width. Everything that crosses the antimeridian wraps: a segment takes the short way
 * round, and a column index is taken modulo the width.
 */

import type { WorldGraph } from "./v2/types";

export type Rgb = readonly [number, number, number];
/** Red, green, blue and alpha, each 0-255; straight (not premultiplied) */
export type Rgba = readonly [number, number, number, number];

export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

export const newRaster = (width: number): Raster => ({
  width,
  height: width >> 1,
  data: new Uint8ClampedArray(width * (width >> 1) * 4),
});

/** `#rgb`, `#rrggbb` or `#rrggbbaa` to its colour (the alpha is dropped). */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** A colour ramp as 256 rgb entries, interpolated linearly between `stops` (position 0-1). */
export function rampTable(stops: ReadonlyArray<{ at: number; color: Rgb }>): Uint8Array {
  const table = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let hi = stops.findIndex((s) => s.at >= t);
    if (hi < 0) hi = stops.length - 1;
    const lo = Math.max(0, hi - 1);
    const a = stops[lo]!;
    const b = stops[hi]!;
    const span = b.at - a.at;
    const k = span > 0 ? Math.min(1, Math.max(0, (t - a.at) / span)) : 0;
    for (let c = 0; c < 3; c++)
      table[i * 3 + c] = Math.round(a.color[c]! + (b.color[c]! - a.color[c]!) * k);
  }
  return table;
}

/** `colour` laid over the pixel at byte offset `i` (straight alpha); an opaque colour simply replaces it. */
export function putPixel(data: Uint8ClampedArray, i: number, colour: Rgba): void {
  const a = colour[3] / 255;
  if (a >= 1) {
    data[i] = colour[0];
    data[i + 1] = colour[1];
    data[i + 2] = colour[2];
    data[i + 3] = 255;
    return;
  }
  const below = (data[i + 3]! / 255) * (1 - a);
  const alpha = a + below;
  if (alpha <= 0) return;
  for (let c = 0; c < 3; c++) data[i + c] = (colour[c]! * a + data[i + c]! * below) / alpha;
  data[i + 3] = alpha * 255;
}

/** Set (not blend) every pixel to `colour`. */
export function fillRaster(raster: Raster, colour: Rgba): void {
  const { data } = raster;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = colour[0];
    data[i + 1] = colour[1];
    data[i + 2] = colour[2];
    data[i + 3] = colour[3];
  }
}

const wrapColumn = (x: number, width: number): number => ((x % width) + width) % width;

/**
 * A line from (x0, y0) to (x1, y1) in pixels, `radius` px either side, stamped every half pixel. A segment longer
 * than half the world goes the short way round the antimeridian. `replace` sets the pixels instead of blending, so
 * a line drawn twice (an edge shared by two cells) comes out the same.
 */
export function drawSegment(
  raster: Raster,
  [x0, y0]: readonly [number, number],
  [x1, y1]: readonly [number, number],
  colour: Rgba,
  radius = 0.5,
  replace = false
): void {
  const { width, height, data } = raster;
  let dx = x1 - x0;
  if (dx > width / 2) dx -= width;
  else if (dx < -width / 2) dx += width;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
  const reach = Math.max(0, Math.ceil(radius - 0.5));
  for (let s = 0; s <= steps; s++) {
    const cx = Math.floor(x0 + (dx * s) / steps);
    const cy = Math.floor(y0 + (dy * s) / steps);
    for (let oy = -reach; oy <= reach; oy++) {
      const y = cy + oy;
      if (y < 0 || y >= height) continue;
      for (let ox = -reach; ox <= reach; ox++) {
        if (ox * ox + oy * oy > radius * radius + 0.25) continue;
        const i = (y * width + wrapColumn(cx + ox, width)) * 4;
        if (replace) {
          data[i] = colour[0];
          data[i + 1] = colour[1];
          data[i + 2] = colour[2];
          data[i + 3] = colour[3];
        } else putPixel(data, i, colour);
      }
    }
  }
}

/** A point in pixels. */
export const toPixel = (lng: number, lat: number, raster: Raster): [number, number] => [
  ((lng + 180) / 360) * raster.width,
  ((90 - lat) / 180) * raster.height,
];

/** A ring in pixels: x unwrapped across the antimeridian so consecutive vertices are neighbours, and its row range. */
interface PixelRing {
  xs: Float64Array;
  ys: Float64Array;
  minY: number;
  maxY: number;
}

function pixelRing(raster: Raster, ring: ReadonlyArray<readonly [number, number]>): PixelRing {
  const xs = new Float64Array(ring.length);
  const ys = new Float64Array(ring.length);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < ring.length; k++) {
    const [x, y] = toPixel(ring[k]![0], ring[k]![1], raster);
    xs[k] = k > 0 ? nearestTo(x, xs[k - 1]!, raster.width) : x;
    ys[k] = y;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { xs, ys, minY, maxY };
}

/** `x` shifted by whole world widths to the copy nearest `previous`. */
function nearestTo(x: number, previous: number, width: number): number {
  let near = x;
  while (near - previous > width / 2) near -= width;
  while (previous - near > width / 2) near += width;
  return near;
}

/** Where the ring covers the line `yc`: its left and right x, or null (half-open, so a shared edge is one side's). */
function rowExtent({ xs, ys }: PixelRing, yc: number): [number, number] | null {
  let left = Infinity;
  let right = -Infinity;
  for (let k = 0; k < xs.length; k++) {
    const n = k + 1 === xs.length ? 0 : k + 1;
    if (ys[k]! <= yc === ys[n]! <= yc) continue;
    const x = xs[k]! + ((yc - ys[k]!) / (ys[n]! - ys[k]!)) * (xs[n]! - xs[k]!);
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  return left <= right ? [left, right] : null;
}

/**
 * Lay `colour` over the inside of a convex ring (a Voronoi cell) of [lng, lat] points, wherever `where` (a grid
 * the size of the raster) is above zero, or everywhere without one. Pixel centres decide, half-open, so two cells
 * that share an edge never paint the same pixel. A ring whose vertices straddle the antimeridian is unwrapped first.
 */
export function fillRing(
  raster: Raster,
  ring: ReadonlyArray<readonly [number, number]>,
  colour: Rgba,
  where?: Float32Array
): void {
  if (ring.length < 3) return;
  const { width, height, data } = raster;
  const pixels = pixelRing(raster, ring);
  const y1 = Math.min(height - 1, Math.ceil(pixels.maxY - 0.5) - 1);
  for (let y = Math.max(0, Math.ceil(pixels.minY - 0.5)); y <= y1; y++) {
    const extent = rowExtent(pixels, y + 0.5);
    if (!extent) continue;
    const to = Math.ceil(extent[1] - 0.5) - 1;
    for (let x = Math.ceil(extent[0] - 0.5); x <= to; x++) {
      const px = y * width + wrapColumn(x, width);
      if (!where || where[px]! > 0) putPixel(data, px * 4, colour);
    }
  }
}

/** The two points a cell's ring shares with a neighbour's, when they share an edge. */
export function sharedEdge(
  graph: WorldGraph,
  a: number,
  b: number
): [[number, number], [number, number]] | null {
  const ringB = graph.cells.vertices[b]!;
  const common: [number, number][] = [];
  for (const [x, y] of graph.cells.vertices[a]!) {
    if (common.some(([cx, cy]) => cx === x && cy === y)) continue;
    if (ringB.some(([bx, by]) => bx === x && by === y)) common.push([x, y]);
  }
  return common.length === 2 ? [common[0]!, common[1]!] : null;
}
