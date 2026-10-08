/**
 * The map's ocean-label layer data: IxWorld's water names (`WATER_BODY_LABELS`) and every realm's own labels
 * (oceans, seas, regions, continents; `realm-labels.ts`) as one feature list for the theme style's `ocean-labels`
 * layer (src/lib/map-styles/*.json), so a realm's names look and behave exactly like IxWorld's: size, spacing and
 * zoom steps by rank, water in the theme's blues, land names (regions, continents) in capitals and a land colour.
 * Client-safe.
 */
import type { Feature, FeatureCollection, Point } from "geojson";
import { WATER_BODY_LABELS } from "~/lib/maps/map-config";
import { realmLabelRank, type RealmLabelRank } from "~/lib/maps/realm-labels";

export interface OceanLabelProperties {
  name: string;
  /** IxWorld's water kind (ocean, sea, strait) or a realm label's kind (ocean, sea, region, continent). */
  wbType: string;
  rank: RealmLabelRank;
}

export type OceanLabelFeature = Feature<Point, OceanLabelProperties> & { id: number };

const toFeature = (
  coordinates: [number, number],
  properties: OceanLabelProperties,
  index: number
): OceanLabelFeature => ({
  type: "Feature",
  id: index + 1,
  geometry: { type: "Point", coordinates },
  properties,
});

/** The realm labels among `getAllMapLabels`' features (a nation's labels stay with the custom label layer). */
function realmLabelProperties(mapLabels: FeatureCollection | undefined) {
  return (mapLabels?.features ?? []).flatMap((f) => {
    const props = f.properties;
    if (props?.realmLabel !== true || f.geometry.type !== "Point") return [];
    const [lng, lat] = f.geometry.coordinates;
    if (lng === undefined || lat === undefined) return [];
    const properties: OceanLabelProperties = {
      name: String(props.text),
      wbType: String(props.labelType),
      rank: realmLabelRank(String(props.labelType), props.rank),
    };
    return [{ coordinates: [lng, lat] as [number, number], properties }];
  });
}

/** IxWorld's water names (only when the map shows IxWorld) followed by the realm's own labels. */
export function oceanLabelFeatures(
  ixWorld: boolean,
  mapLabels: FeatureCollection | undefined
): OceanLabelFeature[] {
  const builtIn = ixWorld
    ? WATER_BODY_LABELS.map((wb) => ({
        coordinates: wb.coordinates,
        properties: { name: wb.name, wbType: wb.type, rank: wb.rank },
      }))
    : [];
  return [...builtIn, ...realmLabelProperties(mapLabels)].map((l, i) =>
    toFeature(l.coordinates, l.properties, i)
  );
}
