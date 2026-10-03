import type { Geometry } from "geojson";
import {
  ELEVATION_ZONES,
  getAgricultureFactor,
  resolveClimateFromColor,
  type ClimateZoneEntry,
  type ElevationZoneEntry,
} from "~/lib/maps/geo-analytics";
import { estimateBboxOverlap } from "./geometry";

/** Longitude/latitude extent of the country; the whole globe when it has no stored bounding box. */
export type Extent = [minLng: number, minLat: number, maxLng: number, maxLat: number];

export const LAYER_SELECT = {
  featureId: true,
  geometry: true,
  properties: true,
  areaSqKm: true,
  displayName: true,
} as const;

/** Layers that overlap the extent, with each one's fill colour and the area it contributes. */
function overlappingFills(
  layers: Array<{ geometry: unknown; properties: unknown; areaSqKm: number | null }>,
  extent: Extent
) {
  return layers.flatMap((layer) => {
    const props = layer.properties as Record<string, unknown> | null;
    const geometry = layer.geometry as Geometry | null;
    const area = layer.areaSqKm ?? 0;
    if (!props || !geometry || area <= 0) return [];
    // Rough bbox overlap (PostGIS ST_Intersection would be more precise)
    const overlap = estimateBboxOverlap(geometry, ...extent);
    if (overlap <= 0) return [];
    return [{ fill: (props["fill"] as string) ?? "", overlapArea: area * overlap }];
  });
}

function withPercentAreas<T extends { areaSqKm: number; percentArea: number }>(zones: T[]) {
  const total = zones.reduce((sum, zone) => sum + zone.areaSqKm, 0);
  for (const zone of zones) {
    zone.percentArea = total > 0 ? Math.round((zone.areaSqKm / total) * 100 * 10) / 10 : 0;
  }
  return zones;
}

type OverlapLayers = Parameters<typeof overlappingFills>[0];

/**
 * Climate zones overlapping the extent. `mergeSameType` folds the several SVG polygons of one
 * climate into a single zone.
 */
export function buildClimateZones(layers: OverlapLayers, extent: Extent, mergeSameType: boolean) {
  const zones: ClimateZoneEntry[] = [];
  for (const { fill, overlapArea } of overlappingFills(layers, extent)) {
    // Climate type comes from the fill colour (SVG paths have no text names)
    const type = resolveClimateFromColor(fill);
    if (!type) continue;
    const existing = mergeSameType ? zones.find((zone) => zone.type === type) : undefined;
    if (existing) existing.areaSqKm += overlapArea;
    else {
      zones.push({
        type,
        percentArea: 0,
        areaSqKm: overlapArea,
        agricultureFactor: getAgricultureFactor(type),
      });
    }
  }
  return withPercentAreas(zones);
}

export function buildElevationZones(layers: OverlapLayers, extent: Extent) {
  const zones: ElevationZoneEntry[] = [];
  for (const { fill, overlapArea } of overlappingFills(layers, extent)) {
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
