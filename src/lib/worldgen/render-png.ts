/**
 * The Studio's PNG render: a generated world as one equirectangular image, 2048, 4096 or 8192 px wide. Layers, bottom
 * to top: ocean, land by height band, optional political fills, the relief, ice caps (when the world has them), lakes,
 * optional borders, rivers.
 *
 * Pure (RGBA out, no DOM, no canvas), so jest runs it; the worker hands the pixels to `OffscreenCanvas` to encode.
 * The layout is the relief's (row 0 is 90N, column 0 is 180W; see raster-draw.ts), not the map's Web Mercator.
 *
 * At 8192 px one RGBA buffer is 134 MB, so the steps run in functions of their own and each lets go of what it
 * made before the next starts: the relief at 2048 px (it is upsampled, since its detail texture is made for that
 * width), the full-width height grid (dropped before lakes, borders and rivers are drawn), and the hillshade.
 */

import { LAKE_COLOR, RIVER_COLOR, packValues, paintHeightBands, strokeRivers } from "./diagnostics";
import {
  drawSegment,
  fillRing,
  hexToRgb,
  newRaster,
  sharedEdge,
  toPixel,
  type Raster,
  type Rgba,
} from "./raster-draw";
import { addDetail, heightsFromCells, hillshade } from "./relief";
import { ICE_CAP_BIOME } from "./v2/config";
import type { WorldGraph } from "./v2/types";

export const PNG_WIDTHS = [2048, 4096, 8192] as const;
export type PngWidth = (typeof PNG_WIDTHS)[number];

export interface RenderOptions {
  /** Political fills and borders */
  politics: boolean;
  /** The world has ice caps (`hasIcecaps`): its ice cap cells are drawn, as the Studio map draws the layer */
  icecaps: boolean;
}

export interface RenderedMap {
  width: number;
  height: number;
  /** Straight RGBA, north up */
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

/** The relief is made at this width at most, as the server's tiles are. */
const RELIEF_WIDTH = 2048;
const FILL_ALPHA = 118;
const LAKE: Rgba = [...hexToRgb(LAKE_COLOR), 255];
const RIVER: Rgba = [...hexToRgb(RIVER_COLOR), 235];
/** The ice cap layer's fill and opacity on the Studio map (`icecaps` in map-config.ts) */
const ICE: Rgba = [...hexToRgb("#f0f4f8"), Math.round(0.7 * 255)];
const BORDER: Rgba = [38, 38, 52, 215];

/** The hillshade at `width`, as signed shade per pixel: white lit slopes are positive alpha, black shadows negative. */
function shadeField(
  graph: WorldGraph,
  width: number
): { width: number; height: number; signed: Int16Array } {
  const grid = heightsFromCells(packValues(graph, graph.cells.h), width);
  addDetail(grid, 1);
  const shade = hillshade(grid);
  const signed = new Int16Array(grid.width * grid.height);
  for (let p = 0; p < signed.length; p++) {
    const alpha = shade[p * 4 + 3]!;
    signed[p] = shade[p * 4]! > 0 ? alpha : -alpha;
  }
  return { width: grid.width, height: grid.height, signed };
}

/**
 * Lay the hillshade over `out` wherever the full-width grid is land. A field narrower than the image is sampled
 * bilinearly, pixel centre to pixel centre, so the shading is smooth at 8192 px too.
 */
function applyShade(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  land: Float32Array,
  field: { width: number; height: number; signed: Int16Array }
): void {
  const { signed } = field;
  const x0 = new Int32Array(width);
  const x1 = new Int32Array(width);
  const wx = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const f = ((x + 0.5) * field.width) / width - 0.5;
    const a = Math.floor(f);
    x0[x] = (a + field.width) % field.width;
    x1[x] = (a + 1 + field.width) % field.width;
    wx[x] = f - a;
  }
  for (let y = 0; y < height; y++) {
    const f = ((y + 0.5) * field.height) / height - 0.5;
    const a = Math.max(0, Math.floor(f));
    const rowA = a * field.width;
    const rowB = Math.min(field.height - 1, a + 1) * field.width;
    const wy = Math.min(1, Math.max(0, f - a));
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!(land[p]! > 0)) continue;
      const top = signed[rowA + x0[x]!]! * (1 - wx[x]!) + signed[rowA + x1[x]!]! * wx[x]!;
      const bottom = signed[rowB + x0[x]!]! * (1 - wx[x]!) + signed[rowB + x1[x]!]! * wx[x]!;
      const s = top * (1 - wy) + bottom * wy;
      if (s === 0) continue;
      const i = p * 4;
      if (s < 0) {
        const keep = 1 + s / 255;
        out[i] = out[i]! * keep;
        out[i + 1] = out[i + 1]! * keep;
        out[i + 2] = out[i + 2]! * keep;
      } else {
        const lit = s / 255;
        out[i] = out[i]! + (255 - out[i]!) * lit;
        out[i + 1] = out[i + 1]! + (255 - out[i + 1]!) * lit;
        out[i + 2] = out[i + 2]! + (255 - out[i + 2]!) * lit;
      }
    }
  }
}

/** The state colours by state id. */
function stateColors(graph: WorldGraph): Map<number, Rgba> {
  return new Map(graph.states.map((s) => [s.id, [...hexToRgb(s.color), FILL_ALPHA] as const]));
}

/** Ocean, land by height band, political fills and the relief: everything that needs the full-width height grid. */
function paintLand(raster: Raster, graph: WorldGraph, options: RenderOptions): void {
  const { width, height, data } = raster;
  // The relief first and smallest, so its grid is gone before the full-width one exists
  const shade = shadeField(graph, Math.min(width, RELIEF_WIDTH));
  const grid = heightsFromCells(packValues(graph, graph.cells.h), width);
  paintHeightBands(data, grid.metres);
  if (options.politics) {
    const colors = stateColors(graph);
    const { cells } = graph;
    for (let c = 0; c < cells.n; c++) {
      const colour = cells.isLand[c] === 1 ? colors.get(cells.state[c]!) : undefined;
      if (colour) fillRing(raster, cells.vertices[c]!, colour, grid.metres);
    }
  }
  applyShade(data, width, height, grid.metres, shade);
}

/** A line along every edge two land cells of different countries share. */
function drawBorders(raster: Raster, graph: WorldGraph): void {
  const { cells } = graph;
  const radius = Math.max(0.6, (0.8 * raster.width) / RELIEF_WIDTH);
  for (let a = 0; a < cells.n; a++) {
    const state = cells.state[a]!;
    if (state === 0 || cells.isLand[a] !== 1) continue;
    for (const b of cells.neighbors[a]!) {
      if (b < a || cells.isLand[b] !== 1 || cells.state[b] === state) continue;
      const edge = sharedEdge(graph, a, b);
      if (!edge) continue;
      drawSegment(
        raster,
        toPixel(edge[0][0], edge[0][1], raster),
        toPixel(edge[1][0], edge[1][1], raster),
        BORDER,
        radius
      );
    }
  }
}

/** Ice caps: every cell the ice cap layer is made of (sea ice at the poles too, as the Studio map shows it). */
function drawIcecaps(raster: Raster, graph: WorldGraph): void {
  const { cells } = graph;
  for (let c = 0; c < cells.n; c++) {
    if (cells.biome[c] === ICE_CAP_BIOME) fillRing(raster, cells.vertices[c]!, ICE);
  }
}

/** Lakes: the cells of each lake, flat. */
function drawLakes(raster: Raster, graph: WorldGraph): void {
  const { cells } = graph;
  for (let c = 0; c < cells.n; c++) {
    if (cells.isLand[c] === 1 && cells.lake[c]! > 0) fillRing(raster, cells.vertices[c]!, LAKE);
  }
}

/** A world as an equirectangular image `width` px wide (and half as tall). */
export function renderMap(graph: WorldGraph, width: number, options: RenderOptions): RenderedMap {
  const raster = newRaster(width);
  paintLand(raster, graph, options);
  if (options.icecaps) drawIcecaps(raster, graph);
  drawLakes(raster, graph);
  if (options.politics) drawBorders(raster, graph);
  const scale = width / RELIEF_WIDTH;
  strokeRivers(raster, graph, (t) => ({ colour: RIVER, radius: (0.55 + 1.3 * t) * scale }));
  return { width: raster.width, height: raster.height, rgba: raster.data };
}
