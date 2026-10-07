import type { PrismaClient } from "@prisma/client";
import type { TiledLayer } from "~/lib/maps/decorative-tiles";

/** Layers whose same-colour pieces are merged per tile, as `mergeFeaturesByColor` does for GeoJSON,
 * so adjacent shapes show no seams under a translucent fill. The union runs on tile-space geometry
 * and doesn't keep the winding `ST_AsMVTGeom` gave it (outer rings counter-clockwise there), which
 * MapLibre then fills as streaks, so it is re-wound. */
const MERGED = new Set<TiledLayer>(["altitudes"]);

/** The one geometry kind each layer draws (`ST_CollectionExtract` type: 2 lines, 3 polygons). Source rows
 * include GeometryCollections and stray lines, which the tile format can't encode and the fill/line
 * layers never drew. */
const GEOMETRY_KIND: Record<TiledLayer, 2 | 3> = { rivers: 2, altitudes: 3, lakes: 3 };

/** Web Mercator's world width in metres, and the MVT grid each tile is drawn on. MapLibre draws a
 * tile across 512 CSS px, so one pixel is 8 grid units; simplifying to half a pixel is invisible. */
const WORLD_METRES = 40_075_016.68;
const TILE_EXTENT = 4096;
const SIMPLIFY_UNITS = 4;

const UNMERGED_ROWS = `SELECT _id, "_fillColor", "_areaSqKm", geom FROM rows WHERE geom IS NOT NULL`;
const MERGED_ROWS = `SELECT min(_id) AS _id, "_fillColor", sum("_areaSqKm") AS "_areaSqKm", ST_ForcePolygonCCW(ST_CollectionExtract(ST_Union(geom), 3)) AS geom
  FROM rows WHERE geom IS NOT NULL GROUP BY "_fillColor"`;

/** A map_layers row's geometry as tiles draw it:
 * - only the layer's geometry kind (`kind` is the SQL for an `ST_CollectionExtract` type);
 * - a row crossing the antimeridian (stored with longitudes jumping 180 → -180, so it spans the whole
 *   world) is read from its stored GeoJSON, as the GeoJSON path does: its `geom_postgis` was
 *   "repaired" as a planar polygon, which left long horizontal slivers that tiles draw as streaks;
 * - each part of it that crosses is split at 180°, as `splitCollectionAtAntimeridian` does per polygon
 *   (a part that legitimately straddles 0° is left alone);
 * - clipped to Web Mercator's latitude range, since transforming the poles to EPSG:3857 fails. */
export const sourceGeometry = (kind: string) => {
  const wide = `ST_XMax(geom_postgis) - ST_XMin(geom_postgis) > 180`;
  const stored = `CASE WHEN ${wide} THEN ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326) ELSE geom_postgis END`;
  // Re-extracted after collecting: a split part is itself a multi, and mixing single and multi
  // parts makes a GeometryCollection, which tiles can't encode.
  const unwrapped = `ST_CollectionExtract((SELECT ST_Collect(CASE WHEN ST_XMax(d.geom) - ST_XMin(d.geom) > 180
      THEN ST_WrapX(ST_ShiftLongitude(d.geom), 180, -360) ELSE d.geom END)
    FROM ST_Dump(ST_CollectionExtract(${stored}, ${kind})) d), ${kind})`;
  return `ST_ClipByBox2D(${unwrapped}, ST_MakeEnvelope(-180, -85.0511, 180, 85.0511, 4326))`;
};

/** One Mapbox Vector Tile of a realm's decorative layer. Geometry is clipped to Web Mercator's
 * latitude range first, since transforming the poles to EPSG:3857 fails, then simplified to half a
 * screen pixel. Empty tile = empty bytes. */
export async function buildTile(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  realmId: string,
  layer: TiledLayer,
  z: number,
  x: number,
  y: number
): Promise<Uint8Array> {
  const sql = `
    WITH bounds AS (SELECT ST_TileEnvelope($1::int, $2::int, $3::int) AS env),
    rows AS (
      SELECT "featureId" AS _id, properties->>'fill' AS "_fillColor", "areaSqKm" AS "_areaSqKm",
             ST_AsMVTGeom(
               ST_Simplify(ST_Transform(${sourceGeometry("$6::int")}, 3857), $7::float8),
               bounds.env
             ) AS geom
      FROM map_layers, bounds
      WHERE "worldId" = $4 AND "layerType" = $5 AND "isActive"
        AND geom_postgis && ST_Transform(bounds.env, 4326)
    )
    SELECT ST_AsMVT(t, $5) AS mvt FROM (${MERGED.has(layer) ? MERGED_ROWS : UNMERGED_ROWS}) t`;
  const [row] = await db.$queryRawUnsafe<Array<{ mvt: Uint8Array | null }>>(
    sql,
    z,
    x,
    y,
    realmId,
    layer,
    GEOMETRY_KIND[layer],
    (SIMPLIFY_UNITS * WORLD_METRES) / (TILE_EXTENT * 2 ** z)
  );
  return row?.mvt ?? new Uint8Array();
}
