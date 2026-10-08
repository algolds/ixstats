import path from "node:path";
import type { NextRequest } from "next/server";
import { RASTER_LEGEND_FILE } from "~/server/modules/maps/realm-rasters.storage";
import { serveRealmRaster } from "~/server/modules/maps/realm-rasters.serve";

/** The legend image built with a realm's map art layer, by version. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ realm: string; layer: string; version: string }> }
) {
  return serveRealmRaster(await params, (dir) => path.join(dir, RASTER_LEGEND_FILE));
}
