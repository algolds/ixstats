/**
 * Serving a realm's raster map art (`/api/map-rasters`): a tile or the legend of one built version of a layer,
 * with the realm's tile access rules. The URL names the version, so a published realm's files never change
 * under it and are cached for a year as immutable. Server only.
 */
import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { RASTER_TILE_SIZE } from "~/lib/maps/raster-tiles";
import { MERCATOR_MAX_LAT } from "~/lib/maps/realm-map-settings";
import { PRIVATE_TILE_CACHE, realmTileAccess } from "./realm-tile-access";
import {
  flatRasterTileFile,
  rasterTileFile,
  rasterVersionDir,
  rasterVersionExists,
  readRasterFile,
} from "./realm-rasters.storage";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

const notFound = () => new NextResponse(null, { status: 404 });

export interface RasterRef {
  realm: string;
  layer: string;
  version: string;
}

let transparentTile: Promise<Uint8Array> | undefined;

/** A fully transparent 256 px WebP tile, built the first time it is asked for and kept for the process. */
export function transparentRasterTile(): Promise<Uint8Array> {
  transparentTile ??= import("sharp")
    .then(({ default: sharp }) =>
      sharp({
        create: {
          width: RASTER_TILE_SIZE,
          height: RASTER_TILE_SIZE,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .webp({ quality: 70, alphaQuality: 60 })
        .toBuffer()
    )
    .catch((err: Error) => {
      transparentTile = undefined;
      throw err;
    });
  return transparentTile;
}

/** Written beside its file and renamed into place; a failed write only costs a rebuild next time. */
async function keepFile(file: string, bytes: Uint8Array): Promise<void> {
  const temporary = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(temporary, bytes);
    await rename(temporary, file);
  } catch (err) {
    await rm(temporary, { force: true });
    console.error(`[map-rasters] ${file} not stored`, err);
  }
}

/**
 * A flat map's raster tile z/x/y (Plate Carrée, flat-projection.ts), composed from the version's Web Mercator
 * tiles at the same zoom: columns are the same in both, and each row reads the Mercator row at its latitude.
 * Missing Mercator tiles (a layer built without its empty ones) read as transparent. Kept in `flat/` once built.
 */
// ponytail: rows past ±85.05° stay blank, as the Mercator tiles end there; build flat pyramids from the source image if the polar strips of art matter
export async function composeFlatRasterTile(
  dir: string,
  z: number,
  x: number,
  y: number
): Promise<Uint8Array | null> {
  const out = flatRasterTileFile(dir, z, x, y);
  if (!out) return null;
  const { default: sharp } = await import("sharp");
  const size = RASTER_TILE_SIZE;
  const worldPx = size * 2 ** z;
  const decoded = new Map<number, Promise<Buffer | null>>();
  const mercatorTile = (ty: number) => {
    if (!decoded.has(ty)) {
      const file = rasterTileFile(dir, z, x, ty);
      decoded.set(
        ty,
        (file ? readRasterFile(file) : Promise.resolve(null)).then((bytes) =>
          bytes ? sharp(bytes).ensureAlpha().raw().toBuffer() : null
        )
      );
    }
    return decoded.get(ty)!;
  };
  const pixels = Buffer.alloc(size * size * 4);
  for (let r = 0; r < size; r++) {
    // In carrier space a row's Mercator y is its true latitude, in radians
    const lat = Math.PI * (1 - (2 * (y * size + r + 0.5)) / worldPx);
    if (Math.abs((lat * 180) / Math.PI) >= MERCATOR_MAX_LAT) continue;
    const mercatorY = ((1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2) * worldPx;
    const ty = Math.floor(mercatorY / size);
    const row = Math.floor(mercatorY) - ty * size;
    const source = await mercatorTile(ty);
    source?.copy(pixels, r * size * 4, row * size * 4, (row + 1) * size * 4);
  }
  const bytes = new Uint8Array(
    await sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
      .webp({ quality: 90, alphaQuality: 100, effort: 4 })
      .toBuffer()
  );
  await keepFile(out, bytes);
  return bytes;
}

/**
 * The file `pick` names in the layer version's folder (null: not a file of it), if the viewer may see it. With
 * `transparentWhenMissing`, a file missing from a built version is a transparent tile instead of a 404 (a layer
 * built without its empty tiles); with `compose`, it is built from the version (a flat tile) instead.
 */
export async function serveRealmRaster(
  ref: RasterRef,
  pick: (versionDir: string) => string | null,
  {
    transparentWhenMissing = false,
    compose,
  }: {
    transparentWhenMissing?: boolean;
    compose?: (versionDir: string) => Promise<Uint8Array | null>;
  } = {}
): Promise<NextResponse> {
  const dir = rasterVersionDir(ref.realm, ref.layer, ref.version);
  const file = dir && pick(dir);
  if (!dir || !file) return notFound();
  try {
    const access = await realmTileAccess(ref.realm);
    if (!access) return notFound();
    const found = await readRasterFile(file);
    const exists = found === null && (await rasterVersionExists(dir));
    const bytes =
      found ??
      (exists && compose ? await compose(dir) : null) ??
      (exists && transparentWhenMissing ? await transparentRasterTile() : null);
    if (!bytes) return notFound();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": access === "public" ? IMMUTABLE_CACHE : PRIVATE_TILE_CACHE,
      },
    });
  } catch (err) {
    console.error(`[map-rasters] ${ref.realm}/${ref.layer}/${ref.version} failed`, err);
    return new NextResponse(null, { status: 500 });
  }
}

/** A tile coordinate from the URL: digits only, else NaN (which no tile has). */
export const tileCoord = (segment: string) => (/^\d{1,3}$/.test(segment) ? Number(segment) : NaN);
