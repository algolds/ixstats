import type { NextRequest } from "next/server";
import { RELIEF_LAYER_ID, RELIEF_MAX_ZOOM } from "~/lib/maps/raster-tiles";
import { flatRasterTileFile, rasterTileFile } from "~/server/modules/maps/realm-rasters.storage";
import {
  composeFlatRasterTile,
  serveRealmRaster,
  tileCoord,
} from "~/server/modules/maps/realm-rasters.serve";

/**
 * One raster tile (256 px WebP) of a realm's map art layer, by version. The relief layer is built without its fully
 * transparent tiles, so a tile of it that is not there is a transparent one, not a 404 (up to its zoom, z5: above
 * that no tile exists). `?projection=flat` asks for the Plate Carrée tile (flat maps), composed from the Mercator
 * ones on first ask.
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      realm: string;
      layer: string;
      version: string;
      z: string;
      x: string;
      y: string;
    }>;
  }
) {
  const { z, x, y, ...ref } = await params;
  const [zn, xn, yn] = [tileCoord(z), tileCoord(x), tileCoord(y)];
  if (request.nextUrl.searchParams.get("projection") === "flat") {
    return serveRealmRaster(ref, (dir) => flatRasterTileFile(dir, zn, xn, yn), {
      compose: (dir) => composeFlatRasterTile(dir, zn, xn, yn),
    });
  }
  return serveRealmRaster(
    ref,
    (dir) => rasterTileFile(dir, tileCoord(z), tileCoord(x), tileCoord(y)),
    { transparentWhenMissing: ref.layer === RELIEF_LAYER_ID && tileCoord(z) <= RELIEF_MAX_ZOOM }
  );
}
