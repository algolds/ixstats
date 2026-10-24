import type { PrismaClient } from "@prisma/client";
import type { Feature, MultiPolygon, Polygon } from "geojson";
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

export type NationStatus = "open" | "claimed" | "other";

/** What the live hero map shows for a nation: who it is, and whether it can be claimed. */
export interface HeroNation {
  /** Unique within one realm's map; the hover state's feature id. */
  key: number;
  /** The country, or null for a region with no country. */
  id: string | null;
  name: string | null;
  slug: string | null;
  flag: string | null;
  status: NationStatus;
}

/** A realm's political map as lon/lat GeoJSON for the live hero map (MapLibre). */
export interface RealmMapGeo {
  /** The nations' extent as [west, south, east, north] in degrees. */
  bounds: [number, number, number, number];
  nations: Array<Feature<Polygon | MultiPolygon, HeroNation>>;
  /** The realm's land (its climate layer, merged), or null when it has none. */
  land: Polygon | MultiPolygon | null;
}

interface Extent {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface PoliticalRow {
  status: NationStatus;
  d: string | null;
  xmin: number | null;
  ymin: number | null;
  xmax: number | null;
  ymax: number | null;
}

interface LandRow {
  d: string | null;
}

interface GeoNationRow {
  status: NationStatus;
  id: string | null;
  name: string | null;
  slug: string | null;
  flag: string | null;
  geometry: string;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

interface GeoLandRow {
  geometry: string | null;
}

/** Web Mercator scaled so the world is 1000 units wide. */
const SCALE = 1000 / 40_075_016.68;
/** Faces are clipped to |latitude| <= 75 degrees, which Mercator inflates towards the poles. In scaled
 * units that is |y| <= SCALE * R * ln(tan(45deg + 75deg / 2)), with R = 6 378 137 m: about 322.7. */
const CLIP_Y = SCALE * 6_378_137 * Math.log(Math.tan(Math.PI / 4 + (75 * Math.PI) / 360));
const CLIP_BOX = `ST_MakeEnvelope(-1000, ${-CLIP_Y}, 1000, ${CLIP_Y})`;
/** Simplify tolerances in face units (the world is 1000 wide). Never above 1.0: 1.5 segfaulted Postgres. */
const NATION_TOLERANCE = 0.6;
/** Land is a backdrop under the nations, so it is simplified more coarsely. */
const LAND_TOLERANCE = 1.0;
/** The hero map is in degrees: 0.1 degrees (about 11 km) stays sharp up to its zoom limit and keeps a
 * large realm's nations near 250 KB. Land is a backdrop, so coarser. */
const GEO_NATION_TOLERANCE = 0.1;
const GEO_LAND_TOLERANCE = 0.15;
/** The same +/-75 degree band as the faces, in degrees. */
const GEO_CLIP_BOX = "ST_MakeEnvelope(-180, -75, 180, 75, 4326)";
const BAND_ASPECT = 2.4;
const BAND_PADDING = 0.04;
const CACHE_TTL_MS = 3_600_000;
/** How long a failed build is remembered as "no face", so a broken realm is not re-queried on every
 * card render. Short, so a fixed realm comes back soon. */
const FAILURE_TTL_MS = 300_000;

interface CacheEntry<T> {
  expires: number;
  value: Promise<T | null>;
}

// ponytail: per-process caches; move to Redis if IxStats runs more than one instance
/** Each holds the in-flight promise, so concurrent callers await one build. */
const faceCache = new Map<string, CacheEntry<RealmMapFace>>();
const geoCache = new Map<string, CacheEntry<RealmMapGeo>>();

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
  SELECT "countryId", "displayName", ${sourceGeometry("3")} AS g FROM map_layers
  WHERE "worldId" = $1 AND "layerType" = '${layerType}' AND "isActive" AND geom_postgis IS NOT NULL AND ${also}`;

/** A land row wholly inside a polar zone that also crosses the antimeridian is a polar ice cap. The
 * antimeridian split in `sourceGeometry` fails on it (a GEOS topology error that aborts the whole
 * query), and a cap is clipped away at Web Mercator's latitude limit and is not land worth drawing. */
const NOT_POLAR_CAP = `NOT (ST_XMax(geom_postgis) - ST_XMin(geom_postgis) > 180
  AND (ST_YMax(geom_postgis) < -50 OR ST_YMin(geom_postgis) > 50))`;

/** A region with no country, or a country nobody can claim, is "other"; then unowned is "open". */
const STATUS_SQL = `CASE WHEN c.id IS NULL OR (c."ownerUserId" IS NULL AND NOT c.claimable) THEN 'other'
  WHEN c."ownerUserId" IS NULL THEN 'open' ELSE 'claimed' END`;

const POLITICAL_SQL = `
WITH nations AS (
  SELECT ${STATUS_SQL} AS status,
         ST_ClipByBox2D(
           ST_SimplifyPreserveTopology(ST_Scale(ST_Transform(s.g, 3857), $2::float8, $2::float8), $3::float8),
           ${CLIP_BOX}) AS g
  FROM (${layerGeometry("political")}) s
  LEFT JOIN "Country" c ON c.id = s."countryId"
)
SELECT status, ST_AsSVG(ST_CollectionExtract(ST_Collect(g), 3), 1, 0) AS d,
       ST_XMin(ST_Extent(g)) AS xmin, ST_YMin(ST_Extent(g)) AS ymin,
       ST_XMax(ST_Extent(g)) AS xmax, ST_YMax(ST_Extent(g)) AS ymax
FROM nations WHERE NOT ST_IsEmpty(g) GROUP BY status`;

const LAND_SQL = `
WITH land AS (
  SELECT ST_UnaryUnion(ST_CollectionExtract(ST_Collect(
           ST_ClipByBox2D(
             ST_MakeValid(ST_SimplifyPreserveTopology(ST_Scale(ST_Transform(s.g, 3857), $2::float8, $2::float8), $3::float8)),
             ${CLIP_BOX})), 3)) AS g
  FROM (${layerGeometry("climate", NOT_POLAR_CAP)}) s
  WHERE NOT ST_IsEmpty(s.g)
)
SELECT ST_AsSVG(g, 1, 0) AS d FROM land`;

const GEO_NATIONS_SQL = `
WITH nations AS (
  SELECT ${STATUS_SQL} AS status, c.id, COALESCE(c.name, s."displayName") AS name, c.slug, c.flag,
         ST_CollectionExtract(ST_ClipByBox2D(ST_SimplifyPreserveTopology(s.g, $2::float8), ${GEO_CLIP_BOX}), 3) AS g
  FROM (${layerGeometry("political")}) s
  LEFT JOIN "Country" c ON c.id = s."countryId"
)
SELECT status, id, name, slug, flag, ST_AsGeoJSON(g, 2) AS geometry,
       ST_XMin(g) AS xmin, ST_YMin(g) AS ymin, ST_XMax(g) AS xmax, ST_YMax(g) AS ymax
FROM nations WHERE NOT ST_IsEmpty(g)`;

const GEO_LAND_SQL = `
SELECT ST_AsGeoJSON(ST_UnaryUnion(ST_CollectionExtract(ST_Collect(
         ST_ClipByBox2D(ST_MakeValid(ST_SimplifyPreserveTopology(s.g, $2::float8)), ${GEO_CLIP_BOX})), 3)), 2) AS geometry
FROM (${layerGeometry("climate", NOT_POLAR_CAP)}) s
WHERE NOT ST_IsEmpty(s.g)`;

/** The union of the nations' extents, skipping rows with no geometry; null when none has any. Land
 * fills the face but never frames it. */
function unionExtent(rows: PoliticalRow[]): Extent | null {
  const boxes = rows.filter(
    (r): r is PoliticalRow & { xmin: number; ymin: number; xmax: number; ymax: number } =>
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

async function buildFace(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  realmId: string
): Promise<RealmMapFace | null> {
  const political = await db.$queryRawUnsafe<PoliticalRow[]>(
    POLITICAL_SQL,
    realmId,
    SCALE,
    NATION_TOLERANCE
  );
  if (political.length === 0) return null;
  const land = await db
    .$queryRawUnsafe<LandRow[]>(LAND_SQL, realmId, SCALE, LAND_TOLERANCE)
    .then(([row]) => row?.d ?? "")
    .catch((error: Error) => {
      console.error(
        `[realms] map face land failed for realm ${realmId}; drawing nations only:`,
        error
      );
      return "";
    });
  const extent = unionExtent(political);
  if (!extent) return null;
  const pathOf = (status: PoliticalRow["status"]) =>
    political.find((r) => r.status === status)?.d ?? "";
  return {
    viewBox: faceViewBox(extent, BAND_ASPECT, BAND_PADDING),
    land,
    open: pathOf("open"),
    claimed: pathOf("claimed"),
    other: pathOf("other"),
  };
}

/** `build` through `store`: a live entry is returned as is (in flight or settled); a failed build is
 * logged and remembered as null for `FAILURE_TTL_MS`. */
function cachedBuild<T>(
  store: Map<string, CacheEntry<T>>,
  key: string,
  build: () => Promise<T | null>,
  label: string,
  now: number
): Promise<T | null> {
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = build().catch((error: Error) => {
    console.error(`[realms] ${label} failed for realm ${key}:`, error);
    store.set(key, { expires: now + FAILURE_TTL_MS, value: Promise.resolve(null) });
    return null;
  });
  store.set(key, { expires: now + CACHE_TTL_MS, value });
  return value;
}

/** A realm's political map as SVG paths grouped by whether a nation can be claimed, held or neither,
 * with the realm's land under them. Null when the realm has no political layer, or when building it
 * failed (remembered for five minutes). Cached per process for an hour; concurrent callers share one
 * build; `now` is injectable for tests. */
export function getRealmMapFace(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  realmId: string,
  now = Date.now()
): Promise<RealmMapFace | null> {
  return cachedBuild(faceCache, realmId, () => buildFace(db, realmId), "map face", now);
}

async function buildGeo(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  realmId: string
): Promise<RealmMapGeo | null> {
  const rows = await db.$queryRawUnsafe<GeoNationRow[]>(
    GEO_NATIONS_SQL,
    realmId,
    GEO_NATION_TOLERANCE
  );
  if (rows.length === 0) return null;
  const land = await db
    .$queryRawUnsafe<GeoLandRow[]>(GEO_LAND_SQL, realmId, GEO_LAND_TOLERANCE)
    .then(([row]) => row?.geometry ?? null)
    .catch((error: Error) => {
      console.error(
        `[realms] hero map land failed for realm ${realmId}; drawing nations only:`,
        error
      );
      return null;
    });
  return {
    bounds: [
      Math.min(...rows.map((r) => r.xmin)),
      Math.min(...rows.map((r) => r.ymin)),
      Math.max(...rows.map((r) => r.xmax)),
      Math.max(...rows.map((r) => r.ymax)),
    ],
    nations: rows.map((row, key) => ({
      type: "Feature",
      geometry: JSON.parse(row.geometry) as Polygon | MultiPolygon,
      properties: {
        key,
        id: row.id,
        name: row.name,
        slug: row.slug,
        flag: row.flag,
        status: row.status,
      },
    })),
    land: land ? (JSON.parse(land) as Polygon | MultiPolygon) : null,
  };
}

/** A realm's political map as lon/lat GeoJSON for the live hero map: each nation with its claim status,
 * the realm's land, and the nations' bounds. Same caching, failure memory and land fallback as
 * `getRealmMapFace`. */
export function getRealmMapGeo(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  realmId: string,
  now = Date.now()
): Promise<RealmMapGeo | null> {
  return cachedBuild(geoCache, realmId, () => buildGeo(db, realmId), "hero map", now);
}
