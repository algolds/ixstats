/**
 * Serving a realm's raster map art (`/api/map-rasters`): a tile or the legend of one built version of a layer,
 * with the realm's tile access rules. The URL names the version, so a published realm's files never change
 * under it and are cached for a year as immutable. Server only.
 */
import { NextResponse } from "next/server";
import { RASTER_TILE_SIZE } from "~/lib/maps/raster-tiles";
import { PRIVATE_TILE_CACHE, realmTileAccess } from "./realm-tile-access";
import { rasterVersionDir, rasterVersionExists, readRasterFile } from "./realm-rasters.storage";

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

/**
 * The file `pick` names in the layer version's folder (null: not a file of it), if the viewer may see it. With
 * `transparentWhenMissing`, a file missing from a built version is a transparent tile instead of a 404 (a layer
 * built without its empty tiles).
 */
export async function serveRealmRaster(
  ref: RasterRef,
  pick: (versionDir: string) => string | null,
  { transparentWhenMissing = false }: { transparentWhenMissing?: boolean } = {}
): Promise<NextResponse> {
  const dir = rasterVersionDir(ref.realm, ref.layer, ref.version);
  const file = dir && pick(dir);
  if (!dir || !file) return notFound();
  try {
    const access = await realmTileAccess(ref.realm);
    if (!access) return notFound();
    const found = await readRasterFile(file);
    const bytes =
      found ??
      (transparentWhenMissing && (await rasterVersionExists(dir))
        ? await transparentRasterTile()
        : null);
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
