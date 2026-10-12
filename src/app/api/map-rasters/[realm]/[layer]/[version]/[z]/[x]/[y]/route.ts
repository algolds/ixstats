import type { NextRequest } from "next/server";
import { RELIEF_LAYER_ID } from "~/lib/maps/raster-tiles";
import { rasterTileFile } from "~/server/modules/maps/realm-rasters.storage";
import { serveRealmRaster, tileCoord } from "~/server/modules/maps/realm-rasters.serve";

/**
 * One raster tile (256 px WebP) of a realm's map art layer, by version. The relief layer is built without its fully
 * transparent tiles, so a tile of it that is not there is a transparent one, not a 404.
 */
export async function GET(
  _request: NextRequest,
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
  return serveRealmRaster(
    ref,
    (dir) => rasterTileFile(dir, tileCoord(z), tileCoord(x), tileCoord(y)),
    { transparentWhenMissing: ref.layer === RELIEF_LAYER_ID }
  );
}
