import type { NextRequest } from "next/server";
import { rasterTileFile } from "~/server/modules/maps/realm-rasters.storage";
import { serveRealmRaster, tileCoord } from "~/server/modules/maps/realm-rasters.serve";

/** One raster tile (256 px WebP) of a realm's map art layer, by version. */
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
  return serveRealmRaster(ref, (dir) =>
    rasterTileFile(dir, tileCoord(z), tileCoord(x), tileCoord(y))
  );
}
