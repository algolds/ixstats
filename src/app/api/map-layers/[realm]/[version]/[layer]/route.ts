import { NextResponse, type NextRequest } from "next/server";
import { db } from "~/server/db";
import { MAP_LAYER_TYPES } from "~/lib/maps/map-config";
import type { ZoomBucket } from "~/server/modules/maps/layer-lod";
import { packedLayerAt } from "~/server/modules/maps/layer-delivery";
import { findRealmIdBySlugOrId } from "~/server/modules/maps/map-realm";
import { PRIVATE_TILE_CACHE, realmTileAccess } from "~/server/modules/maps/realm-tile-access";
import { getRealmMapVersion } from "~/server/shared/map-invalidation";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
/** A URL whose version is not the current one: current data, which must not be kept as that version's forever. */
const REVALIDATE_CACHE = "public, no-cache";

/** A realm the viewer may not see is indistinguishable from one that does not exist, and never stored. */
const notFound = () =>
  new NextResponse(null, { status: 404, headers: { "Cache-Control": PRIVATE_TILE_CACHE } });

const isLayer = (layer: string) => (MAP_LAYER_TYPES as readonly string[]).includes(layer);

/** The `?bucket=` query (the layer's zoom level of detail): 0 globe, 1 mid (the default), 2 detail. */
function zoomBucket(raw: string | null): ZoomBucket | null {
  if (raw === null) return 1;
  return raw === "0" || raw === "1" || raw === "2" ? (Number(raw) as ZoomBucket) : null;
}

/** Whether `If-None-Match` lists `etag` (a weak tag matches too: the body is the same bytes). */
function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag);
}

/**
 * One layer of a realm's map in the packed wire format, by map version. The version is in the URL so a changed
 * map is a new URL; the body is always the current data, and the tag names the current version. Ixnay and
 * published realms are cacheable by anyone for a year; an unpublished realm's layers go only to those who may see
 * the realm, and are never stored.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ realm: string; version: string; layer: string }> }
) {
  const { realm, version: urlVersion, layer } = await params;
  if (!isLayer(layer) || !/^\d{1,9}$/.test(urlVersion)) return notFound();
  const bucket = zoomBucket(request.nextUrl.searchParams.get("bucket"));
  if (bucket === null) return new NextResponse(null, { status: 400 });

  try {
    const realmId = await findRealmIdBySlugOrId(db, realm);
    const access = realmId && (await realmTileAccess(realmId));
    if (!realmId || !access) return notFound();

    const version = await getRealmMapVersion(db, realmId);
    if (access === "private") {
      const body = await packedLayerAt(db, realmId, version, layer, bucket);
      return new NextResponse(body, {
        headers: { "Content-Type": "application/json", "Cache-Control": PRIVATE_TILE_CACHE },
      });
    }

    const etag = `"${realmId}-${version}-${layer}-${bucket}"`;
    const headers = {
      ETag: etag,
      "Cache-Control": Number(urlVersion) === version ? IMMUTABLE_CACHE : REVALIDATE_CACHE,
    };
    if (matchesEtag(request.headers.get("if-none-match"), etag)) {
      return new NextResponse(null, { status: 304, headers });
    }
    const body = await packedLayerAt(db, realmId, version, layer, bucket);
    return new NextResponse(body, { headers: { ...headers, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(`[map-layers] ${realm}/${urlVersion}/${layer} failed`, err);
    return new NextResponse(null, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
