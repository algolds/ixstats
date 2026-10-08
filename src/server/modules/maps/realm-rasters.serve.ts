/**
 * Serving a realm's raster map art (`/api/map-rasters`): a tile or the legend of one built version of a layer,
 * with the realm's tile access rules. The URL names the version, so a published realm's files never change
 * under it and are cached for a year as immutable. Server only.
 */
import { NextResponse } from "next/server";
import { PRIVATE_TILE_CACHE, realmTileAccess } from "./realm-tile-access";
import { readRasterFile, rasterVersionDir } from "./realm-rasters.storage";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

const notFound = () => new NextResponse(null, { status: 404 });

export interface RasterRef {
  realm: string;
  layer: string;
  version: string;
}

/** The file `pick` names in the layer version's folder (null: not a file of it), if the viewer may see it. */
export async function serveRealmRaster(
  ref: RasterRef,
  pick: (versionDir: string) => string | null
): Promise<NextResponse> {
  const dir = rasterVersionDir(ref.realm, ref.layer, ref.version);
  const file = dir && pick(dir);
  if (!file) return notFound();
  try {
    const access = await realmTileAccess(ref.realm);
    if (!access) return notFound();
    const bytes = await readRasterFile(file);
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
