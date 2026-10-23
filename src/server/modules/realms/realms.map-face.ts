import type { PrismaClient } from "@prisma/client";
import { sourceGeometry } from "~/server/modules/maps/tile-render";

/** A realm's political map as SVG path strings, drawn on a card as its face.
 * Every path field is `""` when the realm has nothing of that kind. */
export interface RealmMapFace {
  viewBox: string;
  /** The realm's land (its climate layer, merged), drawn under the nations. */
  land: string;
  /** Nations nobody holds that a player can claim. */
  open: string;
  /** Nations a player holds. */
  claimed: string;
  /** Nations that can't be claimed (NPC or locked), and regions with no country. */
  other: string;
}

interface Extent {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface FaceRow {
  d: string | null;
  xmin: number | null;
  ymin: number | null;
  xmax: number | null;
  ymax: number | null;
}

interface PoliticalRow extends FaceRow {
  status: "open" | "claimed" | "other";
}

/** Web Mercator scaled so the world is 1000 units wide. */
const SCALE = 1000 / 40_075_016.68;
const SIMPLIFY_TOLERANCE = 0.6;
const BAND_ASPECT = 2.4;
const BAND_PADDING = 0.04;
const CACHE_TTL_MS = 3_600_000;

// ponytail: per-process cache; move to Redis if IxStats runs more than one instance
const cache = new Map<string, { expires: number; face: RealmMapFace | null }>();

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The SVG viewBox for a card band: the extent padded by `pad` of its longer side, then the shorter
 * side grown around the centre until width / height equals `aspect`. */
export function faceViewBox(extent: Extent, aspect = BAND_ASPECT, pad = BAND_PADDING): string {
  const margin = pad * Math.max(extent.width, extent.height);
  const centreX = extent.minX + extent.width / 2;
  const centreY = extent.minY + extent.height / 2;
  let width = extent.width + 2 * margin;
  let height = extent.height + 2 * margin;
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;
  return [centreX - width / 2, centreY - height / 2, width, height].map(round1).join(" ");
}

const layerGeometry = (layerType: string, also = "TRUE") => `
  SELECT "countryId", ${sourceGeometry("3")} AS g FROM map_layers
  WHERE "worldId" = $1 AND "layerType" = '${layerType}' AND "isActive" AND geom_postgis IS NOT NULL AND ${also}`;

/** A land row wholly inside a polar zone that also crosses the antimeridian is a polar ice cap. The
 * antimeridian split in `sourceGeometry` fails on it (a GEOS topology error that aborts the whole
 * query), and a cap is clipped away at Web Mercator's latitude limit and is not land worth drawing. */
const NOT_POLAR_CAP = `NOT (ST_XMax(geom_postgis) - ST_XMin(geom_postgis) > 180
  AND (ST_YMax(geom_postgis) < -50 OR ST_YMin(geom_postgis) > 50))`;

const POLITICAL_SQL = `
WITH nations AS (
  SELECT CASE WHEN c.id IS NULL OR (c."ownerUserId" IS NULL AND NOT c.claimable) THEN 'other'
              WHEN c."ownerUserId" IS NULL THEN 'open' ELSE 'claimed' END AS status,
         ST_SimplifyPreserveTopology(ST_Scale(ST_Transform(s.g, 3857), $2::float8, $2::float8), $3::float8) AS g
  FROM (${layerGeometry("political")}) s
  LEFT JOIN "Country" c ON c.id = s."countryId"
)
SELECT status, ST_AsSVG(ST_CollectionExtract(ST_Collect(g), 3), 1, 1) AS d,
       ST_XMin(ST_Extent(g)) AS xmin, ST_YMin(ST_Extent(g)) AS ymin,
       ST_XMax(ST_Extent(g)) AS xmax, ST_YMax(ST_Extent(g)) AS ymax
FROM nations WHERE NOT ST_IsEmpty(g) GROUP BY status`;

const LAND_SQL = `
WITH land AS (
  SELECT ST_UnaryUnion(ST_CollectionExtract(ST_Collect(
           ST_MakeValid(ST_SimplifyPreserveTopology(ST_Scale(ST_Transform(s.g, 3857), $2::float8, $2::float8), $3::float8))), 3)) AS g
  FROM (${layerGeometry("climate", NOT_POLAR_CAP)}) s
  WHERE NOT ST_IsEmpty(s.g)
)
SELECT ST_AsSVG(g, 1, 1) AS d,
       ST_XMin(g) AS xmin, ST_YMin(g) AS ymin, ST_XMax(g) AS xmax, ST_YMax(g) AS ymax
FROM land`;

/** The union of every row's extent, skipping rows with no geometry; null when none has any. */
function unionExtent(rows: FaceRow[]): Extent | null {
  const boxes = rows.filter(
    (r): r is FaceRow & { xmin: number; ymin: number; xmax: number; ymax: number } =>
      r.d !== null && r.xmin !== null && r.ymin !== null && r.xmax !== null && r.ymax !== null
  );
  if (boxes.length === 0) return null;
  const xmin = Math.min(...boxes.map((r) => r.xmin));
  const xmax = Math.max(...boxes.map((r) => r.xmax));
  const ymin = Math.min(...boxes.map((r) => r.ymin));
  const ymax = Math.max(...boxes.map((r) => r.ymax));
  // ST_AsSVG negates y, so the drawn extent runs from -ymax down by the data's height.
  return { minX: xmin, minY: -ymax, width: xmax - xmin, height: ymax - ymin };
}

async function buildFace(db: Pick<PrismaClient, "$queryRawUnsafe">, realmId: string): Promise<RealmMapFace | null> {
  const political = await db.$queryRawUnsafe<PoliticalRow[]>(POLITICAL_SQL, realmId, SCALE, SIMPLIFY_TOLERANCE);
  if (political.length === 0) return null;
  const [land = null] = await db.$queryRawUnsafe<FaceRow[]>(LAND_SQL, realmId, SCALE, SIMPLIFY_TOLERANCE);
  const extent = unionExtent(land ? [...political, land] : political);
  if (!extent) return null;
  const pathOf = (status: PoliticalRow["status"]) => political.find((r) => r.status === status)?.d ?? "";
  return {
    viewBox: faceViewBox(extent, BAND_ASPECT, BAND_PADDING),
    land: land?.d ?? "",
    open: pathOf("open"),
    claimed: pathOf("claimed"),
    other: pathOf("other"),
  };
}

/** A realm's political map as SVG paths grouped by whether a nation can be claimed, held or neither,
 * with the realm's land under them. Null when the realm has no political layer. Cached per process
 * for an hour; `now` is injectable for tests. */
export async function getRealmMapFace(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  realmId: string,
  now = Date.now()
): Promise<RealmMapFace | null> {
  const hit = cache.get(realmId);
  if (hit && hit.expires > now) return hit.face;
  const face = await buildFace(db, realmId);
  cache.set(realmId, { expires: now + CACHE_TTL_MS, face });
  return face;
}
