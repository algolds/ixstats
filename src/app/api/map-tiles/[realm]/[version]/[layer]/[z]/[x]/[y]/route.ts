import { NextResponse, type NextRequest } from "next/server";
import { db } from "~/server/db";
import { buildTile } from "~/server/api/routers/geo/core/tiles";
import { isTileCoord, isTiledLayer } from "~/lib/maps/decorative-tiles";
import { PRIVATE_TILE_CACHE, resolveTileRealm } from "~/server/modules/maps/realm-tile-access";
import { getTile } from "~/server/modules/maps/tile-cache";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
// Not-found and failure answers are never stored: a cache rule on this path would otherwise keep an
// anonymous viewer's 404 for a draft realm and serve it to the staff who may see the tile
const failure = (status: number) =>
  new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
const notFound = () => failure(404);

/** A URL segment of digits only, else NaN (which is no coordinate or version). */
const digits = (segment: string) => (/^\d{1,9}$/.test(segment) ? Number(segment) : NaN);

/** The realm's current map version, read fresh: it decides whether a missing tile may be stored. */
async function currentMapVersion(realmId: string): Promise<number> {
  const row = await db.realm.findUnique({ where: { id: realmId }, select: { mapVersion: true } });
  return row?.mapVersion ?? 0;
}

interface TileParams {
  realm: string;
  version: string;
  layer: string;
  z: string;
  x: string;
  y: string;
}

/**
 * One vector tile of a realm's decorative map layer (altitudes, rivers, lakes) at a map version. The URL names the
 * version, so Ixnay's and published realms' tiles are immutable; an unpublished realm's are never cached. Tiles
 * are rendered once per version and served from the disk cache after that (tile-cache.ts).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<TileParams> }) {
  const { realm, version, layer, z, x, y } = await params;
  const [zn, xn, yn, mapVersion] = [digits(z), digits(x), digits(y), digits(version)];
  if (!isTiledLayer(layer) || !isTileCoord(zn, xn, yn) || Number.isNaN(mapVersion)) {
    return notFound();
  }
  try {
    const target = await resolveTileRealm(realm);
    if (!target) return notFound();
    const tile = await getTile([target.id, mapVersion, layer, zn, xn, yn], {
      render: () => buildTile(db, target.id, layer, zn, xn, yn),
      currentVersion: () => currentMapVersion(target.id),
    });
    if (!tile) return notFound();
    const shared = target.access === "public" && tile.cacheable;
    // Copied into an ArrayBuffer-backed view, which is what a Response body accepts
    return new NextResponse(new Uint8Array(tile.bytes), {
      headers: {
        "Content-Type": "application/x-protobuf",
        "Cache-Control": shared ? IMMUTABLE_CACHE : PRIVATE_TILE_CACHE,
      },
    });
  } catch (err) {
    console.error(`[map-tiles] ${realm}/${version}/${layer}/${z}/${x}/${y} failed`, err);
    return failure(500);
  }
}
