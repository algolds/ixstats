/**
 * editor-domain.ts — Strictly typed domain primitives for the IxStates Map Editor.
 *
 * Implements branded nominal IDs and discriminated feature unions to ensure
 * 100% compile-time type safety with TypeScript 7.0.
 */

import type { Position, Polygon, MultiPolygon, LineString, MultiLineString, Point } from "geojson";

// ──────────────────────────────────────────────
// Branded Nominal Identifiers
// ──────────────────────────────────────────────

declare const __brand: unique symbol;
export type Brand<K, T> = K & { readonly [__brand]: T };

export type CountryId = Brand<string, "CountryId">;
export type FeatureId = Brand<string, "FeatureId">;
export type SubdivisionId = Brand<string, "SubdivisionId">;
export type RouteId = Brand<string, "RouteId">;

export type Lng = Brand<number, "Longitude">;
export type Lat = Brand<number, "Latitude">;
export type GeoPoint = readonly [Lng, Lat];
export type ScreenPoint = readonly [x: number, y: number];
export type BoundingBox = readonly [minLng: Lng, minLat: Lat, maxLng: Lng, maxLat: Lat];

// ──────────────────────────────────────────────
// Feature Types & Discriminated Union
// ──────────────────────────────────────────────

export type FeatureType =
  | "city"
  | "subdivision"
  | "poi"
  | "storyPin"
  | "mapLabel"
  | "peak"
  | "river"
  | "lake"
  | "route";

export interface BaseEditorFeature {
  id: string;
  name: string;
  countryId?: string;
  wikiPageTitle?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CityFeature extends BaseEditorFeature {
  type: "city";
  coordinates: [number, number];
  geometry?: Point;
  properties: {
    cityType?: string;
    population?: number;
    elevation?: number;
    foundedYear?: number;
    isNationalCapital?: boolean;
    isSubdivisionCapital?: boolean;
    wikiPageTitle?: string;
    [key: string]: unknown;
  };
}

export interface SubdivisionFeature extends BaseEditorFeature {
  type: "subdivision";
  coordinates?: [number, number];
  geometry: Polygon | MultiPolygon;
  properties: {
    type?: string;
    level?: number;
    color?: string;
    population?: number;
    areaSqKm?: number;
    capitalCityId?: string;
    [key: string]: unknown;
  };
}

export interface POIFeature extends BaseEditorFeature {
  type: "poi";
  coordinates: [number, number];
  geometry?: Point;
  properties: {
    category?: string;
    icon?: string;
    description?: string;
    wikiPageTitle?: string;
    [key: string]: unknown;
  };
}

export interface StoryPinFeature extends BaseEditorFeature {
  type: "storyPin";
  coordinates: [number, number];
  geometry?: Point;
  properties: {
    title?: string;
    content?: string;
    category?: string;
    ixTimeYear?: number;
    [key: string]: unknown;
  };
}

export interface MapLabelFeature extends BaseEditorFeature {
  type: "mapLabel";
  coordinates: [number, number];
  geometry?: Point;
  properties: {
    text?: string;
    labelType?: string;
    fontSize?: number;
    color?: string;
    rotation?: number;
    opacity?: number;
    letterSpacing?: number;
    fontWeight?: "normal" | "bold";
    minZoom?: number;
    maxZoom?: number;
    [key: string]: unknown;
  };
}

export interface PeakFeature extends BaseEditorFeature {
  type: "peak";
  coordinates: [number, number];
  geometry?: Point;
  properties: {
    elevationMeters?: number;
    prominenceMeters?: number;
    mountainRange?: string;
    isVolcano?: boolean;
    [key: string]: unknown;
  };
}

export interface RiverFeature extends BaseEditorFeature {
  type: "river";
  coordinates?: [number, number];
  geometry: LineString | MultiLineString;
  properties: {
    strahlerOrder?: number;
    lengthKm?: number;
    dischargeM3s?: number;
    basinAreaSqKm?: number;
    sourceElevationM?: number;
    mouthElevationM?: number;
    [key: string]: unknown;
  };
}

export interface LakeFeature extends BaseEditorFeature {
  type: "lake";
  coordinates?: [number, number];
  geometry: Polygon | MultiPolygon;
  properties: {
    waterType?: "freshwater" | "saline" | "glacial" | "crater";
    surfaceAreaSqKm?: number;
    maxDepthMeters?: number;
    elevationMeters?: number;
    [key: string]: unknown;
  };
}

export interface RouteFeature extends BaseEditorFeature {
  type: "route";
  coordinates?: [number, number];
  geometry: LineString | MultiLineString;
  properties: {
    routeType?: string;
    transportMode?: "road" | "rail" | "maritime" | "air";
    speedKmh?: number;
    capacity?: number;
    waypoints?: [number, number][];
    [key: string]: unknown;
  };
}

export type TypedEditorFeature =
  | CityFeature
  | SubdivisionFeature
  | POIFeature
  | StoryPinFeature
  | MapLabelFeature
  | PeakFeature
  | RiverFeature
  | LakeFeature
  | RouteFeature;
