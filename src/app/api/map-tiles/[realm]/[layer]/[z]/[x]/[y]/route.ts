import { NextResponse, type NextRequest } from "next/server";
import { db } from "~/server/db";
import { buildTile } from "~/server/api/routers/geo/core/tiles";
import { isTiledLayer } from "~/lib/maps/decorative-tiles";
import { PRIVATE_TILE_CACHE, realmTileAccess } from "~/server/modules/maps/realm-tile-access";

const MAX_TILE_ZOOM = 6;
const notFound = () => new NextResponse(null, { status: 404 });

/** z/x/y as integers inside the tile pyramid, else null. */
function tileCoords(z: string, x: string, y: string): [number, number, number] | null {
  const [zn, xn, yn] = [Number(z), Number(x), Number(y)];
  if (![zn, xn, yn].every(Number.isInteger) || zn < 0 || zn > MAX_TILE_ZOOM) return null;
  const size = 2 ** zn;
  return xn >= 0 && xn < size && yn >= 0 && yn < size ? [zn, xn, yn] : null;
}

const PUBLIC_CACHE = "public, max-age=86400";

/** One vector tile of a realm's decorative map layer (altitudes, rivers, lakes) */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ realm: string; layer: string; z: string; x: string; y: string }> }
) {
  const { realm, layer, z, x, y } = await params;
  const coords = tileCoords(z, x, y);
  if (!isTiledLayer(layer) || !coords) return notFound();
  try {
    const access = await realmTileAccess(realm);
    if (!access) return notFound();
    const cacheControl = access === "public" ? PUBLIC_CACHE : PRIVATE_TILE_CACHE;
    // Copied into an ArrayBuffer-backed view, which is what a Response body accepts
    const tile = new Uint8Array(await buildTile(db, realm, layer, ...coords));
    return new NextResponse(tile, {
      headers: { "Content-Type": "application/x-protobuf", "Cache-Control": cacheControl },
    });
  } catch (err) {
    console.error(`[map-tiles] ${realm}/${layer}/${z}/${x}/${y} failed`, err);
    return new NextResponse(null, { status: 500 });
  }
}
