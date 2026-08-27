/**
 * editor-types.ts — Shared forms and domain types for the Map Editor slices.
 */

export type FeatureType =
  "city" | "subdivision" | "poi" | "storyPin" | "mapLabel" | "route" | "peak" | "river" | "lake";

export type EditorMode =
  | "view"
  | "add-city"
  | "add-subdivision"
  | "add-poi"
  | "add-story-pin"
  | "add-label"
  | "edit-city"
  | "edit-subdivision"
  | "edit-poi"
  | "edit-story-pin"
  | "edit-label"
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
  | "ruler"
  | "eyedropper"
  | "magic-wand"
  | "paint-fill"
  | "pan";

export interface EditorFeature {
  id: string;
  type: FeatureType;
  name: string;
  coordinates?: [number, number];
  geometry?: object;
  properties: Record<string, any>;
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
}

export interface StoryPinFormData {
  title: string;
  content: string;
  contentFormat: "plain" | "markdown";
  category: string;
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
  labelType: string;
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

export type ActiveFormState =
  | { type: "city"; data: CityFormData; onChange: (d: CityFormData) => void }
  | { type: "subdivision"; data: SubdivisionFormData; onChange: (d: SubdivisionFormData) => void }
  | { type: "poi"; data: POIFormData; onChange: (d: POIFormData) => void }
  | { type: "storyPin"; data: StoryPinFormData; onChange: (d: StoryPinFormData) => void }
  | { type: "mapLabel"; data: MapLabelFormData; onChange: (d: MapLabelFormData) => void }
  | { type: "peak"; data: PeakFormData; onChange: (d: PeakFormData) => void }
  | { type: "river"; data: NamedRiverFormData; onChange: (d: NamedRiverFormData) => void }
  | { type: "lake"; data: NamedLakeFormData; onChange: (d: NamedLakeFormData) => void };

const DUPLICATE_OFFSET_DEG = 0.05;

export function buildDuplicateInput(feature: EditorFeature): Record<string, unknown> {
  const name = `${feature.name} (copy)`;

  const offsetCoords = (coords: [number, number]): [number, number] => [
    coords[0] + DUPLICATE_OFFSET_DEG,
    coords[1] + DUPLICATE_OFFSET_DEG,
  ];

  const offsetGeometry = (geometry: object): object => {
    if (!geometry || typeof (geometry as any).type !== "string") return geometry;
    const geom = geometry as any;
    if (geom.type === "Polygon") {
      return {
        ...geom,
        coordinates: geom.coordinates.map((ring: [number, number][]) => ring.map(offsetCoords)),
      };
    }
    if (geom.type === "MultiPolygon") {
      return {
        ...geom,
        coordinates: geom.coordinates.map((polygon: [number, number][][]) =>
          polygon.map((ring) => ring.map(offsetCoords))
        ),
      };
    }
    return geom;
  };

  switch (feature.type) {
    case "city": {
      const p = feature.properties;
      return {
        name,
        type: (p.cityType as string) ?? "city",
        coordinates: feature.coordinates ? offsetCoords(feature.coordinates) : undefined,
        population: p.population ?? undefined,
        elevation: p.elevation ?? undefined,
        foundedYear: p.foundedYear ?? undefined,
        isNationalCapital: false,
        isSubdivisionCapital: false,
        wikiPageTitle: undefined,
      };
    }
    case "subdivision": {
      const p = feature.properties;
      return {
        name,
        type: (p.type as string) ?? "province",
        level: (p.level as number) ?? 1,
        color: (p.color as string) ?? undefined,
        geometry: feature.geometry ? offsetGeometry(feature.geometry) : undefined,
        population: p.population ?? undefined,
        areaSqKm: p.areaSqKm ?? undefined,
      };
    }
    case "poi": {
      const p = feature.properties;
      return {
        name,
        category: (p.category as string) ?? "landmark",
        coordinates: feature.coordinates ? offsetCoords(feature.coordinates) : undefined,
        description: (p.description as string) ?? undefined,
        icon: (p.icon as string) ?? undefined,
        wikiPageTitle: undefined,
      };
    }
    case "storyPin": {
      const p = feature.properties;
      return {
        title: name,
        content: (p.content as string) ?? "",
        category: (p.category as string) ?? "cultural",
        importance: (p.importance as number) ?? 3,
        coordinates: feature.coordinates ? offsetCoords(feature.coordinates) : undefined,
        ixTimeYear: p.ixTimeYear ?? undefined,
        eraLabel: (p.eraLabel as string) ?? undefined,
        contentFormat: (p.contentFormat as "plain" | "markdown") ?? "markdown",
        wikiPageTitle: undefined,
      };
    }
    case "mapLabel": {
      const p = feature.properties;
      return {
        text: name,
        labelType: (p.labelType as string) ?? "geographic",
        coordinates: feature.coordinates ? offsetCoords(feature.coordinates) : undefined,
        fontSize: (p.fontSize as number) ?? 14,
        color: (p.color as string) ?? "#333333",
        rotation: (p.rotation as number) ?? 0,
        letterSpacing: (p.letterSpacing as number) ?? 0,
        fontWeight: (p.fontWeight as string) ?? "normal",
        opacity: (p.opacity as number) ?? 1.0,
        minZoom: (p.minZoom as number) ?? 0,
        maxZoom: (p.maxZoom as number) ?? 24,
        wikiPageTitle: undefined,
      };
    }
    case "peak": {
      const p = feature.properties;
      return {
        name,
        elevation: (p.elevation as number) ?? 1000,
        prominence: p.prominence ?? undefined,
        coordinates: feature.coordinates ? offsetCoords(feature.coordinates) : undefined,
        subdivisionId: p.subdivisionId ?? undefined,
        wikiPageTitle: undefined,
      };
    }
    case "river": {
      return {
        name,
        geometry: feature.geometry ? offsetGeometry(feature.geometry) : undefined,
        wikiPageTitle: undefined,
      };
    }
    case "lake": {
      const p = feature.properties;
      return {
        name,
        waterType: (p.waterType as string) ?? "freshwater",
        geometry: feature.geometry ? offsetGeometry(feature.geometry) : undefined,
        wikiPageTitle: undefined,
      };
    }
    default:
      return { name };
  }
}
