import type {
  EditorFeature,
  EditorMode,
  CityFormData,
  SubdivisionFormData,
  POIFormData,
  PeakFormData,
  NamedRiverFormData,
  NamedLakeFormData,
} from "./editor-types";

export interface FeatureEditState {
  mode: EditorMode;
  cityForm?: CityFormData;
  subdivisionForm?: SubdivisionFormData;
  poiForm?: POIFormData;
  peakForm?: PeakFormData;
  riverForm?: NamedRiverFormData;
  lakeForm?: NamedLakeFormData;
  editingRouteId?: string;
}

type PropertyValue = string | number | boolean | object | null | undefined;

const getString = (val: PropertyValue): string | undefined =>
  typeof val === "string" ? val : undefined;

const getNumber = (val: PropertyValue): number | undefined =>
  typeof val === "number" ? val : undefined;

export function mapFeatureToEditState(feature: EditorFeature): FeatureEditState {
  const p = feature.properties || {};

  switch (feature.type) {
    case "city":
      return {
        mode: "edit-city",
        cityForm: {
          name: feature.name,
          cityType: getString(p.cityType) || "city",
          population: getNumber(p.population),
          isNationalCapital: Boolean(p.isNationalCapital),
          isSubdivisionCapital: Boolean(p.isSubdivisionCapital),
          subdivisionId: getString(p.subdivisionId),
          wikiPageTitle: getString(p.wikiPageTitle),
          elevation: getNumber(p.elevation),
          foundedYear: getNumber(p.foundedYear),
          coordinates: feature.coordinates,
        },
      };

    case "subdivision":
      return {
        mode: "edit-subdivision",
        subdivisionForm: {
          name: feature.name,
          type: getString(p.type) || "province",
          level: getNumber(p.level) || 1,
          capital: getString(p.capital),
          population: getNumber(p.population),
          areaSqKm: getNumber(p.areaSqKm),
          color: getString(p.color),
          wikiPageTitle: getString(p.wikiPageTitle),
          geometry: feature.geometry,
        },
      };

    case "poi":
      return {
        mode: "edit-poi",
        poiForm: {
          name: feature.name,
          category: getString(p.category) || "landmark",
          description: getString(p.description),
          icon: getString(p.icon),
          wikiPageTitle: getString(p.wikiPageTitle),
          subdivisionId: getString(p.subdivisionId),
          coordinates: feature.coordinates,
          storyContent: getString(p.storyContent) || getString(p.content),
          ixTimeYear: getNumber(p.ixTimeYear),
          eraLabel: getString(p.eraLabel),
          importance: getNumber(p.importance),
          storylineId: getString(p.storylineId),
        },
      };

    case "storyPin":
      return {
        mode: "edit-poi",
        poiForm: {
          name: feature.name,
          category: getString(p.category) || "cultural",
          description: getString(p.content) || getString(p.description),
          icon: getString(p.icon),
          wikiPageTitle: getString(p.wikiPageTitle),
          subdivisionId: getString(p.subdivisionId),
          coordinates: feature.coordinates,
          storyContent: getString(p.content),
          ixTimeYear: getNumber(p.ixTimeYear),
          eraLabel: getString(p.eraLabel),
          importance: getNumber(p.importance),
          storylineId: getString(p.storylineId),
        },
      };

    case "mapLabel":
      return { mode: "view" };

    case "peak":
      return {
        mode: "edit-peak",
        peakForm: {
          name: feature.name,
          elevation: getNumber(p.elevation) || 0,
          prominence: getNumber(p.prominence),
          subdivisionId: getString(p.subdivisionId),
          wikiPageTitle: getString(p.wikiPageTitle),
          coordinates: feature.coordinates,
        },
      };

    case "river":
      return {
        mode: "edit-river",
        riverForm: {
          name: feature.name,
          wikiPageTitle: getString(p.wikiPageTitle),
          geometry: feature.geometry,
        },
      };

    case "lake":
      return {
        mode: "edit-lake",
        lakeForm: {
          name: feature.name,
          waterType: getString(p.waterType) || "freshwater",
          wikiPageTitle: getString(p.wikiPageTitle),
          geometry: feature.geometry,
        },
      };

    case "route":
      return {
        mode: "edit-route",
        editingRouteId: feature.id,
      };

    default:
      return { mode: "view" };
  }
}
