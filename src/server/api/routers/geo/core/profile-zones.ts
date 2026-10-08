import type { Geometry } from "geojson";
import type { PrismaClient } from "@prisma/client";
import {
  ELEVATION_ZONES,
  climateMetadataType,
  getAgricultureFactor,
  resolveClimateFromColor,
  type ClimateZoneEntry,
  type ElevationZoneEntry,
} from "~/lib/maps/geo-analytics";
import { climateZoneOf } from "~/lib/maps/climate-zones";
import { isLandBand } from "~/lib/maps/elevation-config";
import type { ClimateKey } from "~/lib/maps/realm-map-settings";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { estimateBboxOverlap } from "./geometry";

/** Longitude/latitude extent of the country; the whole globe when it has no stored bounding box. */
export type Extent = [minLng: number, minLat: number, maxLng: number, maxLat: number];

const LAYER_SELECT = {
  featureId: true,
  geometry: true,
  properties: true,
  areaSqKm: true,
  displayName: true,
} as const;

/** A climate or altitude feature's fill (and zone ids) with the area it contributes to a country. */
export interface ZoneFill {
  fill: string;
  climateId?: string | null;
  zoneId?: string | null;
  overlapArea: number;
}

/** Layers that overlap the extent, with each one's fill colour and the area it contributes. */
function overlappingFills(
  layers: Array<{ geometry: unknown; properties: unknown; areaSqKm: number | null }>,
  extent: Extent
): ZoneFill[] {
  return layers.flatMap((layer) => {
    const props = layer.properties as Record<string, unknown> | null;
    const geometry = layer.geometry as Geometry | null;
    const area = layer.areaSqKm ?? 0;
    if (!props || !geometry || area <= 0) return [];
    // Rough bbox overlap (PostGIS ST_Intersection would be more precise)
    const overlap = estimateBboxOverlap(geometry, ...extent);
    if (overlap <= 0) return [];
    return [
      {
        fill: (props["fill"] as string) ?? "",
        climateId: (props["climateId"] as string | undefined) ?? null,
        zoneId: (props["zoneId"] as string | undefined) ?? null,
        overlapArea: area * overlap,
      },
    ];
  });
}

/**
 * $1 country, $2 layer type: the area (km² on Earth) of the country's own realm's features of that layer inside
 * its border, per fill colour and zone.
 */
const CLIPPED_FILLS_SQL = `
  WITH country AS (
    SELECT "realmId", ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)) AS geom
      FROM "Country" WHERE id = $1 LIMIT 1
  )
  SELECT ml.properties->>'fill' AS fill, ml.properties->>'climateId' AS "climateId",
         ml.properties->>'zoneId' AS "zoneId",
         SUM(ST_Area(ST_Intersection(ml.geom_postgis, c.geom)::geography)) / 1000000.0 AS area
    FROM country c
    JOIN map_layers ml ON ml."worldId" = c."realmId" AND ml."layerType" = $2 AND ml."isActive" = true
   WHERE ml.geom_postgis IS NOT NULL AND ST_Intersects(ml.geom_postgis, c.geom)
   GROUP BY 1, 2, 3`;

/**
 * The fills of a country's realm layer and the area each covers in it. A realm's layers are clipped to the
 * nation in PostGIS (its zones are large pieces whose boxes span continents); IxWorld keeps the bounding-box
 * estimate, which is also the fallback when PostGIS fails.
 */
export async function countryZoneFills(
  db: PrismaClient,
  country: { id: string; realmId: string },
  layerType: "climate" | "altitudes",
  extent: Extent
): Promise<ZoneFill[]> {
  if (country.realmId !== DEFAULT_REALM_ID) {
    try {
      const rows = await db.$queryRawUnsafe<
        Array<{
          fill: string | null;
          climateId: string | null;
          zoneId: string | null;
          area: number;
        }>
      >(CLIPPED_FILLS_SQL, country.id, layerType);
      return rows.map((r) => ({ ...r, fill: r.fill ?? "", overlapArea: Number(r.area) || 0 }));
    } catch (err) {
      console.warn("PostGIS zone clipping failed, falling back to bbox estimation:", err);
    }
  }
  const layers = await db.mapLayer.findMany({
    where: { layerType, isActive: true, realmId: country.realmId },
    select: LAYER_SELECT,
  });
  return overlappingFills(layers, extent);
}

function withPercentAreas<T extends { areaSqKm: number; percentArea: number }>(zones: T[]) {
  const total = zones.reduce((sum, zone) => sum + zone.areaSqKm, 0);
  for (const zone of zones) {
    zone.percentArea = total > 0 ? Math.round((zone.areaSqKm / total) * 100 * 10) / 10 : 0;
  }
  return zones;
}

/** A fill's zone: named by the realm's climate key when it has one, else by IxWorld's Trewartha colours. */
function climateEntry(fill: ZoneFill, key: ClimateKey | null): ClimateZoneEntry | null {
  if (!key) {
    // Climate type comes from the fill colour (SVG paths have no text names)
    const type = resolveClimateFromColor(fill.fill);
    return type
      ? { type, percentArea: 0, areaSqKm: 0, agricultureFactor: getAgricultureFactor(type) }
      : null;
  }
  const zone = climateZoneOf(key, { fill: fill.fill, climateId: fill.climateId });
  if (!zone) return null;
  // The estimates (temperature, rain, farmland) read Trewartha metadata: the nearest type stands in.
  const type = climateMetadataType(zone.code) ?? `${zone.name} (${zone.code})`;
  return {
    type,
    code: zone.code,
    name: zone.name,
    color: zone.color,
    percentArea: 0,
    areaSqKm: 0,
    agricultureFactor: getAgricultureFactor(type),
  };
}

/**
 * Climate zones overlapping the extent. `mergeSameType` folds the several polygons of one climate into a single
 * zone (one per key zone when the realm has a climate key).
 */
export function buildClimateZones(
  fills: ZoneFill[],
  mergeSameType: boolean,
  key: ClimateKey | null
) {
  const zones: ClimateZoneEntry[] = [];
  for (const fill of fills) {
    const entry = climateEntry(fill, key);
    if (!entry) continue;
    const existing = mergeSameType
      ? zones.find((zone) => zone.type === entry.type && zone.code === entry.code)
      : undefined;
    if (existing) existing.areaSqKm += fill.overlapArea;
    else zones.push({ ...entry, areaSqKm: fill.overlapArea });
  }
  return withPercentAreas(zones);
}

/** Elevation zones overlapping the extent; a land-only band (a realm without elevations) counts as none. */
export function buildElevationZones(fills: ZoneFill[]) {
  const zones: ElevationZoneEntry[] = [];
  for (const { fill, zoneId, overlapArea } of fills) {
    if (isLandBand({ zoneId })) continue;
    const match = ELEVATION_ZONES.find((ez) => ez.color.toLowerCase() === fill.toLowerCase());
    if (!match) continue;
    const existing = zones.find((zone) => zone.zone === match.zoneId);
    if (existing) existing.areaSqKm += overlapArea;
    else {
      zones.push({
        zone: match.zoneId,
        name: match.zoneName,
        percentArea: 0,
        areaSqKm: overlapArea,
        minElev: match.elevationMin,
        maxElev: match.elevationMax,
      });
    }
  }
  return withPercentAreas(zones);
}
