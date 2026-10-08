/**
 * Where a realm's raster map tiles live: `MAP_RASTER_DIR` when set, else `data/map-rasters` under the app, as
 * `<realmId>/<layerId>/<version>/<z>/<x>/<y>.webp` plus `legend.webp`. Every path segment is checked against a
 * strict pattern before it is joined, so a request can never reach outside the folder. Server only.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRasterTileCoord } from "~/lib/maps/raster-tiles";
import { RealmRasterLayerSchema } from "~/lib/maps/realm-map-settings";

const REALM_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function mapRasterDir(): string {
  return (
    process.env.MAP_RASTER_DIR ||
    path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "map-rasters")
  );
}

const shape = RealmRasterLayerSchema.shape;

/** The folder holding every built version of a realm's raster layer, or null for an invalid name. */
export function rasterLayerDir(realmId: string, layerId: string): string | null {
  if (!REALM_ID.test(realmId) || !shape.id.safeParse(layerId).success) return null;
  return path.join(mapRasterDir(), realmId, layerId);
}

/** The folder of one built version of a realm's raster layer, or null for an invalid name. */
export function rasterVersionDir(realmId: string, layerId: string, version: string): string | null {
  const dir = rasterLayerDir(realmId, layerId);
  return dir && shape.version.safeParse(version).success ? path.join(dir, version) : null;
}

/** A tile's file in a version folder, or null when z/x/y is not a tile of the pyramid. */
export function rasterTileFile(dir: string, z: number, x: number, y: number): string | null {
  return isRasterTileCoord(z, x, y) ? path.join(dir, String(z), String(x), `${y}.webp`) : null;
}

export const RASTER_LEGEND_FILE = "legend.webp";

/** A file's bytes, or null when it does not exist. */
export async function readRasterFile(file: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(file));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
