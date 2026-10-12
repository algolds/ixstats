/**
 * Build a realm's raster map layer: a full-globe equirectangular image (2:1, `lon = x/W·360−180`,
 * `lat = 90−y/H·180`) becomes Web Mercator XYZ tiles, 256 px WebP, zoom 0 to the first zoom as wide as the image
 * (src/lib/maps/raster-tiles.ts) or to the zoom asked for, plus an optional legend image, in
 * `<MAP_RASTER_DIR>/<realm>/<layer>/<version>/`. The version is a hash of the inputs, so the same image is never
 * built twice and a changed one gets new URLs.
 *
 * Memory: one zoom at a time, the image resized to that zoom's equatorial resolution (z5: 8192×4096 RGBA,
 * 128 MB), then one row of tiles at a time. Server and scripts only (sharp).
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WebpOptions } from "sharp";
import {
  greyPixels,
  RASTER_TILE_SIZE,
  rasterMaxZoom,
  remapRows,
  tileSourceRows,
  type RgbaImage,
} from "~/lib/maps/raster-tiles";
import { MAX_RASTER_ZOOM, type RealmRasterLayer } from "~/lib/maps/realm-map-settings";
import {
  RASTER_LEGEND_FILE,
  rasterLayerDir,
  rasterTileFile,
  rasterVersionDir,
} from "./realm-rasters.storage";

/** Bump when the tiles this code writes change, so every layer gets a new version (and URLs) on rebuild. */
const BUILD_REVISION = "raster-tiles-1";

/** How far the image may be from 2:1 and still be read as the whole globe. */
const ASPECT_TOLERANCE = 0.01;

export interface RasterBuildInput {
  realmId: string;
  layerId: string;
  kind: RealmRasterLayer["kind"];
  /** The equirectangular image (PNG, WebP, JPEG). */
  image: Uint8Array;
  legend?: Uint8Array;
  /** Build the grey copy: each pixel its brightest channel. */
  grey?: boolean;
  /** Build again even when this version's folder exists. */
  force?: boolean;
  /** Tiles up to this zoom, instead of the first zoom as wide as the image (relief: past its resolution). */
  maxZoom?: number;
  /** Lossy WebP for an overlay (default: lossless): colour quality and alpha quality, 0 to 100. */
  lossy?: { quality: number; alphaQuality: number };
  /** Write no tile that is fully transparent (the tile route answers a missing relief tile with one). */
  skipTransparent?: boolean;
}

type RasterOptions = Pick<RasterBuildInput, "maxZoom" | "lossy" | "skipTransparent">;

export interface RasterBuildResult {
  version: string;
  maxZoom: number;
  legend: boolean;
  /** False when this version had been built already. */
  built: boolean;
  /** Tiles written. */
  tiles: number;
  /** Fully transparent tiles left out (`skipTransparent`). */
  skipped: number;
  dir: string;
}

/** The options that change the tiles, named for the version hash; empty when the build has none of them. */
function optionsKey({ maxZoom, lossy, skipTransparent }: RasterOptions): string {
  const parts = [
    maxZoom !== undefined && `zoom${maxZoom}`,
    lossy && `lossy${lossy.quality}/${lossy.alphaQuality}`,
    skipTransparent && "skip-transparent",
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(",")}|` : "";
}

/**
 * The content hash naming a build: the image, the legend and every option that changes the tiles. A build without
 * `maxZoom`, `lossy` and `skipTransparent` hashes as it did before they existed, so its layers keep their versions.
 */
export function rasterVersion(
  input: Pick<RasterBuildInput, "kind" | "image" | "legend" | "grey"> & RasterOptions
) {
  const hash = createHash("sha256");
  hash.update(`${BUILD_REVISION}|${input.kind}|${input.grey ? "grey" : "colour"}|`);
  hash.update(optionsKey(input));
  hash.update(input.image);
  hash.update(input.legend ? `|legend:${input.legend.length}|` : "|no-legend|");
  if (input.legend) hash.update(input.legend);
  return hash.digest("hex").slice(0, 16);
}

/** Base maps are photos of a sort (lossy, small); overlays are flat colours with clean alpha edges. */
function webpOptions(
  kind: RealmRasterLayer["kind"],
  lossy: RasterBuildInput["lossy"]
): WebpOptions {
  if (kind === "base") return { quality: 90, effort: 4 };
  return lossy ? { ...lossy, effort: 4 } : { lossless: true, effort: 4 };
}

async function sharpModule() {
  return (await import("sharp")).default;
}

/** The image at zoom z's equatorial resolution: 256·2^z wide, half as tall, RGBA. */
async function equirectAtZoom(image: Uint8Array, z: number, grey: boolean): Promise<RgbaImage> {
  const sharp = await sharpModule();
  const width = RASTER_TILE_SIZE * 2 ** z;
  const { data } = await sharp(image, { limitInputPixels: false })
    .ensureAlpha()
    .resize(width, width / 2, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (grey) greyPixels(rgba);
  return { width, height: width / 2, data: rgba };
}

/** Columns `left`…`left + 256` of a strip of rows 256 tall. */
function tileOf(strip: Uint8Array, stripWidth: number, left: number): Uint8Array {
  const row = RASTER_TILE_SIZE * 4;
  const tile = new Uint8Array(RASTER_TILE_SIZE * row);
  for (let r = 0; r < RASTER_TILE_SIZE; r++) {
    const from = (r * stripWidth + left) * 4;
    tile.set(strip.subarray(from, from + row), r * row);
  }
  return tile;
}

/** Whether every pixel of an RGBA tile has alpha 0. */
function fullyTransparent(tile: Uint8Array): boolean {
  for (let i = 3; i < tile.length; i += 4) if (tile[i] !== 0) return false;
  return true;
}

async function writeTiles(
  dir: string,
  z: number,
  source: RgbaImage,
  options: WebpOptions,
  skipTransparent: boolean
): Promise<{ written: number; skipped: number }> {
  const sharp = await sharpModule();
  const size = 2 ** z;
  const raw = { width: RASTER_TILE_SIZE, height: RASTER_TILE_SIZE, channels: 4 as const };
  let skipped = 0;
  for (let ty = 0; ty < size; ty++) {
    const strip = remapRows(source, tileSourceRows(z, ty, source.height));
    await Promise.all(
      Array.from({ length: size }, async (_, tx) => {
        const pixels = tileOf(strip, source.width, tx * RASTER_TILE_SIZE);
        if (skipTransparent && fullyTransparent(pixels)) {
          skipped++;
          return;
        }
        const file = rasterTileFile(dir, z, tx, ty)!;
        const webp = await sharp(pixels, { raw }).webp(options).toBuffer();
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, webp);
      })
    );
  }
  return { written: size * size - skipped, skipped };
}

async function writeLegend(dir: string, legend: Uint8Array, grey: boolean): Promise<void> {
  const sharp = await sharpModule();
  const { data, info } = await sharp(legend)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (grey) greyPixels(rgba);
  const raw = { width: info.width, height: info.height, channels: 4 as const };
  await writeFile(
    path.join(dir, RASTER_LEGEND_FILE),
    await sharp(rgba, { raw }).webp({ lossless: true }).toBuffer()
  );
}

const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false
  );

export interface RasterPlan {
  version: string;
  maxZoom: number;
  /** The version's folder. */
  dir: string;
  /** Whether that version is built already. */
  built: boolean;
}

/**
 * What a build of the layer would make, without building it: its version, zoom range and folder, and whether that
 * version exists. Throws when the image is not a full-globe equirectangular one (2:1).
 */
export async function planRealmRaster(
  input: Pick<RasterBuildInput, "realmId" | "layerId" | "kind" | "image" | "legend" | "grey"> &
    RasterOptions
): Promise<RasterPlan> {
  const sharp = await sharpModule();
  const { width = 0, height = 0 } = await sharp(input.image, {
    limitInputPixels: false,
  }).metadata();
  if (!(width > 0) || Math.abs(width / height / 2 - 1) > ASPECT_TOLERANCE) {
    throw new Error(`Expected a full-globe equirectangular image (2:1), got ${width}×${height}`);
  }
  const maxZoom = input.maxZoom ?? rasterMaxZoom(width);
  if (!Number.isInteger(maxZoom) || maxZoom < 0 || maxZoom > MAX_RASTER_ZOOM) {
    throw new Error(
      `Raster zoom must be a whole number from 0 to ${MAX_RASTER_ZOOM}, got ${maxZoom}`
    );
  }
  const version = rasterVersion(input);
  const dir = rasterVersionDir(input.realmId, input.layerId, version);
  if (!dir) throw new Error(`Not a valid realm or layer id: ${input.realmId}/${input.layerId}`);
  return { version, maxZoom, dir, built: await exists(dir) };
}

/** Build the layer's tiles (and legend) into its version folder; a version already built is kept as it is. */
export async function buildRealmRaster(input: RasterBuildInput): Promise<RasterBuildResult> {
  const { version, maxZoom, dir, built } = await planRealmRaster(input);
  const result = { version, maxZoom, legend: !!input.legend, dir };
  if (!input.force && built) return { ...result, built: false, tiles: 0, skipped: 0 };

  // Built beside the final folder and moved in whole, so a half-built version is never served
  const temporary = `${dir}.${process.pid}.tmp`;
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true }); // a layer whose every tile is skipped still has its folder
  const options = webpOptions(input.kind, input.lossy);
  let tiles = 0;
  let skipped = 0;
  for (let z = 0; z <= maxZoom; z++) {
    const source = await equirectAtZoom(input.image, z, !!input.grey);
    const counts = await writeTiles(temporary, z, source, options, !!input.skipTransparent);
    tiles += counts.written;
    skipped += counts.skipped;
  }
  if (input.legend) await writeLegend(temporary, input.legend, !!input.grey);
  await rm(dir, { recursive: true, force: true });
  await rename(temporary, dir);
  return { ...result, built: true, tiles, skipped };
}

/** Remove the layer's built versions other than `keep` (the live one and the one before it). */
export async function pruneRasterVersions(
  realmId: string,
  layerId: string,
  keep: readonly string[]
): Promise<string[]> {
  const dir = rasterLayerDir(realmId, layerId);
  if (!dir) return [];
  const entries = await readdir(dir).catch(() => [] as string[]);
  const stale = entries.filter((name) => !keep.includes(name));
  await Promise.all(
    stale.map((name) => rm(path.join(dir, name), { recursive: true, force: true }))
  );
  return stale;
}
