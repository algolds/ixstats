/**
 * The editor's relief preview: the server tiles' pipeline (cell heights, fractal detail, hillshade) at 1024x512,
 * then warped to Web Mercator rows so a MapLibre image source pinned at +-MERCATOR_MAX_LAT lines up with the
 * draft layers. Pure, so the generator worker runs it.
 *
 * The warp is the tile builder's own (`tileSourceRows` + `remapRows`) over the four zoom 2 tile rows, which is
 * why the result is 1024 px square: 256 px tiles, 2^2 of them across the world.
 */

import {
  RASTER_TILE_SIZE,
  remapRows,
  tileSourceRows,
  type RgbaImage,
} from "~/lib/maps/raster-tiles";
import { addDetail, heightsFromCells, hillshade } from "./relief";

const PREVIEW_ZOOM = 2;
export const PREVIEW_RELIEF_WIDTH = RASTER_TILE_SIZE * 2 ** PREVIEW_ZOOM;
/** The server tiles are made with full fractal detail. */
const RUGGEDNESS = 1;

export type ReliefImage = {
  width: number;
  height: number;
  /** Straight (not premultiplied) RGBA, north up */
  rgba: Uint8Array;
};

/**
 * An equirectangular image `256 * 2^zoom` wide, warped to Web Mercator rows: the tile builder's own
 * (`tileSourceRows` + `remapRows`) over the world's `2^zoom` tile rows, a `256 * 2^zoom` px square. The relief
 * and every diagnostic layer go through it, so they line up with each other and with the draft layers.
 */
export function warpToMercator(source: RgbaImage, zoom: number): ReliefImage {
  const size = RASTER_TILE_SIZE * 2 ** zoom;
  const rows = new Float64Array(size);
  for (let ty = 0; ty < 2 ** zoom; ty++) {
    rows.set(tileSourceRows(zoom, ty, source.height), ty * RASTER_TILE_SIZE);
  }
  return { width: size, height: size, rgba: remapRows(source, rows) };
}

/** `cells` is packed `[lng, lat, h, ...]` as the generator returns it. */
export function previewRelief(cells: Float32Array): ReliefImage {
  const grid = heightsFromCells(cells, PREVIEW_RELIEF_WIDTH);
  addDetail(grid, RUGGEDNESS);
  const shade = hillshade(grid);
  const data = new Uint8Array(shade.buffer, shade.byteOffset, shade.byteLength);
  return warpToMercator({ width: grid.width, height: grid.height, data }, PREVIEW_ZOOM);
}
