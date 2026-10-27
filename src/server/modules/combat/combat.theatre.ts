/**
 * The theatre from the realm map (owner decision: map-derived with a fallback). One PostGIS query per attacker →
 * defender pair measures the shared border (the defender's boundary within ~5 km of the attacker), the distance
 * between the territories, the river length along the border, and the defender's altitude and climate areas in the
 * sector the attack crosses (its territory within ~1° of the border, or all of it across the sea). Lengths and
 * distances are scaled to the realm's planet. Cached per pair for an hour; a failing query or a nation without a map
 * outline falls back to the defender's declared terrain profile.
 */
import type { PrismaClient } from "@prisma/client";
import { ELEVATION_ZONES } from "~/lib/maps/geo-analytics";
import { isLandBand } from "~/lib/maps/elevation-config";
import { KM_PER_DEGREE, scaleDistanceToRadius } from "~/lib/maps/planet";
import { realmRadiusKm } from "~/lib/maps/realm-map-settings";
import {
  parseDeclaredTerrain,
  resolveTheatre,
  type MapTheatreFacts,
  type Theatre,
} from "~/lib/military/combat";

/**
 * $1 attacker, $2 defender. The `&&` tests let the GiST index on `geom_postgis` prune the layers first; buffers use
 * two segments per quarter circle and the border line is simplified to ~1 km, which keeps a 5,000 km border under
 * two seconds.
 */
const THEATRE_SQL = `
  WITH a AS MATERIALIZED (SELECT geom_postgis g FROM "Country" WHERE id = $1 AND geom_postgis IS NOT NULL),
  d AS MATERIALIZED (SELECT "realmId" AS realm, geom_postgis g FROM "Country" WHERE id = $2 AND geom_postgis IS NOT NULL),
  edge AS MATERIALIZED (
    SELECT CASE WHEN a.g && ST_Expand(d.g, 0.05) AND ST_DWithin(a.g, d.g, 0.05)
                THEN ST_Simplify(ST_Intersection(ST_Boundary(d.g), ST_Buffer(a.g, 0.05, 'quad_segs=2')), 0.01)
           END AS line
      FROM a, d),
  sector AS MATERIALIZED (
    SELECT CASE WHEN edge.line IS NOT NULL AND NOT ST_IsEmpty(edge.line)
                THEN ST_Intersection(d.g, ST_Buffer(edge.line, 1.0, 'quad_segs=2')) ELSE d.g END AS g
      FROM d, edge),
  parts AS MATERIALIZED (SELECT ST_Subdivide(sector.g, 256) AS g FROM sector WHERE NOT ST_IsEmpty(sector.g)),
  cand AS MATERIALIZED (
    SELECT ml."layerType" AS lt, ml.properties AS props, ST_Subdivide(ml.geom_postgis, 2048) AS g
      FROM d, sector JOIN map_layers ml ON true
     WHERE ml."worldId" = d.realm AND ml."layerType" IN ('altitudes', 'climate') AND ml."isActive" = true
       AND ml.geom_postgis && sector.g),
  zones AS (
    SELECT cand.lt AS layer, COALESCE(cand.props->>'code', cand.props->>'climateId') AS code,
           cand.props->>'fill' AS fill, cand.props->>'zoneId' AS "zoneId",
           SUM(ST_Area((CASE WHEN ST_CoveredBy(cand.g, parts.g) THEN cand.g
                             ELSE ST_Intersection(cand.g, parts.g) END)::geography)) / 1e6 AS area
      FROM cand JOIN parts ON cand.g && parts.g AND ST_Intersects(cand.g, parts.g)
     GROUP BY 1, 2, 3, 4),
  rivers AS (
    SELECT COALESCE(SUM(ST_Length(ST_Intersection(ml.geom_postgis,
             ST_Buffer(edge.line, 0.05, 'quad_segs=2'))::geography)), 0) / 1000 AS km
      FROM d, edge JOIN map_layers ml ON true
     WHERE edge.line IS NOT NULL AND ml."worldId" = d.realm AND ml."layerType" = 'rivers'
       AND ml."isActive" = true AND ml.geom_postgis && ST_Expand(edge.line, 0.05))
  SELECT (SELECT ST_Distance(a.g, d.g) FROM a, d) AS distance_deg,
         (SELECT COALESCE(ST_Length(edge.line::geography), 0) / 1000 FROM edge) AS border_km,
         (SELECT km FROM rivers) AS river_km,
         (SELECT COALESCE(json_agg(zones), '[]'::json) FROM zones) AS zones`;

interface ZoneRow {
  layer: string;
  code: string | null;
  fill: string | null;
  zoneId: string | null;
  area: number;
}

interface TheatreRow {
  distance_deg: number | null;
  border_km: number | null;
  river_km: number | null;
  zones: ZoneRow[] | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; facts: MapTheatreFacts | null }>();

/** Test seam. */
export const resetTheatreCache = () => cache.clear();

const zoneIndex = (fill: string | null) =>
  ELEVATION_ZONES.findIndex((z) => z.color.toLowerCase() === (fill ?? "").toLowerCase());

/** The measured facts from the query row, scaled to the realm's planet. */
export function factsFromRow(row: TheatreRow, radiusKm: number, populationDensity: number): MapTheatreFacts | null {
  if (row.distance_deg === null || row.distance_deg === undefined) return null;
  const elevationAreas = ELEVATION_ZONES.map(() => 0);
  const climateAreas: Record<string, number> = {};
  for (const zone of row.zones ?? []) {
    const area = Number(zone.area) || 0;
    if (zone.layer === "altitudes" && !isLandBand({ zoneId: zone.zoneId })) {
      const index = zoneIndex(zone.fill);
      if (index >= 0) elevationAreas[index]! += area;
    } else if (zone.layer === "climate" && zone.code) {
      climateAreas[zone.code] = (climateAreas[zone.code] ?? 0) + area;
    }
  }
  const borderKm = scaleDistanceToRadius(Number(row.border_km) || 0, radiusKm);
  const neighbours = borderKm > 0;
  return {
    neighbours,
    borderKm,
    distanceKm: neighbours ? 0 : scaleDistanceToRadius(Number(row.distance_deg) * KM_PER_DEGREE, radiusKm),
    elevationAreas,
    climateAreas,
    riverKm: scaleDistanceToRadius(Number(row.river_km) || 0, radiusKm),
    populationDensity,
  };
}

interface TheatreCountry {
  id: string;
  realmId: string;
}

async function measure(db: PrismaClient, attacker: TheatreCountry, defender: TheatreCountry) {
  const [rows, realm, country] = await Promise.all([
    db.$queryRawUnsafe<TheatreRow[]>(THEATRE_SQL, attacker.id, defender.id),
    db.realm.findUnique({ where: { id: defender.realmId }, select: { settings: true } }),
    db.country.findUnique({
      where: { id: defender.id },
      select: { currentPopulation: true, landArea: true },
    }),
  ]);
  const row = rows[0];
  if (!row) return null;
  const density = country?.landArea ? country.currentPopulation / country.landArea : 0;
  return factsFromRow(row, realmRadiusKm(realm?.settings), density);
}

/** The pair's map facts (cached); null when the map cannot measure them. */
export async function mapTheatreFacts(
  db: PrismaClient,
  attacker: TheatreCountry,
  defender: TheatreCountry
): Promise<MapTheatreFacts | null> {
  const key = `${attacker.id}|${defender.id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.facts;
  let facts: MapTheatreFacts | null = null;
  try {
    facts = await measure(db, attacker, defender);
  } catch (error) {
    console.warn(`[combat] Could not measure the theatre ${key}; using the declared terrain`, error);
  }
  cache.set(key, { at: Date.now(), facts });
  return facts;
}

/** The theatre for an attack: the map's, else the defender's declared profile, else the typical mix. */
export async function loadTheatre(
  db: PrismaClient,
  attacker: TheatreCountry,
  defender: TheatreCountry
): Promise<Theatre> {
  const [map, policy] = await Promise.all([
    mapTheatreFacts(db, attacker, defender),
    db.defensePolicy.findUnique({ where: { countryId: defender.id }, select: { terrainProfile: true } }),
  ]);
  return resolveTheatre({ map, declared: parseDeclaredTerrain(policy?.terrainProfile) });
}
