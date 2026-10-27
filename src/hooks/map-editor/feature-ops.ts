import type { FeatureType } from "./editor-types";
import type { FeatureMutations } from "./feature-mutations";
import type { EditorAction, HistoryData } from "./useMapHistory";
import {
  bool,
  coords,
  geometry,
  has,
  hexColor,
  int,
  labelType,
  lineString,
  num,
  present,
  storyCategory,
  str,
  usable,
  type GeometryInput,
} from "./history-coercion";

export interface FeatureOps {
  remove: (id: string) => Promise<unknown>;
  /** Creates a feature from a snapshot and returns its new id. */
  create: (data: HistoryData) => Promise<string | undefined>;
  /** Applies a partial snapshot: only the keys present in `data` are sent. */
  restore: (
    id: string,
    data: HistoryData,
    cascaded: EditorAction["cascadedUpdates"],
    side: "previousData" | "newData"
  ) => Promise<unknown>;
}

/** Updates a subdivision; colour / governmentType go through the attribute upsert. */
async function restoreSubdivision(
  m: FeatureMutations,
  resolveId: (id: string) => string,
  countryId: string,
  subdivisionId: string,
  data: HistoryData,
  cascaded: EditorAction["cascadedUpdates"],
  side: "previousData" | "newData"
): Promise<void> {
  const hasStyle = has(data, "color") || has(data, "governmentType");
  // The attribute upsert defaults type/level when omitted, so it needs both.
  const canUpsertStyle = hasStyle && !!str(data.type) && num(data.level) !== undefined;
  const cascadedNeighbors = (cascaded ?? [])
    .map((c) => ({
      subdivisionId: resolveId(c.featureId),
      geometry: geometry(c[side]?.geometry),
    }))
    .filter((c): c is { subdivisionId: string; geometry: GeometryInput } => !!c.geometry);
  const hasCore =
    !!str(data.name) ||
    !!geometry(data.geometry) ||
    has(data, "capital") ||
    has(data, "population") ||
    cascadedNeighbors.length > 0 ||
    (!canUpsertStyle && (!!str(data.type) || num(data.level) !== undefined));

  if (hasCore) {
    await m.subdivision.update.mutateAsync({
      countryId,
      subdivisionId,
      ...usable(data, { name: str, type: str, level: num, geometry, capital: str }),
      ...present(data, { population: int }),
      ...(cascadedNeighbors.length > 0 ? { cascadedNeighbors } : {}),
    });
  }
  if (canUpsertStyle) {
    await m.subdivision.upsertAttributes.mutateAsync({
      countryId,
      id: subdivisionId,
      type: str(data.type),
      level: num(data.level),
      ...present(data, {
        color: (v) => hexColor(v) ?? null,
        governmentType: (v) => str(v) ?? null,
      }),
    });
  }
}

/**
 * Per feature type: delete by id, re-create from a snapshot (returning the new id), and apply a
 * partial snapshot. `resolveId` maps ids of re-created features to their live ids.
 */
export function createFeatureOps(
  m: FeatureMutations,
  countryId: string,
  resolveId: (id: string) => string = (id) => id
): Partial<Record<FeatureType, FeatureOps>> {
  return {
    city: {
      remove: (id) => m.city.remove.mutateAsync({ countryId, cityId: id }),
      create: async (data) =>
        (
          await m.city.create.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored City",
            cityType: str(data.cityType) ?? str(data.type) ?? "city",
            coordinates: coords(data.coordinates) ?? [0, 0],
            population: int(data.population),
            isNationalCapital: bool(data.isNationalCapital) ?? false,
            isSubdivisionCapital: bool(data.isSubdivisionCapital) ?? false,
            subdivisionId: str(data.subdivisionId),
            wikiPageTitle: str(data.wikiPageTitle),
          })
        ).id,
      restore: (id, data) =>
        m.city.update.mutateAsync({
          countryId,
          cityId: id,
          ...usable(data, { name: str, coordinates: coords }),
          ...present(data, {
            cityType: str,
            population: int,
            isNationalCapital: bool,
            isSubdivisionCapital: bool,
          }),
        }),
    },
    subdivision: {
      remove: (id) => m.subdivision.remove.mutateAsync({ countryId, subdivisionId: id }),
      create: async (data) =>
        (
          await m.subdivision.create.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored Region",
            type: str(data.type) ?? "region",
            level: num(data.level) ?? 1,
            geometry: geometry(data.geometry) as Parameters<
              typeof m.subdivision.create.mutateAsync
            >[0]["geometry"],
            capital: str(data.capital),
            population: int(data.population),
          })
        ).id,
      restore: (id, data, cascaded, side) =>
        restoreSubdivision(m, resolveId, countryId, id, data, cascaded, side),
    },
    poi: {
      remove: (id) => m.poi.remove.mutateAsync({ countryId, poiId: id }),
      create: async (data) =>
        (
          await m.poi.create.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored POI",
            category: str(data.category) ?? "landmark",
            coordinates: coords(data.coordinates) ?? [0, 0],
            description: str(data.description),
            icon: str(data.icon),
            wikiPageTitle: str(data.wikiPageTitle),
          })
        ).id,
      restore: (id, data) =>
        m.poi.update.mutateAsync({
          countryId,
          poiId: id,
          ...usable(data, { name: str, category: str, coordinates: coords }),
          ...present(data, { description: str, icon: str }),
        }),
    },
    storyPin: {
      remove: (id) => m.storyPin.remove.mutateAsync({ countryId, pinId: id }),
      create: async (data) =>
        (
          await m.storyPin.create.mutateAsync({
            countryId,
            title: str(data.title) ?? str(data.name) ?? "Restored Story",
            content: str(data.content) ?? "—",
            contentFormat: data.contentFormat === "markdown" ? "markdown" : "plain",
            category: storyCategory(data.category) ?? "cultural",
            importance: Math.min(2, int(data.importance) ?? 0),
            coordinates: coords(data.coordinates) ?? [0, 0],
            ixTimeYear:
              num(data.ixTimeYear) !== undefined ? Math.round(num(data.ixTimeYear)!) : undefined,
            eraLabel: str(data.eraLabel),
            wikiPageTitle: str(data.wikiPageTitle),
          })
        ).id,
      restore: (id, data) =>
        m.storyPin.update.mutateAsync({
          countryId,
          pinId: id,
          ...usable(data, {
            title: str,
            content: str,
            category: storyCategory,
            coordinates: coords,
          }),
        }),
    },
    mapLabel: {
      remove: (id) => m.mapLabel.remove.mutateAsync({ countryId, labelId: id }),
      create: async (data) =>
        (
          await m.mapLabel.create.mutateAsync({
            countryId,
            text: str(data.text) ?? str(data.name) ?? "Restored Label",
            labelType: labelType(data.labelType) ?? "region",
            coordinates: coords(data.coordinates) ?? [0, 0],
            fontSize: num(data.fontSize),
            color: hexColor(data.color),
            rotation: num(data.rotation),
            fontWeight: data.fontWeight === "bold" ? "bold" : undefined,
            opacity: num(data.opacity),
            wikiPageTitle: str(data.wikiPageTitle),
          })
        ).id,
      restore: (id, data) =>
        m.mapLabel.update.mutateAsync({
          countryId,
          labelId: id,
          ...usable(data, {
            text: str,
            labelType,
            coordinates: coords,
            fontSize: num,
            color: hexColor,
          }),
        }),
    },
    peak: {
      remove: (id) => m.peak.remove.mutateAsync({ countryId, peakId: id }),
      create: async (data) =>
        (
          await m.peak.create.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored Peak",
            coordinates: coords(data.coordinates) ?? [0, 0],
            elevation: num(data.elevation) ?? 1000,
            prominence: num(data.prominence),
          })
        ).id,
      restore: (id, data) =>
        m.peak.update.mutateAsync({
          countryId,
          peakId: id,
          ...usable(data, { name: str, coordinates: coords, elevation: num }),
          ...present(data, { prominence: (v) => num(v) ?? null }),
        }),
    },
    river: {
      remove: (id) => m.river.remove.mutateAsync({ countryId, riverId: id }),
      create: async (data) =>
        (
          await m.river.create.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored River",
            geometry: data.geometry as Parameters<typeof m.river.create.mutateAsync>[0]["geometry"],
          })
        ).id,
      restore: (id, data) =>
        m.river.update.mutateAsync({
          countryId,
          riverId: id,
          ...usable(data, { name: str, geometry }),
        }),
    },
    lake: {
      remove: (id) => m.lake.remove.mutateAsync({ countryId, lakeId: id }),
      create: async (data) =>
        (
          await m.lake.create.mutateAsync({
            countryId,
            name: str(data.name) ?? "Restored Lake",
            geometry: data.geometry as Parameters<typeof m.lake.create.mutateAsync>[0]["geometry"],
          })
        ).id,
      restore: (id, data) =>
        m.lake.update.mutateAsync({
          countryId,
          lakeId: id,
          ...usable(data, { name: str, geometry }),
        }),
    },
    route: {
      remove: (id) => m.route.remove.mutateAsync({ countryId, id }),
      create: async (data) => {
        const line = lineString(data.geometry);
        if (!line) return undefined;
        const res = await m.route.create.mutateAsync({
          countryId,
          name: str(data.name) ?? "Restored Route",
          routeType: str(data.routeType) ?? "road",
          geometry: line,
        });
        return (res as { id?: string } | null)?.id;
      },
      restore: async (id, data) => {
        const line = lineString(data.geometry);
        if (line) {
          await m.route.updateGeometry.mutateAsync({ countryId, id, geometry: line });
        }
        if (str(data.name) || str(data.routeType)) {
          await m.route.update.mutateAsync({
            countryId,
            id,
            ...usable(data, { name: str, routeType: str }),
          });
        }
      },
    },
  };
}
