/**
 * editor-types.ts — Shared forms and domain types for the Map Editor slices.
 */

export type FeatureType =
  | "city"
  | "subdivision"
  | "poi"
  | "storyPin"
  | "mapLabel"
  | "route"
  | "peak"
  | "river"
  | "lake"
  | "gap";

export type EditorMode =
  | "view"
  | "add-city"
  | "add-subdivision"
  | "add-poi"
  | "edit-city"
  | "edit-subdivision"
  | "edit-poi"
  | "import-provinces"
  | "import-cities"
  | "add-route"
  | "edit-route"
  | "paint"
  | "add-peak"
  | "edit-peak"
  | "add-river"
  | "edit-river"
  | "add-lake"
  | "edit-lake"
  | "split-subdivision"
  | "lasso-select"
  | "ruler";

export interface EditorFeature {
  id: string;
  type: FeatureType;
  name: string;
  coordinates?: [number, number];
  geometry?: object;
  properties: Record<string, string | number | boolean | null | undefined | object>;
}

export interface CityFormData {
  name: string;
  cityType: string;
  population?: number;
  isNationalCapital: boolean;
  isSubdivisionCapital: boolean;
  subdivisionId?: string;
  wikiPageTitle?: string;
  elevation?: number;
  foundedYear?: number;
  coordinates?: [number, number];
}

export interface SubdivisionFormData {
  name: string;
  type: string;
  level: number;
  capital?: string;
  population?: number;
  areaSqKm?: number;
  color?: string;
  wikiPageTitle?: string;
  geometry?: object;
}

export interface POIFormData {
  name: string;
  category: string;
  description?: string;
  icon?: string;
  wikiPageTitle?: string;
  subdivisionId?: string;
  coordinates?: [number, number];
  // Story & Historical Lore attributes
  storyContent?: string;
  ixTimeYear?: number;
  eraLabel?: string;
  importance?: number;
  storylineId?: string;
}

type StoryPinCategory =
  | "battle"
  | "founding"
  | "treaty"
  | "cultural"
  | "religious"
  | "natural"
  | "trade"
  | "exploration"
  | "naval"
  | "settlement"
  | "government"
  | "biography"
  | "linguistic"
  | "upheaval";

type MapLabelType =
  | "mountain_range"
  | "strait"
  | "bay"
  | "peninsula"
  | "plateau"
  | "valley"
  | "desert"
  | "sea"
  | "region"
  | "historical";

export interface StoryPinFormData {
  title: string;
  content: string;
  contentFormat: "plain" | "markdown";
  category: StoryPinCategory;
  importance: number;
  ixTimeYear?: number;
  eraLabel?: string;
  wikiPageTitle?: string;
  photos?: string[];
  thumbnailUrl?: string;
  storylineId?: string;
  storylineOrder?: number;
  coordinates?: [number, number];
}

export interface MapLabelFormData {
  text: string;
  labelType: MapLabelType;
  fontSize: number;
  color: string;
  rotation: number;
  letterSpacing: number;
  fontWeight: string;
  opacity: number;
  minZoom: number;
  maxZoom: number;
  wikiPageTitle?: string;
  coordinates?: [number, number];
}

export interface PeakFormData {
  name: string;
  elevation: number;
  prominence?: number;
  subdivisionId?: string;
  wikiPageTitle?: string;
  coordinates?: [number, number];
}

export interface NamedRiverFormData {
  name: string;
  wikiPageTitle?: string;
  geometry?: object;
}

export interface NamedLakeFormData {
  name: string;
  waterType?: string;
  maxDepthM?: number;
  wikiPageTitle?: string;
  geometry?: object;
}

const DUPLICATE_OFFSET_DEG = 0.05;

type DuplicateInput = Record<string, string | number | boolean | object | null | undefined>;

const offsetCoords = ([lng, lat]: [number, number]): [number, number] => [
  lng + DUPLICATE_OFFSET_DEG,
  lat + DUPLICATE_OFFSET_DEG,
];
const offsetRings = (rings: [number, number][][]) => rings.map((ring) => ring.map(offsetCoords));

/** Shift a Polygon / MultiPolygon; other geometries come back unchanged. */
function offsetGeometry(geometry: object): object {
  const geom = geometry as {
    type?: unknown;
    coordinates: [number, number][][] & [number, number][][][];
  };
  if (geom?.type === "Polygon") {
    return { ...geom, coordinates: offsetRings(geom.coordinates) };
  }
  if (geom?.type === "MultiPolygon") {
    return { ...geom, coordinates: geom.coordinates.map(offsetRings) };
  }
  return geometry;
}

/** Input for creating a copy of `feature`, nudged aside so it doesn't sit on the original. */
export function buildDuplicateInput(feature: EditorFeature): DuplicateInput {
  const name = `${feature.name} (copy)`;
  const p = feature.properties;
  const coordinates = feature.coordinates ? offsetCoords(feature.coordinates) : undefined;
  const geometry = feature.geometry ? offsetGeometry(feature.geometry) : undefined;

  const builders: Partial<Record<FeatureType, () => DuplicateInput>> = {
    city: () => ({
      name,
      type: (p.cityType as string) ?? "city",
      coordinates,
      population: p.population ?? undefined,
      elevation: p.elevation ?? undefined,
      foundedYear: p.foundedYear ?? undefined,
      isNationalCapital: false,
      isSubdivisionCapital: false,
      wikiPageTitle: undefined,
    }),
    subdivision: () => ({
      name,
      type: (p.type as string) ?? "province",
      level: (p.level as number) ?? 1,
      color: (p.color as string) ?? undefined,
      geometry,
      population: p.population ?? undefined,
      areaSqKm: p.areaSqKm ?? undefined,
    }),
    poi: () => ({
      name,
      category: (p.category as string) ?? "landmark",
      coordinates,
      description: (p.description as string) ?? undefined,
      icon: (p.icon as string) ?? undefined,
      wikiPageTitle: undefined,
    }),
    storyPin: () => ({
      title: name,
      content: (p.content as string) ?? "",
      category: (p.category as string) ?? "cultural",
      importance: (p.importance as number) ?? 3,
      coordinates,
      ixTimeYear: p.ixTimeYear ?? undefined,
      eraLabel: (p.eraLabel as string) ?? undefined,
      contentFormat: (p.contentFormat as "plain" | "markdown") ?? "markdown",
      wikiPageTitle: undefined,
    }),
    mapLabel: () => ({
      text: name,
      labelType: (p.labelType as string) ?? "geographic",
      coordinates,
      fontSize: (p.fontSize as number) ?? 14,
      color: (p.color as string) ?? "#333333",
      rotation: (p.rotation as number) ?? 0,
      letterSpacing: (p.letterSpacing as number) ?? 0,
      fontWeight: (p.fontWeight as string) ?? "normal",
      opacity: (p.opacity as number) ?? 1.0,
      minZoom: (p.minZoom as number) ?? 0,
      maxZoom: (p.maxZoom as number) ?? 24,
      wikiPageTitle: undefined,
    }),
    peak: () => ({
      name,
      elevation: (p.elevation as number) ?? 1000,
      prominence: p.prominence ?? undefined,
      coordinates,
      subdivisionId: p.subdivisionId ?? undefined,
      wikiPageTitle: undefined,
    }),
    river: () => ({ name, geometry, wikiPageTitle: undefined }),
    lake: () => ({
      name,
      waterType: (p.waterType as string) ?? "freshwater",
      geometry,
      wikiPageTitle: undefined,
    }),
  };

  return builders[feature.type]?.() ?? { name };
}
