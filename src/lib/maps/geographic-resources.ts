/**
 * Geographic resources derived from a country's map data (AT-9).
 *
 * The only writer of `GeographicResource`. It reads what PostGIS already holds for the country
 * (its border, the realm's river, lake and climate layers, neighbouring political borders and the
 * stored coastline length) and records the resources that geography shows directly:
 *
 * - **freshwater**: each of the longest rivers and largest lakes inside the border;
 * - **fishery**: the coast, when the country has one (the border not shared with a neighbour);
 * - **agricultural**: farmland weighted by each climate zone's agriculture factor
 *   (`getAgricultureFactor`, the same table the geo profile's arable share uses).
 *
 * Nothing in the app records geology, so there are no mineral, oil, gas or forest resources: they
 * would be invented. `quantity` is the measured size on a fixed scale (`RESOURCE_SCALES`).
 * `quality` is only graded for farmland (its mean agriculture factor); for water it stays at the
 * schema default and the UI does not show it.
 */
import type { PrismaClient } from "@prisma/client";
import { getAgricultureFactor, resolveClimateFromColor } from "~/lib/maps/geo-analytics";

/** Sizes that count as a full (1.0) quantity. */
export const RESOURCE_SCALES = {
  riverFullKm: 1000,
  lakeFullSqKm: 1000,
  coastFullKm: 2000,
} as const;

/** Smaller water bodies are not listed; at most this many rivers and lakes each. */
export const RESOURCE_LIMITS = {
  minRiverKm: 10,
  minLakeSqKm: 5,
  maxPerWaterType: 3,
  /** Farmland below this share of the country is not listed. */
  minArableShare: 0.05,
} as const;

type LngLat = [number, number];

export interface ResourceSourceData {
  countryName: string;
  areaSqKm: number;
  coastlineKm: number;
  /** A point on the coast, or null when the whole border is shared with neighbours. */
  coastPoint: LngLat | null;
  rivers: Array<{ name: string | null; lengthKm: number; point: LngLat }>;
  lakes: Array<{ name: string | null; areaSqKm: number; point: LngLat }>;
  /** Climate polygons clipped to the country: their fill colour, area and a point inside. */
  climateAreas: Array<{ fill: string; areaSqKm: number; point: LngLat }>;
}

export interface DerivedResource {
  resourceType: "freshwater" | "fishery" | "agricultural";
  name: string;
  coordinates: LngLat;
  quantity: number;
  quality?: number;
  climateZone?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const share = (value: number, full: number) => round2(Math.min(1, Math.max(0, value / full)));

function waterResources(src: ResourceSourceData): DerivedResource[] {
  const rivers = src.rivers
    .filter((r) => r.lengthKm >= RESOURCE_LIMITS.minRiverKm)
    .sort((a, b) => b.lengthKm - a.lengthKm)
    .slice(0, RESOURCE_LIMITS.maxPerWaterType)
    .map<DerivedResource>((r) => ({
      resourceType: "freshwater",
      name: r.name?.trim() || `${src.countryName} river`,
      coordinates: r.point,
      quantity: share(r.lengthKm, RESOURCE_SCALES.riverFullKm),
    }));
  const lakes = src.lakes
    .filter((l) => l.areaSqKm >= RESOURCE_LIMITS.minLakeSqKm)
    .sort((a, b) => b.areaSqKm - a.areaSqKm)
    .slice(0, RESOURCE_LIMITS.maxPerWaterType)
    .map<DerivedResource>((l) => ({
      resourceType: "freshwater",
      name: l.name?.trim() || `${src.countryName} lake`,
      coordinates: l.point,
      quantity: share(l.areaSqKm, RESOURCE_SCALES.lakeFullSqKm),
    }));
  return [...rivers, ...lakes];
}

function farmland(src: ResourceSourceData): DerivedResource | null {
  if (src.areaSqKm <= 0) return null;
  let arableSqKm = 0;
  let zonedSqKm = 0;
  let best: { climate: string; weighted: number; point: LngLat } | null = null;
  for (const area of src.climateAreas) {
    const climate = resolveClimateFromColor(area.fill);
    if (!climate || area.areaSqKm <= 0) continue;
    const weighted = area.areaSqKm * getAgricultureFactor(climate);
    arableSqKm += weighted;
    zonedSqKm += area.areaSqKm;
    if (!best || weighted > best.weighted) best = { climate, weighted, point: area.point };
  }
  const arableShare = arableSqKm / src.areaSqKm;
  if (!best || best.weighted <= 0 || arableShare < RESOURCE_LIMITS.minArableShare) return null;
  return {
    resourceType: "agricultural",
    name: `${src.countryName} farmland`,
    coordinates: best.point,
    quantity: share(arableShare, 1),
    quality: share(arableSqKm / zonedSqKm, 1),
    climateZone: best.climate,
  };
}

/** The resources the country's mapped geography shows (pure; see the module header). */
export function deriveGeographicResources(src: ResourceSourceData): DerivedResource[] {
  const resources = waterResources(src);
  if (src.coastlineKm > 0 && src.coastPoint) {
    resources.push({
      resourceType: "fishery",
      name: `${src.countryName} coastal waters`,
      coordinates: src.coastPoint,
      quantity: share(src.coastlineKm, RESOURCE_SCALES.coastFullKm),
    });
  }
  const farm = farmland(src);
  if (farm) resources.push(farm);
  return resources;
}

const COUNTRY_CTE = `
  WITH c AS (
    SELECT id, "realmId",
      ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)) AS geom
    FROM "Country"
    WHERE id = $1 AND geometry IS NOT NULL
    LIMIT 1
  )`;

/** Realm layer features of one type clipped to the country, largest first. */
function clippedLayerSql(layerType: "rivers" | "lakes" | "climate", measure: string) {
  return `${COUNTRY_CTE}
    SELECT ml."displayName" AS name, ml.properties->>'fill' AS fill,
      ${measure} AS size,
      ST_X(ST_PointOnSurface(x.g)) AS lng, ST_Y(ST_PointOnSurface(x.g)) AS lat
    FROM c
    JOIN map_layers ml ON ml."layerType" = '${layerType}' AND ml."isActive" = true
      AND ml.geom_postgis IS NOT NULL AND ml."worldId" = c."realmId"
      AND ST_Intersects(ml.geom_postgis, c.geom)
    CROSS JOIN LATERAL (SELECT ST_Intersection(ST_MakeValid(ml.geom_postgis), c.geom) AS g) x
    WHERE NOT ST_IsEmpty(x.g)
    ORDER BY size DESC
    LIMIT 50`;
}

/** The border not shared with a neighbouring political feature (1 km tolerance), as one point. */
const COAST_POINT_SQL = `${COUNTRY_CTE},
  n AS (
    SELECT ST_Union(ST_MakeValid(ml.geom_postgis)) AS g
    FROM c
    JOIN map_layers ml ON ml."layerType" = 'political' AND ml."isActive" = true
      AND ml.geom_postgis IS NOT NULL AND ml."countryId" IS NOT NULL AND ml."countryId" <> c.id
      AND ml."worldId" = c."realmId" AND ST_DWithin(ml.geom_postgis, c.geom, 0.02)
  ),
  coast AS (
    SELECT COALESCE(ST_Difference(ST_Boundary(c.geom), ST_Buffer(n.g, 0.01)), ST_Boundary(c.geom)) AS g
    FROM c, n
  )
  SELECT ST_X(ST_PointOnSurface(g)) AS lng, ST_Y(ST_PointOnSurface(g)) AS lat,
    (SELECT ST_Area(geom::geography) / 1e6 FROM c) AS "areaSqKm"
  FROM coast
  WHERE g IS NOT NULL AND NOT ST_IsEmpty(g)`;

type Row = Record<string, unknown>;
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const num = (v: unknown) => (v === null || v === undefined ? NaN : Number(v));
const point = (r: Row): LngLat | null => {
  const lng = num(r.lng);
  const lat = num(r.lat);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [round4(lng), round4(lat)] : null;
};
/** Loads `ResourceSourceData` for a country from PostGIS; null when it has no geometry. */
export async function loadResourceSourceData(
  db: PrismaClient,
  countryId: string
): Promise<ResourceSourceData | null> {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { name: true, coastlineKm: true, landArea: true, geometry: true },
  });
  if (!country?.geometry) return null;

  const query = (sql: string) => db.$queryRawUnsafe<Row[]>(sql, countryId);
  const [rivers, lakes, climate, coast] = await Promise.all([
    query(clippedLayerSql("rivers", "ST_Length(x.g::geography) / 1000")),
    query(clippedLayerSql("lakes", "ST_Area(x.g::geography) / 1e6")),
    query(clippedLayerSql("climate", "ST_Area(x.g::geography) / 1e6")),
    query(COAST_POINT_SQL),
  ]);

  const withPoint = <T>(rows: Row[], build: (r: Row, p: LngLat) => T): T[] =>
    rows.flatMap((r) => {
      const p = point(r);
      return p ? [build(r, p)] : [];
    });
  const measuredArea = num(coast[0]?.areaSqKm);

  return {
    countryName: country.name,
    areaSqKm: Number.isFinite(measuredArea) ? measuredArea : (country.landArea ?? 0),
    coastlineKm: country.coastlineKm ?? 0,
    coastPoint: coast[0] ? point(coast[0]) : null,
    rivers: withPoint(rivers, (r, p) => ({
      name: (r.name as string | null) ?? null,
      lengthKm: num(r.size) || 0,
      point: p,
    })),
    lakes: withPoint(lakes, (r, p) => ({
      name: (r.name as string | null) ?? null,
      areaSqKm: num(r.size) || 0,
      point: p,
    })),
    climateAreas: withPoint(climate, (r, p) => ({
      fill: String(r.fill ?? ""),
      areaSqKm: num(r.size) || 0,
      point: p,
    })),
  };
}

/**
 * Recomputes a country's `GeographicResource` rows from its map data, replacing the old ones.
 * Returns how many were written (0 when the country has no geometry).
 */
export async function refreshGeographicResources(
  db: PrismaClient,
  countryId: string
): Promise<number> {
  const source = await loadResourceSourceData(db, countryId);
  const resources = source ? deriveGeographicResources(source) : [];
  await db.$transaction([
    db.geographicResource.deleteMany({ where: { countryId } }),
    db.geographicResource.createMany({
      data: resources.map((r) => ({
        countryId,
        resourceType: r.resourceType,
        name: r.name,
        coordinates: r.coordinates,
        quantity: r.quantity,
        ...(r.quality !== undefined && { quality: r.quality }),
        climateZone: r.climateZone ?? null,
      })),
    }),
  ]);
  return resources.length;
}
