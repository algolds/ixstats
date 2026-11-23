/**
 * A realm's elevation model (DEM) as Web Mercator raster tiles MapLibre reads with a `raster-dem` source:
 * Terrarium-encoded RGB (`h = R·256 + G + B/256 − 32768` metres), stored lossless so every value comes back exact.
 * The height grid is equirectangular and 2:1 (src/lib/worldgen/relief.ts `HeightGrid`); each zoom samples the mip
 * level at least as wide as the zoom's world, so z6 (16,384 px) upsamples an 8,192 px grid and z0 averages it.
 * Pure, client-safe; the tiles are built by src/server/modules/maps/realm-dem.ts.
 */
import type { HeightGrid } from "~/lib/worldgen/relief";
import { RASTER_TILE_SIZE, tileSourceRows } from "./raster-tiles";

/** The raster layer holding a realm's DEM (`Realm.settings.map.rasterLayers`, kind `dem`). */
export const DEM_LAYER_ID = "dem";
/** The zoom the DEM is built to; MapLibre overzooms past it. */
export const DEM_MAX_ZOOM = 6;
/** Width of the height grid the DEM is built from (about 4.9 km a pixel at the equator). */
export const DEM_GRID_WIDTH = 8192;

const OFFSET = 32768;

/** Write `metres` as Terrarium RGB at byte `i` of `out` (3 bytes); clamped to the encodable range. */
export function encodeTerrarium(metres: number, out: Uint8Array, i: number): void {
  const v = Math.min(65535.99, Math.max(0, metres + OFFSET));
  const whole = Math.floor(v);
  out[i] = whole >> 8;
  out[i + 1] = whole & 255;
  out[i + 2] = Math.floor((v - whole) * 256);
}

/** The metres a Terrarium pixel holds. */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - OFFSET;
}

/** The grid at half its width and height, each pixel the mean of the four under it. */
function halve({ width, height, metres }: HeightGrid): HeightGrid {
  const w = width / 2;
  const h = height / 2;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const a = 2 * y * width;
    const b = a + width;
    for (let x = 0; x < w; x++) {
      const i = 2 * x;
      out[y * w + x] =
        (metres[a + i]! + metres[a + i + 1]! + metres[b + i]! + metres[b + i + 1]!) / 4;
    }
  }
  return { width: w, height: h, metres: out };
}

/** The grid and its halvings down to one tile wide (256 px), widest first. Its width must be 256 · 2^n. */
export function demLevels(grid: HeightGrid): HeightGrid[] {
  if (
    grid.width !== grid.height * 2 ||
    !Number.isInteger(Math.log2(grid.width / RASTER_TILE_SIZE))
  ) {
    throw new Error(`A DEM grid is 256·2^n by half that, got ${grid.width}×${grid.height}`);
  }
  const levels = [grid];
  while (levels[levels.length - 1]!.width > RASTER_TILE_SIZE)
    levels.push(halve(levels[levels.length - 1]!));
  return levels;
}

/** The narrowest level at least as wide as zoom z's world (the widest when none is). */
function levelFor(levels: readonly HeightGrid[], z: number): HeightGrid {
  const world = RASTER_TILE_SIZE * 2 ** z;
  for (let i = levels.length - 1; i >= 0; i--) if (levels[i]!.width >= world) return levels[i]!;
  return levels[0]!;
}

/**
 * Tile z/x/y as Terrarium RGB (256 × 256 × 3 bytes): each pixel bilinear between the level's pixels at its latitude
 * and longitude, longitudes wrapping across the antimeridian.
 */
export function demTile(
  levels: readonly HeightGrid[],
  z: number,
  tx: number,
  ty: number
): Uint8Array {
  const level = levelFor(levels, z);
  const { width: w, height: h, metres } = level;
  const world = RASTER_TILE_SIZE * 2 ** z;
  const scale = w / world;
  const rows = tileSourceRows(z, ty, world / 2);
  const out = new Uint8Array(RASTER_TILE_SIZE * RASTER_TILE_SIZE * 3);
  const xs = new Int32Array(RASTER_TILE_SIZE * 2);
  const fx = new Float32Array(RASTER_TILE_SIZE);
  for (let c = 0; c < RASTER_TILE_SIZE; c++) {
    const x = (tx * RASTER_TILE_SIZE + c + 0.5) * scale - 0.5;
    const x0 = Math.floor(x);
    fx[c] = x - x0;
    xs[c * 2] = ((x0 % w) + w) % w;
    xs[c * 2 + 1] = (((x0 + 1) % w) + w) % w;
  }
  for (let r = 0; r < RASTER_TILE_SIZE; r++) {
    const y = Math.min(h - 1, Math.max(0, (rows[r]! + 0.5) * scale - 0.5));
    const y0 = Math.floor(y);
    const fy = y - y0;
    const top = y0 * w;
    const bottom = Math.min(h - 1, y0 + 1) * w;
    for (let c = 0; c < RASTER_TILE_SIZE; c++) {
      const a = xs[c * 2]!;
      const b = xs[c * 2 + 1]!;
      const t = fx[c]!;
      const upper = metres[top + a]! * (1 - t) + metres[top + b]! * t;
      const lower = metres[bottom + a]! * (1 - t) + metres[bottom + b]! * t;
      encodeTerrarium(upper * (1 - fy) + lower * fy, out, (r * RASTER_TILE_SIZE + c) * 3);
    }
  }
  return out;
}

/** The DEM tile pixel (zoom DEM_MAX_ZOOM) holding a point: tile x/y and the pixel's column and row in it. */
export function demPixelAt(lng: number, lat: number, z = DEM_MAX_ZOOM) {
  const world = RASTER_TILE_SIZE * 2 ** z;
  const phi = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  const px = Math.min(world - 1, Math.floor((((lng + 540) % 360) / 360) * world));
  const py = Math.min(
    world - 1,
    Math.floor(((1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2) * world)
  );
  const tile = (v: number) => Math.floor(v / RASTER_TILE_SIZE);
  return { z, x: tile(px), y: tile(py), col: px % RASTER_TILE_SIZE, row: py % RASTER_TILE_SIZE };
}
